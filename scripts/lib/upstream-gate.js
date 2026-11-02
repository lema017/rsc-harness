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
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { checkProbes, DIVERGENCE_PROBES, git, revParse, vendoredSubtrees } from './upstream-survey.js';

/**
 * Where this gate's disposable trees live: INSIDE the repository it is auditing, never
 * `os.tmpdir()`.
 *
 * REQUIREMENTS §1 is literal — "Ejecuta los procesos con `HOME` y las variables de configuración
 * apuntando a un directorio temporal dentro de la carpeta dedicada" — and `os.tmpdir()` honours
 * `TMPDIR` only when somebody remembered to export it. Without it, `tmpdir()` is a literal `/tmp`,
 * which is outside the dedicated folder: the same reason `tests/eval-lint.test.js` sits in
 * `NEVER_RUN` below. A rule this file enforces against another script cannot be broken by this
 * file, and an invariant that depends on an environment variable being remembered is not an
 * invariant. So the root is DERIVED from the tree under audit and nothing has to be remembered.
 *
 * `.rsc-upstream/` is git-ignored, so these trees never reach `git status` or a commit.
 */
export const SCRATCH_DIR = join('.rsc-upstream', 'tmp');

/** A disposable directory under the audited repository. Never `/tmp`, never the user's `$HOME`. */
export function scratchRoot(cwd) {
  const root = join(cwd, SCRATCH_DIR);
  mkdirSync(root, { recursive: true });
  return root;
}

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

/**
 * `{ files, error }`. The error is RETURNED, not swallowed: an unreadable `tests/` directory used to
 * produce `[]`, which is the same value as "there is nothing to run" — and the net around acceptance
 * criterion 4 silently emptying itself is the one failure mode this list exists to prevent.
 */
export function alwaysRunFiles(cwd) {
  try {
    const files = readdirSync(join(cwd, 'tests'))
      .filter((f) => ALWAYS_RUN_PATTERN.test(f)).map((f) => `tests/${f}`).sort();
    return {
      files,
      error: files.length ? null
        : `no \`tests/governance-*.test.js\` in ${join(cwd, 'tests')}: the fork's governance suite is `
          + 'DERIVED from the tree, so an empty net means the enumeration found nothing, not that '
          + 'nothing is impacted',
    };
  } catch (err) {
    return { files: [], error: `cannot read ${join(cwd, 'tests')}: ${err.code || err.message}` };
  }
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
  return enumerateImpactedTests({ cwd, upstreamChanged, classification }).files;
}

/**
 * The same derivation, with the enumeration's own health attached. `impactedTests` keeps returning a
 * bare array because that is what the report prints; G8 uses this one, because a gate that cannot
 * enumerate what to run must FAIL rather than run nothing and call it a pass.
 */
export function enumerateImpactedTests({ cwd, upstreamChanged = [], classification = null }) {
  const want = new Set();
  const never = new Set(NEVER_RUN.map((n) => n.file));
  const add = (p) => { if (p && !never.has(p) && existsSync(join(cwd, p))) want.add(p); };

  const net = alwaysRunFiles(cwd);
  for (const p of net.files) add(p);
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
  const files = [...want].sort();
  return {
    files,
    error: net.error || (files.length ? null : 'the impacted test subset is empty'),
    net: net.files,
  };
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
  // A SKIP IS NOT A PASS. This used to return `{ ok: true, skipped: true }` with no instrument and
  // no reason, so G8 — `r.ok && !r.instrumentUnsound` — passed with `measured.instrument` undefined
  // at the exact moment no test had run. An empty subset cannot mean "nothing was impacted" either:
  // the fork's governance suite is DERIVED from `tests/` and is always in scope, so an empty list
  // means the enumeration failed. Reported as not-ok, with the reason travelling in the result.
  if (!files.length) {
    return {
      ok: false,
      skipped: true,
      skipReason: 'no test file was enumerated. The fork\'s governance suite is derived from `tests/` '
        + 'and always in scope, so an empty subset is an enumeration failure, not an absence of impact',
      instrumentUnsound: true,
      instrument: null,
      tap: null,
      unexpected: [],
      excused: [],
      detail: 'NOTHING RAN: the impacted test subset was empty, which is an enumeration failure and '
        + 'not a pass',
      notRun: NEVER_RUN.filter((n) => existsSync(join(cwd, n.file))),
    };
  }
  const ceiling = env.GIT_CEILING_DIRECTORIES || null;
  // `--test-reporter=tap` is explicit, and `NODE_TEST_CONTEXT` is removed from the child's
  // environment, because this result is PARSED. Node picks its reporter from the context it thinks
  // it is in: a child spawned from inside a `node --test` process inherits `NODE_TEST_CONTEXT` and
  // emits the internal v8-serialized protocol instead of TAP, so `parseTap` returns nulls for every
  // count and the gate measures `null` passes out of `null` tests. Not a finding of the review —
  // found while writing the negative coverage for G8, which is the first thing that ever called the
  // instrument from inside a test — but it is the same failure mode M6 is about: an instrument that
  // reports nothing must not be mistaken for one that reported zero problems.
  const childEnv = { ...env };
  delete childEnv.NODE_TEST_CONTEXT;
  const res = spawnSync(process.execPath, [
    '--test', '--test-reporter=tap', '--test-concurrency=1', `--test-timeout=${timeoutMs}`, ...files,
  ], {
    cwd, encoding: 'utf8', timeout: wallClockMs, env: childEnv, maxBuffer: 256 * 1024 * 1024,
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
      concurrency: 1,
      timeoutMs,
      // A BOOLEAN, not the value. `GIT_CEILING_DIRECTORIES` holds an absolute path from the
      // operator's environment, and this object is written verbatim into
      // `evidence/impacted-tests.json`, which lives under `docs/fork/` and is committed to a
      // repository meant to be published. The gate only ever uses it as a boolean
      // (`instrumentUnsound: !ceiling`), so the value buys nothing and leaks an environment.
      gitCeiling: Boolean(ceiling),
      idleMachine: false,
      idleMachineNote: 'limit L7: not achievable on this machine',
    },
    detail: `${tap.pass ?? '?'} passed, ${tap.fail ?? '?'} failed (${excused.length} declared, `
      + `${unexpected.length} unexpected), ${tap.cancelled ?? '?'} cancelled`,
    notRun: NEVER_RUN.filter((n) => existsSync(join(cwd, n.file))),
  };
}

// ---------------------------------------------------------------- acknowledgements

/**
 * An acknowledgement is the recorded answer to a question no code here can decide. It is still
 * CHECKED, because "recorded" has to mean more than "typed".
 *
 * `--ack G6="anything at all"` used to clear G6. That makes the one check a clean merge and a green
 * suite both miss into a check a single word defeats, which is worse than not having it: it produces
 * a PASS line in a committed report with nothing behind it. So each acknowledgement declares a SHAPE
 * that is mechanically verifiable against the repository, and an ack that does not meet it is
 * reported as REJECTED — not as absent, because the difference matters to whoever typed it.
 *
 * None of this decides the question. It decides only that an answer was given in a form that can be
 * followed back to something real.
 */
export const ACK_VALIDATORS = Object.freeze({
  G6: {
    shape: 'the path of the file that now records the obligation, e.g. `G6=README.md third-party table, PLAN.md §2`',
    check(text, ctx) {
      const tokens = [...String(text).matchAll(/[\w.@/-]+\.(?:md|json|txt|ya?ml|js|mjs)\b/g)].map((m) => m[0]);
      const found = tokens.filter((t) => ctx.cwd && existsSync(join(ctx.cwd, t)));
      return found.length
        ? { ok: true, error: null, resolved: found }
        : {
          ok: false,
          error: `names no file that exists in this tree (looked at: ${tokens.join(', ') || 'no path-shaped token at all'}). `
            + 'An obligation is acknowledged by pointing at where it was written down',
        };
    },
  },
  G10: {
    shape: 'a commit this repository can resolve, e.g. `G10=added in 1a2b3c4`',
    check(text, ctx) {
      // At least seven characters, which is git's own abbreviated-object length: it keeps short
      // words out of the candidate set, including ones that would resolve by accident (`main`).
      // What this verifies is that the revision EXISTS, not that the entry is in it — reading
      // `retired-skills.js` at that commit would be a different and much more specific claim than
      // the one the operator is making.
      const tokens = [...new Set(String(text).split(/[\s,;:()[\]"'`]+/).filter((t) => /^[\w./^~@{}-]{7,60}$/.test(t)))];
      for (const token of tokens.slice(0, 16)) {
        const sha = ctx.cwd ? revParse(ctx.cwd, token) : null;
        if (sha) return { ok: true, error: null, resolved: sha };
      }
      return {
        ok: false,
        error: 'contains no revision this repository can resolve. The entry it claims was added is a '
          + 'commit, so the acknowledgement names that commit and the gate resolves it',
      };
    },
  },
  G11: {
    shape: 'the repetition count and the skills evaluated, e.g. `G11=N=3 over connect-tool, all cases above threshold`',
    check(text, ctx) {
      const n = /\bN\s*=\s*(\d+)/i.exec(String(text));
      if (!n || Number(n[1]) < 1) {
        return {
          ok: false,
          error: 'does not state the repetition count (`N=<n>`). §11 evaluates at N=3, and a result '
            + 'without its N is not a result',
        };
      }
      const scope = [...new Set([...(ctx.classification?.added || []), ...(ctx.classification?.modified || [])])];
      const named = scope.filter((id) => String(text).includes(id));
      if (scope.length && !named.length) {
        return {
          ok: false,
          error: `names none of the ${scope.length} skill(s) it is supposed to have evaluated `
            + `(${scope.slice(0, 8).join(', ')})`,
        };
      }
      return { ok: true, error: null, resolved: { n: Number(n[1]), named } };
    },
  },
});

/** `{ ok, error, resolved }` for one acknowledgement. An unknown id is accepted unvalidated. */
export function validateAck(id, text, ctx = {}) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, error: 'is empty' };
  }
  const validator = ACK_VALIDATORS[id];
  if (!validator) return { ok: true, error: null, resolved: null };
  return validator.check(text, ctx);
}

/**
 * The acknowledgement a check may use: `{ text, accepted, error }`.
 *
 * `text` is what was recorded, `accepted` is whether it cleared its shape. A check treats
 * `accepted` as its clearance and prints `error` when something was recorded and rejected, so a
 * rejected ack never reads like an ack nobody gave.
 */
export function ackFor(ctx, id) {
  const text = ctx.acknowledgements?.[id] ?? null;
  if (text === null || text === undefined || text === '') return { text: null, accepted: false, error: null };
  const v = validateAck(id, text, ctx);
  return {
    text: String(text),
    accepted: v.ok,
    error: v.ok ? null : `the acknowledgement recorded for ${id} ${v.error}. Expected ${ACK_VALIDATORS[id]?.shape || 'a recorded result'}`,
  };
}

// ---------------------------------------------------------------- the checks

/**
 * COVERAGE BEFORE RESULT, for every input and not only for the divergence surface.
 *
 * The review's diagnosis of A3 names the root cause once and it applies six more times than the
 * finding it was raised against: "una entrada ausente es indistinguible de una entrada que midió
 * cero". A check handed no `classification` computed an empty scope and said "no skill was added or
 * modified by this change" — which is true of a change nobody classified, and reads identically to
 * the same sentence about a change that really touched no skill.
 *
 * Measured on the code before this fix: with a context of `{ cwd, upstreamRef }` and nothing else,
 * ALL TWELVE checks passed. Afterwards, the only ones that pass are the four that measure the tree
 * directly and therefore need no input handed to them — G1, G2, G5 and G12.
 *
 * `null` counts as absent. An input that was measured and came back empty is an object.
 */
function missingInput(ctx, key, what) {
  if (ctx[key] !== null && ctx[key] !== undefined) return null;
  return {
    ok: false,
    detail: `no ${what} was handed to this check, so nothing was compared. It is measured in `
      + '`classify` and carried into the gate; its absence is a wiring failure, not a measurement of zero',
    measured: { [key]: 'absent' },
  };
}

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

  // Rooted in the repository under audit (see SCRATCH_DIR): REQUIREMENTS §1 forbids writing
  // outside the dedicated folder, and `applyInstall` is handed `home` explicitly so nothing it does
  // can reach the user's real `~/.claude`.
  const scratch = scratchRoot(cwd);
  const proj = project || mkdtempSync(join(scratch, 'proj-'));
  const h = home || mkdtempSync(join(scratch, 'home-'));
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
      const absent = missingInput(ctx, 'classification', 'catalog classification');
      if (absent) return absent;
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
      const absent = missingInput(ctx, 'classification', 'catalog classification');
      if (absent) return absent;
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
      const absent = missingInput(ctx, 'attribution', 'attribution delta');
      if (absent) return absent;
      const d = ctx.attribution;
      const pending = [...(d.added || []), ...(d.removed || []), ...(d.changed || [])];
      if (!pending.length) return { ok: true, detail: 'no notice changed' };
      const ack = ackFor(ctx, 'G6');
      const notAcknowledged = `${pending.length} notice change(s) NOT acknowledged — new vendored subtrees: `
        + `${d.newVendored.join(', ') || 'none'}; added: ${d.added.slice(0, 6).join(', ')}`;
      return {
        ok: ack.accepted,
        detail: ack.accepted
          ? `${pending.length} notice change(s) acknowledged: ${ack.text}`
          : `${notAcknowledged}${ack.error ? ` · ${ack.error}` : ''}`,
        measured: { ...d, ack: ack.accepted ? ack.text : null, ackRejected: ack.error },
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
      // THE INPUT IS CHECKED BEFORE THE PROPERTY IS. `divergenceSurface` returns
      // `{ ok: false, modified: [] }` when git fails, and the old `ctx.surface?.modified ||
      // Object.keys(DIVERGENCE_PROBES)` could not express the difference between the three states
      // this check has to tell apart, because `[]` is truthy and never reaches the fallback:
      //
      //   no surface at all        nobody measured — this check has no input and must not pass
      //   a surface that failed    git could not measure — a measurement of zero is not zero
      //   a surface measuring 0    measured, and the fork really has no divergence — a pass
      //
      // Conflating the first two with the third printed `0 divergence(s) intact` and, downstream,
      // `collisions: none — upstream did not touch the fork's divergence surface`. A reassurance
      // computed from a failure is worse than no check: it is a committed report saying the thing
      // was looked at.
      //
      // The old fallback to `Object.keys(DIVERGENCE_PROBES)` is gone for a second reason: with
      // `files` taken from the probe table, `unprobed = files.filter((f) => !DIVERGENCE_PROBES[f])`
      // is necessarily `[]`, so the unwatched-divergence half of this check could never fire on
      // that path. A branch that cannot fail is not a fallback.
      if (!ctx.surface) {
        return {
          ok: false,
          detail: 'no divergence surface was handed to this check, so nothing was compared. The '
            + 'surface is measured in `classify` and carried into the gate; its absence is a wiring '
            + 'failure, not an absence of divergences',
          measured: { surface: 'absent', files: null, unprobed: null, failures: null },
        };
      }
      if (ctx.surface.ok !== true) {
        return {
          ok: false,
          detail: `the divergence surface could not be MEASURED: ${ctx.surface.error || 'unknown git failure'}. `
            + 'An unmeasured surface is reported as a failure, never as zero divergences',
          measured: { surface: 'unmeasured', error: ctx.surface.error || null, files: null },
        };
      }
      const files = ctx.surface.modified;
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
        detail: parts.length ? parts.join(' · ')
          : `${files.length} divergence(s) intact, measured against the ${ctx.surface.measuredAgainst || 'tree'}`,
        measured: {
          surface: 'measured', measuredAgainst: ctx.surface.measuredAgainst || null, files, unprobed, failures: failures.length,
        },
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
      // An enumeration failure is a FAILURE. `alwaysRunFiles` used to swallow a `readdirSync` error
      // and return `[]`, and `runTests([])` used to return `{ ok: true, skipped: true }` with no
      // instrument at all — so the one check that measures behaviour passed, with
      // `measured.instrument` undefined, precisely when no test had run.
      const enumeration = ctx.impactedTests
        ? { files: ctx.impactedTests, error: ctx.impactedTests.length ? null : 'the impacted test subset handed to the gate is empty' }
        : enumerateImpactedTests({
          cwd: ctx.cwd, upstreamChanged: ctx.upstreamChanged || [], classification: ctx.classification,
        });
      if (enumeration.error) {
        return {
          ok: false,
          detail: `the impacted test subset could not be enumerated: ${enumeration.error}`,
          measured: { files: enumeration.files, enumerationError: enumeration.error, tap: null, instrument: null },
        };
      }
      const files = enumeration.files;
      const r = ctx.testRun || runTests({ cwd: ctx.cwd, files, env: ctx.testEnv || process.env });
      ctx.testRun = r;
      // A skip reaches here only when it declares WHY, and `runTests` only ever skips for an empty
      // subset, which is already not a pass. Stated as a condition rather than trusted.
      const skipAccounted = !r.skipped || Boolean(r.skipReason);
      return {
        ok: r.ok && !r.instrumentUnsound && skipAccounted,
        detail: (r.skipped ? r.detail : `${files.length} file(s): ${r.detail}`)
          + (r.skipped && r.skipReason ? ` — ${r.skipReason}` : '')
          + (r.skipped && !r.skipReason ? ' — SKIPPED WITHOUT A DECLARED REASON, which is not a pass' : '')
          + (r.instrumentUnsound ? ' — INSTRUMENT UNSOUND: no GIT_CEILING_DIRECTORIES, five tests are known to fail with plausible false messages without it' : '')
          + (r.unexpected?.length ? ` — new failures: ${r.unexpected.slice(0, 6).join(', ')}` : ''),
        measured: {
          files,
          tap: r.tap ?? null,
          unexpected: r.unexpected,
          excused: r.excused,
          notRun: r.notRun,
          instrument: r.instrument ?? null,
          skipped: Boolean(r.skipped),
          skipReason: r.skipReason || null,
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
    // ONE HALF OF THIS CHECK IS INSTRUMENTED AND THE OTHER IS NOT, and saying so is more useful
    // than pretending otherwise. The DELETION half is real: it compares the reported removals
    // against the catalog that is actually on disk. The RENAME half is a tautology — it asserts
    // that `renameCandidates[].disposition` contains "never an automatic rehome", and that string is
    // written by `classifyCatalogChanges` as a literal constant, so the assertion can only detect
    // somebody editing the constant. It cannot detect a real rehome, because detecting one would
    // mean knowing that two differently-named skills are the same skill, which the catalog carries
    // no identifier to decide (`origin: risco` in all 274, measured). It is kept as a tripwire on
    // the constant and declared here as decidable-not-instrumented rather than inflated into a
    // guarantee.
    rehomeDetection: 'not instrumented: the catalog has no stable identifier, so a real rehome is '
      + 'not mechanically distinguishable from a deletion plus an addition',
    async run(ctx) {
      const absent = missingInput(ctx, 'classification', 'catalog classification');
      if (absent) return absent;
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
      const absent = missingInput(ctx, 'classification', 'catalog classification');
      if (absent) return absent;
      const removed = ctx.classification?.removed || [];
      if (!removed.length) return { ok: true, detail: 'no skill was removed by this change' };
      const { isRetired } = await import(`${join(ctx.cwd, 'scripts', 'lib', 'retired-skills.js')}`);
      const unregistered = removed.filter((id) => !isRetired(id));
      const ack = ackFor(ctx, 'G10');
      if (!unregistered.length) {
        return {
          ok: true,
          detail: `${removed.length} removal(s), all present in RETIRED_SKILLS`,
          measured: { removed, unregistered },
        };
      }
      // The failure text is built on the FAILURE branch only. It used to be built unconditionally
      // and then have ` — acknowledged: …` appended, so a PASS line in the report read "not in
      // RETIRED_SKILLS … Add the entry by hand" — the fix instruction printed next to the word PASS.
      if (ack.accepted) {
        return {
          ok: true,
          detail: `${unregistered.length} unregistered removal(s) (${unregistered.join(', ')}) cleared by `
            + `a recorded entry: ${ack.text}`,
          measured: { removed, unregistered, ack: ack.text },
        };
      }
      return {
        ok: false,
        detail: `${unregistered.join(', ')} not in RETIRED_SKILLS: the consumer keeps a GOVERNED base at `
          + '`.rsc/skills/<id>/` for a skill that no longer exists, because `install-apply.js` '
          + 'prunes a base only for a retired id. Add the entry by hand (and note the new '
          + `divergence in a file upstream edits)${ack.error ? ` · ${ack.error}` : ''}`,
        measured: { removed, unregistered, ackRejected: ack.error },
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
      const absent = missingInput(ctx, 'classification', 'catalog classification');
      if (absent) return absent;
      const ids = [...new Set([...(ctx.classification?.added || []), ...(ctx.classification?.modified || [])])];
      const ack = ackFor(ctx, 'G11');
      if (!ids.length) return { ok: true, detail: 'no skill was added or modified, so there is nothing to evaluate' };
      return {
        ok: ack.accepted,
        detail: ack.accepted
          ? `recorded: ${ack.text}`
          : `${ids.length} skill(s) need a semantic evaluation (${ids.slice(0, 8).join(', ')}). This `
            + 'runs on the session\'s own agents (D5/D9), so no script here can decide it: the result '
            + `must be recorded against G11 before promotion. Decidable is not instrumented${ack.error ? ` · ${ack.error}` : ''}`,
        measured: { scope: ids, instrumented: false, ack: ack.accepted ? ack.text : null, ackRejected: ack.error },
      };
    },
  },
]);

/**
 * Run the gate.
 *
 * `ctx.acknowledgements` is a map of check id to the recorded decision that satisfies a check no
 * code can decide. It is READ FROM THE RUN JOURNAL (`state.decisions`), which the orchestrator
 * populates from `--ack` before the gate runs — so a fresh run that passes `--ack` leaves the same
 * trace in the journal as a resume does, and the report always says which decision cleared which
 * check. `--ack` is the INPUT; the journal is the source this function reads.
 *
 * Each one is then validated against the shape its check declares (see `ACK_VALIDATORS`): an
 * acknowledgement is not a password, and a check cleared by free text is not a check.
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
