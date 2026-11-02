// Fork maintenance (§9) — what upstream did, and where it lands on this fork.
//
// Everything here reads git and returns data. It writes nothing, decides nothing and never applies
// a change; `scripts/upstream-maintain.js` does that. Split that way because the hard part of §9 is
// not the merge, it is knowing what the merge means — and a classifier that cannot be called on a
// fixture repository cannot be tested at all.
//
// Two properties this module exists to hold:
//
//   1. NO CREDENTIALS REACH GIT. The parent repository is public, so every remote operation here is
//      anonymous by construction: the credential helper is disabled per invocation, terminal and
//      GUI prompts are turned off, and any `user:pass@` in a URL is redacted before it can reach a
//      log or a report. REQUIREMENTS §1 forbids exposing the user's credentials or sessions to
//      these processes, and "the public repo did not need them" is not the same as "they were not
//      offered".
//
//   2. THE DIVERGENCE SURFACE IS MEASURED, NOT LISTED. `docs/fork/stage1/ARCHITECTURE.md` §4 names
//      "3 archivos y 4 puntos"; its CORRECCIÓN 5 measured EIGHT; stages 2, 5 and 6 and D16 have
//      since taken it PAST SIXTY files that upstream owns and the fork has modified — and it grew
//      by nine while the probe table below was being written, which is the argument in one
//      sentence. Every one of those numbers was true when it was written. A hand-written list goes
//      stale the first time somebody fixes a bug, and this fork has now proved it three times. So
//      the list of files comes from git, every time, and the hand-written half is only the INTENT
//      of each divergence — see `DIVERGENCE_PROBES`, which a test holds exhaustive over the
//      measured surface.

import { spawnSync } from 'node:child_process';
// The identity tokens come from D16's own map, not retyped here: a probe that spelled the parent
// specifier a second time could drift from the transformation it is supposed to be watching.
import { FORK_PACKAGE, PARENT_PACKAGE } from './governance.js';

/** Paths whose change can never be a catalog change. Everything under `skills/` is the catalog. */
const CATALOG_PREFIX = 'skills/';

/**
 * The environment every git invocation runs with. Nothing is inherited that could authenticate:
 * `credential.helper` is cleared on the command line (the macOS default lives in the SYSTEM
 * gitconfig, so clearing `HOME` is not enough — measured), prompts are off, and the askpass hooks
 * are removed from the environment rather than pointed somewhere.
 */
export function anonymousGitEnv(base = process.env) {
  const env = { ...base };
  delete env.GIT_ASKPASS;
  delete env.SSH_ASKPASS;
  delete env.GIT_CREDENTIAL_HELPER;
  env.GIT_TERMINAL_PROMPT = '0';
  return env;
}

/** The `-c` flags that make an invocation anonymous. Exported so a test can assert on them. */
export const ANONYMOUS_GIT_FLAGS = Object.freeze([
  '-c', 'credential.helper=',
  '-c', 'credential.interactive=false',
  '-c', 'core.askPass=',
]);

/** Hide anything that looks like a secret in a remote URL before it reaches a report or a log. */
export function redactUrl(url) {
  if (!url) return url;
  return String(url).replace(/\/\/[^/@\s]+@/, '//<redacted>@');
}

/**
 * Run git. Never throws: the caller gets `{ ok, code, stdout, stderr }` and decides. `stderr` is
 * redacted the same way URLs are, because a failed fetch prints the URL it tried.
 */
export function git(args, { cwd, timeout = 120_000, env = null } = {}) {
  const res = spawnSync('git', [...ANONYMOUS_GIT_FLAGS, ...args], {
    cwd, encoding: 'utf8', timeout, env: env || anonymousGitEnv(),
  });
  const stdout = (res.stdout || '').trim();
  const stderr = redactUrl((res.stderr || '').trim());
  return {
    ok: res.status === 0, code: res.status, stdout, stderr, timedOut: res.error?.code === 'ETIMEDOUT',
  };
}

/** The configured URL of a remote, redacted, or null when the remote does not exist. */
export function remoteUrl(cwd, remote) {
  const res = git(['remote', 'get-url', remote], { cwd });
  return res.ok && res.stdout ? redactUrl(res.stdout) : null;
}

export function hasRemote(cwd, remote) {
  return remoteUrl(cwd, remote) !== null;
}

/**
 * Ask the remote where its branch is, WITHOUT fetching and without credentials. This is the access
 * check REQUIREMENTS §14 asks for — "verifica accesos sin revelar secretos" — and it is also the
 * cheapest form of §9.1: a run that only needs to know whether anything changed never has to
 * download an object.
 *
 * Returns `{ reachable, head, url, error }`. `error` is already redacted.
 */
export function probeRemote({ cwd, remote = 'upstream', ref = 'main', timeout = 60_000 } = {}) {
  const url = remoteUrl(cwd, remote);
  if (!url) {
    return {
      reachable: false,
      head: null,
      url: null,
      error: `no remote named \`${remote}\`. REQUIREMENTS §1 expects maintenance to use this clone's `
        + '`upstream` remote; add it with `git remote add upstream <url>`',
    };
  }
  const res = git(['ls-remote', '--heads', remote, `refs/heads/${ref}`], { cwd, timeout });
  if (!res.ok) {
    return {
      reachable: false, head: null, url, error: res.timedOut ? `timed out after ${timeout} ms` : res.stderr || `git exited ${res.code}`,
    };
  }
  const line = res.stdout.split('\n').find((l) => l.endsWith(`refs/heads/${ref}`));
  if (!line) return { reachable: true, head: null, url, error: `the remote has no \`refs/heads/${ref}\`` };
  return { reachable: true, head: line.split(/\s+/)[0], url, error: null };
}

/** Update the remote-tracking ref. Separate from `probeRemote` so a `--check` never writes. */
export function fetchRemote({ cwd, remote = 'upstream', ref = 'main', timeout = 300_000 } = {}) {
  const res = git(['fetch', '--no-tags', '--prune', remote, `+refs/heads/${ref}:refs/remotes/${remote}/${ref}`], { cwd, timeout });
  return { ok: res.ok, error: res.ok ? null : (res.timedOut ? `timed out after ${timeout} ms` : res.stderr), stderr: res.stderr };
}

export function revParse(cwd, rev) {
  const res = git(['rev-parse', '--verify', `${rev}^{commit}`], { cwd });
  return res.ok ? res.stdout : null;
}

/**
 * The commit of upstream this fork last incorporated — MEASURED as the merge base of the fork's
 * head and the upstream ref, not read from a file somebody has to remember to update.
 *
 * This is correct for this fork because its history starts as a clone of the parent, so the merge
 * base is exactly the last upstream commit reachable from the fork. A recorded marker is accepted
 * when one is passed, and a disagreement between the two is returned rather than resolved: being
 * wrong about which commit was incorporated is how a maintenance run silently skips a release.
 */
export function lastIncorporated({ cwd, upstreamRef = 'upstream/main', headRef = 'HEAD', recorded = null } = {}) {
  const head = revParse(cwd, headRef);
  const upstream = revParse(cwd, upstreamRef);
  if (!head || !upstream) {
    return { base: null, head, upstream, error: `cannot resolve ${!head ? headRef : upstreamRef}` };
  }
  const res = git(['merge-base', headRef, upstreamRef], { cwd });
  if (!res.ok) {
    // Both revisions resolved, so this is not a failure to look something up: it is the finding
    // that the two histories share nothing. Upstream replaced its history, or the remote now points
    // at a different repository. Either way it is a decision, not an integration, so it is returned
    // as a FINDING and not as an error — an error would be re-tried on resume forever.
    return {
      base: null, head, upstream, error: null, unrelated: true, disagreement: null,
    };
  }
  const base = res.stdout;
  const out = {
    base, head, upstream, error: null, unrelated: false, disagreement: null, rewritten: false,
  };
  // A rebase upstream cannot be seen in the merge base: the merge base of a rewritten branch is
  // simply earlier, and still an ancestor by definition. It is visible only against a RECORDED
  // base — the previous run's report, or `--base`. Without one, this fork cannot tell a rebase from
  // a fast-forward, and says so rather than assuming.
  if (recorded && revParse(cwd, recorded) && !isAncestor(cwd, recorded, upstream)) {
    out.rewritten = true;
  }
  if (recorded && recorded !== base) {
    out.disagreement = `the recorded base is ${recorded.slice(0, 8)} but the measured merge base is ${base.slice(0, 8)}`;
  }
  return out;
}

/** Is `ancestor` reachable from `descendant`? Used to tell "nothing new" from "diverged". */
export function isAncestor(cwd, ancestor, descendant) {
  return git(['merge-base', '--is-ancestor', ancestor, descendant], { cwd }).ok;
}

/** `{ path, added, deleted }` per changed file. Renames are OFF here on purpose — see below. */
export function changedFiles({ cwd, base, head, pathspec = null }) {
  const args = ['diff', '--numstat', '--no-renames', `${base}..${head}`];
  if (pathspec) args.push('--', pathspec);
  const res = git(args, { cwd });
  if (!res.ok) return { ok: false, error: res.stderr, files: [] };
  const files = res.stdout ? res.stdout.split('\n').filter(Boolean).map((line) => {
    const [added, deleted, ...rest] = line.split('\t');
    return { path: rest.join('\t'), added: Number(added), deleted: Number(deleted) };
  }) : [];
  return { ok: true, error: null, files };
}

/**
 * `{ status, path, from? }` per changed file, with rename detection at `threshold` percent.
 *
 * `worktree: true` diffs `base` against the WORKING TREE (`git diff base`, no `..`) instead of
 * against a commit. The difference is not cosmetic: a range cannot see an uncommitted edit, and the
 * one moment this fork most needs to re-measure its divergence surface is right after a human
 * resolved a merge conflict by hand and has not committed it yet.
 */
export function nameStatus({
  cwd, base, head, pathspec = null, renames = false, threshold = 50, worktree = false,
}) {
  const range = worktree ? base : `${base}..${head}`;
  const args = ['diff', '--name-status', renames ? `--find-renames=${threshold}%` : '--no-renames', range];
  if (renames) args.splice(args.indexOf('--name-status') + 1, 0, '-M');
  if (pathspec) args.push('--', pathspec);
  const res = git(args, { cwd });
  if (!res.ok) return { ok: false, error: res.stderr, entries: [] };
  const entries = res.stdout ? res.stdout.split('\n').filter(Boolean).map((line) => {
    const parts = line.split('\t');
    const code = parts[0];
    if (code.startsWith('R')) {
      return { status: 'R', similarity: Number(code.slice(1)) || null, from: parts[1], path: parts[2] };
    }
    return { status: code[0], path: parts[1] };
  }) : [];
  return { ok: true, error: null, entries };
}

const skillIdOf = (path) => (path.startsWith(CATALOG_PREFIX) ? path.slice(CATALOG_PREFIX.length).split('/')[0] : null);

function skillIdsAt(cwd, rev) {
  const res = git(['ls-tree', '-r', '--name-only', rev, '--', CATALOG_PREFIX], { cwd });
  if (!res.ok) return new Set();
  const ids = new Set();
  for (const path of res.stdout.split('\n')) {
    if (path.endsWith('/SKILL.md') && path.split('/').length === 3) ids.add(skillIdOf(path));
  }
  return ids;
}

/**
 * The four change classes PLAN §4 names, derived from the two catalogs rather than from the diff's
 * own letters. A skill EXISTS at a revision when `skills/<id>/SKILL.md` exists there, so:
 *
 *   added    — absent at base, present at head
 *   removed  — present at base, absent at head
 *   modified — present at both, and something under `skills/<id>/` differs
 *   renamed  — NOT a class of its own, because it cannot be one. `origin: risco` is the value in
 *              all 274 SKILL.md files (measured), so the catalog carries NO stable identifier and a
 *              rename is indistinguishable from a removal plus an addition. Git's similarity
 *              detection is reported as EVIDENCE for a pair, with its score, and the pair stays in
 *              `added` and `removed` until a human decides. PLAN §11 criterion 12 makes applying a
 *              rename silently a failure "aunque el resultado sea correcto", so this function has
 *              no code path that resolves one.
 */
export function classifyCatalogChanges({ cwd, base, head, threshold = 50 }) {
  const before = skillIdsAt(cwd, base);
  const after = skillIdsAt(cwd, head);
  const added = [...after].filter((id) => !before.has(id)).sort();
  const removed = [...before].filter((id) => !after.has(id)).sort();

  const touched = new Map();
  const changes = changedFiles({ cwd, base, head, pathspec: CATALOG_PREFIX });
  for (const file of changes.files) {
    const id = skillIdOf(file.path);
    if (!id) continue;
    if (!touched.has(id)) touched.set(id, []);
    touched.get(id).push(file);
  }
  const modified = [...touched.keys()].filter((id) => before.has(id) && after.has(id)).sort();

  // Rename EVIDENCE. Git is asked for its opinion on `skills/*/SKILL.md` only: a rename of a
  // reference file inside one skill is not a skill rename, and would otherwise drown the signal.
  const renameCandidates = [];
  if (added.length && removed.length) {
    const ns = nameStatus({ cwd, base, head, pathspec: CATALOG_PREFIX, renames: true, threshold });
    for (const entry of ns.entries) {
      if (entry.status !== 'R') continue;
      if (!entry.from?.endsWith('/SKILL.md') || !entry.path?.endsWith('/SKILL.md')) continue;
      const from = skillIdOf(entry.from);
      const to = skillIdOf(entry.path);
      if (!from || !to || from === to) continue;
      if (!removed.includes(from) || !added.includes(to)) continue;
      renameCandidates.push({
        from,
        to,
        similarity: entry.similarity,
        // Said in the data, not only in a doc, because this object is what the report prints.
        disposition: 'migration requiring a decision, never an automatic rehome',
        evidence: `git similarity ${entry.similarity ?? '?'}% between skills/${from}/SKILL.md and skills/${to}/SKILL.md`,
        caveat: 'the catalog has no stable skill identifier (`origin: risco` in every SKILL.md), so '
          + 'similarity is the only signal there is and it cannot settle the question on its own',
      });
    }
  }

  return {
    base,
    head,
    added,
    removed,
    modified,
    renameCandidates,
    // Kept so the report can say WHICH files inside a modified skill changed — a changed
    // `references/` file is a relevant change under §11 even when SKILL.md is untouched.
    filesBySkill: Object.fromEntries([...touched.entries()].map(([id, files]) => [id, files.map((f) => f.path)])),
    catalogSize: { base: before.size, head: after.size },
  };
}

// ---------------------------------------------------------------- divergence surface

/**
 * THE IDENTITY RENAME (D16), as a probe pair — one sentence, written once, applied to the ~40 files
 * whose whole divergence is that rename.
 *
 * `stage6/DESIGN.md` §1 settles the rule sitewise: *"se renombra lo que el fork ES y lo que un
 * lector puede EJECUTAR; no se renombra lo que el fork lee de un consumidor ni lo que otra cosa lee
 * del fork"*. So the probe is two-sided, and both sides can fail:
 *
 *   present   the renamed token is still there. A merge that reverts it leaves a message, a help
 *             string, a hook assertion or a comment telling the reader to run the PARENT.
 *   absent    `@ericrisco/rsc` has not come BACK. Measured at zero occurrences in every divergent
 *             file that carries this probe, so it is a probe and not a wish. A `present` probe
 *             alone cannot
 *             see an upstream merge that ADDS a new line naming the parent beside the renamed one,
 *             and that is the §10 accident stage 6 measured: *"un fork que renombrase su paquete y
 *             dejase esas dos cadenas intactas habría pasado la suite completa y habría enviado a
 *             cada consumidor a instalar el padre encima del fork"*.
 *
 * The fragments are SHORT on purpose — the renamed token plus just enough of its context to be
 * unique in the file. A long line breaks when upstream reflows a comment, which is a reformat and
 * not a revert; the token does not.
 *
 * `where` says which surface inside the file the token lives on, so a failure names what it was
 * protecting instead of just reporting a mismatch.
 */
const identity = (fragment, where) => [
  {
    kind: 'present',
    fragment,
    why: `§10/D16: ${where} must name the fork. Reverting it tells the reader to run the parent's `
      + 'package or binary — a lie the whole suite passes in silence (stage6/DESIGN.md §2)',
  },
  {
    kind: 'absent',
    fragment: PARENT_PACKAGE,
    why: `§10/D16: no reference to ${PARENT_PACKAGE} may come back into this file. A merge that `
      + 'adds one — a new help string, a new install command — sends the consumer to install the '
      + 'parent over the fork, in the background, on a timer',
  },
];

/**
 * What each divergence is FOR, as a probe that survives a reformat but not a revert.
 *
 * Hand-written, and the only hand-written list in this module: the files come from git (below), but
 * no measurement can tell you WHY a line is there, and a merge that textually succeeds while
 * reverting the intent is exactly the failure PLAN §8 warns about. `kind: 'absent'` is for the
 * divergences that are a REMOVAL — a trigger that must stay deleted cannot be probed by presence.
 *
 * `tests/governance-upstream-maintenance.test.js` holds this table exhaustive over the measured
 * surface, so a new divergence with no probe fails a test instead of being silently unwatched.
 *
 * ONLY THE MODIFIED HALF OF THE SURFACE IS PROBED, and that is a decision with an argument. The
 * fork has also ADDED two dozen files (`schema/governance/`, `scripts/lib/governance.js`, the
 * `governance-*.test.js` suite, …). An upstream merge cannot revert them: upstream has no version of them
 * to merge, so there is no text for it to win. The one thing it CAN do is create the same path, and
 * that case is already instrumented elsewhere — `collisions()` returns them as `onForkAdded` with
 * severity `medium` — while what those files MEAN is held by their own tests, which G8 runs. A
 * probe table entry for them would check that a file the fork wrote still says what the fork wrote,
 * every run, forever: a check that cannot fail. `tests/governance-upstream-maintenance.test.js`
 * asserts this reasoning rather than leaving it as a comment.
 */
export const DIVERGENCE_PROBES = Object.freeze({
  'targets/claude.js': [{
    kind: 'present',
    fragment: 'const relSource = sourceMd ? relative(paths.projectRoot, sourceMd)',
    why: 'the always-on body the session pays for is the governance-free copy; reverting this makes '
      + '`claude` pay the preamble at every SessionStart and after every compaction',
  }],
  'scripts/doctor.js': [
    {
      kind: 'present',
      fragment: "'.rsc', 'governance', 'always-on.md'",
      why: 'doctor measures the per-session cost from the governance-free body; reverting this makes '
        + 'the diagnostic over-report the budget by exactly the preamble',
    },
    ...identity('npx @lema017/rsc-governed sync', "the action strings doctor hands the user"),
  ],
  'scripts/install-apply.js': [
    {
      kind: 'present',
      fragment: 'governBase(id, dest);',
      why: 'the single point of transformation. Reverting it delivers all 274 without the contract',
    },
    ...identity('rscg restore', 'the commands the installer names in its own account of what it wrote'),
  ],
  'targets/knowledge-sync.mjs': [
    {
      kind: 'present',
      fragment: 'export const isGoverned = (path) => GOVERNED.some',
      why: "B-R1: a teammate's deletion of a customization is reported, never applied",
    },
    ...identity('rscg memory off', 'the opt-out this target tells the user about'),
  ],
  'tests/apply.test.js': [
    {
      kind: 'present',
      fragment: '.rsc/governance/always-on.md',
      why: 'the two assertions that pin the always-on body the hook is handed',
    },
    ...identity('npx @lema017/rsc-governed@latest', 'the update command this test pins'),
  ],
  '.github/workflows/release.yml': [
    { kind: 'absent', fragment: 'branches: [main]', why: 'R6: merging must never publish by itself' },
    { kind: 'absent', fragment: 'erisco@icloud.com', why: "R6: the parent's identity must not sign the fork's releases" },
    { kind: 'absent', fragment: '@ericrisco/rsc version', why: '§10: the release must compare against the fork package, not the parent' },
    ...identity('npm view @lema017/rsc-governed version', 'the registry the release gate compares against'),
  ],
  '.gitignore': [
    {
      kind: 'present',
      fragment: '!docs/fork/',
      why: "B1: the fork's own documentation must stay committable",
    },
    {
      kind: 'present',
      fragment: '.rsc-upstream/',
      why: '§9 + REQUIREMENTS §1: the maintenance scratch (the disposable worktrees and the '
        + 'disposable project/home the gate installs into) is written INSIDE the dedicated folder, '
        + 'so it has to be ignored or every maintenance run dirties `git status` and the next run '
        + 'cannot tell its own scratch from a human\'s unfinished work',
    },
  ],
  'package.json': [
    {
      kind: 'present',
      fragment: '"governance:check"',
      why: 'the governance artifacts are checked by a script; losing it loses the check',
    },
    {
      kind: 'present',
      fragment: '"gate": "node scripts/gate.js"',
      why: 'the one deterministic gate CI and the desk both run. Losing it does not fail anything: '
        + 'it quietly returns the fork to running three of the checks and none of the others',
    },
    {
      kind: 'present',
      fragment: '"rscg": "scripts/rsc.js"',
      why: '§10 at its sharpest (stage6/DESIGN.md §1): if the bin stayed `rsc`, a global install of '
        + "the parent and one of the fork overwrite each other and the losing project is driven by "
        + "the other's CLI, in silence",
    },
    ...identity('"name": "@lema017/rsc-governed"', "the package's own name, which is what §10 asks for"),
  ],
  'package-lock.json': identity(
    '"name": "@lema017/rsc-governed"',
    'the locked package name (regenerated, never hand-edited: a lock that still says the parent '
      + 'means the rename was done to `package.json` alone)',
  ),

  // ── Divergences with an intent of their own ────────────────────────────────────────────────────
  '.github/workflows/ci.yml': [
    {
      kind: 'present',
      fragment: 'permissions:\n  contents: read',
      why: 'least privilege, explicitly. With no `permissions:` block the workflow inherits the '
        + 'repository default, which can be read-write — `ARCHITECTURE.md` §"Dónde pueden correr" '
        + 'flagged exactly that. Reverting it hands a tree-reading job a token that can push to main',
    },
    {
      kind: 'absent',
      fragment: '! grep -rIn -E "sync-bundles',
      why: "the gate that lied. `! grep` turns grep's exit 2 — \"I could not finish the scan\" — "
        + 'into a PASS, which is what `skills/verify/SKILL.md` forbids outright. If this form comes '
        + 'back, the residue check reports success precisely when it could not run',
    },
    {
      kind: 'present',
      fragment: 'a check that cannot run is not a pass',
      why: 'the three-state replacement for the `! grep` above: found / clean / the scan itself '
        + 'failed, with a different verdict for each',
    },
    {
      kind: 'present',
      fragment: 'fetch-depth: 0',
      why: "the gate's `skills-invariant` check diffs against `origin/main`, so a shallow checkout "
        + 'makes it unable to measure — and an unmeasurable invariant is the one that gets reported '
        + 'as satisfied',
    },
    {
      kind: 'present',
      fragment: 'run: npm run gate',
      why: 'CI runs the SAME command a human runs locally, so the desk and CI cannot disagree. '
        + 'Reverting to the three separate steps drops governance:check, both artifact roots, the '
        + '`skills/` invariant, drift and originality from CI without failing anything',
    },
  ],
  'scripts/lib/backups.js': [{
    kind: 'present',
    fragment: 'export function snapshotSkillBases(',
    why: "M3 of stage 6's review: the D13 warning used to live inside `if (!dry)`, so `restore "
      + '--dry-run` — the one tool a consumer uses to DECIDE whether to restore — withheld the '
      + 'single consequence the warning exists for. This reads the bytes the SNAPSHOT holds, which '
      + "is the only thing that answers the dry run's question",
  }],
  'scripts/lib/onboarding-apply.js': [
    {
      kind: 'present',
      fragment: 'ungovernedAmong(cwd, rolled.changed)',
      why: 'D13 on the rollback path: `RSC_ONBOARDING_INCOMPLETE` names the skill bases the '
        + 'rollback left without a contract. The rollback is the same `restoreBackup`, so it has '
        + 'the same property, and a failed verification that conserves a working install owes an '
        + 'explanation of the blockage (REQUIREMENTS §10)',
    },
    ...identity('npx @lema017/rsc-governed@latest onboard', 'the recovery command the failure prints'),
  ],
  'scripts/rsc.js': [
    {
      kind: 'present',
      fragment: "case 'conformance': {",
      why: "acceptance criterion 4 asked on the CONSUMER's machine. Stage 4's own report named the "
        + 'gap: no command of the product answered "are my 274 governed?". Reverting it leaves the '
        + "question answerable only inside the fork's checkout",
    },
    {
      kind: 'present',
      fragment: "case 'brownfield': {",
      why: "stage 3's procedure has an invocation point, and B1's candidate competitor set is "
        + 'COMPUTED from the catalog here rather than guessed by a model',
    },
    {
      kind: 'present',
      fragment: 'snapshotSkillBases({ cwd: process.cwd(), snapshot: result.snapshot })',
      why: 'the dry-run half of the D13 warning (M3). Auditing the project instead would answer the '
        + 'wrong question in a dry run: it reports what is installed NOW, which is exactly what the '
        + 'restore is about to replace',
    },
    ...identity('Use: npx @lema017/rsc-governed onboard', "the CLI's own usage line"),
  ],
  'targets/auto-update.mjs': [
    {
      kind: 'present',
      fragment: 'registry.npmjs.org/@lema017%2frsc-governed/latest',
      why: 'the registry this watches. PERCENT-ENCODED, so the plain `@ericrisco/rsc` probe cannot '
        + "see a revert here — stage6/DESIGN.md §2 calls this one of the two strings no inherited "
        + 'test touches, because the suite short-circuits the query with `RSC_LATEST`',
    },
    {
      kind: 'absent',
      fragment: '@ericrisco%2frsc',
      why: 'the same string in the other direction: the percent-encoded parent must not come back. '
        + 'Reverted, the fork watches the PARENT for releases and reports being behind forever',
    },
    {
      kind: 'present',
      fragment: "['npx', '-y', `@lema017/rsc-governed@${version}`]",
      why: 'the argv of the background installer. The other untested string: reverted, every '
        + 'consumer is sent to install the parent over the fork, in the background, on a timer',
    },
    ...identity('npx @lema017/rsc-governed@latest', 'the update command the notice prints'),
  ],
  'tests/hooks-path.test.js': [
    {
      kind: 'present',
      fragment: '!/\\brepair\\b/.test(report.worktreeCleanup.action',
      why: 'an assertion that could no longer fail. It read `!/rsc repair/`, and after the rename '
        + 'the binary is `rscg`, so the negation went VACUOUSLY true: the recommendation could go '
        + 'back to being circular and this test would still pass. Naming the subcommand alone makes '
        + 'it independent of the binary name, which is the only form that keeps biting',
    },
    {
      kind: 'absent',
      fragment: '/rsc repair/',
      why: 'the vacuous form must stay deleted; re-introducing it restores a green test that '
        + 'measures nothing',
    },
  ],
  'README.md': [
    {
      kind: 'present',
      fragment: FORK_PACKAGE,
      why: '§10 names `documentación` among the surfaces that must not send a consumer to reinstall '
        + "the parent. README.md is upstream's most-churned file, so a merge that wins here leaves a "
        + 'README presenting the fork AS the parent, with the parent\'s install command — the §10 '
        + 'accident in its purest form, and one no test would see',
    },
    {
      kind: 'present',
      fragment: 'A governed fork of',
      why: "§10 + REQUIREMENTS §13: the disclosure is the first line of the document, not a footnote",
    },
    // AND DELIBERATELY NO `absent` PROBE ON THE PARENT SPECIFIER. This is a divergence where
    // naming the parent is the REQUIREMENT and not the defect: the README names
    // `ericrisco/rsc-harness` ten times on purpose — the fork disclosure, the non-affiliation
    // statement, and a parent-versus-fork comparison table that prints `@ericrisco/rsc` next to
    // `@lema017/rsc-governed` precisely so the two cannot be confused. Measured: 2 occurrences of
    // the parent specifier, all of them inside that contrast. A blanket absent-probe here would
    // fail on the very text that discharges the requirement, which is how a probe becomes noise.
  ],

  // ── The published site and the security policy ─────────────────────────────────────────────────
  //
  // Two sub-classes, and the difference is what the `absent` side may say:
  //
  //   MACHINE-READ    a host, a sitemap, an API call. Nothing here is attribution, so the parent's
  //                   host must be absent outright — and these are the ones nothing else checks,
  //                   because `site/` ships ZERO files in the npm tarball (`files` is scripts,
  //                   targets, schema, skills, manifest.json). A revert reaches VISITORS, not a
  //                   consumer's `node_modules`, so no install-time test can ever see it.
  //   DOCUMENTARY     prose that names the parent ON PURPOSE: the fork disclosure, the MIT
  //                   copyright notice, the non-affiliation statement, the routing of a
  //                   vulnerability in inherited code to the party that can fix it for everyone.
  //                   `present`-only, for the same reason as `README.md`.
  'site/robots.txt': [
    {
      kind: 'present',
      fragment: 'https://lema017.github.io/rsc-harness/sitemap.xml',
      why: "§10: the fork's own site must advertise the fork's own sitemap. Reverted, this points "
        + "every crawler at the PARENT's sitemap, and the fork's pages leave the index",
    },
    {
      kind: 'absent',
      fragment: 'ericrisco.github.io',
      why: "the parent's Pages host is never the right answer in a machine-read file: this one is "
        + 'not attribution, it is a destination',
    },
  ],
  'site/sitemap.xml': [
    {
      kind: 'present',
      fragment: '<loc>https://lema017.github.io/rsc-harness/</loc>',
      why: "§10: the canonical URLs the fork submits are the fork's. Reverted, the fork's sitemap "
        + "declares the PARENT's pages as its own canonical set",
    },
    { kind: 'absent', fragment: 'ericrisco.github.io', why: "as in `robots.txt`: a destination, not attribution" },
  ],
  'site/assets/rsc.js': [
    {
      kind: 'present',
      fragment: 'api.github.com/repos/lema017/rsc-harness',
      why: "the star count on the fork's own page is the FORK's. Reverted, the page advertises the "
        + "parent's popularity as its own — measured by nothing, visible to everyone",
    },
    { kind: 'absent', fragment: 'repos/ericrisco/rsc-harness', why: "the parent's repository is not this page's subject" },
  ],
  'site/diagram.svg': identity(
    'npx @lema017/rsc-governed@latest',
    'the install command RENDERED INTO an image, where no test and no linter will ever read it',
  ),
  'site/index.html': [
    {
      kind: 'present',
      fragment: 'https://lema017.github.io/rsc-harness/',
      why: "§10: the canonical and JSON-LD `@id` of the fork's own page. Reverted, the page tells "
        + "search engines and agents that it IS the parent's page",
    },
    {
      kind: 'present',
      fragment: 'github.com/lema017/rsc-harness',
      why: "the links a visitor clicks go to the fork. The parent's repository URL is ALSO here, "
        + "three times, deliberately — the fork disclosure — plus the author's profile twice in the "
        + 'JSON-LD, which MIT attribution requires: hence no blanket absent-probe, only the host one',
    },
    { kind: 'absent', fragment: 'ericrisco.github.io', why: "the parent's Pages HOST, as opposed to its repository link, is never attribution" },
  ],
  'site/es/index.html': [
    {
      kind: 'present',
      fragment: 'https://lema017.github.io/rsc-harness/',
      why: '§10, Spanish page: same canonical claim as `site/index.html`. Two pages, two reverts, '
        + 'and a merge can win one and lose the other',
    },
    { kind: 'present', fragment: 'github.com/lema017/rsc-harness', why: 'as in `site/index.html`' },
    { kind: 'absent', fragment: 'ericrisco.github.io', why: 'as in `site/index.html`' },
  ],
  'site/llms.txt': [
    {
      kind: 'present',
      fragment: FORK_PACKAGE,
      why: 'THE INSTRUCTION FILE FOR AGENTS. It is read by a model and acted on, so a revert here '
        + 'is not a wrong label: it is an agent running the parent\'s installer in a user\'s project',
    },
    {
      kind: 'present',
      fragment: 'rscg sync',
      why: 'the runnable commands an agent copies out of this file name the fork\'s binary',
    },
    {
      kind: 'present',
      fragment: 'not affiliated with or endorsed by',
      why: '§10 non-confusion, stated to the one reader who cannot infer it. The parent IS named '
        + 'twice here on purpose — the MIT copyright line and the "Forked from" link — so there is '
        + 'no absent-probe on the parent, only this positive claim',
    },
  ],
  'SECURITY.md': [
    {
      kind: 'present',
      fragment: FORK_PACKAGE,
      why: "§10: the policy's subject is the fork, including the fact that nothing is published yet "
        + 'so a fix is a commit and not a release',
    },
    {
      kind: 'present',
      fragment: 'governed fork of',
      why: 'the disclosure the policy opens with. The parent is named FOUR times in this file on '
        + 'purpose: the disclosure plus the MIT copyright notice, and the routing of a vulnerability '
        + 'in INHERITED code to the parent\'s advisory form — which is correct, because that is the '
        + 'only party who can fix it for everyone downstream. None of the four is runnable, so the '
        + 'specifier count is 0 and there is no absent-probe here',
    },
  ],
  'tests/worktree-reaper.test.js': [{
    kind: 'present',
    fragment: '@(ericrisco\\/rsc|lema017\\/rsc-governed) worktrees reap',
    why: 'the same class as `tests/hooks-path.test.js`: a `doesNotMatch` naming only the parent '
      + 'passes for free once the fork is renamed. Widened to BOTH names so it still asserts '
      + 'something. This file is the one divergence with no `absent` probe on the parent specifier, '
      + 'deliberately: it names the parent on purpose, inside this regex',
  }],

  // ── The identity rename and nothing else (stage6/DESIGN.md §1) ─────────────────────────────────
  'scripts/audit.js': identity('rscg audit', 'the on-demand command the module documents'),
  'scripts/knowledge-doctor.js': identity('rscg doctor', 'the command this one is deliberately NOT part of'),
  'scripts/lib/capabilities.js': identity('rscg catalog --available', 'the command that serves the catalog'),
  'scripts/lib/constitution-draft.js': identity('Draft written by rscg onboard', 'the provenance line stamped into the draft'),
  'scripts/lib/ingest-move.js': identity('rscg ingest <file>', 'the command this module implements'),
  'scripts/lib/onboarding.js': identity('rscg add', 'the command the field note describes'),
  'scripts/lib/repetition.js': identity('rscg capabilities gap-log', 'the command that writes the gap log'),
  'scripts/lib/upgrade.js': identity("'install', '-g', '@lema017/rsc-governed@latest'", 'the argv of the global upgrade it SPAWNS'),
  'targets/agents-md-shadow.js': identity('rscg restore', 'the command named as the way back'),
  'targets/agents.js': identity('rscg review consolidate', 'the command the generated agent body names'),
  'targets/branch-guard.mjs': identity('rscg main unlock', 'the opt-out the guard offers when it blocks'),
  'targets/clone-bootstrap.mjs': identity('npx @lema017/rsc-governed sync', 'the command IN the offer, not only in the prose above it'),
  'targets/commands.js': identity('npx @lema017/rsc-governed memory resume', 'the command inside a generated slash-command body'),
  'targets/copy-rules.mjs': identity('rscg copy check', 'the command that enforces the rule'),
  'targets/git-permissions.js': identity('rscg git-permissions off', 'the opt-out written into the managed rules file'),
  'targets/hook-once.mjs': identity('rscg doctor', 'the command that measures what this hook emits'),
  'targets/knowledge-wiring.js': identity('rscg knowledge-sync off', 'the opt-out the wiring notice names'),
  'targets/memory.js': identity('npx @lema017/rsc-governed sync', 'the repair action for a degraded memory wiring'),
  'targets/opt-outs.js': identity('rscg main lock', 'the command that writes this opt-out'),
  'targets/sello.mjs': identity('npx @lema017/rsc-governed sello freeze', 'the recovery command the failure prints'),
  'targets/session-start.mjs': identity('npx @lema017/rsc-governed ingest <file>', 'the command the session hook puts in front of the model'),
  'targets/team-safe-start.mjs': identity('rscg knowledge-sync off', 'the opt-out in the Spanish start notice'),
  'targets/trunk-policy.mjs': identity('rscg main lock', 'the command that closes the trunk'),
  'targets/worktree-reaper.mjs': identity('rscg worktrees', 'the command that reaches this module'),
  'tests/agent-overrides.test.js': identity('/rscg agents reset developer/', 'the command this test pins'),
  'tests/audit.test.js': identity('/rsc-governed audit/', 'the command the generated report must name'),
  'tests/bare-command-updates.test.js': identity('npx @lema017/rsc-governed@latest', 'the bare update command this test reasons about'),
  'tests/cli-usage.test.js': identity('Use: npx @lema017\\/rsc-governed', "the CLI's usage line, asserted on stdout"),
  'tests/clone-bootstrap.test.js': identity('@lema017\\/rsc-governed@1\\.3\\.6 sync', 'the pinned-version convergence command'),
  'tests/doctor-onboarding-readiness.test.js': identity('@lema017\\/rsc-governed(@latest)? onboard', "the onboarding action doctor reports"),
  'tests/fresh-install-coherence.test.js': identity('npx @lema017/rsc-governed@${VERSION} onboard', 'the version-pinned onboarding command'),
  'tests/ingest-move.test.js': identity('/rsc-governed ingest/', 'the command the moved-document note must name'),
  'tests/knowledge-sync.test.js': identity('/rscg knowledge-sync off/', 'the opt-out asserted on the system message'),
  'tests/manifest-divergence.test.js': identity('npx @lema017\\/rsc-governed@2\\.0\\.5 sync', 'the pinned sync command'),
  'tests/rsc-cli.test.js': identity('npm install -g @lema017/rsc-governed@latest', 'the global upgrade command on stdout'),
  'tests/team-safe-default.test.js': identity('rsc-governed main unlock', 'the unlock command in the reason text'),
  'tests/update-notice-symptoms.test.js': identity('npx @lema017\\/rsc-governed@latest', 'the catch-up command the notice must print'),
});

/**
 * Files upstream owns that this fork has modified — measured against the incorporated base. These
 * are the merge surface; everything the fork ADDED can only collide if upstream creates the same
 * path.
 *
 * Measured against the WORKING TREE by default (`git diff <base>`, no `..`), not against a commit
 * range. A range answers "what has the fork committed on top of upstream", which is the wrong
 * question at the two moments that matter: a conflict a human has just resolved and not committed
 * yet, and a bounded fix the run itself has just written. Pass `worktree: false` for the committed
 * answer, and know which one you asked for.
 *
 * `ignore` names the fork's OWN documentation tree, not all of `docs/`: upstream owns files under
 * `docs/` too, and ignoring the whole prefix would leave a future fork edit to one of them
 * unwatched. The two sets coincide today — measured — and will stop coinciding silently.
 *
 * `ok: false` means the measurement FAILED. Every caller must branch on it: an empty `modified`
 * from a failed measurement is indistinguishable, by value, from a fork with no divergences, and
 * `[]` is truthy, so no `||` fallback can tell them apart. G7 and `phaseClassify` both read `.ok`.
 */
export function divergenceSurface({
  cwd, base, headRef = 'HEAD', ignore = ['docs/fork/'], worktree = true,
}) {
  const ns = nameStatus({ cwd, base, head: headRef, worktree });
  if (!ns.ok) {
    return {
      ok: false, error: ns.error, modified: [], added: [], deleted: [], measuredAgainst: null,
    };
  }
  const keep = (p) => !ignore.some((prefix) => p.startsWith(prefix));
  const pick = (status) => ns.entries.filter((e) => e.status === status && keep(e.path)).map((e) => e.path).sort();
  return {
    ok: true,
    error: null,
    modified: pick('M'),
    added: pick('A'),
    deleted: pick('D'),
    measuredAgainst: worktree ? 'working tree' : `${base}..${headRef}`,
  };
}

/**
 * Where upstream's change lands on the fork's own edits. A collision is not a conflict: git may
 * merge it cleanly, and that is precisely when it is most dangerous, because nothing asks anybody
 * to look.
 */
export function collisions({ surface, upstreamChanged }) {
  const changed = new Set(upstreamChanged);
  const onModified = surface.modified.filter((p) => changed.has(p));
  const onAdded = surface.added.filter((p) => changed.has(p));
  return {
    onDivergence: onModified,
    onForkAdded: onAdded,
    severity: onModified.length ? 'high' : (onAdded.length ? 'medium' : 'none'),
    note: onModified.length
      ? 'upstream changed a file the fork has modified. A clean merge here proves nothing: re-check '
        + 'the intent probe for each file before accepting the result'
      : 'upstream did not touch the fork\'s divergence surface',
  };
}

/** Run every probe for `file` against its current content. Returns the failures. */
export function checkProbes(file, text) {
  const probes = DIVERGENCE_PROBES[file] || [];
  const failures = [];
  for (const probe of probes) {
    const present = text.includes(probe.fragment);
    if (probe.kind === 'present' && !present) failures.push({ file, probe, found: false });
    if (probe.kind === 'absent' && present) failures.push({ file, probe, found: true });
  }
  return { file, probed: probes.length, failures };
}

// ---------------------------------------------------------------- attribution

/**
 * What counts as a notice file.
 *
 * `LICENSE*` alone is not the obligation. Apache-2.0 §4(d) requires a derivative work to PROPAGATE
 * the `NOTICE` file of the work it derives from, and this fork already carries Apache-2.0 material
 * (`skills/design/engine`, measured), so a `NOTICE` upstream adds is a legal duty this fork acquires
 * the moment the merge lands. `COPYING`, `LICENCE` (the British spelling GPL-family projects use),
 * `AUTHORS`, `COPYRIGHT` and `PATENTS` are the same class of document. None exists in the tree
 * today — which is exactly why the blind spot was invisible, and why it is closed before it matters
 * rather than after.
 *
 * Matched on the BASENAME and anchored, so a source file that merely contains one of these words
 * (`authors.js`, `license-check.mjs`) is not dragged into the obligation inventory.
 *
 * It deliberately OVER-detects in the other direction, and the asymmetry is the point: today it
 * also matches `skills/open-weights/references/licenses.md` (which the previous matcher already
 * caught) and `skills/terms-conditions/references/notices-and-aup.md`, neither of which is a notice
 * this fork owes. A false positive costs exactly one `--ack` on a run where that file changed. A
 * false negative costs a licence violation that ships. Those are not comparable, so this matcher is
 * not narrowed to make G6 quieter.
 */
const NOTICE_BASENAME = /^(LICEN[CS]E|NOTICE|COPYING|COPYRIGHT|AUTHORS|PATENTS)([-._][^/]*)?$/i;
const NOTICE_TEXT = /(LICEN[CS]E|NOTICE|COPYING|PATENTS)[^/]*\.(txt|md|rst)$/i;
const NOTICE_DECLARATION = /^(THIRD_PARTY\.md|UPSTREAM\.json)$/i;
/** Source files never carry the obligation, however they are named (`authors.js`, `LICENSE.sh`). */
const CODE_EXTENSION = /\.(m?[jt]s|cjs|py|rb|go|rs|sh|ya?ml|json|lock)$/i;

/** Is this path an attribution-bearing file? Exported so a test can assert the coverage. */
export function isAttributionPath(path) {
  const base = String(path || '').split('/').pop();
  if (!base) return false;
  // `UPSTREAM.json` is a declaration and is matched by name, so the code-extension exclusion below
  // must not reach it.
  if (NOTICE_DECLARATION.test(base)) return true;
  if (CODE_EXTENSION.test(base)) return false;
  return NOTICE_BASENAME.test(base) || NOTICE_TEXT.test(base);
}

/** Every attribution-bearing file under a revision's `skills/`, plus the repository root notices. */
export function attributionFilesAt(cwd, rev) {
  const res = git(['ls-tree', '-r', '--name-only', rev], { cwd });
  if (!res.ok) return [];
  return res.stdout.split('\n').filter((p) => p && isAttributionPath(p)).sort();
}

/**
 * What the incoming change does to the fork's licence obligations.
 *
 * This is the check that catches the case a clean merge and a green test suite both miss: upstream
 * 3.7.5 adds `skills/connect-tool/bridge-kit/` — a NEW vendored subtree with its own MIT LICENSE,
 * its own `UPSTREAM.json` (`"modified": false`) and a new `skills/connect-tool/THIRD_PARTY.md` —
 * and PLAN §2's obligation list enumerates the notices it knew about by name. Nothing in the tree
 * fails; the fork simply acquires an attribution duty nobody is told about.
 */
export function attributionDelta({ cwd, base, head }) {
  const before = new Set(attributionFilesAt(cwd, base));
  const after = attributionFilesAt(cwd, head);
  const added = after.filter((p) => !before.has(p));
  const removed = [...before].filter((p) => !after.includes(p)).sort();
  const changed = changedFiles({ cwd, base, head }).files
    .map((f) => f.path).filter((p) => isAttributionPath(p) && before.has(p) && after.includes(p)).sort();

  // A new vendored subtree is a directory that gains an `UPSTREAM.json`: that file is how this
  // catalog declares "copied from somewhere else, at this commit, under this licence".
  const newVendored = added.filter((p) => p.endsWith('UPSTREAM.json')).map((p) => p.slice(0, -'/UPSTREAM.json'.length));
  const details = {};
  for (const path of added.filter((p) => p.endsWith('UPSTREAM.json'))) {
    const res = git(['show', `${head}:${path}`], { cwd });
    if (res.ok) { try { details[path] = JSON.parse(res.stdout); } catch { details[path] = { unparsed: true }; } }
  }
  return {
    added, removed, changed, newVendored, upstreamJson: details,
    obligation: added.length || changed.length || removed.length
      ? 'the fork\'s notice inventory (PLAN §2, and the README third-party table) must be updated '
        + 'before this release is promoted: a notice that ships without being acknowledged is still '
        + 'an unmet obligation'
      : null,
  };
}

/** Directories under `skills/` that declare themselves vendored at `rev`. */
export function vendoredSubtrees(cwd, rev) {
  return attributionFilesAt(cwd, rev)
    .filter((p) => p.startsWith(CATALOG_PREFIX) && p.endsWith('/UPSTREAM.json'))
    .map((p) => p.slice(0, -'/UPSTREAM.json'.length));
}
