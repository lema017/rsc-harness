# Stage 0 — Independent review

**Reviewer:** independent Stage 0 reviewer (requirement §12: reviewers receive code, requirements and
criteria without the author's conclusions before issuing their initial assessment).
**Repository:** `/Users/home/Development/rsc-harness-fork`
**Base commit:** `6f7edd31d109b7f0211d637e2d084724f6dd8e26` — `🔖 chore(release): 3.7.1 [skip ci]`
**Package at base:** `@ericrisco/rsc@3.7.1`, MIT, author Eric Risco.
**Mode:** read-only. No commits, no pushes, no remote changes, no global installs. The only file this
review wrote is this one.
**Isolation for every command run below:**
`cd /Users/home/Development/rsc-harness-fork && HOME="$PWD/.fork-tmp/home" XDG_CONFIG_HOME="$PWD/.fork-tmp/home/.config" TMPDIR="$PWD/.fork-tmp/tmp" <command>`
(`timeout(1)` is absent on this macOS host, so foreground timeouts were applied by the harness
running the commands, not by the shell.)

**Convention used throughout:** **FACT** = established by a command I ran or a line I read in this
tree, with the command or `file:line` given. **INFERENCE** = my reasoning on top of facts, labelled.
**NOT VERIFIED** = I could not establish it here (no network, no API key, no full suite).

Phase 1 below was written before opening anything under `docs/fork/audit/` or `docs/fork/LEDGER.md`.

---

# PHASE 1 — Independent verification

## Q1. Catalogue size and distribution source

**FACT — 274 skills.**
```
ls -1 skills | wc -l                      -> 274
find skills -maxdepth 2 -name SKILL.md | wc -l -> 274
npm run manifest:check                    -> "manifest OK (274 skills, 34 agents, 53 commands)"
node -e '...manifest.json...'              -> skills len: 274, counts {"skills":274,"agents":34,"commands":53,"fixedCommands":20}
```
Every one of the 274 directories carries a `SKILL.md`; there are no skill-less directories and no
nested `SKILL.md` outside the top level (`tests/ux-upstream.test.js:42-44` asserts the latter for `ux`).

**FACT — `skills/<id>/` is the distribution source.**
- `package.json` `files` ships `skills` (plus `scripts`, `targets`, `schema`, `manifest.json`).
- `scripts/install-apply.js:62-64` — `ensureBase()` does
  `cpSync(join(ROOT, 'skills', id), dest, { recursive: true })` where `dest = baseDir(id, cwd)`.
- `targets/index.js:11-13` — `baseDir(id, cwd) = <cwd>/.rsc/skills/<id>`.
- `targets/index.js:20-32` — `linkOrCopy()` then points each assistant's skill folder at that one
  base: relative `symlink` on macOS/Linux, real `cpSync` on Windows.

So the chain is `skills/<id>/` → `.rsc/skills/<id>/` → per-assistant pointer. The earlier finding in
§3 ("the installer copied content to `.rsc/skills/<id>/`") is confirmed, with the refinement that
`.rsc/skills/` is a *shared single copy* and the assistants get links, not copies, except on Windows.

**FACT — the count must not be hard-coded, and upstream itself does not hard-code it**
(`scripts/lib/capabilities.js` and `install-apply.js` enumerate from disk), but two *comments* and
one README line do carry stale numbers — see Q2.

---

## Q2. How many assistants/targets — exact number

**FACT — 18.** Established by executing the module, not by counting the table by eye:

```
node --input-type=module -e "import {TARGETS,TARGET_IDS} from './targets/index.js'; ..."
TARGETS length: 18
TARGET_IDS length: 18
claude, cursor, codex, opencode, deepseek, amp, jules, zed, gemini, antigravity,
copilot, windsurf, cline, roo, continue, junie, kiro, aider
```

Evidence in source: `targets/index.js:38-62` (`SPEC`, 18 rows), `targets/index.js:68-87` (`TARGETS`,
the wizard list, 18 rows), `targets/index.js:188` (`export const TARGET_IDS = Object.keys(SPEC)`).

**FACT — only 3 adapters serve those 18** (`targets/index.js:64`):
`ADAPTER = { claude: claudeAdapter, cursor: cursorAdapter, md: mdAdapter }`.
`claude` → JSON hooks + linked dirs; `cursor` → one converted `.mdc` per skill; the remaining 16 →
`targets/_md-block.js`, a marker-delimited block appended to a markdown instructions file.

**FACT — upstream's own prose is stale on this number, in three places:**
- `scripts/lib/capabilities.js:19-20` — "8 of 17 targets have file-based agents; on the other 9 the
  agent is advisory". With 18 targets and 8 agent targets the remainder is 10, and the test agrees:
  `tests/capabilities.test.js:171` asserts `TARGET_IDS.length - withAgents.length === 10`.
- `tests/clone-bootstrap.test.js:330` — test title says "the 15 hookless targets"; the code says
  17 (`scripts/doctor.js:343`: `HOOKLESS_TARGETS = new Set(TARGET_IDS.filter((t) => t !== 'claude'))`).
- `scripts/install-apply.js:376` — "a cleanup that only worked for one of the sixteen assistants".

`README.md:18` is current ("18 assistant targets"). **INFERENCE:** any fork document that quotes a
target count from upstream comments rather than from `TARGET_IDS` will be wrong; the only safe
source is the module.

---

## Q3. Is the documentation root (`02-DOCS`) configurable? — definitive verdict

**VERDICT: No. Not by env var, not by a `.rsc.json` key, not by a CLI flag, not by a single
constant, not by folder detection. `02-DOCS` is a bare string literal repeated across the tree.**

Evidence:

1. **No `.rsc.json` key.** `scripts/lib/manifest-file.js:18` is the closed key list:
   `['version','targets','skills','agents','ownSkills','catalogVersion','tier','optOuts','memory','gitPermissions','agentModels','onboarding']`.
   `readManifest()` (`:20-50`) returns exactly those; anything else in the file is dropped. There is
   no `docsRoot`, `docRoot`, `wiki`, or `paths` key, and no package identity key either (see Q6).
2. **No env var.** Enumerating every `RSC_*` identifier in `scripts/` and `targets/`
   (`grep -rhno "RSC_[A-Z0-9_]*"`) yields 36 names; none names a documentation root. The closest is
   `RSC_PROJECT_CWD`, which is the project root, not the docs root.
3. **No CLI flag.** The only `02-DOCS`-adjacent flag in the whole CLI is `--with-docs` on `purge`
   (`scripts/install-apply.js:942`), which *deletes* it.
4. **No constant.** There is exactly one named constant anywhere that contains the segment —
   `scripts/lib/constitution-draft.js:19`, `export const CONSTITUTION_PATH =
   '02-DOCS/wiki/sdd/constitution.md'` — and it is a full path for one file, not a root. Everything
   else re-spells the literal: `join(cwd, '02-DOCS', 'wiki', 'harness')`,
   `/^02-DOCS\/wiki\/(ftd|sdd)\//`, `'02-DOCS/wiki/harness/user-profile.md'`, and so on.
5. **No detection.** `scripts/detect-repo.js` detects *stacks* (pubspec.yaml → flutter, etc.), never
   a docs root. `targets/knowledge-sync.mjs:48` hard-freezes the scope:
   `export const KNOWLEDGE = Object.freeze(['01-TOOLS/', '02-DOCS/wiki/', '02-DOCS/attachments/'])`.
6. **The literal also appears inside regexes and inside `.gitignore`-style patterns**, which is why
   a naive rename breaks silently: `scripts/drift-check.js:93`
   `TOP_DIRS = /^(scripts|targets|skills|tests|bin|site|schema|02-DOCS|\.github|\.rsc)(\/|$)/`,
   `:126` `'user-project': (t) => /(^|\/)(02-DOCS|raw)\//.test(t)`,
   `scripts/lib/eval-integrity.js:117` `PROTECTED_PATHS = ['02-DOCS/wiki/']`.

**Quantified cost of making it configurable** (measured, `grep -ro "02-DOCS" <tree> | wc -l`):

| Tree | occurrences | files |
| --- | --- | --- |
| `scripts/` + `targets/` (code) | **152** | 35 |
| `skills/` (catalogue prose the model reads) | **1052** | 227 |
| `tests/` | **385** | 47 |
| `README.md` | 14 | 1 |
| `site/` | 33 | 4 |
| **total** | **~1636** | **314** |

And there is a **second** hard-coded root nobody can ignore: `01-TOOLS` — 50 occurrences in code,
116 in `skills/`. The onboarding floor (`scripts/lib/onboarding-apply.js:373`,
`HARNESS_FLOOR_MINIMUM = ['01-TOOLS/_TEMPLATE/', '02-DOCS/wiki/harness/']`) binds the two together,
so a configurable docs root that leaves `01-TOOLS` fixed produces a half-moved harness.

**Effort estimate (INFERENCE, from the measured counts):** a resolver (`docsRoot(cwd)` reading a new
`.rsc.json` key with `02-DOCS` as default) plus mechanical substitution is tractable for the 152 code
sites and the 385 test sites. The 1052 prose sites in `skills/` are the real cost: they are
instructions *to a model*, so they cannot be left stale and cannot be rewritten by regex without
breaking sentences — and 227 of the 274 skills are affected, i.e. the configurability work touches
**83 % of the catalogue**, which is precisely the surface requirement §4 strategy B exists to keep
byte-identical. **INFERENCE:** for §5, honouring a configurable root *inside the code* while leaving
`02-DOCS` in prose is coherent only if the prose paths are rendered at install time; otherwise the
fork should treat the root as fixed and say so as a documented limitation.

---

## Q4. Skills structurally internal to the harness — exact count

### My inclusion criterion (stated, because the number depends entirely on it)

A catalogue skill id is **structurally internal** when *harness code* — something under `scripts/` or
`targets/`, not catalogue prose — depends on that skill for the harness's own operation. Concretely,
one of six mechanisms:

- **A** its `SKILL.md` bytes are injected as the always-on body;
- **B** it is in the unconditional install floor;
- **C** the per-turn gate text names it as a route;
- **D** a wired code hook names it as its route, remediation, or reads a file only that skill produces;
- **E** the installer materialises a slash command backed by it;
- **F** the installer materialises a subagent that executes it.

**Explicitly excluded:** mere membership in `scripts/lib/domains.js` (a 274-row lexical routing
table — every skill is in it, so it discriminates nothing) and mere membership in a profile.
Counting `domains.js` would make the answer 274 and the §11 budget meaningless.

### The list — **27 skills**

| # | Skill | Mechanisms | Evidence |
| --- | --- | --- | --- |
| 1 | `suggest` | A, B, C, D | `install-apply.js:294` injects `skills/suggest/SKILL.md` as the always-on body; `_md-block.js:28-33`; `claude.js:140`; `default-skill-floor.js:29`; `hook-once.mjs` `SDD_GATE_TEXT` ("full decisor in the always-on `suggest` body"); `userprompt-gate.mjs:4`; `auto-update.mjs:34` |
| 2 | `orient` | B, D | `default-skill-floor.js:29`; `knowledge-sync.mjs:48` (`PERSONAL` = the profile `init`/`orient` own) |
| 3 | `unslop` | B | `default-skill-floor.js:29` |
| 4 | `ftd` | B, C, D | `default-skill-floor.js:29`; `hook-once.mjs` gate ("Method: `ftd`"); `ftd-nudge.mjs:24-25,53,98-99`; `worktree-reaper.mjs:69` |
| 5 | `connect-tool` | B | `default-skill-floor.js:29` |
| 6 | `design` | B | `default-skill-floor.js:29` |
| 7 | `ux` | B | `default-skill-floor.js:29`; `tests/ux-upstream.test.js:66` |
| 8 | `tidy` | B | `default-skill-floor.js:29` |
| 9 | `sdd` | C | `hook-once.mjs` gate ("chain: `sdd`") |
| 10 | `ship` | D, E | `ship-guard.mjs:13` — the guard **denies** a trunk switch/merge and tells the agent to run `ship`; `worktree-reaper.mjs:5`; `session-start.mjs:273`; `knowledge-sync.mjs:292,624,841,958`; `commands.js:30` |
| 11 | `worktrees` | D | `worktree-reaper.mjs:66` — the reaper's branch-shape set is defined as what `worktrees` documents |
| 12 | `git-workflow` | D | `gitmoji-guard.mjs:12` — "the first is what `git-workflow` prescribes"; the hook is the enforcement of that skill's convention |
| 13 | `harness` | D, E, G | `session-start.mjs:241` (CLAUDE.md-budget nudge routes to it); `commands.js:49` (`harness-audit`); `onboarding-apply.js:485,529` — the onboarding floor gate |
| 14 | `init` | D | `danger-guard.mjs:60` reads `02-DOCS/wiki/harness/user-profile.md`, which only `init` writes, and the guard's behaviour is keyed to it; `knowledge-sync.mjs:48` |
| 15 | `constitution` | G | `onboarding-apply.js:375,526-527` — `HARNESS_FLOOR_CONSTITUTION = CONSTITUTION_PATH`; onboarding reports `incomplete` (`RSC_ONBOARDING_INCOMPLETE`) until the `constitution` phase has written it |
| 16 | `specify` | E, F | `commands.js:30`; `agent-catalog.js` `SPEC_MINER` (the brownfield spec miner writes an SDD-shaped draft) |
| 17 | `clarify` | E | `commands.js:30` |
| 18 | `plan` | E | `commands.js:30` |
| 19 | `tasks` | E | `commands.js:30` |
| 20 | `analyze` | E | `commands.js:30` |
| 21 | `implement` | E, F | `commands.js:30`; `agents.js:94-104` — the `developer` subagent *is* `implement`'s hand ("Full discipline lives in the `implement` skill") |
| 22 | `verify` | E | `commands.js:30` |
| 23 | `review` | E, F | `commands.js:30`; `agents.js:107,121,132,149` — `refuter-correctness`, `refuter-security`, `refuter-tests`, `finding-verifier`, "the three adversarial lenses `review` dispatches at tier 2" |
| 24 | `debug` | C, E | the always-on body is tested for naming it (`tests/always-on-body.test.js:35`, "names the bug-fix route"); `commands.js:30` |
| 25 | `simplify-code` | E | `commands.js:36` (`refactor-clean`) |
| 26 | `knowledge-ops` | E | `commands.js:42` (`update-docs`); `scripts/lib/knowledge-doctor.js:14` names it as the owner of the cure |
| 27 | `security-scan` | E | `commands.js:49` |

Grouped counts: **A = 1 · B = 8 · C = 3 (`ftd`,`sdd`,`suggest`; `debug` via the body) · D = 8
(`suggest`,`orient`,`ftd`,`ship`,`worktrees`,`git-workflow`,`harness`,`init`) · E = 14 · F = 3
(`implement`,`review`,`specify`) · G = 2 (`harness`,`constitution`)**. Union = **27**.

### Numbers that are *not* 27, and why

- **3** — the three §11 names `suggest`, `ftd`, `sdd`. Correct as a floor, wrong as the answer: §11
  says "y las identificadas por la auditoría".
- **8** — the install floor alone (`DEFAULT_SKILL_FLOOR`). Misses every hook-, gate-, command- and
  agent-backed skill.
- **14** — the command-backed set alone (`FIXED_COMMANDS` skill backings). Misses the floor.
- **20** — `manifest.json` `counts.fixedCommands = 20`. This is a count of **commands**, not skills:
  of the 20, six have non-skill backings (`build-resolver` role glob, `testing-*` glob, `sello`
  capability, and three `memory:*` CLI subcommands). Mistaking it for a skill count is an easy and
  wrong 20.
- **28** — 27 + `sdd-init`. I excluded `sdd-init`: its only harness-code appearance is
  `scripts/rsc.js:512,527`, which decides what the CLI *prints* as next steps. A print is not
  participation in operation. Borderline; if a track includes it, that is defensible, and the fork
  should evaluate it anyway because it is the SDD entry point.
- **48** — 27 + the 21 skills in `STACK_AGENT_BY_SKILL` (`agent-catalog.js:187`) whose presence
  causes stack reviewer/resolver agents to be installed. These are *agent-triggering*, not
  *agent-backed*: no harness mechanism depends on them. Excluded, but named here because "agent-backed"
  can be read that way and the difference is 21 skills of evaluation budget.

### Budget consequence (INFERENCE)

27 internal skills × 318/274 mean scenarios ≈ 31 capability scenarios → **~121 agent runs** per full
internal pass at the current zero-repetition setting (see Q10). At the 3 repetitions §11 implies but
upstream does not provide, ~363. This is the number Stage 1 must budget, not 3 and not 8.

---

## Q5. Can per-project customisation under `02-DOCS/wiki/` be destroyed by the harness?

**VERDICT: YES. Three distinct paths destroy or rewrite it, and the most dangerous one is ON BY
DEFAULT, acts on files that are committed and clean, commits its own result with `--no-verify`, and
`02-DOCS/wiki/skills/` falls squarely inside its scope.**

First, the scope fact that governs everything below.

**FACT — `02-DOCS/wiki/skills/` does not exist anywhere in upstream.**
```
grep -rn "wiki/skills" --include='*.js' --include='*.mjs' --include='*.md' --include='*.json' --include='*.sh' . \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.fork-tmp
-> (no output)
```
The §5 standard path is entirely new. The existing convention is `02-DOCS/wiki/stack/<skill>.md`
(`skills/go/SKILL.md:382`, `skills/python/SKILL.md:316`, `skills/rust/SKILL.md:312`,
`skills/java/SKILL.md:306`, `skills/postgresdb/SKILL.md:349`, `skills/redis/SKILL.md:288`,
`skills/level-design/SKILL.md:139`, `skills/agent-eval/SKILL.md:183`) — and §3's observation that
"the convention was not uniform" is confirmed: eight skills use it, 266 do not.

**FACT — the new path is inside the auto-sync scope.** `targets/knowledge-sync.mjs:48,79`:
```js
export const KNOWLEDGE = Object.freeze(['01-TOOLS/', '02-DOCS/wiki/', '02-DOCS/attachments/']);
export const PERSONAL  = Object.freeze(['02-DOCS/wiki/harness/user-profile.md']);
export const SCAFFOLD  = Object.freeze(['01-TOOLS/_TEMPLATE/']);
export const isKnowledge = (path) => KNOWLEDGE.some((k) => path.startsWith(k)) && !PERSONAL.includes(path)
  && !SCAFFOLD.some((k) => path.startsWith(k));
```
`02-DOCS/wiki/skills/flutter/README.md` satisfies `isKnowledge()`. There is no exclusion list a fork
could join without editing this file.

### Path 1 — `knowledge-sync` `applyIncoming()`: overwrite and delete, committed, on by default

**Trigger.** `UserPromptSubmit` / `Stop` (Claude), `UserPromptSubmit`/`Stop` (Codex, DeepSeek),
`beforeSubmitPrompt`/`afterAgentResponse` (Cursor), `BeforeAgent`/`AfterAgent` (Gemini), plugin
hooks (OpenCode) — `targets/knowledge-wiring.js:19-33`. So it runs **on every user message**.

**On by default.** `targets/knowledge-wiring.js:137-138`:
> `/** Wire it. Always, when the assistant supports it: being off is the runtime's .no-knowledge-sync. */`

and `scripts/install-apply.js:337` calls `wireKnowledge(target, cwd)` unconditionally inside
`applyInstall`. It becomes active when `.rsc.json` exists, the harness is at the repo root, `origin`
exists, and at least one KNOWLEDGE folder is present (`knowledge-sync.mjs:219-228`) — i.e. in any
real consumer project.

**What it does to a committed, clean file.** `targets/knowledge-sync.mjs:587-604`:
```js
for (const f of know) {
  const incoming  = blob(root, tip, f);
  const mine      = worktreeBlob(root, f);
  if (mine === incoming) continue;
  const base      = blob(root, seen, f);
  const committed = blob(root, 'HEAD', f);
  if (mine === base && committed === base) take.push(f);
  else if (mine && mine === committed && superseded(f, mine)) take.push(f);
  else if (touchedBy(f).some((c) => !s.ours.includes(c))) clash.push(f);
}
if (take.length) {
  const gone    = take.filter((f) => !blob(root, tip, f));
  const present = take.filter((f) =>  blob(root, tip, f));
  if (present.length) git(root, ['--literal-pathspecs', 'checkout', tip, '--', ...present]);
  if (gone.length)    git(root, ['--literal-pathspecs', 'rm', '--quiet', '--', ...gone]);
  git(root, ['--literal-pathspecs', 'commit', '--quiet', '--no-verify', '--only', '-m', SYNC_SUBJECT, '--', ...take]);
}
```
Read precisely:

- **`committed === base` is the condition for taking.** A file that is *committed and clean* and
  matches what the exchange branch previously had is **overwritten** by `git checkout <tip> -- <f>`
  and the overwrite is **committed** (`📥 docs(auto): sync desde rsc/knowledge`, `--no-verify`).
  This is the intended fast-forward, and for prose it is defensible — but it means the harness
  rewrites a tracked governance document without asking.
- **Deletion propagates.** `gone` → `git rm`. If any clone deletes
  `02-DOCS/wiki/skills/flutter/README.md` and that deletion reaches `rsc/knowledge`, **every other
  clone's committed, clean copy is removed and the removal is committed automatically.** Nothing in
  `applyIncoming` treats a deletion differently from an edit, and nothing asks.
- **Only a *locally touched* file is protected.** The `clash` branch (`:595`) requires
  `mine !== base`, i.e. the local copy differs from the exchange base — locally modified, or
  committed *after* base. For those the message is
  `"…que tú también has tocado. No lo traigo solo: tu versión sigue intacta."` So the protection
  upstream offers is the **inverse** of what §5 asks for: the dirty file survives, the clean
  committed one does not.
- **A closed default branch is the one safe case** (`:568-579`): on a protected `main` it writes
  nothing and only announces. That is a narrow exemption, not a general guarantee.

**Also in scope: automatic commit *and push* of the user's customisations.**
`commitLocal()` (`:285-330`) auto-commits every changed KNOWLEDGE path at turn end
(`git commit --quiet --no-verify --only -m "📝 docs(auto): …"`), and `ship()` (`:454-520`) replays
those commits onto `refs/remotes/origin/rsc/knowledge` with `commit-tree` and pushes them. So by
default, a per-project customisation file is **auto-committed and auto-pushed to a shared branch on
`origin`** without the user acting. That is a §14 *política de datos* question nobody can decide by
reading the README.

### Path 2 — `rsc purge --with-docs`: unrecoverable deletion of the whole tree

`scripts/install-apply.js:942-943`:
```js
if (withDocs) drop(join(cwd, '02-DOCS'), true);
else if (existsSync(join(cwd, '02-DOCS'))) kept.push({ path: '02-DOCS/', reason: 'your knowledge base. Add --with-docs to remove it too.' });
```
`drop(p, true)` is `rmSync(p, { recursive: true, force: true })`. Not default — but the doc comment
at `:845-852` states that **purge deliberately takes no backup**:
> "Backups live under `.rsc/backups/`, which this removes — so purge does not snapshot (a pre-purge
> backup would delete itself). It is the deliberate escape hatch."

So `--with-docs` is an unrecoverable destruction of every per-project customisation, by one flag,
with no snapshot. **INFERENCE:** the fork must either refuse to delete `02-DOCS/wiki/skills/` under
`--with-docs`, or snapshot outside `.rsc/` first, or require a second confirmation naming the count
of customisation files it is about to remove.

### Path 3 — `closeLanded()`: rewrites documents in place (out of scope today, one regex away)

`targets/knowledge-sync.mjs:632` `const isFtdDoc = (p) => /^02-DOCS\/wiki\/ftd\/[^/]+\.md$/.test(p);`
and `closeDoc()` (`:668`) rewrites frontmatter to `status: done` and appends a `Cierra:` trailer,
then commits. **Today `02-DOCS/wiki/skills/` is outside that regex — FACT.** But the mechanism
exists, it rewrites tracked documents in place, and `:747` already diffs
`'02-DOCS/wiki/ftd/'` directly. **INFERENCE:** if the fork gives customisation files frontmatter
with a lifecycle, this is the next thing that will edit them.

### Paths that do **not** touch it (checked, so their absence is not read as cleanliness)

- `applyInstall` / `syncInstalled` / `repair`: `02-DOCS` is not in `managedPathsForInstall`
  (`install-apply.js:110+`) and `scripts/lib/repair.js` only `rmSync`s `paths.skillDir(id)`,
  `paths.stateFile`, and a legacy `rsc/` dir (`repair.js:102,104,146`). **FACT: install, sync and
  repair do not write under `02-DOCS/wiki/skills/`.** They also do not **back it up** — the same
  fact, read the other way.
- `onboarding-apply.js` writes only `02-DOCS/wiki/harness/*` and the constitution draft
  (`:171,185,230,399`), and `:385-386` records that the floor is deliberately *outside*
  `governedPaths`, so the apply transaction's revert cannot touch it.
- `scripts/lib/ingest-move.js:16` lists `02-DOCS` in `PROTECTED_DIRS`, so ingest never moves a file
  *out of* it.
- `scripts/knowledge-doctor.js:11` — "It NEVER writes. Not a file, not a mkdir."

### Fresh-clone behaviour

`02-DOCS` is **not** added to a consumer's `.gitignore`: `ignoreLocalState()`
(`scripts/install-apply.js:407-446`) writes only `['.rsc/', '.worktrees/']` plus derived per-target
skill/state/agent/command paths. **FACT.** So a committed `02-DOCS/wiki/skills/` does survive
`git clone` as ordinary tracked content — and then the first user message in that clone runs
`applyIncoming`, which is Path 1.

(Note the asymmetry: *this* repository's own `.gitignore:34` ignores `02-DOCS/`, and several code
comments generalise from that — `scripts/knowledge-doctor.js:11` and
`scripts/lib/eval-integrity.js:115` both assert "`02-DOCS/` is untracked (P9)". That is true of the
harness repo and **false of a consumer project**. Anyone reasoning about §5 from those comments will
reach the wrong conclusion.)

### Bottom line for §5

Requirement §5 says customisations "se versionan en Git y no deben perderse durante instalación,
`sync`, `repair`, actualización o reconstrucción de un clon". Install/sync/repair/clone are clean.
**The requirement is nonetheless violated today by a mechanism §5 does not name: the always-on
knowledge sync.** Any fork that keeps `02-DOCS/wiki/skills/` inside `KNOWLEDGE` ships a product whose
default behaviour can delete a project's governance decisions because somebody else deleted theirs.

---

## Q6. Parent package identity that could reinstall the parent

**FACT — 185 occurrences of `@ericrisco/rsc` / `ericrisco/rsc-harness` / `rsc-harness` across 41
files** (excluding `node_modules`, `.git`, `coverage`, `docs`, `tests`). Ranked by file:
`scripts/rsc.js` 31 · `README.md` 24 · `skills/init/references/recommend-skills.md` 15 ·
`scripts/doctor.js` 14 · `skills/suggest/SKILL.md` 10 · `targets/sello.mjs` 8 · `skills/tidy` 6 ·
`targets/session-start.mjs` 5 · `skills/worktrees` 5 · `skills/review` 5 ·
`targets/branch-guard.mjs` 4 · `targets/commands.js` 4 · `package.json` 4 ·
`skills/sdd-init` 4 · `skills/ship` 4 · `targets/auto-update.mjs` 3 ·
`scripts/lib/onboarding-apply.js` 3 · `skills/harness` 3 · `skills/skill-scout` 3 ·
`targets/clone-bootstrap.mjs` 2 · `scripts/lib/upgrade.js` 2 ·
`.github/workflows/release.yml` 2 · `manifest.json` 2 · `targets/memory.js` 1 ·
`scripts/audit.js` 1 · `SECURITY.md` 1 · and 13 more skills with 1 each.

### The ones that end up COMMITTED INSIDE A CONSUMER'S REPOSITORY

**1. `.claude/rsc-bootstrap.mjs` — the single worst vector.**

`targets/clone-bootstrap.mjs:33`:
```js
const PACKAGE = '@ericrisco/rsc';
```
This file is copied into the consumer's **committed** tree, deliberately —
`targets/claude.js:131-135`:
> "The one harness file that belongs in the committed tree rather than in `.rsc/`: it is the only
> thing standing between a clone and seven stack traces, so it has to survive `git clone`."

and `install-apply.js:80-82` names it "the one entry here that, if omitted, leaves an executable
behind in a tree the user pushes". Worse, `ignoreLocalState()` *actively rescues it from
`.gitignore`* (`install-apply.js:455-456`: `RESCUE = ['.claude/rsc-bootstrap.mjs',
'.claude/settings.json']`).

What it tells the agent to do, verbatim (`clone-bootstrap.mjs:239-258`):
```
const pin = version ? `${PACKAGE}@${version}` : `${PACKAGE} (no version pinned)`;
const command = version ? `npx ${PACKAGE}@${version} sync` : `npx ${PACKAGE} sync`;
…
'ACTION: ask the user whether to build it … On a yes, run EXACTLY:\n' + `  ${command}\n`
```
So every consumer repository wired by this harness carries a committed script that instructs the
agent to run `npx @ericrisco/rsc@<version> sync` on a fresh clone. If the fork ships this file
unmodified, **every fork consumer reinstalls the parent on first clone**, with the fork's version
number appended to the parent's name — which will either resolve to an unrelated parent release or
404. `clone-bootstrap.mjs` is standalone by constraint (it "cannot import anything"), so the fork
must change the constant *and* handle the pre-existing committed copies it does not control.

**2. The always-on block, injected into committed instruction files.**

`targets/_md-block.js:27-38` writes `skills/suggest/SKILL.md` (frontmatter stripped) plus
`UPDATE_NOTE` between `<!-- rsc-suggest:start -->` markers into `paths.hookTarget` — which for the
16 markdown targets is the user's own tracked file: `AGENTS.md` (codex, opencode, deepseek, amp,
jules, zed), `GEMINI.md`, `.github/copilot-instructions.md`, `CONVENTIONS.md` (aider),
`.antigravity/AGENTS.md`, `.windsurf/rules/rsc-suggest.md`, `.clinerules/rsc-suggest.md`,
`.roo/rules/rsc-suggest.md`, `.continue/rules/rsc-suggest.md`, `.junie/guidelines.md`,
`.kiro/steering/rsc-suggest.md`, and for cursor `.cursor/rules/rsc-suggest.mdc`.

`skills/suggest/SKILL.md` contains **10** `@ericrisco/rsc` strings (lines 3, 44, 55, 61, 65, 67, 73,
87, 91, 96), including the one that matters most, line 91:
> `` npx @ericrisco/rsc@<catalogVersion in .rsc.json> sync ``, that exact version, **never** `@latest`

and `_md-block.js:19-21` adds `UPDATE_NOTE`, which tells 13 assistants to run
`node .rsc/auto-update.mjs` on the first turn of every session.

**INFERENCE, and I rate it high-confidence:** of the 18 targets, only `claude`'s hook target
(`.claude/settings.json`) is machine wiring. For the other 17 the always-on block lands in a file
that is normally committed, so the parent's package name is committed into the consumer repo for
17 of 18 assistants, independently of the bootstrap.

**3. `.rsc.json` has no package identity at all — and that is itself the bug.**

`scripts/lib/manifest-file.js:18` — the key list has `catalogVersion` but **no** package name,
scope, or registry. So the committed declaration cannot distinguish a fork-governed project from a
parent-governed one, and `clone-bootstrap.mjs` composes
`<hard-coded PACKAGE>@<declared catalogVersion>`. **INFERENCE:** the fork must add a package-identity
key, must treat its absence as "legacy parent project", and must keep `readManifest`'s
drop-unknown-keys behaviour in mind — a key the fork adds will be *silently dropped* by any parent
version of the CLI that later runs in the same project.

### The ones that are gitignored but still reinstall the parent at runtime

- `targets/auto-update.mjs:85` `['npx', '-y', '@ericrisco/rsc@' + version]`, `:132`
  `fetch('https://registry.npmjs.org/@ericrisco%2frsc/latest')`, `:172,180` `npx @ericrisco/rsc@latest`.
- `scripts/lib/upgrade.js:6,15` — `npm install -g @ericrisco/rsc@latest` (a **global** install).
- `scripts/lib/onboarding-apply.js:96,505,519` — three `npx @ericrisco/rsc@latest onboard` strings
  that are *printed to the agent* as the recovery action.
- `scripts/doctor.js` (14) and `scripts/rsc.js` (31) — every "run this to fix it" sentence.
- `targets/sello.mjs` (8), `targets/session-start.mjs` (5), `targets/branch-guard.mjs` (4) —
  materialised into `.rsc/` and printed to the agent each session.
- `targets/commands.js:46,53,58,63` — four slash-command bodies (`checkpoint`, `learn`,
  `save-session`, `resume-session`) that are written to disk in the consumer project. These *are*
  added to `.gitignore` by `ignoreLocalState` (`install-apply.js:436-443`), so they are not
  committed — but they are read by the agent every time the command runs.
- `.github/workflows/release.yml:76,89` — `npm view @ericrisco/rsc version`, twice, as the release
  pipeline's notion of "what is already published". A fork that inherits this workflow computes its
  next version from the **parent's** registry entry.

---

## Q7. Size budget for the always-on injected block

**FACT — the block is `skills/suggest/SKILL.md` with frontmatter stripped, plus `UPDATE_NOTE`.**
`install-apply.js:294` → `wireHook(target, paths, join(ensureBase('suggest', …), 'SKILL.md'), policy)`;
`_md-block.js:27-33`; `claude.js:139-152`.

**FACT — current size: 7280 bytes.**
```
wc -c skills/suggest/SKILL.md -> 7280
```

**FACT — two independent ceilings, both live tests:**

| Test | Assertion | Max allowed |
| --- | --- | --- |
| `tests/clone-bootstrap.test.js:350` | `assert.ok(bytes <= 7282, …over the 7282 B ceiling…)` | **7282** |
| `tests/always-on-body.test.js:16-20` | `BODY_CEILING_BYTES = 8000`; `assert.ok(bytes < BODY_CEILING_BYTES)` | 7999 |

The binding one is 7282 (`<=`).

**HEADROOM = 7282 − 7280 = 2 bytes.**

I ran the cheaper of the two to confirm it is green at base:
`node --test tests/always-on-body.test.js` → `# pass 6 # fail 0`.
(`tests/clone-bootstrap.test.js` was not executed — it performs real installs and is slow — so the
7282 figure is read from source, and the arithmetic 7280 ≤ 7282 is my own measurement.)

**This is the single hardest constraint in the whole audit.** Requirement §6 wants a versioned
governance contract covering nine topics, and §5 wants the customisation lookup to happen on every
invocation path including the automatic and internal ones. For the 17 hookless assistants the
always-on body is the *only* place such a rule can exist (`tests/always-on-body.test.js:27-31` says
so explicitly). Two bytes of headroom means the fork cannot add one sentence without a deliberate,
argued ceiling change — and the ceiling exists precisely to make that argument happen
(`clone-bootstrap.test.js:339-348`).

**Related, and not a hard gate:** `npm run validate` reports
`description weight: 104.8 KB across 274 skills (mean 392 chars) · 139 over the 350-char ceiling`
and still **exits 0**. `tests/catalog-diet.test.js:49` only asserts the advisory ceiling sits below
the 1024 hard limit. So descriptions — paid on every turn in every assistant — have an advisory
ceiling that 139 of 274 skills already exceed with no consequence. **INFERENCE:** a per-skill
governance pointer in the description would be ungated and therefore tempting, and would add
roughly 274 × N bytes to every turn in every assistant. That trade must be made consciously.

---

## Q8. Are `skills/ux/upstream/**` and `skills/design/engine/**` byte-protected?

**`skills/ux/upstream/**` — YES, hard byte protection.**
`tests/ux-upstream.test.js:24-34`:
```js
for (const [name, source] of Object.entries(manifest)) {
  assert.match(source.commit, /^[0-9a-f]{40}$/);
  assert.equal(source.license, 'MIT');
  const shipped = files(dir).map((p) => relative(dir, p)).sort();
  assert.deepEqual(shipped, Object.keys(source.files).sort());       // nothing unrecorded ships
  for (const [file, hash] of Object.entries(source.files))
    assert.equal(sha(join(dir, file)), hash, `${name}/${file} drifted from upstream`);
}
```
`skills/ux/upstream/UPSTREAM.json` carries a SHA-256 per file. Changing **one byte** under
`skills/ux/upstream/**`, or adding/removing a file there, fails this test. Verified green at base:
`node --test tests/ux-upstream.test.js` → `# pass 5 # fail 0`.

**`skills/design/engine/**` — NO byte protection. Asymmetric with `ux`, and the asymmetry is not
documented in the README.**
`skills/design/engine/UPSTREAM.json` records only `{repo, path, commit, version, license}` — **no
`files` map, no hashes**:
```json
{ "taste-skill": { "repo": "Leonxlnx/taste-skill", "path": "skills/taste-skill",
  "commit": "6010f91a9935f1c167dfc500fb1a475681892e6b", "version": "2.1.4", "license": "MIT" },
  "impeccable": { … "license": "Apache-2.0", "used": "text only …; no code" } }
```
What `tests/design-engine.test.js` actually enforces on that subtree:
- `:127-136` — every `engine/scripts/**.mjs` passes `node --check` (≥ 9 scripts) and `RUN.md` has no
  frontmatter and contains `## The run`;
- `:85-103` — `engine/LICENSE` matches `/MIT License[\s\S]*Leonxlnx/`, `IMPECCABLE-LICENSE.txt`
  matches Apache 2.0, `THIRD_PARTY.md` names six required strings, `UPSTREAM.json`'s commit is
  40 hex, and no file under `skills/design/` contains `/Users/` or `/home/[a-z]`;
- `:37-54` — `draw.mjs` is seed-reproducible;
- `:63-77` — the browser gate fails a bad fixture and passes a good one — **skipped** unless Node ≥ 22
  and a Chrome-family browser is present (`:61`).

**So bytes under `skills/design/engine/**` can change freely** as long as scripts still parse, `RUN.md`
keeps its heading, the licence files keep their text, and no absolute home path appears. Its
`THIRD_PARTY.md` claims the engine is "copied unmodified" — a claim nothing verifies, unlike `ux`'s,
whose `THIRD_PARTY.md` correctly says "`tests/ux-upstream.test.js` fails if a shipped file drifts".

**Parent references in those two subtrees — NONE.**
```
grep -rn "ericrisco\|rsc-harness\|@ericrisco" skills/ux/upstream skills/design/engine -> (no output)
grep -rln "\brsc\b"                           skills/ux/upstream skills/design/engine -> (no output)
```
Both third-party subtrees are completely free of the parent's package name, repo name, and even the
word `rsc`. **Good news for a rebrand, and genuinely surprising** given how saturated the rest of the
catalogue is — the authors kept the vendored trees clean on purpose.

---

## Q9. Deterministic validators — exit codes, vacuity, fail-open, CI coverage

All run under the isolation prefix.

| Validator | Exit | Output (tail) | Verdict |
| --- | --- | --- | --- |
| `npm run manifest:check` | **0** | `manifest OK (274 skills, 34 agents, 53 commands)` | real |
| `npm run validate` | **0** | `frontmatter OK` / `skill bodies OK` / `139 over the 350-char ceiling` | real, but the 139 overruns are advisory only |
| `npm run drift:check` | **0** | `886 prose link claim(s) checked, 4 classified as non-claims · RESULT: PASS` | real |
| `npm run drift:knowledge` | **0** | `skipped — no knowledge tree found (02-DOCS/wiki and auto-memory are both absent)` | **VACUOUS** |
| `npm run knowledge:doctor` | **0** | `no hay 02-DOCS/wiki/ — nada que auditar.` | **VACUOUS** |
| `npm run spec:gate` | **0** | `no specs found — pass a path, or write one to 02-DOCS/wiki/sdd/specs/` | **VACUOUS** |
| `npm run routing:audit` | **1** | `FAIL: declared-route top-5 84.9% < 85%` | **RED AT BASE** |
| `npm run originality:check` | **0** | `originality OK (82 documents vs 93337 corpus fingerprints; 0 exemptions)` | **VACUOUS for skills** |
| `bash scripts/eval-lint.sh` | **0** | 274 × `SKIP: python3/yaml unavailable` · `WARNING: deep YAML validation was skipped` · `RESULT: PASS` | **FAILS OPEN** |
| `bash scripts/reviewer-guard.sh` | **1** | `reviewer-guard: agents dir not found: …/plugins/rsc-review/agents` | **DEAD SCRIPT** |

### Flags

**RED at base — `routing:audit`.** Exit 1, `84.9% < 85%`. Reported collisions include
`0.64 code-review ↔ review` and `0.74 linkedin-carousels ↔ linkedin-content`. It is **not in any
workflow**. So the fork inherits a failing validator, and its baseline must be recorded before any
governance text is added to descriptions — governance preambles will move routing scores, and
without a recorded baseline it will be impossible to tell whether the fork made it worse.

**Vacuous in a clean clone (3 + 1):** `drift:knowledge`, `knowledge:doctor` and `spec:gate` all
return 0 because they look for `02-DOCS/wiki/` **in the harness repo itself**, which this repo
gitignores (`.gitignore:34`). `scripts/knowledge-doctor.js:20` `const WIKI = join(REPO, '02-DOCS',
'wiki')`; `scripts/drift-check.js:267` `checkKnowledge({ root = REPO, … })`;
`scripts/spec-gate.js:14` `DEFAULT_DIR = join(ROOT, '02-DOCS','wiki','sdd','specs')`. **These three
are maintainer-only tools pointed at the maintainer's own private wiki. They cannot validate a
consumer's `02-DOCS/`, and nothing in upstream can.** That is directly load-bearing for §5's "un
archivo existente pero ilegible, inválido o contradictorio no debe tratarse silenciosamente como
ausente": there is no existing machinery to lean on.

**Vacuous for the catalogue — `originality:check`.** It reports 82 documents.
`scripts/originality-check.js:43-55`, `catalogDocuments()` returns
`[...stackAgents(), ...resolveCommands(...)]` — **34 agents + 48 commands = 82. Not one of the 274
skills is checked.** The README and both workflows present this as a release gate on catalogue
originality. It is a gate on agents and commands only.

**Fails open — `eval-lint.sh`.** With `python3` present at `/usr/local/bin/python3` but PyYAML
unavailable, all 274 skills come back `SKIP` and the script still prints `RESULT: PASS` and exits 0.
`scripts/eval-lint.sh:22-24` documents the design ("falls back to a basic structural grep check and
SKIPs the deep validation with a warning"). It is in **both** CI and release. **INFERENCE:** on
`ubuntu-latest` PyYAML is normally present, so CI probably does the deep check — but nothing in the
workflow installs or asserts it, so one runner image change silently converts both gates to no-ops.
A fork that depends on `route_to` resolution should pin PyYAML and make the SKIP path exit non-zero.

**Dead — `reviewer-guard.sh`.** It targets `$REPO_ROOT/plugins/rsc-review/agents`;
`ls -d plugins` → `No such file or directory`. The script exits 1 unconditionally. It is referenced
by no `package.json` script and no workflow. Residue from the retired plugin-marketplace model — the
same residue `ci.yml`'s "cleanup gate" was written to catch, and does not.

### CI cross-check (`.github/workflows/`)

| Validator | `ci.yml` | `release.yml` | `prepublishOnly` |
| --- | --- | --- | --- |
| `validate` | ✅ | ✅ | ✅ |
| `manifest:check` | ✅ | ✅ | ✅ (via `manifest`) |
| `npm test` | ✅ | ✅ | ❌ |
| `eval-lint.sh` | ✅ | ✅ | ❌ |
| `drift:check` | ✅ | ❌ | ✅ |
| `originality:check` | ❌ | ✅ | ✅ |
| cleanup grep gate | ✅ | ❌ | ❌ |
| `drift:knowledge` | ❌ | ❌ | ❌ |
| `knowledge:doctor` | ❌ | ❌ | ❌ |
| `spec:gate` | ❌ | ❌ | ❌ |
| `routing:audit` | ❌ | ❌ | ❌ |
| `reviewer-guard.sh` | ❌ | ❌ | ❌ |

Six of the twelve deterministic checks run in no automated context. **FACT:** `release.yml` runs on
**every push to `main`** and auto-bumps the patch version, publishes to npm with
`NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` and `--provenance`, pushes the bump commit, tags, and
cuts a GitHub Release. `release.yml:70-72` hard-codes `git config user.name "Eric Risco"` /
`user.email "erisco@icloud.com"`.

---

## Q10. Semantic-evaluation machinery (read only; never executed)

**Files read:** `scripts/skill-behavior-eval.js`, `scripts/skill-behavior-eval.workflow.js`,
`scripts/skill-scoreboard.workflow.js`, `scripts/lib/behavior-score.js`,
`scripts/lib/eval-integrity.js`, `scripts/skill-harden.workflow.js`.

**No API key, no model id. It runs on the host session's own agents. FACT.**
`skill-behavior-eval.workflow.js` uses the Workflow `agent()` / `parallel()` / `pipeline()` /
`workflow()` primitives only. The single `agentType` named anywhere is `'Explore'` (`:70,80`), for
the loader. There is no model string, no temperature, no provider, no key read, no `fetch`. Grep for
`random|Math.random|seed|sample|strat` across all five eval files returns exactly one hit:
`behavior-score.js:2`, the comment "No I/O, no LLM, no randomness".

**Consequence (INFERENCE):** cost is paid in the operator's Claude Code quota, not in an API bill, so
§11's "Modelos y configuración" and "Límites de costo" have no existing knob to set — Stage 1 must
build both. And because the grader is the same host model as the arms, "modelos" is not independently
selectable at all today.

**Thresholds — FACT** (`scripts/lib/behavior-score.js:5-8`):
```js
export const ABS_MIN = 8.5;           // aggregate absolute score, 0-10
export const LIFT_MIN = 1.0;          // treatment − baseline
export const COVERAGE_WEIGHT = 0.6;   // must_include coverage
export const QUALITY_WEIGHT  = 0.4;   // mean of completeness/actionability/correctness/grounding
```
`composeOutputScore` = `0.6 × (satisfied/total × 10) + 0.4 × mean(4 quality axes)`; with no
checklist it is quality only (`:25`). Gate fails if `absoluteScore < 8.5` **or** `lift < 1.0`
(`:70-82`). Hold-out gate (`:94-118`) is deliberately looser: **block if `lift <= 0`**, pass on
anything positive; indeterminate → `verdict: 'block'` ("failing closed"). Integrity violation →
`blocked: true` and the numbers are withheld (`skill-behavior-eval.js:9-11`;
`eval-integrity.js:115-117` `PROTECTED_PATHS = ['02-DOCS/wiki/']`). Exit codes: 0 pass, 1 fail/block,
2 usage/parse.

**Repetitions — ZERO. FACT.** There is no repetition loop anywhere. Each capability scenario runs
exactly once per arm, and is graded exactly once:
`pipeline(loaded.scenarios, (sc,_,index) => parallel([baseline, treatment]), (prev) => grade)`
(`skill-behavior-eval.workflow.js:95-157`). `aggregate()` averages over **scenarios**, so `n` =
number of capability scenarios, not number of repeats. Blinding is `xIsTreatment = index % 2 === 0`
(`:137`) — deterministic parity, not randomised.

**Reproducible / seeded / stratified sampling — NONE. FACT.**
`skill-scoreboard.workflow.js:21-22` requires an explicit array of ids and throws otherwise:
`if (ids.length === 0) throw new Error('skill-scoreboard: pass an array of skill ids …')`. There is
no sampler, no seed, no stratum, no coverage ledger. §11's "Selección reproducible de la muestra"
must be built from nothing.

**Agent runs — computed from the real catalogue.**

Per skill with `S` capability scenarios: `1` loader + `S` baseline + `S` treatment + `S` grader
= **1 + 3S**.

Measured scenario inventory (parsed from every `skills/*/evals/cases.yaml`):
```
skills: 274 · with evals/cases.yaml: 274 · without: 0
total capability scenarios: 318
distribution (scenarios -> #skills): {"1":238, "2":29, "3":6, "4":1}
mean: 1.16 scenarios/skill
```

| Scope | Agent runs (0 repetitions) |
| --- | --- |
| typical skill (S = 1) | **4** |
| heaviest skill (S = 4) | 13 |
| the 27 internal skills (Q4) | ~**121** |
| whole catalogue, one pass | 274 + 3 × 318 = **1228** |
| whole catalogue at 3 repetitions | **3682** (274 + 9 × 318) |
| whole catalogue at 5 repetitions | **6136** |

Plus the fix loop: `skill-harden.workflow.js` generates a fresh hold-out scenario per failing skill
(+3 runs each), and `--transcripts` integrity checking is optional, so a run without it prints
`integrity NOT CHECKED` rather than failing (`skill-behavior-eval.js:13-15`).

**The finding that matters most (INFERENCE, high confidence):** with 238 of 274 skills having exactly
one capability scenario and zero repetitions, `agg.n === 1` for 87 % of the catalogue. An 8.5/10
threshold and a 1.0 lift threshold on a **single** LLM-graded sample is not a measurement with a
defensible pass/fail semantics, and §11's "tratamiento de resultados inconclusos" has no
representation in the code at all — a dropped scenario just shrinks `n` (`behavior-score.js:36-37`).
Stage 1 must set repetitions > 1 and budget accordingly, and the budget it needs is ~3–5× the number
above, not the number above.

---

## Q11. Which assistants can have a governance check enforced by code today?

I read every wiring module, not only `targets/claude.js`: `claude.js`, `_md-block.js`, `cursor.js`,
`index.js`, `agents.js`, `agent-catalog.js`, `commands.js`, `memory.js`, `knowledge-wiring.js`,
`update-wiring.js`, `git-permissions.js`, `agents-md-shadow.js`, `deepseek-bridge.js`,
`opencode-memory-plugin.js`.

### Surfaces that exist in this repo

| Target | Code-hook config written | Events actually wired | Can read a file | Can inject into context | Can **block** |
| --- | --- | --- | --- | --- | --- |
| **claude** | `.claude/settings.json` + `.claude/settings.local.json` | SessionStart, UserPromptSubmit, PreToolUse(Bash), PostToolUse(Edit\|Write\|MultiEdit\|NotebookEdit), PreCompact, SessionEnd, Stop | ✅ | ✅ | ✅ **yes** |
| cursor | `.cursor/hooks.json` | `sessionStart`, `beforeSubmitPrompt`, `afterAgentResponse` | ✅ | ✅ (`user_message`) | ❌ not wired |
| codex | `.codex/hooks.json` (+ `.codex/rules/rsc-git.rules`) | SessionStart, UserPromptSubmit, Stop | ✅ | ✅ (`additionalContext`) | ⚠️ git-only, static rules |
| gemini | `.gemini/settings.json` | SessionStart, BeforeAgent, AfterAgent | ✅ | ✅ (`additionalContext`) | ⚠️ git-only, static rules |
| opencode | `.opencode/plugins/rsc-*.js` (+ `opencode.json`) | plugin v1/v2 lifecycle; `put(text)` into the system prompt | ✅ | ✅ | ⚠️ git-only, static `deny` rules |
| deepseek | `.dsh/hooks.json` | SessionStart, UserPromptSubmit, Stop | ✅ | ✅ (via `deepseek-bridge`) | ❌ not wired |
| copilot, windsurf, cline, roo, continue, junie, kiro, aider, amp, jules, zed, antigravity (**12**) | *none* | *none* | ❌ | markdown block only | ❌ |

Evidence: `targets/claude.js:112-320` (seven events; `ship-guard`, `branch-guard`, `gitmoji-guard`,
`danger-guard` all `PreToolUse` matcher `Bash`; `copy-guard` on `Stop`; `userprompt-gate` on
`UserPromptSubmit`; `ftd-nudge` on `PostToolUse`). `scripts/doctor.js:343`
`HOOKLESS_TARGETS = new Set(TARGET_IDS.filter((t) => t !== 'claude'))` — upstream's own code says
**17 of 18 are hookless** in the hook-script sense. `targets/knowledge-wiring.js:19-33` and
`targets/memory.js:13-31` give the six-target hook surface. `targets/update-wiring.js:20-31`
`UPDATE_HOOK_TARGETS = ['claude','codex','cursor','deepseek','gemini','opencode']`.
`targets/git-permissions.js:18` `GIT_PERMISSION_TARGETS = ['claude','codex','gemini','opencode']`.
`targets/knowledge-sync.mjs:993-1012` shows the per-target output shaping — `user_message` for
cursor, `hookSpecificOutput.additionalContext` for the rest, `systemMessage` for the person.

### Classification

- **Full code enforcement (read a file, inject, and block): `claude` only — 1 of 18.** The deny path
  is `PreToolUse` plus the `Stop` copy-guard; nothing else in this repo returns a deny for any other
  vendor.
- **Code-run context injection, no block: `cursor`, `codex`, `gemini`, `opencode`, `deepseek` — 5.**
  Real, vendor-event-driven hooks that can read a project file and add text to the model's context.
  A governance *reminder* is enforceable here; a governance *gate* is not, as wired.
  `codex`/`gemini`/`opencode` additionally get static permission rules, but those deny *git
  commands*, not a governance violation, and they are configuration, not a file-reading check.
- **No enforcement possible at all: the other 12** — `copilot`, `windsurf`, `cline`, `roo`,
  `continue`, `junie`, `kiro`, `aider`, `amp`, `jules`, `zed`, `antigravity`. For these the harness's
  entire surface is a markdown block in a file the vendor may or may not read on any given turn.
  **Enforcement is impossible here, full stop**, and §6's demand to document "garantías implementadas
  mediante código" versus "reglas dependientes del modelo" lands exactly on this line: 1 assistant
  gets a guarantee, 5 get a reliable reminder, 12 get a hope.

**NOT VERIFIED:** whether each vendor's documented hook contract still matches what this repo writes
(no network). `targets/_md-block.js:19-21` itself claims only "Claude Code, Codex, Gemini CLI, Cursor
and OpenCode check for a new rsc on their own" — five, consistent with `UPDATE_HOOK_TARGETS` minus
deepseek. I also cannot verify that "DeepSeek Harness" is a shipping product with documented hooks;
`targets/deepseek-bridge.js` exists, but §4's instruction "no inventes hooks" applies here and this
one deserves an explicit confirmation before the fork promises anything for it.

---

## Q12. Can a user disable code-enforced guards, and does the choice propagate?

**YES to both, and the propagation is deliberate.** `targets/opt-outs.js` is the authority:

**15 PROJECT opt-outs — committed in `.rsc.json`, rebuilt in every clone** (`opt-outs.js:19-35`):
`audit`, `auto-update`, `claudemd-check`, `copy-guard`, `danger-guard`, `feature-gate`, `ftd-close`,
`ftd-nudge`, `gitmoji`, `knowledge-sync`, `ship-guard`, `trunk-guard`, `trunk-open`,
`worktree-cleanup`, `worktree-isolation`.

**5 MACHINE opt-outs — never written to the manifest** (`:38-44`): `context7`, `git`, `harness`,
`memslop`, `scope-check`.

Mechanism: `.rsc/.no-<name>` marker on disk; `projectOptOuts()` (`:51`) filters the committed list;
`recordInManifest` writes `optOuts` (`install-apply.js:228`); `applyInstall` calls
`hydrateLocalDecisions(cwd, readManifest(cwd))` when `fromScratch` (`install-apply.js:268`), i.e. a
fresh clone **re-creates the markers from the committed declaration**. `package.json` `rscFixes`
`fixedIn: "2.0.6"` names the bug this fixed: "A guard your team disarmed (.rsc/.no-gitmoji and
similar) comes back armed after cloning the repo". `clone-bootstrap.mjs:45-47` carries a duplicated
inline copy of the same 15 names (it cannot import), and
`clone-bootstrap.mjs:155,193-194` reports `DISARMED BY THE TEAM, still armed here: …`.

So: **every code-enforced guard the harness has is disableable, and for 15 of 20 switches the
disable travels to every clone.**

**A second, stronger kill switch: the accepted onboarding plan.** `policy.codeHooks === false`
(`claude.js:154-156,172,244-267`) removes `ship-guard`, `branch-guard`, `gitmoji-guard` and
`sello.mjs` entirely and replaces the 7280-byte always-on body with a three-line stub:
```
'# rsc-suggest — always-on operations layer\n\nRead `02-DOCS/wiki/harness/user-profile.md` before acting. Use `orient` … Close with the configured orientation block.\n'
```
`policy.laneGate === false` additionally removes the per-turn gate and the FTD nudge. The accepted
plan lives in `.rsc.json.onboarding`, so it travels too.

**Consequence for §6 (INFERENCE):** the fork's governance contract cannot be stated as "guaranteed by
code". The honest statement is: *guaranteed by code on Claude Code, in a project whose committed
declaration has not disarmed the relevant switch and whose accepted plan enables code hooks.* If the
fork wants a governance check that cannot be turned off, it must introduce a non-opt-outable
mechanism — which is a new category this codebase does not have, and which §6's "no pueden desactivar
permisos del entorno" arguably constrains.

---

## Q13. Anything preventing `docs/fork/` from being committed?

**YES — `docs/` is gitignored in this repository. FACT, measured:**
```
git check-ignore -v docs/fork/REQUIREMENTS.md docs/fork/LEDGER.md docs/fork/audit/review-stage0.md
.gitignore:30:docs/	docs/fork/REQUIREMENTS.md
.gitignore:30:docs/	docs/fork/LEDGER.md
.gitignore:30:docs/	docs/fork/audit/review-stage0.md
exit=0
```
`.gitignore:26-31` explains why — the harness's working documentation was migrated out to a separate
RSC container in 2026-09-04, and `docs/`, `skill-build/` and `02-DOCS/` were ignored so "whoever
clones it starts coding, not reading".

Requirement §1 says "El primer commit de la implementación incluye `docs/fork/`". With `.gitignore`
as it stands, `git add docs/fork` is a **silent no-op** — not an error, which is the dangerous part.
Options: `git add -f`, or a negation (`!docs/fork/` **after** `docs/`), or move the folder. Note a
negation under an excluded *directory* is inert in some shapes — `install-apply.js:449-456` records
exactly that lesson ("git does not descend into an excluded directory, so `!.claude/rsc-bootstrap.mjs`
under `.claude/` rescues nothing"); `docs/` → `!docs/` + `!docs/fork/**` must be written and then
*verified with `git check-ignore`*, not assumed.

**Second, smaller issue:** `ci.yml`'s cleanup gate greps the whole tree with
`--exclude-dir=docs`, so nothing in `docs/fork/` is ever scanned by it. **INFERENCE:** benign today;
worth knowing that the fork's own documentation is outside the one grep gate CI runs.

**Third:** `scripts/drift-check.js:93` `TOP_DIRS` does not include `docs`, so a `docs/...` path
asserted in catalogue prose is never checked to exist. Also benign, also worth knowing.

---

## Q14. Licence check

**Repository licence — MIT.** `LICENSE:1-3`: `MIT License / Copyright (c) 2026 Eric Risco`.
`package.json` `"license": "MIT"`, `"author": "Eric Risco"`.

**Verdict on the fork's intended use: COMPATIBLE. No blocker.** MIT permits modification,
redistribution, sublicensing and publication under a different name and package, subject to one
obligation: the copyright notice and permission notice must be retained in all copies or substantial
portions. The fork must therefore keep `LICENSE` (Eric Risco's notice) in the distributed artefact,
may add its own copyright line alongside, and must not remove the parent's.

**Third-party components — complete inventory** (`find` for `*LICEN[CS]E*`, `THIRD_PARTY*`,
`NOTICE*`, `COPYING*`, plus both `UPSTREAM.json` files and the README table):

| Component | Where | Licence | Modified? | Notice shipped | Credited in README? |
| --- | --- | --- | --- | --- | --- |
| rsc itself | `LICENSE` | MIT © 2026 Eric Risco | n/a | ✅ | ✅ `README.md:12,670-672` |
| `emilkowalski/skills` (12 skills) | `skills/design-eng`, `animate`, … | MIT | adapted | ⚠️ no LICENSE file found in-tree | ✅ `README.md:661` |
| `Leonxlnx/taste-skill` (design engine) | `skills/design/engine/` | MIT © 2026 Leonxlnx | claimed unmodified | ✅ `engine/LICENSE` | ✅ `README.md:662` |
| `pbakaus/impeccable` | `skills/design/references/{modes,finish-review,design-md}.md` | Apache-2.0 © 2025 Paul Bakaus | **yes**, rewritten | ✅ `IMPECCABLE-LICENSE.txt` + "**Modified:**" in `THIRD_PARTY.md` | ✅ `README.md:663` |
| `ayghri/i-have-adhd` | `skills/orient` | MIT | adapted | ⚠️ no LICENSE file in-tree | ✅ `README.md:664` |
| `oso95/scroll-world` | `skills/scroll-film` | MIT | rewritten | ⚠️ no LICENSE file in-tree | ✅ `README.md:665` |
| **`szilu/ux-designer-skill`** | `skills/ux/upstream/ux-designer/` (30 files) | MIT © 2026 Szilárd Hajba | **unmodified** | ✅ `upstream/ux-designer/LICENSE` | ❌ **NOT in README** |
| **`hueyexe/frontend-agent-skills`** | `skills/ux/upstream/ux-usability-foundations/` (5 files) | MIT © 2026 hueyexe | **unmodified** | ✅ `upstream/ux-usability-foundations/LICENSE` | ❌ **NOT in README** |
| **`affaan-m/everything-claude-code`** | `schema/ecc-originality.u64` (746 696 B) + `.json` | **none recorded** | derived (8-gram SHA-256 fingerprints) | ❌ **no licence, no notice** | ❌ **NOT in README** |

### Answer to "is anything incompatible?" — No.

MIT and Apache-2.0 both permit modification, redistribution and renaming. Apache-2.0 adds §4(b)
(carry a copy of the licence — satisfied), §4(c) (retain attribution notices — satisfied),
§4(d) (include NOTICE if the original distributed one — `skills/design/THIRD_PARTY.md` states
"impeccable's NOTICE concerns its iOS and Android references, which are not used here", which is an
assertion I **could not verify** without network) and the requirement to mark changed files
(satisfied: `THIRD_PARTY.md` says "**Modified:** rewritten, shortened, …"). Nothing here restricts
publication under a different name or scope.

### Answer to "are all third-party components credited in the README?" — **NO. Three gaps.**

1. **`szilu/ux-designer-skill`** — MIT, shipped **unmodified and byte-pinned**, 30 files,
   `ux` is in the default install floor so it reaches every installation. Credited in
   `skills/ux/THIRD_PARTY.md` only.
2. **`hueyexe/frontend-agent-skills`** — same situation, 5 files.
3. **`schema/ecc-originality.u64`** — 746 KB of fingerprints derived from
   `https://github.com/affaan-m/everything-claude-code` at revision `90430ab3…`
   (`schema/ecc-originality.json`). `schema` is in `package.json` `files`, so this artefact is
   **published in the npm tarball**. There is **no `license` field** in its receipt, no LICENSE file,
   no notice, and no README mention. **INFERENCE (not legal advice):** 64-bit truncated SHA-256
   fingerprints of 8-grams are almost certainly not a substantial portion of the original work, so
   the exposure is low — but §3's "Conserva atribuciones y avisos obligatorios" and §14's data
   policy both want this resolved by evidence, not by my guess. The fork should record the source
   repo's licence in `ecc-originality.json`, credit it, and confirm the corpus may be redistributed.

**Also worth flagging for the fork's own README (§13 "Relación y atribución al padre"):** the README
table says "Adapted, not mirrored" for every row, which is accurate for five rows and **inaccurate**
for `skills/ux/upstream/**` and `skills/design/engine/**`, both of which are mirrored — one of them
byte-verified (Q8). The fork's attribution section has to be rewritten, not copied.

### Three non-licence inheritance risks found while checking this

1. **`release.yml` publishes on every push to `main`** with an automation `NPM_TOKEN`, which bypasses
   2FA by design. §10 asks for "permisos mínimos, 2FA para accesos humanos y mecanismos de
   publicación confiable y provenance". Provenance is present (`--provenance`, `id-token: write`);
   the auto-publish-on-push is the opposite of a minimal-permission release gate. A fork that
   inherits this workflow publishes to npm the moment anything lands on `main`.
2. **`release.yml:70-72` commits as `Eric Risco <erisco@icloud.com>`.** A fork would attribute its
   release commits to the parent's author.
3. **`package.json` `engines: {"node": ">=18"}` but the design browser gate requires Node ≥ 22**
   (`tests/design-engine.test.js:58-61`, "The browser gate needs Node 22 (global WebSocket)"), and
   CI uses Node 22. So the declared engine range includes versions on which a shipped gate silently
   skips. Minor, but it is a "garantías y límites" statement the fork's README would inherit wrong.

---

# PHASE 2 — Contrast with the four track reports and the ledger

*(written after reading `docs/fork/audit/track-a-catalog.md`, `track-b-installer.md`,
`track-c-assistants.md`, `track-d-tests.md` and `docs/fork/LEDGER.md`)*

## 0. Overall assessment of the four tracks

These are good reports. They are more thorough on vendor documentation (Track C), on the installer's
write paths (Track B), on catalogue metrics (Track A) and on test-suite behaviour under load
(Track D) than Phase 1 above. I agree with the large majority of their findings, including the one
that matters most to §5. What follows is confined to where I differ, where a claim is not supported,
where severity is wrong, and what all four missed.

**Where a track got something right that surprised me, and that I would not have found alone:**

- **Track B — `skills/harness/references/wiki-protocol.md:81-82`.** The upstream wiki protocol says
  *"Organized by topic subdirectories, **one level only**: `wiki/<topic>/<article>.md`."* The §5
  standard path `wiki/skills/<name>/README.md` is **two** levels and therefore violates upstream's
  own documented protocol. I checked Phase 1's "`wiki/skills` appears nowhere" and stopped; Track B
  went one step further and found the rule the new path breaks. This is the best single catch in the
  four reports and it changes a design decision, not just a fact.
- **Track B — `onboarding-apply.js:342` rollback can `rmSync` under `02-DOCS/`** via
  `restoreEntry`'s `existed === false` branch (`backups.js:98-113`), with the blast radius correctly
  bounded to the three files in `governedPaths` (`onboarding.js:328-330`). I had read
  `onboarding-apply.js:385-386` and concluded the floor was outside the transaction; Track B found
  the one path where a revert does reach inside `02-DOCS/`.
- **Track D — three skills whose `capability` entries are malformed.** `ux`, `variant-explorer` and
  `viral-score` use `prompt:`/`why:` where the engine requires `scenario:`/`must_include:`, so they
  pass `eval-lint` and are **un-evaluable by the semantic engine**. I verified it and it is exactly
  right. I did not have this, and it is worse than Track D says — see Gap 4 below.
- **Track C — the non-Claude hook surface.** Track C called this "the finding most likely to be
  missed" and it was right: auditing only `targets/claude.js` yields "Claude only", and
  `targets/memory.js:94-118`, `targets/knowledge-wiring.js:27-33` and `targets/update-wiring.js:28`
  show five more assistants with real, wired, vendor-documented events. My Q11 was built from all
  the wiring modules and still landed on a narrower claim than Track C's; the reconciliation is in
  Discrepancy 4.
- **Track D — the suite's behaviour under load.** 2 h 16 m 55 s, 39 failures in parallel, 28 of
  which disappear when run serially, with the mechanism identified (`LOCAL_TIMEOUT_MS = 4_000` in
  `knowledge-sync.mjs:66`). That is real experimental work and the honest headline it draws — "no
  confirmed upstream failure, but not reliable under load and far too slow to be a maintenance gate"
  — is better than either "the suite is green" or "the suite is broken".

---

## 1. Discrepancies

### Discrepancy 1 — **The always-on size budget. The headroom is 2 bytes, not 720.** *(decisive)*

| Source | Claim |
| --- | --- |
| `track-c-assistants.md:554` | "Headroom for a governance preamble inside the existing ceiling: **720 bytes**." |
| `track-c-assistants.md:1131` | "6,620–7,280 bytes already, against a repo-enforced 8,000-byte ceiling. **~720 bytes of headroom**" |
| `LEDGER.md:254` | "`BODY_CEILING_BYTES = 8000` … **720 B de holgura**. **Verificado por el coordinador.**" |
| **This review** | **2 bytes.** |

**Who is right: this review.** There are **two** ceilings on `skills/suggest/SKILL.md`, and all four
tracks and the ledger found only the looser one.

```
tests/always-on-body.test.js:16     const BODY_CEILING_BYTES = 8000;        // assert bytes < 8000  -> max 7999
tests/clone-bootstrap.test.js:350   assert.ok(bytes <= 7282, `always-on body is ${bytes} B, over the 7282 B ceiling …`)
```
`wc -c skills/suggest/SKILL.md` → **7280**. `7282 − 7280 = 2`.

**Evidence that nobody found it:** `grep -rn "7282\|clone-bootstrap.test.js:350\|AC#19"` across
`track-a-catalog.md`, `track-b-installer.md`, `track-c-assistants.md`, `track-d-tests.md` and
`LEDGER.md` returns **zero matches**. Track B does cite `tests/clone-bootstrap.test.js` nine times
(`track-b-installer.md:741`) — for the `npx @ericrisco/rsc…` strings at lines 223–404 — so the file
was read, and the ceiling at line 350 sits in the middle of that range and was passed over.

**Why this is the most consequential error in the audit.** The 7282 test exists precisely to stop
this: `clone-bootstrap.test.js:339-348` records that the body grew by 99 bytes for a feature and
says *"The next person who adds 'just a couple of lines' to a surface everyone pays on every turn
now argues with a failing test instead of a habit."* A plan budgeted on 720 bytes will be written,
approved, and then fail on its first commit — and because the ledger marks 720 as
**coordinator-verified**, nobody downstream has a reason to re-check it. The error is 360×.

**What it does not change:** Track C's byte breakdown is otherwise correct and more precise than
mine — the *injected payload* differs by adapter (≈6,620 B for the md/cursor family with frontmatter
stripped, plus a 270-byte `UPDATE_NOTE` for md targets only; 7,280 B of file for Claude's
`SessionStart`). The ceiling tests measure the **file**, which is why the headroom is 2 bytes
regardless of adapter.

**What the fork must do:** treat the ceiling as a **deliberate, argued change to two tests**, raise
it by a stated amount with the reason recorded, and re-measure. Do not plan a governance preamble
"inside the existing ceiling".

### Discrepancy 2 — **The internal-skill count: Track A says 22, Track D says 29. Settled: 27.**

`LEDGER.md:370` refers this to me: *"Track A fija el conjunto de skills internas de §11 en 22;
Track D lo fija en 29 … Derivada al revisor independiente para que la zanje con evidencia."*

**The two lists measure different things, and each has a defect.**

**Track A's 22** (`track-a-catalog.md:589-595`) is mechanism-based, which is the right method. Two
defects:

1. **`backups` is a false positive — a text match where a structural match was needed.** Track A's
   evidence (`track-a-catalog.md:547`) is *"`install-apply.js`, `backups.js`, `doctor.js`,
   `rsc.js(2)` | backup/restore machinery"*. I checked every one of the 29 `backups` hits in
   `scripts/` and `targets/`:
   ```
   scripts/install-apply.js:18   import { createBackup } from './lib/backups.js';
   scripts/install-apply.js:768  … join(cwd, '.rsc', 'backups', backup.id) …
   scripts/doctor.js:11          import { listBackups } from './lib/backups.js';
   scripts/doctor.js:248         exists: existsSync(join(root, '.rsc', 'backups'))
   scripts/rsc.js:80             COMMANDS = new Set([… 'backups', 'restore', …])
   scripts/lib/onboarding.js:326 '.rsc.json', '.rsc/backups/',
   ```
   Every single one is the backup **library** (`scripts/lib/backups.js`), the backup **directory**
   (`.rsc/backups/`), or the `rsc backups` **CLI subcommand**. The skill `skills/backups/` is a
   *database-backups* skill: `scripts/lib/domains.js:23` files it under
   *"Databases & data layer"* next to `postgresdb`, `mysql`, `db-migrations`. **Zero harness-code
   references to the skill.** This is the exact failure mode upstream's own `refuter-correctness`
   agent body warns about (`targets/agents.js:117-118`): *"Watch for a check that matches **text**
   where it should match **structure**."*
2. **The list is internally inconsistent with its own criterion.** Track A says the set is *"the
   union of tiers 1–5"*, explicitly excluding tier 6 (slash-command backed) — yet the 22 include
   `review`, `plan`, `verify`, `specify`, `knowledge-ops` and `ship`, all of which are tier-6
   members, while excluding the other seven tier-6 members (`analyze`, `clarify`, `debug`,
   `implement`, `tasks`, `simplify-code`, `security-scan`). Either tier 6 counts or it does not.
   It should: a slash command the installer materialises is harness machinery by construction
   (`targets/commands.js:81-83` writes the file; `fixedFor()` gates it on
   `skillSet.has(command.backing)`).

**Track D's 29** (`track-d-tests.md:857`) is **topical, not structural** — "a candidate set of
harness-internal / workflow skills". Three defects, one of them serious:

1. **It omits four of the eight unconditional floor members**: `unslop`, `connect-tool`, `design`
   and `ux` are absent. `scripts/lib/default-skill-floor.js:29` installs all eight on **every**
   installation path (`withDefaultSkillFloor` at `install-apply.js:719`, `rsc.js:686,802,828`).
   This is the more serious of the two lists' errors: `design` and `ux` additionally ship
   third-party subtrees, and `ux` is the skill Track D itself proves is un-evaluable.
2. **Eleven of its 29 have no structural basis.** I ran the census again over every `.js`/`.mjs`
   under `scripts/` and `targets/`, excluding `domains.js`:
   ```
   code-review                   0 references
   source-grounded-development    0
   decision-records               0
   context-budget                 0
   continuous-learning            0
   agent-eval                     0
   agent-safety                   0
   author-skill                   1   scripts/skill-harden.workflow.js:170   (a maintainer workflow)
   skill-scout                    1   scripts/lib/capabilities.js:187        (a help string)
   parallel                       9   — all of them the Workflow primitive `parallel(…)` and the
                                        English word, e.g. skill-scoreboard.workflow.js:3 "in parallel",
                                        :27 `await parallel(`. Same text-match defect as `backups`.
   sdd-init                       2   scripts/rsc.js:512,527                 (a printed next-step)
   ```
3. It also omits `git-workflow`, `knowledge-ops`, `tasks`, `simplify-code` and `security-scan`.

**Settled answer: 27**, by the criterion stated in Phase 1 Q4 (harness code depends on it, via one
of six mechanisms; `domains.js` membership excluded). The set-algebra:

```
A ∩ D  (both agree)        : constitution ftd harness init orient plan review ship
                             sdd sdd-init specify suggest tidy verify worktrees      (15)
Mine, rejecting A's errors : + clarify tasks analyze implement debug simplify-code security-scan
                             + unslop connect-tool design ux git-workflow knowledge-ops
                             − backups (false positive) − sdd-init (a printed hint, not a mechanism)
Mine, rejecting D's errors : − author-skill skill-scout code-review source-grounded-development
                             decision-records context-budget continuous-learning parallel
                             agent-eval agent-safety
```

**Budget impact, measured** (gradeable scenarios, i.e. entries with both `scenario:` and
`must_include:` — the engine's own requirement; `1 + 3N` agent runs per skill):

| List | Skills | Gradeable scenarios | Agent runs |
| --- | --- | --- | --- |
| §11's literal three (`suggest`, `ftd`, `sdd`) | 3 | 9 | 30 |
| Track A | 22 | 35 | 127 |
| **Settled (this review)** | **27** | **40** | **147** |
| Track D | 29 | 43 | 158 |

So the dispute is worth 20–31 agent runs per internal pass. The **number** barely matters; the
**composition** does, because Track D's version leaves four always-installed skills unevaluated and
Track A's wastes a slot on a database skill. If the fork prefers a wider net, add `sdd-init` (28) —
it is the SDD entry point and cheap. Do not add the other ten.

### Discrepancy 3 — **The `02-DOCS` occurrence counts: three different numbers, all correct, none labelled.**

| Source | Claim |
| --- | --- |
| `track-a-catalog.md:848,1139` / `LEDGER.md:137` | "**151** hard-coded `02-DOCS` literals in **34** harness source files" |
| `track-c-assistants.md:30,628,659` | "**536** code occurrences across **81** files", "81 are `.js`/`.mjs`" |
| `track-b-installer.md:1275` | "**90+** hard-coded `'02-DOCS'` literals" |
| `LEDGER.md:64` (F7) | "`02-DOCS` aparece en **316 archivos**" |

**Measured reconciliation — all three of the first, and F7, are right about different denominators:**
```
grep -ro "02-DOCS" scripts targets --include='*.js' --include='*.mjs' | wc -l   -> 151   (34 files)
grep -ro "02-DOCS" tests           --include='*.js' --include='*.mjs' | wc -l   -> 385   (47 files)
                                                                    sum = 536   (81 files)
grep -rl "02-DOCS" . (excl. node_modules/.git/coverage/docs)        | wc -l     -> 316 files
plus:  skills/ prose  1052 occurrences in 227 files        README.md 14        site/ 33
```
So **151/34 is production code**; **536/81 is production code *plus tests*** and Track C labels it
"code occurrences", which will mislead anyone sizing the work; **316** is files repo-wide including
prose. **Track B's "90+" is simply low** and should be dropped in favour of 151.

**Who is right:** Track A for code (151/34 — my own 152/35 was one higher because I did not filter
to `.js`/`.mjs` and picked up `scripts/skill-harden-rubric.md`; Track A's figure is the better one).
Track C's arithmetic is right but its label is wrong.

**The honest total a configurability decision must be sized against is ~1,636 occurrences in ~314
files**, of which **1,052 in 227 skill files are instructions to a model** and cannot be regexed.
No track stated that total, and Track A's and Track C's numbers are the two that will be quoted.

### Discrepancy 4 — **Code-enforced governance: Track C's "3 full + 3 partial" answers a different question than it appears to.**

Track C's table header (`track-c-assistants.md:382`) is *"real pre-prompt / pre-tool / session-start
event available **to this harness today**"*, and it lists `PreToolUse` for **codex** and `BeforeTool`
for **gemini**, with verdicts "**Full**, after user `/hooks` trust" and "**Full**".

**That is a statement about the vendors, not about this repository.** I checked every wiring module:

```
targets/claude.js:112-320      PreToolUse (Bash) x4 guards, Stop, UserPromptSubmit, PostToolUse, …
targets/memory.js:94-118       claude/codex/deepseek -> PostToolUse ;  gemini -> AfterTool
targets/knowledge-wiring.js:27-33  prompt + turn events only (UserPromptSubmit/Stop, BeforeAgent/AfterAgent,
                                   beforeSubmitPrompt/afterAgentResponse)
targets/update-wiring.js:28    SessionStart / sessionStart only
targets/git-permissions.js:41-44   static permission rules (claude, codex, gemini, opencode)
```
**No `PreToolUse`, `BeforeTool`, `preToolUse` or `tool.execute.before` is wired for any target other
than `claude`.** The memory adapter uses `PostToolUse`/`AfterTool` — *post*, which by construction
cannot deny. Track C itself notes "(`BeforeTool` not yet used by the repo)" in the gemini row, then
scores gemini "Full" anyway.

**Settlement — the two numbers are both right, for two different questions:**

- **Vendor-possible code enforcement: 6 of 18** (claude, codex, gemini, cursor, opencode, deepseek).
  **Track C is right**, its vendor-documentation table (`:291-365`) is the most valuable single
  artefact in the four reports, and it correctly refutes the naive "Claude only" (which the ledger
  records as refuted inference I2 — also right).
- **Wired in this repo today with a path that can deny: 1 of 18 — `claude`.** Upstream's own code
  agrees: `scripts/doctor.js:343` `HOOKLESS_TARGETS = new Set(TARGET_IDS.filter((t) => t !== 'claude'))`,
  and `README.md` (quoted at `LEDGER.md:71`) says *"the hard guards run only in Claude Code"*.
- **Code-run context injection wired today: 6** (the same six; `knowledge-sync.mjs:993-1012` shapes
  `additionalContext` / `user_message`, and `opencode-memory-plugin.js` pushes into the system
  prompt).
- **Impossible in principle: Track C says 4** (`roo` discontinued, `zed` no hook mechanism, `jules`
  no local execution surface, `continue` no published docs). I **cannot verify** any of those four
  vendor claims offline; they are the kind of claim §4 warns against *inventing*, and they decide
  which assistants the fork promises support for (§14). They should be re-verified with sources
  before the support matrix is published.

**Why the distinction is load-bearing:** a Stage-1 design that reads "codex: Full" will assume a
deny path exists there. It does not exist in this codebase, has never been exercised by a test, and
building it means writing a new guard for a second vendor's hook contract — which is work, not a
property.

### Discrepancy 5 — **Capability-scenario inventory: Track D's 312 is the better number; my 318 is the raw count.**

Track D uses **312** scenarios / **≈1,210** full-catalogue agent runs (`:864`). I measured **318**.
Both are right:
```
loose entry count (any list item under capability:)          = 318
gradeable (entry has BOTH `scenario:` and `must_include:`)   = 312
ungradeable: viral-score (2/0), ux (2/0), variant-explorer (2/0)
```
**Track D is right for budgeting** (312 → `274 + 3×312 = 1210`), because the engine
(`skill-behavior-eval.workflow.js:78-81`) requires `scenario` + `must_include`. My 318 is the
correct *inventory* figure and the right one for "how many scenarios exist to fix". Phase 1 Q10's
1,228 should be read as 1,210; I defer to Track D.

### Discrepancy 6 — Smaller corrections

- **`track-a-catalog.md:589` "at least 22"** and **`:1135` "at least 22 skills are structurally
  internal"** are hedged, which is honest — but `LEDGER.md:144` converts the hedge into a flat
  *"El conjunto de skills internas de §11 son 22, no 3"*. The hedge should have survived the
  promotion to the ledger.
- **`track-a-catalog.md:757` "the 24 skills that do follow the `wiki/stack/<id>.md` pattern"** vs
  my Phase 1 Q5, which found eight by grepping `02-DOCS/wiki/stack`. Track A is counting a looser
  pattern (any `wiki/stack` mention, ~35 heading variants per `LEDGER.md:139`). Track A is right and
  more thorough here; my eight was a spot check, not a census. I defer.
- **Track C's `README.md:368-369` claim about the `md` family covering 16 targets** matches
  `targets/index.js:64` (3 adapters) and my count. Agreement.

---

## 2. Unsupported claims

Each of these is asserted as fact in a track or the ledger and I could not reproduce it, or it is an
inference wearing a fact's clothes.

1. **`LEDGER.md:254` — "720 B de holgura. Verificado por el coordinador."** The verification
   confirmed the wrong constant. See Discrepancy 1. An independent verification that reads only the
   file the first report cited is not independent.
2. **`track-a-catalog.md:547` — `backups` as harness-internal "backup/restore machinery".** Not
   reproducible: zero references to the skill. See Discrepancy 2.
3. **`track-d-tests.md:857` — "a candidate set of harness-internal / workflow skills … 29 of them
   exist".** The existence claim is true; the *internal* claim is unsupported for 11 of the 29, 7 of
   which have zero harness-code references. The report calls it a "candidate set", which is fair —
   but `LEDGER.md:370` elevates it to a competing authoritative count.
4. **`track-c-assistants.md:382-387` — codex and gemini scored "Full" code enforcement.** The deny
   mechanism is vendor-documented (supported) but **not wired here** (unsupported as written, given
   the column header). See Discrepancy 4.
5. **`track-c-assistants.md:391-399` — "`roo` … Product discontinued 2026-05-15", "`zed` … No hook
   mechanism exists", "`jules` … No local execution surface at all", "`continue` … No published hook
   docs", plus the vendor-hook claims for copilot (`:1052`, "`.github/hooks/*.json`, 14 events,
   `preToolUse` deny, fail-closed"), cline (`:1054`), windsurf, kiro, antigravity, amp.** All
   **NOT VERIFIED** by me — no network. They are presented without a URL in the summary table
   (unlike the excellent `:291-365` table, which does carry URLs). These claims decide §14's target
   matrix and §4's "no inventes hooks"; they need a dated source each before publication.
6. **`track-b-installer.md:409` — "The customisation is recoverable from git history (the delete is
   itself committed)."** This is correct and I verified the mechanism
   (`knowledge-sync.mjs:601-604` commits the `git rm`), so recovery via `git log --diff-filter=D` is
   genuinely available. I flag it only because it is the one place where Track B is *less* alarmed
   than warranted and I was *more* alarmed than warranted — see my own correction in §4 below.
7. **`track-b-installer.md:1098` — "2FA status is not exposed by the registry API and cannot [be
   determined]"** marked `[Q]`. Correctly marked. I note it because §10 requires 2FA for human
   access and the fork will own that account, so it is answerable by the user, not by inspection.
8. **The `prepublishOnly` chain as a safety net.** Several places treat
   `manifest && validate && drift:check && originality:check` as a release gate. It is **bypassed by
   the actual release path**: `.github/workflows/release.yml:118` runs `npm publish --provenance`,
   and npm does run `prepublishOnly` — but the workflow has already run `validate`,
   `manifest:check`, `npm test`, `eval-lint` and `originality:check` as separate steps and does
   **not** run `drift:check`. So `drift:check` reaches the release only through `prepublishOnly`,
   which no track states. Minor, but it is the one gate whose coverage depends on an npm lifecycle
   hook rather than on a visible workflow step.

---

## 3. Overstatements and understatements

### Overstatements

1. **`track-b-installer.md:400-402` — "The guard that makes this survivable".** The guard
   (`mine === base && committed === base`) protects the **locally modified** file and not the
   **committed clean** one. That is the inverse of what §5 requires, and calling it the thing that
   makes the behaviour survivable understates the gap even though the very next paragraph
   (`:407-412`) states the residual risk correctly. The heading frames a §5 violation as a
   mitigation.
2. **`LEDGER.md:138` (A3) — "La transición de §5 es aditiva, no destructiva."** The *path* is virgin
   (true, verified: zero `wiki/skills` matches). The *transition* is not purely additive: the new
   subtree lands inside `KNOWLEDGE` (overwrite/`git rm`/auto-push), inside
   `scripts/lib/eval-integrity.js:117`'s `PROTECTED_PATHS = ['02-DOCS/wiki/']` (so eval arms are
   blocked from writing there — convenient), and in violation of the one-level wiki protocol Track B
   found. "Additive" is right about collisions and wrong about consequences.
3. **`track-c-assistants.md:1131` — "Uniformity of the delivered text: achievable … already lands on
   17 of 18".** True of the *block*, but the block cannot grow (Discrepancy 1) and
   `targets/_md-block.js:28-31` shows that an accepted plan with `codeHooks === false` **and**
   `laneGate === false` substitutes a ~300-byte stub instead. So "uniform text" holds only for
   projects whose committed plan enables the lane gate. Track A noted the stub (`:518-523`); Track C's
   uniformity claim does not carry the caveat.
4. **`track-d-tests.md:338` — `originality:check` risk "Medium … unchanged by governance work".**
   It is a gate that **checks nothing about skills**: `scripts/originality-check.js:43-55`,
   `catalogDocuments()` = `stackAgents()` + `resolveCommands()`, and the executed output is
   `82 documents` = 34 agents + 48 commands. Track A got this right
   (`:1010` *"It fingerprints agents and commands, never skills"*); Track D's risk rating implies
   it covers the catalogue. "Unchanged by governance work" is also wrong in one direction: if the
   fork adds governance text to **command bodies** (`targets/commands.js`), it *is* fingerprinted.

### Understatements

5. **`track-d-tests.md:340` — `reviewer-guard.sh` risk "None at this commit … vestigial".** Fair as a
   risk rating, but it understates what it reveals: `ci.yml:24-31`'s cleanup gate exists to catch
   *"old marketplace-distribution residue"* and greps for
   `sync-bundles|\.claude-plugin/marketplace|/plugin install …@rsc-skills`. A whole script
   referencing a non-existent `plugins/rsc-review/agents` tree is exactly that residue and the gate
   is blind to it. The gate's **shape** is wrong, not just its result — and the fork inherits it as
   its only repo-wide hygiene grep.
6. **`eval-lint.sh` failing open.** Track D flags it correctly as a defect to fix
   (`:833-836`). What is understated: it is in **both** `ci.yml` and `release.yml`, its deep check
   depends on an *unpinned, uninstalled, unasserted* `python3` + PyYAML on the runner, and its own
   `route_to` resolution is the one deterministic check that `evals/cases.yaml` points at real
   skills. One runner-image change converts two release gates into no-ops silently. That is a
   supply-chain-shaped risk, not a lint defect.
7. **`routing:audit` being red.** Track D's treatment (`:342-364`) is the strongest in the four
   reports and its recommendation (wire it into CI with the base number as the baseline) is right.
   The understatement is in the ledger: `LEDGER.md:333` groups it with the three vacuous validators
   under "falsa señal verde", which is the opposite problem. A **red** validator and a **vacuous**
   one need different responses: the red one needs a recorded baseline before any change, the
   vacuous ones need a fixture.
8. **`track-c-assistants.md:1122-1124` — opt-outs "must be qualified as 'guaranteed unless the
   project opted out'".** Correct and well-sourced, but it is stated as a documentation caveat.
   `targets/opt-outs.js:19-35` makes it stronger than that: **15 of the 20 switches are *designed*
   to travel in the committed `.rsc.json`**, with the rationale written out
   (*"decisions should not evaporate on `git clone`"*) and a `rscFixes` entry
   (`package.json`, `fixedIn: 2.0.6`) proving upstream treated non-propagation as the bug. §6 asks
   the fork to document code guarantees; the honest documentation is that the fork's governance
   guard is, by inherited design, a **project-level opt-out**, and making it non-disarmable is a
   deliberate divergence from upstream's philosophy that should be named in the plan.

---

## 4. Corrections to my own Phase 1

Stated here rather than edited above, so the record shows what changed and why.

1. **Q5 was over-pitched on data loss.** Track B is right (`:409`): `applyIncoming`'s `git rm` is
   itself committed, so a deleted customisation is recoverable with
   `git log --diff-filter=D -- 02-DOCS/wiki/skills/...`. My Phase 1 wording ("destroys") should read
   **"silently removes from the working tree and commits the removal, recoverable only from
   history"**. The §5 violation stands — a governance document mutated and committed without consent
   is a §5 violation whether or not git can undo it — but it is not unrecoverable data loss. The one
   genuinely unrecoverable path is `purge --with-docs`, which takes no snapshot by design
   (`install-apply.js:845-852`).
2. **Q3's 152/35 → 151/34** for `.js`/`.mjs` production code; Track A's figure is the better one.
3. **Q10's 1,228 → 1,210** catalogue-wide agent runs; Track D's 312-gradeable figure is the right
   budgeting base. 318 remains the inventory count.
4. **Q11 was too narrow as a general statement.** "Claude only" is right for *wired today with a
   deny path*; Track C is right that *vendor-possible* is 6. Both numbers belong in the plan,
   labelled.

---

## 5. Gaps — material to §3, §4, §5, §6, §9, §10 or §11, missed by all four tracks

### Gap 1 — The binding always-on ceiling (§6, §11). *Already Discrepancy 1; listed here because it is also a gap.*

Zero mentions of `7282` anywhere in the four reports or the ledger. Material to §6 (the contract has
to be delivered somewhere) and §11 (a test that will fail on the first governance commit).

### Gap 2 — `readManifest` silently drops unknown `.rsc.json` keys, so a fork-added key is erased by any parent CLI run. (§10)

`scripts/lib/manifest-file.js:20-50` does not return the parsed object. It returns a **fixed
projection** over `KEYS`:
```js
return { version: raw.version ?? 1, targets: raw.targets || [], skills: …, agents: …, ownSkills: …,
         catalogVersion: …, tier: …, optOuts: …, memory: …, gitPermissions: …, agentModels: …, onboarding: … };
```
and `writeManifest` is fed from `recordInManifest` (`install-apply.js:210-233`), which composes
exactly those keys from `prev` — i.e. from the projection. **Any key the fork adds to `.rsc.json`
(a package-identity key, a governance-contract version, a customisation-root override) is silently
erased the next time a *parent* version of the CLI writes the manifest in that project**, and
erased without error, which is the dangerous part.

Track A proved the *opposite* property for **skill frontmatter** (`:280`, `:364`: `origin: risco`
ships on all 274 skills as an unvalidated extra key, and `schema/frontmatter.schema.json` has no
`additionalProperties: false`), and reasonably concluded a governance key in frontmatter survives
validation. Nobody carried the question across to `.rsc.json`, where the answer is reversed.

**Why it is material:** §10 requires the fork to "evitar reinstalar accidentalmente el padre" and
to "verificar identidad, versión e integridad" before activating. A project in the wild may have
**both** CLIs run against it (a teammate on the parent, a teammate on the fork). The fork's identity
marker must therefore live somewhere the parent cannot erase — a sibling file, or the bootstrap, or
a key the fork accepts as absent-but-inferable — not in `.rsc.json` alone.

### Gap 3 — Nothing in upstream can validate a *consumer's* `02-DOCS/`. All three knowledge validators are maintainer-only. (§5, §11)

Track D correctly executed all three to a vacuous pass and said so (`:327,334,774`), and the ledger
records it (`LEDGER.md:321-323,333`). What nobody said is **why**, and the why is the gap:

```
scripts/knowledge-doctor.js:19-20   const REPO = <this repo>;  const WIKI = join(REPO,'02-DOCS','wiki');
scripts/drift-check.js:267          export function checkKnowledge({ root = REPO, home = homedir() })
scripts/spec-gate.js:14             const DEFAULT_DIR = join(ROOT, '02-DOCS','wiki','sdd','specs');
```
All three resolve against **the harness's own repository root**, not against a consumer's `cwd`.
They are maintainer tools pointed at the maintainer's private wiki (which this repo gitignores). They
are not vacuous "because the fixture is missing" — they are vacuous **by design**, and they cannot be
pointed at a consumer project without a signature change.

**Why it is material:** §5 requires that *"un archivo existente pero ilegible, inválido o
contradictorio no debe tratarse silenciosamente como ausente"*, and §11 requires a test for
"Documento ilegible o contradictorio". There is **no existing machinery** to extend — the fork is
building a consumer-side validator from zero, and `knowledge-doctor`'s classifier
(`scripts/lib/knowledge-doctor.js:26-35`: `STALE` / `MISPLACED` / `CONTRADICTS`, with the
`MISPLACED` rule keyed to a folder holding 75 % of a `type:`'s documents) is a **maintainer's
heuristic**, not a reusable library. Track D's "PARTIAL" rating for §11 row 2 (`:718`) is right about
the test coverage and silent about the fact that there is no component to test.

A second-order consequence nobody raised: if the fork gives
`02-DOCS/wiki/skills/<id>/README.md` a `type:` frontmatter value that is also used elsewhere in a
project's wiki, `knowledge-doctor`'s 75 %-dominant-share rule can classify the whole new subtree as
`fuera-de-sitio`. That is an **inference**, not a fact — but it is cheap to design around and
expensive to discover later.

### Gap 4 — One of the eight unconditionally-installed skills (`ux`) is un-evaluable by the semantic engine, and `eval-lint` passes it. (§11)

Track D found the three malformed skills (`ux`, `variant-explorer`, `viral-score`) and called it an
upstream defect to fix (`:836`). What nobody said: **`ux` is in `DEFAULT_SKILL_FLOOR`**
(`default-skill-floor.js:29`; `tests/ux-upstream.test.js:66` asserts it). So the skill that ships to
**every project**, that carries **two byte-pinned third-party subtrees**, and whose description is
one of the 139 over the soft ceiling, is the one whose behaviour the semantic gate **cannot measure
at all** — while `eval-lint` reports it green. Verified:
```
ux: 2 capability entries, 0 gradeable  (uses `prompt:`/`why:`, engine needs `scenario:`/`must_include:`)
```
And because `skills/ux/upstream/**` is hash-pinned *and* file-list-pinned
(`tests/ux-upstream.test.js:29` `assert.deepEqual(shipped, Object.keys(source.files).sort())`), the
fork **cannot even add a file** under that subtree — so fixing `ux`'s evals and governing `ux` both
have to happen in `skills/ux/SKILL.md` and `skills/ux/evals/cases.yaml` only. Track A got the
freeze right (`:1016`); the intersection with the floor and with the eval gap is the gap.

### Gap 5 — `package.json` declares `engines: {"node": ">=18"}`, but a shipped gate needs Node ≥ 22 and silently skips below it. (§6, §15)

```
package.json                      "engines": { "node": ">=18" }
tests/design-engine.test.js:58-61 const nodeMajor = Number(process.versions.node.split('.')[0]);
                                  const gateSkip = nodeMajor < 22 ? `Node ${…} < 22` : !chrome ? 'no Chrome…' : false;
                                  // "The browser gate needs Node 22 (global WebSocket) … Where either is
                                  //  missing the test says so instead of passing"
```
`ci.yml` and `release.yml` both use Node 22, so CI exercises it. A **user** on Node 18–21 installs a
`design` skill whose browser gate cannot run, and `skills/design/SKILL.md` is required by
`tests/design-engine.test.js:80-82` to say `inspector not run: <reason>` — i.e. upstream handles it
honestly *in prose*, while the package metadata promises Node 18. §6 demands the fork document
"garantías implementadas mediante código" separately from model-dependent rules, and §15 forbids
declaring ready anything untested. This is a declared guarantee that is conditional on an undeclared
runtime. One mention of Node 22 exists across the four reports (`track-b-installer.md:1010`, about
the CI runner); nobody connected it to `engines`.

### Gap 6 — The third-party-derived originality corpus is **published in the npm tarball** with no recorded licence. (§3, §14)

Track A flagged the licence question and was honest about not resolving it (`:1038-1040`:
*"everything-claude-code's own licence was not inspected"*). The missing half is distribution:
```
package.json  "files": ["scripts","targets","schema","skills","manifest.json", …]
schema/ecc-originality.u64     746 696 B
schema/ecc-originality.json    { "source": "https://github.com/affaan-m/everything-claude-code",
                                 "revision": "90430ab3a716e12a9c6770802efa352098735f24",
                                 "fingerprintCount": 93337 }   <- no "license" field
```
`schema` is in `files`, so every published version of the package **redistributes** 746 KB of data
derived from a third-party repository, with no licence recorded, no notice, and no README credit.
§3 says *"Conserva atribuciones y avisos obligatorios"* and §14 requires a data policy.
**My inference (not legal advice):** 64-bit truncated SHA-256 fingerprints of 8-grams are almost
certainly not a substantial portion of the original work, so exposure is low — but the fork is about
to publish under a new name and should resolve it by evidence: record the source licence in
`ecc-originality.json`, credit it, or regenerate the corpus from a source whose terms are known.

### Gap 7 — `release.yml` publishes on **every push to `main`**, and commits under the parent author's identity. (§10)

Track B found both pieces (`:1026` the git identity, `:1116` the `npm view` calls, `:1024` the gate
list) and the ledger records the registry facts (`LEDGER.md:209`). What is not stated as a risk
anywhere: the **trigger**.
```
.github/workflows/release.yml:   on: push: branches: [main]      # + workflow_dispatch
  :107  npm version "$BUMP" --no-git-tag-version                 # auto-patch on every push
  :118  npm publish --provenance --access public                 # NODE_AUTH_TOKEN: secrets.NPM_TOKEN
  :70-72 git config user.name "Eric Risco" / user.email "erisco@icloud.com"
```
So anything that lands on `main` — including a documentation commit, including the fork's first
commit of `docs/fork/` — auto-bumps the patch version and **publishes to npm**. §10 requires
"permisos mínimos, 2FA para accesos humanos y mecanismos de publicación confiable"; an automation
`NPM_TOKEN` bypasses 2FA by design, and provenance (present, via `id-token: write`) protects
*integrity*, not *intent*. The fork must change the trigger (tag-driven or `workflow_dispatch`-only)
**in the same commit** that reconfigures the remotes, or its first push publishes a package. This is
the one gap that can cause damage before Stage 1 begins.

### Gap 8 — The outbound half of knowledge-sync is a data-policy question, and it was found but not framed as one. (§5, §14)

Credit where due: `track-c-assistants.md:767` states that `02-DOCS/wiki/` files are
*"auto-committed and auto-pushed to `rsc/knowledge` by a hook, on 6 assistants, without the person
asking"*, and `LEDGER.md:266` records it as an extension of B-R1. So this is **not** a gap in the
facts. It is a gap in the **framing**: no track or ledger entry routes it to §14's *"Política de
datos"*, where it belongs. A per-project governance document can record "we chose BLoC because the
2024 audit found X", "customer Y requires Z", or an exception with a named owner — and the default
behaviour pushes that text to a shared branch on `origin` the moment the turn ends
(`commitLocal` → `ship` → `replay` → `commit-tree` → push, `knowledge-sync.mjs:285-520`). The
decision the user has to make is not "is this a §5 preservation risk" (answered) but "do governance
decisions auto-publish to the team remote by default" (unasked).

### Gap 9 — `01-TOOLS` is a second hard-coded root, and the onboarding floor binds the two. (§3, §5)

All four tracks mention `01-TOOLS` in passing and Track C correctly notes there is no `03-` tier and
no code that parses the numeric prefix (`:623`). What nobody stated is the coupling:
```
scripts/lib/onboarding-apply.js:373  HARNESS_FLOOR_MINIMUM = ['01-TOOLS/_TEMPLATE/', '02-DOCS/wiki/harness/']
                               :397  assertManagedPathsStayInsideRoot(cwd, ['01-TOOLS/', TEMPLATE_FLOOR, '02-DOCS/wiki/harness/'])
targets/knowledge-sync.mjs:48        KNOWLEDGE = ['01-TOOLS/', '02-DOCS/wiki/', '02-DOCS/attachments/']
```
plus **50** `01-TOOLS` occurrences in code and **116** in `skills/`. A configurable documentation
root that leaves `01-TOOLS` fixed produces a half-moved harness whose completion gate
(`RSC_ONBOARDING_INCOMPLETE`) still looks for the old sibling. Since the audit's answer to §3 is
"not configurable, and the fork keeps it fixed", this is a *latent* gap rather than an active one —
but it is the reason the "make it configurable later" option is more expensive than the 151-site
number suggests.

### Gap 10 — The two stale target counts in upstream comments, and the one in `capabilities.js` that contradicts a passing test. (§3)

Track B found `doctor.js:160`'s "all 272 of them" and verified 274 (`:243-252`); Track C recorded it
too (`:1155`). Three more, unfound:
```
scripts/lib/capabilities.js:19-20   "8 of 17 targets have file-based agents; on the other 9 …"
                                    -> but tests/capabilities.test.js:171 asserts
                                       TARGET_IDS.length - withAgents.length === 10   (18 - 8)
tests/clone-bootstrap.test.js:330   test title: "the 15 hookless targets"
                                    -> scripts/doctor.js:343 computes 17
scripts/install-apply.js:376        "a cleanup that only worked for one of the sixteen assistants"
```
Minor individually. Material collectively because §3 says *"no fijes el número de skills en el
código"* and the same discipline applies to targets: the fork will quote these numbers in its README
(§13) and its support matrix (§14), and **three of the four numbers a reader would find by grepping
comments are wrong**. The only correct sources are `targets/index.js:188` (`TARGET_IDS`) and
`tests/capabilities.test.js:171`.

---

## 6. Risk assessment — my independent top five

Ranked by *probability × damage × how late it would be discovered*, not by how interesting they are.
Each names what would have to be true for the risk to be retired.

### Risk 1 — There is nowhere to put the governance contract. *(certain, blocks §5 and §6)*

The contract has to be present on every invocation path, including automatic and internal ones
(§5.1–5.5, §6). The three candidate channels are all closed or costly:

| Channel | State |
| --- | --- |
| Always-on injected body | **2 bytes of headroom** against `tests/clone-bootstrap.test.js:350` (7282, `<=`), and three wording invariants in `tests/always-on-body.test.js:23-79`. It is also the *only* channel for the 17 assistants with no per-turn gate. |
| Per-turn gate (`SDD_GATE_TEXT`) | Claude Code only; measured by `doctor.js` from the same constant; and the body is forbidden from reproducing its lines (`always-on-body.test.js:71-79`). |
| Per-skill `description` | 1,024 hard limit, 350 advisory — **139 of 274 already over**, `npm run validate` exits 0 anyway, and `routing:audit` is **already red at 84.9 %** and is the validator most sensitive to description text. |
| Per-skill body | Free of a byte gate, but paid only when the skill loads — which is the right cost model and the wrong guarantee: it is a model-dependent rule, not a code guarantee (§6). |

**Retired when:** Stage 1 has (a) a measured, argued new ceiling with both tests updated, (b) a
recorded `routing:audit` baseline taken **before** any description change, and (c) an explicit §6
table saying which channel carries which clause and whether it is a code guarantee or a
model-dependent rule.

### Risk 2 — The default-on knowledge sync mutates the fork's own governance documents. *(high, violates §5 as written)*

`02-DOCS/wiki/skills/**` falls inside `KNOWLEDGE` (`knowledge-sync.mjs:48,79`). On every turn, on
six assistants, by default: a committed clean file is overwritten by `git checkout <tip> -- <f>` or
removed by `git rm`, and the result is committed `--no-verify` (`:598-604`); local edits are
auto-committed (`:285-330`) and pushed to a shared `origin/rsc/knowledge` (`:454-520`).

Severity is bounded by two facts I verified and should state plainly: the removal **is** recoverable
from history, and a protected default branch is left untouched (`:567-579`). It is therefore not
data loss. It is **unconsented mutation of a governance artefact**, which §5 forbids and §14's data
policy has not been asked about.

The fix is small to write and awkward to land: carve the path out of `isKnowledge()`. That edits a
file materialised into every consumer project, whose test file is the slowest and least load-stable
in the repo (24 of Track D's 39 parallel failures), and the opt-out that already exists
(`.no-knowledge-sync`) is all-or-nothing and **project-wide**, so using it to protect governance
documents also switches off the team-knowledge feature the harness advertises.

**Retired when:** `02-DOCS/wiki/skills/**` is excluded from `KNOWLEDGE` (or given an explicit,
tested, consent-gated policy of its own), with a test that proves a committed clean customisation
survives an incoming exchange-branch delete.

### Risk 3 — Existing consumer repositories permanently point at the parent, and the fork cannot fix them from its own side. *(high, blocks §10 and §11's "prevención de reinstalación del padre")*

`targets/clone-bootstrap.mjs:33` `const PACKAGE = '@ericrisco/rsc'` is copied to
`.claude/rsc-bootstrap.mjs`, which the installer **rescues from `.gitignore`**
(`install-apply.js:455-456`) so that it is committed. Its whole purpose is to tell a fresh clone to
run `npx @ericrisco/rsc@<catalogVersion> sync` **exactly** (`clone-bootstrap.mjs:239-258`). The
always-on block carries ten more parent-named commands into the committed instruction file of 17 of
18 assistants (`skills/suggest/SKILL.md`). And `.rsc.json` has **no package identity at all**
(`manifest-file.js:18`), so nothing in the committed declaration distinguishes a fork project from a
parent one — while `readManifest`'s projection would **silently erase** a key the fork adds (Gap 2).

Track B identified this as the "single most likely mechanism" for the §11 clean-clone failure
(`:997-1002`) and I agree, with one addition it did not make: the migration cannot be
unidirectional. A project where **both** CLIs are run will have its manifest rewritten by whichever
ran last.

**Retired when:** the fork's identity survives a parent CLI run (file outside `.rsc.json`, or an
inference rule), the fork's `sync` detects and rewrites a parent-named bootstrap, the fork's
bootstrap refuses to emit a command whose package is not its own, and there is a test per direction.

### Risk 4 — "Governance enforced by code" is a far smaller claim than it will read as. *(high, §6 honesty requirement)*

One assistant has a wired deny path (`claude`). Six have vendor-documented ones (Track C, correct).
Four are impossible in principle (Track C, unverified by me). And every guard is disarmable: 15 of
the 20 opt-outs are **designed** to travel in the committed `.rsc.json`
(`targets/opt-outs.js:19-35`, with `package.json` `rscFixes` `fixedIn: 2.0.6` proving upstream
treated non-propagation as the bug), and an accepted plan with `codeHooks: false` removes four
guards and shrinks the always-on body to a 300-byte stub (`claude.js:244-267`).

§6 says *"No equipares la presencia de un preámbulo con cumplimiento garantizado"*. The honest
statement is: **guaranteed by code on one assistant, in a project that has not disarmed the switch,
under a plan that enabled code hooks; delivered as text everywhere else.** A fork that ships a
stronger-sounding claim will be wrong in a way its own users discover first.

**Retired when:** the §6 document has a per-assistant, per-clause matrix with the three categories
§6 names, the disarmability is stated as a property rather than a caveat, and the decision about
whether the governance check is opt-outable at all has been made and recorded.

### Risk 5 — The validation apparatus cannot yet certify what §11 requires, and the fork's premise maximises its cost. *(high, blocks §11 and §15)*

What is wrong with the gates today, all executed or read:

- `routing:audit` **red** at base (exit 1, 84.9 % < 85 %) and in **no** workflow.
- `eval-lint.sh` **fails open** when PyYAML is absent (274 SKIPs, `RESULT: PASS`, exit 0) and is in
  both `ci.yml` and `release.yml`.
- `originality:check` covers **82 documents** — agents and commands, **zero skills** — and is a
  release gate.
- `drift:knowledge`, `knowledge:doctor`, `spec:gate` pass **vacuously**, and are maintainer-only by
  design (Gap 3), so they cannot be repointed at a consumer.
- `reviewer-guard.sh` is **permanently red** and wired nowhere.
- Six of twelve deterministic checks run in no automated context.
- The semantic gate has **n = 1 per skill for 238 of 274 skills**, **zero repetitions**, **no model
  pinning**, **no seeded stratified sample**, **no retry or inconclusive-result policy**, optional
  integrity checking that defaults to `integrity NOT CHECKED`, and one floor skill (`ux`)
  un-evaluable while reported green (Gap 4).
- The suite takes **2 h 17 m** and is not load-stable.

And the cost structure is adversarial to the fork's own design: §11 says a transversal change widens
evaluation to the impact, and the fork's premise **is** a shared transversal mechanism — so any
change to it escalates to the full catalogue: **≈1,210 agent runs** at today's `1 + 3N`, **≈1,834**
at the rubric's own N=3 target, plus ~28 per failing skill for the fix loop.

**Retired when:** the deterministic layer carries as much of the contract as possible (so semantic
evaluation is reserved for what validators cannot see), "relevant change" is defined narrowly in
writing, repetitions and a committed-seed stratified sample exist, `eval-lint` fails closed,
`routing:audit` is in CI with a recorded baseline, and §11's own instruction is honoured: when the
budget runs out, **record the pending coverage rather than lowering the thresholds**.

---

## 7. Two things that are not on the risk list but should be decided this week

1. **`docs/` is gitignored (`.gitignore:30`).** Verified by `git check-ignore`. Found by Track A
   (`:1142`), Track D (`:74`) and recorded as `LEDGER.md:458` (B1) with the correct fix shape — a
   directory rule cannot be negated from inside, so `docs/` must become a content rule. Agreed and
   nothing to add, except: **verify the fix with `git check-ignore`, not by reading the pattern.**
   `install-apply.js:449-456` is upstream's own record of shipping an inert negation.
2. **`release.yml`'s `on: push: branches: [main]`** (Gap 7). The first commit of `docs/fork/` would,
   on a fork with an `NPM_TOKEN`, auto-bump and publish. Change the trigger in the same commit that
   reconfigures the remotes.

---

## 8. Verdict

**The Stage 0 audit is substantially sound and I would not block the plan on its basis.** Of the
fourteen questions I was asked to establish independently, the four tracks had already reached the
same answer on ten, with better evidence than mine on three (vendor hook capability, the wiki
one-level protocol, and the test suite's behaviour under load).

**Three things must be corrected before the plan is written:**

1. The always-on headroom is **2 bytes, not 720**. The ledger's "verified" marker on 720 must be
   withdrawn, both ceiling tests cited, and the plan's governance-delivery design rebuilt on the
   real number.
2. The internal-skill set is **27**. `backups` comes out (a text-match false positive on
   `scripts/lib/backups.js`), the four omitted floor members (`unslop`, `connect-tool`, `design`,
   `ux`) go in, and Track D's eleven topical additions stay out.
3. The enforcement claim must be split into **vendor-possible (6)** and **wired-today-with-a-deny
   (1)**. Track C's table is right about the former and its column header promises the latter.

**And three gaps should be added to the plan's scope:** `.rsc.json`'s key projection silently erasing
a fork-added identity key; the absence of any consumer-side knowledge validator (all three are
maintainer-only by design); and `release.yml`'s publish-on-every-push trigger, which is the one
finding that can cause damage before Stage 1 starts.

