import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
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

// ── the instrument gr11 needed and did not have: the project tree, before and after ──
//
// `.rsc/backups/` is excluded from BOTH the comparison and the emptiness test, and that exclusion is
// the one judgement call in here, so it is written down rather than hidden in a filter: the snapshot
// the transaction took is the recovery artifact itself. `applyAcceptedOnboarding` deliberately keeps
// `.rsc/backups/` out of the snapshot set, so a rollback cannot and must not delete it. Counting it
// as residue would report the recovery mechanism as a leak.
const SNAPSHOT_STORE = /^\.rsc[/\\]backups([/\\]|$)/;

/** rel path → a content identity: `dir`, `link:<target>`, or `file:<sha256 prefix>`. */
function treeOf(root) {
  const out = new Map();
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const abs = join(dir, e.name);
      const rel = relative(root, abs).split(sep).join('/');
      if (SNAPSHOT_STORE.test(rel)) continue;
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) { out.set(rel, `link:${readlinkSync(abs)}`); continue; }
      if (st.isDirectory()) { out.set(rel, 'dir'); walk(abs); continue; }
      out.set(rel, `file:${createHash('sha256').update(readFileSync(abs)).digest('hex').slice(0, 16)}`);
    }
  };
  walk(root);
  return out;
}

/** True when nothing but (possibly) the snapshot store lives anywhere beneath `rel`. */
function holdsNothing(root, rel) {
  const stack = [join(root, rel)];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const child = relative(root, join(dir, e.name)).split(sep).join('/');
      if (SNAPSHOT_STORE.test(child)) continue;
      if (e.isDirectory() && !e.isSymbolicLink()) { stack.push(join(dir, e.name)); continue; }
      return false;
    }
  }
  return true;
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

// ── D13 in the DRY RUN, which is where the decision is actually taken ─────────

test('gr02b · `restore --dry-run` names the ungoverned bases the snapshot HOLDS, and still writes nothing',
  { timeout: 300000 }, async () => {
    // M3 of stage 6's review. The whole D13 warning used to live inside `if (!dry)`, measured on
    // this very scenario: 0 warning lines in the dry run, the warning in the real restore. The dry
    // run is the tool a consumer uses to DECIDE whether to restore, so it was silent exactly where
    // the consequence matters.
    //
    // This test also pins WHICH bytes are audited, and that is the part a weaker fix would get
    // wrong. At the moment of the dry run the project's `flutter` is GOVERNED — the step-3 install
    // governed it — and the SNAPSHOT is the thing holding the ungoverned copy. So a dry run that
    // audited the project would report nothing and pass a test that only checked for silence.
    const { applyInstall } = await import('../scripts/install-apply.js');
    const { governanceOf } = await import('../scripts/lib/governance.js');
    const { cwd, home, ids, target } = await installed(['suggest', 'flutter']);
    rewindToUpstream(cwd, 'flutter');
    await applyInstall({ skillIds: ids, target, home, cwd });

    const onDisk = readFileSync(base(cwd, 'flutter'), 'utf8');
    assert.equal(governanceOf(onDisk).complete, true,
      'precondition: the INSTALLED base is governed, so only the snapshot can be the source of the finding');

    const out = run(cwd, ['restore', 'latest', '--dry-run']);
    assert.equal(out.status ?? 0, 0, out.stderr);
    const said = `${out.stdout}${out.stderr}`;
    assert.match(said, /Would restore/, 'it is still a dry run');
    assert.match(said, /carry NO governance contract/, `the dry run said nothing about it:\n${said}`);
    assert.match(said, /flutter/, 'and it names which ones');
    assert.match(said, /would be correct/, 'in the conditional: nothing has happened yet');
    assert.match(said, /run a sync here/i, 'and what puts it back');
    assert.match(said, /rscg conformance/, 'and where to see the whole picture');
    assert.equal(readFileSync(base(cwd, 'flutter'), 'utf8'), onDisk,
      'and a dry run that now READS the snapshot must still not WRITE the project');
  });

test('gr02c · and the dry run is silent when the snapshot holds governed bases',
  { timeout: 300000 }, async () => {
    // The half that makes gr02b falsifiable: a dry run that printed the warning unconditionally
    // would pass gr02b and be useless. Two governed installs in a row, so the snapshot holds a
    // governed base.
    const { applyInstall } = await import('../scripts/install-apply.js');
    const { cwd, home, ids, target } = await installed(['suggest', 'flutter']);
    await applyInstall({ skillIds: ids, target, home, cwd });
    const out = run(cwd, ['restore', 'latest', '--dry-run']);
    assert.equal(out.status ?? 0, 0, out.stderr);
    assert.match(out.stdout, /Would restore/);
    assert.doesNotMatch(`${out.stdout}${out.stderr}`, /NO governance contract/,
      'a snapshot of governed bases must produce no warning, in either mode');
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
  { timeout: 600000 }, async () => {
    // REWRITTEN after M4 of stage 6's review, which is the correction that mattered most here. The
    // old version was the only test in this file carrying the words "leaves no partial state" and it
    // COULD NOT FAIL: it injected the failure into the FIRST `apply`, so nothing had ever been
    // written, and it asserted the absence of a receipt — which is equally absent with the rollback
    // and with the rollback deleted. The reviewer proved it by replacing `restoreBackup` with
    // `{ changed: [] }` — deleting the rollback outright — and watching it stay green. In the whole
    // file there were two `existsSync` calls and nothing at all about residue on disk.
    //
    // So this now runs the hard case: TWO targets, the first one installed for real, the failure
    // injected AFTER that install completed — and it compares the tree after the rollback against
    // the tree before the transaction, which is the property the words claim.
    const { applyInstall } = await import('../scripts/install-apply.js');
    const { applyAcceptedOnboarding } = await import('../scripts/lib/onboarding-apply.js');
    const { buildOnboardingPlan, identifyPlan, normalizeOnboarding, scanProject } = await import('../scripts/lib/onboarding.js');
    const cwd = scratch('gr-rollback-');
    const home = scratch('gr-rollback-home-');
    writeFileSync(join(cwd, 'app.py'), 'x = 1\n');
    const record = normalizeOnboarding({
      technicalLevel: 'technical', accompaniment: 'L1', projectKind: 'software',
      softwareScope: 'small', goal: 'prueba', targets: ['claude', 'codex'],
    });
    const plan = buildOnboardingPlan(record, scanProject(cwd));
    const planId = identifyPlan(plan);
    assert.equal(plan.policy.targets.length, 2, 'the hard case needs a second target to fail on');
    assert.ok(plan.policy.skills.length > 1, `${plan.policy.skills.length} skills — the install must be real`);

    const before = treeOf(cwd);

    // The failure injected where a real one happens, and at the moment that makes the rollback
    // load-bearing: the first target is installed by the REAL installer, and the second throws.
    let calls = 0;
    let error = null;
    try {
      await applyAcceptedOnboarding({
        cwd, plan, planId,
        apply: async (args) => {
          calls += 1;
          if (calls === 1) return applyInstall({ ...args, home });
          throw new Error('disk full halfway through');
        },
      });
    } catch (e) { error = e; }

    assert.equal(calls, 2, 'the first target must have been installed before the failure');
    assert.ok(error, 'the failure must surface, not be swallowed');
    assert.match(error.message, /^RSC_ONBOARDING_INCOMPLETE/, error.message);
    // "explica el bloqueo": the cause AND the way out, in the error itself.
    assert.match(error.message, /disk full halfway through/, 'the real cause is named');
    assert.match(error.message, /Recover with: .*onboard/, 'and the exact command to recover');

    // "sin estados parcialmente activados", measured on the FILESYSTEM and not only in the receipt.
    const after = treeOf(cwd);
    const residue = [...after.keys()].filter((p) => !before.has(p)).sort();
    const deleted = [...before.keys()].filter((p) => !after.has(p)).sort();
    const changed = [...before.keys()].filter((p) => after.has(p) && after.get(p) !== before.get(p)).sort();
    assert.deepEqual(deleted, [], `the rollback deleted work that was there before the transaction: ${deleted.join(', ')}`);
    assert.deepEqual(changed, [], `the rollback left pre-existing files altered: ${changed.join(', ')}`);

    // Residue is tolerated in exactly one shape, and it is NAMED rather than waved past: an empty
    // directory. `rmSync` of a file does not remove the directory that held it, so the install's
    // own roots can survive as hollow shells. They carry no state and no assistant reads them, but a
    // test that allowed "some residue" would have allowed the whole install back.
    const hollow = residue.filter((p) => after.get(p) === 'dir' && holdsNothing(cwd, p));
    const real = residue.filter((p) => !hollow.includes(p));
    assert.deepEqual(real, [],
      `the rollback left real state behind (${real.length} of ${residue.length} residual paths): ${real.join(', ')}`);
    assert.deepEqual(
      hollow.filter((p) => !/^(\.rsc|\.claude|\.codex)(\/|$)/.test(p)), [],
      `empty directories outside the harness's own roots are not tolerated either: ${hollow.join(', ')}`,
    );
    // Named, with their count, so a change in this number is a change somebody has to look at.
    assert.deepEqual(hollow.sort(), ['.claude', '.claude/commands', '.claude/skills', '.rsc', '.rsc/governance', '.rsc/skills'],
      `the empty directories the rollback leaves are declared, not whatever shows up: ${hollow.join(', ')}`);

    // And the receipt, which is what makes a harness "accepted".
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

test('gr15 · "evita carreras": one background installer per version, measured by counting launches',
  { timeout: 300000 }, async () => {
    // M7 of stage 6's review: §10 asks to "evitar carreras y estados parcialmente activados", and
    // stage 6 addressed the second half and never mentioned the first — `grep -in "carrera|race"`
    // over the three documents returned 0. The mechanism EXISTS and is inherited, so this is a hole
    // in verification and in declaration, not a defect. Here is the verification.
    //
    // Three guards, and this test counts the launches rather than reading the state file, because
    // "it wrote a lock" and "it did not start a second installer" are different claims:
    //   1. the version is PINNED to the one this session saw, never `@latest`;
    //   2. `.rsc/auto-update.json` + AUTO_RUNNING_MS (15 min): a session that starts while an
    //      attempt is in flight for the same version prints progress and launches NOTHING;
    //   3. AUTO_RETRY_MS (24 h): one attempt per version per day, and a failure falls back to ASKING
    //      instead of retrying in a loop.
    const { updateNotice } = await import('../targets/auto-update.mjs');
    const cwd = scratch('gr-race-');
    mkdirSync(join(cwd, '.rsc'), { recursive: true });
    writeFileSync(join(cwd, '.rsc', '.version'), '3.7.0\n');
    writeFileSync(join(cwd, '.rsc.json'), JSON.stringify({ targets: ['claude'], skills: [] }));
    const tally = join(cwd, 'launches.txt');
    const env = {
      RSC_LATEST: '3.7.9',
      RSC_AUTO_UPDATE_CMD: JSON.stringify(['sh', '-c', `echo launched >> ${tally}`]),
    };
    const launches = () => (existsSync(tally) ? readFileSync(tally, 'utf8').trim().split('\n').filter(Boolean).length : 0);
    const settle = async () => {
      for (let i = 0; i < 60 && !existsSync(tally); i += 1) await new Promise((r) => setTimeout(r, 50));
      await new Promise((r) => setTimeout(r, 150));
    };

    const first = await updateNotice(cwd, env);
    assert.match(first, /installing itself in the background/, first);
    await settle();
    assert.equal(launches(), 1, 'the first session starts exactly one installer');

    // Guard 1: the pin. The argv carries the version this session saw, so two sessions that saw
    // different `latest` cannot race over "whatever is published right now".
    const state = JSON.parse(readFileSync(join(cwd, '.rsc', 'auto-update.json'), 'utf8'));
    assert.equal(state.to, '3.7.9', JSON.stringify(state));
    assert.equal(state.from, '3.7.0');

    // Guard 2: the concurrent session. Same project, same version, inside the window.
    const second = await updateNotice(cwd, env);
    assert.match(second, /still installing itself in the background/, second);
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(launches(), 1, 'a second session inside the window must NOT start a second installer');

    // Guard 3a: past the 15-minute window but inside the day → it ASKS, and still launches nothing.
    const backdate = (ms) => writeFileSync(join(cwd, '.rsc', 'auto-update.json'),
      JSON.stringify({ ...state, startedAt: new Date(Date.now() - ms).toISOString() }));
    backdate(60 * 60 * 1000);
    const asks = await updateNotice(cwd, env);
    assert.match(asks, /did not finish/, asks);
    assert.match(asks, /retries once a day/, asks);
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(launches(), 1, 'a failed attempt falls back to asking, it does not retry in a loop');

    // Guard 3b: past the day → one more attempt, and exactly one.
    backdate(25 * 60 * 60 * 1000);
    const retry = await updateNotice(cwd, env);
    assert.match(retry, /installing itself in the background/, retry);
    for (let i = 0; i < 60 && launches() < 2; i += 1) await new Promise((r) => setTimeout(r, 50));
    assert.equal(launches(), 2, 'after a day it retries, once');
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
