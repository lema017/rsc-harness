// D16 — THE SUGGESTED COMMANDS A CONSUMER IS HANDED MUST NOT NAME THE PARENT PACKAGE.
//
// This is the negative test the decision is built around, and it is written to FAIL LOUDLY with a
// file and a line, because that is the difference between a property that is decidable and one that
// is instrumented. Every other test here asserts that the transformation did what it says; this one
// asserts that nothing a consumer can read and run still points at the parent, wherever it lives.
//
// WHY IT IS A FUNCTIONAL DEFECT AND NOT A COSMETIC ONE. REQUIREMENTS §10 asks the fork to review
// "actualizador, hooks, bootstrap, recuperación, comandos sugeridos, documentación y workflows para
// evitar reinstalar accidentalmente el padre". Upstream's `suggest/SKILL.md` carries
// `npx @ericrisco/rsc add <id>` — step 4 of its own install flow — and Strategy B freezes that file
// byte-identical. A consumer of the FORK who obeys it downloads and runs the PARENT's CLI inside a
// fork-governed project, and the parent's installer materializes `.rsc/skills/<id>/` with NO
// contract: exactly the blind spot stage 2 had to close in `ensureBase` and stage 4 found again in
// `restore`. The project is de-governed silently, by following its own instructions.
//
// WHAT THIS TEST DOES NOT ASSERT, and why that is deliberate: it says nothing about `skills/`. That
// directory is upstream's mirror and the Strategy B invariant freezes it — `git diff --numstat
// origin/main -- skills/` must stay at 0 lines. The rewrite happens in the DELIVERY, never in the
// mirror, so the mirror still names the parent 81 times and that is correct. The test below walks
// what an install actually wrote.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyInstall } from '../scripts/install-apply.js';
import { targetPaths } from '../targets/index.js';
import { alwaysOnSurface, auditInstalledProject, formatConformance } from '../scripts/lib/conformance.js';
import { PARENT_PACKAGE, parentReferences } from '../scripts/lib/governance.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Skills chosen for what they carry, not at random: `suggest` is the always-on body and the worst
// case (10 references, one runnable); `init` is the only skill whose `references/` names the parent
// 15 times, which is what forced the rewrite to cover more than `SKILL.md`; `review` and `worktrees`
// are ordinary SKILL.md cases; `tidy` carries both a SKILL.md and an evals share.
const SKILLS = ['suggest', 'init', 'review', 'worktrees', 'tidy'];

/** Every `[relativePath, line, text]` under `dir` that still names the parent's package. */
function offendersUnder(dir, base = dir) {
  const out = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { out.push(...offendersUnder(p, base)); continue; }
    if (!e.isFile()) continue;
    let buf;
    try { buf = readFileSync(p); } catch { continue; }
    if (!buf.includes(PARENT_PACKAGE)) continue;
    for (const { line, text } of parentReferences(buf.toString('utf8'))) {
      out.push(`${relative(base, p)}:${line}: ${text}`);
    }
  }
  return out;
}

async function install(target, cwd = mkdtempSync(join(tmpdir(), `rsc-sc-${target}-`))) {
  const home = mkdtempSync(join(tmpdir(), `rsc-sc-${target}-home-`));
  await applyInstall({ skillIds: SKILLS, target, home, cwd });
  return { cwd, home, paths: targetPaths(target, home, cwd) };
}

test('THE NEGATIVE TEST: no instruction an installed project hands the consumer names the parent package',
  { timeout: 300000 }, async () => {
    const { cwd, home } = await install('claude');

    // The governed base — the only copy any assistant reads, and the whole of it: `SKILL.md`,
    // `references/` and `evals/`, because `ensureBase` copies the skill DIRECTORY.
    const base = offendersUnder(join(cwd, '.rsc', 'skills'), cwd);
    // The always-on surface, re-emitted at every SessionStart and after every compaction.
    const alwaysOn = offendersUnder(join(cwd, '.rsc', 'governance'), cwd);
    // And the per-target delivery, which for `claude` is a symlink tree into the base.
    const delivered = offendersUnder(join(cwd, '.claude', 'skills'), cwd);

    const all = [...base, ...alwaysOn, ...delivered];
    assert.deepEqual(all, [],
      `these consumer-visible instructions still name ${PARENT_PACKAGE} — each one is a command that `
      + 'installs the PARENT into a fork-governed project and writes a base with no contract:\n  '
      + all.join('\n  '));

    // Measured, not merely absent: the install must actually have written the files this walks, or
    // the emptiness above would be vacuous — the exact shape of vacuity stage 4's review found twice.
    assert.ok(existsSync(join(cwd, '.rsc', 'governance', 'always-on.md')), 'the always-on body exists');
    assert.ok(readdirSync(join(cwd, '.rsc', 'skills')).length >= SKILLS.length, 'the bases were materialized');
    const body = readFileSync(join(cwd, '.rsc', 'governance', 'always-on.md'), 'utf8');
    assert.match(body, /npx @lema017\/rsc-governed add <id>/,
      'and the runnable command is PRESENT and names the fork — absence would also pass the check above');
    assert.ok(readdirSync(join(cwd, '.rsc', 'skills', 'init', 'references')).length > 0,
      'init/references/ reached the delivery, so walking it is not vacuous either');
    void home;
  });

test('and every other target delivery is clean too, including the one that re-renders',
  { timeout: 600000 }, async () => {
    // Cursor is the one delivery that is genuinely TRANSFORMED rather than linked, so it is the one
    // place a rewrite could be lost unseen; the markdown-block targets write the always-on body into
    // a shared instructions file, which is a second, different surface.
    for (const target of ['cursor', 'codex', 'antigravity', 'deepseek']) {
      const { cwd, paths } = await install(target);
      const inProject = offendersUnder(cwd, cwd).filter((o) => !o.startsWith('.git'));
      assert.deepEqual(inProject, [],
        `${target}: these delivered files still name ${PARENT_PACKAGE}:\n  ${inProject.join('\n  ')}`);
      // Non-vacuity: the surface this target actually reads must exist and carry the fork's name.
      assert.ok(existsSync(paths.hookTarget), `${target}: the always-on surface must exist`);
      assert.match(readFileSync(paths.hookTarget, 'utf8'), /@lema017\/rsc-governed/,
        `${target}: and it must name the fork, or the clean result above means nothing`);
    }
  });

test('the criterion-4 instrument REPORTS a parent-named always-on surface, in all five targets, with the file and the line',
  { timeout: 900000 }, async () => {
    // THE MUTATION MEASUREMENT, run as a test rather than described in a document — and run the way
    // stage 4's review proved it has to be. That review found two classes of this instrument that
    // existed and measured NOTHING, so "the check is there" is not evidence; the only evidence is a
    // mutation that makes the check fail.
    //
    // AND THE MUTATION HAS TO HIT THE FILE THE INSTRUMENT READS, which is not the same file for every
    // target. A first attempt here planted upstream's body back in `.rsc/governance/always-on.md` for
    // all five: it correctly failed for `claude`, whose session hook reads that path, and passed for
    // `cursor`, because `.cursor/rules/rsc-suggest.mdc` was written at install time and overwriting
    // the SOURCE afterwards does not touch the SURFACE. A mutation that does not change what the
    // instrument looks at proves nothing about the instrument, which is why `fixtureChanged` is
    // asserted below before anything is concluded from the verdict.
    for (const target of ['claude', 'cursor', 'codex', 'antigravity', 'deepseek']) {
      const { cwd, home } = await install(target);

      const clean = auditInstalledProject({ cwd, home, targets: [target] });
      assert.equal(clean.ran, true, `${target}: the audit must actually run, or this proves nothing`);
      assert.equal(clean.conformant, true, formatConformance(clean).join('\n'));
      assert.deepEqual(clean.alwaysOn[target].namesParent, [], `${target}: the clean surface names no parent`);

      const surface = alwaysOnSurface(target, cwd, home);
      assert.ok(!surface.error, `${target}: ${surface.error}`);
      const abs = join(cwd, surface.from);
      const before = readFileSync(abs, 'utf8');
      const after = before.replace('@lema017/rsc-governed', PARENT_PACKAGE);
      assert.notEqual(after, before,
        `${target}: the fixture must actually change, or the mutation tests nothing (${surface.from})`);
      writeFileSync(abs, after);

      const mutated = auditInstalledProject({ cwd, home, targets: [target] });
      assert.equal(mutated.conformant, false,
        `${target}: the instrument must FAIL on a parent-named always-on surface`);
      assert.equal(mutated.alwaysOn[target].namesParent.length, 1, `${target}: the reference is reported`);
      assert.equal(mutated.alwaysOn[target].carriesGovernance, false,
        `${target}: the finding must be the parent reference and NOT a governance block — a different `
        + 'class failing would mean this mutation proved nothing about the one under test');

      const reported = formatConformance(mutated).filter((l) => l.includes('names the parent package'));
      assert.equal(reported.length, 1, `${target}: the human report carries it:\n${reported.join('\n')}`);
      assert.ok(reported[0].includes(`${surface.from}:`), `${target}: the finding names the file: ${reported[0]}`);
      assert.match(reported[0], /:\d+ names the parent package/, `${target}: and the line: ${reported[0]}`);
      assert.ok(reported[0].includes(PARENT_PACKAGE),
        `${target}: quoted, so the reader sees what they were about to run: ${reported[0]}`);
    }
  });

test('and it reports ALL of them, not just the first, when the whole pristine body is planted back',
  { timeout: 300000 }, async () => {
    // The real-world shape of the defect: upstream's file verbatim on the surface Claude Code
    // re-emits every session. All ten references must be reported, because a report that stops at the
    // first one understates a §10 defect by nine lines.
    const { cwd, home } = await install('claude');
    writeFileSync(
      join(cwd, '.rsc', 'governance', 'always-on.md'),
      readFileSync(join(ROOT, 'skills', 'suggest', 'SKILL.md'), 'utf8'),
    );
    const mutated = auditInstalledProject({ cwd, home, targets: ['claude'] });
    assert.equal(mutated.conformant, false);
    assert.equal(mutated.alwaysOn.claude.namesParent.length, 10, 'all ten, not just the first');
    const reported = formatConformance(mutated).filter((l) => l.includes('names the parent package'));
    assert.equal(reported.length, 10);
    assert.ok(reported.some((l) => l.includes('npx @ericrisco/rsc add <id>')),
      'including the RUNNABLE one, which is the whole reason D16 exists');
  });

test('and the instrument reports a parent-named DELIVERED SKILL, which is the other half of criterion 4',
  { timeout: 300000 }, async () => {
    // The same mutation one layer down: the base is what 17 of 18 targets read through a symlink, so
    // a parent reference there reaches the assistant directly.
    const { cwd, home } = await install('claude');
    const { writeFileSync } = await import('node:fs');
    const md = join(cwd, '.rsc', 'skills', 'review', 'SKILL.md');

    const before = auditInstalledProject({ cwd, home, targets: ['claude'] });
    assert.equal(before.conformant, true, formatConformance(before).join('\n'));

    // Put one parent reference back into an otherwise fully governed base: block, keys and digest
    // all stay valid, so ONLY the D16 class can be what fails.
    const governed = readFileSync(md, 'utf8');
    writeFileSync(md, governed.replace('@lema017/rsc-governed', PARENT_PACKAGE));

    const after = auditInstalledProject({ cwd, home, targets: ['claude'] });
    assert.equal(after.conformant, false, 'a delivered skill naming the parent is a conformance failure');
    const finding = after.ungoverned.find((u) => u.id === 'review');
    assert.ok(finding, 'and it is attributed to the skill it is in');
    assert.equal(finding.reasons.length, 1,
      `only the D16 class may fire here, or the mutation is not isolating it: ${finding.reasons.join('; ')}`);
    assert.match(finding.reasons[0], /^line \d+ names the parent package/, finding.reasons[0]);
    assert.ok(formatConformance(after).some((l) => l.includes('.rsc/skills/review/SKILL.md')),
      'the report names the file');
  });
