// Acceptance criterion 12, from the transformer's side: the four classes of upstream change that
// PLAN.md §4 names — a skill ADDED, REMOVED, MODIFIED and RENAMED — each with its own test.
//
// Stage 2 already proved the orphan report and the survival of a customization. What was missing is
// what criterion 12 actually asks: one test per class, and in particular the two that nothing
// covered end to end — that a skill upstream ADDS is governed with no list for anyone to update,
// and that a RENAME is never rehomed, in either direction (no file invented at the new name, no key
// pointing at the old one).
//
// None of this touches `skills/`. The added, modified and renamed skills are synthetic bases in a
// temporary directory, which is exactly the shape `ensureBase` materializes: the transformation
// takes a directory path, so it can be exercised on a catalog that does not exist yet without
// writing one byte inside the repository's mirror of upstream.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyInstall } from '../scripts/install-apply.js';
import {
  BLOCK_BEGIN, BLOCK_END, customizationPathFor, digestOf, governBase, governanceOf, renderBlock,
} from '../scripts/lib/governance.js';
import {
  CUSTOMIZATION_ROOT, catalogIds, errorsOf, validateCustomizationSource, validateCustomizations,
} from '../scripts/lib/customization-validator.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CATALOG = catalogIds(ROOT);

const SYNTHETIC = `---
name: {{ID}}
description: A skill upstream ships that this fork has never seen before.
origin: risco
---

# {{ID}}

Do the thing, in the way the thing is done.
`;

/** A base directory shaped the way `ensureBase` materializes one: `<dir>/SKILL.md` plus extras. */
function materializeBase(id, body = SYNTHETIC) {
  const dir = join(mkdtempSync(join(tmpdir(), 'rsc-upstream-')), id);
  mkdirSync(join(dir, 'evals'), { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), body.replaceAll('{{ID}}', id));
  writeFileSync(join(dir, 'evals', 'cases.yaml'), 'cases: []\n');
  return dir;
}

const CUSTOMIZATION = (id) => `---
skill: ${id}
governance: v1
status: approved
updated: 2026-11-01
type: skill-customization
catalog-version: 3.7.4
reevaluate-when: the ${id} skill changes its recommendation
scope:
  - .
evidence: codebase analysis 2026-11-01, accepted by the user
---

# ${id} — project customization

## Decisions

- **The project's own way.**
  Category: approved convention · Scope: .
  Evidence: \`src/main.ts:1\`
  Decided: 2026-11-01, accepted by the user

## Out of scope

Everything else.
`;

const customizationFile = (id) => `${CUSTOMIZATION_ROOT.split(/[/\\]/).join('/')}/${id}/README.md`;

function project(files = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-upstream-proj-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(cwd, ...rel.split('/'));
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, body);
  }
  return cwd;
}

// ------------------------------------------------------------------ 1. ADDED

test('criterion 12 · ADDED — a skill upstream adds is governed by construction, with no list to update', () => {
  const id = 'a-skill-upstream-added-today';
  assert.ok(!CATALOG.includes(id), 'premise: this id is NOT in the catalog, so nothing could have enrolled it');

  const dir = materializeBase(id);
  const written = governBase(id, dir);
  assert.equal(written, join(dir, 'SKILL.md'));

  const info = governanceOf(readFileSync(written, 'utf8'));
  assert.ok(info.complete, 'a brand-new skill carries the block and the three keys');
  assert.ok(info.digestMatches, 'and a digest that matches its own block');
  assert.equal(info.keys['governance-customization'], customizationPathFor(id),
    'the precomputed path names the NEW skill — nothing about it was inherited');
  assert.equal(info.keys['governance-digest'], digestOf(renderBlock(id)));

  // This is the property PLAN §9.6 is about: governance is applied to whatever the catalog contains
  // at install time, so an addition cannot arrive ungoverned by being left out of something.
  // Negative control: a second brand-new id works identically, with no registration step between.
  const other = 'another-skill-upstream-added-today';
  assert.ok(governanceOf(readFileSync(governBase(other, materializeBase(other)), 'utf8')).complete);
});

// ------------------------------------------------------------------ 2. REMOVED

test('criterion 12 · REMOVED — the customization of a deleted skill survives byte-identical and is reported orphaned', async () => {
  const cwd = project({ [customizationFile('flutter')]: CUSTOMIZATION('flutter') });
  const home = mkdtempSync(join(tmpdir(), 'rsc-upstream-home1-'));
  const abs = join(cwd, ...customizationFile('flutter').split('/'));
  const original = readFileSync(abs, 'utf8');

  await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'claude', home, cwd });
  assert.equal(readFileSync(abs, 'utf8'), original, 'install does not touch it');

  // Upstream deletes `flutter`. The catalog is passed explicitly rather than mutating `skills/`:
  // the fork's invariant forbids the only other way to simulate this.
  const after = validateCustomizations({ cwd, catalogRoot: ROOT, catalog: CATALOG.filter((id) => id !== 'flutter') });
  assert.deepEqual(after.orphaned, ['flutter'], 'reported as orphaned');
  assert.deepEqual(errorsOf({ findings: after.findings }), [], 'orphaned is a fact about the catalog, not an error');
  assert.equal(readFileSync(abs, 'utf8'), original, 'still byte-identical: it is the project\'s property');

  // And the pruning half, measured rather than assumed. A governing policy prunes the delivered
  // link of a skill that is no longer selected; the SHARED BASE under `.rsc/skills/` is pruned only
  // for an id listed in RETIRED_SKILLS, so a freshly deleted upstream skill leaves its base behind.
  // That is upstream's rule, not this fork's, and it is recorded here so a reader does not infer a
  // guarantee that does not exist.
  await applyInstall({ skillIds: ['suggest'], target: 'claude', home, cwd, policy: { agents: [] } });
  assert.equal(existsSync(join(cwd, '.claude', 'skills', 'flutter')), false, 'the delivered link is pruned');
  assert.equal(existsSync(join(cwd, '.rsc', 'skills', 'flutter')), true,
    'the shared base is NOT pruned for an id outside RETIRED_SKILLS — stated, not promised');
  assert.equal(readFileSync(abs, 'utf8'), original, 'and through all of it the customization is untouched');
});

// ------------------------------------------------------------------ 3. MODIFIED

test('criterion 12 · MODIFIED — a changed upstream skill is re-governed: one block, right digest, edit intact', async () => {
  const cwd = project();
  const home = mkdtempSync(join(tmpdir(), 'rsc-upstream-home2-'));
  await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'claude', home, cwd });
  const md = join(cwd, '.rsc', 'skills', 'flutter', 'SKILL.md');
  assert.ok(governanceOf(readFileSync(md, 'utf8')).complete, 'premise: governed after the first install');

  // Upstream edits the skill. Two shapes, both real:
  //   (a) the new upstream file lands pristine, the way an upstream-version install leaves it;
  //   (b) it lands still carrying the OLD block, the way a merge of an already-governed tree would.
  const pristine = readFileSync(join(ROOT, 'skills', 'flutter', 'SKILL.md'), 'utf8');
  const EDIT = '\n## An upstream paragraph added this release\n\nIt must still be here afterwards.\n';

  // The base mark is left naming the current version on purpose. A forced refresh would re-copy
  // from `skills/`, which would discard the simulated upstream edit before the transformation ever
  // saw it; what this test is about is the installed base being re-governed in place, which is the
  // path a consumer reaches after an upstream-version install (`governBase` outside the `if`).
  writeFileSync(md, pristine + EDIT);

  await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'claude', home, cwd });
  let text = readFileSync(md, 'utf8');
  let info = governanceOf(text);
  assert.ok(info.complete, '(a) the modified skill is governed');
  assert.ok(info.digestMatches, '(a) with a digest matching its block');
  assert.equal(text.split(BLOCK_BEGIN).length - 1, 1, '(a) exactly one opening marker');
  assert.equal(text.split(BLOCK_END).length - 1, 1, '(a) exactly one closing marker');
  assert.match(text, /An upstream paragraph added this release/, '(a) the upstream edit survives');

  // (b) the modified file arrives WITH the old block already in it.
  writeFileSync(md, text + '\n## A second upstream paragraph\n\nAlso still here.\n');
  await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'claude', home, cwd });
  text = readFileSync(md, 'utf8');
  info = governanceOf(text);
  assert.ok(info.complete && info.digestMatches, '(b) governed, digest intact');
  assert.equal(text.split(BLOCK_BEGIN).length - 1, 1, '(b) re-injection REPLACES, it never appends');
  assert.equal((text.match(/^governance: /gm) || []).length, 1, '(b) and the keys are not duplicated either');
  assert.match(text, /An upstream paragraph added this release/, '(b) first edit survives');
  assert.match(text, /A second upstream paragraph/, '(b) second edit survives');
});

// ------------------------------------------------------------------ 4. RENAMED

test('criterion 12 · RENAMED — nothing is rehomed: the old name is orphaned, the new name gets its own path', async () => {
  const OLD = 'flutter';
  const NEW = 'flutter-mobile';
  assert.ok(CATALOG.includes(OLD) && !CATALOG.includes(NEW), 'premise: the rename has not happened in the catalog');

  const cwd = project({ [customizationFile(OLD)]: CUSTOMIZATION(OLD) });
  const oldAbs = join(cwd, ...customizationFile(OLD).split('/'));
  const newAbs = join(cwd, ...customizationFile(NEW).split('/'));
  const original = readFileSync(oldAbs, 'utf8');

  // Upstream renames the skill: the catalog now ships NEW where it shipped OLD.
  const renamed = [...CATALOG.filter((id) => id !== OLD), NEW].sort();
  const report = validateCustomizations({ cwd, catalogRoot: ROOT, catalog: renamed });

  assert.deepEqual(report.orphaned, [OLD], 'the old name is reported, not resolved');
  const orphan = report.findings.find((f) => f.severity === 'orphaned');
  assert.match(orphan.message, /migration requiring a decision, never an automatic rehome/,
    'a rename applied silently is a failure of this criterion even when the result is right');
  assert.match(orphan.message, new RegExp(OLD), 'the finding names the skill');
  assert.equal(readFileSync(oldAbs, 'utf8'), original, 'the old customization stays byte-identical on disk');
  assert.equal(existsSync(newAbs), false, 'and nothing was invented at the new name');

  // The other direction of the same rule: the renamed skill's own distributed base points at its
  // OWN customization path. A transformation that tried to be helpful about the rename would write
  // the old path here, and the project would keep consulting a file for a skill that no longer runs.
  const governed = readFileSync(governBase(NEW, materializeBase(NEW)), 'utf8');
  const info = governanceOf(governed);
  assert.equal(info.keys['governance-customization'], customizationPathFor(NEW));
  assert.ok(!governed.includes(customizationPathFor(OLD)), 'no trace of the old path anywhere in the delivered skill');

  // And the validator does not quietly accept the old file under the new directory either: a
  // customization whose `skill:` key disagrees with its directory is rule 2, not a rehome.
  const mismatch = validateCustomizationSource({
    file: `/p/${customizationFile(NEW)}`, src: CUSTOMIZATION(OLD), dirName: NEW, catalog: renamed,
  });
  assert.ok(errorsOf(mismatch).some((e) => e.ruleId === 'R2'),
    'moving the file without changing its `skill:` key is a named finding, not a silent migration');
});
