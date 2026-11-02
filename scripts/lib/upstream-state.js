// Fork maintenance (§9) — the run state, which is the whole of "resumable".
//
// A maintenance run is a sequence of phases over a tree that changes under them: a merge lands, a
// transformation is re-verified, a test subset runs for an hour. Any of those can be interrupted —
// by the machine, by the operator, by a blocker that needs a decision. REQUIREMENTS §9 asks the
// process to persist "commits, cambios, adaptaciones, decisiones, resultados y estado de
// publicación" and to allow resuming it, so the state is a journal on disk and nothing else is
// authoritative. Nothing is held in memory between phases that is not written down first.
//
// Three decisions are load-bearing:
//
//   1. THE STATE IS THE EVIDENCE. The run directory lives under `docs/fork/stage5/runs/<runId>/`,
//      which `.gitignore` allows (`docs/*` then `!docs/fork/`), so the journal of what was
//      incorporated is committable alongside the merge it describes. A run directory under a
//      scratch path would make the evidence of §9.9 disposable.
//
//   2. AN INTERRUPTED PHASE IS RE-RUN, NEVER SKIPPED. Resume resets a `running` phase to `pending`
//      and executes it again, which is only safe because every phase is written to be idempotent.
//      The alternative — treating `running` as "probably finished" — turns a crash into a silent
//      gap in the chain of evidence.
//
//   3. AUTHORIZATION IS A CEILING, CHECKED PER PHASE. §9.10 says publish "únicamente según la
//      autorización de esa ejecución", so the scope granted at the start of a run is recorded in
//      the state and each phase declares the minimum scope it needs. A phase above the ceiling is
//      `skipped` with a reason, not quietly omitted, so the report says what was not done.

import {
  existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import {
  basename, dirname, isAbsolute, join, relative, resolve,
} from 'node:path';

/** State file schema version. Bumped when the shape changes incompatibly. */
export const STATE_SCHEMA = 1;

/** Where runs live by default, relative to the repository root. */
export const DEFAULT_STATE_ROOT = join('docs', 'fork', 'stage5', 'runs');

/**
 * The phases, in order. `survey` and `classify` are read-only; everything from `prepare` on
 * touches the tree.
 */
export const PHASES = Object.freeze([
  'survey', // ask upstream where it is and work out what this fork last incorporated
  'classify', // the four change classes, the measured divergence surface, the attribution delta
  'prepare', // a branch or a worktree to integrate into
  'integrate', // the merge itself — whose cleanliness proves nothing (see upstream-gate.js)
  'govern', // the transformation re-verified over added and modified skills
  'validate', // the gate: what this fork accepts as proof of functional compatibility
  'evaluate', // semantic evaluations of the new and modified skills (not instrumented here)
  'remediate', // the bounded fixes, and a named manual action for everything outside the bound
  'evidence', // the report
  'publish', // only per this run's authorization
]);

/** Authorization scopes, from least to most. A run carries one; it is a ceiling, not a target. */
export const AUTH_SCOPES = Object.freeze(['survey', 'integrate', 'validate', 'publish']);

/** The minimum scope each phase needs. A phase above the run's ceiling is skipped, with a reason. */
export const PHASE_SCOPE = Object.freeze({
  survey: 'survey',
  classify: 'survey',
  prepare: 'integrate',
  integrate: 'integrate',
  govern: 'integrate',
  validate: 'validate',
  evaluate: 'validate',
  remediate: 'validate',
  evidence: 'validate',
  publish: 'publish',
});

const TERMINAL = new Set(['done', 'skipped']);

/** Is `scope` enough to run `phase`? */
export function scopeAllows(scope, phase) {
  const have = AUTH_SCOPES.indexOf(scope);
  const need = AUTH_SCOPES.indexOf(PHASE_SCOPE[phase]);
  if (have < 0 || need < 0) return false;
  return have >= need;
}

/** The phases a run with this scope is allowed to execute, in order. */
export function phasesAllowedBy(scope) {
  return PHASES.filter((p) => scopeAllows(scope, p));
}

export function runDir(stateRoot, runId) {
  return join(stateRoot, runId);
}
export function statePath(stateRoot, runId) {
  return join(runDir(stateRoot, runId), 'state.json');
}
export function evidenceDir(stateRoot, runId) {
  return join(runDir(stateRoot, runId), 'evidence');
}
export function reportPath(stateRoot, runId) {
  return join(runDir(stateRoot, runId), 'report.md');
}

/**
 * Every path this journal and its report print, expressed relative to the repository root.
 *
 * The run directory lives under `docs/fork/` BECAUSE it is committed: it is the evidence of what
 * was incorporated, and it belongs beside the merge that incorporated it. That is exactly why it
 * must not carry `/Users/<name>/...`. The journal recorded `"repo": "/Users/home/…"`, the report
 * printed absolute paths for the worktree, the integration tree, the disposable project, the
 * evidence files and the journal itself, and `evidence/impacted-tests.json` carried the VALUE of
 * `GIT_CEILING_DIRECTORIES` — all of it on its way to a repository meant to be published.
 *
 * A path outside the repository still relativizes (`../../elsewhere/x`), which says where it is in
 * relation to the tree without saying whose machine it is on. `state.repo` keeps only the
 * repository directory's name, which is the anchor these paths are read against and is already
 * public in `package.json`.
 */
export function repoRelative(repo, path) {
  if (!path) return path ?? null;
  const p = String(path);
  if (!repo || !isAbsolute(p)) return p;
  const rel = relative(resolve(repo), p);
  return rel === '' ? '.' : rel;
}

/** The anchor stored in the journal: the repository's directory name, never its absolute path. */
export function repoLabel(repo) {
  return repo ? basename(resolve(repo)) : null;
}

/**
 * The acknowledgements the GATE reads, taken from the journal rather than from argv.
 *
 * `runGate`'s own documentation promised the acknowledgements came "from the run journal, never
 * from a flag typed at the moment of being blocked", while the only sources were
 * `acknowledgementsFromArgv()` and `options.acknowledgements` and nothing read `state.decisions` at
 * all. This is the function that makes the sentence true: the flag records a decision, and the gate
 * reads the decisions.
 */
export function acknowledgementsFrom(state) {
  const out = {};
  for (const d of state?.decisions || []) {
    if (d.kind === 'acknowledgement' && d.answer) out[d.id] = d.answer;
  }
  return out;
}

/**
 * A run id that sorts chronologically and cannot collide within a second: the UTC timestamp plus
 * six hex characters derived from the inputs that make this run what it is. Deterministic given
 * the same inputs, which is what lets a test assert on it.
 */
export function makeRunId({ now = new Date(), base = '', head = '', repo = '' } = {}) {
  const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const salt = createHash('sha256').update(`${base}|${head}|${repo}`, 'utf8').digest('hex').slice(0, 6);
  return `${stamp}-${salt}`;
}

/** A fresh run. Nothing is on disk until `saveRun`. */
export function newRun({
  repo, authorization = 'survey', now = new Date(), runId = null, base = null, head = null, notes = null,
} = {}) {
  if (!AUTH_SCOPES.includes(authorization)) {
    throw new Error(`unknown authorization scope \`${authorization}\`; expected one of ${AUTH_SCOPES.join(', ')}`);
  }
  const startedAt = new Date(now).toISOString();
  const phases = {};
  for (const name of PHASES) {
    phases[name] = scopeAllows(authorization, name)
      ? { status: 'pending', startedAt: null, endedAt: null, summary: null, data: null }
      : {
        status: 'skipped',
        startedAt: null,
        endedAt: null,
        summary: `not authorized for this run (scope \`${authorization}\`, needs \`${PHASE_SCOPE[name]}\`)`,
        data: null,
      };
  }
  return {
    schema: STATE_SCHEMA,
    runId: runId || makeRunId({ now, base, head, repo }),
    // The NAME of the repository directory, not its path: the journal is committed, and every other
    // path in it is relative to this anchor. See `repoRelative`.
    repo: repoLabel(repo),
    startedAt,
    updatedAt: startedAt,
    // The scope granted when THIS run started. Re-granting means starting a new run or resuming
    // with an explicit new scope, which is recorded in `authorizationHistory`.
    authorization,
    authorizationHistory: [{ scope: authorization, at: startedAt, notes }],
    base: base ? { commit: base } : null,
    head: head ? { commit: head } : null,
    phases,
    decisions: [],
    evidence: [],
    // Set by `survey` when upstream has nothing new. Everything after it is then skipped.
    noChanges: null,
    publication: { status: 'not-authorized', at: null, detail: null },
  };
}

/**
 * Atomic: write beside the target and rename, so an interrupted write cannot truncate the state.
 *
 * BOTH files get the same treatment. The pointer used to be written in place, which is the one way
 * `--resume` with no id could read a half-written run id — the smaller sibling of the truncation the
 * state file is already protected against. And a crash between the write and the rename used to
 * leave `state.json.tmp` behind in a directory that is COMMITTED, so the temporary is removed on
 * the next save as well as on the way in.
 */
export function saveRun(state, { stateRoot }) {
  const dest = statePath(stateRoot, state.runId);
  mkdirSync(dirname(dest), { recursive: true });
  state.updatedAt = new Date().toISOString();
  const tmp = `${dest}.tmp`;
  const writeAtomically = (target, body) => {
    const scratch = `${target}.tmp`;
    try { rmSync(scratch, { force: true }); } catch { /* a leftover we are about to overwrite */ }
    writeFileSync(scratch, body);
    renameSync(scratch, target);
  };
  writeAtomically(dest, `${JSON.stringify(state, null, 2)}\n`);
  // The pointer is what `--resume` with no id follows. Written after the state, so it never names
  // a run whose state file is not yet complete.
  writeAtomically(join(stateRoot, 'latest'), `${state.runId}\n`);
  try { rmSync(tmp, { force: true }); } catch { /* best effort: the journal is already correct */ }
  return dest;
}

/** The run id `--resume` picks when none is given, or null when there is none. */
export function latestRunId(stateRoot) {
  try {
    const id = readFileSync(join(stateRoot, 'latest'), 'utf8').trim();
    if (id && existsSync(statePath(stateRoot, id))) return id;
  } catch { /* fall through to the directory scan */ }
  // The pointer is a convenience, not the source of truth: a run directory with a readable state
  // is resumable even if the pointer was lost.
  try {
    const ids = readdirSync(stateRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(statePath(stateRoot, e.name)))
      .map((e) => e.name).sort();
    return ids.length ? ids[ids.length - 1] : null;
  } catch { return null; }
}

/**
 * Load a run. A corrupt or unreadable state file is an ERROR, never "no run": resuming from a
 * truncated journal would redo work the evidence says was already done, or skip work it says was
 * not. Returns `{ state }` or `{ error }`.
 */
export function loadRun({ stateRoot, runId }) {
  const file = statePath(stateRoot, runId);
  let raw;
  try { raw = readFileSync(file, 'utf8'); } catch (err) {
    return { error: `cannot read \`${file}\`: ${err.code || err.message}` };
  }
  let state;
  try { state = JSON.parse(raw); } catch (err) {
    return { error: `\`${file}\` is not readable JSON (${err.message}). An unreadable journal is not an absent one` };
  }
  if (state.schema !== STATE_SCHEMA) {
    return { error: `\`${file}\` carries schema ${state.schema}, this build writes ${STATE_SCHEMA}` };
  }
  for (const name of PHASES) {
    if (!state.phases?.[name]) return { error: `\`${file}\` has no record of phase \`${name}\`` };
  }
  return { state };
}

/**
 * Prepare a loaded run for another pass: every phase left `running` or `failed` goes back to
 * `pending` so it executes again. `done` and `skipped` are left alone.
 *
 * A reset phase KEEPS its `data`, on purpose: it is the resume input. `prepare` finds its own branch
 * and worktree there rather than creating a second one, and `integrate` finds the tree it left a
 * conflicted merge in. The phase then overwrites that record outright when it finishes (see
 * `endPhase`), so nothing carries a stale measurement forward under a fresh summary.
 *
 * Returns the names that were reset, which is what the report calls "resumed at".
 */
export function resumeRun(state, { authorization = null, now = new Date() } = {}) {
  if (authorization) {
    if (!AUTH_SCOPES.includes(authorization)) {
      throw new Error(`unknown authorization scope \`${authorization}\``);
    }
    state.authorization = authorization;
    state.authorizationHistory.push({ scope: authorization, at: new Date(now).toISOString(), notes: 'resume' });
    // A wider scope opens phases a narrower one had skipped; a narrower one closes them again.
    for (const name of PHASES) {
      const allowed = scopeAllows(authorization, name);
      if (!allowed && state.phases[name].status !== 'done') {
        state.phases[name] = {
          status: 'skipped',
          startedAt: null,
          endedAt: null,
          summary: `not authorized for this run (scope \`${authorization}\`, needs \`${PHASE_SCOPE[name]}\`)`,
          data: null,
        };
      } else if (allowed && state.phases[name].status === 'skipped' && !state.noChanges) {
        state.phases[name] = { status: 'pending', startedAt: null, endedAt: null, summary: null, data: null };
      }
    }
  }
  const reset = [];
  for (const name of PHASES) {
    const phase = state.phases[name];
    if (phase.status === 'running' || phase.status === 'failed' || phase.status === 'blocked') {
      reset.push(name);
      phase.status = 'pending';
      phase.startedAt = null;
      phase.endedAt = null;
    }
  }
  return reset;
}

/** The next phase to execute, or null when the run is finished (or everything left is skipped). */
export function nextPhase(state) {
  for (const name of PHASES) {
    if (!TERMINAL.has(state.phases[name].status)) return name;
  }
  return null;
}

export function beginPhase(state, name) {
  const phase = state.phases[name];
  phase.status = 'running';
  phase.startedAt = new Date().toISOString();
  return phase;
}

/**
 * The result of a phase REPLACES its previous result, including when the new one is null.
 *
 * `if (data !== null) phase.data = data` left the previous pass's measurements in place whenever a
 * re-run produced none, and `resumeRun` deliberately preserves `data` so a reset phase can see its
 * own earlier output (`prepare` reuses its branch and worktree that way). Those two together mean a
 * phase could report one thing while the journal carried another phase's older numbers under it.
 * Each phase therefore owns its record outright, and `resumeRun` documents the preservation as the
 * resume INPUT it is.
 */
function endPhase(state, name, status, { summary = null, data = null } = {}) {
  const phase = state.phases[name];
  phase.status = status;
  phase.endedAt = new Date().toISOString();
  phase.summary = summary;
  phase.data = data ?? null;
  return phase;
}

export function completePhase(state, name, out = {}) {
  return endPhase(state, name, 'done', out);
}

export function failPhase(state, name, out = {}) {
  return endPhase(state, name, 'failed', out);
}

/**
 * A phase that cannot proceed until somebody decides something. Distinct from `failed`: a failure
 * is re-run on resume and may pass; a block is re-run and will block again until the decision is
 * recorded. §9 asks an ambiguity beyond the authorized scope to block the affected promotion and
 * keep the stable version, which is this.
 */
export function blockPhase(state, name, out = {}) {
  return endPhase(state, name, 'blocked', out);
}

export function skipPhase(state, name, reason) {
  state.phases[name] = {
    status: 'skipped', startedAt: null, endedAt: null, summary: reason, data: state.phases[name]?.data ?? null,
  };
}

/** Everything from `after` onwards that is not already done becomes skipped, with one reason. */
export function skipRest(state, after, reason) {
  const from = PHASES.indexOf(after) + 1;
  for (const name of PHASES.slice(from)) {
    if (state.phases[name].status !== 'done') skipPhase(state, name, reason);
  }
}

/**
 * A decision the run needed from a human. Recorded by id so a resume can see it is already
 * answered — which is how a blocked phase stops blocking without anyone editing the journal by
 * hand.
 */
export function recordDecision(state, { id, kind, question, answer = null, decidedBy = null }) {
  const existing = state.decisions.find((d) => d.id === id);
  const entry = {
    id, kind, question, answer, decidedBy, at: new Date().toISOString(),
  };
  if (existing) Object.assign(existing, entry);
  else state.decisions.push(entry);
  return entry;
}

export function decisionFor(state, id) {
  return state.decisions.find((d) => d.id === id) || null;
}

/** One command and what it returned. The stdout goes to a file; the journal keeps the pointer. */
export function recordEvidence(state, {
  label, command, exit = null, stdoutPath = null, measured = null,
}) {
  const entry = {
    label, command, exit, stdoutPath, measured, at: new Date().toISOString(),
  };
  state.evidence.push(entry);
  return entry;
}

/** A compact line per phase, for the report and for `--check` output. */
export function summarize(state) {
  return PHASES.map((name) => ({
    phase: name,
    status: state.phases[name].status,
    summary: state.phases[name].summary,
  }));
}
