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

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyInstall } from './install-apply.js';
import { TARGET_IDS } from '../targets/index.js';
import { BLOCK_BEGIN, BLOCK_END } from './lib/governance.js';
// The audit itself lives in `scripts/lib/conformance.js`, so `rscg conformance` can run the SAME
// checks on a consumer's machine without importing the installer (stage 6, D13). This script keeps
// what is its own: installing the whole catalog for every target, three times, and comparing passes.
// `auditBase` is re-exported because it is this module's published surface.
import { auditBase, auditDelivery, alwaysOnSurface, deliveryKind } from './lib/conformance.js';

export { auditBase };

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

  // A FLOOR ON THE DENOMINATOR, which the instrument did not have: every ratio below is `n/ids.length`,
  // so a truncated `skills/` would report "273/273, failures: 0" and look perfect. §3 of the
  // requirements forbids fixing the count in code ("no fijes el número de skills en el código"), so
  // the floor is a CROSS-CHECK against `manifest.json`, which `npm run manifest:check` keeps current,
  // plus an explicit `--expect <n>` for a release gate that wants to pin the number it measured.
  // Found by the independent review of stage 4.
  let manifestCount = null;
  try { manifestCount = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')).counts?.skills ?? null; }
  catch { manifestCount = null; }
  report.manifestCount = manifestCount;
  if (manifestCount === null) {
    report.failures.push('manifest.json could not be read, so the catalog size has no floor: a truncated skills/ would report 100%');
  } else if (manifestCount !== ids.length) {
    report.failures.push(`catalog size floor: skills/ has ${ids.length} skills, manifest.json counts ${manifestCount}`);
  }
  const expected = arg('expect');
  if (expected !== null) {
    report.expected = Number(expected);
    if (Number(expected) !== ids.length) {
      report.failures.push(`catalog size floor: --expect ${expected} but skills/ has ${ids.length}`);
    }
  }

  const basePathOf = (id) => join(cwd, '.rsc', 'skills', id);
  let firstPass = null;
  let firstPassMdc = null;

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

    // The Cursor `.mdc` is the only delivery that is RE-RENDERED rather than linked, so it is the
    // only one where a non-idempotent renderer could show up — and it was not in this comparison.
    const mdcs = {};
    for (const id of ids) {
      const path = join(cwd, '.cursor', 'rules', `${id}.mdc`);
      if (existsSync(path)) mdcs[id] = readFileSync(path, 'utf8');
    }

    if (pass === 1) { firstPass = bases; firstPassMdc = mdcs; }
    else {
      // Criterion 5 over the INSTALLED tree: a second full install must change nothing.
      const drifted = ids.filter((id) => firstPass[id] !== bases[id]);
      const driftedMdc = ids.filter((id) => firstPassMdc[id] !== mdcs[id]);
      const label = pass === 2 ? 'reinstall' : 'forcedRefresh';
      report.idempotence[label] = {
        compared: ids.length, drifted: drifted.length, examples: drifted.slice(0, 5),
        comparedMdc: Object.keys(firstPassMdc).length, driftedMdc: driftedMdc.length, examplesMdc: driftedMdc.slice(0, 5),
      };
      console.log(`idempotence (${label}): ${ids.length - drifted.length}/${ids.length} bases byte-identical`
        + `, ${Object.keys(firstPassMdc).length - driftedMdc.length}/${Object.keys(firstPassMdc).length} cursor .mdc byte-identical`);
      for (const id of drifted) report.failures.push(`idempotence ${label} ${id}: differs from pass 1`);
      for (const id of driftedMdc) report.failures.push(`idempotence ${label} ${id}.mdc: differs from pass 1`);
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
      const kinds = {};
      for (const id of ids) {
        const bad = auditDelivery(target, id, cwd, home, basePathOf(id));
        const kind = deliveryKind(target, id, cwd, home);
        kinds[kind] = (kinds[kind] || 0) + 1;
        if (bad.length) report.failures.push(`pass ${pass} ${target} ${id}: ${bad.join('; ')}`);
        else ok += 1;
      }
      report.targets[target][`deliveredPass${pass}`] = ok;
      report.targets[target][`kindsPass${pass}`] = kinds;
      const surface = alwaysOnSurface(target, cwd, home);
      if (surface.error) report.failures.push(`pass ${pass} ${target} always-on: ${surface.error}`);
      else if (surface.text.includes(BLOCK_BEGIN) || surface.text.includes(BLOCK_END)) {
        report.failures.push(`pass ${pass} ${target} always-on: the governance block reached ${surface.from}`);
      }
      report.targets[target].alwaysOnSurface = surface.from || null;
      report.targets[target].alwaysOnBytes = surface.text ? Buffer.byteLength(surface.text) : null;
      console.log(`pass ${pass}: ${target} delivery conformant ${ok}/${ids.length}`
        + ` [${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ')}]`
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
