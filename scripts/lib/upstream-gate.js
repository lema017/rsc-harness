// Fork maintenance (§9) — the gate. What this fork accepts as proof of FUNCTIONAL compatibility.
//
// PLAN.md §8 states the rule that this file exists to make executable:
//
//     «Un merge sin conflictos textuales no se acepta como prueba de compatibilidad funcional.»
//
// A rule in a document is a rule nobody runs, so the sentence is implemented as a refusal: the
// merge result is recorded as EVIDENCE with `counts: false`, and the verdict is computed only from
// the checks below. `gateVerdict` given nothing but a clean merge returns `blocked`, and a test
// asserts exactly that. There is no code path by which "no conflicts" contributes to a pass.
//
// What DOES count, and why each one is here:
//
//   G1  mirror-invariant        the reason the fork is maintainable at all (Strategy B)
//   G2  catalog-parity          nothing was lost or invented by the integration
//   G3  contract-conformance    criterion 4, over the skills this change actually touched
//   G4  idempotence             criterion 5, over the same scope
//   G5  vendored-untouched      criterion 7, and Apache-2.0 §4(b) / `"modified": false`
//   G6  attribution-complete    the obligation a clean merge and a green suite both miss
//   G7  divergence-intact       the fork's own edits survived the merge in INTENT, not just in text
//   G8  impacted-tests          behaviour, measured, with preexisting failures declared not excused
//   G9  customization-safety    criterion 12: orphans reported, renames never rehomed
//   G10 retired-registry        the consequence of a deletion, stated rather than assumed
//   G12 fork-identity           the one thing merging upstream's package.json can silently undo
//   G11 semantic-evals          §11's semantic coverage — REQUIRED and NOT instrumented here
//
// G11 is listed last because it is the only check no code here can decide, and it is the honest
// part. REQUIREMENTS §11 and D5/D9 put the semantic evaluations on the session's
// own agents, so no script can run them; "decidible ≠ instrumentado". It is therefore marked
// `instrumented: false` and still `required`, which means it cannot pass by itself and cannot be
// forgotten: promotion blocks until a result is recorded against it.

import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { checkProbes, DIVERGENCE_PROBES, git, vendoredSubtrees } from './upstream-survey.js';

/**
 * Failures that are upstream's, measured and attributed before this gate existed, so a maintenance
 * run can tell "still broken" from "newly broken". Every entry carries where it was established —
 * a known-failure list with no provenance becomes a place to hide regressions.
 *
 * `tests/eval-lint.test.js` is not in here because it is not RUN: it writes to a literal `/tmp`
 * (`scripts/eval-lint.sh`), outside the dedicated folder, which REQUIREMENTS §1 forbids. That is
 * limit L2, and the gate reports it as not verified rather than as passing.
 */
export const KNOWN_FAILURES = Object.freeze([
  {
    file: 'tests/deepseek-target.test.js',
    match: /dsh06/,
    reason: 'preexisting upstream failure, attributed in LEDGER §2n',
  },
  {
    file: 'tests/design-engine.test.js',
    match: /A5/,
    reason: 'preexisting flake: 2 passes and 4 failures in 6 observations (LEDGER §2n)',
  },
  {
    file: 'tests/knowledge-sync.test.js',
    match: /ks(30|48|61|63)/,
    reason: 'non-deterministic in PRISTINE upstream, which fails a strict superset (D12). Declared '
      + 'inherited debt, explicitly not a binary gate',
  },
]);

/** Never run, with the reason, so "not verified" never reads as "passed". */
export const NEVER_RUN = Object.freeze([
  { file: 'tests/eval-lint.test.js', reason: 'writes to a literal /tmp outside the dedicated folder (limit L2, REQUIREMENTS §1)' },
]);

/**
 * The fork's own governance tests, which run on every maintenance pass regardless of what changed.
 *
 * LEDGER §2n measured the reason: with `governBase` deleted, of the tests inherited from upstream
 * ZERO fail. `base-install`, `apply`, `fresh-install-coherence`, `always-on-body` and
 * `md-block-fidelity` all pass a tree with no governance in it at all. These files are therefore
 * the entire net around acceptance criterion 4, and the net has to run every time.
 *
 * DERIVED, not listed. Every `tests/governance-*.test.js` present in the tree is in, which is the
 * convention this fork already follows for its own tests. A list would go stale the moment another
 * stage adds one — and three were added while this file was being written.
 */
export const ALWAYS_RUN_PATTERN = /^governance-.*\.test\.js$/;

export function alwaysRunFiles(cwd) {
  try {
    return readdirSync(join(cwd, 'tests'))
      .filter((f) => ALWAYS_RUN_PATTERN.test(f)).map((f) => `tests/${f}`).sort();
  } catch { return []; }
}

/** Catalog readers: the ten files ARCHITECTURE §10 (L1) names as reading the skill body. */
export const CATALOG_READERS = Object.freeze([
  'tests/always-on-body.test.js', 'tests/clone-bootstrap.test.js', 'tests/ftd-lane.test.js',
  'tests/catalog-diet.test.js', 'tests/ux-upstream.test.js', 'tests/design-engine.test.js',
  'tests/skill-lint.test.js', 'tests/frontmatter.test.js', 'tests/manifest.test.js',
  'tests/context-budget.test.js',
]);

const isTest = (p) => p.startsWith('tests/') && p.endsWith('.test.js');

/**
 * The test subset this change earns. Derived, not listed:
 *
 *   - the fork's governance suite, always;
 *   - every test file upstream itself changed;
 *   - the catalog readers, when anything under `skills/` changed;
 *   - a test whose basename names a changed skill (`tests/connect-tool.test.js`);
 *   - and — the measured half — every test file that MENTIONS the basename of a changed source
 *     file, found by grep rather than by a mapping somebody maintains.
 */
export function impactedTests({ cwd, upstreamChanged = [], classification = null }) {
  const want = new Set();
  const never = new Set(NEVER_RUN.map((n) => n.file));
  const add = (p) => { if (p && !never.has(p) && existsSync(join(cwd, p))) want.add(p); };

  for (const p of alwaysRunFiles(cwd)) add(p);
  for (const p of upstreamChanged) if (isTest(p)) add(p);

  const catalogTouched = upstreamChanged.some((p) => p.startsWith('skills/'));
  if (catalogTouched) for (const p of CATALOG_READERS) add(p);

  const ids = [
    ...(classification?.added || []), ...(classification?.modified || []), ...(classification?.removed || []),
  ];
  for (const id of ids) add(`tests/${id}.test.js`);

  // Measured: which test files mention a changed source file by basename.
  const sources = upstreamChanged.filter((p) => !isTest(p) && /\.(js|mjs)$/.test(p));
  if (sources.length) {
    const names = [...new Set(sources.map((p) => p.split('/').pop()))];
    const res = git(['grep', '-l', '-F', '-e', ...names.flatMap((n, i) => (i ? ['-e', n] : [n])), '--', 'tests/'], { cwd });
    if (res.ok) for (const p of res.stdout.split('\n')) add(p.trim());
  }
  return [...want].sort();
}

/** Parse a `node --test` TAP stream into the numbers and the names that failed. */
export function parseTap(stdout) {
  const num = (key) => {
    const m = new RegExp(`^# ${key} (\\d+)$`, 'm').exec(stdout);
    return m ? Number(m[1]) : null;
  };
  const failed = [...stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1].trim());
  return {
    tests: num('tests'), pass: num('pass'), fail: num('fail'), cancelled: num('cancelled'),
    skipped: num('skipped'), durationMs: (() => {
      const m = /^# duration_ms ([\d.]+)$/m.exec(stdout);
      return m ? Number(m[1]) : null;
    })(),
    failed,
  };
}

const knownFor = (file, name) => KNOWN_FAILURES.some((k) => (k.file === file || file === null) && k.match.test(name));

/**
 * Run a test subset under the instrument the project MEASURED, not under defaults:
 * `--test-concurrency=1` (parallelism made the runner cancel healthy files — 83 in one attempt),
 * `--test-timeout=1800000` (the slowest file measures 1 146 s alone) and a git ceiling over the
 * temporary tree (without it, five tests fail with plausible, false messages).
 *
 * The gate records whether the ceiling was actually in place. A run without it is reported as
 * `instrumentUnsound` rather than as a pass: the project has already been misled once by exactly
 * that, and a gate that cannot vouch for its own instrument should say so.
 */
export function runTests({ cwd, files, timeoutMs = 1_800_000, env = process.env, wallClockMs = 7_200_000 }) {
  if (!files.length) return { ok: true, skipped: true, detail: 'no test file is impacted by this change' };
  const ceiling = env.GIT_CEILING_DIRECTORIES || null;
  const res = spawnSync(process.execPath, [
    '--test', '--test-concurrency=1', `--test-timeout=${timeoutMs}`, ...files,
  ], {
    cwd, encoding: 'utf8', timeout: wallClockMs, env, maxBuffer: 256 * 1024 * 1024,
  });
  const stdout = res.stdout || '';
  const tap = parseTap(stdout);
  const unexpected = tap.failed.filter((name) => !knownFor(null, name));
  const excused = tap.failed.filter((name) => knownFor(null, name));
  return {
    ok: unexpected.length === 0 && (tap.cancelled === 0 || tap.cancelled === null) && !res.error,
    skipped: false,
    exit: res.status,
    tap,
    unexpected,
    excused,
    instrumentUnsound: !ceiling,
    instrument: {
      concurrency: 1, timeoutMs, gitCeiling: ceiling, idleMachine: false, idleMachineNote: 'limit L7: not achievable on this machine',
    },
    detail: `${tap.pass ?? '?'} passed, ${tap.fail ?? '?'} failed (${excused.length} declared, `
      + `${unexpected.length} unexpected), ${tap.cancelled ?? '?'} cancelled`,
    notRun: NEVER_RUN.filter((n) => existsSync(join(cwd, n.file))),
  };
}

// ---------------------------------------------------------------- the checks

function dirsEqual(a, b) {
  const walk = (root, prefix = '') => {
    const out = [];
    for (const e of readdirSync(root, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name))) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const abs = join(root, e.name);
      if (e.isDirectory()) out.push(...walk(abs, rel));
      else if (e.isSymbolicLink()) out.push([rel, `link:${relative(root, realpathSync(abs))}`]);
      else out.push([rel, readFileSync(abs).toString('base64')]);
    }
    return out;
  };
  let left; let right;
  try { left = walk(a); } catch (err) { return { equal: false, why: `cannot read ${a}: ${err.code}` }; }
  try { right = walk(b); } catch (err) { return { equal: false, why: `cannot read ${b}: ${err.code}` }; }
  if (left.length !== right.length) {
    return { equal: false, why: `${left.length} files vs ${right.length}` };
  }
  for (let i = 0; i < left.length; i += 1) {
    if (left[i][0] !== right[i][0]) return { equal: false, why: `${left[i][0]} vs ${right[i][0]}` };
    if (left[i][1] !== right[i][1]) return { equal: false, why: `${left[i][0]} differs` };
  }
  return { equal: true, why: `${left.length} files identical` };
}

/**
 * Install a scoped set of skills into a disposable project and audit what landed. This is
 * criterion 4 and criterion 5 narrowed to the skills this change touched, which is what §11's
 * "skills nuevas o modificadas en cada integración" asks for; the full 274 sweep stays
 * `scripts/verify-catalog-conformance.js`, reserved for promotion.
 */
export async function scopedConformance({ cwd, ids, home = null, project = null }) {
  const { applyInstall } = await import(`${join(cwd, 'scripts', 'install-apply.js')}`);
  const { BLOCK_BEGIN, BLOCK_END, customizationPathFor, digestOf, governanceOf, renderBlock } =
    await import(`${join(cwd, 'scripts', 'lib', 'governance.js')}`);

  const proj = project || mkdtempSync(join(tmpdir(), 'rsc-gate-proj-'));
  const h = home || mkdtempSync(join(tmpdir(), 'rsc-gate-home-'));
  const skillIds = [...new Set(['suggest', ...ids])];
  const failures = [];

  await applyInstall({ skillIds, target: 'claude', home: h, cwd: proj });
  const first = new Map();
  for (const id of ids) {
    const md = join(proj, '.rsc', 'skills', id, 'SKILL.md');
    if (!existsSync(md)) { failures.push(`${id}: no base at .rsc/skills/${id}/SKILL.md`); continue; }
    const text = readFileSync(md, 'utf8');
    first.set(id, text);
    const info = governanceOf(text);
    if (!info.complete) failures.push(`${id}: incomplete governance (block=${Boolean(info.block)}, keys=${Object.keys(info.keys).length}/3)`);
    if (!info.digestMatches) failures.push(`${id}: digest does not match its own block`);
    if (text.split(BLOCK_BEGIN).length - 1 !== 1) failures.push(`${id}: ${text.split(BLOCK_BEGIN).length - 1} opening markers, expected 1`);
    if (text.split(BLOCK_END).length - 1 !== 1) failures.push(`${id}: ${text.split(BLOCK_END).length - 1} closing markers, expected 1`);
    if (info.keys['governance-customization'] !== customizationPathFor(id)) {
      failures.push(`${id}: customization key is \`${info.keys['governance-customization']}\`, expected \`${customizationPathFor(id)}\``);
    }
    if (info.keys['governance-digest'] !== digestOf(renderBlock(id))) {
      failures.push(`${id}: digest key does not match the block rendered for this id`);
    }
  }
  // Second pass, same project: criterion 5 over the installed tree.
  await applyInstall({ skillIds, target: 'claude', home: h, cwd: proj });
  const drifted = [];
  for (const [id, before] of first) {
    const md = join(proj, '.rsc', 'skills', id, 'SKILL.md');
    if (!existsSync(md) || readFileSync(md, 'utf8') !== before) drifted.push(id);
  }
  return {
    ok: failures.length === 0, failures, drifted, idempotent: drifted.length === 0, project: proj, home: h, scope: ids,
  };
}

/**
 * The checks, in order. Each `run(ctx)` returns `{ ok, detail, measured? }` and may be async.
 * `required` means a failure blocks promotion; `instrumented: false` means no code here can decide
 * it, so it needs a recorded result instead.
 */
export const GATE_CHECKS = Object.freeze([
  {
    id: 'G1',
    title: 'skills/ is still a byte-identical mirror of the integrated upstream commit',
    kind: 'deterministic',
    required: true,
    instrumented: true,
    run({ cwd, upstreamRef }) {
      const res = git(['diff', '--numstat', upstreamRef, '--', 'skills/'], { cwd });
      if (!res.ok) return { ok: false, detail: `git diff failed: ${res.stderr}` };
      const lines = res.stdout ? res.stdout.split('\n').filter(Boolean) : [];
      return {
        ok: lines.length === 0,
        detail: lines.length === 0 ? '0 lines of difference' : `${lines.length} differing files: ${lines.slice(0, 5).join(', ')}`,
        measured: { differingFiles: lines.length },
      };
    },
  },
  {
    id: 'G2',
    title: 'the integrated catalog is exactly upstream\'s catalog — nothing lost, nothing invented',
    kind: 'deterministic',
    required: true,
    instrumented: true,
    run({ cwd, upstreamRef }) {
      const ours = readdirSync(join(cwd, 'skills'), { withFileTypes: true })
        .filter((e) => e.isDirectory() && existsSync(join(cwd, 'skills', e.name, 'SKILL.md')))
        .map((e) => e.name).sort();
      const res = git(['ls-tree', '-r', '--name-only', upstreamRef, '--', 'skills/'], { cwd });
      const theirs = [...new Set(res.stdout.split('\n')
        .filter((p) => p.endsWith('/SKILL.md') && p.split('/').length === 3)
        .map((p) => p.split('/')[1]))].sort();
      const missing = theirs.filter((id) => !ours.includes(id));
      const extra = ours.filter((id) => !theirs.includes(id));
      return {
        ok: missing.length === 0 && extra.length === 0,
        detail: missing.length || extra.length
          ? `missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}`
          : `${ours.length} skills, identical id set`,
        measured: { count: ours.length, missing, extra },
      };
    },
  },
  {
    id: 'G3',
    title: 'every added and modified skill carries the contract in its distributed base',
    kind: 'deterministic',
    required: true,
    instrumented: true,
    async run(ctx) {
      const ids = [...new Set([...(ctx.classification?.added || []), ...(ctx.classification?.modified || [])])];
      if (!ids.length) return { ok: true, detail: 'no skill was added or modified by this change' };
      // The `govern` phase already installed and compared; reuse it rather than paying twice.
      const r = ctx.scopedConformance || await scopedConformance({ cwd: ctx.cwd, ids });
      ctx.scopedConformance = r;
      return {
        ok: r.ok,
        detail: r.ok ? `${ids.length} skill(s) conformant in a real install` : r.failures.slice(0, 6).join(' · '),
        measured: { scope: ids, failures: r.failures.length },
      };
    },
  },
  {
    id: 'G4',
    title: 'the transformation over that same scope is idempotent (second install byte-identical)',
    kind: 'deterministic',
    required: true,
    instrumented: true,
    async run(ctx) {
      // G3 already installed twice and compared; reuse its measurement rather than paying for a
      // second disposable install. When G3 had nothing in scope, there is nothing to drift.
      const ids = [...new Set([...(ctx.classification?.added || []), ...(ctx.classification?.modified || [])])];
      const result = ctx.scopedConformance
        || (ids.length ? await scopedConformance({ cwd: ctx.cwd, ids }) : { idempotent: true, drifted: [], scope: [] });
      return {
        ok: result.idempotent,
        detail: result.idempotent
          ? `${result.scope.length} skill(s) byte-identical across two installs`
          : `drifted: ${result.drifted.join(', ')}`,
        measured: { drifted: result.drifted },
      };
    },
  },
  {
    id: 'G5',
    title: 'vendored subtrees are untouched by the transformation and by the merge',
    kind: 'deterministic',
    required: true,
    instrumented: true,
    run(ctx) {
      const subtrees = vendoredSubtrees(ctx.cwd, 'HEAD');
      const bad = [];
      for (const dir of subtrees) {
        const res = git(['diff', '--numstat', ctx.upstreamRef, '--', dir], { cwd: ctx.cwd });
        if (!res.ok) { bad.push(`${dir}: ${res.stderr}`); continue; }
        if (res.stdout.trim()) bad.push(`${dir} differs from ${ctx.upstreamRef}`);
      }
      // And the half the repository diff cannot see: the DELIVERED copy. A vendored subtree whose
      // `UPSTREAM.json` says `"modified": false` must be byte-identical in the install too, or the
      // attribution statement is false on the consumer's disk.
      if (ctx.scopedConformance?.project) {
        for (const dir of subtrees) {
          const [, id, ...rest] = dir.split('/');
          if (!ctx.scopedConformance.scope.includes(id)) continue;
          const delivered = join(ctx.scopedConformance.project, '.rsc', 'skills', id, ...rest);
          if (!existsSync(delivered)) { bad.push(`${dir}: not delivered`); continue; }
          const cmp = dirsEqual(join(ctx.cwd, dir), delivered);
          if (!cmp.equal) bad.push(`${dir}: delivery differs (${cmp.why})`);
        }
      }
      return {
        ok: bad.length === 0,
        detail: bad.length ? bad.slice(0, 5).join(' · ') : `${subtrees.length} vendored subtree(s) identical`,
        measured: { subtrees, failures: bad },
      };
    },
  },
  {
    id: 'G6',
    title: 'new or changed third-party notices are acknowledged in the fork\'s obligation inventory',
    kind: 'deterministic',
    required: true,
    instrumented: true,
    run(ctx) {
      const d = ctx.attribution || { added: [], removed: [], changed: [], newVendored: [] };
      const pending = [...d.added, ...d.removed, ...d.changed];
      if (!pending.length) return { ok: true, detail: 'no notice changed' };
      const ack = ctx.acknowledgements?.G6 || null;
      return {
        ok: Boolean(ack),
        detail: ack
          ? `${pending.length} notice change(s) acknowledged: ${ack}`
          : `${pending.length} notice change(s) NOT acknowledged — new vendored subtrees: `
            + `${d.newVendored.join(', ') || 'none'}; added: ${d.added.slice(0, 6).join(', ')}`,
        measured: d,
      };
    },
  },
  {
    id: 'G7',
    title: 'every fork divergence survived the merge in intent, not only in text',
    kind: 'deterministic',
    required: true,
    instrumented: true,
    run(ctx) {
      const files = ctx.surface?.modified || Object.keys(DIVERGENCE_PROBES);
      const unprobed = files.filter((f) => !DIVERGENCE_PROBES[f]);
      const failures = [];
      for (const file of files) {
        const abs = join(ctx.cwd, file);
        if (!existsSync(abs)) { failures.push({ file, probe: null, missingFile: true }); continue; }
        failures.push(...checkProbes(file, readFileSync(abs, 'utf8')).failures);
      }
      // Both halves are reported, always: a reverted divergence and an unwatched one are different
      // problems, and reporting only the first would hide the second behind it.
      const parts = [];
      if (failures.length) {
        parts.push(failures.map((f) => `${f.file}: ${f.missingFile ? 'file gone' : (f.found ? 'reverted-to-upstream fragment reappeared' : 'intent fragment missing')}`).join(' · '));
      }
      if (unprobed.length) parts.push(`${unprobed.length} divergence(s) with no intent probe: ${unprobed.join(', ')}`);
      return {
        ok: failures.length === 0 && unprobed.length === 0,
        detail: parts.length ? parts.join(' · ') : `${files.length} divergence(s) intact`,
        measured: { files, unprobed, failures: failures.length },
      };
    },
  },
  {
    id: 'G8',
    title: 'the impacted test subset runs, and no NEW test fails',
    kind: 'deterministic',
    required: true,
    instrumented: true,
    run(ctx) {
      const files = ctx.impactedTests || impactedTests({
        cwd: ctx.cwd, upstreamChanged: ctx.upstreamChanged || [], classification: ctx.classification,
      });
      const r = ctx.testRun || runTests({ cwd: ctx.cwd, files, env: ctx.testEnv || process.env });
      ctx.testRun = r;
      return {
        ok: r.ok && !r.instrumentUnsound,
        detail: r.skipped ? r.detail : `${files.length} file(s): ${r.detail}`
          + (r.instrumentUnsound ? ' — INSTRUMENT UNSOUND: no GIT_CEILING_DIRECTORIES, five tests are known to fail with plausible false messages without it' : '')
          + (r.unexpected?.length ? ` — new failures: ${r.unexpected.slice(0, 6).join(', ')}` : ''),
        measured: {
          files, tap: r.tap, unexpected: r.unexpected, excused: r.excused, notRun: r.notRun, instrument: r.instrument,
        },
      };
    },
  },
  {
    id: 'G9',
    title: 'customizations survive; a deletion is reported orphaned and a rename is never rehomed',
    kind: 'deterministic',
    required: true,
    instrumented: true,
    async run(ctx) {
      const { catalogIds } = await import(`${join(ctx.cwd, 'scripts', 'lib', 'customization-validator.js')}`);
      const after = catalogIds(ctx.cwd);
      const gone = [...(ctx.classification?.removed || [])];
      const renames = ctx.classification?.renameCandidates || [];
      const bad = [];
      for (const id of gone) if (after.includes(id)) bad.push(`${id} is reported removed but is still in the catalog`);
      for (const r of renames) {
        if (!r.disposition?.includes('never an automatic rehome')) bad.push(`${r.from}→${r.to} carries no decision requirement`);
        if (!gone.includes(r.from)) bad.push(`${r.from}→${r.to}: the old name is not in the removed set, so it would not be reported orphaned`);
      }
      return {
        ok: bad.length === 0,
        detail: bad.length ? bad.join(' · ')
          : `${gone.length} deletion(s) and ${renames.length} rename candidate(s), each a reported `
            + 'migration rather than an applied one',
        measured: { removed: gone, renameCandidates: renames },
      };
    },
  },
  {
    id: 'G10',
    title: 'a deleted skill\'s consequence is recorded: the shared base is pruned only via RETIRED_SKILLS',
    kind: 'deterministic',
    required: true,
    instrumented: true,
    async run(ctx) {
      const removed = ctx.classification?.removed || [];
      if (!removed.length) return { ok: true, detail: 'no skill was removed by this change' };
      const { isRetired } = await import(`${join(ctx.cwd, 'scripts', 'lib', 'retired-skills.js')}`);
      const unregistered = removed.filter((id) => !isRetired(id));
      const ack = ctx.acknowledgements?.G10 || null;
      return {
        ok: unregistered.length === 0 || Boolean(ack),
        detail: unregistered.length === 0
          ? `${removed.length} removal(s), all present in RETIRED_SKILLS`
          : `${unregistered.join(', ')} not in RETIRED_SKILLS: the consumer keeps a GOVERNED base at `
            + '`.rsc/skills/<id>/` for a skill that no longer exists, because `install-apply.js` '
            + 'prunes a base only for a retired id. Add the entry by hand (and note the new '
            + `divergence in a file upstream edits)${ack ? ` — acknowledged: ${ack}` : ''}`,
        measured: { removed, unregistered },
      };
    },
  },
  {
    id: 'G12',
    title: 'the merge did not restore the parent\'s identity in package.json',
    kind: 'deterministic',
    required: true,
    instrumented: true,
    run(ctx) {
      // Narrow and specific to maintenance: upstream owns `package.json`, the fork has modified it,
      // and a three-way merge of a release bump can quietly bring the parent's name, bin or
      // registry reference back. REQUIREMENTS §10 is about exactly that — "evitar reinstalar
      // accidentalmente el padre" — and a reinstated `"name": "@ericrisco/rsc"` would send every
      // consumer's auto-update at the parent. The full identity audit belongs to the distribution
      // stage; what is checked here is only what this merge could have undone.
      const file = join(ctx.cwd, 'package.json');
      if (!existsSync(file)) return { ok: false, detail: 'no package.json in the integrated tree' };
      const raw = readFileSync(file, 'utf8');
      let pkg;
      try { pkg = JSON.parse(raw); } catch (err) { return { ok: false, detail: `package.json is not valid JSON: ${err.message}` }; }
      const bad = [];
      if (pkg.name === '@ericrisco/rsc') bad.push('`name` is the parent package `@ericrisco/rsc`');
      if (pkg.bin && Object.hasOwn(pkg.bin, 'rsc')) bad.push('`bin` exposes the parent command `rsc`');
      if (raw.includes('@ericrisco/rsc version')) bad.push('the release comparison still reads the parent package version');
      return {
        ok: bad.length === 0,
        detail: bad.length ? bad.join(' · ') : `identity is \`${pkg.name}\`, bin ${Object.keys(pkg.bin || {}).join(', ') || 'none'}`,
        measured: { name: pkg.name, bin: Object.keys(pkg.bin || {}), failures: bad },
      };
    },
  },
  {
    id: 'G11',
    title: 'semantic evaluations of the added and modified skills',
    kind: 'semantic',
    required: true,
    instrumented: false,
    run(ctx) {
      const ids = [...new Set([...(ctx.classification?.added || []), ...(ctx.classification?.modified || [])])];
      const recorded = ctx.acknowledgements?.G11 || null;
      if (!ids.length) return { ok: true, detail: 'no skill was added or modified, so there is nothing to evaluate' };
      return {
        ok: Boolean(recorded),
        detail: recorded
          ? `recorded: ${recorded}`
          : `${ids.length} skill(s) need a semantic evaluation (${ids.slice(0, 8).join(', ')}). This `
            + 'runs on the session\'s own agents (D5/D9), so no script here can decide it: the result '
            + 'must be recorded against G11 before promotion. Decidable is not instrumented',
        measured: { scope: ids, instrumented: false },
      };
    },
  },
]);

/**
 * Run the gate. `acknowledgements` is a map of check id to the recorded decision that satisfies a
 * check no code can decide; it comes from the run journal, never from a flag typed at the moment
 * of being blocked.
 */
export async function runGate(ctx) {
  const results = [];
  for (const check of GATE_CHECKS) {
    let out;
    try {
      // eslint-disable-next-line no-await-in-loop -- the checks share a context and must not race.
      out = await check.run(ctx);
    } catch (err) {
      out = { ok: false, detail: `the check threw: ${err.message}` };
    }
    results.push({
      id: check.id,
      title: check.title,
      kind: check.kind,
      required: check.required,
      instrumented: check.instrumented,
      ok: Boolean(out.ok),
      detail: out.detail || null,
      measured: out.measured ?? null,
    });
  }
  return results;
}

/**
 * The verdict. `pass` requires every required check to be ok. A clean merge contributes nothing:
 * `merge` is carried alongside, as evidence, with `counts: false`.
 */
export function gateVerdict(results, { merge = null } = {}) {
  const seen = new Set(results.map((r) => r.id));
  // COVERAGE FIRST. Without this, an empty result list passes — "no required check failed" is true
  // of a gate that never ran, and a validator that cannot fail reports the same thing as one that
  // passes. A required check missing from the results is counted as failing, by id, so the verdict
  // names what was not measured instead of being silent about it.
  const missing = GATE_CHECKS.filter((c) => c.required && !seen.has(c.id)).map((c) => c.id);
  const required = results.filter((r) => r.required);
  const failed = required.filter((r) => !r.ok);
  const needsDecision = failed.filter((r) => !r.instrumented);
  const blocking = [...failed.map((r) => r.id), ...missing];
  return {
    verdict: blocking.length === 0 ? 'pass' : 'blocked',
    checks: results.length,
    requiredChecks: GATE_CHECKS.filter((c) => c.required).length,
    notRun: missing,
    failed: blocking,
    needsDecision: needsDecision.map((r) => r.id),
    merge: merge
      ? {
        ...merge,
        counts: false,
        note: 'a merge with no textual conflicts is not accepted as proof of functional '
          + 'compatibility (PLAN §8); it is recorded here as evidence and contributes nothing to the verdict',
      }
      : null,
  };
}

/** `true` when a verdict may be promoted. Kept separate so the entry point cannot fudge it. */
export function promotable(verdictObj) {
  return verdictObj.verdict === 'pass';
}

/** For the report: a one-line table row per check. */
export function formatGate(results) {
  return results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.id} [${r.instrumented ? 'run' : 'not instrumented'}] ${r.title}`
    + (r.detail ? `\n       ${r.detail}` : ''));
}
