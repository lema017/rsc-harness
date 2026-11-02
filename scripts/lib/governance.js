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
//
//   4. THERE ARE TWO TRANSFORMATIONS, NOT ONE (D16). The governance block is additive and
//      reversible; the identity rewrite is idempotent and exactly enumerable. They are declared,
//      asserted and inverted SEPARATELY, because they are different kinds of change and collapsing
//      them into one property is what made the old invariant too weak to describe either. See the
//      identity section below.

import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
// The brownfield procedure, shipped the same way and for the same reason: the package carries
// `schema`, not `docs`, so the authoritative `docs/fork/stage3/BROWNFIELD.md` is not on a
// consumer's machine. `DESIGN.md` decision 12 is explicit that the procedure travels as a DOCUMENT
// and not as a 275th skill, because a new skill would break both the byte-identical `skills/`
// mirror and the 274-of-274 count the conformance validator asserts.
export const BROWNFIELD_SOURCE_PATH = join(PKG_ROOT, 'schema', 'governance', `brownfield-${GOVERNANCE_VERSION}.md`);

// ── The identity rewrite (D16) ───────────────────────────────────────────────────────────────────
//
// THE DEFECT. REQUIREMENTS §10 asks the fork to review "comandos sugeridos … para evitar
// reinstalar accidentalmente el padre". Strategy B freezes `skills/` byte-identical to upstream,
// and upstream names its own package 81 times there — 10 of them in `suggest/SKILL.md`, which is
// the always-on body Claude Code re-emits at every SessionStart and after every compaction. One of
// those ten is `npx @ericrisco/rsc add <id>`: a RUNNABLE instruction. A consumer of the fork who
// obeys it downloads and runs the PARENT's CLI inside a fork-governed project, and the parent's
// installer materializes a base with no contract — the same blind spot stage 2 had to close in
// `ensureBase` and stage 4 found again in `restore`. It de-governs the project silently, so it is a
// functional defect and not a cosmetic one.
//
// THE MAP IS OF PACKAGE SPECIFIERS, NOT OF WORDS, and that is the whole of its safety:
//
//   * It rewrites `@ericrisco/rsc` and nothing else. Version-pinning semantics survive for free,
//     because the token is a PREFIX of the specifier: `@ericrisco/rsc@latest` becomes
//     `@lema017/rsc-governed@latest`, and `@ericrisco/rsc@<catalogVersion in .rsc.json>` keeps its
//     exact version. Nothing here has to parse `npx` argv to get that right.
//   * It rewrites to the SPECIFIER, never to `rscg`. `npx <specifier>` runs in any project; `rscg`
//     requires the binary on PATH, which a consumer who never installed globally does not have.
//   * WHAT IT DOES NOT TOUCH IS AS LOAD-BEARING AS WHAT IT DOES: `rsc` as a word in prose ("an rsc
//     skill"), `.rsc/`, `.rsc.json`, `.rsc-state.json`, `RSC_*`, the `rsc-governance:` markers, and
//     `ericrisco/mem-slop` — a DIFFERENT project, not the parent. None of them contains the token,
//     so they are out of scope BY CONSTRUCTION rather than by a list of exceptions someone has to
//     maintain. Stage 6 learned the cost of the word-level alternative: its sweep turned
//     `.rsc memory` into `.rscg memory` and hit four more places where `rsc` names a subsystem.
//
// THE TWO PROPERTIES, asserted over all 274 skills in `tests/governance-base.test.js`:
//
//   IDEMPOTENT — the replacement contains none of the token, so a second pass is a no-op by
//   construction, exactly like governance is idempotent by subtraction.
//
//   EXACTLY ENUMERABLE — inverting the map recovers upstream's bytes character for character. That
//   inversion is the PROOF the rewrite is token-scoped and touched nothing else, and it is a
//   strictly stronger claim than "the transformation is purely additive": it pins both that nothing
//   else changed and HOW MUCH changed, as a count per file. It is well-defined only because the
//   fork's specifier does not occur upstream, which `identityInvertible()` checks rather than
//   assumes.
export const PARENT_PACKAGE = '@ericrisco/rsc';
export const FORK_PACKAGE = '@lema017/rsc-governed';
export const IDENTITY_MAP = Object.freeze({ [PARENT_PACKAGE]: FORK_PACKAGE });

/** Occurrences of each source token, so a rewrite is reported as a count and never as a promise. */
export function countIdentityTokens(src) {
  const out = {};
  for (const from of Object.keys(IDENTITY_MAP)) out[from] = String(src).split(from).length - 1;
  return out;
}

/** Apply the map. Returns the text, the per-token substitution count, and the total. */
export function rewriteIdentity(src) {
  let text = String(src);
  const substitutions = countIdentityTokens(text);
  for (const [from, to] of Object.entries(IDENTITY_MAP)) text = text.split(from).join(to);
  return { text, substitutions, total: Object.values(substitutions).reduce((a, b) => a + b, 0) };
}

/** Just the text — the form every caller inside the transformation wants. */
export function applyIdentity(src) {
  return rewriteIdentity(src).text;
}

/** The inverse map: upstream's bytes back from a rewritten file. The audit of the rewrite. */
export function invertIdentity(src) {
  let text = String(src);
  for (const [from, to] of Object.entries(IDENTITY_MAP)) text = text.split(to).join(from);
  return text;
}

/** Is the rewrite exactly invertible here? False once the target token already occurs in the source. */
export function identityInvertible(src) {
  return Object.values(IDENTITY_MAP).every((to) => !String(src).includes(to));
}

/**
 * Every place a text still names the parent's package, with 1-based line numbers.
 *
 * This is the reporting half of D16 and the reason it is a function rather than an `includes`:
 * "decidable" is not "instrumented". A finding has to name the file and the line, or the consumer
 * reading `rscg conformance` has a verdict and no way to act on it.
 */
export function parentReferences(text) {
  const out = [];
  String(text).split('\n').forEach((line, i) => {
    if (line.includes(PARENT_PACKAGE)) out.push({ line: i + 1, text: line.trim() });
  });
  return out;
}

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
export function brownfieldProcedurePath(cwd) {
  return join(governanceDir(cwd), `brownfield-${GOVERNANCE_VERSION}.md`);
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
 * BOTH transformations, in this order and for a reason: governance is stripped FIRST, so the
 * block's own bytes never pass through the identity rewriter at all. That keeps the digest provably
 * a function of `renderBlock(id)` alone — the preamble and the contract name no package, so the
 * rewrite would be a no-op there anyway, but "would be" is not an invariant and "never sees it" is.
 *
 * The composed inverse is the audit: `invertIdentity(stripGovernance(transform(x)))` returns `x`,
 * and each half is inverted and counted on its own in `tests/governance-base.test.js`.
 *
 * Returns the text unchanged when there is no frontmatter to append keys to — a body-only file is
 * not a skill, and silently inventing a frontmatter for it would be a worse answer than leaving it
 * alone. The conformance validator is what reports such a file, not this function.
 */
export function transformSkillMd(src, id) {
  const clean = applyIdentity(stripGovernance(src));
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
 * Every file under a directory, recursively. Used only to reach the base's non-`SKILL.md` text.
 */
function filesUnder(dir) {
  const out = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...filesUnder(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/**
 * Apply the transformation in place to a materialized base directory (`.rsc/skills/<id>/`).
 * Returns the path of the `SKILL.md` it rewrote, or null when the base carries no `SKILL.md`.
 *
 * This is the only writer, and it writes to the delivery copy. `skills/` is never passed here.
 *
 * THE IDENTITY REWRITE REACHES THE WHOLE BASE, not just `SKILL.md`, and that is a measurement and
 * not a flourish: `ensureBase` copies the skill DIRECTORY, so `references/` and `evals/` travel to
 * the consumer too, and they hold 32 of the 81 references — `init/references/recommend-skills.md`
 * alone names the parent 15 times, in commands an agent reads and runs. A delivery where `SKILL.md`
 * is clean and the file it tells the agent to open is not would satisfy the letter of §10 and miss
 * its point.
 *
 * Non-`SKILL.md` files get the identity map ALONE: they have no frontmatter, so there is nothing
 * there to govern. Binary files and anything that does not round-trip through UTF-8 are skipped
 * rather than decoded — a lossy re-encode of an image to chase a token that is not in it is the
 * kind of damage a token-scoped rewrite exists to avoid.
 */
export function governBase(id, baseDirPath) {
  const md = join(baseDirPath, 'SKILL.md');
  for (const file of filesUnder(baseDirPath)) {
    if (file === md) continue;
    let buf;
    try { buf = readFileSync(file); } catch { continue; }
    if (!buf.includes(PARENT_PACKAGE)) continue;
    const text = buf.toString('utf8');
    if (Buffer.compare(Buffer.from(text, 'utf8'), buf) !== 0) continue;
    const out = applyIdentity(text);
    if (out !== text) writeFileSync(file, out);
  }
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
 * Why it is the catalog file rather than "the transformed base minus the block": the always-on
 * surface applies no skill, so the preamble's "read this before applying the skill below" has no
 * referent there — and in Claude Code this body is re-emitted at every SessionStart and after every
 * compaction, where it would also put the five rules into every evaluation session before the skill
 * under test was even loaded, which is what would make G3 (fallback with no customization)
 * unmeasurable. The frontmatter matters here too, because `targets/session-start.mjs:52` writes this
 * file out whole, frontmatter included.
 *
 * WHAT CHANGED WITH D16, AND WHAT DID NOT. This file is no longer byte-identical to upstream's
 * `suggest/SKILL.md`: it is that file with the identity map applied, and nothing else. It carries no
 * governance block and none of the three keys, so the GOVERNANCE cost of the surface is still
 * exactly zero bytes. What it now costs is the identity rewrite: 10 substitutions of one package
 * specifier for another, +7 bytes each, 7,280 B → 7,350 B. The reason the old claim existed was
 * cost — not paying 785 B of preamble on every SessionStart — and that reason survives intact at a
 * +70 B delta. The reason it had to change is that the pristine file instructs the agent to run the
 * PARENT's CLI, which §10 exists to prevent; a surface re-emitted every session is the worst place
 * in the product to leave that instruction. The delta is asserted as a measured, bounded number
 * rather than as zero, because a claim of zero here is now false and a claim of "small" is not
 * checkable.
 */
/**
 * Write `.rsc/governance/brownfield-v1.md` — the brownfield procedure `rscg brownfield` hands the
 * agent. Package-owned, regenerated on every install and sync, exactly like the contract.
 *
 * Returns null when the shipped copy is absent instead of throwing: a project whose harness
 * predates this file must still install, and the command that needs it says so itself.
 */
export function writeBrownfieldProcedure(cwd) {
  const dest = brownfieldProcedurePath(cwd);
  try {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(BROWNFIELD_SOURCE_PATH, dest);
    return dest;
  } catch { return null; }
}

export function writeAlwaysOn({ cwd, catalogRoot = PKG_ROOT, id = 'suggest' }) {
  const dest = alwaysOnPath(cwd);
  mkdirSync(dirname(dest), { recursive: true });
  // Read-rewrite-write rather than `copyFileSync`: this one file is the ONLY writer of the always-on
  // surface for all five targets — `install-apply.js` hands its path to every `wireHook` — so
  // applying the map here reaches Claude's session hook, the three markdown block targets and
  // Cursor's always-apply rule from a single place.
  writeFileSync(dest, applyIdentity(readFileSync(join(catalogRoot, 'skills', id, 'SKILL.md'), 'utf8')));
  return dest;
}
