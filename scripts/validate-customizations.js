#!/usr/bin/env node
// Run the project-artifact validators over a project. Deterministic, offline, read-only.
//
// TWO ROOTS, one invocation:
//
//   `02-DOCS/wiki/skills/<id>/README.md`  — the per-skill customizations (CUSTOMIZATION-SCHEMA.md §3)
//   `02-DOCS/wiki/brownfield/<slug>.md`   — the brownfield run reports and the conflict records in
//                                           them (CONFLICT-RECORD.md §7). Added by stage 6 on the
//                                           coordinator's decision 2: before it, 16 rules and 22
//                                           deterministic properties were decidable and read by
//                                           nothing at all.
//
// These are the same functions `install` and `sync` call (see `scripts/install-apply.js`), exposed
// so a human — or `npm run gate` — can run them on demand.
//
// Exit 1 when any error-severity finding exists. Two severities deliberately do NOT fail:
//   `orphaned` — a fact about the catalog, not a defect in the file, and it must survive on disk.
//   `not-run`  — a rule that could not be CHECKED. It is printed, loudly, because "not checked" and
//                "no finding" are different states and collapsing them is how a gate starts lying.

import { formatFindings, errorsOf, validateBrownfieldRuns, validateCustomizations } from './lib/customization-validator.js';

/**
 * Whether rule 13's greenfield gate applies: a project with no source files and no manifests.
 * Computed from `scanProject`, which is the discriminator `BROWNFIELD.md` §3 names — imported
 * lazily because `scripts/lib/onboarding.js` imports `install-apply.js`, and a static import here
 * would close a cycle for no benefit.
 */
export async function greenfieldOf(cwd) {
  try {
    const { scanProject } = await import('./lib/onboarding.js');
    const scan = scanProject(cwd);
    return scan.sourceFileCount === 0 && !(scan.signals || []).some((s) => /manifest|package|lock|requirements|gradle|cargo|gemfile|pom/i.test(String(s)));
  } catch { return null; }
}

async function main() {
  const cwdFlag = process.argv.find((a) => a.startsWith('--cwd='));
  const cwd = cwdFlag ? cwdFlag.slice(6) : process.cwd();
  const json = process.argv.includes('--json');
  const reports = [];

  const customizations = validateCustomizations({ cwd });
  reports.push(['customizations', customizations]);

  // The greenfield discriminator walks the project tree, so it is computed only when there is a
  // run report for rule 13 to apply to. No report, no walk, and the rule has nothing to gate.
  const { existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { BROWNFIELD_ROOT } = await import('./lib/customization-validator.js');
  const greenfield = existsSync(join(cwd, BROWNFIELD_ROOT)) ? await greenfieldOf(cwd) : null;
  const brownfield = validateBrownfieldRuns({ cwd, greenfield });
  reports.push(['brownfield runs', brownfield]);

  if (json) {
    console.log(JSON.stringify({
      cwd,
      greenfield,
      customizations: { ran: customizations.ran, root: customizations.root, files: customizations.files, orphaned: customizations.orphaned, findings: customizations.findings },
      brownfield: { ran: brownfield.ran, root: brownfield.root, files: brownfield.files, records: brownfield.records, coverageFloorRan: brownfield.floorRan, findings: brownfield.findings },
    }, null, 2));
  } else {
    for (const [label, report] of reports) {
      if (!report.ran) {
        console.log(`no ${report.root}/ in ${cwd} — absence is valid; no ${label} to validate`);
        continue;
      }
      for (const line of formatFindings(report, cwd)) console.log(line);
    }
    const custErrors = errorsOf(customizations);
    const bfErrors = errorsOf(brownfield);
    console.log(`\n${customizations.files.length} customization(s) checked · ${custErrors.length} error(s) `
      + `· ${customizations.orphaned.length} orphaned`);
    console.log(`${brownfield.files.length} brownfield run(s) checked · ${brownfield.records.length} conflict record(s) `
      + `· ${bfErrors.length} error(s) · coverage floor ${brownfield.floorRan ? 'ran' : 'DID NOT RUN'}`
      + `${greenfield === null ? ' · greenfield gate DID NOT RUN' : greenfield ? ' · greenfield gate applied' : ''}`);
  }

  if (errorsOf(customizations).length || errorsOf(brownfield).length) process.exitCode = 1;
}

if (process.argv[1] && process.argv[1].endsWith('validate-customizations.js')) await main();
