// The always-on surface carries NO governance, in all five target assistants.
//
// Why this test exists at all: the always-on layer is ambient operations, so the preamble's "read
// this before applying the skill below" has no referent there — and the cost is the worst in the
// product. 785 rendered bytes on every turn for the assistants with no per-turn hook, and on Claude
// Code at every SessionStart and after every compaction, which would also put the five rules into
// every evaluation session before the skill under test was loaded and make G3 (fallback with no
// customization) unmeasurable.
//
// AND WHY IT IS WRITTEN THIS WAY: for `claude` it follows the path that ends up stored in
// `settings.json`, not whatever `wireHook` returns. `targets/claude.js` renders no body at all — it
// writes a path and the hook reads the file at run time — so a test that inspected `wireHook`'s
// return value would be green no matter what the session actually pays. That exact vacuity was
// shipped once in this design's earlier draft; this is the test that cannot have it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyInstall } from '../scripts/install-apply.js';
import { targetPaths } from '../targets/index.js';
import { UPDATE_NOTE } from '../targets/_md-block.js';
import { BLOCK_BEGIN, BLOCK_END } from '../scripts/lib/governance.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PRISTINE = readFileSync(join(ROOT, 'skills', 'suggest', 'SKILL.md'), 'utf8');
const PRISTINE_BODY = PRISTINE.replace(/^---\n[\s\S]*?\n---\n?/, '');

const MD_TARGETS = ['codex', 'antigravity', 'deepseek'];

async function install(target) {
  const cwd = mkdtempSync(join(tmpdir(), `rsc-ao-${target}-`));
  const home = mkdtempSync(join(tmpdir(), `rsc-ao-${target}-home-`));
  await applyInstall({ skillIds: ['suggest', 'orient'], target, home, cwd });
  return { cwd, home, paths: targetPaths(target, home, cwd) };
}

/** Every `${CLAUDE_PROJECT_DIR}`-anchored path the committed wiring tells the client to read. */
function wiredPaths(cwd) {
  const settings = JSON.parse(readFileSync(join(cwd, '.claude', 'settings.json'), 'utf8'));
  const commands = Object.values(settings.hooks ?? {})
    .flat()
    .flatMap((entry) => entry.hooks ?? [])
    .map((hook) => hook.command)
    .filter((c) => typeof c === 'string');
  return (commands.join(' ').match(/\$\{CLAUDE_PROJECT_DIR\}\/[^"'\s]+/g) || [])
    .map((p) => p.replace('${CLAUDE_PROJECT_DIR}/', ''));
}

test('claude — the body settings.json points the session hook at carries no governance', async () => {
  const { cwd } = await install('claude');

  const md = wiredPaths(cwd).filter((p) => p.endsWith('.md'));
  assert.equal(md.length, 1, `exactly one always-on body is wired; got ${JSON.stringify(md)}`);
  const [bodyRel] = md;
  const abs = join(cwd, bodyRel);
  assert.ok(existsSync(abs), `the wired body must exist on disk: ${bodyRel}`);

  const body = readFileSync(abs, 'utf8');
  assert.ok(!body.includes(BLOCK_BEGIN), 'no governance block in the per-session body');
  assert.ok(!body.includes(BLOCK_END), 'not even a stray closing marker');
  assert.ok(!/^governance: /m.test(body), 'and none of the three keys either — this file is emitted whole');

  // "Its size is upstream's" — asserted as byte equality, which is the strongest form of it.
  assert.equal(Buffer.byteLength(body), Buffer.byteLength(PRISTINE),
    'the per-session cost must be exactly what upstream pays, not upstream plus a preamble');
  assert.equal(body, PRISTINE, 'byte-identical to the upstream catalog file');

  // And it must NOT be the governed base: the symlinked skill file is the trap this avoids.
  assert.notEqual(bodyRel, '.claude/skills/suggest/SKILL.md');
  const governedBase = readFileSync(join(cwd, '.rsc', 'skills', 'suggest', 'SKILL.md'), 'utf8');
  assert.ok(governedBase.includes(BLOCK_BEGIN), 'the base is governed — so pointing here would cost the block');
  assert.notEqual(body, governedBase);
});

for (const target of MD_TARGETS) {
  test(`${target} — the always-on block in its instructions file carries no governance`, async () => {
    const { paths } = await install(target);
    const doc = readFileSync(paths.hookTarget, 'utf8');
    assert.ok(!doc.includes(BLOCK_BEGIN), `${target}: no governance block on the always-on surface`);
    assert.ok(!doc.includes(BLOCK_END), `${target}: no stray closing marker`);

    // Exact equality against what upstream's own adapter produces from the pristine body: the
    // marked block is the body plus the update note, and nothing else.
    const injected = doc.match(/<!-- rsc-suggest:start -->\n([\s\S]*?)\n<!-- rsc-suggest:end -->/);
    assert.ok(injected, `${target}: the rsc-suggest block must be present`);
    assert.equal(injected[1], `${PRISTINE_BODY}\n${UPDATE_NOTE}`,
      `${target}: the always-on body is upstream's body, byte for byte`);
  });
}

test('cursor — the always-on rule carries no governance, and is upstream\'s body', async () => {
  const { paths } = await install('cursor');
  const doc = readFileSync(paths.hookTarget, 'utf8');
  assert.ok(!doc.includes(BLOCK_BEGIN), 'cursor: no governance block on the always-on surface');
  assert.equal(doc, `---\ndescription: rsc auto-suggest\nalwaysApply: true\n---\n${PRISTINE_BODY}`,
    'cursor: the always-on rule is its own frontmatter plus upstream\'s body, byte for byte');
});

test('the always-on file is materialized where the recovery inventory declares it', async () => {
  const { cwd } = await install('claude');
  // `install-apply.js` warns in its own comment that a file the installer writes and the inventory
  // omits is silently absent from the snapshot, so `rsc restore` cannot bring it back.
  const { managedPathsForInstall } = await import('../scripts/install-apply.js');
  const declared = managedPathsForInstall({ skillIds: ['suggest'], target: 'claude', home: cwd, cwd });
  assert.ok(declared.includes(join(cwd, '.rsc', 'governance', 'always-on.md')),
    'the always-on body is declared for the backup and the dry-run');
  assert.ok(declared.includes(join(cwd, '.rsc', 'governance', 'v1.md')),
    'so is the contract');
});

test('the no-code-hooks operations stub still wins, and still has no governance in it', async () => {
  // Upstream behavior that must survive: a project whose accepted plan governs no code hooks and no
  // lane gate gets a three-line operations stub, not the full suggest body. Generalizing the
  // repointing must not have replaced that stub with the always-on file.
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-ao-stub-'));
  const home = mkdtempSync(join(tmpdir(), 'rsc-ao-stub-home-'));
  await applyInstall({
    skillIds: ['suggest'], target: 'claude', home, cwd,
    policy: { codeHooks: false, laneGate: false },
  });
  const md = wiredPaths(cwd).filter((p) => p.endsWith('.md'));
  assert.deepEqual(md, ['.rsc/suggest-always-on.md'], 'the stub keeps its own path');
  const body = readFileSync(join(cwd, '.rsc', 'suggest-always-on.md'), 'utf8');
  assert.ok(!body.includes(BLOCK_BEGIN), 'and it carries no governance block');
  assert.match(body, /always-on operations layer/);
  assert.ok(Buffer.byteLength(body) < 1024, 'it is a stub, not the whole body');
});
