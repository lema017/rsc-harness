#!/usr/bin/env node
// `npm run gate` — the deterministic gate three documents already cite as an instrument, and that
// did not exist until stage 6 wrote it.
//
// It was cited in the future tense by `CUSTOMIZATION-SCHEMA.md` §3 ("Does not exist yet … it is a
// Stage 6 deliverable"), in `ARCHITECTURE.md` §"Dónde pueden correr" ("Script local (`npm run gate`)
// … 130 s medidos"), and asserted as already running by `BROWNFIELD.md` §6 item 3. A gate that three
// documents name and no `package.json` defines is the exact defect this fork keeps finding in its
// own paperwork, so this file is deliberately boring: a fixed list, in a fixed order, with the exit
// code of each child as the verdict.
//
// WHAT IS IN IT, AND WHY EXACTLY THESE. `ARCHITECTURE.md` §"Qué se adopta, qué se arregla, qué se
// descarta" already ruled on every inherited check. The four it ADOPTS are here. The two the fork
// added are here because stage 6's brief requires them. Everything it marks "arreglar primero" or
// "descartar" is NOT here — and is printed anyway, with the reason, because a gate that hides what
// it does not check is worse than one that checks less.
//
// Three properties, each load-bearing:
//
//   DETERMINISTIC. No network, no clock, no agent run. Every check is the same verdict on the same
//   bytes. `design:upstream` is excluded for exactly this reason: its verdict changes without this
//   repository changing.
//
//   HERMETIC, within the limits §1 of the requirements sets. Nothing here installs anything, and
//   nothing writes outside this repository. `eval-lint.sh` is excluded because it writes to literal
//   `/tmp` (limit L2) and needs PyYAML, which would be a global install; `drift:knowledge` is
//   excluded because it reads auto-memory under `HOME`, so it is not hermetic.
//
//   IT NEVER REPORTS A CHECK IT DID NOT RUN AS PASSED. A check that cannot run (a missing git ref,
//   say) prints SKIP with the reason and is counted as skipped, not as green.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * The gate, in order. Fast and broad first, so a trivial break is reported in seconds rather than
 * after the slowest check.
 */
const CHECKS = [
  {
    id: 'validate',
    what: 'frontmatter + recommends of every skill in the catalog',
    why: 'ARCHITECTURE.md §"Qué se adopta": the only guardian of the 274 frontmatters',
    argv: ['scripts/build-manifest.js', '--validate'],
  },
  {
    id: 'manifest:check',
    what: 'manifest.json is current for the catalog on disk',
    why: 'ARCHITECTURE.md §"Qué se adopta": it guards the INPUT of every ranker check',
    argv: ['scripts/build-manifest.js', '--check'],
  },
  {
    id: 'governance:check',
    what: 'the shipped governance artifacts are byte-identical to their authoritative sources',
    why: 'the package ships `schema/`, not `docs/`, so a hand edit to the shipped copy would be invisible',
    argv: ['scripts/governance-sync.js', '--check'],
  },
  {
    id: 'governance:customizations',
    what: 'both project-artifact roots: 02-DOCS/wiki/skills/ and 02-DOCS/wiki/brownfield/',
    why: 'the deterministic half of acceptance criteria 8 and 10. Absence of either root is a valid state',
    argv: ['scripts/validate-customizations.js'],
    // THIS CHECK IS VACUOUS IN THIS REPOSITORY, and saying so is the point. The fork's own checkout
    // is not a consumer project: it has no `02-DOCS/`, so there is nothing to validate and the check
    // passes trivially. Its real invocation points are `install`/`sync` and
    // `rscg brownfield --validate` inside a project. `ARCHITECTURE.md` flagged exactly this shape in
    // three inherited validators ("vacuos en clon limpio"), so this gate names it on itself rather
    // than letting "7/7 passed" imply coverage it does not have.
    vacuousWhen: (out) => /absence is valid/.test(out.detail || ''),
    vacuousNote: 'nothing to validate here: this repository is not a consumer project. '
      + 'Non-vacuous only where 02-DOCS/ exists — see DISTRIBUTION.md §5',
  },
  {
    id: 'skills-invariant',
    what: '`skills/` is still byte-identical to the incorporated upstream commit',
    why: 'Strategy B IS this invariant: governance is applied at install, never to the mirror',
    run: skillsInvariant,
  },
  {
    id: 'drift:check',
    what: 'every prose link in the catalog resolves',
    why: 'ARCHITECTURE.md §"Qué se adopta": deterministic, 886 links',
    argv: ['scripts/drift-check.js'],
  },
  {
    id: 'originality:check',
    what: 'the pinned third-party fingerprints still hold',
    why: 'ARCHITECTURE.md §"Qué se adopta": deterministic and offline (schema/ecc-originality.u64)',
    argv: ['scripts/originality-check.js'],
  },
];

/**
 * Deliberately NOT in the gate, with the reason, printed on every run.
 *
 * The verdicts are `ARCHITECTURE.md` §"Qué se adopta, qué se arregla, qué se descarta"'s own; the
 * two limits are the ledger's L2 and §1 of the requirements. Printing this list is the difference
 * between "the gate is green" and "the gate is green on the seven things it checks".
 */
const NOT_IN_THE_GATE = [
  ['npm test', 'the authoritative run measures 1 h 33 m 37 s with concurrency 1. A release gate, never an iteration gate (D11)'],
  ['eval-lint.sh', 'writes to literal /tmp (limit L2) and needs PyYAML, which would be a global install — forbidden by §1. It also fails open today'],
  ['routing:audit', 'inherited red at 84.9 % < 85 %, delta zero before and after governance. ARCHITECTURE.md: fix first, then adopt'],
  ['spec:gate', 'vacuous: it returns without touching the failure counter. ARCHITECTURE.md: fix first'],
  ['knowledge:doctor', 'vacuous: it exits 0 before looking at anything. ARCHITECTURE.md: fix first'],
  ['drift:knowledge', 'not hermetic: it reads auto-memory under HOME. ARCHITECTURE.md: fix first'],
  ['design:upstream', 'needs the network against two third-party repositories; its verdict changes without this repository changing'],
  ['verify-catalog-conformance.js', 'installs the 274 for 18 targets three times — minutes, not seconds. It is the criterion-4 instrument, run per release'],
];

/** The Strategy B invariant, as a check rather than as a sentence in a document. */
function skillsInvariant(root = ROOT) {
  const ref = spawnSync('git', ['rev-parse', '--verify', '--quiet', 'origin/main'], { cwd: root, encoding: 'utf8' });
  if (ref.status !== 0) {
    return { status: 'skip', detail: 'no `origin/main` ref in this clone — fetch it, or this check cannot run' };
  }
  const diff = spawnSync('git', ['diff', '--numstat', 'origin/main', '--', 'skills/'], { cwd: root, encoding: 'utf8' });
  if (diff.status !== 0) return { status: 'skip', detail: `git diff failed: ${(diff.stderr || '').trim().slice(0, 200)}` };
  const lines = diff.stdout.split('\n').filter(Boolean);
  if (!lines.length) return { status: 'pass', detail: '`git diff --numstat origin/main -- skills/` → 0 lines' };
  return {
    status: 'fail',
    detail: `${lines.length} file(s) in skills/ differ from origin/main. The mirror is the invariant:\n`
      + lines.slice(0, 20).map((l) => `    ${l}`).join('\n'),
  };
}

function runChild(argv) {
  const script = join(ROOT, argv[0]);
  // A missing validator is a FAILURE, never a skip. The independent review of stage 6 measured the
  // other way round: moving `scripts/originality-check.js` aside turned it into a SKIP and
  // `npm run gate` still exited 0 — so deleting a check bought a pass.
  if (!existsSync(script)) return { status: 'fail', detail: `${argv[0]} is not in this tree — a check that cannot be found is a failed check, not a skipped one` };
  const res = spawnSync(process.execPath, [script, ...argv.slice(1)], { cwd: ROOT, encoding: 'utf8' });
  const tail = `${res.stdout || ''}${res.stderr || ''}`.trim().split('\n').slice(-12).join('\n');
  if (res.error) return { status: 'fail', detail: String(res.error.message) };
  return { status: res.status === 0 ? 'pass' : 'fail', detail: tail, code: res.status };
}

function main() {
  const verbose = process.argv.includes('--verbose');
  const results = [];
  console.log('npm run gate — deterministic, offline, nothing written outside this repository\n');
  for (const check of CHECKS) {
    const t0 = Date.now();
    const out = check.run ? check.run() : runChild(check.argv);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    results.push({ id: check.id, ...out, secs });
    const vacuous = out.status === 'pass' && check.vacuousWhen?.(out);
    results[results.length - 1].vacuous = Boolean(vacuous);
    const label = { pass: vacuous ? 'VOID' : 'PASS', fail: 'FAIL', skip: 'SKIP' }[out.status];
    console.log(`${label.padEnd(5)} ${check.id.padEnd(28)} ${secs.padStart(6)}s  ${check.what}`);
    if (vacuous) console.log(`      ${check.vacuousNote}`);
    if (out.status !== 'pass' || verbose) {
      if (out.detail) console.log(out.detail.split('\n').map((l) => `      ${l}`).join('\n'));
      if (out.status === 'fail') console.log(`      why this is a gate: ${check.why}`);
    }
  }

  const failed = results.filter((r) => r.status === 'fail');
  const skipped = results.filter((r) => r.status === 'skip');
  const vacuous = results.filter((r) => r.vacuous);
  const total = results.reduce((n, r) => n + Number(r.secs), 0).toFixed(1);
  console.log(`\n${results.length - failed.length - skipped.length}/${results.length} passed`
    + `${vacuous.length ? ` (${vacuous.length} with nothing to check here)` : ''}`
    + `${failed.length ? `, ${failed.length} FAILED` : ''}`
    + `${skipped.length ? `, ${skipped.length} skipped` : ''} · ${total}s`);

  console.log('\nNot in this gate, and why — so "green" is read for what it is:');
  for (const [id, why] of NOT_IN_THE_GATE) console.log(`  ${id.padEnd(30)} ${why}`);

  if (skipped.length) {
    console.log('\nA skipped check is NOT a passed one. Each one above says what would make it runnable.');
  }
  if (vacuous.length) {
    console.log('\nA VOID check ran and had nothing to look at. It is not a failure and it is not coverage.');
  }
  // The exit code is the contract a CI reads, and `prepublishOnly` is `manifest && gate`. The
  // independent review of stage 6 measured the hole: in a clone with no `origin/main` ref the
  // Strategy B mirror check prints SKIP, `failed` stays empty, and the gate exits 0 — so a publish
  // from a shallow clone, or from a tree unpacked out of the tarball, skips the one invariant the
  // whole fork rests on and ships. A skip is not a pass, and now the exit code says so too.
  if (failed.length || (skipped.length && !process.argv.includes('--allow-skip'))) {
    if (!failed.length) {
      console.log('\nExiting non-zero because a check could not run. Make it runnable, or pass'
        + ' --allow-skip to accept the gap deliberately — never for a publish.');
    }
    process.exit(1);
  }
}

export { CHECKS, NOT_IN_THE_GATE, skillsInvariant };

if (process.argv[1] && process.argv[1].endsWith('gate.js')) main();
