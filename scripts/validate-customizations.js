#!/usr/bin/env node
// Run the per-skill customization validator over a project. Deterministic, offline, read-only.
//
// It is the same function `install` and `sync` call (see `scripts/install-apply.js`), exposed so a
// human — or a gate — can run it on demand. Exit 1 when any error-severity finding exists; an
// orphaned customization is reported and does NOT fail, because an orphan is a fact about the
// catalog, not a defect in the file, and it must survive on disk either way.

import { formatFindings, errorsOf, validateCustomizations } from './lib/customization-validator.js';

function main() {
  const cwd = process.argv.find((a) => a.startsWith('--cwd=')) ? process.argv.find((a) => a.startsWith('--cwd=')).slice(6) : process.cwd();
  const report = validateCustomizations({ cwd });
  if (!report.ran) {
    console.log(`no ${report.root}/ in ${cwd} — absence is valid; nothing to validate`);
    return;
  }
  for (const line of formatFindings(report, cwd)) console.log(line);
  const errors = errorsOf(report);
  console.log(`\n${report.files.length} customization(s) checked · ${errors.length} error(s) · ${report.orphaned.length} orphaned`);
  if (errors.length) process.exitCode = 1;
}

if (process.argv[1] && process.argv[1].endsWith('validate-customizations.js')) main();
