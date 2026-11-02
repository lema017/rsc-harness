// Fork governance (rsc-governed): the transformation that makes a DISTRIBUTED skill carry the
// contract, and the two artifacts that travel with it.
//
// Strategy B in one sentence: `skills/` in this repository stays byte-identical to upstream, and
// governance is applied to the COPY at the single boundary where the catalog stops being a mirror
// and starts being a delivery — `ensureBase()` in `scripts/install-apply.js`. Nothing here ever
// writes inside `skills/`; everything here writes under the consumer project's `.rsc/`.
//
// Three things are deliberate and load-bearing:
//
//   1. THE BODY IS THE CHANNEL. `targets/cursor.js:7` replaces the whole frontmatter and
//      `targets/_md-block.js` strips it, so a rule that lived only in frontmatter would never
//      reach the model in 2 of the 5 target surfaces. The five rules therefore live in a marked
//      block in the body; the three flat keys serve the conformance validator and the maintenance
//      machine, not the reader.
//
//   2. FLAT KEYS ONLY, APPENDED LAST. `scripts/lib/frontmatter.js` is a hand-rolled line parser,
//      so a nested object would read as unrelated top-level keys. And the keys go at the END of
//      the frontmatter because `scripts/doctor.js:183-190` reads `origin:` out of the first 2048
//      bytes: appending cannot move `origin:`, inserting could.
//
//   3. IDEMPOTENT BY SUBTRACTION, NOT BY DETECTION. Every transformation strips any governance it
//      finds before injecting, so a second pass is byte-identical to the first by construction
//      rather than by a guard someone has to remember.

import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(HERE, '..', '..');

/** The contract version these artifacts were written against. */
export const GOVERNANCE_VERSION = 'v1';

// The marker pair. Markers, not position: re-running REPLACES what is between them instead of
// appending, which is the whole of the idempotency guarantee. The version rides in the opening
// marker so a `v2` transformation can recognize — and replace — a `v1` block.
export const BLOCK_BEGIN = `<!-- rsc-governance:begin ${GOVERNANCE_VERSION} -->`;
export const BLOCK_END = '<!-- rsc-governance:end -->';
const BLOCK_RE = /<!-- rsc-governance:begin [^\n]*?-->[\s\S]*?<!-- rsc-governance:end -->\n*/g;

// The three flat keys, in the order they are written. `governance-digest` is the only one with no
// copy in the body, which is what makes partial or tampered injection detectable.
const KEYS = ['governance', 'governance-customization', 'governance-digest'];
const KEY_LINE_RE = new RegExp(`^(?:${KEYS.join('|')}):[^\\n]*\\n`, 'gm');

// The preamble template ships inside the package (`files` in package.json carries `schema`, not
// `docs`), and `scripts/governance-sync.js` is what copies it from the authoritative
// `docs/fork/stage1/PREAMBLE-v1.txt`. It is never hand-edited in either place; a test asserts the
// two are byte-identical, so a hand edit to the shipped copy fails a binary rather than drifting.
export const PREAMBLE_TEMPLATE_PATH = join(PKG_ROOT, 'schema', 'governance', `preamble-${GOVERNANCE_VERSION}.txt`);
export const CONTRACT_SOURCE_PATH = join(PKG_ROOT, 'schema', 'governance', `contract-${GOVERNANCE_VERSION}.md`);

/** Where a project's customization for `id` lives. Root-anchored, never relative to its citer. */
export function customizationPathFor(id) {
  return `02-DOCS/wiki/skills/${id}/README.md`;
}

/** Project-local governance directory: the contract and the governance-free always-on body. */
export function governanceDir(cwd) {
  return join(cwd, '.rsc', 'governance');
}
export function contractPath(cwd) {
  return join(governanceDir(cwd), `${GOVERNANCE_VERSION}.md`);
}
export function alwaysOnPath(cwd) {
  return join(governanceDir(cwd), 'always-on.md');
}

let templateCache = null;
/** The raw template, with its `{{SKILL}}` placeholder still in it. */
export function preambleTemplate() {
  if (templateCache === null) templateCache = readFileSync(PREAMBLE_TEMPLATE_PATH, 'utf8');
  return templateCache;
}

/**
 * The preamble rendered for one skill: the template with `{{SKILL}}` resolved, trailing newline
 * intact. 785 bytes for `suggest` — the figure ARCHITECTURE.md §4 measures.
 *
 * The template already carries its own `begin`/`end` markers, so this IS the block; nothing wraps
 * it again.
 */
export function renderPreamble(id) {
  return preambleTemplate().replaceAll('{{SKILL}}', id);
}

/** The block exactly as it is injected and exactly as it is digested: no trailing newline. */
export function renderBlock(id) {
  return renderPreamble(id).replace(/\n+$/, '');
}

/**
 * Digest of the rendered block. 12 hex characters of SHA-256 — enough to detect a truncated or
 * edited block, short enough that 274 copies of it cost nothing. It covers the markers too, so a
 * block whose closing marker was lost does not digest as if it were intact.
 */
export function digestOf(renderedBlock) {
  return createHash('sha256').update(renderedBlock, 'utf8').digest('hex').slice(0, 12);
}

/** Remove every trace of governance: the marked block, and the three flat keys. */
export function stripGovernance(src) {
  const text = String(src);
  const m = text.match(/^(---\n[\s\S]*?\n---\n?)([\s\S]*)$/);
  if (!m) return text.replace(BLOCK_RE, '');
  const front = m[1].replace(KEY_LINE_RE, '');
  return front + m[2].replace(BLOCK_RE, '');
}

/**
 * The transformation. Deterministic and idempotent: `transform(transform(x)) === transform(x)`.
 *
 * Returns the text unchanged when there is no frontmatter to append keys to — a body-only file is
 * not a skill, and silently inventing a frontmatter for it would be a worse answer than leaving it
 * alone. The conformance validator is what reports such a file, not this function.
 */
export function transformSkillMd(src, id) {
  const clean = stripGovernance(src);
  const m = clean.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return clean;
  const block = renderBlock(id);
  const keys = [
    `governance: ${GOVERNANCE_VERSION}`,
    `governance-customization: ${customizationPathFor(id)}`,
    `governance-digest: ${digestOf(block)}`,
  ].join('\n');
  // Leading newlines of the body are normalized away, because keeping them would make the second
  // pass differ from the first by exactly those newlines — idempotency has to be a property of the
  // output, not of how tidy the input happened to be.
  const body = m[2].replace(/^\n+/, '');
  return `---\n${m[1]}\n${keys}\n---\n${block}\n\n${body}`;
}

/** Does this text carry a complete, correctly-digested governance block and all three keys? */
export function governanceOf(src) {
  const text = String(src);
  const block = (text.match(/<!-- rsc-governance:begin [^\n]*?-->[\s\S]*?<!-- rsc-governance:end -->/) || [])[0] || null;
  const keys = {};
  for (const key of KEYS) {
    const hit = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(text);
    if (hit) keys[key] = hit[1].trim();
  }
  return {
    block,
    keys,
    complete: Boolean(block) && KEYS.every((k) => keys[k]),
    digestMatches: Boolean(block) && keys['governance-digest'] === digestOf(block),
  };
}

/**
 * Apply the transformation in place to a materialized base directory (`.rsc/skills/<id>/`).
 * Returns the path it rewrote, or null when the base carries no `SKILL.md`.
 *
 * This is the only writer, and it writes to the delivery copy. `skills/` is never passed here.
 */
export function governBase(id, baseDirPath) {
  const md = join(baseDirPath, 'SKILL.md');
  let src;
  try { src = readFileSync(md, 'utf8'); } catch { return null; }
  const out = transformSkillMd(src, id);
  if (out !== src) writeFileSync(md, out);
  return md;
}

/**
 * Write `.rsc/governance/v1.md` — the full contract — from the package's own copy. Regenerated on
 * every install and sync, and package-owned rather than project-owned: a project that edits it has
 * edited a file that the next install overwrites, which is why the preamble says the five rules
 * stand on their own if this file is missing.
 */
export function writeContract(cwd) {
  const dest = contractPath(cwd);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(CONTRACT_SOURCE_PATH, dest);
  return dest;
}

/**
 * Write `.rsc/governance/always-on.md` and return its path: the body every assistant's always-on
 * surface is rendered from, carrying NO governance block.
 *
 * Why it is the pristine catalog file rather than "the transformed base minus the block": the
 * always-on surface applies no skill, so the preamble's "read this before applying the skill
 * below" has no referent there — and in Claude Code this body is re-emitted at every SessionStart
 * and after every compaction, where it would also put the five rules into every evaluation session
 * before the skill under test was even loaded. Shipping the pristine file makes the governance cost
 * of that surface exactly zero bytes and makes "same size as upstream" an exact, checkable claim.
 * The frontmatter matters here too, because `targets/session-start.mjs:52` writes this file out
 * whole, frontmatter included.
 */
export function writeAlwaysOn({ cwd, catalogRoot = PKG_ROOT, id = 'suggest' }) {
  const dest = alwaysOnPath(cwd);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join(catalogRoot, 'skills', id, 'SKILL.md'), dest);
  return dest;
}
