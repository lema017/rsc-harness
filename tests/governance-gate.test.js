import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Stage 6 — `npm run gate`, the second root of the project-artifact validator, and the two gaps
// stage 4's independent review found in the criterion-4 audit.
//
// Everything here is a NEGATIVE test or a mutation. That is deliberate and it is the only thing that
// makes this file worth running: three documents cited `npm run gate` as an instrument while no
// `package.json` defined it, and the criterion-4 instrument reported `274/274, failures: 0` with two
// classes of fault present. A validator that cannot fail reports the same thing as one that passes.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'scripts', 'rsc.js');

const TMP = [];
function scratch(prefix) {
  const d = mkdtempSync(join(tmpdir(), prefix));
  TMP.push(d);
  return d;
}
test.after(() => { for (const d of TMP) rmSync(d, { recursive: true, force: true }); });

// ── the gate exists, and says what it does not cover ──────────────────────────

test('gg01 · `npm run gate` exists, and includes the two checks stage 6 was asked to put in it', async () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts.gate, '`npm run gate` was cited by three documents and defined by none');
  const { CHECKS, NOT_IN_THE_GATE } = await import('../scripts/gate.js');
  const ids = CHECKS.map((c) => c.id);
  assert.ok(ids.includes('governance:check'), ids.join(', '));
  assert.ok(ids.includes('governance:customizations'), ids.join(', '));
  assert.ok(ids.includes('skills-invariant'), 'Strategy B IS that invariant; a gate that skips it checks the wrong thing');
  // A gate that hides what it does not check is worse than one that checks less.
  const excluded = NOT_IN_THE_GATE.map(([id]) => id);
  for (const id of ['npm test', 'eval-lint.sh', 'routing:audit', 'spec:gate', 'knowledge:doctor', 'drift:knowledge']) {
    assert.ok(excluded.includes(id), `${id} is neither in the gate nor declared as excluded`);
  }
  for (const [, why] of NOT_IN_THE_GATE) assert.ok(why.length > 20, 'every exclusion carries its reason');
});

test('gg02 · the gate runs green here, in seconds, and reports its own coverage', { timeout: 300000 }, () => {
  const out = spawnSync(process.execPath, [join(ROOT, 'scripts', 'gate.js')], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(out.status ?? 0, 0, `${out.stdout}${out.stderr}`);
  assert.match(out.stdout, /7\/7 passed/, out.stdout);
  assert.match(out.stdout, /Not in this gate, and why/, 'it must print what it does not cover');
  assert.doesNotMatch(out.stdout, /^SKIP/m, 'nothing should be skipped in this clone');
});

test('gg02b · a check that ran and had NOTHING to look at reports VOID, not PASS', { timeout: 300000 }, () => {
  // `ARCHITECTURE.md` flagged three inherited validators as "vacuos en clon limpio" — they pass by
  // having nothing to examine. `governance:customizations` has exactly that shape in THIS
  // repository, which is not a consumer project and has no `02-DOCS/`. So the gate says so on
  // itself, rather than letting "7/7 passed" imply coverage it does not have.
  const out = spawnSync(process.execPath, [join(ROOT, 'scripts', 'gate.js')], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(out.status ?? 0, 0, `${out.stdout}${out.stderr}`);
  assert.match(out.stdout, /^VOID {2}governance:customizations/m, out.stdout);
  assert.match(out.stdout, /nothing to validate here: this repository is not a consumer project/, out.stdout);
  assert.match(out.stdout, /\(1 with nothing to check here\)/, 'and the summary line carries it');
  assert.match(out.stdout, /A VOID check ran and had nothing to look at\. It is not a failure and it is not coverage\./);
  // The other six must NOT be void: they examine the catalog, which is right here.
  assert.equal((out.stdout.match(/^VOID /gm) || []).length, 1, out.stdout);
});

test('gg03 · a skipped check is reported as SKIP, never folded into the pass count', async () => {
  // The `skills-invariant` check needs an `origin/main` ref. In a clone without one it must say so,
  // because "I could not run" and "I found nothing" are different answers.
  const { skillsInvariant } = await import('../scripts/gate.js');
  const bare = scratch('gg-bare-');
  spawnSync('git', ['init', '-q'], { cwd: bare });
  const out = skillsInvariant(bare);
  assert.equal(out.status, 'skip', JSON.stringify(out));
  assert.match(out.detail, /origin\/main/, 'and it names what would make it runnable');

  const here = skillsInvariant(ROOT);
  assert.equal(here.status, 'pass', JSON.stringify(here));
  assert.match(here.detail, /0 lines/, 'the invariant is reported with its measurement, not an adjective');
});

// ── the SECOND root: the brownfield run report ────────────────────────────────

const GOOD_RECORD = `### C1 — Where an ADR-worthy forward choice is filed

- Scope: repo
- Status: pending-decision
- Blocks (enumerated, per §4):
    - creating a new numbered ADR file for a choice this run surfaced
- Confidence: high — would drop to medium if the project turned out to keep no log at all
- Impact: one ADR-worthy choice filed in the home the other skill does not read is invisible to it.

#### Evidence — positions

| # | Side | Position | Category | Evidence (form per §2.1) |
|---|---|---|---|---|
| P1 | skill \`decision-records\` | Home is chosen by first match | **approved convention** | F2 · \`.rsc/skills/decision-records/SKILL.md\` §"Decide home + naming once" |
| P2 | project | 31 of 34 records already live in docs/adr | **observed pattern** | F3 · population \`docs/adr/*.md\`, 34 records, counted by exhaustive grep |

- Alternatives:
  1. Follow the skill's first match — read what the project already has.
  2. Pick one home for brownfield decisions and always use it.
- Recommendation: (1). It is the rule the skill states first.
`;

function runReport(cwd, { frontmatter = 'type: brownfield-run\n', body = GOOD_RECORD, name = 'run.md', index = true } = {}) {
  const dir = join(cwd, '02-DOCS', 'wiki', 'brownfield');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), `---\n${frontmatter}---\n\n# Brownfield run\n\n## B1 — Inventory\n\n`
    + '| skill | role | why | inspectable |\n|---|---|---|---|\n'
    + '| decision-records | selected | .rsc.json#skills | yes |\n\n'
    + `## Conflicts\n\n${body}`);
  if (index) {
    mkdirSync(join(cwd, '02-DOCS', 'wiki'), { recursive: true });
    writeFileSync(join(cwd, '02-DOCS', 'wiki', 'index.md'), `# Knowledge map\n\n- [run](brownfield/${name})\n`);
  }
  // The skill the evidence cites has to exist, because rule 4b checks that the path resolves.
  const skill = join(cwd, '.rsc', 'skills', 'decision-records');
  mkdirSync(skill, { recursive: true });
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: decision-records\n---\n\n## Decide home + naming once\n\nbody\n');
  mkdirSync(join(cwd, 'docs', 'adr'), { recursive: true });
  return join(dir, name);
}

async function validate(cwd, opts = {}) {
  const { validateBrownfieldRuns } = await import('../scripts/lib/customization-validator.js');
  return validateBrownfieldRuns({ cwd, ...opts });
}
const idsOf = (report) => report.findings.map((f) => f.ruleId).sort();
const errorsIn = (report) => report.findings.filter((f) => f.severity === 'error');

test('gg04 · absence of the brownfield root is a valid state, not a finding', async () => {
  const report = await validate(scratch('gg-absent-'));
  assert.equal(report.ran, false);
  assert.deepEqual(report.findings, []);
});

test('gg05 · a well-formed run report passes every rule it can be checked against', async () => {
  const cwd = scratch('gg-good-');
  runReport(cwd);
  const report = await validate(cwd, { greenfield: false, skills: [], selected: ['decision-records'] });
  assert.equal(report.ran, true);
  assert.deepEqual(errorsIn(report).map((f) => `${f.ruleId}: ${f.message}`), [], 'a clean report must produce no errors');
  assert.equal(report.records.length, 1);
  assert.equal(report.records[0].status, 'pending-decision');
});

test('gg06 · NEGATIVE: every missing field is NAMED, with its rule and the record', async () => {
  const cwd = scratch('gg-fields-');
  runReport(cwd, { body: '### C1 — A conflict with nothing in it\n\nnot even a field.\n' });
  const report = await validate(cwd, { greenfield: false });
  const messages = errorsIn(report).map((f) => f.message).join('\n');
  for (const field of ['Scope', 'Impact', 'Confidence', 'Recommendation', 'Status', 'Alternatives']) {
    assert.match(messages, new RegExp('has no .' + field + '. field'), field + ' was not named:\n' + messages);
  }
  assert.match(messages, /has no positions block/);
  for (const f of errorsIn(report)) {
    assert.ok(f.file.endsWith('run.md'), 'every finding names the file');
    assert.ok(f.ruleId, 'and the rule that produced it');
  }
});

test('gg07 · NEGATIVE: a bare `path:line` is rejected, and a drifted fragment names the real line', async () => {
  const cwd = scratch('gg-evidence-');
  const bad = GOOD_RECORD
    .replace('F2 · `.rsc/skills/decision-records/SKILL.md` §"Decide home + naming once"',
      'F1 · `.rsc/skills/decision-records/SKILL.md:1#"Decide home + naming once"`')
    .replace('F3 · population `docs/adr/*.md`, 34 records, counted by exhaustive grep',
      'F1 · `.rsc/skills/decision-records/SKILL.md:9`');
  runReport(cwd, { body: bad });
  const report = await validate(cwd, { greenfield: false });
  const messages = errorsIn(report).map((f) => f.message).join('\n');
  // 4c: a line with no fragment is not an admissible form at all.
  assert.match(messages, /with no quoted fragment/, messages);
  // 4a: the fragment IS at line 5, the citation says line 1 — and the error says where it really is.
  assert.match(messages, /the fragment is at `\.rsc\/skills\/decision-records\/SKILL\.md:5`, not at the cited `:1`/, messages);
});

test('gg08 · NEGATIVE: rule 4d — a skill cited at `skills/` instead of `.rsc/skills/`', async () => {
  const cwd = scratch('gg-4d-');
  runReport(cwd, { body: GOOD_RECORD.replace('`.rsc/skills/decision-records/SKILL.md`', '`skills/decision-records/SKILL.md`') });
  const report = await validate(cwd, { greenfield: false });
  assert.ok(errorsIn(report).some((f) => f.ruleId === 'B4d'), idsOf(report).join(', '));
  assert.match(errorsIn(report).find((f) => f.ruleId === 'B4d').message, /13 lines/,
    'the error must say WHY, because the citation looks right in the fork\'s own checkout');
});

test('gg09 · NEGATIVE: a hedged or doubled category is the finding, not something to settle by order', async () => {
  const cwd = scratch('gg-cat-');
  runReport(cwd, { body: GOOD_RECORD.replace('**observed pattern**', 'observed pattern, not really an approved convention') });
  const report = await validate(cwd, { greenfield: false });
  const f = errorsIn(report).find((x) => x.ruleId === 'B3');
  assert.ok(f, idsOf(report).join(', '));
  assert.match(f.message, /names 2 categories/, f.message);
});

test('gg10 · NEGATIVE: a confidence with no falsifier, and a status outside the six', async () => {
  const cwd = scratch('gg-conf-');
  runReport(cwd, {
    body: GOOD_RECORD
      .replace('- Confidence: high — would drop to medium if the project turned out to keep no log at all', '- Confidence: high')
      .replace('- Status: pending-decision', '- Status: probably-fine'),
  });
  const report = await validate(cwd, { greenfield: false });
  const messages = errorsIn(report).map((f) => f.message).join('\n');
  assert.match(messages, /states a confidence with no falsifier/, messages);
  assert.match(messages, /`Status: probably-fine`/, messages);
});

test('gg11 · NEGATIVE: a recommendation that is not one of the alternatives', async () => {
  const cwd = scratch('gg-rec-');
  runReport(cwd, { body: GOOD_RECORD.replace('- Recommendation: (1). It is the rule the skill states first.', '- Recommendation: (7). Something else entirely.') });
  const report = await validate(cwd, { greenfield: false });
  assert.ok(errorsIn(report).some((f) => f.ruleId === 'B8'), idsOf(report).join(', '));
});

test('gg12 · NEGATIVE: rule 15 — a `pending-decision` that enumerates nothing', async () => {
  const cwd = scratch('gg-blocks-');
  runReport(cwd, { body: GOOD_RECORD.replace(/- Blocks \(enumerated, per §4\):\n {4}- creating a new numbered ADR file for a choice this run surfaced\n/, '') });
  const report = await validate(cwd, { greenfield: false });
  const f = errorsIn(report).find((x) => x.ruleId === 'B15');
  assert.ok(f, idsOf(report).join(', '));
  assert.match(f.message, /over-blocking visible/, 'the reason is the point of the rule');
});

test('gg13 · NEGATIVE: rule 12 — a position that asserts a guard may be disabled IS the finding', async () => {
  const cwd = scratch('gg-guard-');
  runReport(cwd, { body: GOOD_RECORD.replace('31 of 34 records already live in docs/adr', 'the project disables the gitmoji guard for this package') });
  const report = await validate(cwd, { greenfield: false });
  assert.ok(errorsIn(report).some((f) => f.ruleId === 'B12'), idsOf(report).join(', '));
});

test('gg14 · NEGATIVE: rule 13 — greenfield cannot emit a category that asserts existing code', async () => {
  const cwd = scratch('gg-green-');
  runReport(cwd);
  const asBrownfield = await validate(cwd, { greenfield: false });
  assert.ok(!errorsIn(asBrownfield).some((f) => f.ruleId === 'B13'), 'with code present, `observed pattern` is legal');
  const asGreenfield = await validate(cwd, { greenfield: true });
  const f = errorsIn(asGreenfield).find((x) => x.ruleId === 'B13');
  assert.ok(f, idsOf(asGreenfield).join(', '));
  assert.match(f.message, /invented the evidence/, f.message);
});

test('gg15 · NEGATIVE: a missing or wrong `type:` breaks the OKF bundle the file lives in', async () => {
  const none = scratch('gg-okf-1-');
  runReport(none, { frontmatter: 'updated: 2026-11-02\n' });
  assert.ok(errorsIn(await validate(none, { greenfield: false })).some((f) => f.ruleId === 'BR1'));

  const wrong = scratch('gg-okf-2-');
  runReport(wrong, { frontmatter: 'type: notes\n' });
  const f = errorsIn(await validate(wrong, { greenfield: false })).find((x) => x.ruleId === 'BR1');
  assert.match(f.message, /must be `brownfield-run`/, f.message);
});

test('gg16 · NEGATIVE: an unindexed run report is reported (property 32)', async () => {
  const cwd = scratch('gg-index-');
  runReport(cwd, { index: false });
  writeFileSync(join(cwd, '02-DOCS', 'wiki', 'index.md'), '# Knowledge map\n\nnothing here\n');
  const f = errorsIn(await validate(cwd, { greenfield: false })).find((x) => x.ruleId === 'BR32');
  assert.ok(f, 'an unindexed wiki article is one nobody finds');
});

test('gg17 · rule 16 — the coverage FLOOR fails on a missing partner and passes on a complete inventory', async () => {
  const cwd = scratch('gg-floor-');
  runReport(cwd);
  const skills = [
    { id: 'decision-records', description: 'Write an ADR. NOT a running log (that is `continuous-learning`).', tags: ['adr'], recommends: ['continuous-learning'] },
    { id: 'continuous-learning', description: 'Keep a running log of lessons.', tags: ['log'], recommends: [] },
    { id: 'unrelated', description: 'Bake a cake with flour and sugar.', tags: ['cake'], recommends: [] },
  ];
  const missing = await validate(cwd, { greenfield: false, skills, selected: ['decision-records'] });
  const floor = errorsIn(missing).filter((f) => f.ruleId === 'B16');
  assert.ok(floor.length, 'a declared `recommends:` edge outside the inventory is a deterministic failure');
  assert.match(floor[0].message, /continuous-learning/, floor[0].message);
  assert.match(floor.map((f) => f.message).join('\n'), /recommends|NOT clause/, 'and it says which rule required the pair');

  // Add the row and the floor is satisfied — a deliberate exclusion is a ROW with its reason.
  const path = join(cwd, '02-DOCS', 'wiki', 'brownfield', 'run.md');
  writeFileSync(path, readFileSync(path, 'utf8').replace(
    '| decision-records | selected | .rsc.json#skills | yes |',
    '| decision-records | selected | .rsc.json#skills | yes |\n| continuous-learning | competitor | decision-records recommends it | yes |',
  ));
  const complete = await validate(cwd, { greenfield: false, skills, selected: ['decision-records'] });
  assert.deepEqual(errorsIn(complete).filter((f) => f.ruleId === 'B16'), [], 'a complete inventory passes');
});

test('gg18 · a rule that could not RUN is reported as not-run, and never counts as a pass', async () => {
  const { errorsOf, formatFindings } = await import('../scripts/lib/customization-validator.js');
  const cwd = scratch('gg-notrun-');
  runReport(cwd);
  // No `greenfield` fact and no `.rsc.json#skills`: rules 13 and 16 cannot be decided.
  const report = await validate(cwd);
  const notRun = report.findings.filter((f) => f.severity === 'not-run');
  assert.equal(notRun.length, 2, notRun.map((f) => f.ruleId).join(', '));
  assert.deepEqual(notRun.map((f) => f.ruleId).sort(), ['B13-not-run', 'B16-not-run']);
  for (const f of notRun) assert.match(f.message, /Not checked is not the same as no finding/);
  assert.ok(!errorsOf(report).some((f) => f.severity === 'not-run'), 'not-run must not fail the gate');
  assert.ok(formatFindings(report, cwd).some((l) => l.startsWith('NOT-RUN')), 'but it must be visible, labelled as itself');
});

test('gg19 · install and sync are real invocation points for the second root', { timeout: 300000 }, async () => {
  const { applyInstall } = await import('../scripts/install-apply.js');
  const cwd = scratch('gg-wired-');
  const home = scratch('gg-wired-home-');
  runReport(cwd, { body: '### C1 — A broken record\n\nno fields at all.\n' });
  const state = await applyInstall({ skillIds: ['suggest'], target: 'claude', home, cwd });

  const written = join(cwd, '.rsc', 'governance', 'brownfield.json');
  assert.ok(existsSync(written), 'the install must write the second root\'s report, as it does the first\'s');
  const report = JSON.parse(readFileSync(written, 'utf8'));
  assert.equal(report.ran, true);
  assert.ok(report.errors > 0, 'and a malformed record must be named there');
  assert.ok(state.governance.brownfield.ran, 'and returned in the state, like the customization report');
  // An install must NOT die over a wiki page: the contract's answer to a broken file is to ask.
  assert.ok(existsSync(join(cwd, '.rsc', 'skills', 'suggest', 'SKILL.md')), 'the install still completed');
});

test('gg20 · `rscg brownfield` hands over the procedure and the computed candidate set', { timeout: 300000 }, async () => {
  const { applyInstall } = await import('../scripts/install-apply.js');
  const cwd = scratch('gg-cmd-');
  const home = scratch('gg-cmd-home-');
  await applyInstall({ skillIds: ['suggest', 'decision-records'], target: 'claude', home, cwd });
  writeFileSync(join(cwd, '.rsc.json'), JSON.stringify({
    version: 1, targets: ['claude'], skills: ['decision-records'], agents: [], ownSkills: [], optOuts: [],
  }));

  const out = spawnSync(process.execPath, [CLI, 'brownfield'], { cwd, encoding: 'utf8' });
  assert.equal(out.status ?? 0, 0, `${out.stdout}${out.stderr}`);
  assert.match(out.stdout, /\.rsc\/governance\/brownfield-v1\.md/, 'the procedure must be shipped and named by path');
  assert.ok(existsSync(join(cwd, '.rsc', 'governance', 'brownfield-v1.md')), 'and actually be there');
  assert.match(out.stdout, /B1 CANDIDATE COMPETITORS — computed, not guessed, at threshold 0\.45/, out.stdout);
  assert.match(out.stdout, /0\.80 is the failure CEILING/, 'the threshold has to carry why it is not 0.80');
  assert.match(out.stdout, /COVERAGE FLOOR/, out.stdout);
  assert.match(out.stdout, /it does not read the\nproject/, 'and it must say what it does NOT do');

  const json = spawnSync(process.execPath, [CLI, 'brownfield', '--json'], { cwd, encoding: 'utf8' });
  const parsed = JSON.parse(json.stdout);
  assert.equal(parsed.threshold, 0.45);
  assert.ok(Array.isArray(parsed.competitors));
  assert.ok(parsed.competitors.every((c) => c.reasons.length), 'every candidate carries a computed reason');
});

test('gg20b · the brownfield procedure is a MANAGED path, so restore and purge know about it',
  { timeout: 300000 }, async () => {
    // It is package-owned, like the contract, and it has to be in the snapshot set for the same
    // reason `install-apply.js` already states about every artifact it writes: "a file rsc writes
    // but omits here is silently absent from the snapshot, so `rsc restore` cannot bring it back".
    const { managedPathsForInstall, applyInstall } = await import('../scripts/install-apply.js');
    const cwd = scratch('gg-managed-');
    const home = scratch('gg-managed-home-');
    const rel = managedPathsForInstall({ skillIds: ['suggest'], target: 'claude', home, cwd })
      .map((p) => p.slice(cwd.length + 1).split('\\').join('/'));
    for (const path of ['.rsc/governance/brownfield-v1.md', '.rsc/governance/v1.md', '.rsc/governance/always-on.md']) {
      assert.ok(rel.includes(path), `${path} is written but not declared as managed:\n  ${rel.join('\n  ')}`);
    }
    const state = await applyInstall({ skillIds: ['suggest'], target: 'claude', home, cwd });
    assert.equal(state.governance.procedure, '.rsc/governance/brownfield-v1.md');
    assert.ok(readFileSync(join(cwd, '.rsc', 'governance', 'brownfield-v1.md'))
      .equals(readFileSync(join(ROOT, 'schema', 'governance', 'brownfield-v1.md'))),
    'and it is byte-identical to the shipped copy, which `npm run governance:check` ties to its source');
  });

test('gg21 · `rscg brownfield --validate` runs the record rules and exits non-zero on a broken one', { timeout: 300000 }, () => {
  const cwd = scratch('gg-cmdval-');
  runReport(cwd, { body: '### C1 — A broken record\n\nnothing.\n' });
  const out = spawnSync(process.execPath, [CLI, 'brownfield', '--validate'], { cwd, encoding: 'utf8' });
  assert.equal(out.status, 1, out.stdout);
  assert.match(out.stdout, /ERROR .*run\.md/, out.stdout);
  assert.match(out.stdout, /conflict record\(s\)/, out.stdout);
});

// ── the two gaps stage 4's independent review found, proved by mutation ───────

test('gg22 · MUTATION: a delivery that is a COPY instead of a symlink is now a finding',
  { timeout: 300000 }, async () => {
    // Before this fix, `auditDelivery` read
    //   `if (lstat(dir).isSymbolicLink() && realpath(dir) !== realpath(base)) bad.push(…)`
    // so a non-symlink never entered the branch, and the byte comparison that followed is identical
    // by construction right after an install. Forcing `linkOrCopy`'s Windows path made all 18
    // deliveries real copies and the instrument still reported 274/274, failures: 0.
    const { applyInstall } = await import('../scripts/install-apply.js');
    const { auditDelivery, deliveryKind } = await import('../scripts/lib/conformance.js');
    const cwd = scratch('gg-mut-link-');
    const home = scratch('gg-mut-link-home-');
    await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'claude', home, cwd });

    const base = join(cwd, '.rsc', 'skills', 'flutter');
    const delivered = join(cwd, '.claude', 'skills', 'flutter');
    assert.equal(deliveryKind('claude', 'flutter', cwd, home), 'symlink', 'the fixture must start as a symlink');
    assert.deepEqual(auditDelivery('claude', 'flutter', cwd, home, base), [], 'and be conformant');

    // The mutation: replace the link with a real copy, byte-identical, exactly as the old check
    // could not distinguish from the real thing.
    rmSync(delivered, { recursive: true, force: true });
    cpSync(base, delivered, { recursive: true });
    assert.equal(deliveryKind('claude', 'flutter', cwd, home), 'copy');
    assert.equal(readFileSync(join(delivered, 'SKILL.md'), 'utf8'), readFileSync(join(base, 'SKILL.md'), 'utf8'),
      'the bytes are identical, which is why the byte comparison alone could never see this');

    const findings = auditDelivery('claude', 'flutter', cwd, home, base);
    if (process.platform === 'win32') {
      assert.deepEqual(findings, [], 'on Windows a copy is correct by design (limit L5)');
    } else {
      assert.ok(findings.some((f) => /is a COPY, not a symlink/.test(f)), findings.join('; '));
      assert.ok(findings.some((f) => /stops tracking the base/.test(f)), 'and it says what goes wrong, which is later');
    }
  });

test('gg23 · MUTATION: a doubled governance block in the Cursor `.mdc` is now a finding',
  { timeout: 300000 }, async () => {
    // The `.mdc` is the only delivery that is re-rendered rather than linked, and the only one the
    // instrument itself says a rendering fault would be invisible to. The block was extracted with
    // `match(...)[0]` — the FIRST match — and the marker counting lived only in `auditBase`, which
    // never ran on a `.mdc`. Doubling the body in `targets/cursor.js` produced 2 opening and 2
    // closing markers, 35 712 B instead of 17 885, and `274/274, failures: 0`.
    const { applyInstall } = await import('../scripts/install-apply.js');
    const { auditDelivery } = await import('../scripts/lib/conformance.js');
    const cwd = scratch('gg-mut-mdc-');
    const home = scratch('gg-mut-mdc-home-');
    await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'cursor', home, cwd });

    const base = join(cwd, '.rsc', 'skills', 'flutter');
    const mdc = join(cwd, '.cursor', 'rules', 'flutter.mdc');
    assert.deepEqual(auditDelivery('cursor', 'flutter', cwd, home, base), [], 'the fixture must start conformant');

    const original = readFileSync(mdc, 'utf8');
    const m = original.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
    writeFileSync(mdc, `${m[1]}${m[2]}${m[2]}`);     // the body twice, exactly as the mutation did
    const doubled = auditDelivery('cursor', 'flutter', cwd, home, base);
    assert.ok(doubled.some((f) => /DUPLICATE: 2 opening markers/.test(f)), doubled.join('; '));
    assert.ok(doubled.some((f) => /DUPLICATE: 2 closing markers/.test(f)), doubled.join('; '));
    assert.ok(readFileSync(mdc, 'utf8').length > original.length * 1.8, 'and the file really did double');

    // And a block that no longer opens the body: same file, different fault, also previously unseen.
    writeFileSync(mdc, `${m[1]}# a heading someone prepended\n\n${m[2]}`);
    const moved = auditDelivery('cursor', 'flutter', cwd, home, base);
    assert.ok(moved.some((f) => /does not open the body/.test(f)), moved.join('; '));

    writeFileSync(mdc, original);
    assert.deepEqual(auditDelivery('cursor', 'flutter', cwd, home, base), [], 'and it is clean again when restored');
  });

test('gg24 · the catalog size has a FLOOR, so a truncated `skills/` cannot report 100 %', () => {
  // Every ratio the instrument prints is `n/ids.length`, so the denominator needed a check of its
  // own. §3 of the requirements forbids fixing the number in code ("no fijes el número de skills en
  // el código"), so the floor is a cross-check against `manifest.json`, which `manifest:check` keeps
  // current, plus an explicit `--expect <n>` for a release gate that wants to pin what it measured.
  const source = readFileSync(join(ROOT, 'scripts', 'verify-catalog-conformance.js'), 'utf8');
  assert.match(source, /catalog size floor/, 'the instrument must check its own denominator');
  assert.match(source, /arg\('expect'\)/, 'and accept a pinned expectation');
  assert.ok(!/ids\.length !== 274/.test(source), '§3: the number must not be fixed in the code');

  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
  const dirs = readdirSync(join(ROOT, 'skills'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(ROOT, 'skills', e.name, 'SKILL.md'))).length;
  assert.equal(dirs, manifest.counts.skills, 'and the two agree right now, which is what makes the floor meaningful');
});
