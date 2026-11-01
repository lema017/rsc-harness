# Track C — Assistant capabilities, hooks and the documentation root

**Audit stage:** Stage 0 (pre-plan, mandatory audit per REQUIREMENTS §3).
**Base commit:** `6f7edd31d109b7f0211d637e2d084724f6dd8e26` — `🔖 chore(release): 3.7.1 [skip ci]`.
**Clone audited:** `/Users/home/Development/rsc-harness-fork` (read-only; no repository code was executed).
**Date of repo inspection:** 2026-10-31. **Date of vendor-doc verification:** 2026-10-31 / 2026-11-01.

Every section separates:

- **(a) Repo fact** — verified by direct inspection, with `file:line`.
- **(b) Vendor fact** — verified against official vendor documentation, with URL.
- **(c) Inference** — my reading, explicitly labelled.
- **(d) Open question** — not settled by this audit.

### Method caveat on (b), stated up front

Vendor documentation was read by two delegated sub-agents that fetched the vendor pages directly and
returned per-claim verdicts with URLs. **I did not personally re-fetch every page.** Each (b) item
below carries the URL the delegated reading cites, so an independent reviewer can re-verify. Where a
vendor page could not be found, that is reported as "no vendor documentation found", never as "no
such feature" — the distinction is kept throughout. Two (b) items are explicitly second-hand and
flagged inline: the Windsurf legacy hooks page (read only via a Wayback snapshot of the official
page) and Continue's CLI hooks (evidence is a vendor GitHub issue, not published docs).

---

## 0. Headline findings

1. **The documentation root is FIXED, not configurable.** No env var, no `.rsc.json` key, no CLI
   flag, no constant, no folder detection. `02-DOCS` is a hard-coded path literal appearing **536
   times across 81 `.js`/`.mjs` files** and in 316 files repo-wide. REQUIREMENTS §5's conditional
   ("si la auditoría demuestra que esa raíz es configurable") resolves to **no**. Details in §4.
2. **The repo supports 18 assistants, not 19.** `SPEC` in `targets/index.js:39-63` has exactly 18
   entries; `TARGETS` at `targets/index.js:69-88` has exactly 18. The brief's "19" is not supported
   by the code at this commit. See §1.
3. **Code-enforced governance is possible on 6 assistants, not 18.** Claude Code, Codex CLI, Cursor,
   Gemini CLI, OpenCode and DeepSeek Harness are the only targets for which this repo already wires a
   real, vendor-documented event. The other **12 are instruction-text only** in this harness. See §2.
4. **The injected always-on block is 6,620 bytes** (md/cursor, frontmatter stripped) or **7,280
   bytes** (Claude Code, frontmatter included), plus 852 bytes re-injected **per turn** on Claude
   Code only. The repo's own test caps the source body at 8,000 bytes, leaving **~720 bytes of
   headroom** for a governance preamble. See §3.
5. **Skills land at a vendor-discoverable path for only 2 of 18 targets.** `claude`
   (`.claude/skills/<id>/`) and `deepseek` (`.dsh/skills/<id>/`). The other 16 land under
   `<dot-dir>/rsc/<id>/` or as a converted `.mdc`. See §6.
6. **The existing `02-DOCS` customisation convention is quantifiably non-uniform:** only **24 of 274**
   skills name `02-DOCS/wiki/stack/<own-id>.md`, and only **96 of 274** mention `02-DOCS` at all.
   `02-DOCS/wiki/skills/` — REQUIREMENTS §5's new standard path — **appears nowhere in the repo**
   (0 hits). See §5.

---

## 1. Target matrix — how skills reach each assistant

### (a) Repo facts

`targets/index.js:39-63` — the `SPEC` table, one row per assistant, verbatim structure:
`{ root, hook, adapter, skillExt? }`. Three adapters only (`targets/index.js:65`):
`ADAPTER = { claude: claudeAdapter, cursor: cursorAdapter, md: mdAdapter }`.

Delivery mechanism, `targets/index.js:20-33` (`linkOrCopy`):

- Non-Windows: `symlinkSync(relative(dirname(toPath), fromDir), toPath, 'dir')` — a **relative dir
  symlink** into the shared base.
- `catch` fallback: `cpSync(fromDir, toPath, { recursive: true })`.
- `process.platform === 'win32'`: **always a real recursive copy**, never a symlink. The comment at
  `targets/index.js:15-19` states why: relative `dir` symlinks "require Developer Mode/admin and are
  not reliably followed by skill discovery, so correctness wins over de-duplication."
- Idempotent: `lstatSync(toPath); rmSync(toPath, {recursive:true,force:true})` before writing
  (`targets/index.js:22`).

Shared base: `baseDir()` at `targets/index.js:11-13` → `<cwd>/.rsc/skills/<id>`. Real files live
there exactly once.

Cursor is the one conversion target. `targets/cursor.js:4-9` reads **only** `SKILL.md`, strips
frontmatter, and writes a single `.mdc` file with `description: rsc skill <id>` and
`alwaysApply: false`. Nothing else from the skill directory is copied.

| id | skill root | hook file | adapter | delivery | platform caveat |
|---|---|---|---|---|---|
| `claude` | `.claude/skills` | `.claude/settings.json` | claude | relative symlink | Windows → real copy |
| `cursor` | `.cursor/rules` | `.cursor/rules/rsc-suggest.mdc` | cursor | **converted single `.mdc`** (SKILL.md only) | n/a — no symlink used |
| `codex` | `.codex/rsc` | `AGENTS.md` | md | relative symlink | Windows → real copy |
| `opencode` | `.opencode/rsc` | `AGENTS.md` | md | relative symlink | Windows → real copy |
| `deepseek` | `.dsh/skills` | `AGENTS.md` | md | relative symlink | Windows → real copy |
| `amp` | `.amp/rsc` | `AGENTS.md` | md | relative symlink | Windows → real copy |
| `jules` | `.jules/rsc` | `AGENTS.md` | md | relative symlink | Windows → real copy |
| `zed` | `.zed/rsc` | `AGENTS.md` | md | relative symlink | Windows → real copy |
| `gemini` | `.gemini/rsc` | `GEMINI.md` | md | relative symlink | Windows → real copy |
| `antigravity` | `.antigravity/rsc` | `.antigravity/AGENTS.md` | md | relative symlink | Windows → real copy |
| `copilot` | `.github/rsc` | `.github/copilot-instructions.md` | md | relative symlink | Windows → real copy |
| `windsurf` | `.windsurf/rsc` | `.windsurf/rules/rsc-suggest.md` | md | relative symlink | Windows → real copy |
| `cline` | `.clinerules/rsc` | `.clinerules/rsc-suggest.md` | md | relative symlink | Windows → real copy |
| `roo` | `.roo/rsc` | `.roo/rules/rsc-suggest.md` | md | relative symlink | Windows → real copy |
| `continue` | `.continue/rsc` | `.continue/rules/rsc-suggest.md` | md | relative symlink | Windows → real copy |
| `junie` | `.junie/rsc` | `.junie/guidelines.md` | md | relative symlink | Windows → real copy |
| `kiro` | `.kiro/rsc` | `.kiro/steering/rsc-suggest.md` | md | relative symlink | Windows → real copy |
| `aider` | `.aider/rsc` | `CONVENTIONS.md` | md | relative symlink | Windows → real copy |

**18 rows.** The repo's own README table (`README.md:349-366`) matches this exactly and is the
upstream's own public statement of it.

Six md-family targets share one root `AGENTS.md`: `codex`, `opencode`, `deepseek`, `amp`, `jules`,
`zed` (`targets/index.js:45-51`; README note at `README.md:368-369`). The block is written once
between markers, so wiring several of them is not duplication.

Other files read, per the brief:

- `targets/agents-md-shadow.js` — writes a shadow `CLAUDE.md` when and only when Claude Code is
  wired **and** the root `AGENTS.md` carries the rsc block **and** no `CLAUDE.md` exists at or above
  the root (`shadowTarget()`, lines 130-137). Purpose: Claude Code ≥ 2.1.277 reads root `AGENTS.md`
  as project instructions when no CLAUDE.md exists, which would deliver the ~7 KB body twice. It
  deliberately does **not** `@AGENTS.md`-import (lines 30-31). `removeShadowClaudeMd()` (146-153)
  takes it back **only while byte-identical** to `SHADOW_BODY`.
- `targets/agents.js:33-46` — subagent files, a **separate** per-target table: `claude`, `junie`,
  `cursor`, `opencode`, `gemini`, `copilot`, `kiro`, `codex` (8 targets; `.claude/agents/*.md`,
  `.kiro/agents/*.json`, `.codex/agents/*.toml`, `.github/agents/*.agent.md`, …).
- `targets/commands.js:5-14` — slash commands, a **third** per-target table of 8 targets: `claude`,
  `cursor`, `gemini`, `opencode`, `copilot`, `windsurf`, `cline`, `roo`. `claude` carries
  `skillsAreCommands: true`, which **suppresses** the `kind: 'skill'` and `kind: 'testing-skill'`
  commands for it (`targets/commands.js:83,86`) because Claude Code exposes installed skills as
  commands natively.
- `targets/knowledge-wiring.js` and `targets/memory.js` — see §2; these are where the real
  non-Claude hook events live.
- `targets/opt-outs.js` — see §7.

### (b) Vendor facts

- `.claude/skills/<name>/SKILL.md` and `.claude/settings.json` + `.claude/settings.local.json` both
  supporting a `hooks` key: documented — https://code.claude.com/docs/en/hooks
- Claude Code reads a root `AGENTS.md` **only** when no `CLAUDE.md` / `.claude/CLAUDE.md` /
  `CLAUDE.local.md` exists at or above the cwd; docs state "Reading `AGENTS.md` directly requires
  Claude Code v2.1.277 or later" — https://code.claude.com/docs/en/memory. The shadow-CLAUDE.md
  mechanism is therefore **correctly grounded in vendor behaviour**, not invented.
- `.cursor/rules/*.mdc` with `description` / `globs` / `alwaysApply` frontmatter: documented —
  https://cursor.com/docs/rules
- `.dsh/skills/<name>/SKILL.md` discovered natively at rank 100 (highest priority), one level deep,
  project root = nearest ancestor containing `.git`: documented in the official repo
  (`docs/subsystems/skills.md`, `packages/skill/skill-filesystem/README.md`) —
  https://github.com/deepseek-ai/deepseek-harness
- `.github/copilot-instructions.md`: documented —
  https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions
- `.windsurf/rules/*.md`: documented as **legacy but imported by default**; preferred is now
  `.devin/rules/*.md` — https://docs.devin.ai/desktop/devin-local/customizations.md
- `.clinerules/` as a rules directory: documented — https://docs.cline.bot/customization/cline-rules.md
- `.roo/rules/*.md` and `.roo/commands/*.md`: documented —
  https://roocodeinc.github.io/Roo-Code/features/custom-instructions/ ,
  https://roocodeinc.github.io/Roo-Code/features/slash-commands/
- `.continue/rules/*.md`: documented — https://docs.continue.dev/customize/rules
- `.junie/guidelines.md`: documented but **legacy** ("still supported"); current discovery order is
  `.junie/AGENTS.md` → root `AGENTS.md` + `.junie/playbook.md` + `.junie/rules/*.md` →
  `.junie/guidelines.md` — https://junie.jetbrains.com/docs/guidelines-and-memory.html
- `.kiro/steering/*.md`: documented — https://kiro.dev/docs/steering.md
- Zed root `AGENTS.md`: documented, but **7th in a first-match chain** after `.rules`,
  `.cursorrules`, `.windsurfrules`, `.clinerules`, `.github/copilot-instructions.md`, `AGENT.md` —
  https://zed.dev/docs/ai/instructions.md
- Jules root `AGENTS.md`: documented — https://jules.google/docs
- Amp root `AGENTS.md`: documented — https://ampcode.com/docs/markdown/customize/agents-md
- Gemini CLI reads `GEMINI.md` by default; `AGENTS.md` is **not** read by default (needs
  `context.fileName`) — https://geminicli.com/docs/cli/gemini-md
- OpenCode reads `AGENTS.md` — https://opencode.ai/docs/rules/
- Codex reads `AGENTS.override.md` / `AGENTS.md` per directory from the project root down —
  https://developers.openai.com/codex/guides/agents-md

### Vendor facts that **contradict or weaken** rows in `SPEC`

These are the most important findings in this section.

1. **`aider`: `CONVENTIONS.md` is NOT auto-read.** Aider's docs use `CONVENTIONS.md` only as an
   *example filename*; it must be loaded explicitly with `/read CONVENTIONS.md`,
   `aider --read CONVENTIONS.md`, or a `read:` entry in `.aider.conf.yml` —
   https://aider.chat/docs/usage/conventions.html . The `aider` row's always-on surface therefore
   **does not exist by default**. (Inference, labelled: an aider user who has not configured `read:`
   receives nothing from this harness at all.)
2. **`antigravity`: `.antigravity/AGENTS.md` is NOT a documented path.** Antigravity's documented
   discovery is `<dir>/AGENTS.md` or `GEMINI.md`, `<dir>/.agents/AGENTS.md`, `.agents/rules/*.md`
   (with a required `trigger:` frontmatter key, else the rule is "silently discarded"), and global
   `~/.gemini/AGENTS.md` — https://antigravity.google/docs/rules ,
   https://antigravity.google/docs/customization-discovery . The `SPEC` row points at a path the
   vendor does not document.
3. **`copilot`: `.github/prompts/*.prompt.md` with `mode: agent` is stale.** The path is confirmed,
   but the current frontmatter table lists `agent`, `description`, `name`, `argument-hint`, `model`,
   `tools` — `mode` is not listed —
   https://code.visualstudio.com/docs/copilot/customization/prompt-files . `targets/commands.js:166`
   still writes `mode: agent`.
4. **`cline`: `.clinerules/workflows/*.md` is stale.** A Dec-2025 archived copy documents it; the
   live workflows URL now serves the Rules page and documents no workflows path —
   https://docs.cline.bot/customization/cline-rules.md . `targets/commands.js:12` still writes there.
5. **`roo` is a discontinued product.** The Roo Code extension "was shut down on May 15th" and the
   repo is archived read-only; docs are frozen at roocodeinc.github.io/Roo-Code.
6. **`windsurf` has been renamed.** `docs.windsurf.com` 308-redirects to `docs.devin.ai`; the product
   is "Devin Desktop", `.windsurf/*` paths are legacy-imported, and workflows are Cascade-only with
   docs advising migration to skills — https://docs.devin.ai/desktop/cascade.md
7. **`gemini`: Gemini CLI itself carries an end-of-life banner.** The docs banner reads "Gemini CLI
   was replaced by Antigravity CLI on June 18th, 2026" for unpaid-tier and Google One users —
   https://geminicli.com/docs/hooks/

### (c) Inferences

- **Cursor loses every auxiliary file.** 246 of 274 skills ship a `references/` directory, 190 ship
  `scripts/`, 2 ship `assets/`, and 80 `SKILL.md` files contain `](../` relative links (measured).
  `targets/cursor.js:4-9` copies only `SKILL.md`. Therefore **for Cursor, every `references/…` link,
  every `scripts/…` invocation and every `../<skill>/SKILL.md` cross-reference in a skill body points
  at a file that is not on disk.** This is the single largest structural asymmetry in the delivery
  layer and it bears directly on REQUIREMENTS §6's "referencia desde otra skill" route.
- **`.clinerules/rsc/<id>/` is nested inside Cline's rules directory.** Cline documents `.clinerules/`
  as a rules directory. If Cline loads markdown recursively from it, 274 skill `SKILL.md` files would
  become always-on rules; if it loads only the top level, the skills are invisible. Either outcome is
  a defect. Flagged as an open question below, not asserted.

### (d) Open questions

- Does Cline load `.clinerules/**` recursively or only its top level? Decides whether `cline` is
  catastrophically over-loaded or silently empty.
- Does any md-family assistant discover `<dot-dir>/rsc/<id>/SKILL.md`? I found **nothing in the repo
  that tells them where it is** (see §6), and no vendor doc names such a path.
- `kiro` is in `SPEC` but absent from the brief's assistant list; `.kiro/rsc/` is not
  `.kiro/skills/` (which Kiro does document — https://kiro.dev/docs/skills.md).

---

## 2. Hook reality — the central question of this track

### (a) Repo facts: where hooks are actually wired

There are **four** independent wiring layers, not one. The brief's framing ("the repo ships many
`.mjs` hook scripts in `targets/`") understates this: the non-Claude hooks are real and are wired
from two files the brief did not list as hook wiring.

**Layer 1 — `targets/claude.js` `wireHook()` (Claude Code only), lines 112-327.**
Writes `.claude/settings.json`. Every command is routed through a committed bootstrap
(`.claude/rsc-bootstrap.mjs`, lines 108-110) in one of three modes (`announce` / `guard` / `quiet`)
so a clone without `.rsc/` does not show seven stack traces (lines 95-107). Paths use
`${CLAUDE_PROJECT_DIR}` (line 92), never an absolute install path.

| event | script | matcher | gated by |
|---|---|---|---|
| `SessionStart` | `.rsc/session-start.mjs` | — | always (line 160) |
| `PreCompact` | `.rsc/worklog-checkpoint.mjs` | — | always (line 171-177) |
| `SessionEnd` | `.rsc/worklog-checkpoint.mjs` | — | always (line 171-177) |
| `PreToolUse` | `.rsc/ship-guard.mjs` | `Bash` | `policy.codeHooks !== false` (line 195) |
| `PreToolUse` | `.rsc/branch-guard.mjs` | `Bash` | `policy.codeHooks !== false` (line 209) |
| `PreToolUse` | `.rsc/gitmoji-guard.mjs` | `Bash` | `policy.codeHooks !== false` (line 225) |
| `UserPromptSubmit` | `.rsc/userprompt-gate.mjs` | — | `laneGate` (line 242 / 264) |
| `PostToolUse` | `.rsc/ftd-nudge.mjs` | `Edit\|Write\|MultiEdit\|NotebookEdit` | `laneGate` (line 277) |
| `Stop` | `.rsc/copy-guard.mjs` | — | always, `timeout: 10` (line 292) |
| `PreToolUse` | `.rsc/danger-guard.mjs` | `Bash` | `policy.dangerGuard !== false` (line 311) |

**Layer 2 — `targets/memory.js` (session memory), lines 94-118.** Writes per-target *local* hook
configs listed at lines 24-31: `claude: .claude/settings.local.json`, `codex: .codex/hooks.json`,
`deepseek: .dsh/hooks.json`, `cursor: .cursor/hooks.json`, `gemini: .gemini/settings.json`,
`opencode: .opencode/plugins/rsc-memory.js`. Modes at lines 13-22: `full` for claude/codex/deepseek/
gemini/opencode, **`assisted` for cursor** with the stated reason "Cursor documents sessionStart as
fire-and-forget."

Event maps, verbatim from `targets/memory.js:94-118`:

- claude: `SessionStart`, `UserPromptSubmit`, `PostToolUse(Edit|Write|NotebookEdit)`,
  `PostToolUse(Bash)`, `Stop`, `PreCompact`, `SessionEnd`
- codex: `SessionStart(startup|resume|clear|compact)`, `UserPromptSubmit`,
  `PostToolUse(apply_patch|Edit|Write)`, `PostToolUse(Bash)`, `Stop`, `PreCompact`, `SessionEnd`
- deepseek: `SessionStart`, `UserPromptSubmit`, `PostToolUse(edit|write|str_replace_editor)`,
  `PostToolUse(bash)`, `Stop` — with the comment "only these five points exist there" (line 104)
- gemini: `SessionStart`, `BeforeAgent`, `AfterTool(write_file|replace)`,
  `AfterTool(run_shell_command)`, `AfterAgent`, `PreCompress`, `SessionEnd`
- cursor: `sessionStart`, `beforeSubmitPrompt`, `afterFileEdit`, `afterShellExecution`,
  `afterAgentResponse`, `preCompact`, `sessionEnd`

**Layer 3 — `targets/knowledge-wiring.js` (knowledge sync), lines 18-33.** Same six config files.
Events: claude/codex/deepseek `UserPromptSubmit` + `Stop`; gemini `BeforeAgent` + `AfterAgent`;
cursor `beforeSubmitPrompt` + `afterAgentResponse`; opencode via plugin.

**Layer 4 — `targets/update-wiring.js`, lines 20-28.** `codex`/`deepseek`/`gemini` `SessionStart`,
`cursor` `sessionStart`, `opencode` plugin. Claude Code is excluded because `session-start.mjs`
already imports the module (comment lines 9-10). `UPDATE_HOOK_TARGETS` (line 31) = 6 targets.

**DeepSeek bridge — `targets/deepseek-bridge.js`.** Explicitly states (lines 1-6) that dsh has **no
project-level hook or plugin config**; the workaround installs `$DSH_HOME/rsc/bridge.mjs` plus a
marked block in `$DSH_HOME/cordis.patch.yml` mounting `@deepseek-ai/dsh-hooks-codex`. Bridged events
at line 17: `['SessionStart','UserPromptSubmit','PostToolUse','Stop']` — `PreToolUse` deliberately
excluded ("nothing of rsc's runs there yet", line 15).

**Library modules, not hooks.** `hook-once.mjs` (cross-scope single-shot guard + `SDD_GATE_TEXT`),
`shell-unwrap.mjs`, `sello.mjs`, `trunk-policy.mjs`, `copy-rules.mjs`, `team-safe-start.mjs`,
`memslop-offer.mjs`, `worktree-reaper.mjs`, `session-memory-core.mjs`, `auto-update.mjs` — all
imported as siblings under `.rsc/` by a wired script, never registered on an event themselves
(`targets/claude.js:117-130`).

### (b) Vendor verification of each event name

| Event name used | Assistant | Vendor-documented? | URL |
|---|---|---|---|
| `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `PreCompact`, `SessionEnd` | Claude Code | **YES, all 7** | https://code.claude.com/docs/en/hooks |
| `${CLAUDE_PROJECT_DIR}` expansion | Claude Code | **YES** | same |
| `Edit\|Write` matcher = exact list; other chars = unanchored regex | Claude Code | **YES** | same |
| `SessionStart`, `UserPromptSubmit`, `PostToolUse`, `Stop`, `PreCompact`, `SessionEnd` | Codex CLI | **YES, all 6** | https://developers.openai.com/codex/hooks |
| `.codex/hooks.json`, `commandWindows`, `additionalContextLimit` | Codex CLI | **YES, all three** | same |
| `sessionStart`, `beforeSubmitPrompt`, `afterFileEdit`, `afterShellExecution`, `afterAgentResponse`, `preCompact`, `sessionEnd` | Cursor | **YES, all 7** | https://cursor.com/docs/agent/hooks |
| `SessionStart`, `BeforeAgent`, `AfterAgent`, `AfterTool`, `PreCompress`, `SessionEnd` | Gemini CLI | **YES, all 6** | https://geminicli.com/docs/hooks/reference |
| `.opencode/plugins/*.js`, `setup(ctx)`, `ctx.session.hook('context')`, `ctx.event.subscribe`, `session.execution.succeeded/failed`, `session.idle` | OpenCode | **YES** | https://opencode.ai/v2/docs/build/plugins/server , https://opencode.ai/v2/docs/build/plugins/migrate-v1 |
| `experimental.chat.system.transform` | OpenCode | **PARTIAL** — not on the V1 plugin page; appears only on the V2 migration page | https://opencode.ai/v2/docs/build/plugins/migrate-v1 |
| `@deepseek-ai/dsh-hooks-codex`, no project-level hook config, `.dsh/skills` native | DeepSeek Harness | **YES** (official repo, no separate docs site) | https://github.com/deepseek-ai/deepseek-harness |
| `cordis.patch.yml` as the mount point | DeepSeek Harness | **INFERRED by the vendor-doc reading** — the CLI README names the home-level patch file, the bridge README shows only the YAML row; the exact composition is not spelled out | same |

**Material vendor caveats the repo does not encode:**

- **Cursor `sessionStart` and `sessionEnd` are fire-and-forget**: "runs as fire-and-forget; the agent
  loop does not wait for or enforce a blocking response". `preCompact` is "an observational hook that
  cannot block or modify the compaction behavior". `beforeSubmitPrompt` **can** block
  (`{"continue": false, "user_message": …}`) but **has no context-injection field** — its only
  outputs are `continue` and `user_message`. Cursor's context-injection surface is `sessionStart`
  (`additional_context`, fire-and-forget) and `postToolUse`. (https://cursor.com/docs/agent/hooks)
  **Consequence: on Cursor you can block a prompt or inject unreliably, but not both reliably.**
- **Cursor cloud agents do not run `sessionStart`, `sessionEnd` or `workspaceOpen`.** (same URL)
- **Codex project hooks run only when the project `.codex/` layer is trusted**, and non-managed hooks
  need `/hooks` trust review (hash-based) before they run.
  (https://developers.openai.com/codex/hooks) The repo already knows this:
  `targets/memory.js:206` returns `reason: 'hook-trust-required'` for codex, and `README.md`'s
  support table says "full after `/hooks` trust".
- **Gemini CLI hook stdout must be a single JSON object**; plain text breaks parsing.
  (https://geminicli.com/docs/hooks/reference) `additionalContext` is available on `SessionStart`,
  `BeforeAgent`, `AfterTool` only; `SessionStart`, `SessionEnd`, `PreCompress`, `Notification` are
  advisory and cannot block.
- **The dsh Codex bridge supports only 5 events** (`SessionStart`, `UserPromptSubmit`, `PreToolUse`,
  `PostToolUse`, `Stop`); `PreCompact`, `PostCompact`, `PermissionRequest`, `SubagentStart`,
  `SubagentStop` and `SessionEnd` are **silently dropped**. `SessionStart` runs detached, so its
  context "can miss the first request". `PreToolUse` `additionalContext` / `allow` / `updatedInput`
  are ignored — it can only block.
- **OpenCode has no pre-prompt blocking hook.** Its V2 `prompt` hook can rewrite input but docs say
  "Prompt hooks transform input and do not expose a typed rejection API."
  (https://opencode.ai/v2/docs/build/plugins/server)
- **Claude Code's `SessionStart` cannot block** (stderr is shown to the user only). The blocking
  events are `PreToolUse`, `UserPromptSubmit`, `Stop`, `SubagentStop`, `PreCompact`. Context
  injection via plain stdout is documented for `SessionStart`, `UserPromptSubmit`,
  `UserPromptExpansion`, `PostModelSwitch` only. (https://code.claude.com/docs/en/hooks)
  This is **exactly consistent** with how the repo uses them.

### Hook inventory (deliverable table)

| hook script | assistant(s) that run it | event | verified real? |
|---|---|---|---|
| `session-start.mjs` | claude | `SessionStart` | **Vendor-documented** (code.claude.com/docs/en/hooks) |
| `userprompt-gate.mjs` | claude | `UserPromptSubmit` | **Vendor-documented** |
| `danger-guard.mjs` | claude | `PreToolUse` matcher `Bash` | **Vendor-documented** |
| `ship-guard.mjs` | claude | `PreToolUse` matcher `Bash` | **Vendor-documented** |
| `branch-guard.mjs` | claude | `PreToolUse` matcher `Bash` | **Vendor-documented** |
| `gitmoji-guard.mjs` | claude | `PreToolUse` matcher `Bash` | **Vendor-documented** |
| `ftd-nudge.mjs` | claude | `PostToolUse` matcher `Edit\|Write\|MultiEdit\|NotebookEdit` | **Vendor-documented** |
| `copy-guard.mjs` | claude | `Stop` | **Vendor-documented** |
| `worklog-checkpoint.mjs` | claude | `PreCompact` + `SessionEnd` | **Vendor-documented** |
| `session-memory-adapter.mjs` | claude | 7 events (`SessionStart`…`SessionEnd`) | **Vendor-documented** |
| `session-memory-adapter.mjs` | codex | 7 events | **Vendor-documented** (developers.openai.com/codex/hooks); needs `/hooks` trust |
| `session-memory-adapter.mjs` | gemini | `SessionStart`, `BeforeAgent`, `AfterTool`×2, `AfterAgent`, `PreCompress`, `SessionEnd` | **Vendor-documented** (geminicli.com/docs/hooks/reference) |
| `session-memory-adapter.mjs` | cursor | 7 camelCase events | **Vendor-documented** (cursor.com/docs/agent/hooks); `sessionStart`/`sessionEnd` fire-and-forget |
| `session-memory-adapter.mjs` | deepseek | 5 events via bridge | **Vendor-documented** (deepseek-harness repo); 2 of the 5 rsc wires are outside the bridge's 5 and are dropped |
| `opencode-memory-plugin.js` | opencode | plugin: `session.idle` (V1) / `session.execution.succeeded\|failed` (V2) | **Vendor-documented** (opencode.ai/v2/docs) |
| `knowledge-sync.mjs` | claude, codex, deepseek | `UserPromptSubmit` + `Stop` | **Vendor-documented** |
| `knowledge-sync.mjs` | gemini | `BeforeAgent` + `AfterAgent` | **Vendor-documented** |
| `knowledge-sync.mjs` | cursor | `beforeSubmitPrompt` + `afterAgentResponse` | **Vendor-documented** |
| `knowledge-sync.mjs` | opencode | plugin context + `session.idle` / `session.execution.*` | **Vendor-documented** |
| `auto-update.mjs` | codex, deepseek, gemini | `SessionStart` | **Vendor-documented** |
| `auto-update.mjs` | cursor | `sessionStart` | **Vendor-documented** (fire-and-forget) |
| `auto-update.mjs` | opencode | plugin, every system prompt of the run | **Vendor-documented** |
| `auto-update.mjs` | claude | imported by `session-start.mjs`, not its own hook | n/a — library |
| `deepseek-bridge.mjs` | deepseek (machine-level) | runs the 4 bridged events | **Repo-specific mechanism** on a vendor-documented plugin (`@deepseek-ai/dsh-hooks-codex`) |
| `hook-once.mjs` | — | library (`claimOnce`, `SDD_GATE_TEXT`, `readHookInput`) | n/a |
| `shell-unwrap.mjs` | — | library, shared by PreToolUse guards + sello | n/a |
| `sello.mjs` | — | library, sibling import of `ship-guard.mjs` | n/a |
| `trunk-policy.mjs` | — | library, sibling of branch-guard / userprompt-gate / knowledge-sync | n/a |
| `copy-rules.mjs` | — | library, sibling of `copy-guard.mjs` | n/a |
| `team-safe-start.mjs` | — | library, imported by `session-start.mjs` | n/a |
| `memslop-offer.mjs` | — | library, lazily imported by `session-start.mjs` | n/a |
| `worktree-reaper.mjs` | — | library, imported by `session-start.mjs` | n/a |
| `session-memory-core.mjs`, `session-memory.mjs` | — | library + CLI | n/a |
| `clone-bootstrap.mjs` → `.claude/rsc-bootstrap.mjs` | claude | the wrapper every claude hook command invokes | **Repo-specific**, built on documented `${CLAUDE_PROJECT_DIR}` |

**No hook script in this repo is registered on an invented event name.** That is the one strongly
positive finding of this track: every event the harness uses exists in its vendor's documentation.

### The decisive question: where can governance be enforced by code?

| assistant | real pre-prompt / pre-tool / session-start event available **to this harness today**? | can read a file and inject? | can block? | verdict |
|---|---|---|---|---|
| **claude** | `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `PreCompact`, `SessionEnd` | yes (stdout → context on SessionStart/UserPromptSubmit) | yes (exit 2, `decision:"block"`, `permissionDecision:"deny"`) | **Full code enforcement** |
| **codex** | `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `PreCompact`, `SessionEnd` | yes (`additionalContext`) | yes (`permissionDecision:"deny"` / exit 2) | **Full, after user `/hooks` trust** |
| **gemini** | `SessionStart`, `BeforeAgent`, `BeforeTool`, `AfterTool`, `AfterAgent`, `PreCompress`, `SessionEnd` | yes (`additionalContext` on SessionStart/BeforeAgent/AfterTool) | yes (`{"decision":"deny"}` / exit 2 on BeforeAgent, BeforeTool) | **Full** (JSON-only stdout; `BeforeTool` not yet used by the repo) |
| **cursor** | `sessionStart` (fire-and-forget), `beforeSubmitPrompt`, `preToolUse`, `beforeShellExecution` | **partial** — `beforeSubmitPrompt` has no context field; `sessionStart` injects but is not awaited | yes (exit 2 ≡ `permission:"deny"`; `beforeSubmitPrompt` `continue:false`) | **Partial** — blocking yes, reliable injection no; cloud agents get no `sessionStart` |
| **opencode** | plugin `context` hook, `tool.execute.before`, `permission.hook('evaluate')` | yes (`event.system.push`) | tool calls yes (throw / `effect:"deny"`); **prompts no** | **Partial** — no pre-prompt rejection API |
| **deepseek** | 5 bridged events, machine-level mount | `PostToolUse` yes; `SessionStart` detached and can miss the first request; `PreToolUse` context ignored | `PreToolUse` yes (block only) | **Partial** — and requires a per-machine step outside the project |
| **copilot** | — **not wired by this repo** | — | — | **Instruction-only here.** *But see below: the vendor does have hooks.* |
| **windsurf** | — not wired | — | — | **Instruction-only here.** Vendor has hooks (legacy Cascade / Devin Local). |
| **cline** | — not wired | — | — | **Instruction-only here.** Vendor has in-process TS plugins. |
| **kiro** | — not wired | — | — | **Instruction-only here.** Vendor has documented agent-lifecycle hooks. |
| **antigravity** | — not wired | — | — | **Instruction-only here.** Vendor has documented hooks. |
| **junie** | — not wired | — | — | **Instruction-only here.** Vendor has CLI hooks (EAP), and project-local hooks are ignored by default. |
| **continue** | — not wired | — | — | **Instruction-only.** No published hook docs. |
| **roo** | — not wired | — | — | **Instruction-only. Product discontinued 2026-05-15.** |
| **zed** | — not wired | — | — | **Instruction-only. No hook mechanism exists.** |
| **amp** | — not wired | — | — | **Instruction-only here.** Vendor has in-process TS plugins (not shell hooks). |
| **jules** | — not wired | — | — | **Instruction-only. No local execution surface at all** — cloud agent, short-lived VM. |
| **aider** | — not wired | — | — | **Instruction-only. No hook mechanism**; and `CONVENTIONS.md` is not even auto-read. |

**Vendors that DO have documented hooks this harness does not use** (this is the honest upside, and
it matters for any plan that claims uniformity is impossible):

- **GitHub Copilot — YES.** `.github/hooks/*.json`, `{"version":1,"hooks":{…}}`, events
  `sessionStart`, `sessionEnd`, `userPromptSubmitted`, `preToolUse`, `postToolUse`,
  `postToolUseFailure`, `agentStop`, `subagentStart`, `subagentStop`, `errorOccurred`,
  `notification`, `permissionRequest`, `preCompact`, `userPromptTransformed`. `preToolUse` denies via
  `permissionDecision:"deny"` or exit 2 (any non-zero denies — fail-closed; a timeout fails open).
  Context injection via `additionalContext` from `sessionStart`, `postToolUse`, `subagentStart`.
  **Critical catch:** config-file `userPromptSubmitted` hooks have their output dropped — they can
  neither inject nor block. Copilot also reads `.claude/settings.json` hooks and documents
  `.github/skills/<name>/SKILL.md`.
  https://docs.github.com/en/copilot/reference/hooks-configuration ,
  https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-hooks ,
  https://code.visualstudio.com/docs/agent-customization/hooks
- **Kiro — YES, and both kinds.** `.kiro/hooks/*.json` (`version:"v1"`). Agent-lifecycle triggers:
  `UserPromptSubmit`/Prompt Submit, `Stop`, `SessionStart` (alias `agentSpawn`), `SessionEnd` (CLI
  V3), `PreToolUse`, `PostToolUse`. File/task triggers: `PostFileSave`, Pre/Post Task Execution,
  Manual. `PreToolUse` exit 2 blocks and returns stderr to the LLM. **Prompt Submit stdout is added
  as context, but can block only in the IDE — CLI Prompt Submit hooks cannot block.**
  https://kiro.dev/docs/hooks.md , https://kiro.dev/docs/hooks/types.md
- **Antigravity — YES.** `.agents/hooks.json` (workspace) or `~/.gemini/config/hooks.json`. Events
  `SessionStart`, `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, `Stop`. **No
  user-prompt event**; `PreInvocation` (before the model call) is the nearest. `PreToolUse`
  `decision` ∈ {allow, auto_approve, deny, ask, force_ask, deny_unless_prior_grant}. Context via
  `injectSteps` from `SessionStart`, `PreInvocation`, `PostInvocation`. `PostToolUse` is
  observe-only. https://antigravity.google/docs/hooks
- **Windsurf / Devin Local — YES.** Devin Local: `.devin/hooks.v1.json`, events `PreToolUse`,
  `PostToolUse`, `PermissionRequest`, `UserPromptSubmit`, `Stop`, `PostCompaction`, `SessionStart`,
  `SessionEnd`; exit 2 or `decision:"block"` blocks; `additionalContext` injects; it also picks up
  `.claude/` hooks. Legacy Cascade: `.windsurf/hooks.json` with `pre_*`/`post_*` events where only
  `pre_*` block and there is no documented context-injection output — **read only via a Wayback
  snapshot of the official page (2026-05-16); the live docs no longer carry it.**
  https://docs.devin.ai/desktop/devin-local/customizations.md
- **Cline — PARTIAL.** TypeScript plugins in `.cline/plugins/` (not shell hooks): `beforeRun`,
  `afterRun`, `beforeModel`, `afterModel`, `beforeTool`, `afterTool`, `onEvent`, 3 s timeout per
  call. `beforeTool` can `{skip:true, reason}` to block; `beforeRun` can `appendContext`. The former
  shell-hooks page is now a stub pointing at SDK plugins.
  https://docs.cline.bot/sdk/plugins.md
- **Amp — PARTIAL.** Event-driven TS/JS plugins in `.amp/plugins/` via `amp.on(...)`:
  `session.start`, `agent.start`, `tool.call`, `tool.result`, `agent.end`, `changes.prompt`. No
  `session.end`. `tool.call` returns allow / reject-and-continue / modify / synthesize;
  `agent.start` can return hidden appended instructions. https://ampcode.com/docs/markdown/customize/plugins
- **Junie — PARTIAL, and adversely configured.** CLI-only, Early Access. Events `SessionStart`,
  `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `Stop`, `StopFailure`, `SessionEnd` (no
  `PostToolUse`). **Project-local `<root>/.junie/config.json` hooks are ignored by default for
  safety** — so this is not a project-level mechanism without the user opting in via
  `--config-location`. https://junie.jetbrains.com/docs/junie-cli-hooks.html
- **Continue — PARTIAL, undocumented.** Claude-compatible hooks landed in the `cn` CLI (PR #11029,
  merged 2026-03-04) with 17 events incl. `PreToolUse`, `UserPromptSubmit`, `SessionStart`, `Stop`;
  exit 2 blocks; `hookSpecificOutput` supported. **Evidence is a vendor GitHub issue, not published
  docs** — https://github.com/continuedev/continue/issues/11115 . No IDE-extension hooks documented.

**Vendors where no hook mechanism exists — say this plainly:**

- **Zed: NO.** "hook" appears nowhere in the docs index. External ACP agents keep their own config.
  https://zed.dev/docs/ai/instructions.md
- **Jules: NO.** Cloud/async agent; tasks run in a short-lived Ubuntu VM; the only extension point is
  a setup script or environment snapshot. There is no local lifecycle to hook.
  https://jules.google/docs/environment
- **Aider: NO.** What exists is `--lint-cmd`/`--auto-lint`, `--test-cmd`/`--auto-test`,
  `--notifications-command`, `--git-commit-verify` (which merely runs git's own pre-commit hooks) and
  `--watch-files`. None is an agent-lifecycle hook. https://aider.chat/docs/config/options.html
- **Roo Code: NO**, and the product is shut down.
  https://roocodeinc.github.io/Roo-Code/features/custom-instructions/

### (c) Inferences

- The repo's own README states the limit honestly: "the hard guards run only in Claude Code"
  (`README.md:621`). My audit **confirms** that statement for the guards, and **extends** it: the
  soft code-enforced surfaces (memory, knowledge-sync, auto-update) reach 6 assistants, not 1.
- The gap between "vendors with hooks" (12 of 18, by the vendor-doc reading) and "assistants this
  repo wires hooks for" (6 of 18) is a **harness gap, not a platform gap**. Any claim in a plan that
  uniform code enforcement is impossible must be scoped to the 4 vendors where it genuinely is
  (Zed, Jules, Aider, Roo) plus the 2 where it is user-gated (Junie project-local ignored by default;
  Continue undocumented).

### (d) Open questions

- Would `.claude/settings.json` hooks be picked up by Copilot and Devin Local (both documented as
  reading `.claude/` hooks), giving a second assistant the Claude wiring for free? Not tested.
- Gemini CLI's `BeforeTool` (blocking) is documented but unused by this repo. Why? Not answered in
  code comments.
- Kiro's CLI-vs-IDE split on Prompt Submit blocking: which surface would a fork target?
- Antigravity has no user-prompt event at all; `PreInvocation` fires before each model call, which
  may fire more than once per user turn. Semantics not verified.

---

## 3. The always-on injected block

### (a) Repo facts

**Source.** The block is the body of `skills/suggest/SKILL.md`, materialized to
`.rsc/skills/suggest/SKILL.md` and passed to `wireHook` as `sourceMd`
(`scripts/install-apply.js:294`: `await wireHook(target, paths, join(ensureBase('suggest', cwd, baseVersions), 'SKILL.md'), policy)`).
`suggest` is in `DEFAULT_SKILL_FLOOR` (`scripts/lib/default-skill-floor.js:29`) so every install path
equips it; the hook step is only planned when it is present (`scripts/install-plan.js:9`).

**Two different payloads, measured:**

| surface | what is injected | bytes |
|---|---|---|
| Claude Code `SessionStart` | `readFileSync(suggestMd,'utf8')` — **raw, frontmatter included** (`targets/session-start.mjs:52`) | **7,280** |
| md family (`AGENTS.md`, `GEMINI.md`, `copilot-instructions.md`, `.windsurf/`, `.clinerules/`, `.roo/`, `.continue/`, `.junie/`, `.kiro/`, `CONVENTIONS.md`, `.antigravity/`) | `stripFrontmatter(...)` + `UPDATE_NOTE` + markers (`targets/_md-block.js:28-32`) | **≈ 6,943** (body 6,620 + note 270 + markers 50 + newlines) |
| Cursor `.cursor/rules/rsc-suggest.mdc` | `stripFrontmatter(...)` under `alwaysApply: true` (`targets/cursor.js:11-18`) | **6,620** + 48-byte frontmatter |
| Claude Code `UserPromptSubmit`, **every turn** | `SDD_GATE_TEXT` + one `branchRuleLine` (`targets/userprompt-gate.mjs:38`) | **852** + ~60 |

Rough token estimate (labelled as an estimate, not measured): the 6,620-byte body is mixed
English/Spanish markdown ≈ **1,700–1,900 tokens**; the 7,280-byte Claude variant ≈ **1,900–2,100
tokens**; `SDD_GATE_TEXT` ≈ **200–230 tokens per turn**.

**Delimitation and idempotency.** `targets/_md-block.js:11-15`:

```
const MARK_START = '<!-- rsc-suggest:start -->';
const MARK_END = '<!-- rsc-suggest:end -->';
const SEAM = '\n\n';
```

`wireHook` (lines 33-40) replaces the whole marked region when the start marker is present, else
appends `SEAM + block + '\n'`. `unwireHook` (lines 65-68) removes **exactly** the seam and the marked
block and nothing else — the comment at lines 59-64 records why a document-wide `\n{3,}` → `\n\n`
tidy-up was removed: in issue #249 it reformatted a project's hand-written constitution.

Cursor and Claude Code have **no markers** — cursor's rule file is a whole file rsc owns
(`targets/cursor.js:22-26` removes it outright); Claude's always-on body is printed by a hook, so the
file it lives in is never edited.

**Per-assistant variants that exist today.** Three, all driven by `policy`:

1. Full body (default).
2. **`policy.codeHooks === false`** → a 265-byte stub replaces the whole body, written to
   `.rsc/suggest-always-on.md` for claude (`targets/claude.js:145-148`) and inline for md
   (`targets/_md-block.js:30`) and cursor (`targets/cursor.js:14`). The three stub texts are
   **near-identical but not identical** — cursor's omits "Close with the configured orientation
   block." This is already a per-assistant divergence with no single source.
3. **`UPDATE_NOTE`** (`targets/_md-block.js:19-21`, 270 bytes) is appended for md targets **only** —
   never for claude or cursor. Its text names which assistants self-check for updates.

**Cross-scope de-duplication.** `targets/hook-once.mjs` `claimOnce()` writes an atomic marker under
`tmpdir()/rsc-hooks-<uid>` keyed on `session_id` + `source` (SessionStart, 30 s window) or
`prompt_id` (UserPromptSubmit, exact). Rule stated at line 16: "A duplicated block costs context; a
swallowed always-on layer costs the session its behaviour" — fail-open throughout.

**The size budget is already enforced and nearly exhausted.** `tests/always-on-body.test.js:16`:

```
const BODY_CEILING_BYTES = 8000;
```

asserting `Buffer.byteLength(skills/suggest/SKILL.md) < 8000`. Current size: **7,280 bytes**.
**Headroom for a governance preamble inside the existing ceiling: 720 bytes.** The comment at lines
14-15 records the body was once 11,417 bytes and that this ceiling "is the one number to revisit
deliberately."

The same test file also encodes invariants a governance preamble would have to survive:

- line 30-38: the body must still state the three-lane decisor in full, "not just a pointer",
  because (line 26-29) "hookless assistants (AGENTS.md family, Cursor) have no per-turn gate, so this
  body is the ONLY place the rule exists for them."
- line 44-50: **no shouted directives** — a regex rejects any all-caps word of 4+ letters outside
  code spans, and forbids `stop rationalizing` / `non-negotiable`.
- line 71-79: the body must **not reproduce `SDD_GATE_TEXT` lines verbatim** (dedup against the
  per-turn hook).

`scripts/doctor.js:332-369,463` reports the context budget and `perTurnBytes` from the same
`SDD_GATE_TEXT` constant, so any preamble added to the gate is automatically measured.

### (b) Vendor facts bearing on the block

- Claude Code: `SessionStart` plain stdout is added to context (documented). So printing 7,280 bytes
  works, but `SessionStart` **cannot block** — the always-on block is advisory by construction.
  https://code.claude.com/docs/en/hooks
- Cursor `alwaysApply: true` rules are "always included" — documented, so the 6,620-byte `.mdc` is
  genuinely always-on. https://cursor.com/docs/rules
- Zed reads root `AGENTS.md` **only if** no `.rules`, `.cursorrules`, `.windsurfrules`,
  `.clinerules`, `.github/copilot-instructions.md` or `AGENT.md` exists first.
  https://zed.dev/docs/ai/instructions.md — **a project with any of those loses the rsc block
  entirely on Zed.** This is a silent failure mode.
- Antigravity `.agents/rules/*.md` requires a `trigger:` frontmatter key "else the rule is silently
  discarded". https://antigravity.google/docs/rules
- Aider does not auto-read `CONVENTIONS.md`. https://aider.chat/docs/usage/conventions.html

### (c) Inferences

- The injected block **is** the natural insertion point for a governance preamble on the 12
  instruction-only assistants — it is the only text guaranteed present. But its budget is ~720 bytes
  inside the current ceiling, and three test invariants (full decisor restated, no shouting, no gate
  duplication) constrain its wording.
- Per-assistant variants are already a fact of the codebase (3 shapes, inconsistent stub text,
  md-only `UPDATE_NOTE`). A governance contract that assumes one block for all 18 would be
  contradicted by code that already exists.
- **REQUIREMENTS §6's warning is empirically correct here**: for claude the block is injected by a
  hook that cannot block, for cursor it is a rule the model may or may not honour, and for Zed/Aider
  /Antigravity it may not be loaded at all. Presence of a preamble is not compliance.

### (d) Open questions

- Would the fork raise `BODY_CEILING_BYTES`? That is a plan decision, not an audit finding, but the
  number is the hard constraint on preamble size.
- Is the frontmatter asymmetry (Claude gets 660 bytes of YAML, nobody else does) deliberate? No
  comment explains it.

---

## 4. Documentation root configurability — SETTLED

### Verdict: **FIXED. Not configurable in any way.**

### (a) Repo facts — the exhaustive search

| mechanism searched | result |
|---|---|
| Identifier names `docsRoot`, `DOCS_ROOT`, `docs_root`, `docsDir`, `DOCS_DIR`, `knowledgeRoot`, `wikiRoot`, `docsBase`, `docRoot`, `KNOWLEDGE_ROOT`, `WIKI_ROOT` | **0 hits** in code. The only matches repo-wide are (i) `docs/fork/LEDGER.md:64`, the prior finding itself, and (ii) a **local** variable `const docsDir = join(cwd, '02-DOCS', 'wiki', 'harness')` at `scripts/lib/onboarding-apply.js:230` — a local alias for the hard-coded path, not a configuration point. |
| Environment variables | Every `process.env.*` / `env.*` reference in `scripts/` + `targets/`: `CODEX_CLOUD_AGENT`, `CURSOR_CLOUD_AGENT`, `DSH_HOME`, `GIT_INDEX_FILE`, `LANG`, `LC_ALL`, `LC_MESSAGES`, `OPENCODE_REMOTE`, `RSC_AUTO_UPDATE_CMD`, `RSC_HOOK_MARKER_DIR`, `RSC_KNOWLEDGE_SYNC_FOREGROUND`, `RSC_LATEST`, `RSC_LATEST_JSON`, `RSC_MEMSLOP_HOME`, `RSC_MEMSLOP_PLATFORM`, `RSC_MEMSLOP_RELEASE`, `RSC_NO_UPDATE_CHECK`, `RSC_OPENCODE_MAJOR`, `RSC_PROJECT_CWD`, `RSC_REMOTE_AGENT`, `RSC_SELLO_HOME`. **None addresses the documentation root.** |
| `.rsc.json` manifest keys | `scripts/lib/manifest-file.js:18` — `KEYS = ['version','targets','skills','agents','ownSkills','catalogVersion','tier','optOuts','memory','gitPermissions','agentModels','onboarding']`. **No docs-root key.** `readManifest` (lines 31-47) returns exactly these and nothing else, so an unknown key in a user's `.rsc.json` is silently dropped. |
| CLI flags | All long flags in `scripts/rsc.js`: `--accept-partial-lenses --accept-plan --accompaniment --all --approve --available --confidence --confirm --dry-run --evidence --force --full --global --goal --goal-base --help --json --justify --keep --lenses --lines --procedure --profile --project-kind --reason --scope --session --software-scope --target --technical-level --text --topic --verdict --version --window --with-docs --without --workflow --yes`. `--with-docs` is a **destructive** switch for purge (`scripts/install-apply.js:942`), not a path. `grep -- "--docs"` → 0 hits. |
| A single constant to change | **There is none.** `02-DOCS` is written as a literal string at every use site. |
| Detection of an existing folder | **None.** The only existence checks are of the fixed path, e.g. `scripts/lib/ingest-move.js:69`: `if (!existsSync(join(projectRoot, '02-DOCS'))) return { … reason: 'this project has no 02-DOCS/ yet; set up the harness first' }`. |
| Numbered-folder convention (`01-TOOLS`/`02-DOCS`/`03-…`) | `01-TOOLS` and `02-DOCS` exist; **no `03-` or higher appears anywhere in the repo.** There is no code that enumerates, parses or generalises the numeric prefix. The two names are independent hard-coded literals. |

**Scale of the coupling (measured):**

- `02-DOCS` appears in **316 files** repo-wide.
- Of those, **81 are `.js`/`.mjs`** files, carrying **536 literal occurrences**.
- **164 are `.md`** files (skill bodies and references) — these are *prose* instructions to the model,
  which is a different and harder kind of call site: they cannot be parameterised by a constant.

**Call sites by layer** (from the `.js`/`.mjs` set): `scripts/lib/` (8 files: `onboarding.js`,
`onboarding-apply.js`, `constitution-draft.js`, `ingest-move.js`, `knowledge-doctor.js`,
`domains.js`-adjacent, `spec-gate.js`, `repair.js`-adjacent), `scripts/` (`audit.js`, `doctor.js`,
`drift-check.js`, `install-apply.js`, `knowledge-doctor.js`, `rsc.js`, `spec-gate.js`,
`detect-repo.js`, `skill-behavior-eval.js`, 2 workflow files), `targets/` (10 files: `claude.js`,
`cursor.js`, `_md-block.js`, `agents.js`, `opt-outs.js`, `auto-update.mjs`, `copy-rules.mjs`,
`danger-guard.mjs`, `ftd-nudge.mjs`, `knowledge-sync.mjs`, `session-memory-core.mjs`,
`session-start.mjs`, `team-safe-start.mjs`, `worklog-checkpoint.mjs`, `worktree-reaper.mjs`), and
**~50 test files** that assert against the literal.

**Where the constant *would* live if one were introduced.** There is no existing home. The closest
candidates, each already owning a fragment of the path:

- `scripts/lib/constitution-draft.js:19` — `export const CONSTITUTION_PATH = '02-DOCS/wiki/sdd/constitution.md'`
- `scripts/lib/onboarding-apply.js:373` — `HARNESS_FLOOR_MINIMUM = [TEMPLATE_FLOOR, '02-DOCS/wiki/harness/']`
- `targets/knowledge-sync.mjs:47` — `KNOWLEDGE = ['01-TOOLS/', '02-DOCS/wiki/', '02-DOCS/attachments/']`
- `targets/knowledge-sync.mjs:49` — `PERSONAL = ['02-DOCS/wiki/harness/user-profile.md']`
- `scripts/lib/ingest-move.js:16` — `PROTECTED_DIRS = new Set(['02-DOCS','01-TOOLS','.git', …])`
- `scripts/knowledge-doctor.js:20` — `const WIKI = join(REPO, '02-DOCS', 'wiki')`

**A hard structural blocker on configurability.** `targets/knowledge-sync.mjs` is materialized as a
standalone file under `.rsc/` and its header states (lines 34-36): *"Standalone on purpose: hooks are
materialized file by file under `.rsc/`, so this imports nothing but Node."* The same applies to
every `.mjs` hook. **A shared constants module cannot be imported by the hook layer** without
changing the materialization strategy — so a configurable root would need the value *baked into each
materialized hook at install time*, or re-read from `.rsc.json` by each hook independently.

**Estimated call-site count for a configurable root.** 536 code occurrences across 81 files, of which
~50 files are tests, plus 164 markdown files whose prose names the path to the model. **Order of
magnitude: ~250 production code sites + ~290 test assertions + 164 prose documents.** Plus the hook
materialization constraint above. (Inference, labelled: this is a count of occurrences, not a
refactor estimate; many occurrences sit inside a single `join()` chain.)

### (b) Vendor facts

Not applicable — `02-DOCS` is wholly an rsc convention. No vendor documents it.

### (c) Inference

REQUIREMENTS §5 says: *"`02-DOCS/` es la raíz de documentación predeterminada. Si la auditoría
demuestra que esa raíz es configurable, respeta la configuración…"*. **The audit demonstrates it is
not.** The conditional clause is therefore inert, and §5's standard path resolves unconditionally to
the literal `02-DOCS/wiki/skills/<nombre-oficial>/README.md`.

### (d) Open question

None on configurability — this is settled. One adjacent question: `02-DOCS/.rscignore` appears 5
times in skill prose; whether it can exclude paths from the wiki (and so interact with a governance
discovery rule) was not traced.

---

## 5. The existing `02-DOCS` customisation convention

### (a) Repo facts

**What creates the skeleton.** `scripts/lib/onboarding-apply.js:393-418` `ensureHarnessSkeleton()`:

```
assertManagedPathsStayInsideRoot(cwd, ['01-TOOLS/', TEMPLATE_FLOOR, '02-DOCS/wiki/harness/']);
for (const dir of ['02-DOCS/wiki/harness', '01-TOOLS/_TEMPLATE']) { … mkdirSync … }
```

So the **only** directories the installer deterministically creates are `02-DOCS/wiki/harness/` and
`01-TOOLS/_TEMPLATE/`. `HARNESS_FLOOR_MINIMUM` (line 373) = `['01-TOOLS/_TEMPLATE/', '02-DOCS/wiki/harness/']`;
`HARNESS_FLOOR_CONSTITUTION` (line 376) = `CONSTITUTION_PATH` = `02-DOCS/wiki/sdd/constitution.md`
(a draft, written by `scripts/lib/constitution-draft.js:148`). `scripts/lib/tools-skeleton.js` covers
only the `01-TOOLS/` side and is reversible file-by-file while byte-identical
(`removeUnmodifiedSkeleton`, lines 52-76).

Everything else under `02-DOCS/` is created **by the model following skill prose**, not by code.

**What the harness itself reads or writes under `02-DOCS/` (code, not prose):**

| path | read/written by |
|---|---|
| `02-DOCS/wiki/harness/user-profile.md` | `targets/session-start.mjs:121`, `targets/danger-guard.mjs:60`, `targets/team-safe-start.mjs:117`, `scripts/lib/onboarding-apply.js:171,185,230`; **never synced** (`targets/knowledge-sync.mjs:49` `PERSONAL`) |
| `02-DOCS/wiki/harness/decisions.md`, `installation-plan.md` | `scripts/lib/onboarding-apply.js:212,240,246` |
| `02-DOCS/wiki/sdd/constitution.md` | `scripts/lib/constitution-draft.js:19,138,148` |
| `02-DOCS/wiki/sdd/config.yaml`, `sdd/specs/` | `scripts/spec-gate.js:14,135` |
| `02-DOCS/wiki/` (whole tree) | `scripts/knowledge-doctor.js:20`, `scripts/drift-check.js:146,269`, `scripts/audit.js:224-225` |
| `02-DOCS/wiki/ftd/<slug>.md` | `targets/knowledge-sync.mjs:632,747` (FTD auto-close on merge) |
| `02-DOCS/wiki/.ingested.json` | `scripts/lib/ingest-move.js:49` |
| `02-DOCS/inbox/` | `targets/session-start.mjs:169-170` (auto-ingest nudge) |
| `02-DOCS/raw/`, `02-DOCS/raw/worklog/` | `scripts/lib/ingest-move.js:83`, `targets/worklog-checkpoint.mjs:14`, `targets/session-memory-core.mjs:89`, `targets/worktree-reaper.mjs:418,421` |
| `02-DOCS/attachments/` | `targets/knowledge-sync.mjs:47` |
| `02-DOCS/` + `01-TOOLS/` as protected dirs | `scripts/lib/ingest-move.js:16`, `targets/ftd-nudge.mjs:54` |
| `02-DOCS/` preserved on purge unless `--with-docs` | `scripts/install-apply.js:942-943`: *"your knowledge base. Add `--with-docs` to remove it too."* |

**The convention in skill prose — measured, and it is not uniform:**

- **274** skills total; all carry `origin: risco` in frontmatter.
- **96 of 274** `SKILL.md` files mention `02-DOCS` at all. **178 never do.**
- **24 of 274** name `02-DOCS/wiki/stack/<their-own-id>.md`: `coolify`, `course-storytelling`, `cpp`,
  `deployment`, `duckdb`, `expo`, `fastapi`, **`flutter`**, `gamedev-pathing`, `go`, `java`,
  `level-design`, `modal`, `mongodb`, `nextjs`, `postgresdb`, `presentations`, `python`, `react`,
  `redis`, `rust`, `security-scan`, `spring-boot`, `vue-nuxt`.
- **5 more** name a `wiki/stack/` file that is *not* their own id: `agent-eval` (`stack/evals.md`),
  `building-agents`, `constitution` (`stack/*` reconciliation), `plan` (`stack/*`), `secure-coding`.
- The rest use **topic folders**, not `stack/`. Occurrence counts across `skills/**`:
  `wiki/sdd` 201, `wiki/harness` 119, `wiki/index` 79, `wiki/stack` 62, `wiki/brand` 48,
  `wiki/youtube` 39, `wiki/teaching` 29, `wiki/shortform` 29, `wiki/linkedin` 25, `wiki/medium` 16,
  `wiki/log` 11, `wiki/ftd` 6, `wiki/marketing` 5, `wiki/decisions` 5, `wiki/content` 5,
  `wiki/competitors` 5, `wiki/scores` 2, `wiki/design` 2, plus singletons
  (`wiki/reports`, `wiki/operations`, `wiki/ml`, `wiki/gaps`, `wiki/data`, `wiki/brand-study`) and
  case-inconsistent variants (`wiki/Articles`, `wiki/Decisions`, `wiki/Worklog`).
- Second-level histogram across all skill markdown: `02-DOCS/wiki` 662, `02-DOCS/raw` 53,
  `02-DOCS/inbox` 11, `02-DOCS/shortform` 11, `02-DOCS/audits` 5, `02-DOCS/.rscignore` 5,
  `02-DOCS/linkedin-outreach` 4, `02-DOCS/.obsidian` 3, `02-DOCS/attachments` 2.

**The canonical example, verbatim** — `skills/flutter/SKILL.md:392-399`:

> `## Project grounding (02-DOCS)` … "In a project with a `02-DOCS/` layer (the `harness` wiki), this
> app's decisions live in `02-DOCS/wiki/stack/flutter.md`, indexed in `02-DOCS/wiki/index.md`. Read it
> first and stay … No `02-DOCS/` layer? Skip silently: technical conventions are *recorded, not
> gated*…"

**The target path does not exist.** `grep -rn "wiki/skills"` across the whole repo → **0 hits**.
`02-DOCS/wiki/skills/<official-name>/README.md` is greenfield.

**How customisations are versioned — a correction to a likely assumption.** REQUIREMENTS §5 says
customisations "se versionan en Git". They are, but **not on the trunk by default**.
`targets/knowledge-sync.mjs:2-11,47-53`:

- `KNOWLEDGE = ['01-TOOLS/', '02-DOCS/wiki/', '02-DOCS/attachments/']` sync automatically.
- They travel through a dedicated remote branch `KNOWLEDGE_BRANCH = 'rsc/knowledge'`, **never the
  default branch** ("team-safe-default D: assume it is protected", line 7).
- Every sync commit carries `[skip ci]` (line 51).
- `PERSONAL = ['02-DOCS/wiki/harness/user-profile.md']` is **never synced** and is excluded from
  commits.
- It reaches the default branch "inside everybody's ordinary pull requests".
- On by default; project opt-out `.no-knowledge-sync` travels in `.rsc.json`
  (`targets/opt-outs.js:29`).

So a customisation at `02-DOCS/wiki/skills/<id>/README.md` would fall inside `02-DOCS/wiki/` and be
**auto-committed and auto-pushed to `rsc/knowledge` by a hook**, on 6 assistants, without the person
asking. That is a design consequence a §5 transition must account for.

**Note on this repo's own `.gitignore`.** `.gitignore:32` ignores `02-DOCS/` — but that is
**rsc-harness's own repository only**, documented at lines 23-28 as a 2026-09-04 migration of its
working documentation to a separate RSC repo. The installer's gitignore writer
(`scripts/install-apply.js:426`) adds only `['.rsc/', '.worktrees/']` plus derived per-target skill
entries — **it never adds `02-DOCS/` to a consumer project.** `scripts/lib/knowledge-doctor.js:11`
saying "`02-DOCS/` is untracked (P9)" refers to rsc's own workspace, not to installed projects.
(Inference, labelled: an independent reviewer could easily misread that comment as a product
property; it is not.)

### (b) Vendor facts

None — this is entirely an rsc convention.

### (c) Inferences

- What a §5 transition must preserve, concretely: the 24 `wiki/stack/<id>.md` conventions, the
  ~18 distinct topic folders, `wiki/index.md` as the Knowledge map that everything claims to be
  indexed in, `wiki/harness/{user-profile,decisions,installation-plan}.md`, `wiki/sdd/*` (201
  references, the most-coupled subtree), `wiki/ftd/*` (auto-closed by a hook), `wiki/brand/*` (read
  by `targets/copy-rules.mjs:97` at `Stop`), and `raw/worklog/` (the memory store).
- The **"recorded, not gated"** phrasing used by `flutter`, `agent-eval`, `redis`, `expo` and others
  is the existing contract for project grounding: *read it if present, skip silently if absent*.
  That is already very close to REQUIREMENTS §5's mandated behaviour (1-5), which means the
  transition is partly a consolidation of an existing idiom rather than a new one.
- Because 178 of 274 skills say nothing about `02-DOCS`, a per-skill prose edit strategy (strategy A
  in §4 of the requirements) would mean **adding** the grounding clause to 178 files, not editing 274.

### (d) Open questions

- `02-DOCS/.rscignore` (5 prose references): does it exclude paths from the wiki in a way that could
  hide a `wiki/skills/<id>/README.md`? Not traced.
- `wiki/index.md` is claimed as the index in 79 places but nothing in code maintains it. Would a
  governance entry point need to register there, and who would do it?
- Case-inconsistent folders (`wiki/Articles`, `wiki/Decisions`, `wiki/Worklog`) exist in prose. On a
  case-insensitive filesystem these collide with the lowercase forms. Not investigated.

---

## 6. Per-assistant invocation routes

REQUIREMENTS §6 requires covering four routes: **explicit invocation**, **automatic selection**,
**reference from another skill**, **internal flows**. Here is how each actually works per adapter
family, and where a governance instruction would and would not be seen.

### (a) Repo facts, by adapter family

#### Family `claude` (1 target)

| route | mechanism | would a governance instruction be seen? |
|---|---|---|
| Explicit | `.claude/skills/<id>/SKILL.md` is a native Claude Code skill; `targets/commands.js:6` sets `skillsAreCommands: true`, so rsc writes **no** `/<skill>` wrapper commands for claude — the native surface already exposes them. `.claude/commands/*.md` still gets the non-skill fixed commands (`build-fix`, `checkpoint`, `learn`, `save-session`, `resume-session`, …). | **Yes** — the full SKILL.md body, including `references/`, is on disk via symlink. |
| Automatic | Native skill selection from `description` frontmatter. | **Yes**, if the instruction is in the body (paid only when the skill loads) or in the always-on block (paid always). |
| Reference from another skill | Relative links resolve: `../ftd/SKILL.md` works because sibling skill dirs are all symlinks under `.claude/skills/`. 80 SKILL.md files use `](../`. | **Yes** |
| Internal flows | `.claude/agents/*.md` subagents (`targets/agents.js:34`), `SessionStart` + `UserPromptSubmit` injection, 4 `PreToolUse(Bash)` guards, `PostToolUse` nudge, `Stop` copy-guard. | **Yes, and enforceable** — this is the only family where a governance check can *deny*. |

#### Family `cursor` (1 target)

| route | mechanism | would a governance instruction be seen? |
|---|---|---|
| Explicit | `.cursor/commands/*.md` (`targets/commands.js:7`), rendered as `# /<name>` + description + body (`targets/commands.js:163`). | Yes, in the command file. |
| Automatic | `.cursor/rules/<id>.mdc` with `alwaysApply: false` and `description: rsc skill <id>` (`targets/cursor.js:7`). **The description is a fixed 18-character string — it carries none of the skill's own triggering description.** | **Degraded.** Cursor's rule selection has almost nothing to match on: `rsc skill flutter` instead of the skill's real `description`. (Inference, labelled: this makes automatic selection on Cursor materially worse than on any other target.) |
| Reference from another skill | **Structurally impossible.** `targets/cursor.js:4-9` copies only `SKILL.md`; `references/`, `scripts/`, `assets/` and sibling skills are absent. All 80 `](../` links and every `references/…` link point at nothing. | **No** — any governance instruction that lives in a referenced file is unreachable on Cursor. |
| Internal flows | `.cursor/agents/*.md` (`targets/agents.js:36`); `.cursor/hooks.json` for memory + knowledge-sync + update; `.cursor/rules/rsc-memory.mdc` as an always-apply rule because `sessionStart` is fire-and-forget (`targets/memory.js:17-19,200`). | Partial — `beforeSubmitPrompt` can block, `sessionStart` injection is unreliable. |

#### Family `md` (16 targets)

| route | mechanism | would a governance instruction be seen? |
|---|---|---|
| Explicit | Only 6 of the 16 get command files (`gemini`, `opencode`, `copilot`, `windsurf`, `cline`, `roo` — `targets/commands.js:8-13`). **`codex`, `deepseek`, `amp`, `jules`, `zed`, `antigravity`, `junie`, `kiro`, `aider`, `continue` get no command surface at all.** | Only on those 6. |
| Automatic | **This is the structural hole.** Skills land at `<dot-dir>/rsc/<id>/` — `.codex/rsc/`, `.amp/rsc/`, `.zed/rsc/`, `.gemini/rsc/`, `.github/rsc/`, `.windsurf/rsc/`, `.roo/rsc/`, `.continue/rsc/`, `.junie/rsc/`, `.kiro/rsc/`, `.antigravity/rsc/`, `.aider/rsc/`, `.jules/rsc/`, `.opencode/rsc/`, `.clinerules/rsc/`. **I searched the repo and found nothing that tells these assistants where those directories are**: the injected block (`skills/suggest/SKILL.md`) never names a skill root, and no index file is generated. The only md-family exception is `deepseek`, whose root `.dsh/skills` *is* the vendor's native discovery path. | **No, for 15 of 16.** Automatic selection cannot reach a skill the assistant does not know exists. |
| Reference from another skill | Relative `../<skill>/SKILL.md` links resolve on disk (siblings under one `rsc/` root), *if* the assistant ever reads the first file. | Conditional on the above. |
| Internal flows | `codex`, `gemini`, `opencode` get subagents + commands + hooks. `copilot`, `junie`, `kiro` get subagents (`targets/agents.js:35,44,45`). The remaining 10 get **only** the markdown block. | Instruction-text only. |

### (b) Vendor facts

- Documented skill-discovery paths, per vendor, versus what `SPEC` writes:

| assistant | vendor-documented skill path | `SPEC.root` | match? |
|---|---|---|---|
| Claude Code | `.claude/skills/<n>/SKILL.md` | `.claude/skills` | **yes** |
| DeepSeek Harness | `.dsh/skills/<n>/SKILL.md` (rank 100) | `.dsh/skills` | **yes** |
| Copilot | `.github/skills/<n>/SKILL.md`, `.claude/skills`, `.agents/skills` | `.github/rsc` | no |
| Zed | `.agents/skills/<n>/SKILL.md` | `.zed/rsc` | no |
| Amp | `.agents/skills/`, `.claude/skills/` | `.amp/rsc` | no |
| Roo | `.roo/skills/<n>/SKILL.md`, `.agents/skills/` | `.roo/rsc` | no |
| Cline | `.cline/skills/`, `.clinerules/skills/`, `.claude/skills/` | `.clinerules/rsc` | no |
| Junie | `.junie/skills/<n>/`, `.agents/skills/` | `.junie/rsc` | no |
| Kiro | `.kiro/skills/` | `.kiro/rsc` | no |
| Antigravity | `.agents/skills/<n>/SKILL.md` | `.antigravity/rsc` | no |
| Windsurf/Devin | `.devin/skills/<n>/SKILL.md`, `.agents/skills/`, legacy `.windsurf/skills` | `.windsurf/rsc` | no |
| Continue | no skills documentation found | `.continue/rsc` | n/a |
| Jules | no skills documentation found | `.jules/rsc` | n/a |
| Aider | no skills concept | `.aider/rsc` | n/a |
| Codex | `.claude/skills`, `.agents/skills` harness dirs (per Copilot docs cross-reference) | `.codex/rsc` | no |
| OpenCode | not established in this audit | `.opencode/rsc` | unknown |
| Gemini CLI | not established in this audit | `.gemini/rsc` | unknown |
| Cursor | rules, not skills | `.cursor/rules` | **yes (as rules)** |

URLs: https://code.visualstudio.com/docs/copilot/customization/agent-skills ,
https://zed.dev/docs/ai/skills.md , https://ampcode.com/docs/markdown/customize/skills ,
https://roocodeinc.github.io/Roo-Code/features/skills , https://docs.cline.bot/customization/skills.md ,
https://junie.jetbrains.com/docs/agent-skills.html , https://kiro.dev/docs/skills.md ,
https://antigravity.google/docs/skills , https://docs.devin.ai/desktop/devin-local/customizations.md ,
https://github.com/deepseek-ai/deepseek-harness

- **A convergent standard exists that `SPEC` does not use.** `.agents/skills/<name>/SKILL.md` is
  documented by Zed, Amp, Roo, Antigravity, Junie and Devin Local, and `.claude/skills` by Copilot,
  Amp, Cline and Codex. (Inference, labelled: writing to `.agents/skills/` would make skills natively
  discoverable on at least 6 of the 15 currently-undiscoverable targets.)

### `scripts/routing-audit.js` — what the repo measures about automatic selection

`scripts/routing-audit.js` is **not** an assistant-routing test. It measures the **lexical ranker**
(`scripts/consult.js`) against every skill's `evals/cases.yaml` (all 274 skills have one). Floors at
lines 11-17: `rank1: 44`, `top5: 70`, `routedTop5: 85`, `maxNegativeSelfRank1: 6`,
`maxCollision: 0.80`. It ranks `should_trigger` prompts and checks `route_to` declarations.

**This is the repo's own admission about automatic selection:** a **rank-1 floor of 44%**. And
`skills/suggest/SKILL.md:67-68` states it outright: *"`npx @ericrisco/rsc consult "<task>"` is a
**lexical** hint only: it misses natural-language and non-English intent. Its silence never means 'no
skill exists'."* So even the one measured routing mechanism is explicitly not the decider — the model
is.

### Routes structurally unable to carry a governance check

1. **Automatic selection on 15 md-family targets** — nothing points the assistant at `<dot>/rsc/<id>/`.
2. **Reference-from-another-skill on Cursor** — referenced files are not copied at all.
3. **Automatic selection on Cursor** — the `.mdc` `description` is `rsc skill <id>`, discarding the
   skill's real triggering description.
4. **Explicit invocation on 10 md targets** — no command surface is written.
5. **Any route on Aider** — `CONVENTIONS.md` is not auto-read.
6. **Any route on Zed in a project that has `.rules`, `.cursorrules`, `.windsurfrules`,
   `.clinerules` or `.github/copilot-instructions.md`** — `AGENTS.md` is 7th in a first-match chain,
   and `copilot-instructions.md` is itself a file rsc writes for the `copilot` target, so **wiring
   `copilot` and `zed` in the same project silently disables the Zed block.** (Inference from two
   verified facts: `SPEC.copilot.hook = '.github/copilot-instructions.md'` and Zed's documented
   precedence chain.)
7. **Antigravity `.agents/rules/*.md`** requires a `trigger:` key — but rsc writes to
   `.antigravity/AGENTS.md`, an undocumented path, so this route is unverified either way.

### (d) Open questions

- Do Codex / Gemini CLI / OpenCode document a project skill directory? Not established here.
- Does `.clinerules/rsc/**` get loaded recursively by Cline (see §1)?
- `targets/agent-catalog.js` (22 KB) and `agent-sources.json` were not read; subagent-as-route was
  covered only through `targets/agents.js`'s target table.

---

## 7. Opt-outs and user-authored skills

### (a) Repo facts

**Opt-out taxonomy.** `targets/opt-outs.js` splits `.no-*` switches by *whose decision they are*:

- `PROJECT_OPT_OUTS` (lines 19-35, 16 entries): `audit`, `auto-update`, `claudemd-check`,
  `copy-guard`, `danger-guard`, `feature-gate`, `ftd-close`, `ftd-nudge`, `gitmoji`,
  `knowledge-sync`, `ship-guard`, `trunk-guard`, `trunk-open`, `worktree-cleanup`,
  `worktree-isolation`. These live in `.rsc.json` `optOuts` and are **rebuilt in a clone**.
- `MACHINE_OPT_OUTS` (lines 38-44, 5 entries): `context7`, `git`, `harness`, `memslop`,
  `scope-check`. **Never written to the manifest, never applied from it.** The header (lines 7-12)
  gives the reason: `.no-harness` means "do not offer to build the harness ON THIS MACHINE"; letting
  it travel would mean "a whole team losing the harness because somebody's laptop said no."
- `projectOptOuts()` (line 49) filters unknown names out and sorts — so a typo'd opt-out is silently
  dropped, not honoured.
- The table shape is deliberate (lines 14-16) so `clone-bootstrap.mjs`, which is committed,
  standalone and cannot import from the package, can be held against it by a test.

**Governance-relevant:** `feature-gate`, `danger-guard`, `copy-guard`, `ship-guard`, `gitmoji`,
`trunk-guard` are all project opt-outs. **Every code-enforced guard in this harness is disarmable by
a committed `.rsc.json` key.** A governance contract that claims a code guarantee must state that
the guarantee is conditional on the project not having opted out — and that the opt-out travels to
every clone.

**User-authored skill preservation — two independent mechanisms, and one is dead.**

1. **Pre-install collision detection** (`scripts/install-apply.js:504-516`):
   ```
   export function collisions({ cwd, target, home, skillIds }) {
     const managed = new Set(Object.keys(readState(paths.stateFile).skills || {}));
     return skillIds.filter((id) => !managed.has(id) && existsSync(paths.skillDir(id)));
   }
   ```
   Ownership is proven by the **per-target state file** (`<root>/.rsc-state.json`,
   `targets/index.js:167`) — not by name. `ownSkillPaths()` (lines 512-516) runs the same test across
   every target of a plan and returns paths "the user would recognise"; the comment says *"`onboard`
   puts these in the plan itself, so the id the user accepts is an id that names them."* This is the
   fix for `rscFixes` 2.0.18 — *"Onboarding silently replaced a skill you wrote yourself that had the
   same name as one of rsc's (review, plan, debug…)"*.
2. **Pruning respects ownership** (`scripts/install-apply.js:272-281`): *"Ownership is proven by the
   state file — a same-named directory rsc never recorded is somebody's own work and is not
   touched."* Same for the shared base, proven by the base-version ledger.
3. **Provenance by frontmatter, at doctor time** (`scripts/doctor.js:160-196`): every catalog skill
   declares `origin: risco` (**verified: 274 of 274 `SKILL.md` files carry it**), so "is this ours?"
   is answered from the file. Symlinks are deliberately included because a catalog skill *is* a
   symlink and a hand-written one is a real directory — "the entry type is itself a provenance
   signal". **Failure direction is deliberate:** anything without `origin: risco` is read as the
   user's (lines 165-168: *"Reading a catalog skill as the user's leaves a file that stops being
   updated; reading the user's as the catalog's invites something to overwrite it. Only one of those
   loses work."*)
4. **`.rsc.json` `ownSkills` is dead accounting.** `scripts/doctor.js:161-164` states it plainly:
   *"the list in `.rsc.json` that nobody ever filled: that list is parallel accounting (P3), it has
   been empty in every project since it was introduced, and `doctor` has been faithfully reporting on
   the emptiness."* It survives only so a team that *did* fill it by hand gets `ownMissing` reported
   (`scripts/lib/divergence.js:39`). `scripts/install-apply.js:224` carries `prev.ownSkills` forward
   unchanged — **nothing ever writes it.**
5. **Purge ownership proof.** `scripts/install-apply.js:906`: *"A lost state file also loses proof of
   ownership. Leave same-named user files"* — purge refuses to delete what it cannot prove it wrote.
   Same discipline for the shadow CLAUDE.md (`targets/agents-md-shadow.js:146-153`), the
   `01-TOOLS/_TEMPLATE/` assets (`scripts/lib/tools-skeleton.js:62-73`), the `_md-block` block
   (`targets/_md-block.js:65-68`), and anything committed to git
   (`scripts/lib/tools-skeleton.js:48-55`).

**Limits on inspecting personal / global / plugin skills, per assistant.**

(a) Repo fact: **the harness inspects only the project scope.** `ownSkillsIn()`
(`scripts/doctor.js:170-196`) reads exactly `dirname(paths.skillDir('_'))` — the project's own skill
root for the resolved target. There is no code that enumerates `~/.claude/skills`,
`~/.config/opencode/`, `~/.cursor/`, a plugin's skills, or an IDE-managed skill store. The one
cross-scope awareness that exists is the **duplicate-scope detector**
(`targets/session-start.mjs:96-120`), which compares `<project>/.rsc/.version` against
`<home>/.rsc/.version` and only warns that the always-on block is being injected twice. It is itself
opt-out-able (`.rsc/.no-scope-check`, a **machine** opt-out) and cadence-limited to 7 days.

(b) Vendor facts on where competing skills can live, which bounds what could ever be inspected:

| assistant | personal / global skill or rules scope documented | URL |
|---|---|---|
| Claude Code | `~/.claude/settings.json`, managed policy settings, **plugin `hooks/hooks.json`**, skill and subagent frontmatter | https://code.claude.com/docs/en/hooks |
| Codex | `~/.codex/hooks.json`, `~/.codex/config.toml`, `~/.codex/AGENTS.md` | https://developers.openai.com/codex/hooks |
| Cursor | `~/.cursor/hooks.json` | https://cursor.com/docs/agent/hooks |
| Gemini CLI | `~/.gemini/settings.json`, `/etc/gemini-cli/settings.json`, **extensions** | https://geminicli.com/docs/hooks/reference |
| OpenCode | `~/.config/opencode/plugins/`, npm-package plugins declared in config | https://opencode.ai/v2/docs/build/plugins/server |
| DeepSeek Harness | per-profile plugins under `$DSH_HOME/profiles/<name>`; skills at `$DSH_HOME/skills` (rank 400) and `~/.agents/skills` (rank 500) | https://github.com/deepseek-ai/deepseek-harness |
| Copilot | `.github/copilot/settings.json`, and it reads `.claude/settings.json` hooks | https://docs.github.com/en/copilot/reference/hooks-configuration |
| Zed | `~/.config/zed/AGENTS.md` | https://zed.dev/docs/ai/instructions.md |
| Amp | `~/.config/amp/plugins/`, `~/.config/amp/AGENTS.md` | https://ampcode.com/docs/markdown/customize/plugins |
| Junie | `~/.junie/config.json` — **and project-local hooks are ignored by default** | https://junie.jetbrains.com/docs/junie-cli-hooks.html |
| Kiro | `~/.kiro/hooks/`, `~/.kiro/steering/` | https://kiro.dev/docs/hooks.md |
| Antigravity | `~/.gemini/config/hooks.json`, `~/.gemini/AGENTS.md`, `~/.gemini/config/rules/*.md` | https://antigravity.google/docs/hooks |
| Continue | `~/.continue/settings.json` | https://github.com/continuedev/continue/issues/11115 |
| Cline | `~/.cline/plugins/` | https://docs.cline.bot/sdk/plugins.md |

### (c) Inferences

- **REQUIREMENTS §7's step 1** ("inventariar las seleccionadas y otras visibles que puedan competir,
  cuando sea posible inspeccionarlas") is currently satisfiable **only for the project scope, and
  only for the one resolved target**. Every assistant above has at least one personal or global scope
  that no code in this repo reads. The qualifier "cuando sea posible inspeccionarlas" is doing a lot
  of work: it is *technically* possible (these are files on disk) but **nothing does it today**, and
  for plugin/extension scopes (Claude Code plugins, Gemini CLI extensions, OpenCode npm plugins) the
  content is not even necessarily in the project's filesystem.
- The `origin: risco` frontmatter marker is the strongest asset for a fork. 274/274 coverage means a
  fork can rename the catalog and still answer "is this ours?" from the file — but it also means the
  marker value itself is a fork decision (keep `risco`, or change it and break every existing
  install's provenance check).

### (d) Open questions

- Would a fork read `~/.claude/skills` and the other personal scopes for §7's competing-skill
  inventory? That is a new capability, not a modification.
- `.rsc/.no-harness` is a **machine** opt-out, so a fork cannot ship a project-level "this repo is
  governed" switch using that mechanism without changing the taxonomy.
- `targets/git-permissions.js` (21 KB) was not read; it may hold further opt-out surface.

---

## 8. Deliverable: assistant support matrix

Legend for "enforcement by code": **Full** = a real event this repo already wires that can inject
*and* deny. **Partial** = a real wired event with a documented limitation. **None (vendor has hooks)**
= the vendor documents hooks this repo does not use. **None (no mechanism)** = no vendor hook
mechanism exists.

| # | assistant | delivery mechanism | hook event available **and wired here** | enforcement by code | platform caveats |
|---|---|---|---|---|---|
| 1 | **claude** | relative symlink → `.claude/skills/<id>/` (**native path**) | `SessionStart`, `UserPromptSubmit`, `PreToolUse`×4(Bash), `PostToolUse`, `Stop`, `PreCompact`, `SessionEnd` (+7 memory, +2 knowledge) | **Full** | Windows → real copy; wiring in 2 scopes injects twice unless the lagging scope is updated; shadow `CLAUDE.md` needed when root `AGENTS.md` is also wired |
| 2 | **codex** | relative symlink → `.codex/rsc/<id>/` (not a discovery path) | `SessionStart`, `UserPromptSubmit`, `PostToolUse`×2, `Stop`, `PreCompact`, `SessionEnd` + `SessionStart` (update) + 2 (knowledge) | **Full, after user `/hooks` trust** | Windows: `commandWindows` override supplied; `additionalContextLimit` 1400 set by repo; hooks need hash-based trust review |
| 3 | **gemini** | relative symlink → `.gemini/rsc/<id>/` | `SessionStart`, `BeforeAgent`, `AfterTool`×2, `AfterAgent`, `PreCompress`, `SessionEnd` + update + knowledge | **Full** | stdout must be a single JSON object; `BeforeTool` (the blocking tool event) unused by this repo; vendor EOL banner: replaced by Antigravity CLI 2026-06-18 for unpaid tiers |
| 4 | **cursor** | **converted single `.mdc`**, `SKILL.md` only | `sessionStart`, `beforeSubmitPrompt`, `afterFileEdit`, `afterShellExecution`, `afterAgentResponse`, `preCompact`, `sessionEnd` | **Partial** | `sessionStart`/`sessionEnd` fire-and-forget → memory mode is `assisted` + an always-apply rule compensates; `beforeSubmitPrompt` can block but cannot inject; `preCompact` cannot block; **cloud agents get no `sessionStart`**; references/scripts not delivered |
| 5 | **opencode** | relative symlink → `.opencode/rsc/<id>/` | plugin: `context` hook, `session.idle` / `session.execution.succeeded\|failed` | **Partial** — no pre-prompt rejection API | Two plugin APIs (V1/V2) must both be supported in one file; `RSC_OPENCODE_MAJOR`; README flags OpenCode 2 as less tested |
| 6 | **deepseek** | relative symlink → `.dsh/skills/<id>/` (**native path, rank 100**) | 5 bridged events; repo wires `SessionStart`, `UserPromptSubmit`, `PostToolUse`×2, `Stop` | **Partial** | **Requires a per-machine step** (`$DSH_HOME/cordis.patch.yml`), never removed on uninstall; `SessionStart` detached, can miss the first request; `PreToolUse` context ignored; `PreCompact`/`SessionEnd` silently dropped; discovery is one level deep and needs `.git` |
| 7 | **copilot** | relative symlink → `.github/rsc/<id>/` | **none wired** | **None (vendor has hooks:** `.github/hooks/*.json`, 14 events, `preToolUse` deny, fail-closed on non-zero**)** | `mode: agent` in prompt files is stale; config-file `userPromptSubmitted` output is dropped by the vendor; vendor also reads `.claude/settings.json` hooks |
| 8 | **windsurf** | relative symlink → `.windsurf/rsc/<id>/` | **none wired** | **None (vendor has hooks:** Devin Local `.devin/hooks.v1.json`, 8 events; legacy Cascade `.windsurf/hooks.json`**)** | Product renamed to Devin Desktop; `.windsurf/*` paths legacy-imported; workflows Cascade-only; legacy hooks page only via Wayback |
| 9 | **cline** | relative symlink → `.clinerules/rsc/<id>/` | **none wired** | **None (vendor has in-process TS plugins:** `beforeTool` can skip/block, `beforeRun` can `appendContext`**)** | `.clinerules/workflows/` is stale; **skills land *inside* the rules directory** — recursion behaviour unverified |
| 10 | **roo** | relative symlink → `.roo/rsc/<id>/` | **none wired** | **None (no mechanism)** | **Product shut down 2026-05-15, repo archived** |
| 11 | **continue** | relative symlink → `.continue/rsc/<id>/` | **none wired** | **None (undocumented CLI hooks exist per vendor issue #11115)** | CLI only; no IDE-extension hooks; docs do not mention AGENTS.md |
| 12 | **junie** | relative symlink → `.junie/rsc/<id>/` | **none wired** | **None (vendor has CLI hooks, EAP; project-local hooks ignored by default)** | `.junie/guidelines.md` is legacy — current order is `.junie/AGENTS.md` → root `AGENTS.md` + `playbook.md` + `rules/*.md` → `guidelines.md` |
| 13 | **kiro** | relative symlink → `.kiro/rsc/<id>/` | **none wired** | **None (vendor has both agent-lifecycle and file-event hooks:** `.kiro/hooks/*.json`**)** | CLI Prompt Submit hooks cannot block (IDE only); `.kiro/skills/` is the documented skill path, not `.kiro/rsc/` |
| 14 | **antigravity** | relative symlink → `.antigravity/rsc/<id>/` | **none wired** | **None (vendor has hooks:** `.agents/hooks.json`, 6 events, rich `PreToolUse` decisions**)** | **`.antigravity/AGENTS.md` is not a documented path**; vendor has **no user-prompt event** (`PreInvocation` is nearest); `.agents/rules/*.md` needs a `trigger:` key or is silently discarded |
| 15 | **amp** | relative symlink → `.amp/rsc/<id>/` | **none wired** | **None (vendor has event-driven TS plugins:** `tool.call` can reject/modify, `agent.start` can append hidden instructions**)** | shares root `AGENTS.md`; no `session.end` event; Toolbox no longer in current docs |
| 16 | **zed** | relative symlink → `.zed/rsc/<id>/` | **none wired** | **None (no mechanism)** | **`AGENTS.md` is 7th in a first-match chain** — `.rules`, `.cursorrules`, `.windsurfrules`, `.clinerules`, `.github/copilot-instructions.md`, `AGENT.md` all win first. Wiring `copilot` in the same project disables the Zed block. |
| 17 | **jules** | relative symlink → `.jules/rsc/<id>/` | **none wired** | **None (no local execution surface at all)** | Cloud/async; short-lived Ubuntu VM; only extension point is a setup script or env snapshot |
| 18 | **aider** | relative symlink → `.aider/rsc/<id>/` | **none wired** | **None (no mechanism)** | **`CONVENTIONS.md` is not auto-read** — needs `/read`, `--read` or `read:` in `.aider.conf.yml`. Without that, the harness delivers nothing. |

Platform caveat common to all symlink rows: on `win32`, `targets/index.js:23-24` always writes a real
recursive copy, so each wired assistant holds its own full copy of every installed skill. The
`catch` fallback at lines 28-29 means the same happens on any filesystem where `symlinkSync` fails.

---

## 9. Implications for sections 4 and 6

### Where a code-enforced governance guarantee is genuinely achievable

**Today, with the wiring that already exists: 3 assistants fully, 3 partially, 12 not at all.**

- **Full (inject + deny, documented, already wired):** `claude`, `codex` (gated on the user accepting
  `/hooks` trust), `gemini` (JSON-only stdout; its blocking `BeforeTool` event is documented but
  unused here).
- **Partial:** `cursor` (can deny a prompt via `beforeSubmitPrompt`, cannot inject through it;
  `sessionStart` injects but is fire-and-forget and absent in cloud agents), `opencode` (can block
  tool calls, has no prompt-rejection API), `deepseek` (can block `PreToolUse` only, needs a
  per-machine mount, loses 2 of the events this repo wires).
- **Zero today:** the remaining 12.

**Reachable, if a plan chose to extend the wiring** (vendor-documented, not invented): `copilot`
(`.github/hooks/*.json`, 14 events, fail-closed deny), `kiro` (`.kiro/hooks/*.json`, agent-lifecycle),
`antigravity` (`.agents/hooks.json`), `windsurf`/Devin Local (`.devin/hooks.v1.json`), `cline`
(in-process TS plugins), `amp` (in-process TS plugins), `junie` (CLI hooks — but project-local hooks
are ignored by default, so it needs a user action), `continue` (CLI hooks, undocumented). **That is a
theoretical ceiling of 14 of 18** — and REQUIREMENTS §4's instruction not to assume one mechanism
covers all providers is vindicated: those 8 extensions would be **8 different mechanisms**, three of
them in-process JavaScript rather than a command, two of them requiring the user to opt in.

**Permanently out of reach — no vendor hook mechanism exists:** `zed`, `jules`, `aider`, `roo`
(the last also being a discontinued product). For these four, governance is **necessarily
instruction-text only**, and for two of them even the instruction channel is unreliable: Zed's
`AGENTS.md` loses a first-match race against five other filenames (one of which rsc itself writes),
and Aider does not read `CONVENTIONS.md` without explicit configuration.

### Where the contract is necessarily model-dependent

1. **Everything on the 12 unwired assistants** — by construction, the only channel is the injected
   markdown block, and §6's own warning applies in full.
2. **Automatic skill selection everywhere.** The repo's own floor for its lexical ranker is
   **rank-1 44% / top-5 70%** (`scripts/routing-audit.js:11-17`), and `suggest`'s body states the
   ranker "is a **lexical** hint only" whose silence "never means 'no skill exists'". Which skill
   fires is a model decision on every one of the 18 assistants, including Claude Code.
3. **Reading a customisation once discovered.** No event in any vendor's documentation fires "the
   model is about to apply skill X". A hook can inject a *rule* that says "read
   `02-DOCS/wiki/skills/<id>/README.md` before applying skill `<id>`", but the read itself is the
   model's act. On Claude Code a `PreToolUse` guard could in principle *deny* an edit when no
   customisation was read — but nothing in the hook payload identifies which skill is active, so
   that check cannot be written against the current event contract.
4. **Automatic selection on 15 md-family targets is not even model-dependent — it is absent.**
   Nothing tells those assistants where `<dot-dir>/rsc/<id>/` is. This is a prerequisite failure that
   sits *underneath* the model-dependence question: a governance instruction inside a skill body is
   unreachable if the skill body is never found.
5. **Reference-from-another-skill on Cursor is structurally absent.** 246 skills ship `references/`;
   Cursor receives none of them.
6. **Every code-enforced guard is disarmable by a committed `.rsc.json` key**
   (`targets/opt-outs.js:19-35`), and the disarm travels to every clone. A "guaranteed by code" claim
   must be qualified as "guaranteed unless the project opted out".

### The honest ceiling of uniformity across the supported assistants

- **Uniformity of the delivered text: achievable.** One markers-delimited block, regenerated
  idempotently, already lands on 17 of 18 (cursor's file is owned outright rather than marked). This
  is the only genuinely uniform surface.
- **Uniformity of the budget: constrained.** 6,620–7,280 bytes already, against a repo-enforced
  8,000-byte ceiling. **~720 bytes of headroom**, and three test invariants on wording.
- **Uniformity of *discovery*: not achievable at the current roots.** 2 of 18 land on a
  vendor-documented skill path. The `.agents/skills/` convention would fix this for at least 6 more,
  but that is a change, not a current property.
- **Uniformity of *enforcement*: not achievable, and the distribution is lopsided.** 3 full + 3
  partial today; a 14-of-18 theoretical ceiling requiring 8 additional, mutually incompatible
  mechanisms; 4 assistants where it is impossible in principle.
- **Uniformity of *behaviour*: not measurable by this audit.** The repo has the apparatus
  (274 `evals/cases.yaml`, `scripts/routing-audit.js`, `scripts/skill-behavior-eval.js`), and
  REQUIREMENTS §6's three-way split (code guarantees / model-dependent rules / eval-verified
  behaviours) maps onto exactly those three layers.

**Three facts an independent reviewer should check first, because the rest follows from them:**
`targets/index.js:39-63` (18 rows, 3 adapters, 2 native paths), `targets/memory.js:94-118` plus
`targets/knowledge-wiring.js:27-33` (the real non-Claude events — this is the finding most likely to
be missed), and `scripts/lib/manifest-file.js:18` (no docs-root key, which with the env-var and
flag sweeps settles §4).

---

## 10. Contradictions and corrections against REQUIREMENTS §3's prior findings

| §3 prior finding | verdict | evidence |
|---|---|---|
| "El catálogo tenía 274 skills" | **Confirmed** | 274 `skills/*/SKILL.md`, all with `origin: risco`. Note `scripts/doctor.js:160` says "all 272 of them" — a **stale internal comment**. |
| "Los originales se distribuían desde `skills/<id>/`" | **Confirmed** | `README.md:629`: "`skills/<name>/` is the single source of truth" |
| "El instalador copiaba contenido a `.rsc/skills/<id>/`" | **Confirmed** | `targets/index.js:11-13` `baseDir()` |
| "Los asistentes recibían enlaces, copias o instrucciones adaptadas" | **Confirmed, and precisely:** relative symlink (16), real copy on Windows/fallback (all), converted `.mdc` (1), native path (2) | `targets/index.js:20-33`, `targets/cursor.js:4-9` |
| "`.rsc.json` registraba selección y versión del catálogo" | **Confirmed** | `scripts/lib/manifest-file.js:18` — `skills`, `targets`, `catalogVersion`, plus 9 more keys |
| "`sync` podía regenerar contenido y enlaces administrados" | **Confirmed** | `scripts/install-apply.js` + `scripts/lib/repair.js:147,156` |
| "Las personalizaciones se esperaban en `02-DOCS/`" | **Confirmed, but non-uniformly** | 96 of 274 skills mention it; 178 do not |
| "Skills como `suggest`, `ftd` y `sdd` participaban en el funcionamiento interno" | **Confirmed** | `DEFAULT_SKILL_FLOOR` = `['orient','suggest','unslop','ftd','connect-tool','design','ux','tidy']` (`scripts/lib/default-skill-floor.js:29`); `suggest`'s body **is** the injected block |
| "Flutter consultaba `02-DOCS/wiki/stack/flutter.md`, pero la convención no era uniforme" | **Confirmed and quantified** | `skills/flutter/SKILL.md:392-399`. Only **24 of 274** follow the `wiki/stack/<own-id>.md` pattern; 5 more point at a different `stack/` file; the remainder use ~18 inconsistent topic folders, some case-inconsistent |
| "El actualizador apuntaba a `@ericrisco/rsc`" | **Confirmed** | `package.json:2`; `targets/update-wiring.js`; the `suggest` body names `npx @ericrisco/rsc` in 6 places |
| "Comprueba si la raíz de documentación es configurable" | **Answered: NO** | §4 above |
| LEDGER F7: "`02-DOCS` aparece en **316 archivos**… no existe ninguna clave `docsRoot`…" | **Confirmed and extended** | 316 files; **536 occurrences in 81 code files**; also no env var, no CLI flag, no manifest key, no folder detection, and no `03-` tier |

### Things that contradict or materially extend the prior picture

1. **18 assistants, not 19.** `SPEC` and `TARGETS` both have exactly 18 entries at this commit.
2. **Non-Claude hooks are real and already wired.** The brief's framing suggests hooks live only in
   `targets/*.mjs` wired by `targets/claude.js`. In fact `targets/memory.js`,
   `targets/knowledge-wiring.js` and `targets/update-wiring.js` wire **vendor-documented events on
   codex, cursor, gemini, opencode and deepseek**. Anyone auditing only `claude.js` would conclude,
   wrongly, that code enforcement is a Claude-Code-only possibility.
3. **No invented hook events.** Every event name this repo uses is in its vendor's documentation.
4. **But four `SPEC` instruction paths are wrong or stale against vendor docs:** `aider`
   (`CONVENTIONS.md` not auto-read), `antigravity` (`.antigravity/AGENTS.md` undocumented), `junie`
   (`guidelines.md` is legacy), `copilot` prompt files (`mode: agent` stale). Plus `roo` is a dead
   product and `windsurf`/`gemini` carry vendor EOL/rename notices.
5. **Customisations under `02-DOCS/wiki/` are auto-committed and auto-pushed to a dedicated
   `rsc/knowledge` branch by a hook**, on by default, on 6 assistants
   (`targets/knowledge-sync.mjs:2-11,47-53`). §5's "se versionan en Git" is true but the *mechanism*
   is not ordinary developer-initiated git.
6. **`02-DOCS/wiki/skills/` does not exist anywhere in the repo** (0 hits) — §5's standard path is
   greenfield, which is good for the transition but means nothing can be reused.
7. **`.rsc.json` `ownSkills` has never been populated in any project** by the repo's own admission
   (`scripts/doctor.js:161-164`); user-skill preservation rests on the per-target state file and on
   `origin: risco` frontmatter instead.
8. **The always-on body's size ceiling is already 91% consumed** (7,280 of 8,000 bytes,
   `tests/always-on-body.test.js:16`).
