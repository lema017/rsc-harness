import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Stage 6 — the `doctor` half of D13, and the contract it must NOT disturb.
//
// `PROPUESTAS.md` point 3 recommended option 2 — name the ungoverned base rather than re-govern it —
// in two places: `rscg restore` says it at the moment it happens, and `rscg doctor` reports it
// whenever anyone looks. `tests/governance-recovery.test.js` gr13 measures the reporting; this file
// measures the things that are easy to break while adding a field to a report 15 other tests read:
// the exit code, the meaning of `healthy`, and the refusal to fail for asking an extra question.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'scripts', 'rsc.js');

const TMP = [];
function scratch(prefix) {
  const d = mkdtempSync(join(tmpdir(), prefix));
  TMP.push(d);
  return d;
}
test.after(() => {
  for (const d of TMP) {
    try { chmodSync(join(d, '.rsc', 'skills', 'flutter'), 0o755); } catch { /* not every fixture locks one */ }
    rmSync(d, { recursive: true, force: true });
  }
});

async function project(ids = ['suggest', 'flutter']) {
  const { applyInstall } = await import('../scripts/install-apply.js');
  const cwd = scratch('gd-project-');
  const home = scratch('gd-home-');
  await applyInstall({ skillIds: ids, target: 'claude', home, cwd });
  return { cwd, home };
}

test('gd01 · doctor answers the governance question even with nothing installed, and does not throw', async () => {
  const { doctor } = await import('../scripts/doctor.js');
  const cwd = scratch('gd-empty-');
  const report = doctor({ cwd, target: 'claude', home: scratch('gd-empty-home-') });
  assert.ok(report.governance, 'the field must always be present, or a reader has to branch on its absence');
  assert.equal(report.governance.installed, 0);
  assert.equal(report.governance.governed, 0);
  assert.deepEqual(report.governance.ungoverned, []);
  assert.match(report.governance.reason, /nothing is installed/, JSON.stringify(report.governance));
});

test('gd02 · the exit code still means "the installed harness works", not "everything is ideal"',
  { timeout: 300000 }, async () => {
    // #277 built the exit code for CI and editor extensions, and #289/#298 kept it meaning exactly
    // one thing. An ungoverned skill WORKS — it just works with no contract — so folding it into
    // `healthy` would change the meaning of a number other tools already read.
    const { cwd } = await project(['suggest', 'flutter']);
    const clean = spawnSync(process.execPath, [CLI, 'doctor'], { cwd, encoding: 'utf8' });
    assert.equal(clean.status ?? 0, 0, `${clean.stdout}${clean.stderr}`);

    writeFileSync(join(cwd, '.rsc', 'skills', 'flutter', 'SKILL.md'),
      readFileSync(join(ROOT, 'skills', 'flutter', 'SKILL.md'), 'utf8'));
    const dirty = spawnSync(process.execPath, [CLI, 'doctor'], { cwd, encoding: 'utf8' });
    assert.equal(dirty.status ?? 0, 0,
      'an ungoverned base must NOT change doctor\'s exit code; `rscg conformance` is the command that does');
  });

test('gd03 · an unreadable base is reported as unreadable, not as governed and not as absent',
  { timeout: 300000 }, async () => {
    // The same distinction contract §2 makes about customizations: absent, broken and fine are three
    // states, and a report that collapses any two of them turns an instruction into its opposite.
    const { doctor } = await import('../scripts/doctor.js');
    const { cwd, home } = await project(['suggest', 'flutter']);
    const md = join(cwd, '.rsc', 'skills', 'flutter', 'SKILL.md');
    rmSync(md);
    const report = doctor({ cwd, target: 'claude', home });
    const flutter = report.governance.ungoverned.find((u) => u.id === 'flutter');
    assert.ok(flutter, JSON.stringify(report.governance));
    assert.match(flutter.reasons[0], /no SKILL\.md/, flutter.reasons.join('; '));
    assert.equal(report.governance.installed, 2, 'the base directory is still installed; its file is gone');
    assert.equal(report.governance.governed, 1);
  });

test('gd04 · doctor never fails for asking the extra question', { timeout: 300000 }, async () => {
  // The convention this file inherits, written at the `onboarding` field: "a report must never fail
  // for asking an extra question". Proved by making the question impossible to answer.
  const { doctor } = await import('../scripts/doctor.js');
  const { cwd, home } = await project(['suggest', 'flutter']);
  const dir = join(cwd, '.rsc', 'skills', 'flutter');
  chmodSync(dir, 0o000);
  let report;
  try {
    report = doctor({ cwd, target: 'claude', home });
  } finally {
    chmodSync(dir, 0o755);
  }
  assert.ok(report, 'doctor returned a report rather than throwing');
  assert.ok(report.governance, 'and it still carries the field');
  // Either it classified the base as unreadable, or the platform let it read anyway. Both are fine;
  // throwing is not.
  assert.ok(typeof report.governance.installed === 'number' || report.governance.error,
    JSON.stringify(report.governance));
});

test('gd05 · the governance field names the path and the way back, in the shape doctor already uses',
  { timeout: 300000 }, async () => {
    // #277: the three "missing" lists share one shape, `{ id, path, action }`, so whoever builds on
    // top of doctor reads them the same way. A new list with a new shape is a new thing to learn.
    const { doctor } = await import('../scripts/doctor.js');
    const { cwd, home } = await project(['suggest', 'flutter']);
    writeFileSync(join(cwd, '.rsc', 'skills', 'flutter', 'SKILL.md'),
      readFileSync(join(ROOT, 'skills', 'flutter', 'SKILL.md'), 'utf8'));
    const [entry] = doctor({ cwd, target: 'claude', home }).governance.ungoverned;
    for (const key of ['id', 'path', 'action', 'reasons']) {
      assert.ok(Object.hasOwn(entry, key), `the entry is missing \`${key}\`: ${JSON.stringify(entry)}`);
    }
    assert.match(entry.action, /idempotent/, 'the action has to be safe to repeat, and say so');
  });

test('gd06 · doctor reads the BASES only, so a diagnostic does not become a 274×18 sweep',
  { timeout: 300000 }, async () => {
    // The boundary between the two commands, asserted rather than assumed: `doctor` answers cheaply
    // and `rscg conformance` answers completely. If this ever flips, doctor gets slow for everyone.
    const { doctor } = await import('../scripts/doctor.js');
    const { cwd, home } = await project(['suggest', 'flutter']);
    const report = doctor({ cwd, target: 'claude', home });
    assert.ok(!report.governance.targets, 'doctor must not carry per-target delivery results');
    const source = readFileSync(join(ROOT, 'scripts', 'doctor.js'), 'utf8');
    assert.match(source, /deliveries: false/, 'and it must ask for the cheap half explicitly');
  });
