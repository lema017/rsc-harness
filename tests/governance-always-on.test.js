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
import {
  BLOCK_BEGIN, BLOCK_END, PARENT_PACKAGE, applyIdentity, parentReferences, rewriteIdentity,
} from '../scripts/lib/governance.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const UPSTREAM = readFileSync(join(ROOT, 'skills', 'suggest', 'SKILL.md'), 'utf8');

// D16 REFORMULATES THIS FILE'S INVARIANT, and the reformulation is the point of the comment.
//
// It used to be: the always-on body is upstream's `suggest/SKILL.md`, BYTE-IDENTICAL. That claim
// existed for a reason — COST. The surface is re-emitted at every SessionStart and after every
// compaction, so 785 B of preamble there would be paid on every session and would put the five rules
// into every evaluation run before the skill under test was loaded, making G3 unmeasurable. Byte
// equality was simply the strongest way to assert "this costs nothing".
//
// It is now: upstream's file WITH THE IDENTITY MAP APPLIED, carrying no governance block, with the
// byte delta MEASURED AND BOUNDED. The reason the old claim existed survives intact, because the
// delta is 10 substitutions of one package specifier for another — +7 B each, +70 B in all, 7,280 B
// → 7,350 B. What forced the change is that the pristine file tells the agent to run
// `npx @ericrisco/rsc add <id>`: a RUNNABLE instruction pointing at the PARENT's CLI, re-emitted
// every session, whose installer writes a base with no contract. "Costs zero bytes" was true and
// "de-governs the project" was also true; §10 decides which one gives way.
//
// The delta is asserted as an exact number, not a ceiling. A claim of zero here would now be false,
// and a claim of "small" would not be checkable.
const PRISTINE = applyIdentity(UPSTREAM);
const PRISTINE_BODY = PRISTINE.replace(/^---\n[\s\S]*?\n---\n?/, '');
const IDENTITY_DELTA = Buffer.byteLength(PRISTINE) - Buffer.byteLength(UPSTREAM);

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

  // THE COST, as an exact figure rather than a ceiling. Equality against the rewritten source keeps
  // this as strong as the byte-identity it replaces: the ONLY difference from upstream permitted on
  // this surface is the enumerated token substitution, so any other edit still fails right here.
  assert.equal(body, PRISTINE, 'upstream\'s body with the identity map applied, and nothing else');
  assert.equal(Buffer.byteLength(body), Buffer.byteLength(PRISTINE),
    'the per-session cost must be upstream\'s plus the identity rewrite, never plus a preamble');

  // The governance cost specifically is still exactly zero: no block, no keys (asserted above).
  // What the surface now costs is the rewrite, measured.
  assert.equal(Buffer.byteLength(UPSTREAM), 7280, 'the figure CONTRACT.md §1 measures for upstream');
  assert.equal(IDENTITY_DELTA, 70, 'the measured delta: 10 substitutions × +7 B');
  assert.equal(Buffer.byteLength(body), 7350, 'so the per-session surface is 7,350 B');
  assert.ok(IDENTITY_DELTA < 200,
    `the delta is ${IDENTITY_DELTA} B. D16 is explicit that a delta in the HUNDREDS means the `
    + 'decision has to be revisited rather than absorbed, because the whole reason the old '
    + 'byte-identity claim existed was the per-SessionStart cost');

  // AND THE DEFECT IS ACTUALLY CLOSED, which is the only assertion here that a consumer cares about:
  // the surface re-emitted every session names the fork, and no instruction on it points at the
  // parent's CLI.
  assert.deepEqual(parentReferences(body), [],
    'a runnable instruction naming the parent must not reach the always-on surface');
  assert.ok(!body.includes(PARENT_PACKAGE), `and no mention of ${PARENT_PACKAGE} at all`);
  assert.match(body, /npx @lema017\/rsc-governed add <id>/, 'the one runnable command names the fork');
  assert.equal(rewriteIdentity(UPSTREAM).total, 10, 'the 10 this surface\'s share was measured at');

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
