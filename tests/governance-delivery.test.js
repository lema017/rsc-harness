// Per-skill delivery: the governance block survives all the way to what each assistant reads.
//
// The one that matters most is Cursor. `targets/cursor.js:7` is the only per-skill delivery that is
// genuinely TRANSFORMED — it replaces the whole frontmatter and rewrites the file — so it is the
// only surface where a rendering fault would be invisible to both the conformance validator on the
// base and the `governance-digest` key, because the digest it would have checked is the thing
// cursor.js throws away. Every other target delivers a symlink to the base, so the base validator
// already covers them; they are asserted here anyway, because "it is a symlink" is an implementation
// detail that could change and the claim being made is about what the assistant reads.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyInstall } from '../scripts/install-apply.js';
import { targetPaths } from '../targets/index.js';
import {
  BLOCK_BEGIN, BLOCK_END, GOVERNANCE_VERSION, PARENT_PACKAGE,
  customizationPathFor, digestOf, governanceOf, parentReferences, renderBlock,
} from '../scripts/lib/governance.js';

const SKILLS = ['suggest', 'flutter', 'review'];

async function install(target) {
  const cwd = mkdtempSync(join(tmpdir(), `rsc-dl-${target}-`));
  const home = mkdtempSync(join(tmpdir(), `rsc-dl-${target}-home-`));
  await applyInstall({ skillIds: SKILLS, target, home, cwd });
  return { cwd, paths: targetPaths(target, home, cwd) };
}

for (const target of ['claude', 'codex', 'antigravity', 'deepseek']) {
  test(`${target} — the delivered SKILL.md keeps the block, the keys and a valid digest`, async () => {
    const { paths } = await install(target);
    for (const id of SKILLS) {
      const md = join(paths.skillDir(id), 'SKILL.md');
      assert.ok(existsSync(md), `${target}/${id}: the skill must be reachable at its delivered path`);
      const info = governanceOf(readFileSync(md, 'utf8'));
      assert.ok(info.block, `${target}/${id}: the block reaches the assistant`);
      assert.ok(info.complete, `${target}/${id}: the three flat keys reach it too`);
      assert.ok(info.digestMatches, `${target}/${id}: and the digest still matches`);
      assert.equal(info.keys['governance-customization'], customizationPathFor(id),
        `${target}/${id}: root-anchored path, never relative to the file citing it`);
      // D16: the delivered skill may not hand the reader a command that installs the PARENT.
      assert.deepEqual(parentReferences(readFileSync(md, 'utf8')), [],
        `${target}/${id}: a delivered instruction still names ${PARENT_PACKAGE}`);
    }
  });
}

test('cursor — the .mdc keeps the block, which is the only place it can be lost unseen', async () => {
  const { paths } = await install('cursor');
  for (const id of SKILLS) {
    const mdc = paths.skillDir(id);
    assert.ok(existsSync(mdc), `cursor/${id}: the converted rule must exist`);
    assert.ok(!lstatSync(mdc).isSymbolicLink(), `cursor/${id}: cursor converts, it does not link`);
    const text = readFileSync(mdc, 'utf8');

    assert.ok(text.includes(BLOCK_BEGIN), `cursor/${id}: the block survives the conversion`);
    assert.ok(text.includes(BLOCK_END), `cursor/${id}: including its closing marker`);
    // The block must arrive INTACT, not merely present: compare it to what was rendered.
    const block = text.match(/<!-- rsc-governance:begin [\s\S]*?<!-- rsc-governance:end -->/)[0];
    assert.equal(block, renderBlock(id), `cursor/${id}: byte-identical to the rendered preamble`);
    assert.equal(digestOf(block), digestOf(renderBlock(id)));

    // And the documented gap, asserted rather than assumed: cursor.js replaces the whole
    // frontmatter, so the three keys — digest included — do NOT reach this surface. The contract
    // says so in §1; if this ever changes, this assertion is where it gets noticed.
    assert.match(text, /^---\ndescription: rsc skill /, `cursor/${id}: its own frontmatter`);
    assert.ok(!/^governance: /m.test(text), `cursor/${id}: the flat keys are stripped here, by design`);
    assert.ok(!/^governance-digest: /m.test(text), `cursor/${id}: no integrity is claimed for the .mdc`);

    // The block still has to open the body, the same as everywhere else.
    assert.match(text, /\n---\n<!-- rsc-governance:begin /, `cursor/${id}: the block opens the body`);

    // D16 on the one RE-RENDERED delivery, where `auditBase` cannot speak for the bytes.
    assert.deepEqual(parentReferences(text), [], `cursor/${id}: the .mdc still names ${PARENT_PACKAGE}`);
  }
});

test('the block names the skill it was rendered for, so a mis-rendered path is visible', async () => {
  const { paths } = await install('cursor');
  for (const id of SKILLS) {
    const text = readFileSync(paths.skillDir(id), 'utf8');
    assert.match(text, new RegExp(`02-DOCS/wiki/skills/${id}/README\\.md`),
      `${id}: the body carries the precomputed customization path, since the frontmatter cannot`);
    assert.ok(!text.includes('{{SKILL}}'), `${id}: no unresolved placeholder reaches a reader`);
  }
});

test('governance travels with the referenced skill, not with the caller', async () => {
  // Contract §11: "reference from another skill" is covered because every skill carries its own
  // preamble. The check is that a skill nobody asked for governance about has it anyway.
  const { paths } = await install('claude');
  const review = readFileSync(join(paths.skillDir('review'), 'SKILL.md'), 'utf8');
  assert.ok(governanceOf(review).complete);
  assert.match(review, new RegExp(`governance: ${GOVERNANCE_VERSION}`));
});
