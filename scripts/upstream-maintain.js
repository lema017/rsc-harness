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
  DEFAULT_STATE_ROOT, PHASES, acknowledgementsFrom, beginPhase, blockPhase, completePhase,
  evidenceDir, failPhase, latestRunId, loadRun, newRun, nextPhase, recordDecision, recordEvidence,
  repoRelative, reportPath, resumeRun, runDir, saveRun, scopeAllows, skipRest, summarize,
} from './lib/upstream-state.js';
import {
  formatGate, gateVerdict, impactedTests, promotable, runGate, scopedConformance, validateAck,
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

/** The ref the fork's repository is on right now: a branch name, or the commit when detached. */
function currentRef(repo) {
  const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: repo });
  if (branch.ok && branch.stdout) return branch.stdout;
  const sha = git(['rev-parse', 'HEAD'], { cwd: repo });
  return sha.ok && sha.stdout ? sha.stdout : null;
}

/**
 * The tree the phases after `integrate` operate on, as an absolute path.
 *
 * The journal stores it RELATIVE to the repository (see `repoRelative`), because the journal is
 * committed; it is resolved back here. `.` is the repository itself, which is the in-place case.
 */
function treeOf(ctx) {
  const rel = ctx.state.phases.integrate.data?.tree;
  return rel ? resolve(ctx.repo, rel) : ctx.repo;
}

/**
 * Put the fork's repository back on the branch the maintenance branch was cut from.
 *
 * Without `--worktree`, `phaseIntegrate` runs `git checkout <branch>` in the fork's own clone and
 * no path used to put it back, so a run that blocked at `validate` — the normal outcome, since G6,
 * G10 and G11 all need a human — left the operator's repository sitting on a maintenance branch
 * with a merge on it. A worktree run never moves the repository's HEAD, so there is nothing to
 * restore there.
 *
 * A failure to restore is REPORTED, not swallowed: the usual cause is an unresolved conflict in the
 * index, and in that case the operator needs to be on the maintenance branch anyway.
 */
function restoreStartRef(ctx) {
  const { state, repo } = ctx;
  const prep = state.phases.prepare?.data;
  if (!prep?.branch || prep.worktree) return null;
  const start = state.startRef;
  if (!start) return null;
  const current = currentRef(repo);
  if (current === start) return { ok: true, ref: start, movedBack: false, note: 'already on the starting ref' };
  const co = git(['checkout', start], { cwd: repo });
  return {
    ok: co.ok,
    ref: start,
    from: current,
    movedBack: co.ok,
    error: co.ok ? null : co.stderr,
    hint: co.ok ? null : `the repository is still on \`${current}\`; restore it with \`git checkout ${start}\``,
  };
}

/**
 * The other half of `restoreStartRef`: a resumed run whose next phase reads the INTEGRATED tree has
 * to be on the integration branch again, because the previous pass put the repository back.
 */
function reenterIntegrationBranch(ctx) {
  const { state, repo } = ctx;
  const prep = state.phases.prepare?.data;
  if (!prep?.branch || prep.worktree) return null;
  const next = nextPhase(state);
  if (!next || PHASES.indexOf(next) <= PHASES.indexOf('integrate')) return null;
  const current = currentRef(repo);
  if (current === prep.branch) return null;
  const co = git(['checkout', prep.branch], { cwd: repo });
  return {
    ok: co.ok, from: current, to: prep.branch, error: co.ok ? null : co.stderr,
  };
}

/**
 * Every absolute path out of a phase, rewritten relative to the repository.
 *
 * The structural fields are relativized where they are produced; this catches the prose — a summary
 * that names a worktree, a `why` from a directory comparison, a stack trace. The journal and the
 * report are committed to a repository meant to be published, so `/Users/<name>/...` has no
 * business in either, and relying on remembering to relativize each new string is how it got there.
 */
function scrubPaths(value, repo) {
  const real = resolve(repo);
  const rewrite = (s) => s.split(real).join('.');
  const walk = (v) => {
    if (typeof v === 'string') return rewrite(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, walk(val)]));
    }
    return v;
  };
  return walk(value);
}

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
  // AN UNMEASURED SURFACE FAILS THE PHASE. `divergenceSurface` returns `{ ok: false, modified: [] }`
  // when git cannot answer, and `[]` is a value the rest of this phase cannot distinguish from "the
  // fork has no divergences": `collisions` would then report severity `none` and the report would
  // print "upstream did not touch the fork's divergence surface" — a reassurance computed from a
  // failure. Nothing downstream gets the chance.
  if (surface.ok !== true) {
    return {
      status: 'failed',
      summary: `the fork's divergence surface could not be measured against ${short(base)}: `
        + `${surface.error || 'unknown git failure'}. Everything after this phase reads that surface, `
        + 'and a surface that measured nothing is not a surface measuring zero',
      data: { surface, upstreamChanged, classification },
    };
  }
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

  // THE STARTING REF IS RECORDED HERE, before anything moves, and restored on any exit that is not
  // a finished run. Recorded on the state rather than in this phase's data so a resume that re-runs
  // `prepare` cannot lose it.
  if (!state.startRef) state.startRef = existing?.startRef || currentRef(repo);
  const startRef = state.startRef;

  // Idempotent: a resumed run finds its own branch and reuses it rather than failing on it.
  if (existing?.branch === branch && revParse(repo, branch)) {
    return {
      status: 'done',
      summary: `reusing \`${branch}\` from the interrupted run`,
      data: { ...existing, startRef },
    };
  }
  if (revParse(repo, branch)) {
    return {
      status: 'done',
      summary: `branch \`${branch}\` already exists; reusing it`,
      data: {
        branch, worktree: existing?.worktree || null, reused: true, startRef,
      },
    };
  }

  if (ctx.worktree) {
    const dir = ctx.worktree === true ? join(repo, '.rsc-upstream', `worktree-${state.runId}`) : resolve(ctx.worktree);
    const res = git(['worktree', 'add', '-b', branch, dir, 'HEAD'], { cwd: repo });
    if (!res.ok) {
      return {
        status: 'failed',
        summary: `cannot create the worktree: ${res.stderr}`,
        data: { branch, dir: repoRelative(repo, dir), startRef },
      };
    }
    const rel = repoRelative(repo, dir);
    return {
      status: 'done',
      summary: `worktree at ${rel} on \`${branch}\``,
      data: {
        // Stored relative to the repository (the journal is committed) and resolved by `treeOf`.
        branch, worktree: rel, cleanup: `git worktree remove ${rel}`, startRef,
      },
    };
  }
  const res = git(['branch', branch, 'HEAD'], { cwd: repo });
  if (!res.ok) return { status: 'failed', summary: `cannot create \`${branch}\`: ${res.stderr}`, data: { branch, startRef } };
  return {
    status: 'done',
    summary: `branch \`${branch}\` created from \`${startRef}\``,
    data: { branch, worktree: null, startRef },
  };
}

/**
 * §9.5. The merge. Its outcome is recorded; its CLEANLINESS is recorded as evidence and never as
 * proof — the gate is what decides (PLAN §8).
 */
function phaseIntegrate(ctx) {
  const { state, repo } = ctx;
  const prep = state.phases.prepare.data;
  const tree = prep.worktree ? resolve(repo, prep.worktree) : repo;
  const treeRel = repoRelative(repo, tree);
  const upstreamRef = state.phases.survey.data.upstreamRef;

  if (!prep.worktree) {
    const co = git(['checkout', prep.branch], { cwd: repo });
    if (!co.ok) return { status: 'failed', summary: `cannot check out \`${prep.branch}\`: ${co.stderr}`, data: { tree: treeRel } };
  }

  // Already merged? A resumed run must not merge twice.
  if (isAncestor(tree, state.phases.survey.data.upstreamHead, 'HEAD')) {
    return {
      status: 'done',
      summary: `\`${upstreamRef}\` is already merged into \`${prep.branch}\``,
      data: {
        tree: treeRel, branch: prep.branch, textualConflicts: 0, alreadyMerged: true, counts: false,
      },
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
        + `them in ${treeRel} and resume; the merge is left in place`,
      data: {
        tree: treeRel, branch: prep.branch, textualConflicts: conflicts.length, conflicts, counts: false,
      },
    };
  }
  if (!merge.ok) {
    return { status: 'failed', summary: `merge failed: ${merge.stderr}`, data: { tree: treeRel, branch: prep.branch } };
  }
  return {
    status: 'done',
    summary: 'merged with 0 textual conflicts — which proves nothing about functional compatibility '
      + '(PLAN §8); the gate decides',
    data: {
      tree: treeRel,
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
  const { state, repo } = ctx;
  const tree = treeOf(ctx);
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
      // The disposable project lives under `.rsc-upstream/tmp/` inside the tree under audit (never
      // `/tmp`, never the user's `$HOME`), and is recorded relative to the repository.
      project: repoRelative(repo, result.project),
      catalogUntouched: !wroteCatalog,
    },
  };
}

/** §9.7. The gate. */
async function phaseValidate(ctx) {
  const { state, repo } = ctx;
  const tree = treeOf(ctx);
  const classify = state.phases.classify.data;

  // THE SURFACE IS RE-MEASURED HERE, against the integrated tree, and not reused from `classify`.
  // Two reasons, both of which bite exactly where it matters. `classify` ran before the merge, so
  // its surface describes the tree the merge was applied TO. And `classify` is not re-run on a
  // resume, so the one case where the surface has certainly changed — a human resolving a conflict
  // in `integrate` and resuming — is the case where reusing it is guaranteed to be wrong. Measured
  // against the working tree, so an uncommitted resolution counts.
  const surface = divergenceSurface({ cwd: tree, base: state.phases.survey.data.base });
  if (surface.ok !== true) {
    return {
      status: 'failed',
      summary: `the divergence surface could not be re-measured in ${repoRelative(repo, tree)}: `
        + `${surface.error || 'unknown git failure'}. The gate is not run against a surface it could not measure`,
      data: { surface },
    };
  }

  const gateCtx = {
    cwd: tree,
    upstreamRef: state.phases.survey.data.upstreamRef,
    classification: classify.classification,
    surface,
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
      // Relative, like everything else in the journal: this record is committed.
      stdoutPath: repoRelative(repo, file),
      measured: g8.measured.tap || null,
    });
  }

  return {
    status: verdict.verdict === 'pass' ? 'done' : 'blocked',
    summary: `${verdict.verdict}: ${verdict.requiredChecks - verdict.failed.length}/${verdict.requiredChecks} `
      + `required checks pass${verdict.failed.length ? `; failing ${verdict.failed.join(', ')}` : ''}`,
    data: { results, verdict, surface },
  };
}

/** §11. The semantic half, which no script here can run. */
function phaseEvaluate(ctx) {
  const { state, repo } = ctx;
  const cls = state.phases.classify.data.classification;
  const ids = [...new Set([...cls.added, ...cls.modified])];
  if (!ids.length) return { status: 'done', summary: 'nothing to evaluate', data: { scope: [] } };

  // Validated with the SAME rule G11 applies, so the phase and the check cannot disagree about
  // whether a result was recorded. A rejected acknowledgement leaves the decision open.
  const supplied = ctx.acknowledgements?.G11 || null;
  const verdictOnAck = supplied
    ? validateAck('G11', supplied, { cwd: treeOf(ctx), classification: cls })
    : { ok: false, error: 'is absent' };
  const ack = verdictOnAck.ok ? supplied : null;
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
  const rel = repoRelative(repo, file);

  if (!ack) {
    recordDecision(state, {
      id: 'G11',
      kind: 'evaluation',
      question: `${ids.length} added or modified skill(s) need a semantic evaluation at N=3 before `
        + `promotion: ${ids.join(', ')}. Record the result with --ack G11=<summary>`
        + (supplied ? ` — the result supplied ${verdictOnAck.error}` : ''),
    });
    return {
      status: 'blocked',
      summary: `${ids.length} skill(s) await a semantic evaluation; worklist written to ${rel}`
        + (supplied ? `; the recorded result was REJECTED: it ${verdictOnAck.error}` : ''),
      data: {
        ...worklist, worklist: rel, instrumented: false, ackRejected: supplied ? verdictOnAck.error : null,
      },
    };
  }
  recordDecision(state, { id: 'G11', kind: 'evaluation', question: 'semantic evaluation of the touched skills', answer: ack });
  return { status: 'done', summary: `semantic evaluation recorded: ${ack}`, data: { ...worklist, worklist: rel, recorded: ack } };
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
  const tree = treeOf(ctx);
  const applied = [];
  const manual = [];

  const fixes = [
    {
      id: 'manifest',
      check: ['node', ['scripts/build-manifest.js', '--check']],
      fix: ['node', ['scripts/build-manifest.js']],
      paths: ['manifest.json'],
      why: 'manifest.json is generated from the catalog',
    },
    {
      id: 'governance-artifacts',
      check: ['node', ['scripts/governance-sync.js', '--check']],
      fix: ['node', ['scripts/governance-sync.js']],
      paths: ['schema/governance'],
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
      id: f.id,
      why: f.why,
      ok: res.ok,
      changed: before !== after,
      paths: f.paths,
      output: res.stdout.slice(-400),
    });
    if (!res.ok) manual.push(`\`node ${f.fix[1].join(' ')}\` failed: ${res.stderr.slice(-200)}`);
  }

  // THE FIXES ARE COMMITTED, AND THE GATE IS RE-OPENED.
  //
  // Both of these scripts WRITE. Nothing used to commit what they wrote, and `publish` then ran
  // `git checkout <target>` and `git merge --no-ff <branch>` — promoting a branch that does not
  // contain the remediation, with the authority of a verdict computed before it was written. The
  // regenerated files were left as an uncommitted diff in the operator's tree, which a checkout
  // would carry across or refuse.
  //
  // Committing them is in scope: these are the two files PLAN §9.8's "límites acordados" names, and
  // both are regenerations of files this repository already treats as generated, so neither can
  // invent a decision. Anything outside the bound stays a named manual action and is never
  // committed here.
  const changed = applied.filter((a) => a.ok && a.changed);
  let committed = null;
  if (changed.length) {
    const paths = [...new Set(changed.flatMap((a) => a.paths))];
    const add = git(['add', '--', ...paths], { cwd: tree });
    const commit = add.ok
      ? git(['-c', 'user.name=rsc-governed maintenance', '-c', 'user.email=maintenance@localhost',
        'commit', '-m', `Maintenance: regenerate ${changed.map((a) => a.id).join(', ')}`,
        '--', ...paths], { cwd: tree })
      : { ok: false, stderr: add.stderr };
    committed = {
      ok: commit.ok,
      paths,
      commit: commit.ok ? revParse(tree, 'HEAD') : null,
      error: commit.ok ? null : commit.stderr,
    };
    if (!commit.ok) manual.push(`the bounded fixes could not be committed (${commit.stderr.slice(-200)}); commit \`${paths.join(' ')}\` by hand before promoting`);
  }

  // A verdict computed before the remediation does not describe the tree the remediation produced,
  // so `validate` goes back to `pending` and the gate runs again over what is now on disk. It can
  // only happen once: `remediate` is `done` by the time the loop comes back round.
  let revalidate = null;
  if (changed.length && state.phases.validate.status === 'done') {
    state.phases.validate.status = 'pending';
    state.phases.validate.endedAt = null;
    revalidate = 'the bounded fixes changed the tree, so `validate` was re-opened: the gate re-runs '
      + 'over the remediated tree rather than standing on a verdict that predates it';
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
    summary: `${applied.length} bounded fix(es) applied, ${manual.length} manual action(s) named`
      + (committed ? `; committed ${short(committed.commit)}` : '')
      + (revalidate ? '; `validate` re-opened' : ''),
    data: {
      applied, manual, committed, revalidate, bounds: fixes.map((f) => f.id),
    },
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
  const { state, repo } = ctx;
  const file = reportPath(ctx.stateRoot, state.runId);
  mkdirSync(runDir(ctx.stateRoot, state.runId), { recursive: true });
  writeFileSync(file, renderReport(state, ctx));
  const rel = repoRelative(repo, file);
  return { status: 'done', summary: `report written to ${rel}`, data: { report: rel } };
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

/**
 * The phases, callable. Exported so each one can be exercised against a fixture repository: the
 * properties that matter most here — `remediate` committing what it regenerated, `validate`
 * re-measuring the surface, the repository being put back where it was — are properties of single
 * phases, and a test that can only drive the whole sequence cannot pin any of them.
 */
export const PHASE_RUNNERS = {
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
    // The surface is printed with WHAT IT WAS MEASURED AGAINST. The previous version of this line
    // could print "0 upstream-owned file(s)" and the note "upstream did not touch the fork's
    // divergence surface" from a measurement that had failed, because `classify` did not read
    // `surface.ok`. It now cannot get here unmeasured — `classify` fails first — and the report
    // says which tree the number came from rather than leaving it to be assumed.
    L.push(`- divergence surface (measured against the ${c.surface.measuredAgainst || 'tree'}): `
      + `${c.surface.modified.length} upstream-owned file(s) this fork has modified`);
    L.push(`- collisions: **${c.collisions.severity}** — ${c.collisions.onDivergence.join(', ') || 'none'}`);
    L.push(`- ${c.collisions.note}`, '');
    const revalidated = state.phases.validate.data?.surface;
    if (revalidated && revalidated.modified.length !== c.surface.modified.length) {
      L.push(`> The gate re-measured the surface on the integrated tree and found `
        + `**${revalidated.modified.length}** modified file(s), not ${c.surface.modified.length}. `
        + 'The gate\'s number is the one the verdict used.', '');
    }
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
  if (v?.verdict) {
    L.push('## Gate', '', `**${v.verdict.verdict.toUpperCase()}** — `
      + `${v.verdict.requiredChecks - v.verdict.failed.length}/${v.verdict.requiredChecks} required checks pass`, '');
    L.push('```', ...formatGate(v.results), '```', '');
  } else if (v) {
    // `validate` can now fail BEFORE it computes a verdict — it refuses to run the gate against a
    // divergence surface it could not measure. There is no verdict to print in that case, and
    // printing a verdict shaped like one would be the whole mistake this correction is about.
    L.push('## Gate', '', '**NOT RUN** — the phase stopped before any check ran:',
      '', `> ${state.phases.validate.summary || 'no reason recorded'}`, '');
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
  if (state.treeRestored) {
    L.push(`Working tree: ${state.treeRestored.ok
      ? `restored to \`${state.treeRestored.ref}\``
      : `**NOT restored** — ${state.treeRestored.hint || state.treeRestored.error}`}`, '');
  }
  if (ctx.stateRoot) {
    const journal = repoRelative(ctx.repo || '', join(runDir(ctx.stateRoot, state.runId), 'state.json'));
    L.push(`Journal: \`${journal}\` — resume with \`--resume ${state.runId}\``, '');
  }
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
  } else {
    state = newRun({ repo, authorization: check ? 'survey' : authorize });
  }

  // EVERY ACKNOWLEDGEMENT IS RECORDED IN THE JOURNAL, AND THE GATE READS THE JOURNAL.
  //
  // This loop used to sit inside the `if (resumeId)` branch, so a FRESH run given `--ack` cleared
  // the gate and left no trace: the report had no decision to show and the next pass had nothing to
  // find. And `runGate`'s own comment said the acknowledgements came "from the run journal, never
  // from a flag typed at the moment of being blocked" while the only sources were argv and the
  // options object, and nothing read `state.decisions` at all (`decisionFor` was exported and never
  // called). Both halves are fixed in one place: the flag RECORDS a decision here, and
  // `ctx.acknowledgements` is then read back out of the journal, which is what the gate consumes.
  for (const [ackId, answer] of Object.entries(ctx.acknowledgements)) {
    recordDecision(state, {
      id: ackId,
      kind: 'acknowledgement',
      question: `recorded for gate check ${ackId}`,
      answer,
      decidedBy: resumeId ? '--ack on resume' : '--ack',
    });
  }
  ctx.acknowledgements = acknowledgementsFrom(state);

  const say = (line) => { if (!ctx.quiet) console.log(line); };
  if (resumed.length) say(`resuming run ${state.runId} at: ${resumed.join(', ')}`);
  else say(`run ${state.runId} (authorization: ${state.authorization})`);

  ctx.state = state;
  const reentered = reenterIntegrationBranch(ctx);
  if (reentered) {
    state.treeRestored = null;
    if (!reentered.ok) {
      return {
        ok: false,
        runId: state.runId,
        stateRoot,
        state,
        noChanges: Boolean(state.noChanges),
        blocked: ['integrate'],
        error: `cannot re-enter the integration branch \`${reentered.to}\`: ${reentered.error}`,
        report: null,
      };
    }
    say(`  re-entered \`${reentered.to}\` (the previous pass restored \`${reentered.from}\`)`);
  }
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
      out = await PHASE_RUNNERS[name](ctx);
    } catch (err) {
      out = { status: 'failed', summary: `${name} threw: ${err.message}`, data: { stack: err.stack } };
    }
    // The journal and the report are committed, so the repository's absolute path is rewritten out
    // of everything a phase says — including prose and stack traces, which no amount of
    // relativizing structural fields would have caught.
    out = { ...out, summary: scrubPaths(out.summary, repo), data: scrubPaths(out.data ?? null, repo) };
    if (out.status === 'done') completePhase(state, name, out);
    else if (out.status === 'blocked') blockPhase(state, name, out);
    else failPhase(state, name, out);
    say(`  ${name}: ${out.status.toUpperCase()} — ${out.summary}`);
    if (out.finish) skipRest(state, name, out.finish);
    saveRun(state, { stateRoot });
    if (out.status !== 'done') break;
    if (check && name === 'classify') break;
  }

  const blocked = PHASES.filter((p) => state.phases[p].status === 'blocked' || state.phases[p].status === 'failed');

  // THE REPOSITORY GOES BACK WHERE IT WAS on any exit that is not a finished run. `phaseIntegrate`
  // checks out the maintenance branch in the fork's own clone when no worktree was asked for, and
  // blocking at `validate` is the NORMAL outcome — G6, G10 and G11 each need a human — so without
  // this the operator was routinely left standing on a maintenance branch. A finished run keeps the
  // branch, because that is where promotion happens; a `--resume` re-enters it (see
  // `reenterIntegrationBranch`). If git refuses, the reason is reported and the hint names the
  // command, rather than the run claiming a tree state it did not achieve.
  if (blocked.length) {
    const restored = restoreStartRef(ctx);
    if (restored) {
      state.treeRestored = restored;
      say(restored.ok
        ? `  working tree: restored to \`${restored.ref}\``
        : `  working tree: NOT restored — ${restored.hint}`);
    }
  }

  // The report is written even when a phase blocked: evidence of a blocked run is still evidence.
  if (!check) {
    try { writeFileSync(reportPath(stateRoot, state.runId), renderReport(state, ctx)); } catch { /* reported below */ }
  }
  saveRun(state, { stateRoot });
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
