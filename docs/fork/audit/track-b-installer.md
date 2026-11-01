# Audit Track B — installer, distribution and auto-update

**Scope:** Stage 0 mandatory audit (REQUIREMENTS.md §3), covering §5 (per-project customisation
persistence), §8 (persistence/evolution), §9 (manual upstream maintenance), §10 (automatic consumer
updates).

**Subject:** `/Users/home/Development/rsc-harness-fork`, clone of `https://github.com/ericrisco/rsc-harness`
pinned at base commit `6f7edd31d109b7f0211d637e2d084724f6dd8e26` (`🔖 chore(release): 3.7.1 [skip ci]`),
package `@ericrisco/rsc@3.7.1`.

**Method:** read-only inspection (`cat`, `sed`, `grep`, `find`, `git log`, `python3 -I` for JSON
parsing) plus unauthenticated read-only HTTP GET to `https://registry.npmjs.org/@ericrisco%2frsc`.
No repository code was executed. No file outside `docs/fork/audit/` was modified. No commits, no
pushes, no remote changes, no installs.

Throughout, findings are tagged:

- **[F]** fact verified by direct inspection, with `file:line` or command evidence;
- **[I]** inference from reading code/comments, not executed;
- **[Q]** open question.

---

## 0. Inventory baseline (cross-check of §3's prior findings)

| §3 prior finding | Verdict | Evidence |
| --- | --- | --- |
| "El catálogo tenía 274 skills" | **[F] confirmed: 274** | `ls -1 skills \| wc -l` → 274; `ls -1 skills/*/SKILL.md \| wc -l` → 274; `len(manifest.json.skills)` → 274 |
| "Los originales se distribuían desde `skills/<id>/`" | **[F] confirmed** | `scripts/install-plan.js:7` — `from: \`skills/${id}\`` |
| "El instalador copiaba contenido a `.rsc/skills/<id>/`" | **[F] confirmed** | `targets/index.js:11-13` `baseDir()` → `join(cwd, '.rsc', 'skills', id)`; `scripts/install-apply.js:66` `cpSync(join(ROOT,'skills',id), dest, {recursive:true})` |
| "Los asistentes recibían enlaces, copias o instrucciones adaptadas" | **[F] confirmed** | `targets/index.js:15-18` comment: relative symlink on macOS/Linux, real file copies on Windows; `writeSkill()` per target |
| "`.rsc.json` registraba selección y versión del catálogo" | **[F] confirmed** | `scripts/lib/manifest-file.js:18` KEYS includes `skills`, `catalogVersion` |
| "`sync` podía regenerar contenido y enlaces administrados" | **[F] confirmed** | `scripts/install-apply.js:692-746` `syncInstalled()` → `applyInstall(... operation:'sync')` |
| "Las personalizaciones se esperaban en `02-DOCS/`" | **[F] partially** — `02-DOCS/` exists as doc root, but **no `02-DOCS/wiki/skills/` convention exists** (see §3 below) | zero matches for `wiki/skills` in `scripts/`, `targets/`, `skills/` |
| "`suggest`, `ftd`, `sdd` participaban en el funcionamiento interno" | **[F] confirmed for `suggest`** | `scripts/install-plan.js:9-11` — the hook is only planned when `skillIds.includes('suggest')`; `install-apply.js:294` wires `suggest`'s `SKILL.md` as the always-on body |
| "Flutter consultaba `02-DOCS/wiki/stack/flutter.md`, pero la convención no era uniforme" | **[F] confirmed** | `skills/flutter/SKILL.md:395`; the same `wiki/stack/<id>.md` pattern appears in `go`, `python`, `rust`, `java`, `redis`, `postgresdb`, `mongodb`, `expo`, `level-design`, `agent-eval` — i.e. ~11 of 274 |
| "Mismo major → segundo plano; major → confirmación" | **[F] confirmed** | `targets/auto-update.mjs:137-162` (quoted in §6) |
| "El actualizador apuntaba a `@ericrisco/rsc`" | **[F] confirmed** | `targets/auto-update.mjs:85,132`; `targets/clone-bootstrap.mjs:33` |

**[F] Licence.** `LICENSE` is MIT, `Copyright (c) 2026 Eric Risco`. `package.json:58` `"license": "MIT"`.
Third-party licence/notice files inside the catalog: `skills/design/IMPECCABLE-LICENSE.txt`,
`skills/design/engine/LICENSE`, `skills/ux/upstream/ux-designer/LICENSE`,
`skills/ux/upstream/ux-usability-foundations/LICENSE`, `skills/open-weights/references/licenses.md`,
`skills/terms-conditions/references/notices-and-aup.md`. **[Q]** Full licence-compatibility analysis of
those six is Track A's remit; Track B only records their existence as attribution obligations that
must survive any rename.

**[F] Documentation root is NOT configurable.** `02-DOCS` is a hard-coded string literal in every
site that uses it. There is no `DOCS_ROOT`, `docsRoot`, `RSC_DOCS*` or equivalent anywhere:

```
$ grep -rn -E "DOCS_ROOT|docsRoot|docs_root|DOCS_DIR|RSC_DOCS" scripts targets schema
scripts/lib/onboarding-apply.js:230:  const docsDir = join(cwd, '02-DOCS', 'wiki', 'harness');   # a local, not a config
```

All other 90+ occurrences are literal `'02-DOCS'` path segments. **Consequence for §5:** the clause
"Si la auditoría demuestra que esa raíz es configurable, respeta la configuración" does **not** apply —
the root is fixed at `02-DOCS/`. Making it configurable is new work for the fork, not a feature to
respect.

---

## 1. Install pipeline: `install-plan.js` → `install-apply.js`

### 1.1 What the plan is

**[F]** `scripts/install-plan.js` is 13 lines and purely declarative:

```js
export function planInstall({ skillIds, target, home, cwd, hooks = true }) {
  const t = targetPaths(target, home, cwd);
  const plan = [];
  for (const id of skillIds) {
    plan.push({ kind: 'skill', id, from: `skills/${id}`, to: t.skillDir(id) });
  }
  if (hooks && skillIds.includes('suggest')) {
    plan.push({ kind: 'hook', target, to: t.hookTarget });
  }
  return plan;
}
```

So the plan is `N` skill steps plus **at most one** hook step, and the hook step exists only if
`suggest` is among the selected skills and `policy.alwaysOn !== false`
(`install-apply.js:111,247`).

### 1.2 Order of writes in `applyInstall` (`install-apply.js:235-396`)

**[F]** Exact sequence:

| # | Line(s) | Action | Idempotent? |
| --- | --- | --- | --- |
| 1 | 240 | read `fromScratch = !existsSync('.rsc')` **before** anything creates it | n/a (read) |
| 2 | 243-245 | read `gitPermissions` from `.rsc.json`; `newProject = !existsSync('.rsc.json')` → `true` | n/a |
| 3 | 253-259 | compute `prunedSkills` (own-state-proven, no longer wanted) and `prunedBases` (retired + not recorded by another target) | n/a |
| 4 | 260-264 | compute `managedPaths` union | n/a |
| 5 | 265 | **`--dry-run` returns here**, nothing written | yes |
| 6 | 268 | `hydrateLocalDecisions()` — only when `fromScratch`: writes `.rsc/.no-<name>` markers from `.rsc.json.optOuts`, and `.rsc/developer.json` from `tier` | yes (`existsSync` guard per marker, 194-200) |
| 7 | 270 | `createBackup()` → `.rsc/backups/<stamp>-<op>-<target>/` | **no** (new dir each run) |
| 8 | 279-287 | `rmSync` pruned skill dirs + pruned bases | yes |
| 9 | 288-296 | per skill: `ensureBase(id)` then `writeSkill(target, id, base, to)`; for the hook step: `wireHook(target, paths, <base>/suggest/SKILL.md, policy)` | yes, but see §1.4 |
| 10 | 297 | `writeBaseVersions()` → `.rsc/.base-versions.json` | yes |
| 11 | 306-328 | `reconcileAgents()` → agent files; records `state.agents`, `agentCollisions`, `agentsKept` | yes |
| 12 | 329-332 | `wireMemory()` / `unwireMemory()` | yes |
| 13 | 333-334 | `wireUpdate()` → copies `targets/auto-update.mjs` + `memslop-offer.mjs` into `.rsc/`, wires a SessionStart hook into the target's config | yes (`strip()` before push, `update-wiring.js:139`) |
| 14 | 337-338 | `wireKnowledge()` | yes |
| 15 | 340 | `wireDeepseekBridge()` (deepseek only) — machine-level bridge | **[I]** writes outside the project |
| 16 | 341-342 | `wireGitPermissions()` / `unwireGitPermissions()` | yes |
| 17 | 343-347 | write `.rsc/.no-context7` if `policy.context7 === false` | yes |
| 18 | 358-366 | `reconcileCommands()` → slash-command files | yes |
| 19 | 367-368 | `writeState(paths.stateFile, state)` | yes |
| 20 | 369-370 | `writeFileSync('.rsc/.version', CLI_VERSION)` | yes |
| 21 | 371 | `recordInManifest()` → `.rsc.json` | yes (stable key order + sorted unions, `manifest-file.js:56-67`) |
| 22 | 386-393 | copy `targets/worktree-reaper.mjs` → `.rsc/`, then `installMergeHook(cwd)` → `.git/hooks/post-merge`. Skipped when `policy.codeHooks === false`. Wrapped in try/catch; failure is *reported*, never thrown | yes |
| 23 | 394 | `ignoreLocalState(cwd, target)` → appends to `.gitignore` | yes (`foldIgnoreBlocks` + `present` set, 447-490) |

**[F] Idempotence is an explicit design property.** `manifest-file.js:56-57`: *"Rewriting an
unchanged manifest must produce identical bytes, or every install shows up as a diff."*
`install-apply.js:404-405`: `ignoreLocalState` is *"Additive and idempotent by construction"*.

**[F] What is NOT idempotent:** `createBackup()` (step 7). `backups.js:134-142`
`uniqueSnapshotId()` appends `-2`, `-3`… on collision, so every install/sync/repair/uninstall/
agents-reset creates a new snapshot directory. There is **no pruning** (see §4).

### 1.3 Where the real skill content lands, and how assistants get it

**[F]** Two-tier layout:

1. **Shared base** — `targets/index.js:11-13`:
   ```js
   export function baseDir(id, cwd = process.cwd()) {
     return join(cwd, '.rsc', 'skills', id);
   }
   ```
   Filled by `install-apply.js:60-70 ensureBase()`: `cpSync(join(ROOT, 'skills', id), dest, { recursive: true })`.
   Refresh is **per skill**, keyed on `.rsc/.base-versions.json`
   (`install-apply.js:45-52, 62-63`): `const stale = baseVersions[id] !== CLI_VERSION;` →
   `rmSync(dest)` then re-copy. The per-skill ledger exists because a single global `.rsc/.version`
   made multi-target syncs skip later targets' exclusive skills (comment at lines 39-44).

2. **Per-target entry** — `t.skillDir(id)`, materialised by `writeSkill(target, id, base, to)`.
   `targets/index.js:15-18`: *"On macOS/Linux a relative symlink avoids duplication. On Windows we
   copy real files: relative `dir` symlinks require Developer Mode/admin."*

**[F]** Assistants therefore get the content through their own native skill directory
(`.claude/skills/<id>`, `.codex/rsc/<id>`, `.cursor/rules/<id>.…`, …), which points into
`.rsc/skills/<id>/`. `clone-bootstrap.mjs:123-125` states the invariant: *"`.rsc/skills/<id>` is the
canonical home of a skill's content on every assistant — the per-target directories … are links into
it — so one rule answers this for all seventeen."*

**[F]** Beyond skill files, assistants additionally receive: the always-on `suggest` body injected by
`wireHook` on SessionStart; subagent files (`reconcileAgents`); slash commands
(`reconcileCommands`); and 13-19 standalone hook scripts materialised under `.rsc/`
(`install-apply.js:76-107 generatedHookFiles()`).

### 1.4 Committed vs gitignored in the consumer repo

**[F]** `ignoreLocalState()` (`install-apply.js:406-502`) appends, under the header
`'# rsc local state (hooks, seals, logs) and managed skill links — machine-local'` (line 795):

- `.rsc/` and `.worktrees/` (line 426);
- every `paths.skillDir(id)` for installed skills (line 430) — *derived and platform-shaped*;
- `paths.stateFile` (line 434);
- every installed agent file (436-439) and command file (440-443).

**[F]** And it deliberately **rescues** two files from a blanket `.claude/` exclusion (lines 459-473):
`RESCUE = ['.claude/rsc-bootstrap.mjs', '.claude/settings.json']`, tested with
`git check-ignore -q` (line 462) and re-included via `!<dir>/`, `<dir>/*`, `!<file>` in that exact
order.

**[F] Therefore committed into the consumer's repo:** `.rsc.json`,
`.claude/rsc-bootstrap.mjs`, `.claude/settings.json`, `.gitignore`, and `02-DOCS/` + `01-TOOLS/`
content. **Gitignored:** `.rsc/` (bases, hook scripts, `.version`, `.base-versions.json`, backups,
seals, gap log), per-target skill links, per-target state, agent and command files.

**[F]** `.git/hooks/post-merge` is never committed (git does not clone hooks), which is why step 22
rewrites it on every install/sync/repair (`install-apply.js:372-377`).

**[I]** Net effect: the only things that travel through git are the *declaration* (`.rsc.json`), the
*wiring* (`.claude/settings.json`), the *bootstrap* (`.claude/rsc-bootstrap.mjs`), and the *user's
knowledge* (`02-DOCS/`, `01-TOOLS/`). This is good news for §5: a customisation under `02-DOCS/` is
inside the tracked set by default.

---

## 2. `.rsc.json`: full structure and semantics

### 2.1 Every key

**[F]** `scripts/lib/manifest-file.js:18`:

```js
const KEYS = ['version', 'targets', 'skills', 'agents', 'ownSkills', 'catalogVersion', 'tier', 'optOuts', 'memory', 'gitPermissions', 'agentModels', 'onboarding'];
```

| Key | Records | Set by |
| --- | --- | --- |
| `version` | schema version, always `1` | `install-apply.js:215`, defaulted `manifest-file.js:61` |
| `targets` | assistant ids with a harness here. **Union** across installs; only `dropTarget` removes one (`install-apply.js:219`) | `recordInManifest` |
| `skills` | declared catalog skill **ids**, sorted, passed through the retirement map (`install-apply.js:222`) | `recordInManifest` |
| `agents` | explicitly requested subagent names (union) | `install-apply.js:223` |
| `ownSkills` | *intended* for team-written skills — **see §2.3: never populated** | only copied forward (`install-apply.js:224`) |
| `catalogVersion` | the CLI version that last wrote it; defaults to `CLI_VERSION` (`install-apply.js:210`) | `recordInManifest` |
| `tier` | `balanced` \| `heavy` developer-agent tier, read from `.rsc/developer.json` (`install-apply.js:175`) | `recordInManifest` |
| `optOuts` | the **project-level** subset of disarmed gates (15 names, `targets/opt-outs.js:19-35`) | `localDecisions()` reading `.rsc/.no-*` |
| `memory` | session-memory decision, carried forward only | `install-apply.js:228` |
| `gitPermissions` | tri-state `true`/`false`/absent. `true` for a project adopted from scratch; absent means "never decided" (`install-apply.js:243-245`, `manifest-file.js:41-42`) | `recordInManifest` |
| `agentModels` | `{ <target>: '<model>' \| 'inherit' }`, strings only, sorted (`manifest-file.js:50-54`) | `rsc agent-model` |
| `onboarding` | the full accepted-plan **receipt**: `acceptedPlanId`, `acceptedAt`, the whole `plan` (policy, record, evidence, governedPaths, floorPaths), `provenance`, `artifactDigests` | `onboarding-apply.js:287-337` |

### 2.2 What it deliberately does NOT record

**[F]** `manifest-file.js:10-14`, verbatim:

> *"It is a DECLARATION, never an inventory: ids and names only, no paths and no file lists. Two
> reasons. Paths differ by platform (some machines symlink, others copy), so committing them
> reproduces in the manifest the very conflict this removes from the skill directories. And a
> committed file gets merge conflicts by nature."*

So: **no file paths, no per-file inventory, no hashes of skill content, no machine-local opt-outs**
(`MACHINE_OPT_OUTS = ['context7','git','harness','memslop','scope-check']`, `targets/opt-outs.js:38-44`),
**no record of anything under `02-DOCS/`** except the three onboarding documents named inside
`onboarding.plan.governedPaths`.

**[F] Unreadable ≠ absent.** `manifest-file.js:24-30`:

```js
try { raw = JSON.parse(readFileSync(file, 'utf8')); } catch {
  throw new Error(`${MANIFEST} exists but is not readable JSON — fix or delete it; rsc will not overwrite it`);
}
```

and the committed bootstrap has the matching non-throwing form,
`clone-bootstrap.mjs:63-80`, returning `{ state: 'unreadable', reason }`. **This is directly reusable
for §5's "un archivo existente pero ilegible … no debe tratarse silenciosamente como ausente".**

### 2.3 `ownSkills` is dead weight — **[F]**

`recordInManifest` only ever does `ownSkills: prev.ownSkills || []` (`install-apply.js:224`). No code
path writes a value into it. It is read in three places (`doctor.js:258`, `divergence.js:39`,
`clone-bootstrap.mjs:100`). The upstream author says so explicitly in `scripts/doctor.js:160-163`:

> *"Every skill this catalog ships declares `origin: risco` in its own frontmatter — all 272 of them,
> uniformly. So "is this ours?" is answerable from the file itself, and does not need the list in
> `.rsc.json` that nobody ever filled: that list is parallel accounting (P3), it has been empty in
> every project since it was introduced, and `doctor` has been faithfully reporting on the emptiness."*

**[F]** The real provenance mechanism is frontmatter: `doctor.js:168` `const CATALOG_ORIGIN = 'risco';`
and `doctor.js:170-195 ownSkillsIn()` reads the first 2048 bytes of each `SKILL.md`, matches
`/^origin:\s*(\S+)\s*$/m`, and classifies anything that is not `risco` as the user's.
Verified: `grep -l '^origin: risco' skills/*/SKILL.md | wc -l` → **274** (the comment's "272" is
stale by two).

**[F]** The failure direction is deliberately safe — `doctor.js:165-167`: *"Failing towards 'the
user's' is deliberate. Reading a catalog skill as the user's leaves a file that stops being updated;
reading the user's as the catalog's invites something to overwrite it. Only one of those loses work."*

### 2.4 Other sources of skills the harness cannot see or control (§8)

**[F] CAN see** — `scripts/lib/capabilities.js:94-122 listSkills()` reads **from disk**, in **both
scopes** (project `cwd` and user `home`, `bothScopes()` lines 73-78), and asks only *"is there a
`SKILL.md` behind this name?"* (line 117). Comment at lines 14-16: *"Both skills and agents are read
from DISK, never from the install state file: a state entry whose files were deleted would otherwise
answer 'covered — use it' for something that is not there."*

So the harness sees: catalog skills it installed; user-scope skills in the assistant's own skill
directory; and hand-written project skills in that same directory (classified by `origin:`).

**[F] CANNOT see** — enumerated by absence of any code:

| Source | Visibility | Evidence |
| --- | --- | --- |
| **Plugin skills** (e.g. Claude Code plugins / marketplaces) | **invisible** | `grep -rn -iE "plugin.?skill\|\.claude/plugins\|claude-plugin" scripts targets` → **zero matches** |
| Skills for an assistant not in `.rsc.json.targets` | invisible | `listSkills` takes a single `target`; `targetPaths(target,…)` throws on unknown |
| Personal/global skills outside the assistant's canonical skill dir | invisible | `listSkills` only scans `targetPaths(target, home, home).root` |
| Skills injected at runtime by the host (session skills, MCP-provided) | invisible | no code reads any runtime skill registry |
| Skills in a different scope of the same assistant (e.g. enterprise-managed settings) | invisible | only project + user scopes are scanned |

**[F] CANNOT control** — `install-apply.js:276-278`: *"Ownership is proven by the state file — a
same-named directory rsc never recorded is somebody's own work and is not touched."*
`divergence.js:23-24`: *"A hand-written skill that nobody declared is in none of them. Not declaring
is a valid way to keep things of your own, not an oversight to correct."* So the harness never
deletes, renames or rewrites a skill it did not record, by construction.

**[F]** `.rsc/skill-registry.json` / `.md` (`scripts/lib/registry.js:12-25 refreshRegistry()`) is
**catalog-only**: `buildRegistry` iterates `manifest.skills` (line 47) and tags every entry
`source: 'catalog'` (line 54). It therefore cannot represent any non-catalog skill at all.

**Conclusion for §8:** the warning is well founded. `.rsc.json` represents **only the catalog skills
this project declared**. It cannot represent plugin skills (zero awareness), skills for untargeted
assistants, or host-injected skills. `rsc capabilities` is strictly better than `.rsc.json` (it reads
disk, both scopes), but still blind to plugins. The fork must state this limit explicitly and must not
claim `.rsc.json` is the complete usable set.

---

## 3. `sync`, `repair`, `doctor` — and the `02-DOCS/` question

### 3.1 `doctor` — **[F] strictly read-only**

```
$ grep -n -E "writeFileSync|mkdirSync|rmSync|renameSync|cpSync|unlinkSync|appendFileSync" \
    scripts/doctor.js scripts/knowledge-doctor.js scripts/lib/knowledge-doctor.js
(no output)
```

`scripts/rsc.js:890-897` only prints and sets `process.exitCode = 1` when `!report.healthy`.
`scripts/knowledge-doctor.js:11` states it: *"It NEVER writes. Not a file, not a mkdir. `02-DOCS/` is
untracked (P9): there is no undo here."*

### 3.2 `sync` — **[F]**

`install-apply.js:692-746 syncInstalled()`:

- rebuilds the declared set from `.rsc.json` when per-target state is absent (the clone case, comment
  695-698);
- the accepted plan is a **floor, not a ceiling** (lines 702-707) — reading it as the whole
  declaration *"is what deleted users' skills"*, a bug reported and reproduced 2026-09-17;
- `declaredRaw = replaceRetired(governedSkills ? union(governedSkills, manifest.skills) : (ids.length ? ids : manifest.skills))`
  (710-712), then `withDefaultSkillFloor(...)` if non-empty (719);
- returns early and writes nothing when nothing is declared (721);
- delegates to `applyInstall({ operation: 'sync', policy: manifest?.onboarding?.plan?.policy })` (730-739);
- then `excludePersonalProfile(cwd)` (744) → appends `/02-DOCS/wiki/harness/user-profile.md` to
  `.git/info/exclude` (`onboarding-apply.js:168-182`) — **not** a write under `02-DOCS/`.

**Can destroy:** within `applyInstall`, `prunedSkills` (`install-apply.js:254-255`) removes any
state-proven skill not in the new set **whenever a policy governs**; `prunedBases` (258-259) removes
retired bases. Pre-write backup at line 270 covers all of it.

### 3.3 `repair` — **[F]**

`scripts/lib/repair.js` classifies every finding at birth (comments 18-26): `restore` happens
automatically after a backup; `change` is always asked one by one. Five findings:
`nested-layout`, `duplicate-hooks`, `dangling-links`, `no-manifest`, `wrong-target` (lines 43-88).

- Harmless in the wrong folder: `repair.js:39` — `if (!installed.length && !manifest && !existsSync(join(cwd,'.rsc'))) return out;`
- Honours the accepted plan: `repair.js:139` — `const policy = readManifest(cwd)?.onboarding?.plan?.policy;`
  (without it, #274 wired guards the plan had declined).
- `wrong-target` installs the new target **before** unwiring the old (`repair.js:155-158`), with the
  stated reason *"so a failure halfway leaves a working harness rather than none"*.
- Backup before any write: `repair.js:140-143`.

**Can destroy:** `removeManagedSkills(paths)` (`repair.js:100-105`) in the `wrong-target` path,
driven only by the target's own state file — *"'we never touch what we did not write' is a property
of the input here, not a check that could be forgotten"* (lines 92-99).

### 3.4 **Does any of them write/move/delete under `02-DOCS/`?**

**Direct answer: `sync`, `repair` and `doctor` never write under `02-DOCS/`. But five other code
paths do, and one of them (`knowledge-sync`) can overwrite and `git rm` files under
`02-DOCS/wiki/` autonomously, on every turn, without the user asking.**

**[F] `sync` / `repair` / `doctor`: zero writes under `02-DOCS/`.** `applyInstall`'s
`managedPathsForInstall` (`install-apply.js:109-150`) names only `.rsc/`, `.rsc.json`, per-target
paths, `.gitignore` and `.claude/`. No `02-DOCS` segment appears anywhere in `install-apply.js`
except in comments and in `purge`.

**[F] `02-DOCS/wiki/skills/<name>/README.md` — the §5 standard path — is written by nothing and read
by nothing.** Zero matches for `wiki/skills` across `scripts/`, `targets/` and `skills/`. The path is
entirely new surface for the fork.

**[F] It also contradicts the upstream wiki layout.** `skills/harness/references/wiki-protocol.md:81-82`:
*"**`wiki/`** — Compiled knowledge articles. Full ownership. Organized by topic subdirectories,
**one level only**: `wiki/<topic>/<article>.md`."* The §5 path `wiki/skills/<name>/README.md` is two
levels. **[Q]** Does the fork (a) relax the protocol to allow `wiki/skills/<name>/`, (b) flatten to
`wiki/skills/<name>.md`, or (c) place customisations outside `wiki/`? This decision has knock-on
effects on the knowledge-sync set, on the harness skill's index/lint passes, and on `wiki/index.md`.

#### The five real write paths under `02-DOCS/`

**(a) `targets/knowledge-sync.mjs` — the highest risk. [F]**

`KNOWLEDGE` is the auto-synced prefix set (line 47):

```js
export const KNOWLEDGE = Object.freeze(['01-TOOLS/', '02-DOCS/wiki/', '02-DOCS/attachments/']);
export const PERSONAL  = Object.freeze(['02-DOCS/wiki/harness/user-profile.md']);
```

`02-DOCS/wiki/skills/` would fall **inside** `02-DOCS/wiki/`, i.e. inside the auto-synced set.

*Incoming* — `applyIncoming()`, lines 598-603:

```js
  if (take.length) {
    const gone = take.filter((f) => !blob(root, tip, f));
    const present = take.filter((f) => blob(root, tip, f));
    if (present.length) git(root, ['--literal-pathspecs', 'checkout', tip, '--', ...present]);
    if (gone.length) git(root, ['--literal-pathspecs', 'rm', '--quiet', '--', ...gone]);
    git(root, ['--literal-pathspecs', 'commit', '--quiet', '--no-verify', '--only', '-m', SYNC_SUBJECT, '--', ...take]);
```

So a file under `02-DOCS/wiki/` is **overwritten** (`git checkout <tip> -- <f>`) or **deleted**
(`git rm -- <f>`) and the result **auto-committed with `--no-verify`**, triggered by a hook on the
user's prompt / end of turn.

*The guard that makes this survivable* — lines 578-590. A file only enters `take` when:

```js
    if (mine === base && committed === base) take.push(f);
    else if (mine && mine === committed && superseded(f, mine)) take.push(f);
    else if (touchedBy(f).some((c) => !s.ours.includes(c))) clash.push(f);
```

i.e. locally **untouched and committed-identical** to the last-seen exchange tip. A locally modified
file goes to `clash` and is reported, never forced: *"tu versión sigue intacta."* (line 606).

**[F] Residual risk:** a committed, locally-untouched `02-DOCS/wiki/skills/<name>/README.md` **will**
be replaced by, or deleted to match, whatever is on `origin/rsc/knowledge`. The customisation is
recoverable from git history (the delete is itself committed), but it disappears from the working
tree with no prompt. **[I]** This is correct behaviour for *team knowledge* and the wrong behaviour
for a *per-project governance contract* if the exchange branch ever carries a stale or hostile state.

*Outgoing* — `commitLocal()`, lines 317-320: `git add -A -- <knowledge files>` then
`git commit --quiet --no-verify --only`. **[F] The harness auto-commits the user's `02-DOCS/wiki/`
edits to the branch they are on, without asking.**

*FTD close* — line 837: `for (const [f, text] of docs) writeFileSync(join(root, f), text);`, scoped
by `isFtdDoc` (line 632) to `^02-DOCS/wiki/ftd/[^/]+\.md$` only.

*Opt-out* — `OPT_OUT = '.no-knowledge-sync'` (line 50), a **project** opt-out
(`targets/opt-outs.js:29`) that travels in `.rsc.json.optOuts`. `rsc knowledge-sync off`
(`rsc.js:945-970`).

*Closed-trunk safety* — lines 567-579: on a protected default branch it **writes nothing** and only
reports what is waiting, because an uncommitted/untracked write would block the user's next
`git pull`.

**(b) `scripts/lib/onboarding-apply.js:184-196 writeOnboardingDocuments()` — [F] unconditional overwrite**

```js
export function writeOnboardingDocuments(cwd, plan, planId, previousRecord = null) {
  const dir = join(cwd, '02-DOCS', 'wiki', 'harness');
  mkdirSync(dir, { recursive: true });
  const docs = renderOnboardingDocuments(plan, planId);
  const profilePath = join(dir, 'user-profile.md');
  writeFileSync(profilePath, mergeProfile(existsSync(profilePath) ? readFileSync(profilePath, 'utf8') : '', plan, previousRecord));
  excludePersonalProfile(cwd);
  writeFileSync(join(dir, 'installation-plan.md'), docs.installation);
  const decisionsPath = join(dir, 'decisions.md');
  if (!existsSync(decisionsPath)) writeFileSync(decisionsPath, docs.decisions);
  else if (!readFileSync(decisionsPath, 'utf8').includes(`Accepted plan \`${planId}\``)) {
    appendFileSync(decisionsPath, …);
  }
}
```

`installation-plan.md` is replaced wholesale; `user-profile.md` is merged; `decisions.md` is
append-only and guarded. Called from `onboarding-apply.js:318`, i.e. on every accepted
`onboard` / `reassess` — **not** from `sync` or `repair`.

**(c) `scripts/lib/onboarding-apply.js:342` — [F] rollback can delete under `02-DOCS/`**

```js
    const differences = verifyOnboarding(cwd, plan, planId);
    if (differences.length) throw new Error(differences.join('; '));
    return receipt;
  } catch (error) {
    restoreBackup({ cwd, id: transaction.id });
    throw new Error(`RSC_ONBOARDING_INCOMPLETE: ${error.message}. Recover with: ${recoveryCommand(plan, planId)}`);
  }
```

`restoreEntry` (`backups.js:98-113`) does, for an entry whose `existed === false`:
`rmSync(absPath, { recursive: true, force: true })`.

**[F] Mitigating fact:** in the normal path `governedPaths` names **three individual files**, never the
directory (`onboarding.js:328-330`): `02-DOCS/wiki/harness/user-profile.md`,
`…/decisions.md`, `…/installation-plan.md`. So the blast radius is those three files.

**[F] Two residual exposures:**
1. `onboarding.js:336` — the fallback when `evidence.root` is falsy is
   `['.rsc.json', '.rsc/', '02-DOCS/wiki/harness/']`, a **directory**. A rollback on that branch
   would `rmSync -r` the whole `02-DOCS/wiki/harness/` tree if it did not exist beforehand.
2. `onboarding-apply.js:275-277` — `transactionPaths` unions `previousPlan?.governedPaths`. A receipt
   written by an older rsc that listed `02-DOCS/wiki/harness/` as a directory re-introduces exposure 1
   on a current run. **[I]** cross-version, not reproducible from this commit alone.

**(d) `scripts/lib/constitution-draft.js:148-154` — [F] create-only, never overwrites**

```js
  mkdirSync(join(cwd, '02-DOCS', 'wiki', 'sdd'), { recursive: true });
  try {
    writeFileSync(target, renderConstitutionDraft(plan, …), { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') return { created: false };
```

Plus a per-segment symlink refusal (lines 136-142) raising `RSC_ROOT_AMBIGUOUS`. This is the safest
pattern in the codebase and the right model for the fork's customisation scaffolding.

**(e) `scripts/lib/ingest-move.js:83-93` — [F] writes into `02-DOCS/raw/` and `02-DOCS/wiki/.ingested.json`**

```js
  const rawDir = slug ? join(projectRoot, '02-DOCS', 'raw', slug) : join(projectRoot, '02-DOCS', 'raw');
  mkdirSync(rawDir, { recursive: true });
  …
  if (!existsSync(target)) copyFileSync(abs, target);
  if (sha256(target) !== hash) return { …, reason: 'the copy in raw/ did not verify; the original was left in place' };
  …
  unlinkSync(abs);
```

The delete of the **original** only happens after a sha256 match (line 89 comment: *"The only rule
that makes the delete safe"*). `02-DOCS` and `01-TOOLS` are in `PROTECTED_DIRS` (line 16), so ingest
refuses to move anything already inside the doc root. `recordInLedger` (lines 48-57) writes
`02-DOCS/wiki/.ingested.json` atomically via tmp + `renameSync`.

**(f) `scripts/install-apply.js:942` — [F] `purge --with-docs` deletes the entire doc root**

```js
  drop(rscDir, true);
  if (withDocs) drop(join(cwd, '02-DOCS'), true);
  else if (existsSync(join(cwd, '02-DOCS'))) kept.push({ path: '02-DOCS/', reason: 'your knowledge base. Add --with-docs to remove it too.' });
```

Default is **keep**, and `purge` *"does not snapshot (a pre-purge backup would delete itself)"*
(lines 775-776). It is the deliberate escape hatch, invoked only by explicit
`rsc purge --with-docs` / `rsc uninstall --all --with-docs`.

**(g) Model-driven writes — [I] not code paths, but real**

`skills/harness/SKILL.md` instructs the agent to maintain `02-DOCS/wiki/`: line 282 *"`02-DOCS/wiki/index.md`,
merging — don't duplicate, don't delete"*; line 165 *"apply ONLY additive merges. Never delete user
content."*; lines 187-189 require a literal-string confirmation before deleting a legacy folder.
`wiki-protocol.md` describes Maintenance Pass / Deep Improve / Cascade Updates passes that regenerate
`wiki/scores.json`, `wiki/dashboard.html` and rewrite articles. **These are model-dependent rules, not
code guarantees** — exactly the distinction REQUIREMENTS §6 demands be documented separately.

---

## 4. Backups and recovery

**[F] Location and shape.** `scripts/lib/backups.js:17-19` — `.rsc/backups/<id>/`, where
`id = <YYYYMMDD-HHMMSS>-<operation>-<target>` (lines 145-148), de-duplicated with `-2`, `-3`…
(134-142). Each snapshot has `manifest.json` (`schemaVersion: 1`, `id`, `createdAt`, `operation`,
`target`, `cwd`, `cliVersion`, `entries`) plus a `files/` tree mirroring project-relative paths
(lines 29-40). Entry kinds: `missing` (did not exist), `symlink` (stores `linkTarget`), `dir`
(recursive `cpSync`), `file` (lines 77-96).

**[F] When.** A snapshot is taken by: `applyInstall` (`install-apply.js:270`, covering
`install` / `sync` / `onboard` / `repair`), `uninstall` (`:567`), `resetAgents` (`:763`),
`repair` (`repair.js:140`), and `applyAcceptedOnboarding` as an `onboarding-transaction`
(`onboarding-apply.js:282-285`). **Not** by `purge` (deliberate, `install-apply.js:775-776`).

**[F] What.** Exactly `managedPathsForInstall(...)` plus this pass's prunes
(`install-apply.js:260-264`). Hook files are enumerated by hand in `generatedHookFiles`
(`:76-107`), with the standing warning at lines 73-75: *"Keep in sync with targets/claude.js
wireHook(): a file it writes but this omits is silently absent from the snapshot, so `rsc restore`
cannot bring it back."* **[I]** This hand-maintained list is a drift hazard the fork inherits.

**[F] Retention: NONE.**

```
$ grep -n -iE "prune|retain|retention|MAX_BACKUP" scripts/lib/backups.js
(no retention logic)
```

Snapshots accumulate without bound under `.rsc/backups/`. That directory is gitignored, and
`rsc purge` deletes it wholesale. **[I]** A project synced weekly for a year accrues ~52 full copies
of its hook scripts, agents and commands. Not a correctness bug; a disk-growth and
`.rsc/` hygiene issue, and a §10 "mantén respaldo y recuperación" gap if the fork promises bounded
recovery.

**[F] Path-traversal hardening is thorough.** `safeRelative` (154-160) refuses `..`;
`safeJoin` (173-178) splits on **both** separators (`pathSegments`, line 171) because *"a path stored
with Windows separators … has no '/' to split on, so the old check saw a single segment, found no
'..', and handed the raw string to join()"*.

**[F] How recovery is triggered.** Manually only:
- `rsc backups` → `rsc.js:1145-1152`, lists `id / operation / target / N files / createdAt`;
- `rsc restore <id|latest> [--dry-run]` → `rsc.js:1153-1160` → `restoreBackup`.
- Plus the *automatic* rollback inside `applyAcceptedOnboarding` (`onboarding-apply.js:342`).
- Plus the user-facing pointer `whereKept()` (`backups.js:46-54`), which prefers a non-transaction
  snapshot: *"A transaction snapshot is the fallback: it is the install's rollback, not the user's copy."*

### Assessment against §10: *"una verificación fallida debe conservar la instalación funcional y explicar el bloqueo"*

| Operation | Verification | On failure | Verdict |
| --- | --- | --- | --- |
| `onboard` / `reassess` | **yes** — `verifyOnboarding()` (`onboarding-apply.js:200-220`) checks plan identity, per-target installed skills/agents, four policy flags, and the three harness documents | `restoreBackup(transaction.id)` + `RSC_ONBOARDING_INCOMPLETE: <reason>. Recover with: <exact command>` (`onboarding-apply.js:342-343`, command built at `:93-101`) | **[F] satisfied** — rolls back and explains |
| `sync` | **none** | nothing. A throw inside `applyInstall` propagates to `rsc.js:1609` → `console.error('rsc error:', e.message); process.exit(1)`. The backup exists but **no code restores it** | **[F] NOT satisfied** — a mid-`applyInstall` failure leaves a partially-written harness and the user must know to run `rsc restore latest` |
| `repair` | none (it *is* the recovery path) | backup kept, nothing auto-restored | **[I] acceptable** |
| auto-update (`sync` in background) | **none** | failure is written to `.rsc/auto-update.log` and the next session falls back to **asking** (`auto-update.mjs:161`: *"The automatic update did not finish (log: .rsc/auto-update.log); it retries once a day."*) | **[F] partially satisfied** — the blocker is explained, but the install is not verified or rolled back |

**[F] The dangerous window** is `ensureBase` (`install-apply.js:62-67`): when a base is stale it is
`rmSync`'d **before** being re-copied. A failure between the two leaves `.rsc/skills/<id>/` absent
while `.rsc.json` still declares it — which `repair`'s `dangling-links` finding is built to catch
(`repair.js:58-65`), so recovery exists but is a second, manual step.

---

## 5. Auto-update mechanism and the EXHAUSTIVE parent-identity map

### 5.1 Where the package name is derived vs hard-coded

**[F] Hard-coded string literals of `@ericrisco/rsc` in executable code — 4 sites:**

| Site | Code | Why it matters |
| --- | --- | --- |
| `targets/auto-update.mjs:85` | `: ['npx', '-y', \`@ericrisco/rsc@${version}\`];` | **the background installer argv** — this is what actually reinstalls |
| `targets/auto-update.mjs:132` | `await fetch('https://registry.npmjs.org/@ericrisco%2frsc/latest', …)` | **the version oracle** |
| `targets/clone-bootstrap.mjs:33` | `const PACKAGE = '@ericrisco/rsc';` | used at `:182`, `:240-241`, `:381` — and **this file is committed into every consumer repo** as `.claude/rsc-bootstrap.mjs` |
| `scripts/lib/upgrade.js:6,15` | `installCommand: 'npm install -g @ericrisco/rsc@latest'` and `spawnSync('npm', ['install','-g','@ericrisco/rsc@latest'], …)` | **`rsc upgrade --global` actually executes this** |

**[F] Derived (safe) sites — nothing to change:**
- `scripts/lib/versions.js:11` — `CLI_VERSION` read from the local `package.json`; no name.
- `targets/update-wiring.js` — zero identity references; it copies `auto-update.mjs` verbatim
  (`:121`) and wires `node .rsc/auto-update.mjs hook <target>` (`:60-62`).
- `scripts/lib/registry.js`, `scripts/lib/manifest.js` — read `manifest.json` / `skills/` by relative
  path.

**[F] Critical asymmetry:** `auto-update.mjs` and `clone-bootstrap.mjs` are **materialised into the
consumer's project** (`update-wiring.js:121`; `install-apply.js:81`). `clone-bootstrap.mjs` is
further **committed** (rescued from `.gitignore` at `install-apply.js:459`). So a consumer repo that
ever ran the parent carries a committed file that names the parent package forever, and a
gitignored-but-present `.rsc/auto-update.mjs` that will `npx @ericrisco/rsc@<v>` on its next session.
**[I] The fork cannot fix this by renaming its own sources alone**: existing consumer repos need an
explicit migration (re-sync + a rewritten committed bootstrap), and the fork's own `sync` must detect
and replace a parent-named bootstrap.

### 5.2 Table: parent-identity references

Total: **316 references across 73 files** (`grep -rIn -E 'ericrisco|Eric Risco|rsc-harness'`,
excluding `.git/`, `node_modules/`, `package-lock.json`). Pattern counts:
`@ericrisco/rsc` 201 · `ericrisco` 267 · `rsc-harness` 101 · `ericrisco/rsc-harness` 21 ·
`Eric Risco` 9.

By category: site 89 · skills 85 · scripts 51 · root files 34 · targets 29 · tests 25 · workflows 3.

Legend — **must**: the fork is broken or reinstalls the parent without this change.
**should**: user-visible correctness/branding. **attribution**: keep, per MIT §3 and §13.

#### Category: UPDATER (the code that installs)

| File:line | What appears | Must change? |
| --- | --- | --- |
| `targets/auto-update.mjs:85` | `['npx','-y',\`@ericrisco/rsc@${version}\`]` | **must** |
| `targets/auto-update.mjs:132` | `registry.npmjs.org/@ericrisco%2frsc/latest` | **must** |
| `targets/auto-update.mjs:172` | notice text `npx @ericrisco/rsc@latest` | **must** |
| `targets/auto-update.mjs:180` | notice text `npx @ericrisco/rsc@latest` | **must** |
| `scripts/lib/upgrade.js:6` | `installCommand: 'npm install -g @ericrisco/rsc@latest'` | **must** |
| `scripts/lib/upgrade.js:15` | `spawnSync('npm',['install','-g','@ericrisco/rsc@latest'])` | **must** |
| `scripts/rsc.js:1165` | `'Upgraded global @ericrisco/rsc.'` | should |

#### Category: BOOTSTRAP (committed into consumer repos)

| File:line | What appears | Must change? |
| --- | --- | --- |
| `targets/clone-bootstrap.mjs:33` | `const PACKAGE = '@ericrisco/rsc'` (feeds `:182`, `:240`, `:241`, `:381`) | **must — highest priority** |
| `targets/clone-bootstrap.mjs:235` | comment naming `npx @ericrisco/rsc sync` | should |

#### Category: HOOKS (materialised under `.rsc/`, run every session)

| File:line | What appears | Must change? |
| --- | --- | --- |
| `targets/session-start.mjs:110` | `cd "${other}" && npx @ericrisco/rsc@latest` | **must** |
| `targets/session-start.mjs:182` | `npx @ericrisco/rsc ingest <file>` | **must** |
| `targets/session-start.mjs:233` | `npx @ericrisco/rsc audit` | **must** |
| `targets/session-start.mjs:292` | `npx @ericrisco/rsc worktrees reap` | **must** |
| `targets/session-start.mjs:293` | `npx @ericrisco/rsc worktrees reap <path>` | **must** |
| `targets/branch-guard.mjs:105` | `npx @ericrisco/rsc isolation off` | **must** |
| `targets/branch-guard.mjs:280` | `npx @ericrisco/rsc main unlock` | **must** |
| `targets/branch-guard.mjs:287` | `npx @ericrisco/rsc main unlock` | **must** |
| `targets/branch-guard.mjs:296` | `npx @ericrisco/rsc isolation off` | **must** |
| `targets/sello.mjs:360,363,366,369,372` | `npx @ericrisco/rsc sello off` ×5 | **must** |
| `targets/sello.mjs:375,378` | `npx @ericrisco/rsc sello freeze` ×2 | **must** |
| `targets/sello.mjs:386` | `npx @ericrisco/rsc sello off` | **must** |
| `targets/memory.js:247` | `npx @ericrisco/rsc sync` | **must** |

#### Category: RECOVERY / SUGGESTED COMMANDS (CLI output the user is told to run)

| File:line | What appears | Must change? |
| --- | --- | --- |
| `scripts/rsc.js` — 31 refs at lines 44, 49, 54, 56, 59, 130, 212, 359, 370, 533, 534, 673, 769, 822, 941, 967, 981, 999, 1047, 1077, 1082, 1106, 1139, 1165, 1181, 1186, 1208, 1239, 1317, 1318, 1556 | help text, `GENERAL_HELP`, recovery strings, every `Use: npx @ericrisco/rsc …` usage line | **must** (all) |
| `scripts/doctor.js` — 14 refs at lines 129, 135, 155, 156, 232, 239, 280, 294, 325, 493, 542, 556, 569, 586 | every remediation `action` string | **must** |
| `scripts/lib/onboarding-apply.js:96` | `'npx @ericrisco/rsc@latest onboard'` inside `recoveryCommand()` | **must** |
| `scripts/lib/onboarding-apply.js:505` | `ONBOARD_ACTION` string | **must** |
| `scripts/lib/onboarding-apply.js:519` | *"Re-run `npx @ericrisco/rsc@latest onboard`"* | **must** |
| `scripts/audit.js:199` | `npx @ericrisco/rsc uninstall <id>` / `audit` | **must** |
| `targets/commands.js:46,53,58,63` | slash-command bodies instructing `npx @ericrisco/rsc sello freeze` / `memory learn` / `memory save` / `memory resume` | **must** |
| `targets/memslop-offer.mjs:58` | `raw.githubusercontent.com/ericrisco/mem-slop/main/install.sh \| bash` | **[Q] separate third-party repo** — see §5.4 |

#### Category: PACKAGE / ROOT METADATA

| File:line | What appears | Must change? |
| --- | --- | --- |
| `package.json:2` | `"name": "@ericrisco/rsc"` | **must** |
| `package.json:59` | `"author": "Eric Risco"` | should (new author; keep upstream credit in README) |
| `package.json:60` | `homepage` → `github.com/ericrisco/rsc-harness#readme` | **must** |
| `package.json:63` | `repository.url` → `ericrisco/rsc-harness.git` | **must** |
| `package.json:66` | `bugs.url` → `ericrisco/rsc-harness/issues` | **must** |
| `LICENSE:3` | `Copyright (c) 2026 Eric Risco` | **attribution — keep** (MIT §3); add the fork's own copyright line alongside |
| `SECURITY.md:7` | advisory URL → parent repo | **must** |
| `.gitignore:25` | comment referencing `github.com/ericrisco/RSC` | leave (historical note) |
| `manifest.json:4833,5061` | the literal word "rsc" inside two generated skill descriptions | **[I]** regenerated by `npm run manifest`; follows the skill sources |

#### Category: WORKFLOWS

| File:line | What appears | Must change? |
| --- | --- | --- |
| `.github/workflows/release.yml:65` | `git config user.name "Eric Risco"` (+ `erisco@icloud.com` at `:66`) | **must** |
| `.github/workflows/release.yml:74` | `npm view @ericrisco/rsc version` (version reconciliation) | **must** |
| `.github/workflows/release.yml:90` | `npm view @ericrisco/rsc version` (bump decision) | **must** |

#### Category: SKILLS (catalog content — 85 refs, 29 files)

| File → lines | Nature | Must change? |
| --- | --- | --- |
| `skills/suggest/SKILL.md` → 3, 44, 55, 61, 65, 67, 73, 87, 91, 96 | **the always-on body injected into every session**; names `npx @ericrisco/rsc …` commands | **must** |
| `skills/init/references/recommend-skills.md` → 4, 30, 34, 43-47, 58-60, 70-73 (15) | installation commands in the init guide | **must** |
| `skills/tidy/SKILL.md` → 3, 60, 94, 113, 124, 145 | suggested commands | **must** |
| `skills/review/SKILL.md` → 119, 121, 122, 173, 199 | `sello` commands | **must** |
| `skills/worktrees/SKILL.md` → 47, 144, 158, 159, 160 | `worktrees reap` commands | **must** |
| `skills/ship/SKILL.md` → 80, 97, 99, 136 | commands | **must** |
| `skills/sdd-init/SKILL.md` → 63, 79, 83, 173 | commands | **must** |
| `skills/harness/SKILL.md` → 31, 258, 261 | commands | **must** |
| `skills/skill-scout/SKILL.md` → 29, 44, 47 | `capabilities gap-log` commands | **must** |
| `skills/init/SKILL.md` → 119, 148 | commands | **must** |
| `skills/author-skill/references/rsc-conventions.md` → 5, 59 | repo-name references | should |
| `skills/harness/references/wiki-protocol.md` → 531 | reference | should |
| `skills/implement/SKILL.md` → 44; `skills/code-review/SKILL.md` → 96; `skills/fable-operator/SKILL.md` → 14; `skills/scroll-film/assets/scrub-engine.js` → 2 | incidental | should |
| `skills/ads` →146, `brand-voice` →145, `content-engine` →138, `document-processing` →120, `landing-copy` →129, `linkedin-content` →144, `marketing` →153 | boilerplate footer mentioning the product | should |
| `skills/{suggest,init,orient,sdd-init,tidy}/evals/*` → 5, 19, 41, 48, 49, 58, 59, 63, 65, 69, 74, 78 and `skills/suggest/evals/README.md` → 16, 17 | eval expectations asserting the command string | **must** (they gate CI) |

**[F] §4-strategy consequence:** 85 of the 316 references live inside `skills/`. Strategy B ("keep
`skills/` byte-identical to upstream and transform at build/install") **cannot** leave these alone —
`skills/suggest/SKILL.md` alone injects 10 parent-named commands into every session. Any byte-identical
policy must be paired with a deterministic rename transform applied to skill content, and the eval
`cases.yaml` files must be transformed in lockstep or CI fails.

#### Category: SITE (89 refs, 12 files) and TESTS (25 refs, 12 files)

| File | Refs | Must change? |
| --- | --- | --- |
| `site/index.html` | 28 (lines 6,7,9,10,11,12,13,14,18,19,21,22,25,29,31,36,51,62,85,87,108,110,111,326,334,343,344,349) | **must** if the fork ships a site (canonical URLs, og:, JSON-LD, author) |
| `site/es/index.html` | 28 (same line set) | **must** (same) |
| `site/llms.txt` | 14 (1,3,9,11,33,35,36,63,67,68,69,70,71,72) | **must** — it instructs agents to run `npx @ericrisco/rsc@latest onboard` |
| `site/sitemap.xml` | 8 (5,9,10,11,14,18,19,20) | **must** |
| `site/robots.txt` →22, `site/assets/rsc.js` →30 (GitHub stars API), `site/company-brain.svg` →2,27, `site/lanes.svg` →2,25, `site/og.svg` →1,4, `site/diagram.svg` →30, `site/cover.html` →5, `site/cover-anatomy.html` →3 | 11 | should |
| `tests/clone-bootstrap.test.js` | 9 (223, 261, 269, 270, 272, 275, 356, 366, 404) | **must** — asserts the exact `npx @ericrisco/rsc…` strings |
| `tests/positioning-docs.test.js` | 4 (18, 20, 21, 22) | **must** |
| `tests/update-notice-symptoms.test.js` →58,63; `tests/team-safe-default.test.js` →127,397 | 4 | **must** |
| `tests/apply.test.js` →105, `bare-command-updates.test.js` →10, `cli-usage.test.js` →42, `doctor-onboarding-readiness.test.js` →97, `fresh-install-coherence.test.js` →53, `manifest-divergence.test.js` →86, `rsc-cli.test.js` →211, `worktree-reaper.test.js` →336 | 8 | **must** |

**[I]** `tests/clone-bootstrap.test.js` and `tests/bare-command-updates.test.js` are an asset: they
already pin the identity strings, so renaming them turns into a mechanical, test-guarded refactor and
gives the fork a ready-made "never reinstall the parent" regression suite (§11's *"prevención de
reinstalación del padre"*).

### 5.3 The `rsc` command name

**[F]** `package.json:5-8` — `"bin": { "rsc": "scripts/rsc.js", "rsc-install": "scripts/install-apply.js" }`.
Confirmed on the registry (`bin: {'rsc': 'scripts/rsc.js', 'rsc-install': 'scripts/install-apply.js'}`).
**[I]** Keeping `rsc` as the bin name in a differently-scoped package is technically legal but
collides on any machine with both installed globally; a distinct bin name is the safer choice and
affects every "suggested command" row above.

### 5.4 **[Q] Open questions on identity**

1. `targets/memslop-offer.mjs:58` pipes `curl … raw.githubusercontent.com/ericrisco/mem-slop/main/install.sh | bash`.
   This is a **separate third-party repository owned by the parent author**, offered to users. Does the
   fork keep the offer (depending on the parent author's unaudited install script), fork it, or drop it?
2. `site/assets/rsc.js:30` fetches `api.github.com/repos/ericrisco/rsc-harness` for a star count —
   harmless but it reports the *parent's* popularity on the fork's site.
3. `manifest.json` is generated (`npm run manifest`); does the fork regenerate it, and does
   `scripts/build-manifest.js --check` in CI then enforce the renamed content?

---

## 6. Update semantics

### 6.1 Same-major background install — **[F] CONFIRMED**

`targets/auto-update.mjs:137-151`:

```js
    if (installed && SEMVER_ONLY.test(String(latest)) && isNewer(latest, installed)) {
      const newMajor = majorOf(latest) !== majorOf(installed);
      const auto = !existsSync(join(root, '.rsc', '.no-auto-update')) && !newMajor;
      const now = Date.now();
      const since = prior && prior.to === latest ? now - new Date(prior.startedAt).getTime() : Infinity;
      if (auto && since >= AUTO_RETRY_MS) {
        launchUpdate(root, latest, env);
        writeAutoState(root, { from: installed, to: latest, startedAt: new Date(now).toISOString() });
        say(`
===== rsc updating =====
rsc ${latest} is out — you have ${installed}. It is installing itself in the background now and
takes effect in the next session. Nothing to do.
```

And the design note, lines 54-62:

> *"Asking was not enough: the notice depended on an agent relaying it, and people kept running bugs
> that were already fixed. So a release in the SAME major installs itself; a new major can change how
> the harness works, and still asks. … The version is the exact one seen here, never `@latest` — what
> is published in between does not slip in. One attempt per version: a failure falls back to asking,
> and is retried at most once a day."*

`launchUpdate` (`:81-108`) spawns `npx -y @ericrisco/rsc@<version> sync --target <declaredTargets>`
(`:85-87`), `detached: true`, `stdio: ['ignore', log, log]` → `.rsc/auto-update.log`,
`windowsHide: true`, `env: { …, RSC_NO_UPDATE_CHECK: '1', RSC_AUTO_UPDATE_TO: version }`, then
`child.unref()`. Targets are re-validated against `/^[a-z0-9-]+$/` (`:78`).

### 6.2 Major requires confirmation — **[F] CONFIRMED**

`auto-update.mjs:138` sets `newMajor`; `:139` forces `auto === false`; `:162`:

```js
        else if (newMajor) why = 'It is a new major version: it can change how the harness works, so it asks first.\n';
```

and the resulting notice (`:179-181`) says *"ACTION: tell the user a new version is available and, if
they say yes, run: `npx @ericrisco/rsc@latest`"*. **[F]** No code path auto-installs across a major.

### 6.3 How "next session" activation is implemented — **[F] it is not a mechanism; it is a consequence**

There is **no activation step, no staging directory, no pending-version marker consumed at
session start.** The background `npx … sync` writes the new files immediately and in place. The
notice says *"takes effect in the next session"* only because the live session has already loaded
its skills and hook scripts (`auto-update.mjs:59-60`: *"it changes nothing in this session anyway:
the skills are already loaded"*).

What `session-start.mjs` actually does (**[F]**):

- `targets/session-start.mjs:9` — `import { updateNotice } from './auto-update.mjs';`
- `targets/session-start.mjs:316` — `if (!process.env.RSC_NO_UPDATE_CHECK) process.stdout.write(await updateNotice(root));`
- `targets/session-start.mjs:25-28` — the once-per-event claim:
  ```js
  const hook = readHookInput();
  const emitBody = hook.session_id
    ? claimOnce(`ss:${hook.session_id}:${hook.source || 'startup'}`)
    : true;
  ```

**[F] `hook-once.mjs` is NOT part of update activation.** Its documented purpose
(`hook-once.mjs:1-16`) is cross-*scope* output de-duplication: rsc can be wired in both
`~/.claude/settings.json` and `.claude/settings.json`, each scope runs its own hook copy, so the
always-on body would be injected twice. The marker lives in `join(tmpdir(), \`rsc-hooks-${uid}\`)`
at mode `0o700` (`:25-36`), the claim is an atomic `writeFileSync(file, …, { flag: 'wx' })` (`:72`),
and the window is `30_000` ms (`:67`) with a 24 h prune (`:21`, `:45-54`). Fail-open throughout
(`:85`).

**[F] The only thing that behaves like a one-shot activation notice** is the "already updated"
report, `auto-update.mjs:115-125`:

```js
    const prior = readAutoState(root);
    if (prior && !prior.reported && SEMVER_ONLY.test(String(prior.to)) && !isNewer(prior.to, installed)) {
      say(`
===== rsc updated =====
rsc updated itself in the background, from ${prior.from} to ${installed}. It is active in this session.
ACTION: tell the user in one line. Files of the harness may show as changed in git.
=======================
`);
      writeAutoState(root, { ...prior, reported: true });
```

It compares `.rsc/auto-update.json.to` against the freshly-read `.rsc/.version` and flips
`reported: true`. **[I]** This is a report, not a gate: the files were already active the moment the
background `sync` finished.

### 6.4 Opt-out — **[F]**

| Mechanism | Where recorded | Scope |
| --- | --- | --- |
| `.rsc/.no-auto-update` | marker file; `auto-update.mjs:139` reads it | project (machine copy) |
| `.rsc.json` → `optOuts: ['auto-update', …]` | `targets/opt-outs.js:21` lists `'auto-update'` in `PROJECT_OPT_OUTS`; `install-apply.js:212, 227` writes it from `localDecisions()`; `hydrateLocalDecisions()` (`:189-204`) rebuilds the marker in a clone | **team decision, travels in git** |
| `RSC_NO_UPDATE_CHECK=1` | env var; `auto-update.mjs:206`, `session-start.mjs:316`, `update-wiring.js:87` | one process |

**[F]** The disarmed state survives a clone: `install-apply.js:152-167` explains that *"a team that
disarmed the gitmoji guard found it armed again on the next checkout"*, which is why opt-outs moved
into the committed declaration. `targets/opt-outs.js:21` gives the reason for `auto-update`
specifically: *"installing new rsc releases alone: one machine ahead moves the team's catalogVersion"*.
**[F]** The opt-out turns auto-install off but **keeps the check** (`update-wiring.js:117`:
*"Always: being off is the runtime's `.no-auto-update`, and the check itself stays on."*) — the user
is still asked.

### 6.5 Races and partially-activated states — **[F] partially handled, with real gaps**

**Handled:**
- One attempt per version per 24 h: `AUTO_RETRY_MS = 24*60*60*1000` (`:66`), `since >= AUTO_RETRY_MS` (`:142`).
- An in-flight update is recognised for 15 min: `AUTO_RUNNING_MS = 15*60*1000` (`:65`),
  `else if (auto && since < AUTO_RUNNING_MS)` (`:152`) → *"still installing itself in the background"*.
- The child cannot recurse: `RSC_NO_UPDATE_CHECK: '1'` in its env (`:104`).
- Hook output de-dup across scopes: `claimOnce` (§6.3).
- `knowledge-sync` has a real lock: `.rsc/knowledge-sync.lock` with `LOCK_STALE_MS`
  (`knowledge-sync.mjs:143-165`).

**Gaps (all [F]):**

1. **No install-level mutual exclusion.**
   ```
   $ grep -rn -E "LOCK|lockfile|\.lock" scripts/install-apply.js scripts/rsc.js
   (no output)
   ```
   `applyInstall` has no lock. The background `npx … sync` runs concurrently with the live session and
   with any manual `rsc sync`, `rsc add`, or a second assistant's hook. They race on
   `.rsc/skills/`, `.rsc/.base-versions.json`, `.rsc/.version`, `.rsc.json` and each per-target state
   file. `writeBaseVersions` (`:49-52`) and `writeState` (`state.js:9-11`) are plain
   `writeFileSync` with **no** tmp+rename — unlike `knowledge-sync.mjs:132-136` and
   `ingest-move.js:54-56`, which both use tmp+`renameSync`. Last writer wins; a torn write is possible.

2. **A visible absence window per skill.** `ensureBase` (`:62-67`) does
   `if (stale && existsSync(dest)) rmSync(dest, { recursive: true, force: true });` *before*
   `cpSync`. During that window `.rsc/skills/<id>/` does not exist, and every assistant's symlink into
   it dangles. With 274 possible skills and a `cpSync` each, the aggregate window is non-trivial.

3. **`.rsc.json` is rewritten by the background child.** `recordInManifest` (`:371`) writes the
   committed declaration from a detached process while the user may be editing or committing. The
   notice at `:121` admits the symptom: *"Files of the harness may show as changed in git."*

4. **No verification after the background install.** §4's table: `sync` has no `verifyOnboarding`
   equivalent and no rollback. A half-finished background sync is detected only later, by
   `repair`'s `dangling-links` or `doctor`.

5. **`writeAutoState` is best-effort.** `:72-74` swallows every error. If `.rsc/auto-update.json`
   cannot be written, `prior` stays `null`, `since` is `Infinity`, and the update relaunches on the
   next session — repeatedly.

**[Q]** Is the 15-minute `AUTO_RUNNING_MS` window ever exceeded by a real `npx` cold install of a
274-skill package on a slow link? If so, a second `launchUpdate` fires while the first is still
copying — two concurrent, unlocked `applyInstall` passes over the same tree. Not reproducible
read-only; needs a timed experiment post-approval.

---

## 7. Clone bootstrap: `.rsc.json` committed, no `.rsc/`

**[F] Mechanism.** `targets/clone-bootstrap.mjs` is materialised at `.claude/rsc-bootstrap.mjs`
(`install-apply.js:81`, annotated *"Committed, not machine state — and therefore the one entry here
that, if omitted, leaves an executable behind in a tree the user pushes"*) and is rescued from any
blanket `.claude/` ignore (`install-apply.js:459`). The committed wiring in `.claude/settings.json`
calls **it**, not the real hook scripts, with argv `<mode> <root> <target> [real args…]`
(`clone-bootstrap.mjs:441-443`).

**[F] Why it exists** (`:9-14`): *"the committed wiring points into the directory that does not
travel, so the first session in a clone runs seven hooks against seven files that are not there. The
person does not get a warning, they get the module loader's stack trace — and three of the seven are
shell guards, so they get it again on every shell call."*

**[F] Expected behaviour on a clean clone with `.rsc.json` committed and no `.rsc/`:**

1. `bootstrap(target, root, mode)` (`:391`) computes `mounted = existsSync(target)` → **false**
   (the real hook script is under `.rsc/`), and `declined = existsSync('.rsc/.no-harness')` → false.
2. `if (declined) return;` → not taken. `if (mode === 'guard') return remindOnProtectedAction(root);`
   → for the shell guards, **nothing is said now**.
3. `if (mode !== 'announce') return;` → only the **one** SessionStart hook continues
   (`:412-413`: *"Only one hook per session opens with the offer, so the person is told once and not
   seven times"*).
4. `composeOffer(readManifest(root))` (`:218-264`) prints, verbatim:
   - *"This project declares a harness that is not built on this machine, so the assistant cannot see
     any of the project's skills right now. Nothing is broken and nothing was changed — the harness
     simply does not travel through git, by design."*
   - `WOULD INSTALL: @ericrisco/rsc@<catalogVersion> — <N> skill(s) as pinned in .rsc.json[, plus <M>
     written by the team (never overwritten)]`
   - *"It writes .rsc/ and the skill entries; it never touches anything written by hand."*
   - `ACTION: ask the user whether to build it, in one line, and continue with their request either
     way … If there is nobody to ask (CI, an unattended run), do NOT install: say it is missing and
     carry on. On a yes, run EXACTLY: npx @ericrisco/rsc@<version> sync`
   - *"(the version is the one this project pinned. Do not substitute `@latest`: a release nobody on
     this team adopted is not an upgrade, it is two people quietly drifting apart.)"*
   - *"On a no, create .rsc/.no-harness so this is not offered again on this machine."*
5. **It writes nothing in the project.** The "already reminded" marker goes to
   `join(tmpdir(), \`rsc-${uid}\`)` (`:330-331`), created with `wx` (`:339`), *"NEVER inside the
   project. The user's tree stays untouched until they consent"* (`:313-316`).
6. Later in that same session, the **first** protected command (`git commit|cz|push|merge`,
   `git switch|checkout main|master`, `npm publish`, `rm -rf` — `PROTECTED`, `:301-310`) triggers
   exactly one `PreToolUse` reminder via `hookSpecificOutput.additionalContext` (`:375-383`),
   *"and this is the last time it will be mentioned"*. No `permissionDecision` is ever emitted —
   *"informing someone is not denying them, and nothing here may ever cost a person their tool call"*
   (`:373-374`).

**[F] The other two states:**
- *Mounted but stale* (a teammate changed `.rsc.json` and git brought it): `evaluateHarness` (`:131-161`)
  compares declaration against disk using `existsSync('.rsc/skills/<id>')` for catalog skills and a
  12-directory sweep for own skills (`OWN_DIRS`, `:144-148`); verdict `behind` →
  `composeDivergence` (`:180-212`) reports `MISSING`, `DISARMED BY THE TEAM, still armed here`,
  `DECLARED developer tier`, and `ALSO DECLARED, written by the team … rsc never installs or
  overwrites them`, then delegates to the real hook.
- *Unreadable `.rsc.json`*: `{ offers: false }` + *"Nothing has been installed and nothing was
  changed. Someone on the team needs to fix .rsc.json"* (`:220-229`).

**[F] Hardening worth preserving:** input is allowlisted, not type-checked — `ID = /^[a-z0-9][a-z0-9._-]{0,63}$/`
(`:94`) because *"`.rsc.json` travels through `git pull`, so its contents are written by anyone who can
open a pull request … A newline closes rsc's own `=====` frame and opens a forged one; a `;` turns the
command we tell someone to run EXACTLY into two commands"* (`:86-93`). `safeVersion` is applied twice,
at parse and at use (`:49-57`). `sameFile()` (`:432-439`) resolves symlinks because the idiomatic
`import.meta.url === pathToFileURL(process.argv[1]).href` check *"would make EVERY hook a silent
no-op. Including the danger guard."*

**[F] The retirement map and the opt-out list are duplicated into this file** (`:46`, `:98`) because it
cannot import anything; `tests/retired-skills.test.js` and a sibling test hold the copies equal
(`:41-43`). **[I] The fork must keep three copies of the identity in sync**: `targets/opt-outs.js`,
`targets/clone-bootstrap.mjs`, and `scripts/lib/retired-skills.js`.

**[Q] §11 "clon limpio" blocker:** a consumer repo that was ever installed by the **parent** carries a
committed `.claude/rsc-bootstrap.mjs` with `PACKAGE = '@ericrisco/rsc'`. On a fresh clone of that
repo, the clean-clone offer will tell the user to run `npx @ericrisco/rsc@<v> sync` — **reinstalling
the parent**. How does the fork migrate an existing consumer? Candidates: (a) the fork's `sync`
detects a parent-named bootstrap and rewrites it; (b) the fork's bootstrap refuses to print a command
whose package name is not its own; (c) both. This is the single most likely mechanism for the failure
§10 exists to prevent.

---

## 8. CI and release

**[F] `.github/workflows/ci.yml`** (31 lines): `on: [push, pull_request]`, `ubuntu-latest`,
Node 22, `npm ci`, then five gates — `npm run validate`, `npm run manifest:check`, `npm test`,
`bash scripts/eval-lint.sh`, `npm run drift:check` — plus a `cleanup gate` (`:24-31`) grepping for
retired marketplace fingerprints. **No `permissions:` block** → repository/organisation default
applies.

**[F] `.github/workflows/pages.yml`** (44 lines): `permissions: { contents: read, pages: write, id-token: write }` (`:14-17`).

**[F] `.github/workflows/release.yml`** (144 lines):

- Triggers: `push` to `main`, plus `workflow_dispatch` with a `bump` choice (`patch`/`minor`/`major`,
  default `patch`) (`:16-24`).
- `concurrency: { group: release, cancel-in-progress: false }` (`:27-29`).
- `permissions: { contents: write, id-token: write }` (`:31-33`) — `contents: write` to push the
  bump commit and tag, `id-token: write` for *"npm provenance via OIDC"*.
- Gates before any bump (`:50-60`): `validate`, `manifest:check`, `npm test`, `eval-lint.sh`,
  `originality:check`.
- Identity: `git config user.name "Eric Risco"` / `user.email "erisco@icloud.com"` (`:64-66`).
- **Registry-as-source-of-truth reconciliation** (`:72-82`): `PUBLISHED="$(npm view @ericrisco/rsc version …)"`,
  takes `sort -V | tail -1`, and realigns `package.json` if the registry is ahead. Rationale at
  `:67-71`: a previous run that published and tagged but failed to push left the pipeline *"wedged
  permanently"*.
- Bump (`:86-104`): a PR that already set a version above the registry is published as-is; otherwise
  `npm version $BUMP --no-git-tag-version`. Commit `🔖 chore(release): $VERSION [skip ci]`.
- **Publish** (`:107-110`):
  ```yaml
      - name: Publish to npm
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
  ```
- Push with rebase-and-retry ×3 (`:115-128`), **then** tag (`:132-136`) — *"a tag never exists without
  its commit"*.
- GitHub Release via `gh release create … --generate-notes` with `GH_TOKEN: secrets.GITHUB_TOKEN` (`:139-144`).
- `package.json:33` — `"prepublishOnly": "npm run manifest && npm run validate && npm run drift:check && npm run originality:check"`;
  `:32` — `"version": "npm run manifest && git add manifest.json"`.

### Assessment against §10

| §10 requirement | Current state | Fork must change |
| --- | --- | --- |
| **npm provenance** | **[F] configured and working**: `--provenance` + `id-token: write`; registry confirms an attestation (§9) | nothing — **reuse as-is** |
| **Trusted publishing (tokenless)** | **[F] NOT used.** A long-lived `secrets.NPM_TOKEN` automation token is still the credential (`:110`) | **should migrate** to npm Trusted Publishing (OIDC-only, no `NPM_TOKEN`), which removes the only long-lived secret |
| **Permisos mínimos** | **[F] release: `contents: write` + `id-token: write`** — minimal for what it does, but `contents: write` on a workflow triggered by every `push` to `main` is broad. **[F] `ci.yml` declares no `permissions:` at all** → inherits the repo default, which may be read-write | **must**: add `permissions: { contents: read }` to `ci.yml`; consider splitting release into a gated job (needs manual approval / tag trigger) so `contents: write` is not granted on every merge |
| **2FA for human access** | **[F] not observable from the repository.** Nothing in the repo configures or documents it; `SECURITY.md` is a vulnerability-reporting policy only | **must**: enable 2FA on the npm account and GitHub org, and enforce *"require 2FA and automation tokens"* on the new scope. **[Q]** unverifiable read-only — record as a configuration obligation, not a finding |
| **Verify identity, version and integrity of the artefact before activating** | **[F] NOT implemented on the consumer side.** `auto-update.mjs` fetches `/latest`, compares semver, and hands the version string to `npx -y`. No attestation check (`npm audit signatures` / `gh attestation verify`), no integrity check, no package-name assertion beyond the hard-coded literal | **must build** — this is the §10 "antes de activar: verifica identidad, versión e integridad" gap |
| **Distinguish central from local validations** | **[F] central gates are strong** (five in CI, five in `prepublishOnly`). **[F] local validation after an update is absent** — no post-sync `doctor` run, no governance-compatibility check | **must build** |

**[F] A further supply-chain note:** `launchUpdate` runs `npx -y @ericrisco/rsc@<version>`. The `-y`
suppresses the install prompt, and `<version>` comes from the registry response. The package name is
a literal, so a typosquat cannot be injected; but **any** published version in the same major is
installed and executed without verification. **[I]** A compromised publish token on the fork's scope
would auto-execute on every consumer within one session. Trusted publishing + an attestation check
before `launchUpdate` closes both halves.

---

## 9. Published package reality (read-only registry query)

**[F]** `curl -sS https://registry.npmjs.org/@ericrisco%2frsc`, parsed with `python3 -I`:

```
dist-tags:        {'latest': '3.7.1'}
version count:    178
first / last:     0.1.5 / 3.7.1
majors present:   ['0', '1', '2', '3']
license:          MIT
maintainers:      ['ericrisco']
latest dist keys: ['attestations','fileCount','integrity','shasum','signatures','tarball','unpackedSize']
attestations:     {"url": "https://registry.npmjs.org/-/npm/v1/attestations/@ericrisco%2frsc@3.7.1",
                   "provenance": {"predicateType": "https://slsa.dev/provenance/v1"}}
signatures:       present
repository:       git+https://github.com/ericrisco/rsc-harness.git
author:           {'name': 'Eric Risco'}
bin:              {'rsc': 'scripts/rsc.js', 'rsc-install': 'scripts/install-apply.js'}
published:        2026-10-31T20:46:19.813Z
```

**[F] Observations:**
- **Exactly one dist-tag** (`latest`). No `next`, `beta` or per-major tag. **[I]** So a consumer on
  major 2 has no channel to track; `auto-update` compares against `latest` only, and a major bump
  simply starts asking everyone. The fork may want per-major tags if it ever maintains two majors.
- **Provenance is real**, not just configured: a SLSA provenance v1 attestation is published for
  3.7.1, consistent with `npm publish --provenance` + `id-token: write`.
- **Registry signatures present** (`dist.signatures`) — the standard npm registry signing, independent
  of provenance.
- **178 published versions** vs **178 distinct release commits** is not checked here; the repo's
  `package.json` version `3.7.1` matches `dist-tags.latest` exactly, and the base commit is the 3.7.1
  release commit, so **the audited tree is byte-adjacent to what is published**.
- **One maintainer** (`ericrisco`). **[Q]** 2FA status is not exposed by the registry API and cannot
  be verified read-only.

---

## Table: parent-identity references (coordinator summary)

The full `file:line` enumeration is in §5.2. Roll-up:

| Category | Refs | Files | Verdict | Highest-risk entries |
| --- | --- | --- | --- | --- |
| **Updater** | 7 | `targets/auto-update.mjs`, `scripts/lib/upgrade.js`, `scripts/rsc.js` | **must** | `auto-update.mjs:85` (install argv), `:132` (registry URL), `upgrade.js:15` (`spawnSync npm i -g`) |
| **Bootstrap** (committed into consumer repos) | 2 | `targets/clone-bootstrap.mjs` | **must** | `:33` `const PACKAGE = '@ericrisco/rsc'` — **the one that survives in users' git history** |
| **Hooks** (materialised under `.rsc/`) | 20 | `session-start.mjs`, `branch-guard.mjs`, `sello.mjs`, `memory.js` | **must** | `session-start.mjs:110,182,233,292,293`; `sello.mjs:360-386` |
| **Recovery / suggested commands** | 53 | `scripts/rsc.js` (31), `scripts/doctor.js` (14), `onboarding-apply.js` (3), `audit.js` (1), `commands.js` (4) | **must** | `rsc.js:130` recovery string, `onboarding-apply.js:96` `recoveryCommand()` |
| **Skills** (catalog content) | 85 | 29 files | **must** for the 12 command-bearing files + 6 eval files; **should** for the rest | `skills/suggest/SKILL.md` ×10 (always-on body); `skills/init/references/recommend-skills.md` ×15 |
| **Docs / site** | 89 | 12 | **must** for `llms.txt`, both `index.html`, `sitemap.xml`; **should** for SVG/HTML assets | `site/llms.txt:36,63` — instructs agents to run the parent's onboard |
| **Root metadata** | 34 | `package.json`, `README.md` (24), `LICENSE`, `SECURITY.md`, `.gitignore`, `manifest.json` | **must** for `package.json:2,60,63,66` + `SECURITY.md:7`; **attribution** for `LICENSE:3`; README is a §13 rewrite | `package.json:2` `"name"` |
| **Workflows** | 3 | `.github/workflows/release.yml` | **must** | `:65` git identity, `:74`/`:90` `npm view @ericrisco/rsc` |
| **Tests** | 25 | 12 | **must** (they pin the strings; an asset for the §11 anti-reinstall suite) | `tests/clone-bootstrap.test.js` ×9, `tests/positioning-docs.test.js` ×4 |
| **TOTAL** | **316** | **73** | | |

Attribution to preserve (MIT §3 + §13 *"Relación y atribución al padre"*): `LICENSE:3`, the six
third-party licence/notice files listed in §0, and a README section crediting
`github.com/ericrisco/rsc-harness` and Eric Risco.

---

## Table: write paths under the documentation root (`02-DOCS/`)

| # | Code path | Exact site | Operation | Trigger | Risk to `02-DOCS/wiki/skills/<name>/README.md` |
| --- | --- | --- | --- | --- | --- |
| 1 | `knowledge-sync` **apply incoming** | `targets/knowledge-sync.mjs:601` `git checkout tip -- …` | **overwrite** any file under `02-DOCS/wiki/` | hook, on user prompt | **HIGH** — a committed, locally-untouched customisation is replaced by the `rsc/knowledge` version. Guarded only by `mine === base && committed === base` (`:580`); a `clash` is reported, not forced (`:605-607`) |
| 2 | `knowledge-sync` **apply incoming** | `targets/knowledge-sync.mjs:602` `git rm --quiet -- …` | **delete** | same | **HIGH** — a customisation deleted on the exchange branch is deleted here and the delete is auto-committed `--no-verify` (`:603`). Recoverable from git history only |
| 3 | `knowledge-sync` **commit local** | `targets/knowledge-sync.mjs:317-320` `git add -A -- …` + `git commit --no-verify --only` | **auto-commit** | hook, end of turn | **MEDIUM** — the user's in-progress customisation edits are committed without being asked. No content loss; loss of control over commit boundaries |
| 4 | `knowledge-sync` **FTD close** | `targets/knowledge-sync.mjs:837` `writeFileSync(join(root, f), text)` | **overwrite** | `post-merge` git hook | **LOW** — scoped by `isFtdDoc` (`:632`) to `^02-DOCS/wiki/ftd/[^/]+\.md$` only |
| 5 | `writeOnboardingDocuments` | `scripts/lib/onboarding-apply.js:192` `writeFileSync(join(dir,'installation-plan.md'), docs.installation)` | **unconditional overwrite** | `onboard`, `reassess` | **LOW for §5** (different path), **HIGH for `wiki/harness/`** — any hand edit to `installation-plan.md` is lost on every re-onboard |
| 6 | `writeOnboardingDocuments` | `scripts/lib/onboarding-apply.js:190` `writeFileSync(profilePath, mergeProfile(…))` | **merge-overwrite** | same | MEDIUM — merge is a model-free function but still rewrites the whole file |
| 7 | `writeOnboardingDocuments` | `scripts/lib/onboarding-apply.js:193-196` | **append-only, guarded** | same | **NONE** — `decisions.md` is append-only and idempotent per `planId`. Good pattern to copy |
| 8 | onboarding rollback | `scripts/lib/onboarding-apply.js:342` `restoreBackup(transaction.id)` → `backups.js:100` `rmSync(absPath, {recursive:true, force:true})` | **delete / revert** | **failed** `verifyOnboarding` | **MEDIUM** — normally scoped to three files (`onboarding.js:328-330`). **But** the `evidence.root`-falsy fallback (`onboarding.js:336`) and an older receipt's `governedPaths` can put the **directory** `02-DOCS/wiki/harness/` in the snapshot, and then a rollback `rmSync -r`s it |
| 9 | `ensureConstitutionDraft` | `scripts/lib/constitution-draft.js:148-154` `mkdirSync` + `writeFileSync(…, { flag: 'wx' })` | **create-only** | `onboard` with SDD | **NONE** — `wx` + `EEXIST` swallow + per-segment symlink refusal (`:136-142`). **The model for the fork** |
| 10 | `ingestFile` | `scripts/lib/ingest-move.js:84` `mkdirSync(rawDir)`, `:88` `copyFileSync`, `:93` `unlinkSync(abs)` | **create + delete original** | `rsc ingest <file>` | **NONE** — refuses anything already under `02-DOCS`/`01-TOOLS` (`PROTECTED_DIRS`, `:16`); deletes the original only after a sha256 match (`:89-90`) |
| 11 | `recordInLedger` | `scripts/lib/ingest-move.js:54-56` tmp + `renameSync` → `02-DOCS/wiki/.ingested.json` | **atomic rewrite** | same | **NONE** — a dedicated ledger file |
| 12 | `purgeReport` | `scripts/install-apply.js:942` `if (withDocs) drop(join(cwd,'02-DOCS'), true)` | **recursive delete of the whole doc root** | `rsc purge --with-docs` only | **CATASTROPHIC but explicit** — default keeps it and reports *"your knowledge base. Add --with-docs to remove it too."* (`:943`). No backup is taken (`:775-776`) |
| 13 | `excludePersonalProfile` | `scripts/lib/onboarding-apply.js:181` `appendFileSync(<git info/exclude>, '/02-DOCS/wiki/harness/user-profile.md')` | writes **about** `02-DOCS/`, not **in** it | `sync`, `onboard` | **NONE** for content; **[I]** note that this one file is deliberately kept out of git |
| 14 | `worktree-reaper` memory move | `targets/worktree-reaper.mjs:418-421` — sources include `02-DOCS/raw/worklog/.rsc-memory`, target `join(root,'02-DOCS','raw','worklog','.rsc-memory')` | **move** | `post-merge` | **NONE** — scoped to `raw/worklog/.rsc-memory` |
| 15 | **model-driven** `harness` skill maintenance | `skills/harness/SKILL.md:165,178,187-189,282`; `skills/harness/references/wiki-protocol.md` (Maintenance Pass, Deep Improve, Cascade Updates) | rewrite / reorganise / regenerate under `02-DOCS/wiki/` | agent judgement | **MEDIUM, model-dependent** — the rules say *"never delete user content"*, *"merging — don't duplicate, don't delete"*, and require a literal-string confirmation before folder deletion. **These are §6 "reglas dependientes del modelo", not code guarantees** |

**Three structural facts the coordinator needs:**

1. **[F]** `sync`, `repair` and `doctor` — the three operations §5 names — write **nothing** under
   `02-DOCS/`. The §5 preservation requirement is satisfied *by those three today*.
2. **[F]** The real exposure is `knowledge-sync` (rows 1-3), which is **on by default**
   (`knowledge-sync.mjs:13`) and auto-syncs the whole `02-DOCS/wiki/` prefix. `02-DOCS/wiki/skills/`
   lands inside it.
3. **[F]** `purge --with-docs` (row 12) is the only total-loss path and it is explicit and documented.

---

## Implications for sections 9 and 10

### What the fork can reuse as-is

**[F] Reusable, no changes needed:**

1. **The declaration/inventory split.** `.rsc.json` as ids-only, stable key order, one entry per line
   (`manifest-file.js:10-14, 56-67`). Merge-conflict-friendly, platform-neutral, idempotent bytes.
2. **Unreadable ≠ absent.** `manifest-file.js:24-30` throws rather than overwriting; `clone-bootstrap.mjs:63-80`
   returns `{ state: 'unreadable', reason }`. **Directly satisfies §5's "un archivo existente pero
   ilegible, inválido o contradictorio no debe tratarse silenciosamente como ausente"** — the fork
   should copy this exact pattern for `02-DOCS/wiki/skills/<name>/README.md`.
3. **Ownership proven by state, not by name.** `install-apply.js:276-278`, `repair.js:92-99`,
   `divergence.js:23-24`. The harness never touches what it did not record.
4. **Provenance by frontmatter.** `origin: risco` + `doctor.js:165-167`'s deliberate bias toward
   "the user's". The fork needs its own `origin:` value and must decide how to read upstream's
   (see risk 3 below).
5. **The three-class finding model in `repair.js`** (`restore` automatic, `change` always asked) and
   its install-before-unwire ordering (`:150-158`).
6. **The transaction + verify + rollback + exact-recovery-command pattern** in
   `applyAcceptedOnboarding` (`onboarding-apply.js:282-344`). This is the §10 *"una verificación
   fallida debe conservar la instalación funcional y explicar el bloqueo"* pattern, already built —
   it just needs extending to `sync`.
7. **`constitution-draft.js:148-154`'s create-only `wx` + symlink-refusal** — the correct template for
   scaffolding a customisation file that must never clobber the user's.
8. **npm provenance** (`release.yml:108` + `id-token: write`), confirmed live on the registry.
9. **The path-traversal and symlink hardening** throughout `backups.js` (`safeJoin`/`safeRelative`),
   `onboarding-apply.js:57-74`, `clone-bootstrap.mjs:94-99, 432-439`.
10. **`tests/clone-bootstrap.test.js`, `tests/positioning-docs.test.js`, `tests/bare-command-updates.test.js`,
    `tests/update-notice-symptoms.test.js`** — 25 assertions already pinning identity strings; renaming
    them yields the §11 *"prevención de reinstalación del padre"* suite nearly for free.

### What the fork must build

**For §9 (manual upstream maintenance):**

1. **A resumable entry point.** Nothing exists today. There is **no `upstream` remote handling, no
   "last incorporated commit" record, no integration state file** anywhere in the repository — the
   repo has no concept of being a fork. §9's ten steps (query upstream → compare → report no-change →
   prepare branch/worktree → analyse impact → integrate → apply governance → validate → fix → deliver
   evidence) are entirely new. The durable state must live in files + git (§12), e.g. under
   `docs/fork/` alongside `LEDGER.md`.
2. **A deterministic, idempotent identity-rename transform** covering all 316 references in 73 files,
   because 85 of them are inside `skills/` and 6 of those are `evals/cases.yaml` files that gate CI.
   Upstream adds parent-named commands to skills routinely, so this transform must run on every
   integration, not once.
3. **A triple-copy consistency gate.** `targets/opt-outs.js` ↔ `targets/clone-bootstrap.mjs:46` ↔
   `scripts/lib/retired-skills.js` ↔ `clone-bootstrap.mjs:98` are duplicated by necessity and held
   equal only by tests. The fork adds its own identity to that set.
4. **A `generatedHookFiles` drift gate.** `install-apply.js:73-75` warns that a file `wireHook` writes
   but `generatedHookFiles` omits is *"silently absent from the snapshot, so `rsc restore` cannot bring
   it back"*. It is hand-maintained; upstream changes to `wireHook` can silently break recovery.

**For §10 (automatic consumer updates):**

5. **Artefact verification before activation.** `auto-update.mjs` today does
   `fetch(/latest)` → semver compare → `npx -y <pkg>@<version> sync`. §10 requires verifying identity,
   version and integrity first. Nothing checks the attestation, the integrity hash, or that the
   resolved package is the fork's. Candidate: `npm audit signatures` / `gh attestation verify` against
   the published provenance (which the fork will have, since the pipeline already produces it).
6. **A consumer-side migration that stops the parent being reinstalled.** The committed
   `.claude/rsc-bootstrap.mjs` with `PACKAGE = '@ericrisco/rsc'` lives in consumers' git history. The
   fork's `sync` must detect and rewrite it, and the fork's bootstrap should refuse to print an install
   command whose package name is not its own.
7. **Verification + rollback for `sync`.** Today only `onboard` verifies and rolls back; `sync` — the
   operation the auto-updater runs — has neither.
8. **Mutual exclusion for `applyInstall`.** No lock exists. `knowledge-sync.mjs:143-165` already
   implements a correct stale-tolerant lock in this codebase; the pattern can be lifted.
9. **Atomic writes for `.rsc/.base-versions.json`, `.rsc/.version` and per-target state.** Currently
   plain `writeFileSync`; `knowledge-sync.mjs:132-136` and `ingest-move.js:54-56` already use
   tmp + `renameSync` in the same repo.
10. **Governance-compatibility and local-decision review on update.** §10 requires checking governance
    compatibility and identifying local decisions needing review before activating. Nothing comparable
    exists; `.rsc.json` has no governance-contract version field.
11. **`permissions: { contents: read }` on `ci.yml`** (currently absent) and, ideally, npm Trusted
    Publishing to eliminate `secrets.NPM_TOKEN`.
12. **The customisation path itself.** `02-DOCS/wiki/skills/<name>/README.md` is read and written by
    **nothing** upstream. Discovery, reading, validation, precedence and the §8 metadata (skill +
    version/commit reviewed, decisions, scope, evidence, exceptions, approval state, review date) are
    all new.

### What is genuinely risky

1. **`knowledge-sync` can overwrite and `git rm` the fork's customisation files, autonomously, on
   every turn.** (`knowledge-sync.mjs:601-603`.) The customisation path sits inside the
   auto-synced `02-DOCS/wiki/` prefix. The local-modification guard (`:580`) protects *dirty* files;
   a committed, clean customisation is fair game. **This is the single highest-value risk in Track B
   and it bears directly on §5's "no deben perderse durante instalación, `sync`, `repair`,
   actualización o reconstrucción de un clon".** Options: exclude a customisation sub-prefix from
   `KNOWLEDGE`; treat the governance contract as `PERSONAL`-like; or accept team sync and rely on git
   history plus a divergence report. Each has a §6 precedence consequence.

2. **The committed bootstrap is a permanent parent pointer in consumers' repositories.**
   `clone-bootstrap.mjs:33` + `install-apply.js:459` (rescued from `.gitignore`). Renaming the fork's
   sources does **not** fix repos already installed by the parent. Any §11 "clon limpio" test run
   against such a repo will reinstall the parent. **Treat as the primary §10 failure mode.**

3. **`origin: risco` is the only ownership signal, and the fork must change it or inherit it.**
   `doctor.js:168`. If the fork keeps `origin: risco`, upstream-named skills stay "ours" but the fork's
   identity is wrong. If the fork changes it, every existing consumer's installed skills suddenly read
   as **the user's own work** (`doctor.js:165-167` fails toward "the user's"), so the fork would stop
   updating them — a silent, total freeze of skill content. A migration that rewrites the installed
   bases' frontmatter, or dual-value acceptance, is required.

4. **An unlocked background `applyInstall` races the live session** and rewrites the committed
   `.rsc.json`, while `ensureBase`'s `rmSync`-then-`cpSync` opens a per-skill absence window
   (`install-apply.js:62-67`). With `AUTO_RUNNING_MS = 15 min` and 274 possible skills, a slow install
   can be relaunched while the first is still copying. **[Q]** needs a timed experiment.

5. **Backups grow without bound** (`backups.js`, no retention) and `purge` destroys all of them with
   `.rsc/`. A fork that promises bounded recovery per §10 must add retention *and* decide whether
   recovery artefacts may live inside the directory a purge deletes.

6. **The §5 path violates the upstream wiki protocol's "one level only" rule**
   (`wiki-protocol.md:81-82`). Ignoring it puts the fork's contract in permanent tension with the
   model-driven `harness` maintenance passes that index, lint and score `wiki/` — passes that are
   **model-dependent** and therefore cannot be made safe by code alone (§6).

7. **The documentation root is not configurable** (§0) — 90+ hard-coded `'02-DOCS'` literals. Making
   it configurable touches `install-apply.js`, `onboarding*.js`, `constitution-draft.js`,
   `ingest-move.js`, `knowledge-sync.mjs`, `worktree-reaper.mjs`, `session-start.mjs`,
   `worklog-checkpoint.mjs`, `copy-rules.mjs`, `danger-guard.mjs`, `ftd-nudge.mjs`,
   `session-memory-core.mjs`, `team-safe-start.mjs`, `auto-update.mjs:209`, plus ~90 skill documents.
   **[I] Recommend scoping it out of v1** and documenting the root as fixed.

### BLOCKERS

**[F] No licence blocker.** MIT with a single copyright holder; `modify`, `merge`, `publish`,
`distribute`, `sublicense` and `sell` are all granted. The only condition is §3 (retain the notice),
satisfied by keeping `LICENSE:3` and the six third-party notices. Renaming and republishing under a
new scope is permitted. **[Q]** Track A should confirm the six third-party licences
(`skills/design/IMPECCABLE-LICENSE.txt`, `skills/design/engine/LICENSE`,
`skills/ux/upstream/*/LICENSE`, `skills/open-weights/references/licenses.md`,
`skills/terms-conditions/references/notices-and-aup.md`) carry no redistribution restriction.

**[F] No Track-B blocker to the plan.** Nothing found prevents proceeding. The two items that would
become blockers *if left unresolved during implementation* are risks 1 and 2 above (knowledge-sync
overwriting customisations; the committed parent-named bootstrap), and risk 3 (the `origin:` migration).

**[Q] Items requiring a decision from the user before Stage 1 closes:**
1. Fork scope + package name + bin name (does `rsc` stay?).
2. Whether the fork ships a `site/` at all (89 refs; dropping it removes the largest category).
3. Keep, fork or drop the `mem-slop` offer (`memslop-offer.mjs:58`, a third-party install script from
   the parent author).
4. The customisation path vs the wiki protocol's one-level rule, and whether that path is excluded
   from `knowledge-sync`.
5. Migration policy for consumers already installed by the parent (bootstrap rewrite + `origin:`).
6. Whether to adopt npm Trusted Publishing (removes `NPM_TOKEN`) or keep a token.
