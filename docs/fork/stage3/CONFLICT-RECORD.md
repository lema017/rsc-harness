# Conflict record — format and worked examples

**Status:** draft, stage 3.
**Covers:** requirement §7, "Cada conflicto debe incluir evidencia, alcance, impacto, confianza, alternativas, recomendación y estado", and the six-category distinction that acceptance criterion 10 makes checkable.
**Language:** English (D7).

---

## 1. The shape, and why it has two layers

§7 names **seven fields** per conflict. Acceptance criterion 10 additionally requires that a finding be distinguishable as approved convention, observed pattern, debt, exception, migration or insufficient evidence — "el artefacto de salida valida contra un esquema que exige una de las **seis** categorías por hallazgo, más su evidencia" (`ACCEPTANCE.md:26`).

Those are not the same axis, and collapsing them produces nonsense. The seven fields describe **the conflict**. The six categories describe **a position within it** — what standing one side has in this project.

The §7 example proves it. "A skill recommends Riverpod and the project uses BLoC" is one conflict, but the instruction is to "determina si BLoC es el estándar vigente, legado o parte de una migración" — three different categories for the *project's* side, with the skill's side untouched. A single category per conflict cannot carry that question, which is the only interesting question in it.

So each record has:

- **Seven required fields**, named exactly as §7 names them, flat, so a validator can check presence without interpreting prose.
- **A positions block**, two or more, each carrying one of the six categories and its own evidence. The `Evidence` field of the conflict is the positions block; it is not a second, parallel account.

The six categories and what each licenses are **not redefined here**. They are `CUSTOMIZATION-SCHEMA.md:60-69`, used as written. This document adds no vocabulary.

---

## 2. Required fields

| Field | Required | What it holds | Checkable how |
|---|---|---|---|
| `Evidence` | yes | The positions block: ≥2 positions, each with a category from the six and ≥1 location | Count positions; category ∈ six; every location resolves to an existing path, and a cited line is within the file's length |
| `Scope` | yes | Where the conflict holds: `repo`, or paths/packages/subprojects. **No default** | Non-empty. Same rule as `CUSTOMIZATION-SCHEMA.md:31` — an omitted scope is an error, never an implicit "everywhere" |
| `Impact` | yes | What breaks, or is built wrong, if this is left unresolved — in terms of an action, not an adjective | Non-empty, and names at least one concrete action or artifact |
| `Confidence` | yes | `high` · `medium` · `low`, plus the one thing that would change it | Value ∈ three; the falsifier sentence present |
| `Alternatives` | yes | ≥2 genuine options. A single foregone option is theatre (`skills/decision-records/SKILL.md:135`) | Count ≥ 2 |
| `Recommendation` | yes | One of the alternatives, named, with one line of why | Names an option that appears in `Alternatives` |
| `Status` | yes | The state machine of §3 | Value ∈ the allowed set |

**`Confidence` carries its falsifier on purpose.** "Confidence: medium" alone is a mood. "Confidence: medium — one `git log` on `lib/legacy/` would settle whether these nine widgets predate the decision or postdate it" is an instruction to whoever reads it next. A confidence without a falsifier is the same guess with a label on it (`CONTRACT.md:171`).

**`Impact` is written as an action, not a severity.** The severity scale is inherited from `skills/analyze/SKILL.md:67-74` and is recorded separately where a report needs triage; it is a ranking, not an impact. "HIGH" does not tell anyone what happens.

---

## 3. Status — the state machine

```text
                    ┌──────────────────────┐
  detected (B5) ───▶│ open                 │
                    └──┬────────┬──────────┘
                       │        │
      a decision in    │        │  no decision covers it
      force covers it  │        │  and it is material (QUESTIONS.md §2)
                       ▼        ▼
         ┌──────────────────┐ ┌──────────────────┐
         │ resolved-by-     │ │ pending-decision │──┐ blocks the affected
         │ decision         │ │                  │  │ actions only (§4)
         └──────────────────┘ └────────┬─────────┘  │
                                       │  user answers
                                       ▼
                              ┌──────────────────┐
                              │ recorded         │ → DECISIONS.md
                              └──────────────────┘

  and two terminal states reachable from `open`:
    not-a-conflict  — the three-part test of BROWNFIELD.md B5 fails; adjacency, not conflict
    deferred        — material but out of this run's scope, with a reevaluateWhen condition
```

| Status | Meaning | May a skill be applied under it? |
|---|---|---|
| `open` | Detected, not yet triaged against decisions in force | Yes, with the conflict surfaced |
| `resolved-by-decision` | B6 settled it with a citation. No question asked | Yes |
| `pending-decision` | Material ambiguity; the user has been asked | **Only for actions this conflict does not touch** — §4 |
| `recorded` | Answered and written to its home | Yes |
| `not-a-conflict` | Failed the B5 test; kept so the next run does not re-raise it | Yes |
| `deferred` | Real, but out of scope for this run; carries `reevaluateWhen` | Yes, with it surfaced |

The two terminal states are not decoration. `not-a-conflict` is what stops a run from re-asking what a previous run already dismissed, and `deferred` reuses upstream's own vocabulary for a decision parked with a trigger (`scripts/lib/onboarding.js:196-197`).

---

## 4. What `pending-decision` blocks

§7 is explicit: "Las decisiones pendientes bloquean las acciones afectadas, no todo el trabajo independiente." The record makes that computable rather than rhetorical.

An action is **affected** by a `pending-decision` conflict when **both**:
1. The action's target path is inside the conflict's `Scope`, and
2. The action would commit to one of the conflict's positions — writing code in that style, adding that dependency, or writing a customization that encodes it.

Everything else proceeds. Reading, analyzing, reporting, and work in any other scope are never blocked by a pending decision, and a procedure that blocks them has redesigned the harness rather than governed it.

```text
Conflict C1: Scope = apps/mobile/lib/state  Status = pending-decision

  blocked : adding a state-management dependency to apps/mobile
  blocked : writing apps/mobile/lib/state/cart_provider.dart
  allowed : fixing a test in apps/api
  allowed : writing 02-DOCS/wiki/skills/go/README.md
  allowed : reporting C1 itself
```

---

## 5. Worked example 1 — the §7 case, with real skill evidence

This is the §7 example, with the **skill side measured from this catalog** and the **project side synthetic**. The project side is a fixture, per D9 ("Las fixtures brownfield serán sintéticas, no copias de proyectos reales"), and is labelled so no reader mistakes it for a measurement.

```markdown
### C1 — State management: skill default (Riverpod) vs project stack (Bloc)

- Scope: apps/mobile
- Status: resolved-by-decision
- Confidence: high — would drop to medium if the project's own decision log
  turned out to post-date the Bloc code rather than precede it
- Impact: every new screen in apps/mobile is written against one of the two.
  Choosing wrong means either rewriting them later or running two state
  systems in one app, which the skill forbids outright.

#### Evidence — positions

| # | Side | Position | Category | Evidence |
|---|---|---|---|---|
| P1 | skill `flutter` | Riverpod 3 with codegen is the opinionated default for shared/async state | n/a — skill side, typed in B4 as a **preference** | `skills/flutter/SKILL.md:12` |
| P2 | skill `flutter` | "Escape hatches are first-class: **Bloc/Cubit** instead of Riverpod when the team already runs Bloc" | n/a — skill side, typed in B4 as the **escape hatch to P1** | `skills/flutter/SKILL.md:14` |
| P3 | skill `flutter` | "Pick one per app, never both" | n/a — skill side, typed in B4 as a **constraint** | `skills/flutter/SKILL.md:14-15`, restated `:243` |
| P4 | project | Bloc is the ratified standard for apps/mobile | **approved convention** | FIXTURE (synthetic, D9): `02-DOCS/wiki/decisions/0004-state-management.md`, Status `accepted`, 2025-03-11 |
| P5 | project | 31 of 34 state classes extend `Bloc`/`Cubit`; 3 use `setState` in `lib/legacy/` | **observed pattern** for the 31; **debt** for the 3 | FIXTURE (synthetic, D9): `apps/mobile/lib/**`, counted |

- Alternatives:
  1. Apply the skill's escape hatch: Bloc is the stack, Riverpod guidance is not applied in apps/mobile.
  2. Migrate apps/mobile to Riverpod to match the skill's default.
  3. Run both, Riverpod for new code and Bloc for old.
- Recommendation: (1). P2 is the skill's own text: the escape hatch exists for
  exactly this case, so applying it is honoring the skill, not overriding it.
  (3) is excluded by P3 — the skill forbids mixing — and would convert a clean
  convention into debt.
- Resolved by: P4, an accepted decision whose scope covers apps/mobile and
  which has not been superseded. No question asked (BROWNFIELD.md B6).
```

**What this example is for.** Three things, each of which a reviewer can check against the cited lines:

1. **This is not an exception and not a migration.** Riverpod is typed in B4 as a **preference** with a declared escape hatch at `skills/flutter/SKILL.md:14`. A preference that loses to the project costs nothing — no exception is registered, because no requirement was waived. Recording it as a migration would contradict the skill's own sentence, which is exactly the harm §7 names: "No impongas una migración por preferencia de la skill."
2. **Two categories on one side.** P5 is split because 31 files and 3 files are not the same finding. The 31 are an `observed pattern` — the code does this and, separately, P4 ratifies it. The 3 are `debt`: known-wrong, tolerated, "do not propagate, do not fix unasked" (`CUSTOMIZATION-SCHEMA.md:66`). Merging them into one row would license refactoring the three, which nobody approved.
3. **Where the real conflict would be.** If the project ran Riverpod *and* Bloc together, P3 — a **constraint**, not a preference — would be violated, the project side would be `debt` rather than `approved convention`, and the recommendation would invert. Same two libraries, same skill, opposite outcome, decided entirely by the B4 typing.

**Had P4 not existed**, the status would be `pending-decision`, not a quiet choice: an `observed pattern` with 31 instances is still unratified and "never cite it as a rule" (`CUSTOMIZATION-SCHEMA.md:65`). The question is in [`QUESTIONS.md`](./QUESTIONS.md) §5.

---

## 6. Worked example 2 — a conflict between two skills, no stack involved

This one is **fully measured**; every line below is in this repository at the cited location. It is a disagreement between four installed skills about where a decision is written — which is to say, about this stage's own deliverable.

```markdown
### C2 — Three canonical homes for a project decision, across four skills

- Scope: repo (any project that installs more than one of the four)
- Status: pending-decision
- Confidence: high — all four texts are present and quoted; what is unknown is
  only which the project already uses, which one `ls 02-DOCS/wiki/` settles
- Impact: a brownfield decision written to the wrong home is invisible to the
  skill that later looks for it, and `decision-records` calls a second log the
  thing you must never create. Every decision this stage records lands here.

#### Evidence — positions

| # | Side | Position | Category | Evidence |
|---|---|---|---|---|
| P1 | skill `decision-records` | Harness workspace home is `02-DOCS/wiki/decisions/`, one numbered file per ADR, indexed in `02-DOCS/wiki/index.md` | **approved convention** of that skill | `skills/decision-records/SKILL.md:43`, naming rule `:38`, index rule `:51` |
| P2 | skill `decision-records` | "The project's existing convention — never invent a parallel log" is **first match** in the same list | **approved convention**, and it outranks P1 by its own ordering | `skills/decision-records/SKILL.md:40-41` |
| P3 | skill `continuous-learning` | A forward choice routes to `02-DOCS/wiki/harness/decisions.md`, written by `decision-records` | **approved convention** of that skill | `skills/continuous-learning/SKILL.md:52`, detail `references/lesson-routing.md:64` |
| P4 | skills `plan`, `implement`, `review`, `parallel`, `constitution` | SDD-phase decisions append to `02-DOCS/wiki/sdd/decisions.md` | **approved convention** of the SDD chain | `skills/plan/SKILL.md:82`, `skills/implement/SKILL.md:272`, `skills/review/SKILL.md:285`, `skills/parallel/SKILL.md:119`, `skills/constitution/SKILL.md:76` |
| P5 | skill `init` | `02-DOCS/wiki/harness/decisions.md` is the append-only log, and a shipped script warns when it is missing | **approved convention**, and the only one with code behind it | `skills/init/SKILL.md:46`, format `references/accompaniment-and-profile.md:87-108`, check `scripts/verify.sh:62,87` |

- Alternatives:
  1. Follow P2 — read what the project already has, use that, ask only if nothing exists.
  2. Pick one home for brownfield decisions and always use it.
  3. Write to all three so nothing is missed.
- Recommendation: (1). It is not a preference of this stage; it is the rule
  `decision-records` states first, and it is the only option that cannot create
  the parallel log that same skill forbids: "never spawn a competing second log" (`SKILL.md:31`).
  (3) creates three sources of truth for one decision and is excluded.
- Pending because: option (1) needs one fact this analysis cannot have in
  advance — which log the project already keeps. Resolved per-project in B6,
  not in this document.
```

**Why a stack conflict would not have exposed this.** All five positions are `approved convention`; none is debt, none is drift, and every one of them is correct inside its own skill. The conflict exists only because the skills are installed together — which makes it exactly the class §7 means by "conflictos … entre skills", and exactly the class `analyze` cannot see, because no skill is one of its four artifacts (`skills/analyze/SKILL.md:28-33`).

**Note the asymmetry in the evidence.** P5 is the only position with a script behind it (`skills/init/scripts/verify.sh:62,87`), and even that is a `warn`, not a failure. That asymmetry is a fact worth recording and not worth promoting into a resolution: a warning is a nudge, and treating it as a verdict would be this procedure deciding by whichever file happened to ship code.

---

## 7. Validation rules — the deterministic half

A validator checks, with no model involved. These extend `CUSTOMIZATION-SCHEMA.md:79-87`; they do not replace it.

1. All seven fields present and non-empty.
2. `Evidence` contains ≥2 positions.
3. Every position carries exactly one category from the six, or the explicit `n/a — skill side` form with its B4 type.
4. Every position carries ≥1 evidence reference; every reference resolves to an existing path, and any cited line number is within that file's length.
5. `Scope` non-empty.
6. `Confidence` ∈ {`high`,`medium`,`low`} **and** carries a falsifier clause.
7. `Alternatives` lists ≥2.
8. `Recommendation` names one of the listed alternatives verbatim.
9. `Status` ∈ the seven values of §3.
10. A `resolved-by-decision` record cites the deciding file **and** section.
11. A position categorized `migration` states a current state, a target state, and that it requires a decision (`CUSTOMIZATION-SCHEMA.md:85`).
12. No position asserts that an environment permission, guard or safety rule may be disabled; such a record **is itself the finding** (`CUSTOMIZATION-SCHEMA.md:86`).
13. **Greenfield gate:** where the project has no source files and no manifests, no position may carry `observed pattern`, `debt` or `migration` (`BROWNFIELD.md` §3).
14. A position marked `FIXTURE` is never counted as project evidence by any downstream step.

**And the boundary.** Every rule above checks that a record is *well formed*. None of them can check that the record is *right*, that the category chosen is the correct one, or that a conflict which exists was detected at all. A run that finds nothing produces zero records and passes all fourteen rules. That failure mode is invisible to this validator by construction, and `BROWNFIELD.md` §5 says so rather than letting the rule count imply otherwise.
