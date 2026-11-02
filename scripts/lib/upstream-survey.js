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
//      "3 archivos y 4 puntos"; measuring it against the incorporated base returns EIGHT files that
//      upstream owns and the fork has modified. A hand-written list goes stale the first time
//      somebody fixes a bug, and this fork already proves it. So the list of files comes from git,
//      every time, and the hand-written half is only the INTENT of each divergence — see
//      `DIVERGENCE_PROBES`, which a test holds exhaustive over the measured surface.

import { spawnSync } from 'node:child_process';

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

/** `{ status, path, from? }` per changed file, with rename detection at `threshold` percent. */
export function nameStatus({ cwd, base, head, pathspec = null, renames = false, threshold = 50 }) {
  const args = ['diff', '--name-status', renames ? `--find-renames=${threshold}%` : '--no-renames', `${base}..${head}`];
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
 * What each divergence is FOR, as a probe that survives a reformat but not a revert.
 *
 * Hand-written, and the only hand-written list in this module: the files come from git (below), but
 * no measurement can tell you WHY a line is there, and a merge that textually succeeds while
 * reverting the intent is exactly the failure PLAN §8 warns about. `kind: 'absent'` is for the
 * divergences that are a REMOVAL — a trigger that must stay deleted cannot be probed by presence.
 *
 * `tests/governance-upstream-maintenance.test.js` holds this table exhaustive over the measured
 * surface, so a new divergence with no probe fails a test instead of being silently unwatched.
 */
export const DIVERGENCE_PROBES = Object.freeze({
  'targets/claude.js': [{
    kind: 'present',
    fragment: 'const relSource = sourceMd ? relative(paths.projectRoot, sourceMd)',
    why: 'the always-on body the session pays for is the governance-free copy; reverting this makes '
      + '`claude` pay the preamble at every SessionStart and after every compaction',
  }],
  'scripts/doctor.js': [{
    kind: 'present',
    fragment: "'.rsc', 'governance', 'always-on.md'",
    why: 'doctor measures the per-session cost from the governance-free body; reverting this makes '
      + 'the diagnostic over-report the budget by exactly the preamble',
  }],
  'scripts/install-apply.js': [{
    kind: 'present',
    fragment: 'governBase(id, dest);',
    why: 'the single point of transformation. Reverting it delivers all 274 without the contract',
  }],
  'targets/knowledge-sync.mjs': [{
    kind: 'present',
    fragment: 'export const isGoverned = (path) => GOVERNED.some',
    why: "B-R1: a teammate's deletion of a customization is reported, never applied",
  }],
  'tests/apply.test.js': [{
    kind: 'present',
    fragment: '.rsc/governance/always-on.md',
    why: 'the two assertions that pin the always-on body the hook is handed',
  }],
  '.github/workflows/release.yml': [
    { kind: 'absent', fragment: 'branches: [main]', why: 'R6: merging must never publish by itself' },
    { kind: 'absent', fragment: 'erisco@icloud.com', why: "R6: the parent's identity must not sign the fork's releases" },
    { kind: 'absent', fragment: '@ericrisco/rsc version', why: '§10: the release must compare against the fork package, not the parent' },
  ],
  '.gitignore': [{
    kind: 'present',
    fragment: '!docs/fork/',
    why: "B1: the fork's own documentation must stay committable",
  }],
  'package.json': [{
    kind: 'present',
    fragment: '"governance:check"',
    why: 'the governance artifacts are checked by a script; losing it loses the check',
  }],
});

/**
 * Files upstream owns that this fork has modified — measured against the incorporated base. These
 * are the merge surface; everything the fork ADDED can only collide if upstream creates the same
 * path.
 */
export function divergenceSurface({ cwd, base, headRef = 'HEAD', ignore = ['docs/'] }) {
  const ns = nameStatus({ cwd, base, head: headRef });
  if (!ns.ok) return { ok: false, error: ns.error, modified: [], added: [], deleted: [] };
  const keep = (p) => !ignore.some((prefix) => p.startsWith(prefix));
  const pick = (status) => ns.entries.filter((e) => e.status === status && keep(e.path)).map((e) => e.path).sort();
  return {
    ok: true, error: null, modified: pick('M'), added: pick('A'), deleted: pick('D'),
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

const ATTRIBUTION_RE = /(^|\/)(LICENSE[^/]*|.*LICENSE.*\.txt|THIRD_PARTY\.md|UPSTREAM\.json)$/i;

/** Every attribution-bearing file under a revision's `skills/`, plus the repository root notices. */
export function attributionFilesAt(cwd, rev) {
  const res = git(['ls-tree', '-r', '--name-only', rev], { cwd });
  if (!res.ok) return [];
  return res.stdout.split('\n').filter((p) => p && ATTRIBUTION_RE.test(p)).sort();
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
    .map((f) => f.path).filter((p) => ATTRIBUTION_RE.test(p) && before.has(p) && after.includes(p)).sort();

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
