// Stage 5 — the maintenance entry point of REQUIREMENTS §9, and the properties it has to have
// rather than claim.
//
// `tests/governance-upstream-change.test.js` covers criterion 12 from the TRANSFORMER's side: what
// happens to a base and to a customization when upstream adds, removes, modifies or renames a
// skill. This file covers the MAINTENANCE side: whether the run that incorporates such a change
// recognizes it, says the right thing about it, refuses to accept a clean merge as proof, and can
// be interrupted and continued.
//
// Everything runs against a fixture repository pair built in `os.tmpdir()` — which honors `TMPDIR`,
// so under this project's instrument it lands inside the dedicated folder. The fixture's `upstream`
// remote is a LOCAL PATH, so `ls-remote` and `fetch` exercise the real code paths with no network
// at all: that is the only way to make this deterministic, and it is also what lets the suite run
// where the network is not available. The one thing a fixture cannot prove is that the real remote
// is reachable; that is checked by hand and recorded as such.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ANONYMOUS_GIT_FLAGS, DIVERGENCE_PROBES, anonymousGitEnv, attributionDelta, checkProbes,
  classifyCatalogChanges, collisions, divergenceSurface, hasRemote, isAttributionPath,
  lastIncorporated, probeRemote, redactUrl, vendoredSubtrees,
} from '../scripts/lib/upstream-survey.js';
import {
  ACK_VALIDATORS, GATE_CHECKS, KNOWN_FAILURES, NEVER_RUN, SCRATCH_DIR, alwaysRunFiles,
  enumerateImpactedTests, gateVerdict, impactedTests, parseTap, promotable, runTests,
  scopedConformance, scratchRoot, validateAck,
} from '../scripts/lib/upstream-gate.js';
import {
  AUTH_SCOPES, PHASES, acknowledgementsFrom, beginPhase, completePhase, loadRun, newRun, nextPhase,
  phasesAllowedBy, recordDecision, repoRelative, resumeRun, saveRun, scopeAllows, statePath,
} from '../scripts/lib/upstream-state.js';
import { PHASE_RUNNERS, maintain, renderReport } from '../scripts/upstream-maintain.js';
import { RETIRED_SKILLS, isRetired, replaceRetired } from '../scripts/lib/retired-skills.js';
import {
  FORK_PACKAGE, PARENT_PACKAGE, customizationPathFor, governanceOf, transformSkillMd,
} from '../scripts/lib/governance.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// A real file that upstream owns, that exists, and that the fork has NOT diverged on — so it
// carries no intent probe and never will. Three tests need "what a newly diverged file looks like
// in the minute before somebody writes its probe", and each of them used to name a file that was
// merely unprobed AT THE TIME: `scripts/audit.js`, which the D16 rename has since made a divergence
// with two probes of its own. Pointing all three at one declared constant is what stops the next
// expansion of the table from turning three negative cases green by accident.
const UNPROBED_UPSTREAM_FILE = 'LICENSE';

// ------------------------------------------------------------------ fixture

const IDENT = ['-c', 'user.name=fixture', '-c', 'user.email=fixture@localhost', '-c', 'commit.gpgsign=false'];

function g(cwd, args, { allowFail = false } = {}) {
  const res = spawnSync('git', [...ANONYMOUS_GIT_FLAGS, ...IDENT, ...args], {
    cwd, encoding: 'utf8', env: anonymousGitEnv(),
  });
  if (res.status !== 0 && !allowFail) {
    throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${res.stderr || res.stdout}`);
  }
  return (res.stdout || '').trim();
}

function put(root, rel, body) {
  const abs = join(root, ...rel.split('/'));
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, body);
}

const skill = (id, extra = '') => `---
name: ${id}
description: The ${id} skill, as upstream ships it.
origin: risco
---

# ${id}

Do the ${id} thing.
${extra}`;

/**
 * A pair of repositories shaped like this fork and its parent:
 *
 *   upstream/  a catalog of three skills, one shared source file, a package.json
 *   fork/      a clone of it whose `upstream` remote is the local path, plus the fork's own edits
 *              to `targets/thing.js` (a divergence) and a file only the fork has
 */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'rsc-maint-'));
  const up = join(root, 'upstream');
  mkdirSync(up, { recursive: true });
  g(up, ['init', '-q', '-b', 'main']);
  for (const id of ['alpha', 'beta', 'gamma']) put(up, `skills/${id}/SKILL.md`, skill(id));
  // Long enough that an edit near the top and an edit near the bottom merge without a conflict,
  // which is the whole point of the collision test: the dangerous case is the one git resolves.
  put(up, 'targets/thing.js', `${['export const A = 1;', '// the line the fork will change',
    ...Array.from({ length: 20 }, (_, i) => `export const K${i} = ${i};`),
    '// the line upstream will change', 'export const Z = 26;'].join('\n')}\n`);
  put(up, 'package.json', JSON.stringify({ name: '@ericrisco/rsc', version: '1.0.0', bin: { rsc: 'scripts/rsc.js' } }, null, 2));
  put(up, 'LICENSE', 'MIT License\n');
  g(up, ['add', '-A']);
  g(up, ['commit', '-qm', 'upstream 1.0.0']);

  g(root, ['clone', '-q', up, 'fork']);
  const fork = join(root, 'fork');
  g(fork, ['remote', 'rename', 'origin', 'upstream']);
  // The fork's own divergence: it edits a file upstream owns, and adds one of its own.
  put(fork, 'targets/thing.js', readFileSync(join(fork, 'targets', 'thing.js'), 'utf8')
    .replace('// the line the fork will change', '// FORK: the governance line'));
  put(fork, 'scripts/lib/governance-fixture.js', 'export const governed = true;\n');
  g(fork, ['add', '-A']);
  g(fork, ['commit', '-qm', 'fork: governance']);
  return { root, up, fork };
}

/** The upstream release that exercises all four change classes at once. */
function upstreamShipsEverything(up) {
  put(up, 'skills/delta/SKILL.md', skill('delta')); // ADDED
  rmSync(join(up, 'skills', 'beta'), { recursive: true }); // REMOVED
  put(up, 'skills/alpha/SKILL.md', skill('alpha', '\nAnd a paragraph this release adds.\n')); // MODIFIED
  // RENAMED: the same body under a new directory, so git's similarity detection has something real
  // to find — which is all it ever has, because the catalog carries no stable identifier.
  mkdirSync(join(up, 'skills', 'gamma-renamed'), { recursive: true });
  writeFileSync(join(up, 'skills', 'gamma-renamed', 'SKILL.md'), skill('gamma'));
  rmSync(join(up, 'skills', 'gamma'), { recursive: true });
  g(up, ['add', '-A']);
  g(up, ['commit', '-qm', 'upstream 1.1.0: add delta, drop beta, edit alpha, rename gamma']);
}

// ------------------------------------------------------------------ 1. no changes

test('§9.2 — when upstream has nothing new the run says so and prepares nothing', async () => {
  const { fork } = fixture();
  const stateRoot = join(fork, '.state');
  // The fork already contains everything upstream has; only the fork's own commit is ahead.
  const res = await maintain({ repo: fork, stateRoot, check: true, quiet: true });

  assert.equal(res.noChanges, true, 'the run reports that there is nothing to do');
  assert.equal(res.ok, true, 'and that is a success, not a failure');
  assert.match(res.state.phases.survey.summary, /no changes/);
  for (const phase of PHASES.slice(PHASES.indexOf('classify'))) {
    assert.equal(res.state.phases[phase].status, 'skipped', `\`${phase}\` is skipped, with a reason`);
    assert.ok(res.state.phases[phase].summary, `\`${phase}\` says WHY it was skipped`);
  }
  assert.equal(g(fork, ['branch', '--list', 'fork/upstream-*']), '', 'no branch was created');
  assert.ok(renderReport(res.state).includes('Upstream has nothing new'), 'and the report says it in one line');
});

// ------------------------------------------------------------------ 2. the four classes

test('§9.4 — the four change classes are each recognized, from one upstream release', async () => {
  const { up, fork } = fixture();
  upstreamShipsEverything(up);
  const stateRoot = join(fork, '.state');
  const res = await maintain({ repo: fork, stateRoot, check: true, quiet: true });

  assert.equal(res.noChanges, false);
  const k = res.state.phases.classify.data.classification;
  assert.deepEqual(k.added, ['delta', 'gamma-renamed'], 'ADDED: both the new skill and the rename target');
  assert.deepEqual(k.removed, ['beta', 'gamma'], 'REMOVED: both the deletion and the rename source');
  assert.deepEqual(k.modified, ['alpha'], 'MODIFIED');
  assert.deepEqual(k.catalogSize, { base: 3, head: 3 }, 'the catalog is measured at both ends');

  // RENAMED is not a fifth set. It is evidence about a pair that stays in `added` and `removed`.
  assert.equal(k.renameCandidates.length, 1, 'one rename candidate');
  const r = k.renameCandidates[0];
  assert.equal(r.from, 'gamma');
  assert.equal(r.to, 'gamma-renamed');
  assert.ok(r.similarity >= 50, `git reports a similarity (${r.similarity}%)`);
  assert.match(r.disposition, /migration requiring a decision, never an automatic rehome/);
  assert.match(r.caveat, /no stable skill identifier/, 'and says why similarity cannot settle it');
  assert.ok(k.added.includes('gamma-renamed') && k.removed.includes('gamma'),
    'the pair is NOT collapsed: the old name still reports orphaned and the new one is still an addition');

  // The run opens a decision for it, by id, so a resume can see it answered.
  const decision = res.state.decisions.find((d) => d.id === 'rename:gamma->gamma-renamed');
  assert.ok(decision, 'a decision record is opened for the rename');
  assert.equal(decision.answer, null, 'and it is open until somebody answers it');
  assert.match(decision.question, /02-DOCS\/wiki\/skills\/gamma\/README\.md/,
    'naming the customization path that would be stranded');

  // The report states all four, which is what a human reads.
  const report = renderReport(res.state);
  for (const needle of ['| added |', '| removed |', '| modified |', '| rename candidates |']) {
    assert.ok(report.includes(needle), `the report has a row for ${needle}`);
  }
  assert.match(report, /A rename is reported, never applied/);
});

test('§9.4 — a rename produces no rehoming anywhere: not a file, not a key', () => {
  // The maintenance half of criterion 12's rename rule. The transformation side is covered in
  // `governance-upstream-change.test.js`; what is asserted here is that the maintenance output
  // contains nothing that could be mistaken for a resolution.
  const { up, fork } = fixture();
  upstreamShipsEverything(up);
  g(fork, ['fetch', '-q', 'upstream', 'main']);
  const where = lastIncorporated({ cwd: fork });
  const k = classifyCatalogChanges({ cwd: fork, base: where.base, head: where.upstream });

  const serialized = JSON.stringify(k);
  assert.ok(!/rehome|rename_applied|renamedTo"\s*:/.test(serialized.replace(/never an automatic rehome/g, '')),
    'nothing in the classification carries an applied rename');

  // And the governed base of the NEW id points at its own customization path, not the old one.
  const governed = transformSkillMd(skill('gamma-renamed'), 'gamma-renamed');
  const info = governanceOf(governed);
  assert.equal(info.keys['governance-customization'], customizationPathFor('gamma-renamed'));
  assert.ok(!governed.includes(customizationPathFor('gamma')),
    'the delivered skill carries no trace of the old path');
});

// ------------------------------------------------------------------ 3. the clean merge

test('§9 / PLAN §8 — a merge with no textual conflicts does not pass the gate', () => {
  // The rule, as code. `gateVerdict` is handed a perfectly clean merge and nothing else.
  const clean = { textualConflicts: 0, branch: 'fork/upstream-abc', counts: false };
  const verdict = gateVerdict([], { merge: clean });
  assert.equal(verdict.verdict, 'blocked',
    'a clean merge on its own is not a pass — there is no code path by which it could be');
  assert.equal(verdict.merge.counts, false, 'the merge is recorded as evidence that does not count');
  assert.match(verdict.merge.note, /not accepted as proof of functional compatibility/);
  assert.equal(promotable(verdict), false);

  // What does count: the required checks, all of them.
  const allOk = GATE_CHECKS.map((c) => ({ ...c, ok: true }));
  assert.equal(gateVerdict(allOk, { merge: clean }).verdict, 'pass');
  assert.equal(promotable(gateVerdict(allOk, { merge: clean })), true);

  // One failing required check is enough to block, whichever it is.
  for (const id of GATE_CHECKS.filter((c) => c.required).map((c) => c.id)) {
    const results = GATE_CHECKS.map((c) => ({ ...c, ok: c.id !== id }));
    const v = gateVerdict(results, { merge: clean });
    assert.equal(v.verdict, 'blocked', `${id} failing blocks promotion`);
    assert.deepEqual(v.failed, [id]);
  }
});

test('the gate is a real instrument: every check is callable, and one is honestly not instrumented', () => {
  assert.ok(GATE_CHECKS.length >= 11, `${GATE_CHECKS.length} checks`);
  const ids = GATE_CHECKS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate ids');
  for (const c of GATE_CHECKS) {
    assert.equal(typeof c.run, 'function', `${c.id} has a run()`);
    assert.ok(c.title && c.title.length > 20, `${c.id} says what it checks`);
    assert.ok(['deterministic', 'semantic'].includes(c.kind));
  }
  const notInstrumented = GATE_CHECKS.filter((c) => c.required && !c.instrumented);
  assert.equal(notInstrumented.length, 1, 'exactly one required check is not instrumented');
  assert.equal(notInstrumented[0].id, 'G11', 'and it is the semantic evaluation');
  // Decidable is not instrumented: the check must refuse to pass itself.
  const open = notInstrumented[0].run({ classification: { added: ['x'], modified: [] }, acknowledgements: {} });
  assert.equal(open.ok, false, 'with skills in scope and no recorded result, it blocks');
  assert.match(open.detail, /Decidable is not instrumented/);
  const closed = notInstrumented[0].run({
    classification: { added: ['x'], modified: [] },
    acknowledgements: { G11: 'N=3 over x, all cases above threshold' },
  });
  assert.equal(closed.ok, true, 'and passes only on a recorded result');
});

// ------------------------------------------------------------------ 4. divergence points

test('§9.4 — upstream touching a fork divergence is reported HIGH even when the merge is clean', () => {
  const { up, fork } = fixture();
  // Upstream edits the SAME file the fork diverged on, twenty lines away, so git merges it cleanly.
  put(up, 'targets/thing.js', readFileSync(join(up, 'targets', 'thing.js'), 'utf8')
    .replace('// the line upstream will change', '// UPSTREAM: a new comment this release'));
  g(up, ['add', '-A']);
  g(up, ['commit', '-qm', 'upstream edits thing.js']);
  g(fork, ['fetch', '-q', 'upstream', 'main']);

  const where = lastIncorporated({ cwd: fork });
  const surface = divergenceSurface({ cwd: fork, base: where.base });
  assert.deepEqual(surface.modified, ['targets/thing.js'], 'the divergence surface is MEASURED from git');
  assert.deepEqual(surface.added, ['scripts/lib/governance-fixture.js'], 'and separates what the fork only added');

  const upstreamChanged = g(fork, ['diff', '--name-only', `${where.base}..${where.upstream}`]).split('\n');
  const hits = collisions({ surface, upstreamChanged });
  assert.deepEqual(hits.onDivergence, ['targets/thing.js']);
  assert.equal(hits.severity, 'high');
  assert.match(hits.note, /A clean merge here proves nothing/);

  // And the merge really is clean, which is the point: nothing textual would have asked anybody.
  const branch = g(fork, ['rev-parse', '--abbrev-ref', 'HEAD']);
  g(fork, ['merge', '--no-commit', '--no-ff', 'upstream/main'], { allowFail: true });
  assert.equal(g(fork, ['diff', '--name-only', '--diff-filter=U']), '', 'zero textual conflicts');
  g(fork, ['merge', '--abort'], { allowFail: true });
  assert.equal(g(fork, ['rev-parse', '--abbrev-ref', 'HEAD']), branch);
});

test('the intent probes catch a divergence the merge reverted, in both directions', () => {
  // `present` probes: the fragment must survive. `absent` probes: the thing that was REMOVED must
  // stay removed — a trigger cannot be checked by presence.
  //
  // Each fixture carries EVERY present fragment its file is probed for, because `checkProbes`
  // answers for the whole file: a fixture missing one of them would fail for a reason this test is
  // not about, and the failure COUNTS below are what make the assertions exact.
  const identityLine = 'action: `Run `npx @lema017/rsc-governed sync` …`\n';
  const good = `${identityLine}  return bytesOf(join(scopeRoot, '.rsc', 'governance', 'always-on.md'))\n`;
  assert.deepEqual(checkProbes('scripts/doctor.js', good).failures, [], 'intact');
  const reverted = `${identityLine}  return bytesOf(join(scopeRoot, '.rsc', 'skills', 'suggest', 'SKILL.md'));\n`;
  assert.equal(checkProbes('scripts/doctor.js', reverted).failures.length, 1, 'a silent revert is caught');

  const viewLine = '          REGISTRY="$(npm view @lema017/rsc-governed version 2>/dev/null || echo 0.0.0)"\n';
  const yml = `on:\n  workflow_dispatch:\n${viewLine}`;
  assert.deepEqual(checkProbes('.github/workflows/release.yml', yml).failures, [], 'manual-only trigger');
  const restored = `on:\n  push:\n    branches: [main]\n  workflow_dispatch:\n${viewLine}`;
  const failures = checkProbes('.github/workflows/release.yml', restored).failures;
  assert.equal(failures.length, 1, 'a restored push trigger is caught');
  assert.equal(failures[0].found, true, 'and reported as a fragment that reappeared, not one that is missing');
  assert.match(failures[0].probe.why, /merging must never publish by itself/);
});

test('the probe table covers the divergence surface AS MEASURED TODAY, and G7 fails on an unprobed one', () => {
  // THE SURFACE IS MEASURED HERE, NOT QUOTED HERE. The previous version of this test listed the
  // eight files by name, which was already the third number this fork has believed: `ARCHITECTURE`
  // §4 said "3 archivos y 4 puntos", its CORRECCIÓN 5 measured 8, and stages 2, 5 and 6 plus D16
  // took it past fifty. A list in a test goes stale exactly like a list in a document, except that
  // it goes stale GREEN — the assertion keeps passing over the files it still names while the ones
  // it never heard of go unwatched. That is the shape of defect this whole check exists to catch,
  // so the list comes from git, every run, and the test fails when the table falls behind it.
  //
  // Measured against the WORKING TREE, which is what G7 reads: a divergence a human has just
  // written and not committed is a divergence, and it is the one most likely to be unprobed.
  const where = lastIncorporated({ cwd: ROOT });
  assert.ok(where.base, `premise: the incorporated base is measurable offline (${where.error || ''})`);
  const live = divergenceSurface({ cwd: ROOT, base: where.base });
  assert.equal(live.ok, true, 'premise: the surface measures');
  assert.ok(live.modified.length >= 50, `premise: the surface is the big one (${live.modified.length})`);

  const unprobed = live.modified.filter((f) => !DIVERGENCE_PROBES[f]);
  assert.deepEqual(unprobed, [],
    `every MEASURED divergence must carry an intent probe; these have none: ${unprobed.join(', ')}`);

  for (const file of live.modified) {
    assert.ok(DIVERGENCE_PROBES[file].length >= 1);
    for (const probe of DIVERGENCE_PROBES[file]) {
      assert.ok(['present', 'absent'].includes(probe.kind));
      assert.ok(probe.fragment && probe.fragment.length > 5, `${file}: the probe quotes a fragment`);
      assert.ok(probe.why && probe.why.length > 20, `${file}: the probe says what the divergence is FOR`);
      // Never a line number: lines move, and a probe anchored to one reports a reformat as a
      // reverted intent. Four review chains in this project's history tripped over that.
      assert.ok(!/^\s*\d+\s*$/.test(probe.fragment), `${file}: a probe is a fragment, never a line number`);
    }
    // And the probes for this file must actually MATCH it right now. A table whose fragments have
    // drifted off the files is a table that fails G7 for the wrong reason, and the next maintainer
    // learns to read a red G7 as noise.
    const r = checkProbes(file, readFileSync(join(ROOT, file), 'utf8'));
    assert.deepEqual(r.failures, [], `${file}: its own probes must pass against the file as it is today`);
  }

  // THE ADDED HALF IS DELIBERATELY NOT PROBED, and that claim is checked rather than asserted in a
  // comment. An upstream merge cannot revert a file the fork added: upstream has no version of it,
  // so there is no text for it to win. What it can do is CREATE the same path, and that is
  // instrumented by `collisions()` as `onForkAdded`. A probe entry for those files would check that
  // a file the fork wrote still says what the fork wrote — a check that cannot fail.
  assert.ok(live.added.length >= 20, `premise: the fork really did add files (${live.added.length})`);
  const probedAdded = live.added.filter((f) => DIVERGENCE_PROBES[f]);
  assert.deepEqual(probedAdded, [], 'fork-added files carry no intent probe, by argument');
  const hit = collisions({ surface: live, upstreamChanged: [live.added[0]] });
  assert.deepEqual(hit.onForkAdded, [live.added[0]], 'but an upstream path collision on one IS reported');
  assert.equal(hit.severity, 'medium');

  // A new divergence with no probe is not silently unwatched: G7 reports it as a failure. The file
  // chosen exists, is upstream's, and carries no probe — which is exactly what a newly diverged
  // file looks like in the minute before somebody writes its probe.
  const g7 = GATE_CHECKS.find((c) => c.id === 'G7');
  assert.ok(existsSync(join(ROOT, UNPROBED_UPSTREAM_FILE)) && !DIVERGENCE_PROBES[UNPROBED_UPSTREAM_FILE],
    'premise: this file exists and carries no probe');
  assert.ok(!live.modified.includes(UNPROBED_UPSTREAM_FILE),
    'premise: and it is not itself a divergence, or this negative case would be vacuous');
  const out = g7.run({
    cwd: ROOT,
    surface: {
      ok: true,
      modified: ['scripts/install-apply.js', UNPROBED_UPSTREAM_FILE],
      measuredAgainst: 'working tree',
    },
  });
  assert.equal(out.ok, false);
  assert.match(out.detail, /no intent probe/);
  assert.deepEqual(out.measured.unprobed, [UNPROBED_UPSTREAM_FILE]);

  // And a file in the table that has vanished from the tree is its own, differently-named failure.
  const gone = g7.run({ cwd: ROOT, surface: { ok: true, modified: ['targets/removed-by-a-merge.js'] } });
  assert.equal(gone.ok, false);
  assert.match(gone.detail, /file gone/);
});

test('G7 passes over the live divergence surface, and names the file when one divergence is broken', () => {
  // The green and the red, measured against the same real tree in the same test, because a check
  // that has only ever been seen passing has not been seen working. `decidible ≠ instrumentado`.
  const where = lastIncorporated({ cwd: ROOT });
  const live = divergenceSurface({ cwd: ROOT, base: where.base });
  const g7 = GATE_CHECKS.find((c) => c.id === 'G7');

  const green = g7.run({ cwd: ROOT, surface: live });
  assert.equal(green.ok, true, green.detail);
  assert.match(green.detail, /divergence\(s\) intact/);
  assert.equal(green.measured.files.length, live.modified.length);
  assert.equal(green.measured.unprobed.length, 0);

  // The mutation: the same run against a tree where ONE divergence has been reverted. Done on a
  // copy of the file in a scratch root rather than on the real one, so a crash cannot leave the
  // repository broken — and `cwd` is what G7 resolves its paths against, so the substitution is the
  // real code path, not a stub.
  const scratch = mkdtempSync(join(tmpdir(), 'g7-mutate-'));
  try {
    const file = 'targets/claude.js';
    const probe = DIVERGENCE_PROBES[file].find((p) => p.kind === 'present');
    const reverted = readFileSync(join(ROOT, file), 'utf8').split(probe.fragment).join('// REVERTED BY UPSTREAM');
    mkdirSync(join(scratch, 'targets'), { recursive: true });
    writeFileSync(join(scratch, file), reverted);
    // Every other file in the surface is left where G7 cannot find it, which would be reported as
    // `file gone`; so the mutation run is scoped to the one file, which is also how a real report
    // reads when a merge touches one divergence.
    const red = g7.run({ cwd: scratch, surface: { ok: true, modified: [file], measuredAgainst: 'working tree' } });
    assert.equal(red.ok, false, 'a reverted divergence must fail G7');
    assert.match(red.detail, /targets\/claude\.js/, 'and the report must NAME the file');
    assert.match(red.detail, /intent fragment missing/);
    assert.equal(red.measured.failures, 1);
    assert.equal(red.measured.unprobed.length, 0, 'this is a reverted divergence, not an unwatched one');
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('the identity probes are two-sided, so neither a revert nor a re-introduction can pass', () => {
  // ~40 of the divergences are the D16 rename and nothing else. `present` alone would miss an
  // upstream merge that ADDS a line naming the parent next to the renamed one, which is the §10
  // accident stage 6 measured; `absent` alone would miss the revert. Both, or neither bites.
  const pairs = Object.entries(DIVERGENCE_PROBES)
    .filter(([, probes]) => probes.some((p) => p.kind === 'absent' && p.fragment === PARENT_PACKAGE));
  assert.ok(pairs.length >= 40, `the rename is the bulk of the surface (${pairs.length})`);
  for (const [file, probes] of pairs) {
    const present = probes.filter((p) => p.kind === 'present');
    assert.ok(present.length >= 1, `${file}: an absent-parent probe needs a present-fork counterpart`);
    assert.ok(present.some((p) => p.fragment.includes(FORK_PACKAGE)
      || p.fragment.includes('rsc-governed') || /\brscg\b/.test(p.fragment)),
    `${file}: the present side must quote the FORK's own name or binary, not just any fragment`);
  }
  // Both sides fire, on real bytes.
  const text = readFileSync(join(ROOT, 'scripts/lib/upgrade.js'), 'utf8');
  assert.deepEqual(checkProbes('scripts/lib/upgrade.js', text).failures, [], 'intact');
  const reverted = text.split(FORK_PACKAGE).join(PARENT_PACKAGE);
  const back = checkProbes('scripts/lib/upgrade.js', reverted).failures;
  assert.equal(back.length, 2, 'a revert trips BOTH sides: the fork token is gone and the parent is back');
  assert.deepEqual(back.map((f) => f.found).sort(), [false, true]);
  // And the subtler one: the rename survives, but a merge re-introduces the parent beside it.
  const added = `${text}\n// npx ${PARENT_PACKAGE}@latest install\n`;
  const crept = checkProbes('scripts/lib/upgrade.js', added).failures;
  assert.equal(crept.length, 1, 'the present side still passes, and the absent side catches it');
  assert.equal(crept[0].found, true);
});

// ------------------------------------------------------------------ 5. resumability

test('§9 — the journal is on disk, and an interrupted run continues from the phase it died in', async () => {
  const { up, fork } = fixture();
  upstreamShipsEverything(up);
  const stateRoot = join(fork, '.state');

  const first = await maintain({ repo: fork, stateRoot, check: true, quiet: true });
  const file = statePath(stateRoot, first.runId);
  assert.ok(existsSync(file), `the journal is a file on disk: ${file}`);
  assert.ok(existsSync(join(stateRoot, 'latest')), 'and a pointer `--resume` can follow with no id');

  // Simulate the crash the journal exists for: `classify` was running when the process died, so
  // disk says `running` and its data is gone.
  const crashed = JSON.parse(readFileSync(file, 'utf8'));
  const surveyBefore = crashed.phases.survey.data;
  crashed.phases.classify = {
    status: 'running', startedAt: new Date().toISOString(), endedAt: null, summary: null, data: null,
  };
  writeFileSync(file, `${JSON.stringify(crashed, null, 2)}\n`);

  const resumed = await maintain({ repo: fork, stateRoot, resume: first.runId, check: true, quiet: true });
  assert.equal(resumed.runId, first.runId, 'the same run, not a new one');
  assert.equal(resumed.state.phases.survey.status, 'done', 'the completed phase was not redone');
  assert.deepEqual(resumed.state.phases.survey.data.base, surveyBefore.base,
    'and its measurement survived the interruption');
  assert.equal(resumed.state.phases.classify.status, 'done', 'the interrupted phase ran again');
  assert.ok(resumed.state.phases.classify.data.classification, 'and produced its data this time');

  // `--resume` with no id follows the pointer to the same run.
  const byPointer = await maintain({ repo: fork, stateRoot, resume: true, check: true, quiet: true });
  assert.equal(byPointer.runId, first.runId);
});

test('a `running` phase is reset to `pending` on resume, never assumed finished', () => {
  const state = newRun({ repo: '/x', authorization: 'publish' });
  beginPhase(state, 'survey');
  assert.equal(state.phases.survey.status, 'running');
  const reset = resumeRun(state);
  assert.deepEqual(reset, ['survey'], 'the phase that was running is the phase that re-runs');
  assert.equal(state.phases.survey.status, 'pending');
  assert.equal(nextPhase(state), 'survey');
});

test('a corrupt journal is an error, never a fresh run', () => {
  const stateRoot = mkdtempSync(join(tmpdir(), 'rsc-maint-state-'));
  const state = newRun({ repo: '/x', authorization: 'survey', runId: 'run-1' });
  saveRun(state, { stateRoot });
  // Truncated the way an interrupted write would have truncated it, had the write not been atomic.
  writeFileSync(statePath(stateRoot, 'run-1'), '{"schema":1,"runId":"run-1","pha');
  const loaded = loadRun({ stateRoot, runId: 'run-1' });
  assert.ok(loaded.error, 'reported as an error');
  assert.match(loaded.error, /not readable JSON/);
  assert.match(loaded.error, /An unreadable journal is not an absent one/);
  assert.equal(loaded.state, undefined, 'and no state is invented to carry on with');

  // A journal from a future schema is also an error rather than a guess.
  saveRun({ ...newRun({ repo: '/x', runId: 'run-2' }), schema: 999 }, { stateRoot });
  assert.match(loadRun({ stateRoot, runId: 'run-2' }).error, /schema 999/);
});

test('the state file is written atomically, so no run directory is left holding a half-written journal', () => {
  const stateRoot = mkdtempSync(join(tmpdir(), 'rsc-maint-atomic-'));
  const state = newRun({ repo: '/x', authorization: 'survey', runId: 'run-a' });
  saveRun(state, { stateRoot });
  const files = readdirSync(join(stateRoot, 'run-a'));
  assert.deepEqual(files, ['state.json'], 'the temporary file is renamed away, never left behind');
  assert.ok(JSON.parse(readFileSync(statePath(stateRoot, 'run-a'), 'utf8')), 'and what is there parses');
});

// ------------------------------------------------------------------ 6. authorization

test('§9.10 — authorization is a ceiling checked per phase, and publishing needs a passing gate', async () => {
  assert.deepEqual(phasesAllowedBy('survey'), ['survey', 'classify']);
  assert.ok(!scopeAllows('integrate', 'validate'), 'integrating does not authorize validating');
  assert.ok(!scopeAllows('validate', 'publish'), 'validating does not authorize publishing');
  assert.ok(scopeAllows('publish', 'publish'));
  assert.deepEqual(phasesAllowedBy('publish'), [...PHASES], 'only the widest scope reaches every phase');

  const state = newRun({ repo: '/x', authorization: 'integrate' });
  for (const phase of ['validate', 'evaluate', 'remediate', 'evidence', 'publish']) {
    assert.equal(state.phases[phase].status, 'skipped');
    assert.match(state.phases[phase].summary, /not authorized for this run/);
  }
  // Widening the scope on a resume reopens them; narrowing closes them again.
  resumeRun(state, { authorization: 'publish' });
  assert.equal(state.phases.validate.status, 'pending');
  resumeRun(state, { authorization: 'survey' });
  assert.equal(state.phases.validate.status, 'skipped');
  assert.equal(state.authorizationHistory.length, 3, 'and every grant is recorded with its moment');

  // A run that cannot reach a passing verdict cannot publish, whatever it was authorized to do.
  const { up, fork } = fixture();
  upstreamShipsEverything(up);
  const res = await maintain({
    repo: fork, stateRoot: join(fork, '.state'), authorize: 'survey', check: true, quiet: true,
  });
  assert.equal(res.state.publication.status, 'not-authorized');
  assert.ok(AUTH_SCOPES.indexOf(res.state.authorization) < AUTH_SCOPES.indexOf('publish'));
});

// ------------------------------------------------------------------ 7. deletion and RETIRED_SKILLS

test('Stage 4 proposal 1 — the base of a deleted skill is NOT pruned unless its id is in RETIRED_SKILLS', async () => {
  // Stated so nobody reads a guarantee into it. `install-apply.js` prunes a shared base only for an
  // id that `isRetired` recognizes, and that map is hand-written, so a skill upstream deletes today
  // leaves a GOVERNED base behind on every consumer's disk until a human adds the entry.
  assert.equal(isRetired('flutter'), false, 'a live skill is not retired');
  assert.equal(isRetired('eli5'), true, 'a retired one is');

  // And the consequence is what G10 reports, rather than something the run fixes by itself.
  const g10 = GATE_CHECKS.find((c) => c.id === 'G10');
  const blocked = await g10.run({ cwd: ROOT, classification: { removed: ['flutter'] }, acknowledgements: {} });
  assert.equal(blocked.ok, false, 'an unregistered removal blocks promotion');
  assert.match(blocked.detail, /keeps a GOVERNED base/, 'and names the consequence on the consumer');
  assert.match(blocked.detail, /Add the entry by hand/);
  assert.match(blocked.detail, /new divergence/, 'and that the entry is a new divergence with upstream');
  assert.deepEqual(blocked.measured.unregistered, ['flutter']);

  const head = g(ROOT, ['rev-parse', 'HEAD']);
  const acked = await g10.run({
    cwd: ROOT, classification: { removed: ['flutter'] }, acknowledgements: { G10: `added in commit ${head}` },
  });
  assert.equal(acked.ok, true, 'and clears only on a recorded acknowledgement');
  assert.ok(!/Add the entry by hand/.test(acked.detail),
    'and a PASS does not print the failure branch\'s fix instruction (the detail used to be built '
    + 'unconditionally and then have " — acknowledged" appended)');

  const registered = await g10.run({ cwd: ROOT, classification: { removed: ['eli5'] }, acknowledgements: {} });
  assert.equal(registered.ok, true, 'an id already in the map needs nothing');
});

test('Stage 4 proposal 1, measured — a `null` successor cannot be added to RETIRED_SKILLS as written', () => {
  // The proposal asks for the id to be recorded "con su sucesor o con `null` si no lo hay". Measured
  // rather than assumed: `replaceRetired` maps every declared skill list through this table, so a
  // null value does not mean "no successor", it means a `null` lands in the list of skill ids.
  assert.ok(Object.values(RETIRED_SKILLS).every((v) => typeof v === 'string'),
    'every successor today is a string, which is the invariant `replaceRetired` depends on');
  assert.deepEqual(replaceRetired(['eli5', 'flutter']), ['orient', 'flutter'], 'the mapping, as it works today');

  const withNull = Object.freeze({ ...RETIRED_SKILLS, vanished: null });
  const retiredTo = (id) => (Object.hasOwn(withNull, id) ? withNull[id] : id);
  const out = [...new Set(['flutter', 'vanished'].map(retiredTo))];
  assert.deepEqual(out, ['flutter', null],
    'a null successor injects `null` into the skill id list — so expressing "it just disappeared" '
    + 'needs `replaceRetired` changed too, which is why this run proposes the entry instead of writing it');
});

// ------------------------------------------------------------------ 8. attribution

test('§9 — a new vendored subtree is reported as an attribution obligation, and blocks until acknowledged', () => {
  const { up, fork } = fixture();
  put(up, 'skills/alpha/vendor/UPSTREAM.json', JSON.stringify({
    repository: 'https://github.com/someone/thing', commit: 'deadbeef', license: 'MIT', modified: false,
  }, null, 2));
  put(up, 'skills/alpha/vendor/LICENSE', 'MIT License\n\nCopyright (c) 2026 Someone\n');
  put(up, 'skills/alpha/THIRD_PARTY.md', '# Third party\n\n- someone/thing (MIT)\n');
  g(up, ['add', '-A']);
  g(up, ['commit', '-qm', 'upstream vendors a kit']);
  g(fork, ['fetch', '-q', 'upstream', 'main']);
  const where = lastIncorporated({ cwd: fork });

  const d = attributionDelta({ cwd: fork, base: where.base, head: where.upstream });
  assert.deepEqual(d.added, [
    'skills/alpha/THIRD_PARTY.md', 'skills/alpha/vendor/LICENSE', 'skills/alpha/vendor/UPSTREAM.json',
  ]);
  assert.deepEqual(d.newVendored, ['skills/alpha/vendor'], 'the new vendored subtree is named');
  assert.equal(d.upstreamJson['skills/alpha/vendor/UPSTREAM.json'].license, 'MIT',
    'and its declared licence is read, not guessed');
  assert.match(d.obligation, /must be updated/);

  const g6 = GATE_CHECKS.find((c) => c.id === 'G6');
  assert.equal(g6.run({ cwd: ROOT, attribution: d, acknowledgements: {} }).ok, false,
    'a clean merge and a green suite both miss this; the gate does not');
  assert.equal(g6.run({
    cwd: ROOT, attribution: d, acknowledgements: { G6: 'recorded in README.md and docs/fork/PLAN.md' },
  }).ok, true);
  assert.equal(g6.run({ attribution: { added: [], removed: [], changed: [], newVendored: [] } }).ok, true,
    'and it says nothing when no notice changed');

  // The same function, over the real catalog: the three vendored subtrees this fork actually ships.
  const real = vendoredSubtrees(ROOT, 'HEAD');
  assert.ok(real.includes('skills/design/engine') && real.includes('skills/ux/upstream'),
    `the two subtrees PLAN §3 freezes are found by measurement: ${real.join(', ')}`);
});

// ------------------------------------------------------------------ 9. the test subset

test('§11 — the impacted test subset is derived, and the two declared exclusions hold', () => {
  const always = impactedTests({ cwd: ROOT, upstreamChanged: [], classification: null });
  const net = alwaysRunFiles(ROOT).files;
  assert.equal(alwaysRunFiles(ROOT).error, null, 'and the enumeration reports its own health');
  assert.ok(net.length >= 7, `the fork's governance suite is DERIVED from the tree, not listed: ${net.length} file(s)`);
  assert.ok(net.includes('tests/governance-upstream-maintenance.test.js'), 'including this one');
  for (const file of net) {
    assert.ok(always.includes(file), `${file} runs on every pass: LEDGER §2n measured that ZERO inherited tests notice governance disappearing`);
  }

  // A catalog change pulls in the readers; a changed skill pulls in its own test file.
  const withCatalog = impactedTests({
    cwd: ROOT,
    upstreamChanged: ['skills/connect-tool/SKILL.md', 'tests/connect-tool.test.js'],
    classification: { added: [], removed: [], modified: ['connect-tool'] },
  });
  assert.ok(withCatalog.includes('tests/connect-tool.test.js'), 'the test upstream itself changed');
  assert.ok(withCatalog.includes('tests/skill-lint.test.js'), 'and the catalog readers');
  assert.ok(withCatalog.length > always.length);

  // The measured half: a changed source file pulls in the tests that mention it by basename.
  const bySource = impactedTests({ cwd: ROOT, upstreamChanged: ['targets/knowledge-sync.mjs'], classification: null });
  assert.ok(bySource.some((f) => f.includes('knowledge-sync')),
    `found by grep rather than by a hand-maintained mapping: ${bySource.filter((f) => f.includes('knowledge')).join(', ')}`);

  // Never run, and the reason travels with it.
  for (const never of NEVER_RUN) {
    assert.ok(!withCatalog.includes(never.file), `${never.file} is not run`);
    assert.match(never.reason, /dedicated folder|REQUIREMENTS §1/, 'and says why, so "not verified" never reads as "passed"');
  }

  // Preexisting failures are declared with provenance, not excused anonymously.
  assert.ok(KNOWN_FAILURES.length >= 3);
  for (const k of KNOWN_FAILURES) {
    assert.ok(k.reason.length > 20, `${k.file} declares where its failure was established`);
    assert.ok(k.match instanceof RegExp);
  }
  // A NEW failure is not covered by any of them.
  const tap = '# tests 3\n# pass 2\n# fail 1\n# cancelled 0\nnot ok 1 - something nobody declared\n';
  const parsed = parseTap(tap);
  assert.deepEqual(parsed.failed, ['something nobody declared']);
  assert.equal(parsed.fail, 1);
  assert.ok(!KNOWN_FAILURES.some((k) => k.match.test(parsed.failed[0])), 'so it would block');
});

// ------------------------------------------------------------------ 10. network and credentials

test('§1 / §14 — every git invocation is anonymous, and a URL never carries a secret into a report', () => {
  // Asserted on the computed command and environment rather than by running something: the point
  // is that no credential is ever OFFERED, which a successful anonymous fetch would not prove.
  const flags = ANONYMOUS_GIT_FLAGS.join(' ');
  assert.match(flags, /credential\.helper=(?!\S)/, 'the credential helper is cleared per invocation');
  assert.match(flags, /credential\.interactive=false/);
  assert.match(flags, /core\.askPass=(?!\S)/);

  const env = anonymousGitEnv({
    GIT_ASKPASS: '/usr/bin/some-helper', SSH_ASKPASS: '/x', GIT_CREDENTIAL_HELPER: 'store', PATH: '/usr/bin',
  });
  assert.equal(env.GIT_TERMINAL_PROMPT, '0', 'no terminal prompt');
  assert.ok(!('GIT_ASKPASS' in env) && !('SSH_ASKPASS' in env) && !('GIT_CREDENTIAL_HELPER' in env),
    'and the askpass hooks are removed rather than pointed somewhere');
  assert.equal(env.PATH, '/usr/bin', 'everything else is inherited');

  assert.equal(redactUrl('https://user:token@github.com/o/r.git'), 'https://<redacted>@github.com/o/r.git');
  assert.equal(redactUrl('https://github.com/o/r.git'), 'https://github.com/o/r.git', 'and a clean URL is untouched');
});

test('§9.1 — the remote is probed without fetching, and a missing remote is named not guessed', () => {
  const { fork } = fixture();
  assert.equal(hasRemote(fork, 'upstream'), true);
  assert.equal(hasRemote(fork, 'nope'), false);

  const before = g(fork, ['rev-parse', 'upstream/main']);
  const probe = probeRemote({ cwd: fork, remote: 'upstream', ref: 'main' });
  assert.equal(probe.reachable, true);
  assert.match(probe.head, /^[0-9a-f]{40}$/, 'the probe returns the remote head');
  assert.equal(g(fork, ['rev-parse', 'upstream/main']), before,
    'and wrote nothing: the remote-tracking ref is unchanged, which is what makes --check read-only');

  const missing = probeRemote({ cwd: fork, remote: 'absent', ref: 'main' });
  assert.equal(missing.reachable, false);
  assert.match(missing.error, /no remote named `absent`/);
  assert.match(missing.error, /git remote add upstream/, 'and says how to fix it');
});

test('§9.1 — offline works from the local ref and records the real fetch as NOT VERIFIED', async () => {
  const { up, fork } = fixture();
  upstreamShipsEverything(up);
  g(fork, ['fetch', '-q', 'upstream', 'main']);
  // The remote is now unreachable, which is the situation `--offline` exists for.
  g(fork, ['remote', 'set-url', 'upstream', join(up, 'does-not-exist')]);

  const res = await maintain({
    repo: fork, stateRoot: join(fork, '.state'), check: true, offline: true, quiet: true,
  });
  assert.equal(res.ok, true, 'the run still classifies, from the local remote-tracking ref');
  assert.equal(res.state.phases.survey.data.fetched, false);
  assert.match(res.state.phases.survey.data.note, /NOT VERIFIED: the real fetch/,
    'and never reads as a run that found nothing');
  assert.ok(res.state.phases.classify.data.classification.added.includes('delta'));

  // Without --offline the same repository fails loudly rather than silently reporting "no changes".
  const online = await maintain({ repo: fork, stateRoot: join(fork, '.state2'), check: true, quiet: true });
  assert.equal(online.ok, false);
  assert.equal(online.state.phases.survey.status, 'failed');
  assert.match(online.state.phases.survey.summary, /cannot reach `upstream` anonymously/);
  assert.match(online.state.phases.survey.summary, /--offline/, 'and offers the honest alternative');
});

test('§9.1 — unrelated histories block, and a rebase is only detectable against a recorded base', async () => {
  const { up, fork } = fixture();
  const incorporated = g(fork, ['rev-parse', 'upstream/main']);

  // (a) Upstream replaces its history outright. No merge base exists at all.
  g(up, ['checkout', '-q', '--orphan', 'rewritten']);
  put(up, 'skills/alpha/SKILL.md', skill('alpha'));
  g(up, ['add', '-A']);
  g(up, ['commit', '-qm', 'rewritten history']);
  g(up, ['branch', '-M', 'rewritten', 'main'], { allowFail: true });

  const res = await maintain({ repo: fork, stateRoot: join(fork, '.state'), check: true, quiet: true });
  assert.equal(res.ok, false);
  assert.equal(res.state.phases.survey.status, 'blocked');
  assert.match(res.state.phases.survey.summary, /shares no history/);
  assert.match(res.state.phases.survey.summary, /a decision, not an integration/);
  assert.equal(res.state.phases.survey.data.unrelated, true);

  // (b) The subtler one. A rebase leaves a merge base behind — an earlier one — and the merge base
  // is an ancestor of the new head BY DEFINITION, so no measurement of it can ever reveal the
  // rewrite. It is visible only against a base somebody recorded, which is what `--base` is for.
  const { up: up2, fork: fork2 } = fixture();
  upstreamShipsEverything(up2); // a second upstream commit, so amending it leaves a shared ancestor
  g(fork2, ['fetch', '-q', 'upstream', 'main']);
  const released = g(fork2, ['rev-parse', 'upstream/main']);
  put(up2, 'skills/delta/SKILL.md', skill('delta', '\nan amended body\n'));
  g(up2, ['add', '-A']);
  g(up2, ['commit', '-q', '--amend', '-m', 'upstream 1.1.0 (amended)']);
  g(fork2, ['fetch', '-q', '--force', 'upstream', 'main']);

  const blind = lastIncorporated({ cwd: fork2 });
  assert.equal(blind.unrelated, false, 'a rebase still leaves a shared ancestor');
  assert.equal(blind.rewritten, false,
    'and with nothing recorded the rewrite is INVISIBLE: the merge base is an ancestor of the new '
    + 'head by definition, so no measurement of it could reveal one. Stated, not promised');
  const seeing = lastIncorporated({ cwd: fork2, recorded: released });
  assert.equal(seeing.rewritten, true, 'and visible the moment a recorded base is supplied');
  assert.notEqual(incorporated, g(fork2, ['rev-parse', 'upstream/main']));
});

// ------------------------------------------------------------------ 11. the report

test('§9.9 — the evidence names what was not done, including the decisions still open', async () => {
  const { up, fork } = fixture();
  upstreamShipsEverything(up);
  const res = await maintain({ repo: fork, stateRoot: join(fork, '.state'), check: true, quiet: true });
  recordDecision(res.state, { id: 'probe', kind: 'test', question: 'is this open?' });
  const report = renderReport(res.state, { stateRoot: join(fork, '.state') });

  assert.match(report, /## Decisions this run needs/);
  assert.match(report, /\*\*probe\*\* \(test\): is this open\? — \*\*open\*\*/, 'an open decision is marked open');
  assert.match(report, /rename:gamma->gamma-renamed/, 'and the rename migration is one of them');
  assert.match(report, /## Phases/);
  for (const phase of PHASES) assert.ok(report.includes(`| ${phase} |`), `${phase} has a row, done or not`);
  assert.match(report, /resume with `--resume/, 'and the report says how to continue the run');
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 12. The corrections the independent review of stage 5 required.
//
// Every test below fails without its fix. They are grouped by the finding they answer, and the
// shared theme of the three ALTA is the one this stage failed to apply to itself: A MEASUREMENT
// THAT DID NOT HAPPEN IS NOT A MEASUREMENT OF ZERO. `[]` is truthy, an absent context entry and an
// entry that measured nothing are the same value, and a check that cannot fail reports exactly what
// a check that passed reports.
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * A source file with its comments removed.
 *
 * The two assertions below check that a shape is GONE from the code, and this file's fixes are
 * commented with the code they replaced — so matching raw source matched the explanation of the
 * bug and reported the bug as still present. Asserting on code means asserting on code.
 */
function codeOnly(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
}

/** A git repository with one trivial test file, for exercising the real test runner cheaply. */
function tinyRepo({ withTests = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rsc-maint-tiny-'));
  g(dir, ['init', '-q', '-b', 'main']);
  if (withTests) {
    put(dir, 'tests/governance-ok.test.js', "import { test } from 'node:test';\ntest('ok', () => {});\n");
  }
  put(dir, 'package.json', JSON.stringify({ name: 'tiny', version: '1.0.0' }, null, 2));
  g(dir, ['add', '-A']);
  g(dir, ['commit', '-qm', 'tiny']);
  return dir;
}

// ── A1 · the divergence surface: measured, unmeasured, and absent are three states ───────────

test('A1 · G7 FAILS when the divergence surface could not be measured, instead of reporting zero', () => {
  // The measured bug, verbatim: `divergenceSurface` with an unresolvable base returns
  // `{ ok: false, modified: [] }`, and G7 read `ctx.surface?.modified || Object.keys(PROBES)` —
  // which never reached the fallback, because `[]` is truthy. The gate answered
  // `PASS G7 "0 divergence(s) intact"` and the report then printed "upstream did not touch the
  // fork's divergence surface": a reassurance computed from a git failure, in a committed file.
  const failed = divergenceSurface({ cwd: ROOT, base: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' });
  assert.equal(failed.ok, false, 'premise: the measurement failed');
  assert.deepEqual(failed.modified, [], 'premise: and still returned an empty array, which is truthy');

  const g7 = GATE_CHECKS.find((c) => c.id === 'G7');
  const out = g7.run({ cwd: ROOT, surface: failed });
  assert.equal(out.ok, false, 'an unmeasured surface is a FAILURE, never zero divergences');
  assert.match(out.detail, /could not be MEASURED/);
  assert.equal(out.measured.surface, 'unmeasured');
  assert.ok(!/intact/.test(out.detail), 'and the word "intact" appears nowhere near it');
});

test('A1 · G7 tells "nobody measured" apart from "measured, and the answer is zero"', () => {
  const g7 = GATE_CHECKS.find((c) => c.id === 'G7');

  const absent = g7.run({ cwd: ROOT });
  assert.equal(absent.ok, false, 'no surface at all is a wiring failure, not an absence of divergences');
  assert.equal(absent.measured.surface, 'absent');
  assert.match(absent.detail, /no divergence surface was handed to this check/);

  // The third state, and the only one that may pass: git answered, and the answer is that this fork
  // has modified nothing upstream owns. The old `||` could not express this at all.
  const zero = g7.run({ cwd: ROOT, surface: { ok: true, modified: [], measuredAgainst: 'working tree' } });
  assert.equal(zero.ok, true, 'a measurement of zero is a pass');
  assert.equal(zero.measured.surface, 'measured');
  assert.match(zero.detail, /0 divergence\(s\) intact, measured against the working tree/,
    'and says what it was measured against, so the number is never read on trust');
});

test('A1 · the `classify` phase refuses to continue on a surface it could not measure', async () => {
  // Driven through the journal the way the crash test does, because that is the only honest way to
  // get a valid `survey` and a broken base: the run records its base, the base becomes
  // unresolvable, and `classify` re-runs on resume.
  const { up, fork } = fixture();
  upstreamShipsEverything(up);
  const stateRoot = join(fork, '.state');
  const first = await maintain({ repo: fork, stateRoot, check: true, quiet: true });
  assert.equal(first.state.phases.classify.data.surface.ok, true, 'premise: it measures on a healthy tree');

  const file = statePath(stateRoot, first.runId);
  const journal = JSON.parse(readFileSync(file, 'utf8'));
  journal.phases.survey.data.base = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
  journal.phases.classify = {
    status: 'running', startedAt: new Date().toISOString(), endedAt: null, summary: null, data: null,
  };
  writeFileSync(file, `${JSON.stringify(journal, null, 2)}\n`);

  const res = await maintain({ repo: fork, stateRoot, resume: first.runId, check: true, quiet: true });
  assert.equal(res.ok, false);
  assert.equal(res.state.phases.classify.status, 'failed',
    'the phase fails rather than handing a zero-length surface to everything downstream');
  assert.match(res.state.phases.classify.summary, /divergence surface could not be measured/);
  assert.match(res.state.phases.classify.summary, /not a surface measuring zero/);
});

// ── A2 · REQUIREMENTS §1: nothing is written outside the dedicated folder ────────────────────

test('A2 · §1 — the gate\'s disposable trees are rooted in the repository, never in a literal /tmp', async () => {
  // The most serious finding of the review, because it is the user's own constraint broken by code
  // that ships: `mkdtempSync(join(tmpdir(), …))` is a literal `/tmp` whenever `TMPDIR` is not
  // exported, and it ran on EVERY gate execution — `phaseGovern` plus G3, G4 and G5. The same file
  // excludes `tests/eval-lint.test.js` from ever running, with the reason "writes to a literal /tmp
  // outside the dedicated folder (limit L2, REQUIREMENTS §1)".
  assert.ok(!SCRATCH_DIR.startsWith('/'), `${SCRATCH_DIR} is relative, so it can only ever be inside a tree`);

  const dir = tinyRepo({ withTests: false });
  const root = scratchRoot(dir);
  assert.equal(root, join(dir, SCRATCH_DIR), 'the root is derived from the tree under audit');
  assert.ok(existsSync(root), 'and created');

  // The real thing: a real install, and both disposable trees land under the repository.
  const result = await scopedConformance({ cwd: ROOT, ids: [] });
  for (const [label, path] of [['project', result.project], ['home', result.home]]) {
    assert.ok(path.startsWith(join(ROOT, SCRATCH_DIR)),
      `the disposable ${label} is inside the dedicated folder: ${path}`);
    assert.ok(!path.startsWith('/tmp/') && !path.startsWith('/private/tmp/'),
      `and not in a literal /tmp: ${path}`);
  }
  // `applyInstall` is handed `home` explicitly and `install-apply.js` never calls `homedir()`, so
  // the user's real `~/.claude` is unreachable from here. Asserted, not assumed.
  const installer = readFileSync(join(ROOT, 'scripts', 'install-apply.js'), 'utf8');
  assert.ok(!/homedir\s*\(/.test(installer), 'the installer resolves no home of its own');

  // And this module imports nothing that could reach the system temporary directory.
  const gate = codeOnly(readFileSync(join(ROOT, 'scripts', 'lib', 'upstream-gate.js'), 'utf8'));
  assert.ok(!/node:os/.test(gate) && !/tmpdir\s*\(/.test(gate),
    'the gate engine has no path to `os.tmpdir()` at all, so the regression cannot come back quietly');

  rmSync(join(ROOT, SCRATCH_DIR, '..'), { recursive: true, force: true });
});

test('A2 · the maintenance scratch directory is git-ignored, so a run never dirties the fork', () => {
  // `.rsc-upstream/` holds the worktrees `--worktree` creates and the disposable trees above. Both
  // are now inside the repository by §1, which makes ignoring them a correctness requirement and
  // not tidiness: an orphaned worktree used to show up in `git status`.
  const res = spawnSync('git', ['check-ignore', '-v',
    '.rsc-upstream/tmp/proj-x/f', '.rsc-upstream/worktree-123/f'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(res.status, 0, `both paths must be ignored: ${res.stdout}${res.stderr}`);
  assert.equal(res.stdout.trim().split('\n').length, 2);

  // And the journal is NOT ignored: the evidence of what was incorporated is committed.
  const journal = spawnSync('git', ['check-ignore', 'docs/fork/stage5/runs/x/state.json'], { cwd: ROOT, encoding: 'utf8' });
  assert.notEqual(journal.status, 0, 'the run journal stays committable (`docs/*` then `!docs/fork/`)');
});

// ── A3 · every check can FAIL, and a check with no negative case fails this file ─────────────

/**
 * For each gate check: a tree or a context where its property is FALSE, and what the failure must
 * say. Keyed by check id, and `A3` below derives the key set from `GATE_CHECKS` itself — so adding
 * a check without a negative case breaks the suite instead of quietly joining a gate of checks
 * nobody proved can bite.
 *
 * This is the finding the review of stage 4 made about the other instrument in this project, made
 * again here: the old test asserted that each check HAS a `run()`, a long `title` and a valid
 * `kind`. That is a test of shape. With a context of `{ cwd, upstreamRef }` and nothing else, eight
 * checks passed, because an absent context entry and an entry that measured zero are the same
 * value.
 */
const GATE_NEGATIVES = {
  G1: {
    why: 'skills/ differs from the reference commit',
    ctx: () => ({ cwd: ROOT, upstreamRef: g(ROOT, ['rev-list', '--max-parents=0', 'HEAD']).split('\n')[0] }),
    expect: /differing files/,
  },
  G2: {
    why: 'the catalog is not the reference commit\'s catalog',
    ctx: () => ({ cwd: ROOT, upstreamRef: g(ROOT, ['rev-list', '--max-parents=0', 'HEAD']).split('\n')[0] }),
    expect: /missing:|extra:/,
  },
  G3: {
    why: 'a skill in scope is not conformant in a real install',
    ctx: () => ({
      cwd: ROOT,
      classification: { added: ['alpha'], modified: [] },
      scopedConformance: {
        ok: false, failures: ['alpha: no base at .rsc/skills/alpha/SKILL.md'], drifted: [], idempotent: true, scope: ['alpha'],
      },
    }),
    expect: /no base at/,
  },
  G4: {
    why: 'the second install is not byte-identical',
    ctx: () => ({
      cwd: ROOT,
      classification: { added: ['alpha'], modified: [] },
      scopedConformance: {
        ok: true, failures: [], drifted: ['alpha'], idempotent: false, scope: ['alpha'],
      },
    }),
    expect: /drifted: alpha/,
  },
  G5: {
    why: 'a vendored subtree is not in the delivered copy',
    ctx: () => {
      const empty = mkdtempSync(join(tmpdir(), 'rsc-maint-nodeliver-'));
      const id = vendoredSubtrees(ROOT, 'HEAD')[0].split('/')[1];
      return { cwd: ROOT, upstreamRef: 'HEAD', scopedConformance: { project: empty, scope: [id] } };
    },
    expect: /not delivered/,
  },
  G6: {
    why: 'a notice changed and nothing acknowledged it',
    ctx: () => ({
      cwd: ROOT,
      attribution: { added: ['skills/x/NOTICE'], removed: [], changed: [], newVendored: ['skills/x'] },
      acknowledgements: {},
    }),
    expect: /NOT acknowledged/,
  },
  G7: {
    why: 'a divergence lost its intent, and another has no probe',
    ctx: () => ({
      cwd: ROOT,
      surface: { ok: true, modified: [UNPROBED_UPSTREAM_FILE], measuredAgainst: 'working tree' },
    }),
    expect: /no intent probe/,
  },
  G8: {
    why: 'the impacted subset could not be enumerated',
    ctx: () => ({ cwd: ROOT, impactedTests: [] }),
    expect: /could not be enumerated/,
  },
  G9: {
    why: 'a skill reported removed is still in the catalog',
    ctx: () => ({ cwd: ROOT, classification: { removed: ['flutter'], renameCandidates: [] } }),
    expect: /still in the catalog/,
  },
  G10: {
    why: 'a removal is not registered in RETIRED_SKILLS',
    ctx: () => ({ cwd: ROOT, classification: { removed: ['flutter'] }, acknowledgements: {} }),
    expect: /not in RETIRED_SKILLS/,
  },
  G11: {
    why: 'skills were added or modified and no evaluation was recorded',
    ctx: () => ({ cwd: ROOT, classification: { added: ['alpha'], modified: [] }, acknowledgements: {} }),
    expect: /need a semantic evaluation/,
  },
  G12: {
    why: 'the merge restored the parent\'s package identity',
    ctx: () => {
      const dir = mkdtempSync(join(tmpdir(), 'rsc-maint-identity-'));
      writeFileSync(join(dir, 'package.json'), `${JSON.stringify({
        name: '@ericrisco/rsc', version: '9.9.9', bin: { rsc: 'scripts/rsc.js' },
      }, null, 2)}\n`);
      return { cwd: dir, upstreamRef: 'HEAD' };
    },
    expect: /parent package|parent command/,
  },
};

test('A3 · every gate check has a context where it FAILS, and the list is derived from GATE_CHECKS', async () => {
  const ids = GATE_CHECKS.map((c) => c.id);
  const covered = Object.keys(GATE_NEGATIVES);
  assert.deepEqual(
    ids.filter((id) => !covered.includes(id)), [],
    'a check with no negative case is a check nobody proved can fail. Add it to GATE_NEGATIVES',
  );
  assert.deepEqual(covered.filter((id) => !ids.includes(id)), [], 'and no case names a check that no longer exists');

  for (const check of GATE_CHECKS) {
    const spec = GATE_NEGATIVES[check.id];
    // eslint-disable-next-line no-await-in-loop -- one disposable tree at a time, on purpose.
    const out = await check.run(spec.ctx());
    assert.equal(out.ok, false, `${check.id} must FAIL when ${spec.why} — it returned: ${out.detail}`);
    assert.match(out.detail, spec.expect, `${check.id} says WHICH property failed`);
  }
});

test('A3 · a check handed NO measurement fails; only the four that measure the tree may pass', async () => {
  // The review's diagnosis of A3, applied everywhere it holds rather than only where it was raised:
  // "una entrada ausente es indistinguible de una entrada que midió cero". With a context of
  // `{ cwd, upstreamRef }` and nothing else, ALL TWELVE checks used to pass — G3, G4, G9, G10 and
  // G11 because an absent `classification` computes an empty scope, G6 because an absent
  // `attribution` defaulted to "no notice changed", G7 because `[]` is truthy, G8 because an empty
  // subset was a skip and a skip was a pass.
  //
  // The four that may still pass are the ones that need no input handed to them at all: they read
  // the tree themselves, and the tree really is healthy.
  const MEASURE_THE_TREE_DIRECTLY = ['G1', 'G2', 'G5', 'G12'];
  const passed = [];
  for (const check of GATE_CHECKS) {
    // eslint-disable-next-line no-await-in-loop -- the checks share a context and must not race.
    // G8's stub is a skip with no declared reason, which is itself one of the states M6 made
    // un-passable — so its refusal is phrased differently from the others, and that is the point.
    const out = await check.run({ cwd: ROOT, upstreamRef: 'HEAD', testRun: { ok: true, skipped: true, detail: 'stub' } });
    if (out.ok) passed.push(check.id);
    else if (!MEASURE_THE_TREE_DIRECTLY.includes(check.id)) {
      assert.match(
        out.detail,
        /absence is a wiring failure|no divergence surface was handed|could not be enumerated|SKIPPED WITHOUT A DECLARED REASON/,
        `${check.id} says nothing was MEASURED, rather than reporting a measurement of zero`,
      );
    }
  }
  assert.deepEqual(passed, MEASURE_THE_TREE_DIRECTLY,
    'a check that consumes a measurement cannot pass without having been handed one');
});

test('A3 · G7 no longer has a branch that cannot fail', () => {
  // Inside the old G7, the fallback `files = Object.keys(DIVERGENCE_PROBES)` made
  // `unprobed = files.filter((f) => !DIVERGENCE_PROBES[f])` necessarily `[]`: the unwatched-
  // divergence half of the check could not fire on that path, by construction. The fallback is gone
  // — the check now demands a measured surface — so the half is reachable on every path there is.
  const g7 = GATE_CHECKS.find((c) => c.id === 'G7');
  const source = codeOnly(readFileSync(join(ROOT, 'scripts', 'lib', 'upstream-gate.js'), 'utf8'));
  const body = source.slice(source.indexOf("id: 'G7'"), source.indexOf("id: 'G8'"));
  assert.ok(!/ctx\.surface\?\.modified \|\|/.test(body), 'the `||` that swallowed a failed measurement is gone');

  // Proof it is reachable: the only input G7 accepts is a measured surface, and an unprobed entry
  // in one is reported.
  const out = g7.run({ cwd: ROOT, surface: { ok: true, modified: [UNPROBED_UPSTREAM_FILE] } });
  assert.deepEqual(out.measured.unprobed, [UNPROBED_UPSTREAM_FILE]);
});

// ── M1 · the journal and the report are committed, so they carry no absolute user path ───────

test('M1 · nothing in the journal or the report names the operator\'s filesystem', async () => {
  const { up, fork } = fixture();
  upstreamShipsEverything(up);
  const stateRoot = join(fork, '.state');
  const res = await maintain({ repo: fork, stateRoot, check: true, quiet: true });

  assert.equal(res.state.repo, 'fork',
    'the journal anchors on the repository DIRECTORY NAME, not `/Users/<name>/…` (measured: `"repo": "/Users/home/…"`)');

  const raw = readFileSync(statePath(stateRoot, res.runId), 'utf8');
  assert.ok(!raw.includes(fork), `the journal carries no absolute path to the repository:\n${
    raw.split('\n').filter((l) => l.includes(fork)).slice(0, 4).join('\n')}`);
  const report = renderReport(res.state, { stateRoot, repo: fork });
  assert.ok(!report.includes(fork), 'and neither does the report');

  // Relative is still reversible, which is the whole reason it is usable: `.` is the repository.
  assert.equal(repoRelative('/a/b', '/a/b/docs/x.md'), 'docs/x.md');
  assert.equal(repoRelative('/a/b', '/a/b'), '.');
  assert.equal(repoRelative('/a/b', 'already/relative'), 'already/relative');
});

test('M1 · the test instrument records WHETHER the git ceiling was set, not its value', () => {
  const dir = tinyRepo();
  const r = runTests({
    cwd: dir,
    files: ['tests/governance-ok.test.js'],
    env: { ...process.env, GIT_CEILING_DIRECTORIES: '/Users/someone/secret-place' },
  });
  assert.equal(r.instrument.gitCeiling, true,
    'a BOOLEAN: the gate only ever uses it as one (`instrumentUnsound: !ceiling`), and this object '
    + 'is written verbatim into `evidence/impacted-tests.json`, which is committed');
  assert.ok(!JSON.stringify(r.instrument).includes('secret-place'), 'so the environment never travels with it');
  assert.equal(r.instrumentUnsound, false);

  const unsound = runTests({ cwd: dir, files: ['tests/governance-ok.test.js'], env: { ...process.env, GIT_CEILING_DIRECTORIES: '' } });
  assert.equal(unsound.instrument.gitCeiling, false, 'and false means it was not set');
  assert.equal(unsound.instrumentUnsound, true);
});

// ── M2 · an acknowledgement is recorded in the journal, read from it, and checked ────────────

test('M2 · `--ack <CHECK>=anything at all` no longer clears a check', () => {
  // Measured by the review: `--ack G6="anything at all"` produced `PASS G6`. Free text is not a
  // decision; it is a word in a committed report with nothing behind it.
  assert.equal(validateAck('G6', 'anything at all', { cwd: ROOT }).ok, false);
  assert.equal(validateAck('G10', 'anything at all', { cwd: ROOT }).ok, false);
  assert.equal(validateAck('G11', 'anything at all', { cwd: ROOT }).ok, false);
  assert.equal(validateAck('G6', '', { cwd: ROOT }).ok, false, 'and empty is empty');

  // Each one declares a shape that can be followed back to something real.
  assert.equal(validateAck('G6', 'recorded in README.md', { cwd: ROOT }).ok, true);
  assert.equal(validateAck('G6', 'recorded in docs/fork/NOT-A-FILE.md', { cwd: ROOT }).ok, false,
    'a path that does not exist is not a record');
  assert.equal(validateAck('G10', `added in ${g(ROOT, ['rev-parse', 'HEAD'])}`, { cwd: ROOT }).ok, true);
  assert.equal(validateAck('G10', 'added in commit abc1234', { cwd: ROOT }).ok, false,
    'a commit-shaped string this repository cannot resolve is not a commit');
  assert.equal(validateAck('G10', 'added in main', { cwd: ROOT }).ok, false,
    'and a short word that resolves by accident is not one either: the candidate has to be at '
    + 'least git\'s own abbreviated-object length');
  const scope = { classification: { added: ['connect-tool'], modified: [] } };
  assert.equal(validateAck('G11', 'N=3 over connect-tool, all above threshold', { cwd: ROOT, ...scope }).ok, true);
  assert.equal(validateAck('G11', 'all above threshold over connect-tool', { cwd: ROOT, ...scope }).ok, false,
    'a semantic result without its N is not a result');
  assert.equal(validateAck('G11', 'N=3, all above threshold', { cwd: ROOT, ...scope }).ok, false,
    'and it has to name the skills it claims to have evaluated');

  for (const id of Object.keys(ACK_VALIDATORS)) {
    assert.ok(ACK_VALIDATORS[id].shape.length > 20, `${id} tells the operator the shape it wants`);
  }

  // A rejected acknowledgement is reported as REJECTED, not as absent: the difference matters to
  // whoever typed it.
  const g6 = GATE_CHECKS.find((c) => c.id === 'G6');
  const out = g6.run({
    cwd: ROOT,
    attribution: { added: ['skills/x/NOTICE'], removed: [], changed: [], newVendored: [] },
    acknowledgements: { G6: 'anything at all' },
  });
  assert.equal(out.ok, false);
  assert.match(out.detail, /acknowledgement recorded for G6/);
  assert.ok(out.measured.ackRejected, 'and the rejection is in the evidence');
});

test('M2 · a FRESH run records its acknowledgements in the journal, and the gate reads them there', async () => {
  // `recordDecision` used to live inside `if (resumeId)`, so a fresh run given `--ack` left no
  // trace at all; and `runGate`'s comment claimed the acknowledgements came "from the run journal,
  // never from a flag", while nothing read `state.decisions` (`decisionFor` was exported and never
  // called). The flag is the input; the journal is the source.
  const { up, fork } = fixture();
  upstreamShipsEverything(up);
  const res = await maintain({
    repo: fork,
    stateRoot: join(fork, '.state'),
    check: true,
    quiet: true,
    acknowledgements: { G6: 'recorded in README.md' },
  });
  const decision = res.state.decisions.find((d) => d.id === 'G6');
  assert.ok(decision, 'a fresh run leaves the trace a resumed one did');
  assert.equal(decision.kind, 'acknowledgement');
  assert.equal(decision.answer, 'recorded in README.md');
  assert.equal(decision.decidedBy, '--ack');

  // And the map the gate consumes is derived from the journal, not from argv.
  assert.deepEqual(acknowledgementsFrom(res.state), { G6: 'recorded in README.md' });
  const comment = readFileSync(join(ROOT, 'scripts', 'lib', 'upstream-gate.js'), 'utf8');
  assert.match(comment, /READ FROM THE RUN JOURNAL/, 'and the comment now describes what the code does');
});

// ── M3 · the bounded fixes are committed, and the gate re-runs over what they produced ───────

/** A repository with the two generators `remediate` is allowed to run, one of which drifts. */
function remediationRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'rsc-maint-remediate-'));
  g(dir, ['init', '-q', '-b', 'main']);
  put(dir, 'scripts/build-manifest.js', [
    "import { writeFileSync } from 'node:fs';",
    "if (process.argv.includes('--check')) { console.log('manifest drift'); process.exit(1); }",
    "writeFileSync('manifest.json', JSON.stringify({ built: true }) + '\\n');",
    "console.log('manifest written');",
  ].join('\n'));
  put(dir, 'scripts/governance-sync.js', "console.log('in sync');\n");
  put(dir, 'manifest.json', `${JSON.stringify({ built: false })}\n`);
  g(dir, ['add', '-A']);
  g(dir, ['commit', '-qm', 'base']);
  return dir;
}

test('M3 · `remediate` COMMITS what it regenerated, and re-opens `validate`', async () => {
  // `phaseRemediate` runs `build-manifest.js` and `governance-sync.js`, both of which WRITE, and
  // there was no `git commit` anywhere in the orchestrator. `phasePublish` then ran
  // `git checkout <target>` and `git merge --no-ff <branch>` — promoting a branch that does not
  // contain the remediation, with the authority of a verdict computed before it was written.
  const dir = remediationRepo();
  const state = newRun({ repo: dir, authorization: 'publish' });
  state.phases.integrate.data = { tree: '.', branch: 'main' };
  state.phases.classify.data = { classification: { added: [], removed: [], modified: [], renameCandidates: [] } };
  state.phases.validate.status = 'done';
  const before = g(dir, ['rev-parse', 'HEAD']);

  const out = await PHASE_RUNNERS.remediate({ repo: dir, state, stateRoot: join(dir, '.state') });
  assert.equal(out.status, 'done');
  assert.equal(out.data.applied.length, 1, 'one generator drifted and was regenerated');
  assert.equal(out.data.applied[0].id, 'manifest');
  assert.ok(out.data.committed?.ok, `the regeneration was committed: ${JSON.stringify(out.data.committed)}`);
  assert.notEqual(g(dir, ['rev-parse', 'HEAD']), before, 'HEAD moved');
  assert.equal(g(dir, ['status', '--porcelain']), '',
    'and the tree is clean, so a later `git checkout` cannot drop the fix on the floor');
  assert.match(g(dir, ['log', '-1', '--format=%s']), /regenerate manifest/);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')), { built: true });

  assert.equal(state.phases.validate.status, 'pending',
    'and the gate is re-opened: a verdict that predates the remediation does not describe the tree '
    + 'the remediation produced');
  assert.match(out.data.revalidate, /re-opened/);
  assert.match(out.summary, /validate` re-opened/);
});

test('M3 · a run with nothing to remediate commits nothing and leaves the verdict alone', async () => {
  const dir = remediationRepo();
  // Make the manifest check pass, so neither bounded fix fires.
  put(dir, 'scripts/build-manifest.js', "console.log('in sync');\n");
  g(dir, ['add', '-A']);
  g(dir, ['commit', '-qm', 'no drift']);
  const head = g(dir, ['rev-parse', 'HEAD']);

  const state = newRun({ repo: dir, authorization: 'publish' });
  state.phases.integrate.data = { tree: '.', branch: 'main' };
  state.phases.classify.data = { classification: { added: [], removed: [], modified: [], renameCandidates: [] } };
  state.phases.validate.status = 'done';

  const out = await PHASE_RUNNERS.remediate({ repo: dir, state, stateRoot: join(dir, '.state') });
  assert.equal(out.data.committed, null, 'no empty commit');
  assert.equal(g(dir, ['rev-parse', 'HEAD']), head);
  assert.equal(state.phases.validate.status, 'done', 'and the gate is not re-run for nothing');
});

// ── M4 · the fork's repository goes back where it was ────────────────────────────────────────

test('M4 · a run that fails half-way puts the repository back on the branch it started from', async () => {
  // Without `--worktree`, `phaseIntegrate` runs `git checkout <branch>` in the fork's own clone and
  // no path used to restore it — so the normal outcome (a block needing a human) left the operator
  // standing on a maintenance branch with a merge on it.
  const { up, fork } = fixture();
  upstreamShipsEverything(up);
  const stateRoot = join(fork, '.state');
  const start = g(fork, ['rev-parse', '--abbrev-ref', 'HEAD']);
  assert.equal(start, 'main', 'premise');

  // `govern` cannot run in this fixture (it has no installer), so the run fails there — after the
  // merge, which is exactly the half-way failure this is about.
  const res = await maintain({
    repo: fork, stateRoot, authorize: 'integrate', quiet: true,
  });
  assert.equal(res.ok, false, 'the run did not finish');
  assert.ok(res.state.phases.integrate.status === 'done', 'but it did check out the maintenance branch and merge');
  assert.equal(g(fork, ['rev-parse', '--abbrev-ref', 'HEAD']), start,
    'and the repository is back on `main`, not left on `fork/upstream-…`');
  assert.ok(res.state.treeRestored.ok);
  assert.equal(res.state.treeRestored.ref, start);
  assert.equal(res.state.phases.prepare.data.startRef, start, 'the starting ref is recorded by `prepare`');

  // The other half: a resume that needs the integrated tree re-enters the branch, because the
  // previous pass left it. Restoring without this would silently validate `main`.
  const resumed = await maintain({
    repo: fork, stateRoot, resume: res.runId, authorize: 'integrate', quiet: true,
  });
  assert.equal(resumed.state.phases.integrate.status, 'done', 'the merge is not redone');
  assert.ok(resumed.state.phases.prepare.data.branch.startsWith('fork/upstream-'));
});

test('M4 · a --worktree run never moves the repository\'s HEAD, so there is nothing to restore', async () => {
  const { up, fork } = fixture();
  upstreamShipsEverything(up);
  const start = g(fork, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const res = await maintain({
    repo: fork, stateRoot: join(fork, '.state'), authorize: 'integrate', worktree: true, quiet: true,
  });
  assert.equal(g(fork, ['rev-parse', '--abbrev-ref', 'HEAD']), start);
  assert.equal(res.state.treeRestored ?? null, null, 'nothing was restored, because nothing moved');
  assert.equal(res.state.phases.prepare.data.worktree, join('.rsc-upstream', `worktree-${res.runId}`),
    'and the worktree path is recorded RELATIVE to the repository, because the journal is committed');
  g(fork, ['worktree', 'remove', '--force', join(fork, '.rsc-upstream', `worktree-${res.runId}`)], { allowFail: true });
});

// ── M5 · the surface is a working-tree measurement, re-taken by the gate ─────────────────────

test('M5 · an UNCOMMITTED fork divergence is visible, because the surface is not a commit range', () => {
  // `git diff base..HEAD` answers "what has the fork committed on top of upstream". The question
  // that matters is "what does the fork diverge on RIGHT NOW", and the two differ at the one moment
  // the answer is load-bearing: a human has just resolved a merge conflict by hand.
  const { fork } = fixture();
  const where = lastIncorporated({ cwd: fork });

  const committed = divergenceSurface({ cwd: fork, base: where.base, worktree: false });
  assert.deepEqual(committed.modified, ['targets/thing.js'], 'the committed answer');
  assert.equal(committed.measuredAgainst, `${where.base}..HEAD`);

  // The uncommitted ninth file: a conflict resolution nobody has committed yet.
  put(fork, 'package.json', `${JSON.stringify({ name: '@lema017/forked', version: '1.0.0' }, null, 2)}\n`);
  const live = divergenceSurface({ cwd: fork, base: where.base });
  assert.equal(live.measuredAgainst, 'working tree', 'the default is the tree, and it says so');
  assert.deepEqual(live.modified, ['package.json', 'targets/thing.js'],
    'the uncommitted divergence is seen; the range could not see it at all');
  assert.deepEqual(divergenceSurface({ cwd: fork, base: where.base, worktree: false }).modified,
    ['targets/thing.js'], 'and the range still answers the range question when asked for it');
});

test('M5 · a `validate` that cannot measure the surface produces no verdict, and the report says so', () => {
  // `validate` can now stop BEFORE the gate runs. There is no verdict to print in that case, and
  // printing something shaped like one would be the whole mistake these corrections are about.
  const state = newRun({ repo: '/a/b/fork', authorization: 'publish' });
  state.phases.survey.data = { base: 'aaaaaaa', upstreamHead: 'bbbbbbb' };
  state.phases.validate.status = 'failed';
  state.phases.validate.summary = 'the divergence surface could not be re-measured in .: boom';
  state.phases.validate.data = { surface: { ok: false, error: 'boom' } };
  const report = renderReport(state, { stateRoot: '/a/b/fork/.state', repo: '/a/b/fork' });
  assert.match(report, /\*\*NOT RUN\*\* — the phase stopped before any check ran/);
  assert.match(report, /could not be re-measured/);
  assert.ok(!report.includes('/a/b/fork'), 'and still no absolute path anywhere in it');
});

test('M5 · the gate RE-MEASURES the surface instead of reusing the one `classify` took', async () => {
  // `classify` runs before the merge and is not re-run on resume, so its surface describes the tree
  // the merge was applied TO. Reusing it means the one case where the surface has certainly changed
  // — a conflict resolved by hand, then `--resume` — is the case where the reused value is
  // guaranteed to be wrong.
  const { up, fork } = fixture();
  upstreamShipsEverything(up);
  const state = newRun({ repo: fork, authorization: 'validate' });
  g(fork, ['fetch', '-q', 'upstream', 'main']);
  const where = lastIncorporated({ cwd: fork });
  state.phases.survey.data = { base: where.base, upstreamHead: where.upstream, upstreamRef: 'upstream/main' };
  state.phases.integrate.data = { tree: '.', branch: 'main' };
  state.phases.classify.data = {
    classification: { added: [], removed: [], modified: [], renameCandidates: [] },
    surface: { ok: true, modified: [], measuredAgainst: 'a stale measurement' },
    attribution: { added: [], removed: [], changed: [], newVendored: [] },
    upstreamChanged: [],
    impactedTests: [],
  };
  // A divergence that exists in the tree and not in `classify`'s stale surface.
  put(fork, 'package.json', `${JSON.stringify({ name: '@lema017/forked' }, null, 2)}\n`);

  const out = await PHASE_RUNNERS.validate({
    repo: fork, state, stateRoot: join(fork, '.state'), acknowledgements: {},
  });
  assert.equal(out.data.surface.measuredAgainst, 'working tree', 'the gate took its own measurement');
  assert.ok(out.data.surface.modified.includes('package.json'),
    `and found the divergence the stale one did not: ${out.data.surface.modified.join(', ')}`);
  const g7 = out.data.results.find((r) => r.id === 'G7');
  assert.equal(g7.ok, false, 'which G7 then judges — here as unprobed, not as "0 intact"');
  assert.match(g7.detail, /no intent probe/);
});

// ── M6 · a skip is not a pass, and an enumeration failure is a failure ──────────────────────

test('M6 · `runTests` with nothing to run reports NOT-OK, with the reason', () => {
  // Measured: `runTests({ files: [] })` returned `{ ok: true, skipped: true }` with no
  // `instrumentUnsound` and no `instrument`, so G8 — `r.ok && !r.instrumentUnsound` — passed with
  // `measured.instrument` undefined at the exact moment no test had run.
  const r = runTests({ cwd: ROOT, files: [] });
  assert.equal(r.ok, false, 'nothing ran, so nothing passed');
  assert.equal(r.skipped, true);
  assert.ok(r.skipReason, 'and it says why, so "not verified" never reads as "passed"');
  assert.match(r.skipReason, /enumeration failure/);
  assert.equal(r.instrument, null, 'with no instrument to vouch for');
  assert.equal(r.instrumentUnsound, true);

  const g8 = GATE_CHECKS.find((c) => c.id === 'G8');
  const out = g8.run({ cwd: ROOT, impactedTests: [] });
  assert.equal(out.ok, false);
  assert.match(out.detail, /could not be enumerated/);
  assert.equal(out.measured.instrument, null);
});

test('M6 · an unreadable `tests/` directory is an enumeration FAILURE, not an empty net', () => {
  // `alwaysRunFiles` swallowed the `readdirSync` error and returned `[]` — the same value as
  // "nothing is impacted". The net around acceptance criterion 4 could empty itself in silence.
  const broken = alwaysRunFiles(join(tmpdir(), 'rsc-maint-does-not-exist-at-all'));
  assert.deepEqual(broken.files, []);
  assert.match(broken.error, /cannot read/, 'the error is returned, not discarded');

  // The other branch: `tests/` is readable and holds no `governance-*.test.js` at all.
  const dir = tinyRepo({ withTests: false });
  mkdirSync(join(dir, 'tests'), { recursive: true });
  const empty = alwaysRunFiles(dir);
  assert.deepEqual(empty.files, []);
  assert.match(empty.error, /DERIVED from the tree/, 'an empty net is an error, not an absence of impact');

  const enumeration = enumerateImpactedTests({ cwd: dir, upstreamChanged: [], classification: null });
  assert.ok(enumeration.error, 'and the derivation carries it');

  const g8 = GATE_CHECKS.find((c) => c.id === 'G8');
  const out = g8.run({ cwd: dir, upstreamChanged: [], classification: null });
  assert.equal(out.ok, false, 'and G8 fails rather than running nothing and calling it a pass');
  assert.match(out.detail, /could not be enumerated/);
});

test('M6 · a real run of the derived subset still passes, and carries its instrument', () => {
  const dir = tinyRepo();
  const files = impactedTests({ cwd: dir, upstreamChanged: [], classification: null });
  assert.deepEqual(files, ['tests/governance-ok.test.js'], 'derived from the tree');
  const r = runTests({ cwd: dir, files, env: { ...process.env, GIT_CEILING_DIRECTORIES: dir } });
  assert.equal(r.ok, true, `${r.detail}`);
  assert.equal(r.tap.pass, 1);
  assert.equal(r.instrument.concurrency, 1);
});

// ── the BAJO ─────────────────────────────────────────────────────────────────────────────────

test('B1 · G9 declares that rehome detection is NOT instrumented, rather than implying otherwise', () => {
  // Half of G9 is real: it compares the reported removals against the catalog on disk. The other
  // half asserts that `renameCandidates[].disposition` contains "never an automatic rehome" — a
  // string `classifyCatalogChanges` writes as a literal constant, so the assertion can only detect
  // somebody editing that constant. It cannot detect a real rehome, because the catalog carries no
  // stable identifier to decide that two differently-named skills are the same skill. Declared.
  const g9 = GATE_CHECKS.find((c) => c.id === 'G9');
  assert.ok(g9.rehomeDetection, 'the limitation is stated in the check itself, not only in a doc');
  assert.match(g9.rehomeDetection, /not instrumented/);
  assert.match(g9.rehomeDetection, /no stable identifier/);

  // And the tripwire still trips, which is all it ever claimed to be.
  const tampered = {
    cwd: ROOT,
    classification: {
      removed: ['eli5'],
      renameCandidates: [{ from: 'eli5', to: 'orient', disposition: 'resolved automatically' }],
    },
  };
  return g9.run(tampered).then((out) => {
    assert.equal(out.ok, false);
    assert.match(out.detail, /carries no decision requirement/);
  });
});

test('B4 · both journal files are written atomically, and a stale temporary is cleaned up', () => {
  const stateRoot = mkdtempSync(join(tmpdir(), 'rsc-maint-atomic2-'));
  const state = newRun({ repo: '/x', authorization: 'survey', runId: 'run-b4' });
  saveRun(state, { stateRoot });
  assert.deepEqual(readdirSync(stateRoot).sort(), ['latest', 'run-b4'],
    'the pointer is renamed into place too, so `--resume` with no id cannot read a half-written id');

  // A crash between write and rename used to leave `state.json.tmp` in a COMMITTED directory.
  writeFileSync(`${statePath(stateRoot, 'run-b4')}.tmp`, '{"half":');
  saveRun(state, { stateRoot });
  assert.deepEqual(readdirSync(join(stateRoot, 'run-b4')), ['state.json'],
    'the next save removes it rather than leaving it to be committed');
});

test('B5 · a phase result REPLACES the previous one, including when it carries no data', () => {
  // `if (data !== null) phase.data = data` left the previous pass's measurements under a fresh
  // summary. `resumeRun` deliberately preserves `data` as the resume input, so the two together
  // could make a phase report one thing while the journal held another pass's numbers.
  const state = newRun({ repo: '/x', authorization: 'publish' });
  completePhase(state, 'survey', { summary: 'first', data: { base: 'aaaaaaa' } });
  assert.deepEqual(state.phases.survey.data, { base: 'aaaaaaa' });
  completePhase(state, 'survey', { summary: 'second, measured nothing' });
  assert.equal(state.phases.survey.data, null, 'the stale measurement is gone, not inherited');
  assert.equal(state.phases.survey.summary, 'second, measured nothing');

  // And a reset phase still keeps its data, which is what `prepare` and `integrate` resume from.
  completePhase(state, 'prepare', { summary: 'branch', data: { branch: 'fork/upstream-abc' } });
  state.phases.prepare.status = 'failed';
  resumeRun(state);
  assert.deepEqual(state.phases.prepare.data, { branch: 'fork/upstream-abc' },
    'preserved on purpose: it is the resume input');
});

test('B6 · only the FORK\'s documentation is ignored by the surface, not every file under docs/', () => {
  // The ignore list was `['docs/']`, which happens to coincide with `docs/fork/` today. Upstream
  // owns files under `docs/` too, so a future fork edit to one of them would have been unwatched —
  // a divergence with no probe and nothing reporting that it has none.
  const { up, fork } = fixture();
  put(up, 'docs/guide.md', 'upstream owns this document.\n');
  g(up, ['add', '-A']);
  g(up, ['commit', '-qm', 'upstream adds a doc']);
  g(fork, ['pull', '-q', '--no-rebase', 'upstream', 'main']);
  const base = lastIncorporated({ cwd: fork }).base;

  put(fork, 'docs/guide.md', 'the FORK has edited upstream\'s document.\n');
  put(fork, 'docs/fork/LEDGER.md', 'the fork\'s own documentation, which is not a divergence.\n');

  const surface = divergenceSurface({ cwd: fork, base });
  assert.ok(surface.modified.includes('docs/guide.md'),
    `a fork edit to an upstream-owned file under docs/ IS watched: ${surface.modified.join(', ')}`);
  assert.ok(!surface.added.includes('docs/fork/LEDGER.md') && !surface.modified.includes('docs/fork/LEDGER.md'),
    'and the fork\'s own documentation tree is still excluded');
});

test('B7 · Apache-2.0 §4(d) — NOTICE, COPYING, LICENCE, AUTHORS and PATENTS are notice files', () => {
  // The fork already carries Apache-2.0 material, and §4(d) obliges a derivative work to propagate
  // the NOTICE of what it derives from. The matcher saw `LICENSE*`, `*LICENSE*.txt`, `THIRD_PARTY.md`
  // and `UPSTREAM.json` — so a `NOTICE` upstream added would have landed in the fork with nothing
  // reporting the duty. None exists in the tree today; that is why it was invisible.
  for (const name of ['NOTICE', 'NOTICE.txt', 'COPYING', 'LICENCE', 'LICENCE.md', 'AUTHORS',
    'PATENTS', 'COPYRIGHT', 'skills/x/vendor/NOTICE', 'LICENSE-2.0.txt']) {
    assert.equal(isAttributionPath(name), true, `${name} carries an attribution obligation`);
  }
  for (const name of ['scripts/authors.js', 'targets/license-check.mjs', 'skills/x/SKILL.md', 'noticeboard.js']) {
    assert.equal(isAttributionPath(name), false, `${name} is source, not a notice`);
  }
  // The files the previous matcher already caught are still caught.
  for (const name of ['LICENSE', 'skills/design/IMPECCABLE-LICENSE.txt', 'skills/ux/THIRD_PARTY.md',
    'skills/ux/upstream/UPSTREAM.json']) {
    assert.equal(isAttributionPath(name), true, `${name} is a regression guard`);
  }

  // End to end: upstream adds a NOTICE, the delta names it, and G6 blocks until acknowledged.
  const { up, fork } = fixture();
  put(up, 'skills/alpha/vendor/NOTICE', 'Portions © 2026 Someone, Apache-2.0.\n');
  put(up, 'skills/alpha/vendor/UPSTREAM.json', JSON.stringify({ license: 'Apache-2.0', modified: false }, null, 2));
  g(up, ['add', '-A']);
  g(up, ['commit', '-qm', 'upstream vendors Apache-2.0 material with a NOTICE']);
  g(fork, ['fetch', '-q', 'upstream', 'main']);
  const where = lastIncorporated({ cwd: fork });
  const d = attributionDelta({ cwd: fork, base: where.base, head: where.upstream });
  assert.ok(d.added.includes('skills/alpha/vendor/NOTICE'),
    `the NOTICE is reported as a new obligation: ${d.added.join(', ')}`);
  assert.deepEqual(d.newVendored, ['skills/alpha/vendor']);
  const g6 = GATE_CHECKS.find((c) => c.id === 'G6');
  assert.equal(g6.run({ cwd: ROOT, attribution: d, acknowledgements: {} }).ok, false,
    'and promotion blocks until the fork says where it recorded the duty');
});
