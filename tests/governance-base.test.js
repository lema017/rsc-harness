// The distributed base carries the contract — acceptance criterion 4's instrument, and criterion
// 5's (idempotence).
//
// What makes this test non-vacuous: it asserts over the base in `.rsc/skills/`, which is what every
// assistant actually reads, and it re-runs the transformation to prove the second pass is
// byte-identical rather than merely "looks fine". A test that only checked `skills/` would be
// checking the one directory the fork's invariant freezes, i.e. nothing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyInstall } from '../scripts/install-apply.js';
import {
  BLOCK_BEGIN, BLOCK_END, GOVERNANCE_VERSION, customizationPathFor, digestOf, governanceOf,
  renderBlock, renderPreamble, stripGovernance, transformSkillMd,
} from '../scripts/lib/governance.js';
import { fenceBalance } from '../scripts/lib/skill-lint.js';
import { governanceArtifactStatus } from '../scripts/governance-sync.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const catalogIds = readdirSync(join(ROOT, 'skills'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(ROOT, 'skills', e.name, 'SKILL.md')))
  .map((e) => e.name).sort();
const readCatalog = (id) => readFileSync(join(ROOT, 'skills', id, 'SKILL.md'), 'utf8');

test('the shipped governance artifacts are byte-identical to their authoritative sources', () => {
  // The package ships `schema`, not `docs`, so the transformer reads a copy. A copy that drifted
  // would mean the catalog carries a preamble nobody approved — and PREAMBLE-v1.txt is explicitly
  // not to be hand-rewritten, in either location.
  for (const row of governanceArtifactStatus(ROOT)) {
    assert.ok(!row.missingSource, `${row.from} must exist in the repository`);
    assert.ok(row.same, `${row.to} drifted from ${row.from} — run npm run governance:sync`);
  }
});

test('the rendered preamble resolves its only placeholder and stays 785 B for suggest', () => {
  const rendered = renderPreamble('suggest');
  assert.ok(!rendered.includes('{{SKILL}}'), 'the placeholder must be resolved');
  assert.equal(Buffer.byteLength(rendered), 785, 'the figure ARCHITECTURE.md §4 measures');
  assert.match(rendered, /02-DOCS\/wiki\/skills\/suggest\/README\.md/);
  // Self-sufficiency: the five rules are in the block, not behind the pointer to the full contract.
  assert.match(rendered, /Absent → apply this skill unchanged/);
  assert.match(rendered, /Unreadable, invalid or contradictory/);
  assert.match(rendered, /the constitution wins/);
  assert.match(rendered, /Evidence insufficient/);
  assert.match(rendered, /If it is missing, the five rules above still stand/);
});

test('the transformation is deterministic and idempotent over all 274 skills', () => {
  assert.equal(catalogIds.length, 274, 'the catalog the fork distributes');
  const notIdempotent = [];
  const notComplete = [];
  const badDigest = [];
  const unbalanced = [];
  const movedOrigin = [];
  const lostContent = [];
  for (const id of catalogIds) {
    const src = readCatalog(id);
    const once = transformSkillMd(src, id);
    if (transformSkillMd(once, id) !== once) notIdempotent.push(id);
    const info = governanceOf(once);
    if (!info.complete) notComplete.push(id);
    if (!info.digestMatches) badDigest.push(id);
    if (!fenceBalance(once).balanced) unbalanced.push(id);
    // `scripts/doctor.js:183-190` reads `origin:` out of the first 2048 bytes. The keys are
    // appended, so this can only fail if someone starts inserting instead.
    const originAt = Buffer.from(once, 'utf8').indexOf(Buffer.from('\norigin:'));
    if (originAt >= 0 && originAt > 2048 - 64) movedOrigin.push([id, originAt]);
    // Nothing of the original body may be dropped: stripping governance must give the source back,
    // up to the one normalized blank line between the frontmatter and the first heading.
    if (stripGovernance(once).replace(/\n+/g, '\n') !== src.replace(/\n+/g, '\n')) lostContent.push(id);
  }
  assert.deepEqual(notIdempotent, [], 'a second pass must be byte-identical (criterion 5)');
  assert.deepEqual(notComplete, [], 'every skill carries the block and all three flat keys');
  assert.deepEqual(badDigest, [], 'every digest matches its own block');
  assert.deepEqual(unbalanced, [], 'code delimiters stay balanced (scripts/lib/skill-lint.js)');
  assert.deepEqual(movedOrigin, [], 'origin: stays inside doctor.js\'s 2048-byte window');
  assert.deepEqual(lostContent, [], 'the transformation adds; it never removes');
});

test('a second transformation never leaves two blocks behind', () => {
  const twice = transformSkillMd(transformSkillMd(readCatalog('flutter'), 'flutter'), 'flutter');
  assert.equal(twice.split(BLOCK_BEGIN).length - 1, 1, 'exactly one opening marker');
  assert.equal(twice.split(BLOCK_END).length - 1, 1, 'exactly one closing marker');
  assert.equal((twice.match(/^governance: /gm) || []).length, 1, 'exactly one `governance` key');
});

test('a tampered block is detectable: the digest is the one key with no copy in the body', () => {
  const governed = transformSkillMd(readCatalog('flutter'), 'flutter');
  const tampered = governed.replace('Absent → apply this skill unchanged.', 'Absent → do whatever you like.');
  assert.notEqual(tampered, governed, 'the fixture must actually have changed');
  assert.equal(governanceOf(tampered).digestMatches, false, 'editing the block breaks its digest');
  // A truncated block is caught too: the markers are inside the digested text.
  const truncated = governed.replace(`\n${BLOCK_END}`, '');
  assert.equal(governanceOf(truncated).digestMatches, false, 'losing the closing marker is detectable');
});

test('a file with no frontmatter is left alone rather than given an invented one', () => {
  const body = '# not a skill\n\njust prose.\n';
  assert.equal(transformSkillMd(body, 'whatever'), body);
});

test('the base an install materializes carries the contract, for every skill it installs', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-gov-base-'));
  const home = mkdtempSync(join(tmpdir(), 'rsc-gov-home-'));
  const ids = ['suggest', 'orient', 'flutter', 'review'];
  await applyInstall({ skillIds: ids, target: 'claude', home, cwd });

  for (const id of ids) {
    const md = readFileSync(join(cwd, '.rsc', 'skills', id, 'SKILL.md'), 'utf8');
    const info = governanceOf(md);
    assert.ok(info.complete, `${id}: the distributed base must carry the block and the three keys`);
    assert.ok(info.digestMatches, `${id}: the digest must match the block as delivered`);
    assert.equal(info.keys.governance, GOVERNANCE_VERSION);
    assert.equal(info.keys['governance-customization'], customizationPathFor(id),
      `${id}: the customization path is precomputed, so the reader never builds one`);
    assert.equal(info.keys['governance-digest'], digestOf(renderBlock(id)));
    // The block is the first thing after the frontmatter: "read this before applying the skill
    // below" is false if it sits at the bottom.
    assert.match(md, new RegExp(`\\n---\\n${BLOCK_BEGIN.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}`),
      `${id}: the block opens the body`);
  }
});

test('the invariant: an install never writes inside the repository catalog', async () => {
  const before = catalogIds.map((id) => `${id}:${readCatalog(id).length}`).join('\n');
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-gov-inv-'));
  const home = mkdtempSync(join(tmpdir(), 'rsc-gov-inv-home-'));
  await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'cursor', home, cwd });
  const after = catalogIds.map((id) => `${id}:${readCatalog(id).length}`).join('\n');
  assert.equal(after, before, 'skills/ is a mirror of upstream and the installer may not touch it');
});

test('a re-install over an already-governed base stays byte-identical', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-gov-reinstall-'));
  const home = mkdtempSync(join(tmpdir(), 'rsc-gov-reinstall-home-'));
  await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'claude', home, cwd });
  const md = join(cwd, '.rsc', 'skills', 'flutter', 'SKILL.md');
  const first = readFileSync(md, 'utf8');

  // Force the base to be re-materialized the way a version change does, then install again.
  writeFileSync(join(cwd, '.rsc', '.base-versions.json'), JSON.stringify({}) + '\n');
  await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'claude', home, cwd });

  assert.equal(readFileSync(md, 'utf8'), first, 'criterion 5: double execution is byte-identical');
  assert.equal(governanceOf(first).complete, true);
});

test('the full contract lands at .rsc/governance/v1.md on install', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-gov-contract-'));
  const home = mkdtempSync(join(tmpdir(), 'rsc-gov-contract-home-'));
  await applyInstall({ skillIds: ['suggest'], target: 'codex', home, cwd });
  const dest = join(cwd, '.rsc', 'governance', `${GOVERNANCE_VERSION}.md`);
  assert.ok(existsSync(dest), 'the preamble points at this file; it has to be there after install');
  assert.equal(
    readFileSync(dest, 'utf8'),
    readFileSync(join(ROOT, 'schema', 'governance', `contract-${GOVERNANCE_VERSION}.md`), 'utf8'),
    'generated from the package copy, not hand-maintained in the project',
  );
  // Degradation (contract §13): the preamble must not depend on this file existing.
  assert.match(renderPreamble('suggest'), /If it is missing, the five rules above still stand/);
});
