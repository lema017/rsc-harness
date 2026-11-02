# Per-skill customization — schema and template

**Status:** draft, stage 1.
**The file this describes:** `02-DOCS/wiki/skills/<official-name>/README.md` — one per skill, named by the official skill identifier.
**Why it has a schema:** acceptance criterion 10 requires that a brownfield finding be distinguishable as approved convention, observed pattern, debt, exception, migration or insufficient evidence. A distinction that is not machine-checkable is a distinction that erodes. This schema is what makes criterion 10's deterministic half possible.

---

## 1. Frontmatter

Flat keys only — the same constraint as the governance preamble, because the repo's frontmatter reader is a hand-rolled line parser and would read a nested object as unrelated top-level keys. Lists in the `key:` + `  - item` form are supported.

```yaml
---
skill: flutter
governance: v1
status: approved
updated: 2026-11-01
scope:
  - apps/mobile
evidence: codebase analysis, 2026-11-01, accepted by the user
---
```

| Key | Required | Meaning |
|---|---|---|
| `skill` | yes | The official skill identifier. **Must equal the containing directory name** — checkable, since directory name equals the `name:` key in 274 of 274 skills |
| `governance` | yes | The contract version this file was written against. A file written for `v1` is read under `v1` rules even after the contract moves on |
| `status` | yes | `approved` · `draft` · `superseded`. A `draft` is read and reported, but does not outrank the skill's original |
| `updated` | yes | ISO date. Feeds staleness reporting; it never licenses ignoring the file |
| `scope` | yes | `repo`, or a list of paths, packages or subprojects. **No default** — an omitted scope is a validation error, not an implicit "everywhere" |
| `evidence` | yes | How this was established, and by whom accepted. A file with no evidence is a preference wearing a decision's clothes |

`scope` is mandatory on purpose. In a monorepo, "we use Riverpod" is true of one package and false of another; a schema that lets scope be omitted will spread every local decision across the whole repository, and nobody will notice until it is wrong.

---

## 2. Body sections

| Section | Required | Contents |
|---|---|---|
| `## Decisions` | yes | The decisions this project has made about this skill |
| `## Out of scope` | yes | What this file deliberately does **not** decide, so the original skill applies there unchanged |
| `## Exceptions` | no | Registered exceptions, per contract §7 |
| `## Migrations` | no | Divergences whose resolution is a change over time |
| `## Open questions` | no | Insufficient evidence; not yet decided |
| `## References` | no | Links to auxiliary documents |

`## Out of scope` is required because its absence is what makes a customization metastasize. A file that only says what it decides implies, by silence, that it decided everything.

### Each decision carries four things

```markdown
- **Riverpod for state management.**
  Category: approved convention · Scope: apps/mobile
  Evidence: `apps/mobile/lib/main.dart:14`, and 31 of 34 providers already use it
  Decided: 2026-11-01, accepted by the user
```

The six categories, and what each one licenses:

| Category | What it means | What the assistant may do with it |
|---|---|---|
| **approved convention** | The project decided this | Apply it. It beats the skill's generic recommendation within its scope |
| **observed pattern** | The code does this; nobody approved it | Follow it for consistency, **say** it is unratified. Never cite it as a rule |
| **debt** | Known-wrong, deliberately tolerated | Do not propagate it. Do not fix it unasked either |
| **exception** | An approved decision knowingly does not hold here | Apply the exception within its stated bounds, nowhere else |
| **migration** | Current state → target state | **Requires a decision.** Report it; never execute it by detecting it |
| **insufficient evidence** | Not enough signal to decide | Ask. Do not pick the likeliest answer and write it down as fact |

The middle two are the ones that make this schema worth having. Upstream's existing project inspection (`scripts/detect-repo.js`) detects stacks, package managers and test runners **by file presence** — it is deterministic and it cannot tell an approved convention from an accident. Nothing in the harness today can, which is why §7 of the requirements asks for it, and why collapsing "observed pattern" into "approved convention" would silently promote every accident in the codebase to law.

---

## 3. Validation rules (the deterministic half of criteria 8 and 10)

A validator checks, with no model involved:

1. Frontmatter parses, and all six required keys are present.
2. `skill` equals the containing directory name, and names a skill that exists in the distributed catalog — **or** the file is reported as **orphaned** (see §4).
3. `status` is one of the three allowed values.
4. `scope` is present and non-empty.
5. `## Decisions` and `## Out of scope` both exist.
6. Every decision names one of the six categories and carries an evidence reference.
7. Every `migration` entry states a current state, a target state, and that it requires a decision.
8. No decision purports to disable an environment permission, a guard or a safety rule — precedence level 1 of the contract is not negotiable from this file, and an attempt is itself the finding.

A file that fails any of these is **named and asked about**, not ignored and not silently treated as absent (contract §2). Contract §2 is explicit: a file that exists but is unreadable, invalid or contradictory is not the same state as absent, and treating it as absent turns a project's explicit instruction into its opposite without telling anyone.

### Where the validator runs — without this, criterion 8 has no deterministic half

A validator nobody invokes is not an instrument. It runs in exactly two places, and both are deterministic:

| Point | When | Why there |
|---|---|---|
| `npm run gate` | **Does not exist yet.** `package.json` defines no `gate` script; it is a Stage 6 deliverable, and the "130 s" figure measured a manual sum of six scripts, not a gate. Written here as the intended second point, in the future tense it deserves | Would be the only gate with Actions disabled |
| `install` and `sync` | Whenever `02-DOCS/wiki/skills/` exists in the project | Catches a broken file at the moment the harness is set up, not silently three skills later. The harness already walks the project tree here |

**Its negative test, which is what makes criterion 8 falsifiable:** feed it a file with broken YAML, a missing `scope`, and a decision that tries to disable a guard. Each must produce a **named** error identifying the file and the rule. Silence, or an error that does not name the file, fails the test.

**And the boundary, stated so the criterion is not oversold:** the validator settles whether the *file* is well formed. It cannot settle whether the model **read** it or **honored** it — skill application is not an observable event in any of the five assistants (F32), so there is nothing to hook. That half is G1 and G2 of [`EVALUATION.md`](./EVALUATION.md), measured and never guaranteed.

---

## 4. Orphans and renames

Upstream can delete or rename a skill, and the fork follows upstream on deletions. A customization whose skill no longer exists:

- **survives on disk.** It is the project's property, versioned in the project's Git, and nothing in installation, `sync`, `repair` or update may delete it.
- **is reported as orphaned**, with the skill name and the date the skill disappeared.
- is **never silently rehomed** to a similarly-named skill. There is no stable skill identifier — `origin:` reads `risco` on all 274, so it is authorship, not identity — which means a rename can only be guessed from content similarity. A guess that is applied is a guess that has become invisible; it is reported as a **migration requiring a decision** instead.

This is acceptance criterion 12, and it is deliberately deterministic: it must hold whether or not any model behaves well.

---

## 5. Worked example

`02-DOCS/wiki/skills/flutter/README.md`

```markdown
---
skill: flutter
governance: v1
status: approved
updated: 2026-11-01
scope:
  - apps/mobile
evidence: codebase analysis 2026-11-01, accepted by the user
---

# flutter — project customization

## Decisions

- **Riverpod for state management.**
  Category: approved convention · Scope: apps/mobile
  Evidence: `apps/mobile/lib/main.dart:14`; 31 of 34 providers use it
  Decided: 2026-11-01, accepted by the user

- **Widget tests live beside the widget, not in a mirrored tree.**
  Category: observed pattern · Scope: apps/mobile
  Evidence: 48 of 52 test files sit next to their subject
  Note: unratified. Follow for consistency; do not cite as a rule

- **`setState` in `apps/mobile/lib/legacy/`.**
  Category: debt · Scope: apps/mobile/lib/legacy
  Evidence: 9 widgets, predate the Riverpod decision
  Do not propagate. Do not refactor unasked

## Out of scope

Navigation, networking, build flavors and CI. The skill's own recommendations
apply there unchanged.

## Migrations

- **`legacy/` from `setState` to Riverpod.**
  Current: 9 widgets on `setState` · Target: Riverpod, matching the convention
  **Requires a decision** — not scheduled, not started

## Open questions

- Which router the project standardizes on. `go_router` and `Navigator` 1.0 are
  both present and neither dominates. Category: insufficient evidence
```
