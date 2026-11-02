#!/usr/bin/env node
// Keep the SHIPPED governance artifacts byte-identical to their authoritative sources.
//
// The preamble and the contract are authored once, in `docs/fork/stage1/`. The package ships
// `scripts`, `targets`, `schema`, `skills` and `manifest.json` — not `docs` — so the transformer
// cannot read the authoritative files at install time on a consumer's machine. It reads the copies
// under `schema/governance/` instead, and this script is the only thing allowed to write them.
//
// Deterministic, offline, and writes nothing outside this repository. `--check` reports drift and
// exits 1 without writing, which is the form a gate wants.

import { copyFileSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAIRS = [
  ['docs/fork/stage1/PREAMBLE-v1.txt', 'schema/governance/preamble-v1.txt'],
  ['docs/fork/stage1/CONTRACT.md', 'schema/governance/contract-v1.md'],
  // Added by stage 6. The brownfield procedure is a product artifact that has to reach a consumer's
  // machine for `rscg brownfield` to hand it to the agent, and stage 3 deliberately made it a
  // DOCUMENT rather than a 275th skill (`DESIGN.md` decision 12).
  ['docs/fork/stage3/BROWNFIELD.md', 'schema/governance/brownfield-v1.md'],
];

/** @returns {{from: string, to: string, same: boolean, missingSource: boolean}[]} */
export function governanceArtifactStatus(root = ROOT) {
  return PAIRS.map(([from, to]) => {
    let src = null;
    try { src = readFileSync(join(root, from)); } catch { /* source absent */ }
    let dst = null;
    try { dst = readFileSync(join(root, to)); } catch { /* copy absent */ }
    return {
      from,
      to,
      missingSource: src === null,
      same: Boolean(src && dst && src.equals(dst)),
    };
  });
}

function main() {
  const check = process.argv.includes('--check');
  const status = governanceArtifactStatus();
  let failed = 0;
  for (const row of status) {
    if (row.missingSource) {
      // Only possible in an installed package, where `docs/` was never shipped. Not an error there:
      // the shipped copy is the artifact, and there is nothing to compare it against.
      console.log(`skip  ${relative('.', row.from)} (source not present in this tree)`);
      continue;
    }
    if (row.same) { console.log(`ok    ${row.to}`); continue; }
    if (check) { console.error(`DRIFT ${row.to} differs from ${row.from}`); failed += 1; continue; }
    copyFileSync(join(ROOT, row.from), join(ROOT, row.to));
    console.log(`sync  ${row.to} <- ${row.from}`);
  }
  if (failed) {
    console.error(`\n${failed} shipped governance artifact(s) drifted. Run: npm run governance:sync`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('governance-sync.js')) main();
