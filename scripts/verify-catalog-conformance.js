#!/usr/bin/env node
// Stage 4 — acceptance criterion 4 and criterion 5, over the catalog as INSTALLED.
//
// Stage 2's instrument (`tests/governance-base.test.js`) proved the transformation over the 274
// catalog files in memory, and proved a real install for 4 of them. That is not what criterion 4
// asks. Criterion 4 asks that every DISTRIBUTED skill carry the contract, and "distributed" means
// the tree an assistant actually reads: `.rsc/skills/<id>/SKILL.md`, materialized by a real
// `applyInstall`, plus the per-target delivery hanging off it.
//
// So this script installs all 274 into a disposable project, for every one of the five targets,
// and then audits what landed:
//
//   base        — `.rsc/skills/<id>/SKILL.md`: block, three keys, digest, exactly one of each.
//   delivery    — what each target hands the assistant. 4 of the 5 symlink to the base (so the
//                 check is that the link resolves there and the bytes match); `cursor` rewrites
//                 the file, so its `.mdc` is audited on its own terms — the block must be
//                 byte-identical to the rendered block, and the three keys must be ABSENT,
//                 because `targets/cursor.js:7` replaces the frontmatter. CONTRACT.md §1 declares
//                 that hole; a silent change in either direction is a finding here.
//   idempotence — the whole install is run a second time and every base file compared byte for
//                 byte. Criterion 5 over the installed tree, not over a pure function.
//
// Deterministic, offline, read-only outside the disposable project it is given.
//
// Usage: node scripts/verify-catalog-conformance.js --cwd <dir> --home <dir> [--json <file>]

import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyInstall } from './install-apply.js';
import { TARGET_IDS, targetPaths } from '../targets/index.js';
import { BLOCK_BEGIN, BLOCK_END, GOVERNANCE_VERSION, customizationPathFor, digestOf, governanceOf, renderBlock } from './lib/governance.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// All eighteen, not the five in PLAN §9's governance scope. ARCHITECTURE.md §4's "lo que hay que
// medir" asks for the per-skill delivery in the 18, and CONTRACT.md §1 makes a claim about "17 of
// 18" — a claim nothing had measured. The five remain the ones the fork makes governance promises
// about; the other thirteen are measured here so the claim about them is evidence, not inference.
const TARGETS = TARGET_IDS;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

export function catalogIds(root = ROOT) {
  return readdirSync(join(root, 'skills'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(root, 'skills', e.name, 'SKILL.md')))
    .map((e) => e.name).sort();
}

/** Everything criterion 4 asks of one distributed `SKILL.md`, as a list of failures. */
export function auditBase(id, text) {
  const bad = [];
  const info = governanceOf(text);
  if (!info.block) bad.push('no governance block');
  if (!info.keys.governance) bad.push('no `governance` key');
  if (!info.keys['governance-customization']) bad.push('no `governance-customization` key');
  if (!info.keys['governance-digest']) bad.push('no `governance-digest` key');
  // A partial is exactly this: something of governance present, something else missing.
  if (info.block && !info.complete) bad.push('PARTIAL: block present, a key missing');
  if (!info.block && Object.keys(info.keys).length) bad.push('PARTIAL: keys present, no block');
  if (info.block && !info.digestMatches) bad.push('digest does not match its own block');
  if (info.keys.governance && info.keys.governance !== GOVERNANCE_VERSION) bad.push(`governance is ${info.keys.governance}`);
  if (info.keys['governance-customization'] && info.keys['governance-customization'] !== customizationPathFor(id)) {
    bad.push(`customization path is ${info.keys['governance-customization']}`);
  }
  if (info.keys['governance-digest'] && info.keys['governance-digest'] !== digestOf(renderBlock(id))) {
    bad.push('digest is not the digest of THIS skill\'s rendered block');
  }
  const opens = text.split(BLOCK_BEGIN).length - 1;
  const closes = text.split(BLOCK_END).length - 1;
  if (opens !== 1) bad.push(`DUPLICATE: ${opens} opening markers`);
  if (closes !== 1) bad.push(`DUPLICATE: ${closes} closing markers`);
  for (const key of ['governance', 'governance-customization', 'governance-digest']) {
    const n = (text.match(new RegExp(`^${key}:`, 'gm')) || []).length;
    if (n !== 1) bad.push(`DUPLICATE: ${n} \`${key}\` keys`);
  }
  // "Read this before applying the skill below" is false if the block sits at the bottom.
  const marker = BLOCK_BEGIN.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  if (!new RegExp(`\\n---\\n${marker}`).test(text)) bad.push('the block does not open the body');
  return bad;
}

/** What the target handed the assistant, audited per target family. */
function auditDelivery(target, id, cwd, home, basePath) {
  if (target === 'cursor') {
    const mdc = join(cwd, '.cursor', 'rules', `${id}.mdc`);
    if (!existsSync(mdc)) return ['no .mdc delivered'];
    const text = readFileSync(mdc, 'utf8');
    const bad = [];
    const block = (text.match(/<!-- rsc-governance:begin [^\n]*?-->[\s\S]*?<!-- rsc-governance:end -->/) || [])[0] || null;
    if (!block) bad.push('no governance block in the .mdc');
    // The one genuinely transformed delivery: a rendering fault here is invisible to both the base
    // validator and the digest, so the bytes are compared against the rendered block directly.
    else if (block !== renderBlock(id)) bad.push('the .mdc block is not byte-identical to the rendered block');
    // The declared hole, asserted rather than assumed (CONTRACT.md §1).
    for (const key of ['governance:', 'governance-customization:', 'governance-digest:']) {
      if (new RegExp(`^${key}`, 'm').test(text)) bad.push(`the .mdc now carries \`${key}\` — CONTRACT.md §1 says it does not`);
    }
    return bad;
  }
  // Derived from the target table rather than hardcoded, so adding a target cannot silently fall
  // out of this audit.
  const dir = targetPaths(target, home, cwd).skillDir(id);
  const md = join(dir, 'SKILL.md');
  if (!existsSync(md)) return ['no SKILL.md delivered'];
  const bad = [];
  // 17 of 18 targets deliver a symlink to the base, so the delivered file IS the base file. Prove
  // it rather than assume it: a copy that silently stopped tracking the base would read fine here
  // and go stale forever.
  try {
    if (lstatSync(dir).isSymbolicLink() && realpathSync(dir) !== realpathSync(basePath)) {
      bad.push('the delivered directory does not resolve to the governed base');
    }
  } catch { bad.push('could not resolve the delivered directory'); }
  if (readFileSync(md, 'utf8') !== readFileSync(join(basePath, 'SKILL.md'), 'utf8')) {
    bad.push('the delivered SKILL.md differs from the governed base');
  }
  return bad;
}

/**
 * The body each target's always-on layer ends up reading. For `claude` that is NOT the hook target
 * — `targets/claude.js` writes a PATH into `settings.json` and the hook reads the file at run time,
 * so following the stored path is the only non-vacuous way to look at it (the vacuity this avoids
 * was shipped once in this design's earlier draft).
 */
function alwaysOnSurface(target, cwd, home) {
  const paths = targetPaths(target, home, cwd);
  if (target === 'claude') {
    let settings;
    try { settings = JSON.parse(readFileSync(join(cwd, '.claude', 'settings.json'), 'utf8')); }
    catch { return { error: 'no .claude/settings.json' }; }
    const commands = Object.values(settings.hooks ?? {}).flat()
      .flatMap((e) => e.hooks ?? []).map((h) => h.command).filter((c) => typeof c === 'string');
    const wired = (commands.join(' ').match(/\$\{CLAUDE_PROJECT_DIR\}\/[^"'\s]+/g) || [])
      .map((p) => p.replace('${CLAUDE_PROJECT_DIR}/', '')).filter((p) => p.endsWith('.md'));
    if (wired.length !== 1) return { error: `expected exactly one wired .md body, got ${JSON.stringify(wired)}` };
    const abs = join(cwd, wired[0]);
    if (!existsSync(abs)) return { error: `the wired body does not exist: ${wired[0]}` };
    return { from: wired[0], text: readFileSync(abs, 'utf8') };
  }
  if (!existsSync(paths.hookTarget)) return { error: `no hook target at ${relative(cwd, paths.hookTarget)}` };
  return { from: relative(cwd, paths.hookTarget), text: readFileSync(paths.hookTarget, 'utf8') };
}

async function main() {
  const cwd = arg('cwd');
  const home = arg('home');
  if (!cwd || !home) {
    console.error('usage: node scripts/verify-catalog-conformance.js --cwd <dir> --home <dir> [--json <file>]');
    process.exit(2);
  }
  mkdirSync(cwd, { recursive: true });
  mkdirSync(home, { recursive: true });
  const ids = catalogIds();
  const report = { catalog: ids.length, targets: {}, base: {}, idempotence: {}, failures: [] };
  console.log(`catalog: ${ids.length} skills with a SKILL.md`);

  const basePathOf = (id) => join(cwd, '.rsc', 'skills', id);
  let firstPass = null;

  // Pass 2 re-installs over the governed base that pass 1 left (the ordinary re-run). Pass 3 first
  // wipes `.rsc/.base-versions.json`, which is what forces `ensureBase` to re-materialize every
  // base from the pristine catalog and transform it again — the version-change path, and the only
  // one where the transformation genuinely runs twice on the same bytes rather than no-opping.
  for (const pass of [1, 2, 3]) {
    if (pass === 3) writeFileSync(join(cwd, '.rsc', '.base-versions.json'), '{}\n');
    for (const target of TARGETS) {
      const t0 = Date.now();
      await applyInstall({ skillIds: ids, target, home, cwd });
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      if (pass === 1) report.targets[target] = { installSeconds: Number(secs) };
      console.log(`pass ${pass}: installed ${ids.length} skills for ${target} in ${secs}s`);
    }

    // The base, audited once per pass — it is shared by every target.
    const bases = {};
    let conformant = 0;
    for (const id of ids) {
      const md = join(basePathOf(id), 'SKILL.md');
      if (!existsSync(md)) { report.failures.push(`pass ${pass} base ${id}: no SKILL.md installed`); continue; }
      const text = readFileSync(md, 'utf8');
      bases[id] = text;
      const bad = auditBase(id, text);
      if (bad.length) report.failures.push(`pass ${pass} base ${id}: ${bad.join('; ')}`);
      else conformant += 1;
    }
    report.base[`pass${pass}`] = { audited: Object.keys(bases).length, conformant };
    console.log(`pass ${pass}: base conformant ${conformant}/${ids.length}`);

    if (pass === 1) firstPass = bases;
    else {
      // Criterion 5 over the INSTALLED tree: a second full install must change nothing.
      const drifted = ids.filter((id) => firstPass[id] !== bases[id]);
      const label = pass === 2 ? 'reinstall' : 'forcedRefresh';
      report.idempotence[label] = { compared: ids.length, drifted: drifted.length, examples: drifted.slice(0, 5) };
      console.log(`idempotence (${label}): ${ids.length - drifted.length}/${ids.length} byte-identical`);
      for (const id of drifted) report.failures.push(`idempotence ${label} ${id}: differs from pass 1`);
    }

    // The always-on surface must stay governance-free and byte-identical to upstream's `suggest`
    // (CONTRACT.md §1 / stage 2 §3). Checked here too because this sweep is the one that runs
    // after a 274-skill install, where an accidental re-pointing would be easiest to miss.
    const alwaysOn = join(cwd, '.rsc', 'governance', 'always-on.md');
    const pristine = readFileSync(join(ROOT, 'skills', 'suggest', 'SKILL.md'), 'utf8');
    if (!existsSync(alwaysOn)) report.failures.push(`pass ${pass}: no .rsc/governance/always-on.md`);
    else if (readFileSync(alwaysOn, 'utf8') !== pristine) {
      report.failures.push(`pass ${pass}: always-on.md is not byte-identical to upstream's suggest/SKILL.md`);
    }
    // And nothing outside the catalog may have been materialized as a base.
    const installedBases = readdirSync(join(cwd, '.rsc', 'skills'), { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name).sort();
    report.base[`pass${pass}`].installedBaseDirs = installedBases.length;
    const extra = installedBases.filter((id) => !ids.includes(id));
    if (extra.length) report.failures.push(`pass ${pass}: bases with no catalog entry: ${extra.join(', ')}`);

    // Per-target delivery, every skill, every target — and the always-on surface of each, which
    // must carry NO governance at all.
    for (const target of TARGETS) {
      let ok = 0;
      for (const id of ids) {
        const bad = auditDelivery(target, id, cwd, home, basePathOf(id));
        if (bad.length) report.failures.push(`pass ${pass} ${target} ${id}: ${bad.join('; ')}`);
        else ok += 1;
      }
      report.targets[target][`deliveredPass${pass}`] = ok;
      const surface = alwaysOnSurface(target, cwd, home);
      if (surface.error) report.failures.push(`pass ${pass} ${target} always-on: ${surface.error}`);
      else if (surface.text.includes(BLOCK_BEGIN) || surface.text.includes(BLOCK_END)) {
        report.failures.push(`pass ${pass} ${target} always-on: the governance block reached ${surface.from}`);
      }
      report.targets[target].alwaysOnSurface = surface.from || null;
      report.targets[target].alwaysOnBytes = surface.text ? Buffer.byteLength(surface.text) : null;
      console.log(`pass ${pass}: ${target} delivery conformant ${ok}/${ids.length}`
        + `, always-on ${surface.error ? 'ERROR ' + surface.error : 'clean (' + Buffer.byteLength(surface.text) + ' B, ' + surface.from + ')'}`);
    }
  }

  const jsonOut = arg('json');
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 2) + '\n');
  console.log(`\nfailures: ${report.failures.length}`);
  for (const f of report.failures.slice(0, 40)) console.log(`  ${f}`);
  if (report.failures.length > 40) console.log(`  … and ${report.failures.length - 40} more`);
  console.log(`\nrelative to repo root: ${relative(ROOT, cwd) || cwd}`);
  process.exit(report.failures.length ? 1 : 0);
}

// The same main-guard shape the fork's other two scripts use. Not the `pathToFileURL(argv[1])`
// idiom: `tests/import-safe-entrypoints.test.js` documents why that one is wrong twice.
if (process.argv[1] && process.argv[1].endsWith('verify-catalog-conformance.js')) await main();
