// The customization validator, its two invocation points, and the survival of the files it checks.
// Acceptance criteria 8 and 9's deterministic halves.
//
// The negative test is the one that makes criterion 8 falsifiable, and it is written to the letter
// of CUSTOMIZATION-SCHEMA.md §3: one file with broken frontmatter, no `scope`, and a decision that
// tries to disable a guard must produce errors that NAME THE FILE AND THE RULE. Silence fails. An
// error that does not name the file fails too — which is why every assertion below checks the text
// of the message, not just a count.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyInstall, syncInstalled, purgeReport } from '../scripts/install-apply.js';
import {
  CUSTOMIZATION_ROOT, REQUIRED_KEYS, errorsOf, formatFindings, validateCustomizationSource,
  validateCustomizations,
} from '../scripts/lib/customization-validator.js';

const VALID = `---
skill: flutter
governance: v1
status: approved
updated: 2026-11-01
type: skill-customization
catalog-version: 3.7.4
reevaluate-when: the flutter skill changes its state-management recommendation, or apps/mobile adopts a second state library
scope:
  - apps/mobile
evidence: codebase analysis 2026-11-01, accepted by the user
---

# flutter — project customization

## Decisions

- **Riverpod for state management.**
  Category: approved convention · Scope: apps/mobile
  Evidence: \`apps/mobile/lib/main.dart:14\`; 31 of 34 providers use it
  Decided: 2026-11-01, accepted by the user

- **Widget tests live beside the widget.**
  Category: observed pattern · Scope: apps/mobile
  Evidence: 48 of 52 test files sit next to their subject
  Note: unratified. Follow for consistency; do not cite as a rule

## Out of scope

Navigation, networking, build flavors and CI.

## Migrations

- **\`legacy/\` from \`setState\` to Riverpod.**
  Current: 9 widgets on \`setState\` · Target: Riverpod, matching the convention
  **Requires a decision** — not scheduled, not started
`;

// Broken frontmatter (a line that is neither `key: value` nor a list item), no `scope`, and a
// decision that states it turns off a guard.
const BROKEN = `---
skill: flutter
governance: v1
status: approved
updated: 2026-11-01
type: skill-customization
catalog-version: 3.7.4
reevaluate-when: when the mobile app changes state library
evidence ERROR this line has no colon
---

# flutter

## Decisions

- **Commits here skip the gitmoji guard.**
  Category: approved convention · Scope: repo
  Evidence: the team voted on it
  Decided: 2026-11-01

## Out of scope

Nothing.
`;

function project(files = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cust-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(cwd, ...rel.split('/'));
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, body);
  }
  return cwd;
}

const customizationFile = (id) => `${CUSTOMIZATION_ROOT.split(/[/\\]/).join('/')}/${id}/README.md`;

// ---------------------------------------------------------------- the schema's nine rules

test('the nine required keys are exactly the nine the schema names', () => {
  assert.deepEqual(REQUIRED_KEYS, [
    'skill', 'governance', 'status', 'updated', 'scope', 'evidence',
    'type', 'catalog-version', 'reevaluate-when',
  ]);
});

test('a well-formed customization produces no errors', () => {
  const result = validateCustomizationSource({
    file: '/p/02-DOCS/wiki/skills/flutter/README.md', src: VALID, dirName: 'flutter', catalog: ['flutter'],
  });
  assert.deepEqual(result.findings, [], 'the worked example from the schema must validate clean');
  assert.equal(result.orphaned, false);
});

test('THE NEGATIVE TEST — broken frontmatter, no scope and a guard-disabling decision are each named', () => {
  const file = '/p/02-DOCS/wiki/skills/flutter/README.md';
  const result = validateCustomizationSource({ file, src: BROKEN, dirName: 'flutter', catalog: ['flutter'] });
  const errors = errorsOf(result);

  assert.ok(errors.length >= 3, `silence is a failure; got ${errors.length} error(s)`);
  // Every finding names the file. An error that does not is the same as silence to whoever fixes it.
  for (const e of errors) {
    assert.equal(e.file, file, 'every finding names the file');
    assert.ok(e.rule && e.rule.length > 0, 'every finding names the rule');
  }

  const unparseable = errors.find((e) => e.ruleId === 'R1' && /is not a `key: value` pair/.test(e.message));
  assert.ok(unparseable, 'rule 1: the unreadable frontmatter line must be named');
  assert.match(unparseable.message, /line 9/, 'and located');
  assert.match(unparseable.message, /evidence ERROR/, 'and quoted, so it can be found');

  const noScope = errors.find((e) => e.ruleId === 'R1' && /scope/.test(e.message));
  assert.ok(noScope, 'rules 1 and 4: a missing `scope` is an error, never an implicit "everywhere"');

  const guard = errors.find((e) => e.ruleId === 'R8');
  assert.ok(guard, 'rule 8: an attempt to disable a guard is itself the finding');
  assert.match(guard.rule, /rule 8/);
  assert.match(guard.message, /gitmoji guard/i, 'the offending decision is named');
  assert.match(guard.message, /precedence level 1/, 'and the reason it cannot be done from this file');

  // The rendered form a human reads must carry both the path and the rule on every line.
  const lines = formatFindings(result, '/p');
  for (const line of lines) {
    assert.match(line, /02-DOCS\/wiki\/skills\/flutter\/README\.md/, `a finding without its file: ${line}`);
    assert.match(line, / — /, `a finding without its rule: ${line}`);
  }
});

test('rule 2 — a skill name that disagrees with its directory is named', () => {
  const src = VALID.replace('skill: flutter', 'skill: react');
  const errors = errorsOf(validateCustomizationSource({
    file: '/p/x/flutter/README.md', src, dirName: 'flutter', catalog: ['flutter', 'react'],
  }));
  assert.ok(errors.some((e) => e.ruleId === 'R2' && /`skill: react`/.test(e.message) && /`flutter`/.test(e.message)));
});

test('§4 — a customization for a skill the catalog no longer ships is reported as ORPHANED, not deleted', () => {
  const result = validateCustomizationSource({
    file: '/p/x/gone/README.md', src: VALID.replace('skill: flutter', 'skill: gone'), dirName: 'gone', catalog: ['flutter'],
  });
  assert.equal(result.orphaned, true);
  assert.deepEqual(errorsOf(result), [], 'an orphan is a fact about the catalog, not a defect in the file');
  const orphan = result.findings.find((f) => f.severity === 'orphaned');
  assert.match(orphan.message, /survives on disk/);
  assert.match(orphan.message, /migration requiring a decision, never an automatic rehome/,
    'criterion 12: a rename is never applied silently');
});

test('rules 3, 4b, 4c — status, type and a reevaluate-when that is only a date', () => {
  const bad = VALID
    .replace('status: approved', 'status: ratified')
    .replace('type: skill-customization', 'type: doc')
    .replace(/reevaluate-when: .*/, 'reevaluate-when: 2027-01-01');
  const errors = errorsOf(validateCustomizationSource({ file: '/p/x/flutter/README.md', src: bad, dirName: 'flutter' }));
  assert.ok(errors.some((e) => e.ruleId === 'R3' && /ratified/.test(e.message)), 'rule 3');
  assert.ok(errors.some((e) => e.ruleId === 'R4b' && /skill-customization/.test(e.message)), 'rule 4b');
  assert.ok(errors.some((e) => e.ruleId === 'R4c' && /is a date/.test(e.message)), 'rule 4c');
});

test('rule 5 — the two required sections are each named when missing', () => {
  const errors = errorsOf(validateCustomizationSource({
    file: '/p/x/flutter/README.md',
    src: VALID.replace('## Out of scope', '## Notes'),
    dirName: 'flutter',
  }));
  assert.ok(errors.some((e) => e.ruleId === 'R5' && /Out of scope/.test(e.message)),
    '`## Out of scope` is required because its absence is what makes a customization metastasize');
});

test('rule 6 — a decision with no category, and one with no evidence, are both named', () => {
  const src = VALID.replace(
    '  Category: approved convention · Scope: apps/mobile\n  Evidence: `apps/mobile/lib/main.dart:14`; 31 of 34 providers use it\n',
    '  Scope: apps/mobile\n',
  );
  const errors = errorsOf(validateCustomizationSource({ file: '/p/x/flutter/README.md', src, dirName: 'flutter' }));
  assert.ok(errors.some((e) => e.ruleId === 'R6' && /names no category/.test(e.message)));
  assert.ok(errors.some((e) => e.ruleId === 'R6' && /no `Evidence:` reference/.test(e.message)));
  assert.ok(errors.every((e) => /Riverpod/.test(e.message) || e.ruleId !== 'R6'),
    'the offending decision is identified by name');
});

test('rule 6 — a HEDGED category is a finding, not silently promoted to the first match', () => {
  // The defect this pins, found by the independent review of stage 2: the category used to be
  // resolved with `CATEGORIES.find((c) => line.includes(c))` over a list whose first element is
  // `approved convention`. A line reading «observed pattern, not an approved convention» therefore
  // resolved to `approved convention`, with no finding at all — silently promoting an accident in
  // the codebase to law, which CUSTOMIZATION-SCHEMA.md §2 names as the reason this schema exists.
  //
  // The mutation that proves this test bites: replace the exact match with `CATEGORIES[0]`, or go
  // back to the `includes` form. Both must fail here.
  const src = VALID.replace(
    '  Category: approved convention · Scope: apps/mobile\n',
    '  Category: observed pattern, not an approved convention · Scope: apps/mobile\n',
  );
  const errors = errorsOf(validateCustomizationSource({ file: '/p/x/flutter/README.md', src, dirName: 'flutter' }));
  assert.ok(errors.some((e) => e.ruleId === 'R6' && /not one of the six categories exactly/.test(e.message)),
    `a hedged category must be reported, never resolved. Got: ${JSON.stringify(errors.map((e) => e.message))}`);
  // And the quoted value must be the hedge itself, so the reader sees what was written.
  assert.ok(errors.some((e) => e.ruleId === 'R6' && /observed pattern, not an approved convention/.test(e.message)),
    'the finding must quote what the file actually said');
});

test('rule 7 — a migration that omits target or the decision it requires is named', () => {
  const src = VALID.replace(
    '  Current: 9 widgets on `setState` · Target: Riverpod, matching the convention\n  **Requires a decision** — not scheduled, not started\n',
    '  Current: 9 widgets on `setState`\n  Scheduled for the next sprint\n',
  );
  const errors = errorsOf(validateCustomizationSource({ file: '/p/x/flutter/README.md', src, dirName: 'flutter' }));
  assert.ok(errors.some((e) => e.ruleId === 'R7' && /Current:` and `Target:/.test(e.message)));
  assert.ok(errors.some((e) => e.ruleId === 'R7' && /requires a decision/i.test(e.message)),
    'detecting a migration never executes it');
});

test('a file with no frontmatter at all is named, not skipped', () => {
  const errors = errorsOf(validateCustomizationSource({
    file: '/p/x/flutter/README.md', src: '# flutter\n\nwe use Riverpod.\n', dirName: 'flutter',
  }));
  assert.ok(errors.some((e) => /no frontmatter block/.test(e.message)));
});

// ---------------------------------------------------------------- absent is not broken

test('absence is valid: no 02-DOCS/wiki/skills/ means nothing to validate and no finding', () => {
  const cwd = project();
  const report = validateCustomizations({ cwd });
  assert.equal(report.ran, false, 'the validator does not run where there is nothing to check');
  assert.deepEqual(report.findings, [], 'and absence is never itself a finding (contract §2)');
});

test('a directory with no README is named — somebody made that directory', () => {
  const cwd = project();
  mkdirSync(join(cwd, ...CUSTOMIZATION_ROOT.split(/[/\\]/), 'flutter'), { recursive: true });
  const report = validateCustomizations({ cwd });
  assert.equal(report.ran, true);
  assert.ok(errorsOf(report).some((e) => /carries no README\.md/.test(e.message)));
});

// ---------------------------------------------------------------- invocation points

test('install runs the validator when 02-DOCS/wiki/skills/ exists, and names the broken file', async () => {
  const cwd = project({ [customizationFile('flutter')]: BROKEN });
  const home = mkdtempSync(join(tmpdir(), 'rsc-cust-home-'));
  const state = await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'claude', home, cwd });

  assert.equal(state.governance.customizations.ran, true, 'install is one of the two invocation points');
  assert.ok(state.governance.customizations.errors >= 3, 'and it reports what it found');
  const findings = state.governance.customizations.findings;
  assert.ok(findings.every((f) => f.file.includes('flutter')), 'every finding names the file');
  assert.ok(findings.some((f) => f.ruleId === 'R8'), 'including the guard-disabling decision');

  // Persisted next to the contract, so the finding outlives the command that produced it.
  const report = JSON.parse(readFileSync(join(cwd, '.rsc', 'governance', 'customizations.json'), 'utf8'));
  assert.equal(report.errors, state.governance.customizations.errors);
});

test('a broken customization does not abort the install — the contract says ask, not die', async () => {
  const cwd = project({ [customizationFile('flutter')]: BROKEN });
  const home = mkdtempSync(join(tmpdir(), 'rsc-cust-home2-'));
  const state = await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'claude', home, cwd });
  assert.ok(existsSync(join(cwd, '.claude', 'skills', 'flutter')), 'the harness still installed');
  assert.ok(state.governance.customizations.errors > 0, 'and the problem is reported, not swallowed');
});

test('sync runs the validator too', async () => {
  const cwd = project({ [customizationFile('flutter')]: BROKEN });
  const home = mkdtempSync(join(tmpdir(), 'rsc-cust-home3-'));
  await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'claude', home, cwd });
  rmSync(join(cwd, '.rsc', 'governance', 'customizations.json'), { force: true });

  await syncInstalled({ target: 'claude', home, cwd });

  const report = JSON.parse(readFileSync(join(cwd, '.rsc', 'governance', 'customizations.json'), 'utf8'));
  assert.equal(report.ran, true, 'sync is the second invocation point');
  assert.ok(report.errors >= 3);
});

test('an orphaned customization is reported by install and left on disk', async () => {
  const cwd = project({
    [customizationFile('a-skill-that-never-existed')]: VALID.replace('skill: flutter', 'skill: a-skill-that-never-existed'),
  });
  const home = mkdtempSync(join(tmpdir(), 'rsc-cust-home4-'));
  const state = await applyInstall({ skillIds: ['suggest'], target: 'claude', home, cwd });
  assert.deepEqual(state.governance.customizations.orphaned, ['a-skill-that-never-existed']);
  assert.equal(state.governance.customizations.errors, 0, 'orphaned is reported, not an error');
  assert.ok(existsSync(join(cwd, ...customizationFile('a-skill-that-never-existed').split('/'))),
    'it is the project\'s property and nothing in installation may delete it');
});

// ---------------------------------------------------------------- criterion 9: survival

test('criterion 9 — a customization survives install, sync, repair, a version refresh and a clone rebuild', async () => {
  const rel = customizationFile('flutter').split('/');
  const cwd = project({ [customizationFile('flutter')]: VALID });
  const home = mkdtempSync(join(tmpdir(), 'rsc-cust-home5-'));
  const abs = join(cwd, ...rel);
  const original = readFileSync(abs, 'utf8');

  await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'claude', home, cwd });
  assert.equal(readFileSync(abs, 'utf8'), original, 'install');

  await syncInstalled({ target: 'claude', home, cwd });
  assert.equal(readFileSync(abs, 'utf8'), original, 'sync');

  await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'claude', home, cwd, operation: 'repair' });
  assert.equal(readFileSync(abs, 'utf8'), original, 'repair');

  // An update: the recorded base versions no longer match, so every base is re-materialized and
  // re-governed. The project's own documents are not in that blast radius.
  writeFileSync(join(cwd, '.rsc', '.base-versions.json'), JSON.stringify({ suggest: '0.0.1', flutter: '0.0.1' }) + '\n');
  await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'claude', home, cwd });
  assert.equal(readFileSync(abs, 'utf8'), original, 'update / base refresh');

  // The clone rebuild: `.rsc/` is gitignored, so a fresh clone has none of it and `sync` rebuilds
  // from the committed declaration. The customization is committed content and must come through.
  rmSync(join(cwd, '.rsc'), { recursive: true, force: true });
  await syncInstalled({ target: 'claude', home, cwd });
  assert.equal(readFileSync(abs, 'utf8'), original, 'reconstruction of a clean clone');
  assert.ok(existsSync(join(cwd, '.rsc', 'governance', 'v1.md')), 'and the contract is back too');
});

test('criterion 9, negative control — purge keeps 02-DOCS/ unless the user asks for it', async () => {
  // This is the test that fails if the exclusion disappears. `purge` is the one operation that CAN
  // delete the customization root, and only behind an explicit opt-in.
  const cwd = project({ [customizationFile('flutter')]: VALID });
  const home = mkdtempSync(join(tmpdir(), 'rsc-cust-home6-'));
  const abs = join(cwd, ...customizationFile('flutter').split('/'));
  await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'claude', home, cwd });

  const report = await purgeReport({ home, cwd });
  assert.ok(existsSync(abs), 'purge without --with-docs must not delete the project\'s customizations');
  assert.ok(
    (report.kept || []).some((k) => k.path === '02-DOCS/'),
    'and it must SAY it kept them — a silent keep is one refactor away from a silent delete',
  );
  assert.ok(!existsSync(join(cwd, '.rsc', 'skills')), 'while the machine-local base is gone, proving purge ran');
});
