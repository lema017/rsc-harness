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
  classifyCatalogChanges, collisions, divergenceSurface, hasRemote, lastIncorporated, probeRemote,
  redactUrl, vendoredSubtrees,
} from '../scripts/lib/upstream-survey.js';
import {
  GATE_CHECKS, KNOWN_FAILURES, NEVER_RUN, alwaysRunFiles, gateVerdict, impactedTests, parseTap,
  promotable,
} from '../scripts/lib/upstream-gate.js';
import {
  AUTH_SCOPES, PHASES, beginPhase, loadRun, newRun, nextPhase, phasesAllowedBy, recordDecision,
  resumeRun, saveRun, scopeAllows, statePath,
} from '../scripts/lib/upstream-state.js';
import { maintain, renderReport } from '../scripts/upstream-maintain.js';
import { RETIRED_SKILLS, isRetired, replaceRetired } from '../scripts/lib/retired-skills.js';
import { customizationPathFor, governanceOf, transformSkillMd } from '../scripts/lib/governance.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

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
  const closed = notInstrumented[0].run({ classification: { added: ['x'], modified: [] }, acknowledgements: { G11: 'N=3, all above threshold' } });
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
  const good = "  return bytesOf(join(scopeRoot, '.rsc', 'governance', 'always-on.md'))\n";
  assert.deepEqual(checkProbes('scripts/doctor.js', good).failures, [], 'intact');
  const reverted = "  return bytesOf(join(scopeRoot, '.rsc', 'skills', 'suggest', 'SKILL.md'));\n";
  assert.equal(checkProbes('scripts/doctor.js', reverted).failures.length, 1, 'a silent revert is caught');

  const yml = 'on:\n  workflow_dispatch:\n';
  assert.deepEqual(checkProbes('.github/workflows/release.yml', yml).failures, [], 'manual-only trigger');
  const restored = 'on:\n  push:\n    branches: [main]\n  workflow_dispatch:\n';
  const failures = checkProbes('.github/workflows/release.yml', restored).failures;
  assert.equal(failures.length, 1, 'a restored push trigger is caught');
  assert.equal(failures[0].found, true, 'and reported as a fragment that reappeared, not one that is missing');
  assert.match(failures[0].probe.why, /merging must never publish by itself/);
});

test('the probe table covers every divergence the fork has committed today, and G7 fails on an unprobed one', () => {
  // The eight files are measured, not quoted: `ARCHITECTURE.md` §4 says "3 archivos y 4 puntos",
  // and the measurement against the incorporated base returns eight. Asserting the measured set
  // here is what keeps the table from going stale in the direction that matters.
  const MEASURED_TODAY = [
    '.github/workflows/release.yml', '.gitignore', 'package.json', 'scripts/doctor.js',
    'scripts/install-apply.js', 'targets/claude.js', 'targets/knowledge-sync.mjs',
    'tests/apply.test.js',
  ];
  for (const file of MEASURED_TODAY) {
    assert.ok(DIVERGENCE_PROBES[file], `\`${file}\` is a committed fork divergence and must carry an intent probe`);
    assert.ok(DIVERGENCE_PROBES[file].length >= 1);
    for (const probe of DIVERGENCE_PROBES[file]) {
      assert.ok(['present', 'absent'].includes(probe.kind));
      assert.ok(probe.fragment && probe.fragment.length > 5, `${file}: the probe quotes a fragment`);
      assert.ok(probe.why && probe.why.length > 20, `${file}: the probe says what the divergence is FOR`);
    }
  }
  // A new divergence with no probe is not silently unwatched: G7 reports it as a failure. The file
  // chosen exists and is simply not in the table, which is what a newly diverged file looks like.
  const g7 = GATE_CHECKS.find((c) => c.id === 'G7');
  assert.ok(existsSync(join(ROOT, 'scripts/audit.js')) && !DIVERGENCE_PROBES['scripts/audit.js'],
    'premise: this file exists and carries no probe');
  const out = g7.run({ cwd: ROOT, surface: { modified: ['scripts/install-apply.js', 'scripts/audit.js'] } });
  assert.equal(out.ok, false);
  assert.match(out.detail, /no intent probe/);
  assert.deepEqual(out.measured.unprobed, ['scripts/audit.js']);

  // And a file in the table that has vanished from the tree is its own, differently-named failure.
  const gone = g7.run({ cwd: ROOT, surface: { modified: ['targets/removed-by-a-merge.js'] } });
  assert.equal(gone.ok, false);
  assert.match(gone.detail, /file gone/);
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

  const acked = await g10.run({
    cwd: ROOT, classification: { removed: ['flutter'] }, acknowledgements: { G10: 'added in commit abc1234' },
  });
  assert.equal(acked.ok, true, 'and clears only on a recorded acknowledgement');

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
  assert.equal(g6.run({ attribution: d, acknowledgements: {} }).ok, false,
    'a clean merge and a green suite both miss this; the gate does not');
  assert.equal(g6.run({ attribution: d, acknowledgements: { G6: 'README table updated' } }).ok, true);
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
  const net = alwaysRunFiles(ROOT);
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
