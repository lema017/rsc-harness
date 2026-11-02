# Decision record — where it goes, how it lives, when it answers for itself

**Status:** draft, stage 3.
**Covers:** requirement §7 step 8 ("Registrar las decisiones y revalidar") and requirement §8 (persistence and evolution).
**Language:** English (D7).

---

## 1. The rule this document obeys

`decision-records/SKILL.md` §"Decide home + naming once" — `#"Pick a storage convention *before* the first record, and never spawn a competing second log. Default to the project's existing convention if one exists."` And, in the same section, `#"**Where to store** (first match wins):"`, a list of **three** branches.

**The three branches, in order, because an earlier draft of this document used the first and the third and silently dropped the second:**

1. `decision-records/SKILL.md#"The project's existing convention — never invent a parallel log."`
2. `decision-records/SKILL.md#"A code repo with no convention: \`docs/adr/\` (also seen as \`doc/adr/\`)."`
3. `decision-records/SKILL.md#"A harness workspace: \`02-DOCS/wiki/decisions/\`"`, indexed in `02-DOCS/wiki/index.md`.

Branch 2 is **the central brownfield case**. A repository with source code and no decision convention is precisely what this procedure most often meets, and sending it to `02-DOCS/wiki/decisions/` — a harness-workspace path — in a repo that is not a harness workspace was wrong in exactly the way that matters: silently, and in favour of the fork's own layout.

This stage therefore invents no log. What follows is a routing table over homes that already exist, plus the one slot that is genuinely new — and that one is new because the fork created the path it lives in, not because a parallel log looked convenient.

Five concrete homes exist upstream, reached through the project's own convention when it has one; the sixth path is the fork's:

| Home | What lives there | Format | Written by |
|---|---|---|---|
| The project's own existing convention, wherever it is | Whatever it already holds. **First match, always** | the project's | unchanged by this procedure |
| `docs/adr/NNNN-title.md` (or `doc/adr/`) | One ADR per hard-to-reverse choice, **in a code repo with no convention** | MADR 4.0.0 spine | `decision-records`, branch 2 |
| `02-DOCS/wiki/decisions/NNNN-title.md` | The same, **in a harness workspace** | MADR 4.0.0 spine, OKF frontmatter `type: decision` | `decision-records`, branch 3 |
| `02-DOCS/wiki/harness/decisions.md` | Append-only `D-NNNN` entries: context, options, decision, why, supersedes | `init/references/accompaniment-and-profile.md` §"`02-DOCS/wiki/harness/decisions.md`" | `init`, `continuous-learning` |
| `02-DOCS/wiki/sdd/decisions.md` | Append-only log of decisions taken **while building** | `skills/sdd/SKILL.md` | `plan`, `implement`, `review`, `parallel` |
| `02-DOCS/wiki/sdd/constitution.md` | Project-wide non-negotiables, numbered, with an append-only amendment log | `constitution/references/constitution-template.md` | `constitution` |
| `02-DOCS/wiki/skills/<id>/README.md` | **Skill-scoped** decisions: how one skill applies in this project | `CUSTOMIZATION-SCHEMA.md` | this procedure, with approval |

C2 of [`CONFLICT-RECORD.md`](./CONFLICT-RECORD.md) records the one genuine disagreement among these: `decision-records` and `continuous-learning` send an ADR-worthy forward choice to different homes. The rest coexist, each answering a different question — which is why C2 was narrowed to those two and the others moved to context. That disagreement is **not resolved here**. It is resolved per project by reading what the project already keeps, which is `decision-records`' own first-match rule.

---

## 2. Routing — which home for which finding

Modelled on the routing table `continuous-learning/SKILL.md` §"Routing decision table" already uses, because a "finding type → exact path → who writes it" table is the shape this harness has settled on.

| Finding | Durable home | Who writes it | Why there |
|---|---|---|---|
| How one skill applies in this project (scope, category, evidence) | `02-DOCS/wiki/skills/<id>/README.md` | this procedure, approved by the user | It is the single entry point the contract reads before applying that skill (`CONTRACT.md` §2) |
| A registered exception to an approved decision | `## Exceptions` in that same file | this procedure | `CONTRACT.md` §7; `CUSTOMIZATION-SCHEMA.md` §2, `## Exceptions` row |
| A migration — current state, target state, requires a decision | `## Migrations` in that same file | this procedure | `CONTRACT.md` §7; `CUSTOMIZATION-SCHEMA.md` §2, `## Migrations` row |
| Insufficient evidence, not yet decided | `## Open questions` in that same file | this procedure | `CUSTOMIZATION-SCHEMA.md` §2, `## Open questions` row |
| A hard-to-reverse choice that spans skills — a stack, a vendor, an auth model | **First match, per §1:** the project's existing ADR convention; else `docs/adr/NNNN-*.md` in a code repo; else `02-DOCS/wiki/decisions/NNNN-*.md` in a harness workspace | `decision-records` | Costly to reverse, and future readers will ask why |
| A low-stakes choice with no reversal cost | The project's existing append log | `continuous-learning` or this procedure | `continuous-learning/references/lesson-routing.md` §"A one-off, low-stakes note"; an ADR for a trivial reversible tweak — `decision-records/SKILL.md#"kills the practice"` |
| A project-wide non-negotiable discovered during analysis | Proposed as a constitution amendment; **never written directly** | `constitution` | It is ratified by the user, not by an analysis (`constitution/SKILL.md`, ratification rule) |
| The run itself: what was inventoried, sampled, found, asked | `02-DOCS/wiki/brownfield/<slug>.md` | this procedure | Point-in-time report. Overwritten per run, as `analyze` does with its own |

**The split in one sentence.** A skill-scoped decision lives in the customization, because that is where the contract looks before applying that skill; a cross-cutting decision lives in the project's decision log and is **cited** from the customization, because duplicating it would create the second source of truth that the "stale document" rule (`CONTRACT.md` §6) exists to punish.

That split is upstream's own: `codebase-onboarding/SKILL.md#"Link out, do not duplicate"` — "Link out, do not duplicate. The map says *what is*. For *why a choice was made*, write an ADR."

---

## 3. What a brownfield decision must carry

Requirement §8 lists the fields. Mapped against `CUSTOMIZATION-SCHEMA.md` as it stands today — and "today" matters: the two gaps an earlier draft of this table reported as **missing** have since been **closed** by stage 1, which added three keys and raised rule 1 to require **nine**. Reading the old table now would mean re-proposing work already done, or contradicting stage 1.

| §8 field | Slot today | Status |
|---|---|---|
| Skill | frontmatter `skill` | present |
| Version or commit reviewed | frontmatter `catalog-version` | **present** — added by stage 1 after this stage raised it. See the caveat below |
| Decisions, scope, reasons | `## Decisions`, per-decision `Scope:` | present |
| Evidence | frontmatter `evidence` + per-decision `Evidence:` | present |
| Exceptions | `## Exceptions` | present |
| Approval status | frontmatter `status` | present |
| Date | frontmatter `updated`, per-decision `Decided:` | present |
| Review conditions | frontmatter `reevaluate-when` | **present** — added by stage 1, reusing upstream's `reevaluateWhen` vocabulary |
| *(OKF conformance, not a §8 field)* | frontmatter `type: skill-customization` | present — the third key stage 1 added |

**All eight §8 fields now have a slot.** What remains is not a missing slot but a coarse one: `catalog-version` records the **catalog's** version, not the skill's content, so "this skill changed" fires for every catalog bump whether or not the clause a decision answers moved. A per-skill content digest would be exact and does not exist — `governance-digest` digests the rendered preamble, not the skill body (`CONTRACT.md` §1) — and creating one is the transformer's work, which is stage 4. §7 carries that as the one remaining proposal.

---

## 4. Lifecycle

Three states, named in the terms upstream already uses rather than a fourth vocabulary:

| Lifecycle | Customization `status` | ADR `Status:` | Onboarding `state` | Means |
|---|---|---|---|---|
| **pending** | `draft` | `proposed` | `deferred` (`onboarding.js`, `#"reevaluateWhen"` block) | Written down, not in force. **Does not resolve a conflict** |
| **in force** | `approved` | `accepted` | `selected` | Applies within its declared scope; beats the skill's generic recommendation (`CONTRACT.md` §5) |
| **superseded** | `superseded` | `superseded by ADR-NNNN` | — | Replaced. Kept, never deleted |
| *(declined)* | absent; recorded under `## Open questions` | `rejected` | `excluded` | Considered and not adopted. Kept so it is not re-proposed |

**Transitions.**

- **pending → in force.** Only the user does this. An analysis proposes; it never ratifies. For a constitution this is explicit ratification (`constitution/SKILL.md`, the ratification rule); for a customization it is the approval `PLAN.md` §4 requires before any write; for an ADR it is the `proposed` → `accepted` flip.
- **in force → superseded.** By the supersession ritual, which is upstream's and is not re-specified here: write the new record, edit **only the status line** of the old one, back-link both ways (`decision-records/SKILL.md` §"Status lifecycle + immutability", `#"The supersession ritual (never skip a step):"`). For the append-only logs, the equivalent is appending an entry that supersedes and references the old one — "never edit or delete an entry" (`init/references/accompaniment-and-profile.md`, the append-only rule).
- **Nothing is ever deleted.** "A wrong-in-hindsight ADR is still true history" (`decision-records/SKILL.md#"a wrong-in-hindsight ADR is still true history"`). The same holds for a customization whose skill upstream removed: it survives on disk, is reported as orphaned, and is never silently rehomed (`CUSTOMIZATION-SCHEMA.md` §4).

---

## 5. Revalidation

Requirement §8: "Cuando cambien las skills o el proyecto, identifica qué decisiones requieren revisión. Conservar el archivo no demuestra compatibilidad."

**Two triggers, because two things change.**

| Trigger | Detected how | Already exists? |
|---|---|---|
| **The project changed** | Re-scan and compare against the evidence recorded with the decision. `recommendDeferredComponents(plan, scanProject(cwd))` (`scripts/lib/onboarding.js`, `#"export function recommendDeferredComponents"`) already does exactly this: it compares `sourceFileCount`, new manifest `signals` and new `complexitySignals` against the accepted baseline, and returns the decisions whose `triggerRules` now match | **Yes.** Reuse it |
| **The skill changed** | Compare the version recorded in the customization against the installed catalog. Upstream's four change classes — added, modified, deleted, renamed (`PLAN.md` §4) — each have a different consequence | **Partly.** The field exists (`catalog-version`); its granularity is the catalog, not the skill — see §7 |

**The behavior is fixed by precedent, not chosen here.** `rsc reassess` (`scripts/rsc.js`, `runReassessment()`) reports which decisions the new evidence triggers, prints the command that would produce a new plan, and says `#"Review a new plan; nothing has been installed"`. Revalidation of brownfield decisions behaves the same way: it reports, it proposes, it never applies. A revalidation that rewrites a customization on its own would be a silent re-decision, which is the thing this whole design exists to prevent.

**The four upstream change classes, and what each does to a decision:**

| Class | Effect on a recorded decision |
|---|---|
| Skill **added** | No existing decision is affected. The new skill enters the next run's B1 inventory |
| Skill **modified** | Every decision recorded against an older version is flagged for review. It is **not** invalidated: a modified skill may not have touched the clause the decision answers |
| Skill **deleted** | The customization **survives on disk** and is reported as **orphaned**, with the skill name and the date it disappeared. Never deleted by install, `sync`, `repair` or update (`CUSTOMIZATION-SCHEMA.md` §4) |
| Skill **renamed** | Reported as a **migration requiring a decision**, never applied. There is no stable skill identifier — `origin:` reads `risco` on all 274, verified, so it is authorship, not identity (`CUSTOMIZATION-SCHEMA.md` §4; `CONTRACT.md` §7) |

---

## 6. How an in-force decision resolves a conflict with no question

This is step B6 of [`BROWNFIELD.md`](./BROWNFIELD.md), stated as the test a reviewer can apply.

**All three must hold. Any one failing leaves the conflict open.**

1. **In force**, by §4's table. A `draft` constitution is not in force (`constitution/SKILL.md`, the `status: draft` rule). A `draft` customization — `CUSTOMIZATION-SCHEMA.md` §1, `status` row: `#"A \`draft\` is read and reported, but does not outrank the skill's original"`. A `proposed` ADR has not been accepted.
2. **Covering.** The decision's declared scope contains the conflict's scope (`CONTRACT.md` §4). This is why `scope` has no default — `CUSTOMIZATION-SCHEMA.md` §1, `scope` row: `#"an omitted scope is a validation error, not an implicit \"everywhere\""`. In a monorepo an uncovered scope is the common case, not the exception.
3. **Not superseded**, by §4.

**Then precedence decides which in-force decision wins** — the contract's order, unchanged (`CONTRACT.md` §5):

```text
1  environment permissions, higher-priority instructions and policies
       └─ a customization cannot disable these. A file that tries IS the finding
2a constitution            ─┐ approved project decisions
2b per-skill customization ─┘ within its declared scope
3  the skill's generic recommendation
```

**Two outcomes that are not "resolved and silent":**

- **2a against 2b.** The constitution wins **and** the conflict is registered as an exception in the customization's `## Exceptions` (`CONTRACT.md` §5). The per-skill file was written by someone who believed it applied; they are the ones who need to know it does not.
- **A customization attempting level 1.** Not a conflict to resolve. The attempt **is** the finding, reported as such — `CUSTOMIZATION-SCHEMA.md` §3, rule 8: `#"an attempt is itself the finding"`.

**What resolving produces.** The conflict's `Status` becomes `resolved-by-decision` and it carries the citation: the file **and** the section it came from. Contract §9 requires it, and a resolution without the citation is indistinguishable from a preference (`CONTRACT.md` §9).

**What resolving does not do.** It does not edit code, it does not edit the decision, and it does not edit a stale document to match the code it describes. Where a document and the code disagree, both sides are reported with their locations and neither is "fixed": "silently 'fixing' either side destroys the evidence that they disagreed" (`CONTRACT.md` §6).

---

## 7. What this stage proposed to `CUSTOMIZATION-SCHEMA.md`, and what is still open

Proposed as changes, never duplicated into a second schema. Stage 1 owns that file.

**Three of the four are done.** Stage 1 accepted them after this stage raised them, and the schema now requires **nine** frontmatter keys (`CUSTOMIZATION-SCHEMA.md` §3, rule 1):

| Proposal | Key | State |
|---|---|---|
| (a) A reviewed-version key, so §8's *"skill y versión o commit revisado"* has a slot | `catalog-version` | **accepted and present** |
| (b) A review-condition key, so §8's *"fecha y condiciones de revisión"* has a slot — reusing upstream's `reevaluateWhen`, which already has an evaluator | `reevaluate-when` | **accepted and present** |
| (c) OKF conformance: `02-DOCS/wiki/` is an OKF v0.1 bundle where every non-reserved `.md` needs a non-empty `type`, and `README.md` is not exempt | `type: skill-customization` | **accepted and present** |

Recording them as still-missing would mean re-proposing accepted work, or contradicting stage 1 — which is why this section states them as closed rather than leaving the earlier draft's "missing" to be read twice.

**(d) The one that is still open, and it is a granularity, not a key.** `catalog-version` answers "which catalog was this reviewed against", not "which version of *this skill*". So the §5 trigger *the skill changed* fires on every catalog bump and over-reports: a decision about `flutter`'s state-management clause is flagged because some unrelated skill moved. The exact instrument would be a **per-skill content digest**, and it does not exist — `governance-digest` digests the rendered preamble, not the skill body (`CONTRACT.md` §1). Producing one is the transformer's work, so the proposal belongs to **stage 4**, not to stage 1.

Until it exists, revalidation is **sound but noisy**: it never misses a changed skill, and it flags skills that did not change. That is the safe direction of the error, and naming it is cheaper than letting a reader assume the trigger is precise.
