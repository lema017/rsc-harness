# Audit Track A — Catalogue and skill anatomy

**Scope:** Stage 0 pre-plan audit of `ericrisco/rsc-harness`, per `docs/fork/REQUIREMENTS.md` §3 (mandatory
audit), §5 (per-project customisation), §6 (governance contract), §11 (validation).

**Subject under audit**
- Working clone: `/Users/home/Development/rsc-harness-fork`
- Commit: `6f7edd31d109b7f0211d637e2d084724f6dd8e26` — verified with
  `git rev-parse HEAD` → `6f7edd3`; `git log --oneline -1` → `🔖 chore(release): 3.7.1 [skip ci]`
- `package.json` `version` = `3.7.1`, `name` = `@ericrisco/rsc`
- Working tree clean except the untracked `docs/fork/` added for this audit.

**Method.** Read-only. Only `cat`/`sed -n`/`find`/`grep`/`wc`/`du`/`git log`/`git check-ignore`, plus Node
one-liners and sandboxed Node scripts that **read** files and compute counts. **No repository code was
executed** — `npm run validate`, `npm test`, `scripts/eval-lint.sh`, `drift-check`, `originality-check` were
read, not run. Every claim about what those gates *do* is therefore a reading of their source, and is labelled
as such. Numbers below come from independent traversal of the file tree, not from the repo's own reports.

Throughout, each section separates **(a) verified facts**, **(b) inferences**, **(c) open questions**.

---

## 0. Headline numbers

| Measure | Value |
|---|---|
| Skill directories in `skills/` | **274** |
| Directories containing `SKILL.md` | **274** (1:1) |
| Total files under `skills/` | **1 679** |
| Total bytes under `skills/` | **12 111 726** (11.55 MiB) |
| `manifest.json` | 242 309 bytes, committed, `counts.skills = 274` |
| Skills with `evals/` | 274 (100%) |
| Skills with `references/` | 246 (89.8%) |
| Skills with `scripts/` | 190 (69.3%) |
| Skills referencing `02-DOCS/` anywhere | **98 (35.8%)** — 176 reference it nowhere |
| Skills referencing `02-DOCS/wiki/skills/<id>/README.md` (the §5 target) | **0** |
| Cross-skill `../<id>/SKILL.md` references | **1 905 resolving**, 2 non-resolving (both deliberate placeholders) |
| Repository licence | MIT, © 2026 Eric Risco |
| Third-party components inside `skills/` | 4 (3× MIT, 1× Apache-2.0) |
| **BLOCKER** | **None** (see §8) |

---

## 1. Inventory

### (a) Verified facts

**Count = 274.** Three independent measurements agree.

```
$ cd /Users/home/Development/rsc-harness-fork
$ find skills -maxdepth 1 -mindepth 1 -type d | wc -l
     274
$ find skills -maxdepth 2 -name SKILL.md | wc -l
     274
$ find skills -maxdepth 1 -mindepth 1 ! -type d        # non-directory entries directly under skills/
(no output)
```

`manifest.json` agrees: `counts.skills = 274`, and its `skills[].id` array is byte-identical to
`readdirSync('skills').sort()` (verified by set comparison in a sandboxed Node script). So the §3 prior finding
of "274 skills" is **correct at this commit**. It is nevertheless a measured number, not a constant: the
catalogue has been 264, 278 and 281 at other points — see the comment in `tests/catalog-counts.test.js:44-48`,
which records that published docs said 264 while the catalogue held 278 "through fourteen releases".

**Naming convention.** Every id is lowercase kebab-case:

```
$ find skills -maxdepth 1 -mindepth 1 -type d -exec basename {} \; | grep -Ev '^[a-z0-9]+(-[a-z0-9]+)*$'
(none)
```

This matches `schema/frontmatter.schema.json`'s `name` pattern `^[a-z0-9-]+$`. Additionally, **`name` in the
frontmatter equals the directory name for all 274 skills** (0 mismatches, measured by parsing every
`SKILL.md`). `scripts/skill-rubric.md` ("Deterministic gates", item 1) states this as a ship gate:
"`name` matches the directory id; `origin: risco` present."

**`skills/<id>/` is the distribution source.** Verified on three independent paths:

1. `package.json` `files: ["scripts","targets","schema","skills","manifest.json","!**/__pycache__/**","!**/*.pyc"]`
   — `skills/` ships in the npm tarball.
2. `scripts/build-manifest.js:13-21` (`skillDirs()`) enumerates `join(ROOT,'skills')` and accepts a directory
   only if `skills/<d>/SKILL.md` is a file. The manifest is therefore derived *from* `skills/`.
3. `scripts/install-apply.js:19-29` (`ensureBase`) copies the catalogue into the consumer project:
   `cpSync(join(ROOT,'skills',id), dest, {recursive:true})` where `dest = baseDir(id,cwd)`. The comment at
   `scripts/install-apply.js:14-18` states the contract verbatim: *"Skills are read-only catalog (user
   customization lives in 02-DOCS), so overwriting on a version change is safe."* `.rsc/.version` records the
   CLI version the bases were copied at (`scripts/install-apply.js:34`), and a version change triggers
   `rmSync` + re-copy.
4. Per-target skill entries are then symlinked or copied from that base —
   `targets/_md-block.js:23-25` `writeSkill(id,fromDir,toPath) → linkOrCopy(...)`;
   `scripts/install-apply.js:412` comments "`.rsc/` is machine state. The per-target skill entries are derived:
   symlinks here, [copies elsewhere]".

### (b) Inferences

- Because `ensureBase` **deletes and re-copies** `.rsc/skills/<id>/` whenever the recorded base version differs
  from the CLI version, anything a build/install-time transformation writes into `.rsc/skills/<id>/` is
  reproducible but **not durable across a version bump** — it must be re-derived on each install. This is
  consistent with (and arguably supportive of) a generated-transformation strategy, and incompatible with
  storing per-project state there.
- The 1:1 directory↔`SKILL.md` relationship plus the `name == dirname` invariant means the catalogue has a
  single, stable primary key. A transformation can key on the directory name without ambiguity.

### (c) Open questions

- None material for inventory.

---

## 2. Anatomy of a skill

### (a) Verified facts

Measured by full traversal of `skills/**` in a sandboxed Node script (`fs.readdirSync` recursive +
`fs.statSync`).

**Top-level files** (count = number of skills that have the file):

| Count | File |
|---|---|
| 274 | `SKILL.md` |
| 2 | `THIRD_PARTY.md` (`design`, `ux`) |
| 1 | `IMPECCABLE-LICENSE.txt` (`design`) |

There is **no other top-level file anywhere in the catalogue**. In particular there is **no `README.md`,
no `LICENSE`, no `NOTICE`, no metadata sidecar** at skill root.

**Top-level subdirectories** (count = number of skills that have it):

| Count | Subdir | Notes |
|---|---|---|
| 274 | `evals/` | universal |
| 246 | `references/` | 89.8% |
| 190 | `scripts/` | 69.3% |
| 2 | `assets/` | `harness`, `scroll-film` |
| 1 | `engine/` | `design` (third-party, see §8) |
| 1 | `upstream/` | `ux` (third-party, see §8) |
| 1 | `examples/` | `harness` |
| 1 | `tools/` | `roast-me` |
| 1 | `prompts/` | `roast-me` |

**File-type census** (1 679 files):

```
1161  .md     275  .yaml    190  .sh     14  .json     9  .mjs
   8  .py       7  (no ext)   5  .js      5  .html     3  .css
   1  .txt      1  .example
```

**`evals/` contents** (`find skills -path '*/evals/*' -type f | sed 's|.*/evals/||' | sort | uniq -c`):

```
274  cases.yaml
269  README.md
  1  routing.json
```

Every skill has `evals/cases.yaml`; 269 of 274 also have `evals/README.md`.

**Executables.** 194 files carry an exec bit. 189 are `scripts/verify.sh`. The other 5:

```
harness/assets/_TEMPLATE/test_connection.sh
implement/scripts/review-package
implement/scripts/sdd-workspace
implement/scripts/task-brief
marketing/scripts/seo_audit.py
```

(190 skills have a `scripts/` directory but only 189 ship `scripts/verify.sh`.)

**Size distribution** (bytes per skill directory, all files):

| | value |
|---|---|
| mean | 44 203 |
| median | 31 130 |
| min | 6 987 |
| p90 | 42 376 |
| max | 2 435 675 (`design`) |

`SKILL.md` alone: mean 12 774, median 12 504, min 4 602, max 30 307.
Frontmatter block alone: mean 611, median 591, min 428, max 898, **total 167 403**.
`SKILL.md` body (minus frontmatter): mean 12 163, median 11 883, min 4 174, max 29 576, **total 3 332 568**.

**File-count distribution** (no skill has only `SKILL.md`):

```
2 files: 2   3: 24   4: 19   5: 37   6: 130   7: 39   8: 13
9: 4    10: 2   13: 1   29: 1   42: 1   45: 1
```

The modal skill is **6 files**: `SKILL.md`, `evals/cases.yaml`, `evals/README.md`, 2× `references/*.md`,
`scripts/verify.sh`.

`references/` file count where present: mean 2.3, median 2, min 1, max 20, total 568 files.

**Largest / most complex skills:**

| Bytes | Files | `SKILL.md` | Id | Subdirs |
|---|---|---|---|---|
| 2 435 675 | 45 | 6 185 | `design` | evals, references, **engine** |
| 526 398 | 42 | 9 541 | `ux` | evals, references, **upstream** |
| 296 379 | 29 | 25 368 | `harness` | evals, references, examples, assets |
| 113 951 | 9 | 19 908 | `building-agents` | evals, references, scripts |
| 100 796 | 9 | 21 063 | `presentations` | evals, references, scripts |
| 97 142 | 10 | 20 702 | `nextjs` | evals, references, scripts |
| 96 586 | 10 | 15 608 | `marketing` | evals, references, scripts |
| 87 940 | 9 | 17 527 | `flutter` | evals, references, scripts |
| 87 596 | 8 | 17 936 | `secure-coding` | evals, references, scripts |
| 85 154 | 8 | 17 670 | `postgresdb` | evals, references, scripts |

`design` is an outlier: **20.1% of the whole catalogue's bytes**, almost all of it in `engine/`
(2 406 711 bytes of vendored third-party engine). `design`, `ux` and `harness` together are 3 258 452 bytes
(26.9%); the remaining 271 skills average 32 669 bytes.

**Bytes by area across the catalogue:**

```
(skill root, i.e. SKILL.md + 3 licence/attribution files)  3 514 098
references/                                                3 154 326
engine/ (design only)                                      2 406 711
evals/                                                     1 412 386
scripts/                                                   1 029 240
upstream/ (ux only)                                          505 213
tools/ 43 294 · assets/ 23 459 · prompts/ 18 357 · examples/ 4 642
```

**Body shape is uniform.** For all 274 skills, the first non-blank line after the frontmatter is an `# H1`
heading (measured). All 274 have **balanced** column-0 code fences (2 944 delimiters total, mean 11, max 36,
zero odd counts) — i.e. `scripts/lib/skill-lint.js`'s `fenceBalance` would pass the whole catalogue.

### (b) Inferences

- The anatomy is **highly regular**: `SKILL.md` + `evals/cases.yaml` are universal; `references/` and
  `scripts/verify.sh` are near-universal; everything else is 1–2 bespoke skills. A transformation that assumes
  only *"there is exactly one `SKILL.md` at skill root, whose body starts with an H1"* holds for 100% of the
  catalogue today.
- The three outliers (`design/engine/`, `ux/upstream/`, `harness/assets/`+`examples/`) are where generic
  rewriting is most likely to do damage, and two of them are third-party (§8).
- `references/` is 26% of catalogue bytes and is loaded **on demand**, not always-on; `evals/` (11.7%) is
  never loaded into an agent's context at all (it is test data). The context-relevant mass is `SKILL.md`
  bodies (3.33 MB across the catalogue) plus whatever `references/` a turn actually opens.

### (c) Open questions

- `skills/*/evals/README.md` exists for 269 of 274 skills. Which 5 lack it, and whether that matters to
  `eval-lint.sh`, was not determined (reading `scripts/eval-lint.sh` suggests it gates on `cases.yaml` only,
  but the script was not run).
- `roast-me/{tools,prompts}/` and `harness/{examples,assets}/` were not read in detail; their internal
  reference conventions are unknown.

---

## 3. Frontmatter contract

### (a) Verified facts

**`schema/frontmatter.schema.json`** (complete, 522 bytes):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["name", "description", "tags"],
  "properties": {
    "name": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "description": { "type": "string", "minLength": 10, "maxLength": 1024 },
    "tags": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "recommends": { "type": "array", "items": { "type": "string" } },
    "profiles": { "type": "array", "items": { "enum": ["minimal","core","full"] } }
  }
}
```

**Required:** `name`, `description`, `tags`. **Optional, constrained:** `recommends`, `profiles`.
**Critically: there is no `"additionalProperties": false`.** Any unlisted key passes validation.

**Proof that unlisted keys already ship.** All 274 skills carry a key that is *not* in the schema:

```
$ grep -h '^origin:' skills/*/SKILL.md | sort | uniq -c
 274 origin: risco
```

Frontmatter key census across all 274 `SKILL.md` (parsed, not grepped):

| Count | Key | In schema? |
|---|---|---|
| 274 | `name` | yes (required) |
| 274 | `description` | yes (required) |
| 274 | `tags` | yes (required) |
| 274 | `recommends` | yes (optional) |
| 274 | `origin` | **no — unvalidated passenger** |
| 73 | `profiles` | yes (optional) |

**How validation runs.** `scripts/build-manifest.js:78-89` (`validateFrontmatter`) compiles the schema with
Ajv (`allErrors: true`), parses each `SKILL.md` with `parseFrontmatter`, and collects `${id}: ${errorsText}`.
`main()` at line 124-137 runs it under `--validate` and `process.exit(1)` on any error. Entry points:
`package.json` → `"validate": "node scripts/build-manifest.js --validate"`, wired into
`prepublishOnly` and into CI (`.github/workflows/ci.yml`, step "validate frontmatter").

**The parser is not a YAML parser.** `scripts/lib/frontmatter.js` (47 lines, complete) is a hand-rolled
line scanner:
- line 2: frontmatter is `/^---\n([\s\S]*?)\n---/` — must be the **first** bytes of the file;
- line 8: a key line must match `/^([A-Za-z_][\w-]*):\s*(.*)$/` — anything else is **silently skipped**
  (`if (!kv) continue;`);
- lines 12-27: an empty value followed by `^\s+-\s*(.*)$` lines becomes a list;
- lines 33-40: `[a, b, c]` inline flow sequences are split on `,`;
- lines 42-47: one layer of surrounding `"` or `'` is stripped.

There is **no** support for block scalars (`|`, `>`), nested maps, multi-line quoted strings, anchors, or
escapes. A `description` containing an unescaped `"` or a newline would be mangled or truncated rather than
rejected. `tests/frontmatter.test.js` covers exactly three cases: inline arrays, block arrays, and "missing
frontmatter throws".

**Body validation is one check only.** `scripts/lib/skill-lint.js` (29 lines) exports `fenceBalance(body)`,
which counts column-0 ```` ``` ````/`~~~` delimiters and reports whether they pair. `validateBodies()`
(`build-manifest.js:94-103`) runs it over every skill and fails the build on an unbalanced fence. Its own
comment states the scope deliberately: *"Scope is deliberately one defect class."* Nothing else about the body
is machine-checked by `--validate`.

**Description length.** Hard limit 1 024 (schema). Soft ceiling 350 —
`build-manifest.js:109` `export const DESCRIPTION_CEILING_CHARS = 350`, reported but not enforced; the comment
at lines 105-108 explains why: *"turning 257 skills red the day the rubric changed would help nobody."*
`tests/catalog-diet.test.js` asserts only that nothing exceeds **1 024**, and that the advisory ceiling sits
below the hard limit.

Measured description lengths (from `manifest.json`, which copies them verbatim):

| | chars |
|---|---|
| total | 107 299 |
| mean | 392 |
| median | 351 |
| min | 231 |
| **max** | **659** |
| over 350 (soft ceiling) | **139 of 274** |
| over 1 024 (hard limit) | 0 |

**Worst-case headroom in `description` is therefore 1 024 − 659 = 365 characters** for the single heaviest
skill, and 1 024 − 392 = 632 characters on average.

**Other deterministic gates that touch frontmatter**, from `scripts/skill-rubric.md`
("Deterministic gates (pass/fail — not part of the 0–10, but block shipping)"):

1. `name` matches the directory id; `origin: risco` present.
2. Frontmatter validates against the schema.
3. Every `recommends` id is a real catalog skill.
4. `scripts/eval-lint.sh` PASS.
5. Every `../<sibling>/SKILL.md` link resolves.
6. `description` ≤ 1 024 chars and parses as YAML.
7. `scripts/verify.sh`, if present, is executable, read-only by default, and exits 0 on a clean target.

Note on gate 3: `build-manifest.js:33` does **not** fail on a dangling `recommends` — it *filters silently*:
`recommends: (fm.recommends || []).filter((r) => known.has(r))`. So a dangling id disappears from
`manifest.json` without any error. The rubric's claim that `--validate` "enforces" it is not borne out by the
code I read.

### (b) Inferences

- **A governance-metadata field in frontmatter is free.** Because the schema has no
  `additionalProperties: false`, and because `origin` already proves unlisted keys survive validation and are
  simply ignored by `build-manifest.js` (which reads only `description`, `tags`, `recommends`, `profiles`),
  a key such as `governance: v1` (or a version/hash) can be added to all 274 skills without touching the
  schema, the parser, `manifest.json`'s shape, or any current test. This is the single lowest-friction
  metadata channel in the repo.
- **`description` is a poor carrier for a governance preamble.** It is the one string in context on *every*
  turn for every installed skill (`build-manifest.js:105-107` says so explicitly, and `contextBudget` counts
  it as `descriptionsBytes`). A uniform preamble of even 120 chars × 274 = +32 KB of catalogue description
  weight, would push an unknown number of the 139 already-over-ceiling skills further out, and would risk the
  1 024 hard limit for the heaviest ones. It also degrades exactly what dimension 1 of the rubric grades
  ("discriminative power, not coverage").
- **A preamble in the body is schema-safe but lint-sensitive.** The only body gate is fence balance, so
  injecting prose is safe *provided* the injected text does not contain an odd number of column-0 fence
  delimiters. Since every body currently starts with `# H1`, a preamble can be inserted either before or
  immediately after that H1 deterministically.
- The hand-rolled parser means any transformation must **not** reformat the frontmatter into real YAML
  (block scalars, nested keys, multi-line values would be silently dropped or mis-parsed). Frontmatter edits
  must stay within the parser's dialect: `key: scalar`, `key: [a, b]`, or `key:` + indented `- item` lines.

### (c) Open questions

- Whether any *consumer* (Claude Code, Cursor, Codex, Gemini, …) imposes its own frontmatter constraints
  stricter than this schema — e.g. an upstream assistant limit on `description` length, or rejection of
  unknown keys. That is Track-B/assistant-capability territory; nothing in this repo answers it, and it is a
  real risk for a new frontmatter key.
- Why `origin` exists and whether anything consumes it. A grep of `scripts/lib/*.js`,
  `scripts/build-manifest.js`, `scripts/drift-check.js`, `schema/*.json` and `tests/frontmatter.test.js`
  found **no reader** — only the rubric's prose gate. It appears to be a provenance marker enforced by human
  review, not by code.

---

## 4. `manifest.json`

### (a) Verified facts

**What it is.** A committed, generated **public inventory** of the catalogue: 242 309 bytes at repo root,
tracked in git (`git log` shows it is touched by the release flow). It is **not** a per-project file —
that is `.rsc.json` (see below).

Top-level keys and exact shape (parsed):

```
version         "3.7.1"                 (copied from package.json)
counts          {skills:274, agents:34, commands:53, fixedCommands:20}
skills[274]     {id, description, tags, recommends, profiles}
agents[34]      {id, description, role, tier, tools, skills}
commands[53]    {id, description, kind, backing}
sourceReceipts  array of 3 research receipts (agent, researchedAt, sources[])
```

The per-skill key set is **exactly** `["id","description","tags","recommends","profiles"]` — verified by
unioning `Object.keys()` over all 274 entries.

**No content hashes, no checksums, no sizes, no file lists.** Verified by substring search over the raw file:

```
sha256      : false
sha1        : false
checksum    : false
"hash"      : false
integrity   : false
```

(The word `bytes` does appear — inside prose descriptions, not as a key.)

**How it is generated.** `scripts/build-manifest.js`:
- `skillDirs()` (lines 13-21) enumerates `skills/` and requires `SKILL.md`;
- `buildManifest()` (23-76) reads `package.json` `version`, parses each `SKILL.md`'s frontmatter, projects
  `{id, description, tags, recommends(filtered), profiles}`, sorts by `id` with `localeCompare`, then appends
  agents (from `targets/agents.js`), commands (resolved through the `cursor` target —
  comment at lines 48-50 explains that Cursor exposes every command kind, so it yields the target-neutral
  inventory), and `sourceReceipts` read verbatim from `targets/agent-sources.json`;
- `main()` writes `JSON.stringify(manifest, null, 2) + '\n'`.

**It is gated for staleness.** `--check` (lines 141-146) re-serialises and compares **byte-for-byte** with the
file on disk; mismatch → `console.error('manifest.json is stale — run \`npm run manifest\`')` + `exit 1`.
Wired at:
- `package.json` → `"manifest:check"`, and `"version": "npm run manifest && git add manifest.json"`
  (so `npm version` regenerates and stages it), and `prepublishOnly: npm run manifest && npm run validate && npm run drift:check && npm run originality:check`;
- `.github/workflows/ci.yml` → step "manifest is current" runs `npm run manifest:check` on every push and PR.

**What reads it.** `scripts/lib/manifest.js` (21 lines) — `loadManifest()`, `skillById()`,
`skillsForProfile()`. `scripts/lib/registry.js:47-60` iterates `manifest.skills` to build
`.rsc/skill-registry.json`, and derives a 12-hex-char `hashSkill()` from
`{id, trigger(=description), tags, path, available}` — i.e. **a hash of manifest metadata plus the absolute
path, never of file content** (`registry.js:95-106`).

**`.rsc.json` is a different file.** `scripts/lib/manifest-file.js:15-18`: the per-project committed
**declaration**, keys `['version','targets','skills','agents','ownSkills','catalogVersion','tier','optOuts','memory','gitPermissions','agentModels','onboarding']`.
Its header comment (lines 4-14) states the design: *"It is a DECLARATION, never an inventory: ids and names
only, no paths and no file lists."* `catalogVersion` records the catalogue version, confirming the §3 prior
finding. `readManifest` (lines 20-30) **refuses to treat a corrupt `.rsc.json` as absent** — it throws
`".rsc.json exists but is not readable JSON — fix or delete it; rsc will not overwrite it"`. `writeManifest`
(58-68) guarantees byte-stable output: *"Rewriting an unchanged manifest must produce identical bytes, or
every install shows up as a diff."*

**Profiles distribution** in `manifest.json`: `(none)` 224, `core+full` 22, `minimal+core+full` 10,
`full` 18. Tags: 1 377 distinct across 274 skills. `recommends`: 267 skills carry at least one;
1 353 edges total.

### (b) Inferences

- **`manifest.json` cannot verify that `skills/` is byte-for-byte identical.** It records no hashes, sizes or
  file lists; it projects only five frontmatter-derived fields. A transformation could rewrite every
  `SKILL.md` body and every `references/*.md` and leave `manifest.json` byte-identical, because none of that
  content reaches the manifest. Conversely, touching `description`, `tags`, `recommends` or `profiles` — or
  adding/removing a skill directory — **does** change the manifest and **will** fail
  `npm run manifest:check` in CI unless regenerated.
- Therefore, in strategy-B terms: a body-only transformation needs **no** manifest regeneration; a
  frontmatter-touching transformation needs **deterministic** regeneration (and the regeneration is already
  deterministic — sorted by `localeCompare`, `JSON.stringify(_, null, 2) + '\n'`).
- The byte-exact `--check` comparison means the transformation's manifest output must match
  `build-manifest.js`'s formatting exactly. The safest implementation is to *call* `build-manifest.js` rather
  than to emit JSON independently.
- Byte-for-byte verification of an unmodified `skills/` tree is still available — but from **git**
  (`git diff --stat skills/`) or an independently computed digest, not from `manifest.json`.

### (c) Open questions

- Whether the published npm tarball's `skills/` is ever compared against the repo's (I found no such gate).
  If a fork transforms at *build* time rather than at *install* time, nothing in this repo would detect the
  divergence from upstream — which cuts both ways.

---

## 5. Internal / structural skills

### (a) Verified facts

**The §3 prior finding is confirmed, and is incomplete.** `suggest`, `ftd` and `sdd` all participate in
harness operation, but so do at least a dozen others.

**The declared floor.** `scripts/lib/default-skill-floor.js:29`:

```js
export const DEFAULT_SKILL_FLOOR = Object.freeze(['orient','suggest','unslop','ftd','connect-tool','design','ux','tidy']);
```

with `withDefaultSkillFloor(skillIds)` merging it into any selection. The header comment (lines 1-28) is an
explicit, dated rationale per member:
- `orient` and `suggest` are **runtime always-on**;
- `unslop` installed by default, conditionally loaded (replaced the retired `bro`);
- `ftd` joined in 2.0.1 — *"the always-on decisor routes ordinary work to `../ftd/SKILL.md`, so a harness
  without it has a default lane that points at nothing"*;
- `connect-tool` joined 3.0.13 (issue #303); `design` joined 3.3.0; `ux` joined 3.4.0 (replacing the retired
  `ui-engineering`); `tidy` joined 3.8.0.

**The always-on body is `suggest`'s `SKILL.md`.** Two delivery paths:
- **Claude Code**: `targets/claude.js:138-150` wires a SessionStart hook whose `argv[2]` is the absolute path
  to `suggest`'s `SKILL.md`; `targets/session-start.mjs:51-53` does
  `process.stdout.write(readFileSync(suggestMd,'utf8'))` on every session start (de-duplicated per
  `session_id` via `claimOnce`, `session-start.mjs:25-28`).
- **Everything else (the AGENTS.md / rules-file family)**: `targets/_md-block.js:27-43` injects
  `stripFrontmatter(readFileSync(sourceMd))` — the full `suggest` body — between fixed markers, plus an
  `UPDATE_NOTE`.
- **Exception**: when `policy.codeHooks === false` **and** `policy.laneGate` is false, both paths substitute a
  ~0.3 KB stub (`targets/claude.js:146`, `_md-block.js:30`) reading, verbatim:
  *"Read `02-DOCS/wiki/harness/user-profile.md` before acting. Use `orient` … and `suggest` …"*.
  `scripts/doctor.js:347-362` (`alwaysOnBytesFor`) explains that a prior version of the byte report assumed
  the full `SKILL.md` and so *"said 7.1 KB for a hook that injects 0.3 KB of body (E2E 2026-10-07)"*.

**Structural registration.** `scripts/lib/registry.js` builds `.rsc/skill-registry.json` +
`skill-registry.md` from `manifest.skills` ∩ installed state. It is catalogue-wide and confers no special
status on any skill. It does, however, mean every skill id reaches a generated artefact with a
`trigger` (= `description`) and an absolute `path`.

**Who is named in harness code.** A census of `['"`]<id>['"`]` literals across all `.js`/`.mjs` under
`scripts/` and `targets/` matched **all 274 ids** — but that is an artefact of `scripts/lib/domains.js`, which
lists every skill exactly once (`tests/domains.test.js`: *"every skill on disk belongs to exactly one catalog
domain"*). **Excluding `domains.js`**, the skills named in harness code are:

| Skill | Named in (file(count)) | Structural role (from the code read) |
|---|---|---|
| `harness` | `consult.js(12)`, `audit.js`, `onboarding-apply.js(5)`, `repair.js`, `knowledge-doctor.js`, `tools-skeleton.js`, `doctor.js`, `rsc.js(2)`, `danger-guard.mjs`, `team-safe-start.mjs`, `index.js(2)`, `opt-outs.js`, `session-start.mjs(2)`, `commands.js`, `sello.mjs(3)`, `auto-update.mjs` | owns the `01-TOOLS/`+`02-DOCS/` scaffold; `onboarding-apply.js:485` makes it the scaffolder |
| `suggest` | `consult.js`, `install-apply.js(2)`, `install-plan.js`, `default-skill-floor.js(3)`, `doctor.js(2)`, `rsc.js(2)`, `claude.js(4)`, `userprompt-gate.mjs`, `auto-update.mjs` | **the always-on body itself** |
| `sdd` | `spec-gate.js(2)`, `onboarding.js(5)`, `onboarding-apply.js`, `constitution-draft.js(2)`, `knowledge-doctor.js`, `rsc.js(3)`, `copy-rules.mjs`, `session-memory-core.mjs(3)` | the SDD chain + spec gate |
| `orient` | `onboarding-apply.js`, `retired-skills.js(3)`, `default-skill-floor.js(2)`, `claude.js`, `clone-bootstrap.mjs(3)`, `knowledge-sync.mjs` | runtime always-on (named in the always-on text) |
| `ftd` | `install-apply.js`, `default-skill-floor.js(2)`, `worktree-reaper.mjs`, `copy-rules.mjs` | the default lane; `targets/ftd-nudge.mjs` watches `02-DOCS/wiki/ftd/` |
| `init` | `install-apply.js`, `audit.js`, `onboarding.js`, `onboarding-apply.js(2)`, `claude.js`, `agents.js(2)`, `knowledge-sync.mjs` | onboarding entry point |
| `ship` | `rsc.js`, `worktree-reaper.mjs`, `claude.js`, `session-start.mjs`, `knowledge-sync.mjs(7)`, `commands.js`, `ship-guard.mjs(2)` | backed by the `ship-guard` hook |
| `design` | `audit.js(2)`, `detect-repo.js(3)`, `retired-skills.js(4)`, `default-skill-floor.js(3)`, `design-upstream.js(2)`, `clone-bootstrap.mjs(3)` | floor member + its own upstream watcher |
| `unslop` | `consult.js(11)`, `retired-skills.js(2)`, `default-skill-floor.js(3)`, `clone-bootstrap.mjs` | floor member |
| `ux` | `retired-skills.js(3)`, `default-skill-floor.js(3)`, `clone-bootstrap.mjs` | floor member + hash-pinned upstream |
| `review` | `install-apply.js`, `review-findings.js`, `rsc.js(3)`, `agents.js(5)`, `copy-rules.mjs`, `commands.js(2)` | command + agent backing |
| `constitution` | `onboarding.js`, `onboarding-apply.js(3)`, `constitution-draft.js(5)`, `doctor.js` | writes `02-DOCS/wiki/sdd/constitution.md` (`constitution-draft.js:19`) |
| `backups` | `install-apply.js`, `backups.js`, `doctor.js`, `rsc.js(2)` | backup/restore machinery |
| `worktrees` | `rsc.js(3)`, `worktree-reaper.mjs(2)` | backed by `worktree-reaper.mjs` |
| `connect-tool`, `tidy` | `default-skill-floor.js(2)` each | floor members |
| `specify` | `spec-gate.js`, `lib/spec-gate.js(2)`, `commands.js` | spec gate |
| `verify` | `review-findings.js`, `eval-integrity.js`, `commands.js` | command + eval machinery |
| `knowledge-ops` | `knowledge-doctor.js`, `lib/knowledge-doctor.js`, `commands.js` | knowledge audit |
| `sdd-init` | `rsc.js(2)` | SDD bootstrap |
| `git-workflow` | `claude.js`, `gitmoji-guard.mjs` | backed by `gitmoji-guard` |
| `analyze`, `clarify`, `debug`, `implement`, `plan`, `tasks`, `simplify-code`, `security-scan` | `commands.js` (+ `rsc.js`/workflow scripts) | slash-command backed |
| `deprecation`, `idea-refinement`, `presentations`, `marketing`, `docker`, `sql`, `make`, `nextjs` | `consult.js` (recommender corpus) | named in the recommender |
| `grants` | `skill-scoreboard.workflow.js`, `skill-behavior-eval.workflow.js` | eval fixture |
| 20 stack ids (`cpp`, `csharp-dotnet`, `django`, `fastapi`, `flutter`, `go`, `java`, `kotlin-android`, `laravel`, `machine-learning`, `php`, `postgresdb`, `python`, `rag`, `react`, `rust`, `spring-boot`, `swift-ios`, `typescript`, `vue-nuxt`) | `targets/agent-catalog.js` | **backing skill of a specialist agent** (`manifest.agents[].skills`) |
| ~20 infra ids (`vercel`, `netlify`, `railway`, `render`, `fly-io`, `neon`, `supabase`, `prisma-orm`, `drizzle-orm`, `github-actions`, `db-migrations`, `nodejs`, `solid-js`, `svelte`, `angular`, `astro`, `expo`, `data-cleaning`, `duckdb`, `modal` …) | `scripts/detect-repo.js`, `scripts/audit.js` | named by stack **detection** |

**Definitive list of structurally internal skills.** Grouped by the mechanism that makes them internal, in
descending order of how hard they are to remove or alter:

1. **Always-on body (its text *is* the harness's standing instruction):** `suggest`.
2. **Named inside the always-on text / routed by it:** `orient`, `ftd`, `sdd`, `unslop`.
3. **Default floor (installed on every path regardless of user choice)** —
   `DEFAULT_SKILL_FLOOR`: `orient`, `suggest`, `unslop`, `ftd`, `connect-tool`, `design`, `ux`, `tidy`.
4. **Hook-backed** (a wired hook's behaviour depends on them): `ship` (`ship-guard.mjs`),
   `ftd` (`ftd-nudge.mjs`), `worktrees` (`worktree-reaper.mjs`), `git-workflow` (`gitmoji-guard.mjs`),
   `harness` + `sdd` + `constitution` (`session-start.mjs`, `copy-rules.mjs`, `danger-guard.mjs`,
   `knowledge-sync.mjs`).
5. **Gate-backed** (a deterministic script enforces or consumes them): `specify` + `sdd` (`spec-gate.js`),
   `constitution` (`constitution-draft.js`), `knowledge-ops` (`knowledge-doctor.js`),
   `verify` (`eval-integrity.js`, `review-findings.js`), `design` (`design-upstream.js`),
   `ux` (`tests/ux-upstream.test.js`), `backups` (`lib/backups.js`), `init` + `harness`
   (`onboarding-apply.js`).
6. **Slash-command backed** (`targets/commands.js` resolves 53 command entries; each `kind:"skill"` entry has
   a `backing` skill id): includes `analyze`, `clarify`, `debug`, `implement`, `plan`, `tasks`, `review`,
   `verify`, `ship`, `simplify-code`, `security-scan`, `knowledge-ops`, `specify`.
7. **Agent-backed** (`manifest.agents[].skills`, from `targets/agent-catalog.js`): the ~20 stack ids listed
   above — e.g. `manifest.agents[0]` is `cpp-build-resolver` with `skills: ["cpp"]`.
8. **Recommender corpus** (`scripts/consult.js`): `unslop`, `harness`, `deprecation`, `idea-refinement`,
   `nextjs`, `presentations`, `suggest`, `sql`, `docker`, `make`, `marketing`.

**Minimum set §11 must cover** (the union of tiers 1–5, i.e. everything whose *harness behaviour* breaks if
the skill's text changes), **22 skills**:

```
backups  connect-tool  constitution  design  ftd  git-workflow  harness  init
knowledge-ops  orient  ship  specify  sdd  sdd-init  suggest  tidy  unslop
ux  verify  worktrees            (+ review, plan — command-and-agent backed)
```

### (b) Inferences

- `scripts/lib/domains.js` is the only place that must change when a skill is added, and
  `tests/domains.test.js` makes that a hard gate in both directions (missing *and* dead ids fail). A
  transformation that **adds or removes a skill directory** must therefore also edit `domains.js`,
  `README.md` (per `tests/domains.test.js`: *"README links a folder for every skill in the manifest"*) and
  regenerate `manifest.json`. A transformation that only rewrites existing skills touches none of them.
- The floor is exactly the set a fork cannot ship broken: eight skills are installed whether or not the user
  asks, so a governance preamble that misbehaves in `suggest` or `orient` misbehaves on **every turn of every
  project**. This is the strongest argument for treating the floor as a separate, hand-reviewed tier rather
  than letting a bulk transformation touch it unexamined.
- `suggest` is a special case beyond "internal": its body is pasted verbatim into the session as instructions.
  Any transformation of `suggest/SKILL.md` is a transformation of the harness's standing prompt, not of a
  conditionally-loaded document.

### (c) Open questions

- `targets/commands.js` was not read line-by-line; the exact 53-entry command→skill mapping (and therefore
  the precise tier-6 list) is inferred from `manifest.commands[].backing` plus the greps above. The
  authoritative list is one `resolveCommands()` call away but that would mean executing repo code.
- `scripts/lib/retired-skills.js` (1 720 bytes) names `bro`, `ui-engineering` and others as retired. Whether a
  transformation must also handle retirement aliases was not investigated.

---

## 6. Relative references and auxiliary files

### (a) Verified facts

Measured by traversing `skills/**` and matching per pattern.

**Cross-skill references use one mechanism: a relative sibling path.**

| Occurrences | Pattern |
|---|---|
| **1 905** | `../<id>/SKILL.md` resolving to a real skill |
| 2 | `../<id>/SKILL.md` **not** resolving — both in `author-skill/SKILL.md`: `../x/SKILL.md`, `../foo/SKILL.md` (deliberate placeholders in authoring instructions) |
| 2 | `skills/<id>/SKILL.md` (absolute-from-repo-root form) |

- 235 of 274 skills emit at least one cross-skill reference; **39 emit none**.
- 239 distinct skills are referenced as targets.
- Heaviest targets: `postgresdb` 78, `secure-coding` 68, `nextjs` 60, `harness` 49, `deployment` 49,
  `brand-voice` 39, `design` 33, `contracts` 31, `automation-flows` 26, `fastapi` 24.
- Heaviest referrers: `sdd` 30, `linkedin-carousels` 28, `gcp-essentials` 24, `fundraising` 23, `vue-nuxt` 23,
  `plan` 22, `redis` 22.

This is **relative, sibling-directory coupling**: `../<id>/SKILL.md` resolves only if skill directories remain
siblings. `scripts/skill-rubric.md` gate 5 makes it a ship gate: *"Every `../<sibling>/SKILL.md` link resolves
to a skill that exists."*

**Intra-skill auxiliary references.**

| Occurrences | Distinct skills | Pattern |
|---|---|---|
| 1 423 | 245 | `references/<file>` |
| 526 | 193 | `scripts/<file>` |
| 34 | 11 | `evals/<file>` |

**Markdown-link accounting** over all `skills/**/*.md` (1 326 `](...)` links):

| | count |
|---|---|
| external `http(s):`/`mailto:` | 319 |
| pure anchors (`#…`) | 49 |
| **relative paths** | **958** |
| …of which resolve on disk | **888** |
| …of which do not | **70** |

Inspection of the 70 shows they are overwhelmingly **not defects in the catalogue**: they are links into the
*consumer project's* `02-DOCS/` tree (`course-storytelling/references/learner-grounding.md` →
`02-DOCS/wiki/teaching/index.md` and five siblings), templated placeholders
(`harness/references/wiki-article-template.md` → `../../raw/{topic}/{raw-source-1}.md`), and example fragments
(`go/references/http-services.md` → `h`). This matters because `scripts/drift-check.js` exists precisely to
separate these: its header records that *"67 of 688 markdown links in the published catalog did not resolve,
and two were real wrong-depth bugs"* (`data-cleaning`→duckdb and `solid-js`→vercel, each missing a `../`),
and its core idea is *"code shows, prose points"* — links inside fenced blocks or inline code are
**displayed syntax**, not navigation, and are excluded via `stripFences` + `stripInlineCode`. Its catalog mode
is **blocking** (`npm run drift:check`, in both `prepublishOnly` and CI); its knowledge mode is report-only.

**`@`-references are not a file-reference mechanism in this catalogue.** 743 `@token` occurrences across
246 distinct tokens; the top ones are `@ericrisco/rsc` (69), `@media` (32), `@override` (24), `@export` (22),
`@keyframes` (20), `@app.function` (20), `@marp-team/marp-cli` (16), `@Test` (15), `@Composable` (11) — i.e.
npm scopes, CSS at-rules and language decorators. Only 31 tokens contain a `/`, and all 31 are npm package
scopes. There is **no `@path/to/file` import convention inside skills**. (One real `@`-import rule does exist,
but it is in harness wiring, not skills: `targets/agents-md-shadow.js:58` instructs *"Do NOT add
`@AGENTS.md` here: the import would expand the always-on block into context"*.)

**Two tests pin the reference graph:**
- `tests/catalog-diet.test.js` — *"every `references/` file is reachable from the body that owns it"*: for
  each skill it walks `references/` and asserts `body.includes(rel) || body.includes(f.name)`. Orphans fail.
  Currently 0 orphans.
- `tests/ux-upstream.test.js` — *"every path the skill routes to exists"*: extracts ≥30 routed paths from
  `skills/ux/SKILL.md` by four regexes over backticked and parenthesised forms, asserts each exists, **and**
  asserts that every file in `upstream/ux-designer/references/` is mentioned in the body.

### (b) Inferences

- **A transformation that keeps every file at its current path breaks nothing in the reference graph.**
  All three mechanisms (`../<id>/SKILL.md`, `references/<file>`, `scripts/<file>`) are relative to the skill
  directory, so prepending/appending text inside `SKILL.md` is reference-neutral.
- **A transformation that moves, nests or renames anything breaks a lot**, and breaks it *loudly*: 1 905
  sibling links assume `skills/<id>/` are peers, so inserting a level (e.g. `skills/<ns>/<id>/`) invalidates
  all of them; `drift-check` in catalog mode would fail the build, as would rubric gate 5 and
  `catalog-diet`'s orphan test.
- The `catalog-diet` orphan test is a **one-way constraint on removal, not on addition**: adding a new
  `references/governance.md` to a skill requires the body to mention it, or the test fails. Adding a
  *preamble that names it* satisfies the test; adding the file silently does not.
- `drift-check`'s fence/inline-code stripping means a governance preamble that shows example paths inside
  backticks or fenced blocks is invisible to the blocking check — a useful property, and a trap: a preamble
  that points at a real file in **prose** must point at a file that exists relative to that document.

### (c) Open questions

- Whether `drift-check.js`'s catalog mode currently passes was not verified (running it is out of scope).
  CI runs it on every push, and HEAD is a release commit, so it presumably passes — an inference, not a fact.
- The 70 unresolved relative links were classified by inspection of a 20-item sample plus their file names;
  a full triage of all 70 against `drift-check`'s own extraction rules was not performed.

---

## 7. The `02-DOCS` convention inside skills

This is the section §5's transition design depends on, so it is reported in the most detail.

### (a) Verified facts

**The §3 prior finding is confirmed — and understates the problem substantially.**

**Finding 1 — `flutter` does consult `02-DOCS/wiki/stack/flutter.md`.** Exact evidence,
`skills/flutter/SKILL.md`:

```
 392: ## Project grounding (02-DOCS)
 394: In a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md) wiki), this app's decisions
 395: live in `02-DOCS/wiki/stack/flutter.md`, indexed in `02-DOCS/wiki/index.md`. Read it first and stay
 399: re-deriving it. No `02-DOCS/` layer? Skip silently: technical conventions are *recorded, not gated*,
```

(Also `:21` an SDD gate naming `02-DOCS/wiki/sdd/`, and `:30` a pointer to `harness` owning the layer.)

**Finding 2 — the convention is not uniform; it barely exists.** Catalogue-wide measurement:

| Measure | Count | % of 274 |
|---|---|---|
| Skills referencing `02-DOCS` **anywhere** in the skill directory | **98** | 35.8% |
| Skills referencing `02-DOCS` **nowhere** | **176** | **64.2%** |
| Skills with a `## Project grounding …` heading in `SKILL.md` | **36** | 13.1% |
| Skills referencing `02-DOCS/wiki/stack/<own-id>.md` (the flutter pattern) | **24** | **8.8%** |
| Skills with an SDD-gate paragraph | 10 | 3.6% |
| Skills referencing `02-DOCS/wiki/skills/<id>/README.md` (the §5 standard) | **0** | **0%** |

The sharpest evidence of non-uniformity: of a 45-skill sample of **directly comparable stack/platform
skills** — `angular`, `astro`, `svelte`, `nodejs`, `typescript`, `laravel`, `django`, `rails`, `ruby`, `php`,
`elixir`, `phoenix`, `nestjs`, `htmx`, `kotlin-android`, `swift-ios`, `react-native`, `tauri`, `electron`,
`unity`, `unreal`, `godot`, `mysql`, `dynamodb`, `sqlite-turso`, `firebase`, `supabase`, `vercel`, `netlify`,
`railway`, `render`, `cloudflare`, `aws-essentials`, `gcp-essentials`, `docker`, `compose-multiplatform`,
`solid-js`, `prisma-orm`, `drizzle-orm`, `planetscale`, `neon`, `clickhouse-analytics`, `vector-db`,
`bash-scripting`, `csharp-dotnet` — **45 of 45 reference `02-DOCS` nowhere at all.** `flutter` consults a
project doc; `angular` and `svelte`, its nearest structural peers, have no such mechanism.

**Finding 3 — the 24 skills that do follow the `wiki/stack/<id>.md` pattern** are
`coolify`, `course-storytelling`, `cpp`, `deployment`, `duckdb`, `expo`, `fastapi`, `flutter`,
`gamedev-pathing`, `go`, `java`, `level-design`, `modal`, `mongodb`, `nextjs`, `postgresdb`, `presentations`,
`python`, `react`, `redis`, `rust`, `security-scan`, `spring-boot`, `vue-nuxt`.
A further 5 reference a stack doc **not** named after themselves: `agent-eval`→`evals.md`,
`building-agents`→`agents.md`, `secure-coding`→`security.md`, `constitution`→`nextjs.md`/`design.md`/`<x>.md`/`*`,
`plan`→`*`.

**Finding 4 — even within those 24, the wording and structure differ.** First `02-DOCS`-bearing line of each:

| Skill | shape |
|---|---|
| `cpp`, `deployment`, `modal`, `python`, `rust` | `## Project grounding (02-DOCS)` |
| `coolify`, `duckdb`, `expo`, `java`, `mongodb`, `security-scan`, `vue-nuxt`, `gamedev-pathing` | `## Project grounding (02-DOCS + CLAUDE.md)` |
| `fastapi`, `go` | opens with the SDD gate blockquote instead |
| `nextjs`, `react`, `postgresdb` | SDD gate in prose, differently worded in each |
| `redis` | one inline sentence: *"Record this project's Redis decisions in `02-DOCS/wiki/stack/redis.md` (recorded, not gated…"* |
| `spring-boot` | *"If the repo has a `02-DOCS/` wiki, record stack decisions…"* |
| `level-design` | only as a `harness` cross-reference bullet |
| `course-storytelling`, `presentations` | a numbered "Locate the profile/brand study" step that routes via root `CLAUDE.md` → `02-DOCS/wiki/index.md` |

Heading variants across the catalogue (counts): `## Project grounding (02-DOCS + CLAUDE.md)` ×15,
`## Project grounding` ×11, `## Project grounding (02-DOCS)` ×10, `## Project layout` ×6, then **~35
one-off headings** — `## 1. Read the wiki FIRST — before any decision`, `## Layer 2 — Grounding contract`,
`## The grounding gate (read first — STOP if unmet)`, `## Learner grounding (hard gate — read this first)`,
`## Reconcile before you write (do not duplicate the stack wiki)`, `## Phase 1 — Ground in 02-DOCS`,
`## The ledger (02-DOCS)`, `## Brand grounding (gate — clears before the first headline)`, etc. Each appears
exactly once.

**Finding 5 — distinct `02-DOCS/...` path shapes referenced from `skills/`.** 1 052 references across 227
files in 98 skills. The 40 heaviest shapes:

| Count | Path shape |
|---|---|
| 137 | `02-DOCS` (bare) |
| 117 | `02-DOCS/` |
| 77 | `02-DOCS/wiki/harness/user-profile.md` |
| 77 | `02-DOCS/wiki/index.md` |
| 33 | `02-DOCS/wiki/sdd/config.yaml` |
| 31 | `02-DOCS/wiki/` |
| 28 | `02-DOCS/wiki/youtube/` |
| 28 | `02-DOCS/wiki/sdd/` |
| 25 | `02-DOCS/wiki/sdd/specs/<slug>.md` |
| 24 | `02-DOCS/wiki/sdd/constitution.md` |
| 22 | `02-DOCS/wiki/brand/` |
| 19 | `02-DOCS/wiki/sdd/decisions.md` |
| 17 | `02-DOCS/wiki/linkedin/` |
| 15 | `02-DOCS/wiki/sdd/plans/<slug>.md` |
| 14 | `02-DOCS/wiki/harness/decisions.md` |
| 13 | `02-DOCS/wiki/shortform/` · `…/medium/` · `…/teaching/` |
| 12 | `02-DOCS/wiki/stack/design.md` |
| 11 | `02-DOCS/wiki/brand/voice-guide.md` · `02-DOCS/wiki/log.md` |
| 9 | `02-DOCS/raw/brand/` · `02-DOCS/raw/` |
| 8 | `02-DOCS/wiki/stack/*` |
| 6 | `02-DOCS/wiki/harness/` · `02-DOCS/inbox/` · `02-DOCS/shortform/` |
| 5 | `02-DOCS/linkedin-outreach/touches.csv` · `…/sdd/progress/<slug>.md` · `…/shortform/strategy.md` · `02-DOCS/.rscignore` · `…/stack/presentations.md` · `02-DOCS/wiki/decisions/` · `02-DOCS/raw/teaching/` |

The long tail is ~150 further distinct shapes at counts 1–4, including `02-DOCS/.obsidian/app.json`,
`02-DOCS/wiki/Articles.base`, `02-DOCS/wiki/scores.json`, `02-DOCS/audits/audit-YYYY-MM-DD-HHMM.html`,
`02-DOCS/raw/migrated/03-NOTES/architecture.md`, `02-DOCS/wiki/.ingested.json`, and 20 distinct
`02-DOCS/wiki/stack/<name>.md` files. Several shapes are artefacts of the capture regex (trailing `.`,
`}`, `</code>`), which I note rather than silently discard: `02-DOCS.`×4, `02-DOCS/wiki/youtube/.`×4,
`02-DOCS/linkedin-outreach/touches.csv}`×1, `02-DOCS/</code>`×1.

**Per-skill reference density** (top): `harness` 146, `init` 42, `course-storytelling` 41, `sdd` 38,
`constitution` 36, `marketing` 35, `presentations` 34, `specify` 30, `implement` 25, `youtube-strategy` 22.
Full distribution spans 98 skills from 146 down to 1.

**Finding 6 — `02-DOCS` is hard-coded in the harness, not configurable.**
**151 occurrences across 34 code files** under `scripts/` + `targets/` (excluding tests and skills). A search
for `docsRoot`, `DOCS_ROOT`, `knowledgeRoot`, `RSC_DOCS`, `wikiRoot` across all `.js`/`.mjs`/`.json`
(node_modules excluded) returned **no configuration surface**. Representative hard-coded sites:

```
scripts/lib/constitution-draft.js:19   export const CONSTITUTION_PATH = '02-DOCS/wiki/sdd/constitution.md';
scripts/lib/constitution-draft.js:148  mkdirSync(join(cwd, '02-DOCS', 'wiki', 'sdd'), { recursive: true });
scripts/lib/eval-integrity.js:117      export const PROTECTED_PATHS = ['02-DOCS/wiki/'];
scripts/lib/ingest-move.js:16          const PROTECTED_DIRS = new Set(['02-DOCS','01-TOOLS','.git','.rsc',…]);
scripts/lib/onboarding-apply.js:373    export const HARNESS_FLOOR_MINIMUM = [TEMPLATE_FLOOR, '02-DOCS/wiki/harness/'];
targets/knowledge-sync.mjs:47          export const KNOWLEDGE = Object.freeze(['01-TOOLS/','02-DOCS/wiki/','02-DOCS/attachments/']);
targets/knowledge-sync.mjs:49          export const PERSONAL = Object.freeze(['02-DOCS/wiki/harness/user-profile.md']);
targets/copy-rules.mjs:97              const base = join(root, '02-DOCS', 'wiki');
targets/danger-guard.mjs:60            readFileSync(join(root,'02-DOCS','wiki','harness','user-profile.md'),'utf8')
targets/worktree-reaper.mjs:58         export const RSC_STATE = ['.rsc/','02-DOCS/raw/worklog/.rsc-memory/'];
targets/session-memory-core.mjs:622    /^02-DOCS\/wiki\/(ftd|sdd\/(specs|plans|progress))\/[^/]+\.md$/u
scripts/install-apply.js:943           existsSync(join(cwd,'02-DOCS')) → kept: 'your knowledge base…'
```

**§3's open question "is the documentation root configurable?" is answered: NO.** `02-DOCS` is a literal in
34 harness source files plus 98 skill directories. §5's conditional — *"Si la auditoría demuestra que esa raíz
es configurable, respeta la configuración"* — is therefore **not triggered**: there is no configuration to
respect. Making it configurable would be new work spanning 151 code sites and 1 052 skill references.

### (b) Inferences

- There is **no existing convention to transition from** at the `wiki/skills/<id>/README.md` level — that path
  appears zero times in the entire repository. §5's "las rutas anteriores pueden conservar documentación
  técnica" maps onto a real but *partial* prior art: `02-DOCS/wiki/stack/<id>.md`, honoured by 24 of 274
  skills (8.8%), with 5 more pointing at a differently-named stack doc.
- The transition design therefore has two distinct jobs, not one:
  1. **Introduce** a uniform entry (`02-DOCS/wiki/skills/<id>/README.md`) for 274 skills, 176 of which have
     no project-grounding mechanism of any kind today;
  2. **Reconcile** the 24+5 existing `wiki/stack/*` consumers so the new entry is the single source of truth
     and the old doc becomes a link target rather than a competing one — which is exactly what §5's "sin
     duplicar fuentes de verdad" demands.
- The 29 skills already reading `wiki/stack/*` are the highest-risk set for a bulk transformation: a generic
  preamble pointing at `wiki/skills/<id>/README.md` added to a body that *also* says "this app's decisions
  live in `02-DOCS/wiki/stack/flutter.md`" creates two instructions about where truth lives. §6's "Precedencia"
  clause is the mechanism for that, but it has to be *written into* those 29 bodies, not merely prepended.
- Because `02-DOCS` is hard-coded, a fork that keeps the literal inherits consistency for free; a fork that
  makes the root configurable takes on the 151-site change plus a migration for every one of the 1 052 skill
  references, plus `tests/knowledge-sync.test.js` (128 `02-DOCS` occurrences) and ~45 other test files.

### (c) Open questions

- Whether `02-DOCS/wiki/stack/<id>.md` is the *approved convention* or merely an *observed pattern* (§7's own
  taxonomy) cannot be settled from this repo alone: the authoring standard lives at
  `scripts/skill-rubric.md`, which does **not** mention project grounding or `02-DOCS` as a required section.
  `.gitignore:40-48` records that the working documentation was migrated out of this repo to
  `https://github.com/ericrisco/RSC → 02-DOCS/`, so the convention's own documentation is in a repository I
  cannot read. **This should be asked of the user before §5's transition is designed.**
- 11 skills have a bare `## Project grounding` heading with no parenthetical. Whether those reference
  `02-DOCS` in the section body or ground some other way was not checked per-skill.

---

## 8. Third-party content and licences

### (a) Verified facts

**Repository licence: MIT.** `LICENSE`, 1 067 bytes: *"MIT License / Copyright (c) 2026 Eric Risco"*, standard
text. `package.json` `"license": "MIT"`. MIT grants, without restriction, the rights to *"use, copy, modify,
merge, publish, distribute, sublicense, and/or sell"*, with one condition: *"The above copyright notice and
this permission notice shall be included in all copies or substantial portions of the Software."*

**There is no trademark clause, no name restriction, no non-compete, no field-of-use limit, and no notice
requirement beyond the copyright + permission notice.** Publishing a fork under a different npm package name
is permitted. The only obligation is to retain `LICENSE` (Eric Risco's copyright + the MIT permission notice)
in the fork.

**Complete inventory of third-party / licence / attribution files inside `skills/`:**

```
$ find skills -iname 'THIRD_PARTY*' -o -iname '*LICENSE*' -o -iname 'NOTICE*' -o -iname 'COPYING*'
skills/design/IMPECCABLE-LICENSE.txt
skills/design/THIRD_PARTY.md
skills/design/engine/LICENSE
skills/open-weights/references/licenses.md
skills/terms-conditions/references/notices-and-aup.md
skills/ux/THIRD_PARTY.md
skills/ux/upstream/ux-designer/LICENSE
skills/ux/upstream/ux-usability-foundations/LICENSE
```

(`skills/open-weights/references/licenses.md` and `skills/terms-conditions/references/notices-and-aup.md` are
*subject-matter content about licences*, not licences governing the repo — they are those skills' reference
material.)

**Four third-party components, all read in full:**

| Component | Location | Licence | Copyright | Modified? |
|---|---|---|---|---|
| **taste-skill** (`Leonxlnx/taste-skill`, `skills/taste-skill`) | `skills/design/engine/` (2 406 711 B, scripts/library/assets/references) | **MIT** (`engine/LICENSE`) | © 2026 Leonxlnx | **No** — "copied unmodified"; `engine/RUN.md` is upstream `SKILL.md` with YAML frontmatter removed, "the text is unchanged" |
| **impeccable** (`pbakaus/impeccable`) | `skills/design/references/{modes,finish-review,design-md}.md` | **Apache-2.0** (`IMPECCABLE-LICENSE.txt`, 10 766 B) | Copyright 2025 Paul Bakaus | **Yes** — `THIRD_PARTY.md` states "**Modified:** rewritten, shortened, and pointed at taste-skill's inspector…". No code, text adaptations only. "impeccable's NOTICE concerns its iOS and Android references, which are not used here." |
| **ux-designer** (`szilu/ux-designer-skill`) | `skills/ux/upstream/ux-designer/` (29 reference files + GUIDE.md + LICENSE) | **MIT** | © 2026 Szilárd Hajba | **No** — "copied unmodified"; `GUIDE.md` is upstream `SKILL.md` minus frontmatter |
| **ux-usability-foundations** (`hueyexe/frontend-agent-skills`) | `skills/ux/upstream/ux-usability-foundations/` (4 reference files + GUIDE.md + LICENSE) | **MIT** | © 2026 hueyexe | **No** — "copied unmodified" |

Pins: `skills/design/engine/UPSTREAM.json` records `taste-skill` commit
`6010f91a9935f1c167dfc500fb1a475681892e6b` v2.1.4 MIT, and `impeccable` commit
`8644175285360c166e57b1e35ecadfbc85ff5209` `skill-v4.7.0` Apache-2.0 with
`"used": "text only (modes, finish review, DESIGN.md format), rewritten; no code"`.
`skills/ux/upstream/UPSTREAM.json` (4 777 B) records, per source, the repo, 40-hex commit, licence,
copyright, a note, **and a sha256 for every single shipped file**.

**Embedded data provenance** (`skills/design/THIRD_PARTY.md`): `library/photos.json` lists Lorem Picsum IDs
(*"photographs from Unsplash, under the Unsplash licence"*); `library/sites.json` *"describes studied sites
from One Page Love and Awwwards and copies none of them"*; `library/type.json` links Fontshare and Google
Fonts.

**Two tests enforce the attribution and the vendored content:**

- `tests/ux-upstream.test.js` — the strictest gate in the repo:
  ```js
  const shipped = files(dir).map(p => relative(dir,p)).sort();
  assert.deepEqual(shipped, Object.keys(source.files).sort(), `${name}: shipped files = recorded files`);
  for (const [file,hash] of Object.entries(source.files))
    assert.equal(sha(join(dir,file)), hash, `${name}/${file} drifted from upstream`);
  ```
  plus: `commit` matches `/^[0-9a-f]{40}$/`; `license === 'MIT'`; each `GUIDE.md` must **not** start with
  `---`; each `LICENSE` must match `/^MIT License/`; **only one `SKILL.md` inside `skills/ux`**; and every
  routed path in `skills/ux/SKILL.md` must exist.
- `tests/design-engine.test.js:85-91` (test "A9 · third-party licences travel with the skill") —
  `engine/LICENSE` matches `/MIT License[\s\S]*Leonxlnx/`; `IMPECCABLE-LICENSE.txt` matches
  `/Apache License[\s\S]*Version 2\.0/`; `THIRD_PARTY.md` must contain the strings
  `Leonxlnx/taste-skill`, `MIT`, `pbakaus/impeccable`, `Paul Bakaus`, `Apache-2.0`, `Modified`;
  `UPSTREAM.json`'s `taste-skill.commit` is a 40-hex sha. Test at line 125 also asserts
  *"the engine ships unmodified: every script parses and RUN.md is upstream text without front matter"*.
  Unlike `ux`, `design` has **no per-file hash gate**.

**`targets/agent-sources.json` is not a licence file.** 1 482 bytes; three "research receipts" recording
which authoritative URLs a reviewer agent's rules were researched against, with dates. Verbatim entries:
`go-reviewer` (researchedAt 2026-09-02) → `go.dev/wiki/CodeReviewComments`, `go.dev/doc/comment`,
`go.dev/doc/contribute`; `cpp-reviewer` → `isocpp.github.io/CppCoreGuidelines`; `python-reviewer` →
three `docs.python.org/3.14/` pages. It is copied verbatim into `manifest.json.sourceReceipts`
(`build-manifest.js:62`). **It imposes no licence condition.** It covers 3 of 34 agents and **0 of 274
skills**.

**The originality check: what it actually enforces.** `scripts/originality-check.js` (137 lines, read in full)
+ `schema/ecc-originality.json` + `schema/ecc-originality.u64` (746 696 B binary).

- **Corpus:** `source: "https://github.com/affaan-m/everything-claude-code"`, `revision`
  `90430ab3a716e12a9c6770802efa352098735f24`, `generatedAt: "2026-09-02"`,
  `included: ["agents/**","commands/**"]`, `ngramSize: 8`, `fingerprintCount: 93337`,
  `dataSha256: 2025038e…63463`, `exemptions: []`.
- **Mechanism:** normalise to NFKC lowercase, tokenise on `/[\p{L}\p{N}_+.#/-]+/u`, take every sliding
  8-token window, hash SHA-256 and keep the first 64 bits (`fingerprint`, line 22-23). The corpus file is
  loaded only after its length (`bytes.length/8 === fingerprintCount`) and its `sha256` match the receipt
  (lines 64-69) — *"collisions fail closed"*.
- **What is compared:** `catalogDocuments()` (lines 43-54) returns **`stackAgents()` bodies and
  `resolveCommands()` bodies only**:
  ```js
  return [
    ...stackAgents().map(a => ({ id:`agent:${a.name}`, text:`${a.desc}\n${a.body}` })),
    ...commands.map(c => ({ id:`command:${c.name}`, text:`${c.description}\n${c.body}` })),
  ];
  ```
  **No `SKILL.md` and no skill reference file is ever fingerprinted.** (The skill ids are read at line 44 only
  to pass into `resolveCommands`.)
- **Verdict:** any match → `console.error` per match + `exit 1` (lines 130-133). `--refresh <ecc-checkout>`
  regenerates the corpus from a local checkout.
- **Wiring:** `package.json` `"originality:check"`, called from `prepublishOnly`. **Not** in
  `.github/workflows/ci.yml`.

The rubric's dimension 7 ("Originality & safety", weight 0.10) explains the intent: *"rsc voice, not a clone
of any external catalog (no borrowed urgency blocks / rationalization tables / `*-reviewer-prompt.md`
conventions / verbatim flowcharts)"* — i.e. an **anti-plagiarism self-check**: proof that rsc's agents and
commands do not share 8-token spans with that third-party catalogue.

### (b) Inferences / assessment

- **No BLOCKER.** MIT (repo) + MIT ×3 + Apache-2.0 ×1 are all permissive and all compatible with modifying,
  redistributing, and publishing the fork under a different package name. Obligations to carry forward:
  1. Retain `LICENSE` (Eric Risco / MIT) — MIT §condition.
  2. Retain `skills/design/engine/LICENSE` (Leonxlnx / MIT), `skills/ux/upstream/*/LICENSE`
     (Hajba / MIT, hueyexe / MIT), and both `THIRD_PARTY.md` files.
  3. Retain `skills/design/IMPECCABLE-LICENSE.txt` (Apache-2.0) **and**, per Apache-2.0 §4(b), *"cause any
     modified files to carry prominent notices stating that You changed the files."* The three
     impeccable-derived files (`skills/design/references/{modes,finish-review,design-md}.md`) are **already
     modified** and `THIRD_PARTY.md` already carries the "**Modified:**" notice. **If the fork's
     transformation modifies those three files again, the fork must extend that notice.** This is the one
     real licence-driven constraint a bulk transformation creates.
  4. Apache-2.0 §6 withholds trademark permission — so the fork must not imply endorsement by Paul Bakaus.
     Renaming the package away from `@ericrisco/rsc` is, if anything, safer here.
- **The originality check does not constrain the fork.** It fingerprints agents and commands, never skills;
  its corpus is a *third* repository; and nothing in it references the package name. Renaming
  `@ericrisco/rsc` has no effect on it. A fork that transforms **skill content only** cannot change its
  result at all. A fork that *also* edits agent or command bodies could newly collide with an 8-token span —
  a theoretical risk, and one the exemption mechanism (`category` ∈ {name, error, tool-command,
  language-term} + 16-hex fingerprint, validated at lines 59-63) exists to absorb.
- **`skills/ux/upstream/` is effectively frozen.** `assert.deepEqual(shipped, Object.keys(source.files))`
  means the test fails if **any** file is added, removed or renamed under `skills/ux/upstream/**`, and the
  sha256 loop means it fails if any byte changes. A transformation must treat that subtree as read-only, or
  regenerate `UPSTREAM.json`'s hashes — which would be a false claim, since those hashes assert *"this is
  upstream's byte-exact content at commit X"*.
- `skills/design/engine/` has no hash gate, but `THIRD_PARTY.md` claims it is "copied unmodified" and
  `tests/design-engine.test.js:125` asserts every engine script parses and `RUN.md` is unmodified upstream
  text. Transforming it would make the attribution file untrue — a documentation-integrity problem even
  though no test catches the content change.
- A fork publishing under a different npm name should also check for **`@ericrisco/rsc` string literals**:
  69 occurrences of `@ericrisco/rsc` appear inside **skill markdown** (the heaviest `@`-token in the
  catalogue, §6), plus `targets/auto-update.mjs` and the `suggest` description itself (`npx @ericrisco/rsc
  add <id>`). This is not a licence issue, but it is a correctness issue for the §10 auto-updater and
  confirms the §3 prior finding that *"el actualizador apuntaba a `@ericrisco/rsc`"*.

### (c) Open questions

- Whether `skills/design/engine/library/photos.json`'s Unsplash-licensed photo references, and
  `sites.json`'s "studied sites from One Page Love and Awwwards", carry any redistribution condition beyond
  what `THIRD_PARTY.md` asserts. I read the attribution file, not the Unsplash licence or those JSON payloads.
  Low risk (IDs and descriptions, no images shipped — `engine/assets/` was not enumerated file-by-file), but
  unverified.
- The 93 337-fingerprint corpus `schema/ecc-originality.u64` is a derived binary of a third-party repo's
  content. Whether redistributing 8-token SHA-256 fingerprints of someone else's repository raises any
  question of its own was not assessed; `everything-claude-code`'s own licence was not inspected (it is not
  vendored here, only fingerprinted).
- `skills/harness/assets/` and `skills/scroll-film/assets/` (23 459 B total) were not inspected for embedded
  third-party media.

---

## 9. Content cost

### (a) Verified facts

**Catalogue mass:**

```
$ du -sk skills   →  15272  (KiB, apparent-on-disk)
traversal sum of file sizes: 12 111 726 bytes = 11.55 MiB across 1 679 files
```

| Component | Bytes | Share |
|---|---|---|
| `SKILL.md` (all 274: 167 403 frontmatter + 3 332 568 body) | **3 499 971** | 28.9% |
| `references/**` | 3 154 326 | 26.0% |
| `design/engine/**` (third-party) | 2 406 711 | 19.9% |
| `evals/**` | 1 412 386 | 11.7% |
| `scripts/**` | 1 029 240 | 8.5% |
| `ux/upstream/**` (third-party) | 505 213 | 4.2% |
| `tools/`, `assets/`, `prompts/`, `examples/` | 89 752 | 0.7% |

**Per-skill size:** mean 44 203 B, median 31 130 B, min 6 987 B, p90 42 376 B, max 2 435 675 B.
Excluding the three outliers (`design`, `ux`, `harness`), the remaining 271 skills total 8 853 274 B,
mean 32 669 B.

**`SKILL.md` body (the unit a loaded skill actually costs):** mean 12 163 B, median 11 883 B,
min 4 174 B, max 29 576 B, total 3 332 568 B.

**Always-on injected block.**

| Surface | Bytes |
|---|---|
| `skills/suggest/SKILL.md` total | **7 280** |
| …frontmatter | 660 |
| …**body (what is injected)** | **6 620** |
| Degraded stub (`codeHooks===false && !laneGate`) | ~331 (one paragraph, `targets/claude.js:146`) |

For Claude Code the SessionStart hook prints the file at `argv[2]` — the installed
`.rsc/skills/suggest/SKILL.md`, i.e. the **full 7 280 bytes including frontmatter**
(`session-start.mjs:51-53` writes the file verbatim, with no frontmatter stripping). For the
AGENTS.md/rules family, `targets/_md-block.js:28` injects `stripFrontmatter(...)` — **6 620 bytes** — plus the
`UPDATE_NOTE` (≈250 B) inside fixed markers. `tests/context-budget.test.js` asserts
`budget.sessionStartBytes > 5000` for an install of `['suggest','fastapi']`, consistent with ~6.6–7.3 KB.

**Per-turn and description costs.** `scripts/doctor.js` / `contextBudget` reports four figures:
`sessionStartBytes` (always-on body × wired scopes), `perTurnBytes` (the `userprompt-gate` injection;
`tests/context-budget.test.js` asserts `> 100`), `descriptionsBytes` (installed skills' descriptions), and
`topContributors.{bodies,descriptions}`. `doctor.js:535-536` computes a `doubled` figure for duplicate wiring
across scopes; `rsc.js:620` prints *"Per session start : <kb> (always-on body, per wired scope…)"*.

**Description weight** (the one cost that scales with the installed set, per `build-manifest.js:105-107`):
total **107 299 chars** (≈104.8 KiB) for all 274; mean 392; median 351; max 659; 139 over the 350-char
advisory ceiling; 0 over the 1 024 hard limit.

### (b) Inferences

- **A per-skill body preamble is cheap but not free, and its cost is paid per *loaded* skill, not per
  catalogue.** A 500-byte preamble added to all 274 bodies adds 137 000 B (4.1%) to catalogue mass but
  only 500 B to any given turn's context — except in `suggest`, where it is paid on **every session start of
  every project** (and ×N for N wired scopes).
- **A per-skill `description` preamble is the expensive option.** It is paid on every turn for every
  installed skill. 100 chars × 8 floor skills = +800 chars always-on *minimum*, and more for every
  additionally installed skill; it also pushes the 139 already-over-ceiling descriptions further from the
  rubric's target and eats into the 365-char worst-case headroom (§3).
- **A frontmatter metadata key is essentially free** (tens of bytes, never injected into context, invisible
  to `manifest.json` and to the assistant).
- **A separate `references/governance.md` is free until loaded** — but `tests/catalog-diet.test.js` requires
  the body to name it, so the body pays the pointer (tens of bytes) and the turn pays the file only on demand.
  This is the progressive-disclosure pattern the rubric already rewards (dimension 3).

### (c) Open questions

- `budget.perTurnBytes` (the `userprompt-gate` injection) was not measured; `targets/userprompt-gate.mjs` is
  2 399 bytes but the *injected* text is a subset I did not isolate.
- The `.rsc/suggest-always-on.md` stub's exact byte count is estimated from the string literal at
  `targets/claude.js:146`, not measured from a generated file (generating one would require running the
  installer).

---

## 10. Corrections to §3's prior findings

| §3 prior finding | Verdict | Evidence |
|---|---|---|
| "El catálogo tenía 274 skills" | **Confirmed at this commit** — but treat as measured, not fixed | three independent counts = 274; `manifest.counts.skills = 274` |
| "Los originales se distribuían desde `skills/<id>/`" | **Confirmed** | `package.json files`, `build-manifest.js:13-21`, `install-apply.js:19-29` |
| "El instalador copiaba contenido a `.rsc/skills/<id>/`" | **Confirmed**, with a caveat | `ensureBase` `cpSync` → `baseDir`; and it **deletes and re-copies** on a CLI-version change |
| "`.rsc.json` registraba selección y versión del catálogo" | **Confirmed** | `manifest-file.js:18` keys include `skills`, `catalogVersion` |
| "Skills como `suggest`, `ftd` y `sdd` participaban en el funcionamiento interno" | **Confirmed but incomplete** | at least 22 skills are structurally internal; see §5 |
| "Existían referencias relativas y archivos auxiliares" | **Confirmed and quantified** | 1 905 cross-skill + 1 423 `references/` + 526 `scripts/` + 34 `evals/` |
| "Flutter consultaba `02-DOCS/wiki/stack/flutter.md`, pero la convención no era uniforme" | **Confirmed; materially understated** | flutter: `SKILL.md:392-399`. Only 24/274 (8.8%) follow the pattern; **176/274 (64.2%) reference `02-DOCS` nowhere**; 45/45 comparable stack skills reference it nowhere |
| "El actualizador apuntaba a `@ericrisco/rsc`" | **Confirmed** | `package.json name`; 69 `@ericrisco/rsc` occurrences inside skill markdown; `targets/auto-update.mjs` |
| "¿La raíz de documentación es configurable?" (§3's question) | **Answered: NO** | 151 hard-coded `02-DOCS` literals in 34 harness source files; no `docsRoot`/`DOCS_ROOT`/`RSC_DOCS` configuration surface anywhere |

**One more finding worth flagging to the coordinator, outside my brief:**
`.gitignore:30` ignores `docs/`. `git check-ignore -v docs/fork/audit` →
`.gitignore:30:docs/   docs/fork/audit`. **This report, `REQUIREMENTS.md` and `LEDGER.md` are untracked and
will not be committed**, which conflicts with §1/§8's requirement that durable state live in files **and
Git**, and with §12's ledger. The fork needs a `.gitignore` negation (`!docs/fork/`) or a different location
before Stage 0 artefacts can persist. `.gitignore:40-48` records why `docs/` is ignored: the working
documentation was migrated on 2026-09-04 to `https://github.com/ericrisco/RSC → 02-DOCS/`.

---

## 11. Implications for the architectural decision (§4)

*No strategy is recommended here. These are feasibility constraints only.*

### Is a deterministic, idempotent transformation of `skills/` at build/install time technically feasible?

**Yes, with qualifications.** The four mechanisms the brief asked about do not block it:

| Mechanism | Blocks strategy B? | Why |
|---|---|---|
| **Frontmatter validation** | **No** | `schema/frontmatter.schema.json` has no `additionalProperties: false`; `origin: risco` already ships on all 274 skills as an unvalidated extra key. A governance key passes `--validate` untouched. `description` has 365 chars of worst-case headroom (1 024 − 659). |
| **`manifest.json`** | **No** | Records only `{id, description, tags, recommends, profiles}` — **no content hashes, no file lists, no sizes**. A body-only transformation leaves it byte-identical. A frontmatter-touching transformation must regenerate it (deterministically: sorted `localeCompare`, `JSON.stringify(_,null,2)+'\n'`), or CI's `npm run manifest:check` byte-comparison fails. |
| **Relative references** | **No, if paths are preserved** | All three mechanisms (`../<id>/SKILL.md` ×1 905, `references/<f>` ×1 423, `scripts/<f>` ×526) are relative to the skill directory. In-place text edits are reference-neutral. **Any re-nesting or renaming invalidates all 1 905 sibling links** and fails `drift-check` (blocking), rubric gate 5, and `catalog-diet`'s orphan test. |
| **Originality check** | **No** | `catalogDocuments()` fingerprints **agents and commands only** — not one byte of any `SKILL.md`. A skill-content transformation cannot change its result. It is also absent from CI (only `prepublishOnly`). Renaming the package does not affect it. |

### What specifically would break

1. **`skills/ux/upstream/**` — hardest constraint.** `tests/ux-upstream.test.js` asserts
   (a) the shipped file list **equals** `UPSTREAM.json`'s recorded key set exactly, and (b) the sha256 of
   every recorded file. Any addition, removal, rename or byte change there fails the suite. It also asserts
   **only one `SKILL.md` exists inside `skills/ux`** — so the transformation must not emit a second one — and
   that every file in `upstream/ux-designer/references/` is still named in `skills/ux/SKILL.md`.
2. **`tests/catalog-diet.test.js` — "every `references/` file is reachable from the body that owns it."**
   A new `references/*.md` written by the transformation **must be named in the transformed body** or the
   test fails. Conversely, a transformation that rewrites a body and drops an existing reference mention
   creates an orphan and fails.
3. **`npm run manifest:check` (CI, every push).** Byte-exact. Any frontmatter change to
   `description`/`tags`/`recommends`/`profiles`, or any added/removed skill directory, requires regenerating
   `manifest.json` in the same commit.
4. **`npm run drift:check` (CI, blocking in catalog mode).** Every **prose** markdown link in the catalogue
   must resolve relative to its own document. Links inside fenced blocks or inline code are excluded
   (`stripFences` + `stripInlineCode`), so a preamble that shows paths in backticks is invisible to it; a
   preamble that points at a file in prose must point at one that exists.
5. **`validateBodies()` / `fenceBalance`.** The injected text must contain an **even** number of column-0
   ```` ``` ````/`~~~` delimiters. All 274 bodies are currently balanced (2 944 delimiters, zero odd counts),
   so an unbalanced preamble would turn the whole catalogue red at once.
6. **`scripts/lib/frontmatter.js` dialect.** Not a YAML parser. Any frontmatter the transformation writes must
   be `key: scalar`, `key: [a, b]`, or `key:` + indented `- item`. Block scalars, nested maps and multi-line
   quoted values are silently dropped or mangled. The block must remain the **first bytes of the file**
   (`/^---\n/`).
7. **`scripts/lib/domains.js` + `README.md`.** `tests/domains.test.js` fails if a skill on disk is missing
   from `domains.js` (or vice versa) and if `README.md` lacks a `(skills/<id>/)` link for any manifest skill.
   Only relevant if the transformation adds or removes skill directories.
8. **Apache-2.0 §4(b).** If the transformation modifies
   `skills/design/references/{modes,finish-review,design-md}.md` (impeccable-derived, already modified), the
   fork must extend the "changed files" notice in `skills/design/THIRD_PARTY.md`.
9. **`skills/design/engine/**` attribution.** No hash gate, but `THIRD_PARTY.md` claims "copied unmodified"
   and `tests/design-engine.test.js:125` asserts the engine ships unmodified. Transforming it would make a
   shipped attribution file false.
10. **`suggest/SKILL.md` is the standing prompt, not a document.** Its body is injected verbatim on every
    session start (6 620 B body / 7 280 B file). A transformation of it is a transformation of the harness's
    always-on instruction, with blast radius = every turn of every project, ×N wired scopes.
11. **The 29 skills that already name `02-DOCS/wiki/stack/*`.** A generic preamble pointing at a new
    canonical location coexists with an existing in-body statement about where project truth lives. That is a
    semantic conflict a bulk prepend cannot resolve; §6's precedence clause has to be *written into* those
    bodies.
12. **`.rsc/skills/<id>/` is not durable.** `ensureBase` deletes and re-copies when the recorded base version
    differs from the CLI version, so an install-time transformation must be re-derived on every version
    change — which makes idempotence a hard requirement, not a nicety.

### What the transformation would have to preserve or regenerate

**Preserve byte-for-byte:**
- `skills/ux/upstream/**` (every file; the file *set* too) and `skills/ux/upstream/UPSTREAM.json`
- `skills/design/engine/**` and `skills/design/engine/UPSTREAM.json`
- all licence and attribution files: `LICENSE`, `skills/design/{THIRD_PARTY.md,IMPECCABLE-LICENSE.txt}`,
  `skills/design/engine/LICENSE`, `skills/ux/THIRD_PARTY.md`, `skills/ux/upstream/*/LICENSE`
- `origin: risco` on all 274 skills (rubric gate 1)
- `name == <directory name>` on all 274 (rubric gate 1)
- every existing relative path: skill directories stay siblings; `references/` and `scripts/` keep their
  names and locations
- `evals/cases.yaml` on all 274, `scripts/verify.sh` exec bit on 189 (+4 other executables), `evals/README.md`
  on 269
- the single `SKILL.md`-per-skill invariant, and the `# H1`-first-line shape (274/274 today)
- fence balance (even count of column-0 delimiters)

**Regenerate deterministically, in the same commit/build:**
- `manifest.json` — only if frontmatter's five projected fields change, or the skill set changes; and by
  calling `scripts/build-manifest.js`, not by emitting JSON independently (the check is byte-exact)
- `scripts/lib/domains.js` and `README.md` catalogue links — only if the skill set changes
- `.rsc/skill-registry.json` / `.md` — derived from the manifest at install time; regenerates itself

**Verify after transforming** (the existing deterministic gate set, which is also §11's "validadores
deterministas"): `npm run validate` (frontmatter + fence balance + description weight) · `npm run
manifest:check` · `npm test` (136 test files; `ux-upstream`, `design-engine`, `catalog-diet`, `domains`,
`catalog-counts`, `skill-lint`, `drift-check`, `context-budget` are the catalogue-relevant ones) ·
`bash scripts/eval-lint.sh` · `npm run drift:check` · `npm run originality:check` · plus CI's
"cleanup gate" grep for retired marketplace fingerprints.

**Idempotence test that follows from the above:** applying the transformation to an already-transformed tree
must produce a byte-identical tree (no duplicated preamble, no second frontmatter key, no re-added
`references/` pointer), and `git diff --stat skills/` on a second application must be empty. Because
`manifest.json` carries no content hashes, byte-identity of `skills/` must be checked with git or an
independently computed digest — the manifest cannot witness it.

### Three constraints that most shape the choice

1. **The 274-skill catalogue has no existing governance surface to extend.** 176 of 274 (64.2%) reference
   `02-DOCS` nowhere; `02-DOCS/wiki/skills/<id>/README.md` appears **0 times**; the "convention" is 24 skills
   (8.8%) using `02-DOCS/wiki/stack/<id>.md` with ~35 one-off heading variants. §5 is an introduction, not a
   migration — except for 29 skills where it is both.
2. **Two vendored subtrees are hash- or attribution-frozen** (`skills/ux/upstream/**` by per-file sha256 **and
   exact file-list equality**; `skills/design/engine/**` by an "unmodified" attribution claim and a
   parses-cleanly test), and they are 24% of catalogue bytes. Whatever strategy is chosen must carve them out.
3. **`suggest` is not a skill for this purpose — it is the standing prompt**, and it plus the other seven
   `DEFAULT_SKILL_FLOOR` members install unconditionally on every path. The eight floor skills, and the
   22-skill internal set in §5, cannot be validated by sampling; §11 already requires semantic evaluation of
   them, and this audit's answer is that the set is **22, not 3**.

---

*Track A. Author: audit agent (Stage 0). Reviewer: to be assigned, per §12 ("cada etapa tiene responsable y
revisor distinto"). All counts reproducible from the commands and file:line citations above at commit
`6f7edd31d109b7f0211d637e2d084724f6dd8e26`.*
