# Decision record — where it goes, how it lives, when it answers for itself

**Status:** draft, stage 3.
**Covers:** requirement §7 step 8 ("Registrar las decisiones y revalidar") and requirement §8 (persistence and evolution).
**Language:** English (D7).

---

## 1. The rule this document obeys

`skills/decision-records/SKILL.md:31` — "Pick a storage convention *before* the first record, and never spawn a competing second log. Default to the project's existing convention if one exists." And `:40-41`, where the home is chosen by **first match**, with "the project's existing convention" first.

This stage therefore invents no log. What follows is a routing table over homes that already exist, plus the one slot that is genuinely new — and that one is new because the fork created the path it lives in, not because a parallel log looked convenient.

Four homes exist upstream, and a fifth path is the fork's:

| Home | What lives there | Format | Written by |
|---|---|---|---|
| `02-DOCS/wiki/decisions/NNNN-title.md` | One ADR per hard-to-reverse choice | MADR 4.0.0 spine, OKF frontmatter `type: decision` | `decision-records` (`SKILL.md:43`, `:57`, `:67-73`) |
| `02-DOCS/wiki/harness/decisions.md` | Append-only `D-NNNN` entries: context, options, decision, why, supersedes | `references/accompaniment-and-profile.md:87-108` | `init`, `continuous-learning` (`SKILL.md:52-53`) |
| `02-DOCS/wiki/sdd/decisions.md` | Append-only log of decisions taken **while building** | `skills/sdd/SKILL.md:164` | `plan`, `implement`, `review`, `parallel` |
| `02-DOCS/wiki/sdd/constitution.md` | Project-wide non-negotiables, numbered, with an append-only amendment log | `skills/constitution/references/constitution-template.md:85` | `constitution` |
| `02-DOCS/wiki/skills/<id>/README.md` | **Skill-scoped** decisions: how one skill applies in this project | `CUSTOMIZATION-SCHEMA.md` | this procedure, with approval |

C2 of [`CONFLICT-RECORD.md`](./CONFLICT-RECORD.md) records the fact that the first three disagree about which is canonical. That disagreement is **not resolved here**. It is resolved per project by reading what the project already keeps, which is `decision-records`' own first-match rule.

---

## 2. Routing — which home for which finding

Modelled on the routing table `skills/continuous-learning/SKILL.md:45-53` already uses, because a "finding type → exact path → who writes it" table is the shape this harness has settled on.

| Finding | Durable home | Who writes it | Why there |
|---|---|---|---|
| How one skill applies in this project (scope, category, evidence) | `02-DOCS/wiki/skills/<id>/README.md` | this procedure, approved by the user | It is the single entry point the contract reads before applying that skill (`CONTRACT.md:62-68`) |
| A registered exception to an approved decision | `## Exceptions` in that same file | this procedure | `CONTRACT.md:144`; `CUSTOMIZATION-SCHEMA.md:44` |
| A migration — current state, target state, requires a decision | `## Migrations` in that same file | this procedure | `CONTRACT.md:145`; `CUSTOMIZATION-SCHEMA.md:45` |
| Insufficient evidence, not yet decided | `## Open questions` in that same file | this procedure | `CUSTOMIZATION-SCHEMA.md:46` |
| A hard-to-reverse choice that spans skills — a stack, a vendor, an auth model | The project's existing ADR convention; if none, `02-DOCS/wiki/decisions/NNNN-*.md` | `decision-records` | Costly to reverse, and future readers will ask why (`SKILL.md:17`) |
| A low-stakes choice with no reversal cost | The project's existing append log | `continuous-learning` or this procedure | `references/lesson-routing.md:68-75`; an ADR for a trivial reversible tweak "kills the practice" (`decision-records/SKILL.md:195`) |
| A project-wide non-negotiable discovered during analysis | Proposed as a constitution amendment; **never written directly** | `constitution` | It is ratified by the user, not by an analysis (`skills/constitution/SKILL.md:97`) |
| The run itself: what was inventoried, sampled, found, asked | `02-DOCS/wiki/brownfield/<slug>.md` | this procedure | Point-in-time report. Overwritten per run, as `analyze` does with its own (`analyze/SKILL.md:85`) |

**The split in one sentence.** A skill-scoped decision lives in the customization, because that is where the contract looks before applying that skill; a cross-cutting decision lives in the project's decision log and is **cited** from the customization, because duplicating it would create the second source of truth that the "stale document" rule (`CONTRACT.md:134`) exists to punish.

That split is upstream's own: `skills/codebase-onboarding/SKILL.md:115` — "Link out, do not duplicate. The map says *what is*. For *why a choice was made*, write an ADR."

---

## 3. What a brownfield decision must carry

Requirement §8 lists the fields. Mapped against `CUSTOMIZATION-SCHEMA.md` as it stands today:

| §8 field | Slot today | Status |
|---|---|---|
| Skill | frontmatter `skill` (`:27`) | present |
| Version or commit reviewed | — | **missing** — see §6 |
| Decisions, scope, reasons | `## Decisions`, per-decision `Scope:` (`:42`, `:55`) | present |
| Evidence | frontmatter `evidence` + per-decision `Evidence:` (`:32`, `:56`) | present |
| Exceptions | `## Exceptions` (`:44`) | present |
| Approval status | frontmatter `status` (`:29`) | present |
| Date | frontmatter `updated`, per-decision `Decided:` (`:30`, `:57`) | present |
| Review conditions | — | **missing** — see §6 |

Six of eight are already there. The two that are not are the two §8 needs for revalidation, which is the half of §8 that "conservar el archivo no demuestra compatibilidad" is about.

---

## 4. Lifecycle

Three states, named in the terms upstream already uses rather than a fourth vocabulary:

| Lifecycle | Customization `status` | ADR `Status:` | Onboarding `state` | Means |
|---|---|---|---|---|
| **pending** | `draft` (`:29`) | `proposed` (`:164`) | `deferred` (`onboarding.js:197`) | Written down, not in force. **Does not resolve a conflict** |
| **in force** | `approved` (`:29`) | `accepted` (`:165`) | `selected` (`onboarding.js:194`) | Applies within its declared scope; beats the skill's generic recommendation (`CONTRACT.md:121`) |
| **superseded** | `superseded` (`:29`) | `superseded by ADR-NNNN` (`:168`) | — | Replaced. Kept, never deleted |
| *(declined)* | absent; recorded under `## Open questions` | `rejected` (`:166`) | `excluded` (`onboarding.js:200`) | Considered and not adopted. Kept so it is not re-proposed |

**Transitions.**

- **pending → in force.** Only the user does this. An analysis proposes; it never ratifies. For a constitution this is explicit ratification (`skills/constitution/SKILL.md:97`); for a customization it is the approval `PLAN.md` §4 requires before any write; for an ADR it is the `proposed` → `accepted` flip.
- **in force → superseded.** By the supersession ritual, which is upstream's and is not re-specified here: write the new record, edit **only the status line** of the old one, back-link both ways (`skills/decision-records/SKILL.md:170-176`). For the append-only logs, the equivalent is appending an entry that supersedes and references the old one — "never edit or delete an entry" (`references/accompaniment-and-profile.md:89`).
- **Nothing is ever deleted.** "A wrong-in-hindsight ADR is still true history" (`decision-records/SKILL.md:176`). The same holds for a customization whose skill upstream removed: it survives on disk, is reported as orphaned, and is never silently rehomed (`CUSTOMIZATION-SCHEMA.md:107-111`).

---

## 5. Revalidation

Requirement §8: "Cuando cambien las skills o el proyecto, identifica qué decisiones requieren revisión. Conservar el archivo no demuestra compatibilidad."

**Two triggers, because two things change.**

| Trigger | Detected how | Already exists? |
|---|---|---|
| **The project changed** | Re-scan and compare against the evidence recorded with the decision. `recommendDeferredComponents(plan, scanProject(cwd))` (`scripts/lib/onboarding.js:391-424`) already does exactly this: it compares `sourceFileCount`, new manifest `signals` and new `complexitySignals` against the accepted baseline, and returns the decisions whose `triggerRules` now match | **Yes.** Reuse it |
| **The skill changed** | Compare the version recorded in the customization against the installed catalog. Upstream's four change classes — added, modified, deleted, renamed (`PLAN.md` §4) — each have a different consequence | **Partly.** The comparison needs the field §6 proposes |

**The behavior is fixed by precedent, not chosen here.** `rsc reassess` (`scripts/rsc.js:789` → `runReassessment()` at `:355-375`) reports which decisions the new evidence triggers, prints the command that would produce a new plan, and says "Review a new plan; **nothing has been installed**" (`:368`). Revalidation of brownfield decisions behaves the same way: it reports, it proposes, it never applies. A revalidation that rewrites a customization on its own would be a silent re-decision, which is the thing this whole design exists to prevent.

**The four upstream change classes, and what each does to a decision:**

| Class | Effect on a recorded decision |
|---|---|
| Skill **added** | No existing decision is affected. The new skill enters the next run's B1 inventory |
| Skill **modified** | Every decision recorded against an older version is flagged for review. It is **not** invalidated: a modified skill may not have touched the clause the decision answers |
| Skill **deleted** | The customization **survives on disk** and is reported as **orphaned**, with the skill name and the date it disappeared. Never deleted by install, `sync`, `repair` or update (`CUSTOMIZATION-SCHEMA.md:107-110`) |
| Skill **renamed** | Reported as a **migration requiring a decision**, never applied. There is no stable skill identifier — `origin:` reads `risco` on all 274, verified, so it is authorship, not identity (`CUSTOMIZATION-SCHEMA.md:111`; `CONTRACT.md:147`) |

---

## 6. How an in-force decision resolves a conflict with no question

This is step B6 of [`BROWNFIELD.md`](./BROWNFIELD.md), stated as the test a reviewer can apply.

**All three must hold. Any one failing leaves the conflict open.**

1. **In force**, by §4's table. A `draft` constitution is not in force (`skills/constitution/SKILL.md:89`). A `draft` customization "is read and reported, but does not outrank the skill's original" (`CUSTOMIZATION-SCHEMA.md:29`). A `proposed` ADR has not been accepted.
2. **Covering.** The decision's declared scope contains the conflict's scope (`CONTRACT.md:103-107`). This is why `scope` has no default: "an omitted scope is a validation error, not an implicit 'everywhere'" (`CUSTOMIZATION-SCHEMA.md:31`). In a monorepo an uncovered scope is the common case, not the exception.
3. **Not superseded**, by §4.

**Then precedence decides which in-force decision wins** — the contract's order, unchanged (`CONTRACT.md:113-123`):

```text
1  environment permissions, higher-priority instructions and policies
       └─ a customization cannot disable these. A file that tries IS the finding
2a constitution            ─┐ approved project decisions
2b per-skill customization ─┘ within its declared scope
3  the skill's generic recommendation
```

**Two outcomes that are not "resolved and silent":**

- **2a against 2b.** The constitution wins **and** the conflict is registered as an exception in the customization's `## Exceptions` (`CONTRACT.md:123`). The per-skill file was written by someone who believed it applied; they are the ones who need to know it does not.
- **A customization attempting level 1.** Not a conflict to resolve. The attempt **is** the finding, reported as such (`CUSTOMIZATION-SCHEMA.md:86`).

**What resolving produces.** The conflict's `Status` becomes `resolved-by-decision` and it carries the citation: the file **and** the section it came from. Contract §9 requires it, and a resolution without the citation is indistinguishable from a preference (`CONTRACT.md:162-169`).

**What resolving does not do.** It does not edit code, it does not edit the decision, and it does not edit a stale document to match the code it describes. Where a document and the code disagree, both sides are reported with their locations and neither is "fixed": "silently 'fixing' either side destroys the evidence that they disagreed" (`CONTRACT.md:134-136`).

---

## 7. Two proposed changes to `CUSTOMIZATION-SCHEMA.md`

Proposed as changes, not duplicated into a second schema. Stage 1 owns that file.

**(a) A reviewed-version key**, so §8's "skill y versión o commit revisado" has a slot and §5's skill-changed trigger has something to compare against. The honest granularity available today is `catalog-version`: `.rsc.json` already carries it (`scripts/lib/manifest-file.js:18`), and `install-apply.js:57` tracks a per-skill base version that stores the CLI version. A per-skill **content** digest would be better, and does not exist — `governance-digest` digests the rendered preamble, not the skill body (`CONTRACT.md:36`). Creating one is the transformer's call, which is stage 4.

**(b) A review-condition key**, so §8's "fecha y condiciones de revisión" has a slot and §5's project-changed trigger has a rule to match. The shape already exists upstream: `reevaluateWhen`, a list of conditions on a deferred decision (`scripts/lib/onboarding.js:196-197`), evaluated by `recommendDeferredComponents` (`:391-424`). Reusing the name keeps one vocabulary.

**(c) A third, smaller one, noted because it is a conformance bug rather than a gap.** `02-DOCS/wiki/` is an OKF v0.1 bundle in which every non-reserved `.md` must carry a non-empty `type` (`skills/harness/references/wiki-protocol.md:839-840`); only `index.md` and `log.md` are exempt (`:856-858`). `README.md` is not exempt, and the schema's frontmatter (`CUSTOMIZATION-SCHEMA.md:13-23`) has no `type` key. As written, every customization this procedure produces is a non-conformant file inside a conformant bundle. No validator catches it — there is no OKF checker in `scripts/` — which is why it needs saying rather than assuming someone will notice.

Both (a) and (b) are additive flat keys, which is what the hand-rolled frontmatter parser requires (`CONTRACT.md:26`); (c) is one more.
