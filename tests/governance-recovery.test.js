import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Stage 6 — RECOVERY, and D13.
//
// `PLAN.md` §8 asks for three properties, and this file measures all three by execution:
//   "una verificación fallida conserva la instalación funcional y explica el bloqueo"
//   "respaldo y restauración comprobados"
//   "sin estados parcialmente activados"
//
// And D13, decided by the coordinator and not reopened here: `restore` keeps its semantics. Stage 4
// reproduced the finding — there are TWO writers inside `.rsc/skills/`, `governBase` (which governs)
// and `restoreEntry` in `scripts/lib/backups.js` (a raw `cpSync`, which does not), and
// `install-apply.js` puts `baseDir(...)` in the snapshot set while `createBackup` runs BEFORE the
// install writes. So a snapshot taken over a base that had come from upstream holds that base
// ungoverned, and `restore` hands it back ungoverned. That is literally correct: the user asked for
// the earlier state. Re-governing would turn the time machine into a lie.
//
// What D13 bought instead is two things this file tests: `restore` SAYS when it did it, and
// `rscg conformance` answers "are my 274 governed?" on the consumer's machine — which until now
// could only be asked inside the fork's own repository.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'scripts', 'rsc.js');

const TMP = [];
function scratch(prefix) {
  const d = mkdtempSync(join(tmpdir(), prefix));
  TMP.push(d);
  return d;
}
test.after(() => { for (const d of TMP) rmSync(d, { recursive: true, force: true }); });

const base = (cwd, id) => join(cwd, '.rsc', 'skills', id, 'SKILL.md');
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', input: '' });

async function installed(ids = ['suggest', 'flutter'], target = 'claude') {
  const { applyInstall } = await import('../scripts/install-apply.js');
  const cwd = scratch('gr-project-');
  const home = scratch('gr-home-');
  await applyInstall({ skillIds: ids, target, home, cwd });
  return { cwd, home, ids, target };
}

/** Put a base back the way UPSTREAM would leave it: the pristine catalog file, ungoverned. */
function rewindToUpstream(cwd, id) {
  writeFileSync(base(cwd, id), readFileSync(join(ROOT, 'skills', id, 'SKILL.md'), 'utf8'));
}

// ── backup and restore, comprobados ───────────────────────────────────────────

test('gr01 · backup and restore round-trip: what the snapshot held is what comes back',
  { timeout: 300000 }, async () => {
    const { createBackup, restoreBackup, listBackups } = await import('../scripts/lib/backups.js');
    const { cwd } = await installed(['suggest', 'flutter']);
    const before = readFileSync(base(cwd, 'flutter'), 'utf8');

    const snapshot = createBackup({
      cwd, operation: 'test', target: 'claude',
      paths: [join(cwd, '.rsc', 'skills', 'flutter')], cliVersion: 'test',
    });
    assert.ok(snapshot.entries.length, 'the snapshot must hold the base directory');

    writeFileSync(base(cwd, 'flutter'), '# destroyed\n');
    assert.notEqual(readFileSync(base(cwd, 'flutter'), 'utf8'), before);

    const result = restoreBackup({ cwd, id: snapshot.id });
    assert.equal(readFileSync(base(cwd, 'flutter'), 'utf8'), before, 'restore returns exactly what was held');
    assert.ok(result.changed.length, 'and says what it touched');
    assert.ok(listBackups({ cwd }).some((b) => b.id === snapshot.id), 'the snapshot stays listable');
  });

test('gr02 · `--dry-run` reports and changes nothing', { timeout: 300000 }, async () => {
    const { createBackup, restoreBackup } = await import('../scripts/lib/backups.js');
    const { cwd } = await installed(['suggest', 'flutter']);
    const snapshot = createBackup({
      cwd, operation: 'test', target: 'claude',
      paths: [join(cwd, '.rsc', 'skills', 'flutter')], cliVersion: 'test',
    });
    writeFileSync(base(cwd, 'flutter'), '# mine now\n');
    const result = restoreBackup({ cwd, id: snapshot.id, dryRun: true });
    assert.ok(result.changed.length, 'a dry run still reports the paths');
    assert.equal(readFileSync(base(cwd, 'flutter'), 'utf8'), '# mine now\n', 'and touches nothing');
  });

// ── D13, reproduced — and then NAMED ──────────────────────────────────────────

test('gr03 · D13 reproduced: `restore` returns an UNGOVERNED base, and that is correct',
  { timeout: 300000 }, async () => {
    const { applyInstall } = await import('../scripts/install-apply.js');
    const { restoreBackup } = await import('../scripts/lib/backups.js');
    const { governanceOf } = await import('../scripts/lib/governance.js');
    const { cwd, home, ids, target } = await installed(['suggest', 'flutter']);

    // 1. the fork installed it: governed.
    assert.equal(governanceOf(readFileSync(base(cwd, 'flutter'), 'utf8')).complete, true, 'step 1');

    // 2. the base is what UPSTREAM leaves: ungoverned.
    rewindToUpstream(cwd, 'flutter');
    assert.equal(governanceOf(readFileSync(base(cwd, 'flutter'), 'utf8')).complete, false, 'step 2');

    // 3. the fork installs again. `createBackup` runs BEFORE the write, so the snapshot holds the
    //    ungoverned base; the install then governs it.
    await applyInstall({ skillIds: ids, target, home, cwd });
    assert.equal(governanceOf(readFileSync(base(cwd, 'flutter'), 'utf8')).complete, true, 'step 3');

    // 4. `restore latest` hands back what the snapshot held.
    restoreBackup({ cwd, id: 'latest' });
    assert.equal(governanceOf(readFileSync(base(cwd, 'flutter'), 'utf8')).complete, false,
      'step 4 — D13: the time machine returned the state it was given, which is the whole point of it');

    // And the delivery the assistant reads is that same file, immediately.
    const delivered = join(cwd, '.claude', 'skills', 'flutter', 'SKILL.md');
    assert.ok(existsSync(delivered), 'the symlinked delivery still resolves');
    assert.equal(readFileSync(delivered, 'utf8'), readFileSync(base(cwd, 'flutter'), 'utf8'),
      'so the ungoverned bytes are what the assistant loads — this is why it has to be SAID');
  });

test('gr04 · D13(a): `rscg restore` SAYS it returned ungoverned bases, and says what fixes it',
  { timeout: 300000 }, async () => {
    const { applyInstall } = await import('../scripts/install-apply.js');
    const { cwd, home, ids, target } = await installed(['suggest', 'flutter']);
    rewindToUpstream(cwd, 'flutter');
    await applyInstall({ skillIds: ids, target, home, cwd });

    const out = run(cwd, ['restore', 'latest']);
    assert.equal(out.status ?? 0, 0, out.stderr);
    const said = `${out.stdout}${out.stderr}`;
    assert.match(said, /carry NO governance contract/, `the restore said nothing about it:\n${said}`);
    assert.match(said, /flutter/, 'and it names which ones');
    assert.match(said, /run a sync here/i, 'and what puts it back');
    assert.match(said, /rscg conformance/, 'and where to see the whole picture');
    // It must NOT claim the restore was wrong, because it was not.
    assert.match(said, /the restore is correct/, 'the message must not read as an error report');
  });

test('gr05 · the warning is silent when nothing came back ungoverned — no crying wolf',
  { timeout: 300000 }, async () => {
    const { applyInstall } = await import('../scripts/install-apply.js');
    const { cwd, home, ids, target } = await installed(['suggest', 'flutter']);
    // Two governed installs in a row: the snapshot holds a GOVERNED base, so a restore returns one.
    await applyInstall({ skillIds: ids, target, home, cwd });
    const out = run(cwd, ['restore', 'latest']);
    assert.equal(out.status ?? 0, 0, out.stderr);
    assert.doesNotMatch(`${out.stdout}${out.stderr}`, /NO governance contract/,
      'a restore that returned governed bases must say nothing');
  });

test('gr06 · `ungovernedAmong` answers only about skill bases, and ignores everything else', async () => {
  const { ungovernedAmong } = await import('../scripts/lib/conformance.js');
  const { cwd } = await installed(['suggest', 'flutter']);
  rewindToUpstream(cwd, 'flutter');
  const paths = [
    join(cwd, '.rsc', 'skills', 'flutter'),
    join(cwd, '.rsc', 'skills', 'suggest', 'SKILL.md'),
    join(cwd, '.rsc.json'),                              // not a base
    join(cwd, '.claude', 'settings.json'),               // not a base
    join(cwd, '.rsc', 'governance', 'v1.md'),            // not a base
  ];
  const out = ungovernedAmong(cwd, paths);
  assert.deepEqual(out.map((u) => u.id), ['flutter'], JSON.stringify(out));
  assert.ok(out[0].reasons.length, 'and it says why, using the same audit as criterion 4');
});

// ── the consumer-side answer to criterion 4 (D13b) ────────────────────────────

test('gr07 · `rscg conformance` answers "are my skills governed?" on the consumer\'s machine',
  { timeout: 300000 }, async () => {
    const { cwd } = await installed(['suggest', 'flutter', 'orient']);
    const ok = run(cwd, ['conformance']);
    assert.equal(ok.status ?? 0, 0, `${ok.stdout}${ok.stderr}`);
    assert.match(ok.stdout, /3\/3 installed skills carry the governance contract \(v1\)/, ok.stdout);
    // The `(3 symlink)` count is the measurement `CONTRACT.md` §1's "17 of 18 symlink" claim needed
    // and nothing was producing — added when stage 4's review found the symlink class unmeasured.
    assert.match(ok.stdout, /claude: 3\/3 delivered conformant \(3 symlink\), always-on clean/, ok.stdout);
  });

test('gr08 · and it FAILS when a base is not governed — the test that makes it an instrument',
  { timeout: 300000 }, async () => {
    const { cwd } = await installed(['suggest', 'flutter', 'orient']);
    rewindToUpstream(cwd, 'flutter');
    const bad = run(cwd, ['conformance']);
    assert.equal(bad.status, 1, 'an ungoverned base must be a non-zero exit, or CI cannot read it');
    assert.match(bad.stdout, /UNGOVERNED \.rsc\/skills\/flutter\/SKILL\.md/, bad.stdout);
    assert.match(bad.stdout, /2\/3 installed skills carry the governance contract/, bad.stdout);
    assert.match(bad.stdout, /run an install or a sync in this project/, 'and it says what puts it back');
  });

test('gr09 · it reuses the criterion-4 audit rather than re-deciding what "governed" means', async () => {
  // The defect this guards against is the one this session already committed once, with
  // `contract-v1.md`: a second copy that drifts. `auditBase` has exactly one definition, in
  // `scripts/lib/conformance.js`, and `scripts/verify-catalog-conformance.js` re-exports it.
  const lib = await import('../scripts/lib/conformance.js');
  const instrument = await import('../scripts/verify-catalog-conformance.js');
  assert.equal(instrument.auditBase, lib.auditBase, 'the stage-4 instrument and the CLI share one function object');

  const source = readFileSync(join(ROOT, 'scripts', 'verify-catalog-conformance.js'), 'utf8');
  assert.ok(!/export function auditBase/.test(source),
    'verify-catalog-conformance.js must not define its own copy of the audit any more');
  assert.match(source, /from '\.\/lib\/conformance\.js'/, 'it imports it');
});

test('gr10 · nothing is installed here is a FACT, not a conformance failure', () => {
  const cwd = scratch('gr-empty-');
  const out = run(cwd, ['conformance']);
  assert.equal(out.status ?? 0, 0, 'an empty project must not fail the gate');
  assert.match(out.stdout, /nothing is installed here/);
});

// ── the failure path: §10's "una verificación fallida conserva la instalación" ──

test('gr11 · a failed onboarding verification rolls back, explains the blockage, and leaves no partial state',
  { timeout: 300000 }, async () => {
    const { applyAcceptedOnboarding } = await import('../scripts/lib/onboarding-apply.js');
    const { buildOnboardingPlan, identifyPlan, normalizeOnboarding, scanProject } = await import('../scripts/lib/onboarding.js');
    const cwd = scratch('gr-rollback-');
    writeFileSync(join(cwd, 'app.py'), 'x = 1\n');
    const record = normalizeOnboarding({
      technicalLevel: 'technical', accompaniment: 'L1', projectKind: 'software',
      softwareScope: 'small', goal: 'prueba', targets: ['claude'],
    });
    const plan = buildOnboardingPlan(record, scanProject(cwd));
    const planId = identifyPlan(plan);

    // The failure injected where a real one happens: `apply` is the install step, and the contract
    // of this function is that ANY throw inside the try block rolls the whole transaction back.
    let error = null;
    try {
      await applyAcceptedOnboarding({
        cwd, plan, planId,
        apply: async () => { throw new Error('disk full halfway through'); },
      });
    } catch (e) { error = e; }

    assert.ok(error, 'the failure must surface, not be swallowed');
    assert.match(error.message, /^RSC_ONBOARDING_INCOMPLETE/, error.message);
    // "explica el bloqueo": the cause AND the way out, in the error itself.
    assert.match(error.message, /disk full halfway through/, 'the real cause is named');
    assert.match(error.message, /Recover with: .*onboard/, 'and the exact command to recover');
    // "sin estados parcialmente activados": the receipt is what makes a harness "accepted", and a
    // rolled-back transaction must not have left one.
    const manifest = existsSync(join(cwd, '.rsc.json'))
      ? JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'))
      : null;
    assert.ok(!manifest?.onboarding?.acceptedPlanId,
      `a rolled-back onboarding must leave no accepted receipt: ${JSON.stringify(manifest?.onboarding ?? null)}`);
  });

test('gr12 · the rollback runs the same `restoreBackup`, so it reports ungoverned bases too',
  { timeout: 300000 }, async () => {
    // D13's second half, which the stage-4 report flagged and nothing covered: `restoreBackup` is
    // invoked automatically as the onboarding rollback, not only from `rscg restore`. The nuance is
    // real and kept — a rollback returns the project to a state it was already in, so it invents no
    // missing contract — but the consumer still ends up reading skills with no contract, and the
    // error is the only place that can say so.
    const { applyInstall } = await import('../scripts/install-apply.js');
    const { applyAcceptedOnboarding } = await import('../scripts/lib/onboarding-apply.js');
    const { buildOnboardingPlan, identifyPlan, normalizeOnboarding, scanProject } = await import('../scripts/lib/onboarding.js');
    const source = readFileSync(join(ROOT, 'scripts', 'lib', 'onboarding-apply.js'), 'utf8');
    assert.match(source, /ungovernedAmong/, 'the rollback path must consult the same audit');

    const cwd = scratch('gr-rollback2-');
    const home = scratch('gr-rollback2-home-');
    writeFileSync(join(cwd, 'app.py'), 'x = 1\n');
    await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'claude', home, cwd });
    rewindToUpstream(cwd, 'flutter');

    const record = normalizeOnboarding({
      technicalLevel: 'technical', accompaniment: 'L1', projectKind: 'software',
      softwareScope: 'small', goal: 'prueba', targets: ['claude'],
    });
    const plan = buildOnboardingPlan(record, scanProject(cwd));
    let error = null;
    try {
      await applyAcceptedOnboarding({
        cwd, plan, planId: identifyPlan(plan),
        apply: async () => { throw new Error('injected'); },
      });
    } catch (e) { error = e; }
    assert.ok(error);
    assert.match(error.message, /without a governance\s+contract|without a governance contract/,
      `the rollback must say what it left behind:\n${error.message}`);
    assert.match(error.message, /rscg conformance/, 'and how to look at it');
  });

test('gr13 · `rscg doctor` reports an ungoverned base, and does NOT call it unhealthy',
  { timeout: 300000 }, async () => {
    // PROPUESTAS point 3, option 2. `healthy` means "the installed harness works", which is what CI
    // and editor extensions built on #277 read — and an ungoverned skill works, it just works with
    // no contract. Different question, different field.
    const { doctor } = await import('../scripts/doctor.js');
    const { cwd, home } = await installed(['suggest', 'flutter', 'orient']);

    const clean = doctor({ cwd, target: 'claude', home });
    assert.equal(clean.governance.installed, 3, JSON.stringify(clean.governance));
    assert.equal(clean.governance.governed, 3);
    assert.deepEqual(clean.governance.ungoverned, []);

    rewindToUpstream(cwd, 'flutter');
    const dirty = doctor({ cwd, target: 'claude', home });
    assert.equal(dirty.governance.governed, 2, JSON.stringify(dirty.governance));
    assert.deepEqual(dirty.governance.ungoverned.map((u) => u.id), ['flutter']);
    assert.match(dirty.governance.ungoverned[0].path, /\.rsc[/\\]skills[/\\]flutter[/\\]SKILL\.md/);
    assert.match(dirty.governance.ungoverned[0].action, /sync/);
    assert.equal(dirty.healthy, clean.healthy,
      'governance state must not move `healthy`: that field answers a different question');
  });

test('gr14 · a sync governs the restored bases again, and is idempotent doing it',
  { timeout: 300000 }, async () => {
    // The way out the warning names has to actually work, or the message is advice nobody can take.
    const { applyInstall } = await import('../scripts/install-apply.js');
    const { governanceOf } = await import('../scripts/lib/governance.js');
    const { cwd, home, ids, target } = await installed(['suggest', 'flutter']);
    rewindToUpstream(cwd, 'flutter');

    await applyInstall({ skillIds: ids, target, home, cwd, operation: 'sync' });
    const governed = readFileSync(base(cwd, 'flutter'), 'utf8');
    assert.equal(governanceOf(governed).complete, true, 'the sync governed it again');

    await applyInstall({ skillIds: ids, target, home, cwd, operation: 'sync' });
    assert.equal(readFileSync(base(cwd, 'flutter'), 'utf8'), governed,
      'and a second sync is byte-identical (criterion 5), so the advice is safe to repeat');
  });
