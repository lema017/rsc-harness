#!/usr/bin/env node
// Fork maintenance (REQUIREMENTS §9) — the resumable entry point.
//
// The user starts this by hand, monthly or when they feel like it. It asks upstream what changed,
// says so and stops when nothing did, prepares a branch or a worktree when something did, works out
// what the change lands on, integrates it, re-verifies the governance transformation over the
// skills the change touched, runs the gate, records what no script can decide, applies a short and
// named list of fixes, writes the evidence, and promotes only as far as THIS run was authorized.
//
// Four things are worth knowing before reading the phases:
//
//   1. THE MERGE IS NOT THE PROOF. `scripts/lib/upstream-gate.js` holds PLAN §8's rule as code: a
//      textually clean merge is recorded as evidence with `counts: false` and contributes nothing
//      to the verdict. The verdict comes from G1–G11.
//
//   2. GOVERNANCE IS NOT APPLIED HERE, AND THAT IS THE POINT. Under Strategy B the transformation
//      runs at install (`ensureBase` → `governBase`), so there is nothing to write into `skills/`
//      for a new or changed skill — §9.6 is satisfied by construction. What this run does is
//      VERIFY that, in a real install, over exactly the skills this change touched. The `govern`
//      phase therefore measures; it does not edit the catalog, and it never could: the fork's
//      invariant is that `git diff upstream -- skills/` stays empty.
//
//   3. A RENAME IS NEVER APPLIED. The catalog has no stable identifier (`origin: risco` in all 274,
//      measured), so a rename is reported as a migration requiring a decision. PLAN §11 criterion
//      12 makes a silent rehome a failure even when the result would have been right.
//
//   4. RESUMING IS THE NORMAL CASE, not the exception. The journal under
//      `docs/fork/stage5/runs/<runId>/` is written after every phase; an interrupted phase is
//      re-run, never assumed finished.
//
// Usage (from the fork repository — this is maintenance of the FORK, not of a consumer project):
//
//   npm run upstream:check                 what changed, read-only, no branch, no merge
//   npm run upstream:maintain -- --authorize integrate
//   npm run upstream:maintain -- --resume
//   npm run upstream:maintain -- --resume --authorize validate
//   npm run upstream:maintain -- --authorize publish --promote main
//
// Flags: --remote <name> --ref <branch> --offline --no-fetch --base <commit> --worktree [dir]
//        --state-root <dir> --authorize <scope> --resume [runId] --check --json <file>
//        --ack <CHECK>=<text> --promote <branch> --repo <dir>

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  attributionDelta, classifyCatalogChanges, collisions, divergenceSurface, fetchRemote, git,
  hasRemote, isAncestor, lastIncorporated, probeRemote, revParse,
} from './lib/upstream-survey.js';
import {
  DEFAULT_STATE_ROOT, PHASES, beginPhase, blockPhase, completePhase, evidenceDir, failPhase,
  latestRunId, loadRun, newRun, nextPhase, recordDecision, recordEvidence, reportPath, resumeRun,
  runDir, saveRun, scopeAllows, skipRest, summarize,
} from './lib/upstream-state.js';
import {
  formatGate, gateVerdict, impactedTests, promotable, runGate, scopedConformance,
} from './lib/upstream-gate.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const PKG_ROOT = resolve(HERE, '..');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}
const flag = (name) => process.argv.includes(`--${name}`);

/** `--ack G6=the README table was updated` → `{ G6: 'the README table was updated' }`. */
function acknowledgementsFromArgv() {
  const out = {};
  process.argv.forEach((a, i) => {
    if (a !== '--ack') return;
    const v = process.argv[i + 1];
    if (!v || !v.includes('=')) return;
    const [id, ...rest] = v.split('=');
    out[id.trim()] = rest.join('=').trim();
  });
  return out;
}

const short = (sha) => (sha ? String(sha).slice(0, 8) : '—');

// ------------------------------------------------------------------ phases

/**
 * §9.1 and §9.2. Ask upstream where it is, work out what this fork last incorporated, and finish
 * if those are the same commit.
 *
 * The network half is separable on purpose: `--offline` uses the local remote-tracking ref and the
 * run records that the real fetch was NOT performed. A run that could not reach the network must
 * never read as a run that found nothing.
 */
async function phaseSurvey(ctx) {
  const { state, repo, remote, ref } = ctx;
  const out = { remote, ref, fetched: false, probe: null, offline: Boolean(ctx.offline) };

  if (!hasRemote(repo, remote)) {
    return {
      status: 'failed',
      summary: `no remote named \`${remote}\`. REQUIREMENTS §1: maintenance uses this clone's upstream remote`,
      data: out,
    };
  }

  if (ctx.offline) {
    out.note = 'offline: the remote was not contacted. The upstream head below is this clone\'s '
      + 'remote-tracking ref, which may be stale. NOT VERIFIED: the real fetch';
  } else {
    // Access check first, and anonymous: the parent is public, so no credential is offered and
    // none is needed. `probeRemote` writes nothing, which is what makes `--check` read-only.
    const probe = probeRemote({ cwd: repo, remote, ref });
    out.probe = { reachable: probe.reachable, head: probe.head, url: probe.url, error: probe.error };
    if (!probe.reachable) {
      return {
        status: 'failed',
        summary: `cannot reach \`${remote}\` anonymously: ${probe.error}. Re-run with --offline to `
          + 'work from the local remote-tracking ref, which records the fetch as not verified',
        data: out,
      };
    }
    if (ctx.noFetch) {
      out.note = '--no-fetch: the remote was reached but nothing was downloaded, so the upstream head '
        + 'below is this clone\'s remote-tracking ref and may be behind what the probe found. NOT '
        + `VERIFIED: the classification against the real head (${probe.head ? probe.head.slice(0, 8) : '?'})`;
    } else {
      const fetched = fetchRemote({ cwd: repo, remote, ref });
      out.fetched = fetched.ok;
      if (!fetched.ok) return { status: 'failed', summary: `fetch failed: ${fetched.error}`, data: out };
    }
  }

  const upstreamRef = `${remote}/${ref}`;
  const recorded = ctx.baseOverride || null;
  const where = lastIncorporated({ cwd: repo, upstreamRef, recorded });
  if (where.error) return { status: 'failed', summary: where.error, data: { ...out, ...where } };
  if (where.unrelated) {
    return {
      status: 'blocked',
      summary: `\`${upstreamRef}\` shares no history with this fork: upstream replaced its history, or `
        + 'the remote points at a different repository. That is a decision, not an integration',
      data: { ...out, ...where },
    };
  }
  if (where.rewritten) {
    return {
      status: 'blocked',
      summary: `the recorded base ${short(recorded)} is no longer reachable from \`${upstreamRef}\`: `
        + 'upstream rewrote history. That is a decision, not an integration',
      data: { ...out, ...where },
    };
  }
  Object.assign(out, {
    upstreamRef, base: where.base, head: where.head, upstreamHead: where.upstream, disagreement: where.disagreement,
  });

  state.base = { commit: where.base, describe: git(['log', '-1', '--format=%h %s', where.base], { cwd: repo }).stdout };
  state.head = { commit: where.upstream, ref: upstreamRef, describe: git(['log', '-1', '--format=%h %s', where.upstream], { cwd: repo }).stdout };

  if (where.base === where.upstream) {
    state.noChanges = true;
    return {
      status: 'done',
      summary: `no changes: \`${upstreamRef}\` is ${short(where.upstream)}, which this fork already incorporated`,
      data: { ...out, noChanges: true },
      finish: 'upstream has nothing new',
    };
  }
  // No `isAncestor(base, upstreamHead)` check here: the MEASURED base is the merge base, which is
  // an ancestor of the upstream head by definition, so such a check could never fire. A rewrite is
  // detectable only against a recorded base, which is what `lastIncorporated` does above when one
  // is supplied. Saying this out loud because a check that cannot fail reads like a guarantee.
  const count = git(['rev-list', '--count', `${where.base}..${where.upstream}`], { cwd: repo }).stdout;
  out.newCommits = Number(count) || 0;
  return {
    status: 'done',
    summary: `${out.newCommits} new upstream commit(s): ${short(where.base)} → ${short(where.upstream)}`,
    data: out,
  };
}

/** §9.4. What the change IS, and what it lands on. Still read-only. */
function phaseClassify(ctx) {
  const { state, repo } = ctx;
  const survey = state.phases.survey.data;
  const base = survey.base;
  const head = survey.upstreamHead;

  const classification = classifyCatalogChanges({ cwd: repo, base, head });
  const upstreamChanged = git(['diff', '--name-only', '--no-renames', `${base}..${head}`], { cwd: repo })
    .stdout.split('\n').filter(Boolean);
  const surface = divergenceSurface({ cwd: repo, base });
  const hits = collisions({ surface, upstreamChanged });
  const attribution = attributionDelta({ cwd: repo, base, head });
  const tests = impactedTests({ cwd: repo, upstreamChanged, classification });

  const data = {
    classification, upstreamChanged, surface, collisions: hits, attribution, impactedTests: tests,
  };

  // The three things PLAN §4 asks the maintenance to say out loud, as data rather than prose.
  const notices = [];
  if (classification.renameCandidates.length) {
    notices.push(`${classification.renameCandidates.length} rename candidate(s) — reported, never applied`);
    for (const r of classification.renameCandidates) {
      recordDecision(state, {
        id: `rename:${r.from}->${r.to}`,
        kind: 'migration',
        question: `upstream may have renamed \`${r.from}\` to \`${r.to}\` (${r.evidence}). Is it the `
          + 'same skill? If it is, the project customization at `02-DOCS/wiki/skills/'
          + `${r.from}/README.md\` has to be migrated by hand; nothing here moves it`,
      });
    }
  }
  if (classification.removed.length) notices.push(`${classification.removed.length} removal(s) — customizations become orphaned and are reported, never deleted`);
  if (classification.added.length) notices.push(`${classification.added.length} addition(s) — governed by construction at install, evaluation mandatory`);
  if (hits.onDivergence.length) notices.push(`COLLISION (${hits.severity}): upstream changed ${hits.onDivergence.join(', ')}, which this fork has modified`);
  if (attribution.added.length || attribution.changed.length || attribution.removed.length) {
    notices.push(`attribution: +${attribution.added.length} / ~${attribution.changed.length} / -${attribution.removed.length} notice file(s)`
      + (attribution.newVendored.length ? `, new vendored subtree(s): ${attribution.newVendored.join(', ')}` : ''));
  }
  data.notices = notices;

  return {
    status: 'done',
    summary: `added ${classification.added.length}, removed ${classification.removed.length}, `
      + `modified ${classification.modified.length}, rename candidates ${classification.renameCandidates.length}`
      + (notices.length ? ` · ${notices.length} notice(s)` : ''),
    data,
  };
}

/** §9.3. A branch, or an isolated worktree when asked for one. */
function phasePrepare(ctx) {
  const { state, repo } = ctx;
  const head = state.phases.survey.data.upstreamHead;
  const branch = `fork/upstream-${short(head)}`;
  const existing = state.phases.prepare.data;

  // Idempotent: a resumed run finds its own branch and reuses it rather than failing on it.
  if (existing?.branch === branch && revParse(repo, branch)) {
    return { status: 'done', summary: `reusing \`${branch}\` from the interrupted run`, data: existing };
  }
  if (revParse(repo, branch)) {
    return { status: 'done', summary: `branch \`${branch}\` already exists; reusing it`, data: { branch, worktree: existing?.worktree || null, reused: true } };
  }

  if (ctx.worktree) {
    const dir = ctx.worktree === true ? join(repo, '.rsc-upstream', `worktree-${state.runId}`) : resolve(ctx.worktree);
    const res = git(['worktree', 'add', '-b', branch, dir, 'HEAD'], { cwd: repo });
    if (!res.ok) return { status: 'failed', summary: `cannot create the worktree: ${res.stderr}`, data: { branch, dir } };
    return {
      status: 'done',
      summary: `worktree at ${dir} on \`${branch}\``,
      data: {
        branch, worktree: dir, cleanup: `git worktree remove ${dir}`,
      },
    };
  }
  const res = git(['branch', branch, 'HEAD'], { cwd: repo });
  if (!res.ok) return { status: 'failed', summary: `cannot create \`${branch}\`: ${res.stderr}`, data: { branch } };
  return { status: 'done', summary: `branch \`${branch}\` created from HEAD`, data: { branch, worktree: null } };
}

/**
 * §9.5. The merge. Its outcome is recorded; its CLEANLINESS is recorded as evidence and never as
 * proof — the gate is what decides (PLAN §8).
 */
function phaseIntegrate(ctx) {
  const { state, repo } = ctx;
  const prep = state.phases.prepare.data;
  const tree = prep.worktree || repo;
  const upstreamRef = state.phases.survey.data.upstreamRef;

  if (!prep.worktree) {
    const co = git(['checkout', prep.branch], { cwd: repo });
    if (!co.ok) return { status: 'failed', summary: `cannot check out \`${prep.branch}\`: ${co.stderr}`, data: { tree } };
  }

  // Already merged? A resumed run must not merge twice.
  if (isAncestor(tree, state.phases.survey.data.upstreamHead, 'HEAD')) {
    return {
      status: 'done',
      summary: `\`${upstreamRef}\` is already merged into \`${prep.branch}\``,
      data: { tree, branch: prep.branch, textualConflicts: 0, alreadyMerged: true, counts: false },
    };
  }

  const merge = git(['-c', 'user.name=rsc-governed maintenance', '-c', 'user.email=maintenance@localhost',
    'merge', '--no-ff', '-m', `Integrate upstream ${short(state.phases.survey.data.upstreamHead)}`,
    upstreamRef], { cwd: tree });
  const conflicts = git(['diff', '--name-only', '--diff-filter=U'], { cwd: tree })
    .stdout.split('\n').filter(Boolean);

  if (conflicts.length) {
    return {
      status: 'blocked',
      summary: `${conflicts.length} textual conflict(s): ${conflicts.slice(0, 8).join(', ')}. Resolve `
        + `them in ${tree} and resume; the merge is left in place`,
      data: {
        tree, branch: prep.branch, textualConflicts: conflicts.length, conflicts, counts: false,
      },
    };
  }
  if (!merge.ok) {
    return { status: 'failed', summary: `merge failed: ${merge.stderr}`, data: { tree, branch: prep.branch } };
  }
  return {
    status: 'done',
    summary: 'merged with 0 textual conflicts — which proves nothing about functional compatibility '
      + '(PLAN §8); the gate decides',
    data: {
      tree,
      branch: prep.branch,
      textualConflicts: 0,
      counts: false,
      note: 'recorded as evidence only',
    },
  };
}

/**
 * §9.6. Apply the governance strategy to new and modified skills.
 *
 * Under Strategy B that means VERIFY, not edit: the transformation is applied by `ensureBase` at
 * install time, so a skill upstream adds is governed with no list for anyone to update. This phase
 * does a real install of exactly the touched skills into a disposable project and audits what
 * landed — and asserts, by measurement, that `skills/` was not written to.
 */
async function phaseGovern(ctx) {
  const { state } = ctx;
  const tree = state.phases.integrate.data.tree;
  const cls = state.phases.classify.data.classification;
  const ids = [...new Set([...cls.added, ...cls.modified])];

  const before = git(['diff', '--numstat', state.phases.survey.data.upstreamRef, '--', 'skills/'], { cwd: tree }).stdout;
  if (!ids.length) {
    return {
      status: 'done',
      summary: 'no skill was added or modified; nothing to govern',
      data: { scope: [], mirrorDiffLines: before ? before.split('\n').length : 0 },
    };
  }
  const result = await scopedConformance({ cwd: tree, ids });
  const after = git(['diff', '--numstat', state.phases.survey.data.upstreamRef, '--', 'skills/'], { cwd: tree }).stdout;
  ctx.scopedConformance = result;

  const wroteCatalog = before !== after;
  return {
    status: result.ok && result.idempotent && !wroteCatalog ? 'done' : 'failed',
    summary: result.ok && result.idempotent && !wroteCatalog
      ? `${ids.length} skill(s) governed in a real install, byte-identical on the second pass, and `
        + '`skills/` untouched'
      : [
        result.ok ? null : `conformance: ${result.failures.slice(0, 4).join(' · ')}`,
        result.idempotent ? null : `drifted: ${result.drifted.join(', ')}`,
        wroteCatalog ? 'the transformation WROTE INTO `skills/` — the fork invariant is broken' : null,
      ].filter(Boolean).join(' · '),
    data: {
      scope: ids,
      failures: result.failures,
      drifted: result.drifted,
      project: result.project,
      catalogUntouched: !wroteCatalog,
    },
  };
}

/** §9.7. The gate. */
async function phaseValidate(ctx) {
  const { state } = ctx;
  const tree = state.phases.integrate.data.tree;
  const classify = state.phases.classify.data;

  const gateCtx = {
    cwd: tree,
    upstreamRef: state.phases.survey.data.upstreamRef,
    classification: classify.classification,
    surface: classify.surface,
    attribution: classify.attribution,
    upstreamChanged: classify.upstreamChanged,
    impactedTests: classify.impactedTests,
    acknowledgements: ctx.acknowledgements,
    scopedConformance: ctx.scopedConformance,
    testEnv: process.env,
  };
  const results = await runGate(gateCtx);
  // The merge goes in as `merge:`, never as the options object itself: `gateVerdict` records it
  // with `counts: false`, and a verdict that silently carried no merge evidence would make the
  // report quieter than the run.
  const verdict = gateVerdict(results, { merge: state.phases.integrate.data });
  ctx.gateResults = results;

  // Evidence files: the test run's numbers, which are the expensive part to reproduce.
  const g8 = results.find((r) => r.id === 'G8');
  if (g8?.measured) {
    const dir = evidenceDir(ctx.stateRoot, state.runId);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'impacted-tests.json');
    writeFileSync(file, `${JSON.stringify(g8.measured, null, 2)}\n`);
    recordEvidence(state, {
      label: 'impacted test subset',
      command: `node --test --test-concurrency=1 --test-timeout=1800000 ${(g8.measured.files || []).join(' ')}`,
      exit: g8.ok ? 0 : 1,
      stdoutPath: file,
      measured: g8.measured.tap || null,
    });
  }

  return {
    status: verdict.verdict === 'pass' ? 'done' : 'blocked',
    summary: `${verdict.verdict}: ${verdict.requiredChecks - verdict.failed.length}/${verdict.requiredChecks} `
      + `required checks pass${verdict.failed.length ? `; failing ${verdict.failed.join(', ')}` : ''}`,
    data: { results, verdict },
  };
}

/** §11. The semantic half, which no script here can run. */
function phaseEvaluate(ctx) {
  const { state } = ctx;
  const cls = state.phases.classify.data.classification;
  const ids = [...new Set([...cls.added, ...cls.modified])];
  if (!ids.length) return { status: 'done', summary: 'nothing to evaluate', data: { scope: [] } };

  const ack = ctx.acknowledgements?.G11 || null;
  const worklist = {
    scope: ids,
    repetitions: 3,
    rubric: 'docs/fork/stage1/EVALUATION.md',
    note: 'runs on the session\'s own agents (D5/D9); no API key, no external service, nothing leaves the machine',
  };
  const dir = evidenceDir(ctx.stateRoot, state.runId);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'semantic-evaluation-worklist.json');
  writeFileSync(file, `${JSON.stringify(worklist, null, 2)}\n`);

  if (!ack) {
    recordDecision(state, {
      id: 'G11',
      kind: 'evaluation',
      question: `${ids.length} added or modified skill(s) need a semantic evaluation at N=3 before `
        + `promotion: ${ids.join(', ')}. Record the result with --ack G11=<summary>`,
    });
    return {
      status: 'blocked',
      summary: `${ids.length} skill(s) await a semantic evaluation; worklist written to ${file}`,
      data: { ...worklist, worklist: file, instrumented: false },
    };
  }
  recordDecision(state, { id: 'G11', kind: 'evaluation', question: 'semantic evaluation of the touched skills', answer: ack });
  return { status: 'done', summary: `semantic evaluation recorded: ${ack}`, data: { ...worklist, worklist: file, recorded: ack } };
}

/**
 * §9.8. "Corrige problemas dentro de límites acordados" — and the limits are these two, named
 * rather than implied. Both are regenerations of files the repository already treats as generated,
 * so neither can invent a decision:
 *
 *   `manifest.json`              `scripts/build-manifest.js` owns it; `--check` says when it drifts
 *   `schema/governance/*`        `scripts/governance-sync.js` copies them from the authoritative doc
 *
 * Everything else becomes a named manual action. In particular a RETIRED_SKILLS entry is NOT
 * written here: it is a hand-maintained map in a file upstream also edits, and adding to it is a
 * new permanent divergence — exactly the kind of decision §9 says to surface, not to take.
 */
function phaseRemediate(ctx) {
  const { state } = ctx;
  const tree = state.phases.integrate.data.tree;
  const applied = [];
  const manual = [];

  const fixes = [
    {
      id: 'manifest',
      check: ['node', ['scripts/build-manifest.js', '--check']],
      fix: ['node', ['scripts/build-manifest.js']],
      why: 'manifest.json is generated from the catalog',
    },
    {
      id: 'governance-artifacts',
      check: ['node', ['scripts/governance-sync.js', '--check']],
      fix: ['node', ['scripts/governance-sync.js']],
      why: 'the shipped preamble and contract are copies of the authoritative documents',
    },
  ];
  for (const f of fixes) {
    const before = git(['status', '--porcelain'], { cwd: tree }).stdout;
    const probe = runNode(tree, f.check[1]);
    if (probe.ok) continue;
    const res = runNode(tree, f.fix[1]);
    const after = git(['status', '--porcelain'], { cwd: tree }).stdout;
    applied.push({
      id: f.id, why: f.why, ok: res.ok, changed: before !== after, output: res.stdout.slice(-400),
    });
    if (!res.ok) manual.push(`\`node ${f.fix[1].join(' ')}\` failed: ${res.stderr.slice(-200)}`);
  }

  // The named manual actions, derived from the gate rather than guessed.
  for (const r of ctx.gateResults || []) {
    if (r.ok) continue;
    if (r.id === 'G6') manual.push('record the new or changed third-party notices in the fork\'s obligation inventory (PLAN §2) and the README table, then re-run with --ack G6=<where>');
    else if (r.id === 'G10') manual.push('add the deleted skill id to `scripts/lib/retired-skills.js` (and the inline copy in `targets/clone-bootstrap.mjs`), then re-run with --ack G10=<commit>');
    else if (r.id === 'G11') manual.push('run the semantic evaluations and record the result with --ack G11=<summary>');
    else if (r.id === 'G7') manual.push(`re-apply the fork divergence the merge reverted: ${r.detail}`);
    else manual.push(`${r.id}: ${r.detail}`);
  }

  return {
    status: 'done',
    summary: `${applied.length} bounded fix(es) applied, ${manual.length} manual action(s) named`,
    data: { applied, manual, bounds: fixes.map((f) => f.id) },
  };
}

function runNode(cwd, args) {
  const res = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 300_000 });
  return {
    ok: res.status === 0, stdout: res.stdout || '', stderr: res.stderr || '',
  };
}

/** §9.9. The evidence, as a file beside the journal. */
function phaseEvidence(ctx) {
  const { state } = ctx;
  const file = reportPath(ctx.stateRoot, state.runId);
  mkdirSync(runDir(ctx.stateRoot, state.runId), { recursive: true });
  writeFileSync(file, renderReport(state, ctx));
  return { status: 'done', summary: `report written to ${file}`, data: { report: file } };
}

/**
 * §9.10. "Fusione o publique únicamente según la autorización de esa ejecución."
 *
 * Two gates, both required: the run must carry `publish` authorization AND the gate verdict must be
 * `pass`. Promotion is off unless a target branch is named, and the npm release is deliberately not
 * performed here — it belongs to the distribution stage and runs from `release.yml`
 * (`workflow_dispatch`), which is recorded as the remaining manual step.
 */
function phasePublish(ctx) {
  const { state, repo } = ctx;
  const verdict = state.phases.validate.data?.verdict;
  if (!verdict || !promotable(verdict)) {
    state.publication = {
      status: 'blocked', at: new Date().toISOString(), detail: `gate verdict is ${verdict?.verdict || 'unknown'}`,
    };
    return {
      status: 'blocked',
      summary: `not promoted: the gate verdict is ${verdict?.verdict || 'unknown'}. The stable version is untouched`,
      data: state.publication,
    };
  }
  const target = ctx.promote;
  if (!target) {
    state.publication = { status: 'authorized-not-performed', at: new Date().toISOString(), detail: 'no --promote target given' };
    return {
      status: 'done',
      summary: 'authorized and passing, but no --promote target was named, so nothing was merged. '
        + `Promote with: git merge --no-ff ${state.phases.prepare.data.branch}`,
      data: state.publication,
    };
  }
  const branch = state.phases.prepare.data.branch;
  const co = git(['checkout', target], { cwd: repo });
  if (!co.ok) return { status: 'failed', summary: `cannot check out \`${target}\`: ${co.stderr}`, data: { target } };
  const merge = git(['-c', 'user.name=rsc-governed maintenance', '-c', 'user.email=maintenance@localhost',
    'merge', '--no-ff', '-m', `Promote upstream integration ${branch}`, branch], { cwd: repo });
  state.publication = {
    status: merge.ok ? 'promoted' : 'failed',
    at: new Date().toISOString(),
    detail: merge.ok ? `${branch} → ${target}` : merge.stderr,
    remaining: 'the npm release is not performed here: run the `release.yml` workflow (workflow_dispatch) '
      + 'from the distribution stage',
  };
  return {
    status: merge.ok ? 'done' : 'failed',
    summary: merge.ok ? `promoted \`${branch}\` into \`${target}\`; the npm release remains a manual workflow_dispatch` : merge.stderr,
    data: state.publication,
  };
}

const RUNNERS = {
  survey: phaseSurvey,
  classify: phaseClassify,
  prepare: phasePrepare,
  integrate: phaseIntegrate,
  govern: phaseGovern,
  validate: phaseValidate,
  evaluate: phaseEvaluate,
  remediate: phaseRemediate,
  evidence: phaseEvidence,
  publish: phasePublish,
};

// ------------------------------------------------------------------ report

export function renderReport(state, ctx = {}) {
  const L = [];
  const s = state.phases.survey.data || {};
  const c = state.phases.classify.data || {};
  L.push(`# Upstream maintenance — run \`${state.runId}\``, '');
  L.push(`- started: ${state.startedAt}`, `- authorization: \`${state.authorization}\``);
  L.push(`- base (last incorporated): \`${short(s.base)}\` ${state.base?.describe || ''}`);
  L.push(`- upstream head: \`${short(s.upstreamHead)}\` ${state.head?.describe || ''}`);
  L.push(`- fetch performed: ${s.fetched ? 'yes' : `no${s.offline ? ' (offline — NOT VERIFIED)' : ''}`}`, '');

  if (state.noChanges) {
    L.push('## Result', '', 'Upstream has nothing new. Nothing was prepared, merged or published.', '');
    return `${L.join('\n')}\n`;
  }

  if (c.classification) {
    const k = c.classification;
    L.push('## The four change classes', '');
    L.push('| class | ids |', '|---|---|');
    L.push(`| added | ${k.added.join(', ') || '—'} |`);
    L.push(`| removed | ${k.removed.join(', ') || '—'} |`);
    L.push(`| modified | ${k.modified.join(', ') || '—'} |`);
    L.push(`| rename candidates | ${k.renameCandidates.map((r) => `${r.from}→${r.to} (${r.similarity}%)`).join(', ') || '—'} |`);
    L.push('');
    if (k.renameCandidates.length) {
      L.push('> A rename is reported, never applied. The catalog carries no stable identifier '
        + '(`origin: risco` in every SKILL.md), so similarity is the only signal there is.', '');
    }
  }
  if (c.collisions) {
    L.push('## Where it lands on the fork', '');
    L.push(`- divergence surface (measured): ${c.surface.modified.length} upstream-owned file(s) this fork has modified`);
    L.push(`- collisions: **${c.collisions.severity}** — ${c.collisions.onDivergence.join(', ') || 'none'}`);
    L.push(`- ${c.collisions.note}`, '');
  }
  if (c.attribution && (c.attribution.added.length || c.attribution.changed.length || c.attribution.removed.length)) {
    L.push('## Attribution obligations', '');
    for (const p of c.attribution.added) L.push(`- NEW notice: \`${p}\``);
    for (const p of c.attribution.changed) L.push(`- CHANGED notice: \`${p}\``);
    for (const p of c.attribution.removed) L.push(`- REMOVED notice: \`${p}\``);
    if (c.attribution.newVendored.length) L.push(`- new vendored subtree(s): ${c.attribution.newVendored.map((d) => `\`${d}\``).join(', ')}`);
    L.push('', `> ${c.attribution.obligation}`, '');
  }

  const merge = state.phases.integrate.data;
  if (merge) {
    L.push('## The merge', '', `- textual conflicts: **${merge.textualConflicts}**`,
      '- counts toward the verdict: **no**',
      '', '> A merge with no textual conflicts is not accepted as proof of functional compatibility '
      + '(PLAN §8). It is recorded here as evidence.', '');
  }

  const v = state.phases.validate.data;
  if (v) {
    L.push('## Gate', '', `**${v.verdict.verdict.toUpperCase()}** — `
      + `${v.verdict.requiredChecks - v.verdict.failed.length}/${v.verdict.requiredChecks} required checks pass`, '');
    L.push('```', ...formatGate(v.results), '```', '');
  }
  const rem = state.phases.remediate.data;
  if (rem?.manual?.length) {
    L.push('## Manual actions', '');
    for (const m of rem.manual) L.push(`- ${m}`);
    L.push('');
  }
  if (state.decisions.length) {
    L.push('## Decisions this run needs', '');
    for (const d of state.decisions) L.push(`- **${d.id}** (${d.kind}): ${d.question}${d.answer ? ` → *${d.answer}*` : ' — **open**'}`);
    L.push('');
  }
  L.push('## Phases', '', '| phase | status | summary |', '|---|---|---|');
  for (const row of summarize(state)) L.push(`| ${row.phase} | ${row.status} | ${(row.summary || '').replace(/\|/g, '\\|')} |`);
  L.push('');
  L.push(`Publication: **${state.publication.status}**${state.publication.detail ? ` — ${state.publication.detail}` : ''}`, '');
  if (ctx.stateRoot) L.push(`Journal: \`${join(runDir(ctx.stateRoot, state.runId), 'state.json')}\` — resume with \`--resume ${state.runId}\``, '');
  return `${L.join('\n')}\n`;
}

// ------------------------------------------------------------------ main

export async function maintain(options = {}) {
  const repo = resolve(options.repo || arg('repo') || PKG_ROOT);
  const stateRoot = resolve(options.stateRoot || arg('state-root') || join(repo, DEFAULT_STATE_ROOT));
  const check = options.check ?? flag('check');
  const resumeId = options.resume ?? (flag('resume') ? arg('resume') : null);
  const authorize = options.authorize || arg('authorize') || (check ? 'survey' : 'survey');
  const ctx = {
    repo,
    stateRoot,
    remote: options.remote || arg('remote') || 'upstream',
    ref: options.ref || arg('ref') || 'main',
    offline: options.offline ?? flag('offline'),
    // `--check` FETCHES. It has to: classifying a change needs the objects, and a check that read
    // only the local remote-tracking ref would report "no changes" whenever nobody had fetched
    // lately — which is a wrong answer that looks like a right one. A fetch updates
    // `refs/remotes/<remote>/<ref>` and nothing else: no branch moves, no file in the working tree
    // changes. `--no-fetch` is the strictly-read-only opt-out, and the run then says the data may
    // be stale.
    noFetch: options.noFetch ?? flag('no-fetch'),
    baseOverride: options.base || arg('base') || null,
    worktree: options.worktree ?? (flag('worktree') ? arg('worktree') : null),
    promote: options.promote || arg('promote') || null,
    acknowledgements: { ...acknowledgementsFromArgv(), ...(options.acknowledgements || {}) },
    quiet: options.quiet ?? false,
  };

  mkdirSync(stateRoot, { recursive: true });

  let state;
  let resumed = [];
  if (resumeId) {
    const id = resumeId === true ? latestRunId(stateRoot) : resumeId;
    if (!id) return { ok: false, error: `no run to resume under ${stateRoot}` };
    const loaded = loadRun({ stateRoot, runId: id });
    if (loaded.error) return { ok: false, error: loaded.error };
    state = loaded.state;
    resumed = resumeRun(state, { authorization: options.authorize || arg('authorize') || null });
    // An acknowledgement given on a resume answers the decision that blocked the previous pass.
    for (const [id2, answer] of Object.entries(ctx.acknowledgements)) {
      recordDecision(state, { id: id2, kind: 'acknowledgement', question: `recorded for gate check ${id2}`, answer });
    }
  } else {
    state = newRun({ repo, authorization: check ? 'survey' : authorize });
  }

  const say = (line) => { if (!ctx.quiet) console.log(line); };
  if (resumed.length) say(`resuming run ${state.runId} at: ${resumed.join(', ')}`);
  else say(`run ${state.runId} (authorization: ${state.authorization})`);

  ctx.state = state;
  saveRun(state, { stateRoot });

  for (;;) {
    const name = nextPhase(state);
    if (!name) break;
    if (!scopeAllows(state.authorization, name)) break;
    beginPhase(state, name);
    saveRun(state, { stateRoot }); // the journal records `running` BEFORE the work, so a crash is visible
    let out;
    try {
      // eslint-disable-next-line no-await-in-loop -- the phases are a sequence by definition.
      out = await RUNNERS[name](ctx);
    } catch (err) {
      out = { status: 'failed', summary: `${name} threw: ${err.message}`, data: { stack: err.stack } };
    }
    if (out.status === 'done') completePhase(state, name, out);
    else if (out.status === 'blocked') blockPhase(state, name, out);
    else failPhase(state, name, out);
    say(`  ${name}: ${out.status.toUpperCase()} — ${out.summary}`);
    if (out.finish) skipRest(state, name, out.finish);
    saveRun(state, { stateRoot });
    if (out.status !== 'done') break;
    if (check && name === 'classify') break;
  }

  // The report is written even when a phase blocked: evidence of a blocked run is still evidence.
  if (!check) {
    try { writeFileSync(reportPath(stateRoot, state.runId), renderReport(state, ctx)); } catch { /* reported below */ }
  }
  saveRun(state, { stateRoot });

  const blocked = PHASES.filter((p) => state.phases[p].status === 'blocked' || state.phases[p].status === 'failed');
  const result = {
    ok: blocked.length === 0,
    runId: state.runId,
    stateRoot,
    state,
    noChanges: Boolean(state.noChanges),
    blocked,
    report: check ? null : reportPath(stateRoot, state.runId),
  };
  const jsonOut = options.json || arg('json');
  if (typeof jsonOut === 'string') writeFileSync(jsonOut, `${JSON.stringify({ ...result, state: undefined }, null, 2)}\n`);
  return result;
}

async function main() {
  const res = await maintain();
  if (res.error) { console.error(res.error); process.exit(2); }
  if (res.noChanges) { console.log('\nNo changes from upstream. Nothing prepared, merged or published.'); process.exit(0); }
  if (!res.ok) {
    console.log(`\nblocked at: ${res.blocked.join(', ')}`);
    console.log(`resume with: --resume ${res.runId}`);
    process.exit(1);
  }
  console.log(`\nrun ${res.runId} complete${res.report ? ` · ${res.report}` : ''}`);
  process.exit(0);
}

// The main-guard shape the fork's other scripts use, not `pathToFileURL(argv[1])`:
// `tests/import-safe-entrypoints.test.js` documents why that one is wrong twice.
if (process.argv[1] && process.argv[1].endsWith('upstream-maintain.js')) await main();
