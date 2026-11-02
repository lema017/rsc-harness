# Conflict record — format and worked examples

**Status:** draft, stage 3.
**Covers:** requirement §7, "Cada conflicto debe incluir evidencia, alcance, impacto, confianza, alternativas, recomendación y estado", and the six-category distinction that acceptance criterion 10 makes checkable.
**Language:** English (D7).

---

## 1. The shape, and why it has two layers

§7 names **seven fields** per conflict. Acceptance criterion 10 additionally requires that a finding be distinguishable as approved convention, observed pattern, debt, exception, migration or insufficient evidence — "el artefacto de salida valida contra un esquema que exige una de las **seis** categorías por hallazgo, más su evidencia" (`ACCEPTANCE.md` criterion 10).

Those are not the same axis, and collapsing them produces nonsense. The seven fields describe **the conflict**. The six categories describe **a position within it** — what standing one side has in this project.

The §7 example proves it. "A skill recommends Riverpod and the project uses BLoC" is one conflict, but the instruction is to "determina si BLoC es el estándar vigente, legado o parte de una migración" — three different categories for the *project's* side, with the skill's side untouched. A single category per conflict cannot carry that question, which is the only interesting question in it.

So each record has:

- **Seven required fields**, named exactly as §7 names them, flat, so a validator can check presence without interpreting prose.
- **A positions block**, two or more, each carrying one of the six categories and its own evidence. The `Evidence` field of the conflict is the positions block; it is not a second, parallel account.

The six categories and what each licenses are **not redefined here**. They are the table in `CUSTOMIZATION-SCHEMA.md` §2 under `#"The six categories, and what each one licenses"`, used as written. This document adds no vocabulary.

---

## 2. Required fields

| Field | Required | What it holds | Checkable how |
|---|---|---|---|
| `Evidence` | yes | The positions block: ≥2 positions, each with a category from the six and ≥1 reference in one of the four forms of §2.1 | Count positions; category ∈ six; every reference validates per §2.1 — a quoted fragment must still be **in** the file, not merely a line number that still resolves |
| `Scope` | yes | Where the conflict holds: `repo`, or paths/packages/subprojects. **No default** | Non-empty. Same rule as `CUSTOMIZATION-SCHEMA.md` §1, `scope` row: "an omitted scope is a validation error, not an implicit 'everywhere'" |
| `Impact` | yes | What breaks, or is built wrong, if this is left unresolved — in terms of an action, not an adjective | Non-empty, and names at least one concrete action or artifact |
| `Confidence` | yes | `high` · `medium` · `low`, plus the one thing that would change it | Value ∈ three; the falsifier sentence present |
| `Alternatives` | yes | ≥2 genuine options — `decision-records/SKILL.md#"A single foregone \"option\" is theatre"` | Count ≥ 2 |
| `Recommendation` | yes | One of the alternatives, named, with one line of why | Names an option that appears in `Alternatives` |
| `Status` | yes | The state machine of §3 | Value ∈ the allowed set |

**`Confidence` carries its falsifier on purpose.** "Confidence: medium" alone is a mood. "Confidence: medium — one `git log` on `lib/legacy/` would settle whether these nine widgets predate the decision or postdate it" is an instruction to whoever reads it next. A confidence without a falsifier is the same guess with a label on it (`CONTRACT.md` §9).

**`Impact` is written as an action, not a severity.** The severity scale is inherited from `analyze/SKILL.md` §"Severity scale" and is recorded separately where a report needs triage; it is a ranking, not an impact. "HIGH" does not tell anyone what happens.

---

## 2.1 Evidence references — the four admissible forms, and why a bare line number is not one

This subsection exists because the first draft of this document got it wrong, in the way that matters most: it required only that a cited **line still exist**. Under that rule a citation that has drifted onto a different line still passes, silently, and the record reads as evidence while pointing at something else. An instrument that cannot catch the error its own author made is not an instrument.

Two measured facts force the design.

**Fact 1 — the installed copy is not the catalog copy, and the line numbers differ by a known constant.** In a consumer project `skills/` **does not exist**. The only copy any assistant reads is `.rsc/skills/<id>/SKILL.md` (`targets/index.js#"export function baseDir"`), and that copy is the catalog file *after* the governance transformation. Measured by running `transformSkillMd` (`scripts/lib/governance.js#"export function transformSkillMd"`) over two skills in this repository:

```text
skill              catalog lines   installed lines   delta
flutter                      401               414     +13
decision-records             203               216     +13

flutter, per cited line:   12 → 25    14 → 27    243 → 256    396 → 409
```

The transformation inserts the governance preamble **ahead of the body**, so **every** line of the body moves. A citation written against `skills/flutter/SKILL.md:243` names a real line in a file the consumer does not have, and names the **wrong** line in the file the consumer does have. This is not a transcription slip; it is a structural property of Strategy B, and any document in this fork that cites a skill by line inherits it.

**Fact 2 — the governance documents move under a citation anyway.** Stage 1 rewrote `CUSTOMIZATION-SCHEMA.md` after this stage closed. Every line citation in these five documents was then re-run against the files on disk, one by one:

```text
target document            line citations   still correct
CONTRACT.md                            31              31
EVALUATION.md                           4               4
ARCHITECTURE.md                         2               2
ACCEPTANCE.md                           1               1
CUSTOMIZATION-SCHEMA.md                36               1
```

One of thirty-six survived, and it survived by coincidence: `scope` happened to stay on the same line while the rows above it were rewritten. Several of the other thirty-five had drifted onto lines that *look* plausible — a neighbouring table row, a blank line inside the right table, a section heading one above the row meant. That is precisely the failure a line-existence check cannot see.

**And the 31-of-31 column is not evidence that line citations work.** Those citations survived because nobody edited `CONTRACT.md` after this stage closed. Had stage 1 inserted three lines into its precedence table the way it inserted three keys into the schema's frontmatter table, that column would read 31 of 31 wrong. The difference between the two rows is which file happened to be touched, which is not a property a citation style should depend on.

### The four forms

| Form | Written as | What the validator checks |
|---|---|---|
| **F1 — anchored quotation** | `` `<path>#"<verbatim fragment>"` ``, optionally `` `<path>:<line>#"<verbatim fragment>"` `` | The path resolves **and** the fragment occurs verbatim in the file. If a line hint is given, the fragment must occur **on that line**; otherwise the check fails and the error names the line where the fragment actually is |
| **F2 — section anchor** | `` `<path>#<heading text>` `` or `` `<path>` §<n> `` | The path resolves and a heading matching it exists. Preferred for every reference into `docs/fork/stage1/` and into a skill's prose |
| **F3 — counted population** | A path or glob, plus population, count and selection method — never a line | The three are present (the representative-sample rule of `BROWNFIELD.md` B2). `"31 of 34 providers"`, never `"mostly Riverpod"` |
| **F4 — `user-decision, <ISO date>`** | `evidence: user-decision, 2026-11-01` | The form parses, **and** the run report carries the user's own words. See §2.2 |

**A bare `<path>:<line>` is not an admissible form.** It is accepted only inside F1, as a hint subordinate to the fragment. The ordering matters: the fragment is the evidence and the line is a convenience, so when they disagree the fragment wins and the line is reported as stale. That makes drift **loud and self-locating** instead of silent.

**Skill evidence anchors at the installed path.** A position citing a skill writes `.rsc/skills/<id>/SKILL.md`, because that is the file the consumer has. It uses F1 or F2, never a bare line, because of Fact 1 — and a reviewer working in this fork's own checkout can confirm the same fragment in `skills/<id>/SKILL.md`, where it sits 13 lines earlier.

**Cost.** F1 is a substring search over one file; F2 is a heading scan. Both are cheaper than reading the file the old rule already had to open to count its lines.

## 2.2 Evidence for a decision taken in conversation

A greenfield run has a problem the first draft did not notice. `QUESTIONS.md` §8 makes an answer the user states in conversation an `approved convention` **the moment they state it**, and recording that decision is the only work requirement §7 assigns to greenfield. But a decision just taken has no file, so under a rule that demands a path it is unevidenced — which would make every project-side position in a greenfield run invalid by construction, or demote to `insufficient evidence` something the user has just decided. Both outcomes are wrong, and the second is the worse of the two because it looks like rigour.

Hence **F4**, admissible for exactly this case and bounded three ways:

1. It carries the **date** and the user's **own words**, quoted verbatim in the run report. A paraphrase is not F4.
2. It is **provisional**. The moment the decision lands in its home — the customization, the ADR, the constitution amendment — the reference is **upgraded to F2** against that file and section. Rule 4c of §7 enforces the upgrade.
3. It is never a substitute for code evidence. F4 licenses `approved convention` and `exception` only; it can never support `observed pattern`, `debt` or `migration`, because those assert something about code and a conversation is not code. That is the same gate as rule 13, reached from the other side.

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
| `open` | Detected, not yet triaged against decisions in force. **Also where an `inferable` candidate lands**, carrying its proposed default visibly — `QUESTIONS.md` §3 | Yes, with the conflict surfaced |
| `resolved-by-decision` | B6 settled it with a citation. No question asked | Yes |
| `pending-decision` | Material ambiguity; the user has been asked | **Only for actions this conflict does not touch** — §4 |
| `recorded` | Answered and written to its home | Yes |
| `not-a-conflict` | Failed the B5 test; kept so the next run does not re-raise it | Yes |
| `deferred` | Real, but out of scope for this run; carries `reevaluateWhen` | Yes, with it surfaced |

The two terminal states are not decoration. `not-a-conflict` is what stops a run from re-asking what a previous run already dismissed, and `deferred` reuses upstream's own vocabulary for a decision parked with a trigger (`scripts/lib/onboarding.js#"reevaluateWhen"`).

---

## 4. What `pending-decision` blocks

§7 is explicit: "Las decisiones pendientes bloquean las acciones afectadas, no todo el trabajo independiente." The record makes that **partly** computable — and the honest statement of which part is which is the whole value of this section.

An action is **affected** by a `pending-decision` conflict when **both**:
1. The action's target path is inside the conflict's `Scope` — **computable**, a path-prefix test.
2. The action would commit to one of the conflict's positions — writing code in that style, adding that dependency, or writing a customization that encodes it. **This is judgement, not computation.** No validator can decide whether an edit commits to a position.

**So condition 1 alone does not bound anything, and with `Scope: repo` it is vacuous.** `Scope: repo` is legal, and the skill↔skill conflict in §6 has exactly that scope: a repo-wide conflict makes every path in the project satisfy condition 1, leaving the entire blocking decision to condition 2's judgement. A document that called this "computable" without saying so would be overselling the instrument in the section whose job is to bound it.

**Therefore every `pending-decision` conflict must enumerate its blocked actions**, as a list, written when the status is set — not derived later by whoever reads the record. Rule 15 of §7 enforces the presence of the list. The list is what makes the blockade reviewable: a reader can disagree with an entry, which they cannot do with an inference nobody wrote down. It also makes over-blocking visible, which is the failure mode that turns a governed analysis into a halted one.

Everything not on the list proceeds. Reading, analyzing, reporting, and work in any other scope are never blocked by a pending decision, and a procedure that blocks them has redesigned the harness rather than governed it.

```text
Conflict C1: Scope = apps/mobile/lib/state  Status = pending-decision

  Blocks (enumerated, not inferred):
    - adding a state-management dependency to apps/mobile
    - writing apps/mobile/lib/state/*.dart
    - writing 02-DOCS/wiki/skills/flutter/README.md

  Everything else proceeds, including:
    - fixing a test in apps/api
    - writing 02-DOCS/wiki/skills/go/README.md
    - reporting C1 itself
```

**And the limit on the enumeration itself.** The list bounds what *this analysis* will refrain from doing. It cannot bind the model's later behavior: skill application is not an observable event (F32; `CONTRACT.md` §12), so there is no point at which a guard could refuse a blocked action. The list is a declared intention measured by G5, not an enforced one — `BROWNFIELD.md` §5 keeps the two apart.

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

| # | Side | Position | Category | Evidence (form per §2.1) |
|---|---|---|---|---|
| P1 | skill `flutter` | Riverpod 3 with codegen is the opinionated default for shared/async state | n/a — skill side, typed in B4 as a **preference** | F1 · `.rsc/skills/flutter/SKILL.md#"**Riverpod 3** with codegen for shared/async state"` |
| P2 | skill `flutter` | Bloc/Cubit is a first-class escape hatch when the team already runs Bloc | n/a — skill side, typed in B4 as the **escape hatch to P1** | F1 · `.rsc/skills/flutter/SKILL.md#"Escape hatches are first-class: **Bloc/Cubit** instead of Riverpod when the team already runs Bloc"` |
| P3 | skill `flutter` | One state library per app; mixing two is forbidden | n/a — skill side, typed in B4 as a **constraint** | F1 · `.rsc/skills/flutter/SKILL.md#"**pick one of each per app, never mix two**"`, restated as `#"**Pick one per app, never both.**"` |
| P4 | project | Bloc is the ratified standard for apps/mobile | **approved convention** | FIXTURE (synthetic, D9): F2 · `02-DOCS/wiki/decisions/0004-state-management.md` §Decision Outcome, Status `accepted`, 2025-03-11 |
| P5 | project | 31 of 34 state classes extend `Bloc`/`Cubit`; 3 use `setState` in `lib/legacy/` | **observed pattern** for the 31; **debt** for the 3 | FIXTURE (synthetic, D9): F3 · population `apps/mobile/lib/**/*.dart`, 34 state classes, counted by exhaustive grep |

**Read P3 against the first draft of this table, because the difference is the point of §2.1.** The draft wrote P3 as `` `skills/flutter/SKILL.md:14-15`, restated `:243` `` while quoting "Pick one per app, never both". Checked: the quoted sentence is **not** at `:14-15`. Line 15 says something adjacent in different words — "pick one of each per app, never mix two" — and the quoted sentence is at `:243` only. The old rule 4 passed that citation, because lines 14, 15 and 243 all exist. The new rule fails it and names the line where the fragment actually is. Same evidence, same file, opposite verdict — and the verdict that catches the error is the one this stage shipped without.

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

1. **This is not an exception and not a migration.** Riverpod is typed in B4 as a **preference** with a declared escape hatch, P2's own sentence. A preference that loses to the project costs nothing — no exception is registered, because no requirement was waived. Recording it as a migration would contradict the skill's own sentence, which is exactly the harm §7 names: "No impongas una migración por preferencia de la skill."
2. **Two categories on one side.** P5 is split because 31 files and 3 files are not the same finding. The 31 are an `observed pattern` — the code does this and, separately, P4 ratifies it. The 3 are `debt`: known-wrong, tolerated — `CUSTOMIZATION-SCHEMA.md` §2 `#"Do not propagate it. Do not fix it unasked either"`. Merging them into one row would license refactoring the three, which nobody approved.
3. **Where the real conflict would be.** If the project ran Riverpod *and* Bloc together, P3 — a **constraint**, not a preference — would be violated, the project side would be `debt` rather than `approved convention`, and the recommendation would invert. Same two libraries, same skill, opposite outcome, decided entirely by the B4 typing.

**Had P4 not existed**, the status would be `pending-decision`, not a quiet choice: an `observed pattern` with 31 instances is still unratified — `CUSTOMIZATION-SCHEMA.md` §2 `#"Never cite it as a rule"`. The question is in [`QUESTIONS.md`](./QUESTIONS.md) §5.

---

## 6. Worked example 2 — a conflict between two skills, no stack involved

This one is **fully measured**; every fragment quoted below is in this repository. It is narrow on purpose, and the narrowing is itself the lesson: the first draft of C2 listed five positions across eight skills and called the lot a conflict. Re-tested against §5's own three-part rule, most of them are **adjacency** — and §5 says adjacency is not reported.

**What the draft got wrong, stated before the corrected record so the record is not read as the original.** The draft's P4 (SDD-phase decisions → `02-DOCS/wiki/sdd/decisions.md`) and P5 (the harness append log → `02-DOCS/wiki/harness/decisions.md`) answer *different questions* from P1: what to do with a decision taken mid-build, and where the running harness log lives, versus where an ADR-worthy forward choice is filed. They fail part 2 of the test, same decision subject, and part 3, not jointly satisfiable — and the proof is inside this stage: `DECISIONS.md` §2 routes all of those finding types to all of those homes **simultaneously, without contradiction**. A table that works is not a conflict. The draft also said "four installed skills" while naming eight.

That mattered more than a miscount, because C2 is the `pending-decision` that `QUESTIONS.md` §5 uses to block "writing any decision record". Blocking a real action on an adjacency is the over-asking failure `QUESTIONS.md` §7 calls the easier of the two to commit, committed by the document that defines it.

```markdown
### C2 — Where an ADR-worthy forward choice is filed: two skills, two homes

- Scope: repo — any project that installs both `decision-records` and
  `continuous-learning`, and takes a forward choice worth an ADR
- Status: pending-decision
- Blocks (enumerated, per §4):
    - creating a new numbered ADR file for a choice this run surfaced
    - appending a forward choice to 02-DOCS/wiki/harness/decisions.md
  Not blocked: writing per-skill customizations, the run report, the
  inventory and evidence sheets, or recording an SDD-phase decision in
  02-DOCS/wiki/sdd/decisions.md, which no position here disputes.
- Confidence: high — both texts are present and quoted; what is unknown is
  only which log the project already keeps, which one `ls 02-DOCS/wiki/` settles
- Impact: one ADR-worthy choice filed in the home the other skill does not
  read is invisible to it, and writing it to both creates the parallel log
  `decision-records` forbids outright.

#### Evidence — positions

| # | Side | Position | Category | Evidence (form per §2.1) |
|---|---|---|---|---|
| P1 | skill `decision-records` | Home is chosen by **first match**: the project's existing convention, else `docs/adr/` (or `doc/adr/`) for a code repo with no convention, else `02-DOCS/wiki/decisions/` for a harness workspace | **approved convention** of that skill | F2 · `.rsc/skills/decision-records/SKILL.md` §"Decide home + naming once", F1 · `#"**Where to store** (first match wins):"` |
| P2 | skill `continuous-learning` | A forward choice surfacing mid-retro is filed at `02-DOCS/wiki/harness/decisions.md`, written by `decision-records` | **approved convention** of that skill | F1 · `.rsc/skills/continuous-learning/references/lesson-routing.md#"**Home:** \`02-DOCS/wiki/harness/decisions.md\` as a decision record."` under §"A forward choice that surfaced mid-retro" |

- Alternatives:
  1. Follow P1's first match — read what the project already has, use that,
     ask only if nothing exists. P2 then applies only where the project has
     no convention and is a harness workspace rather than a code repo.
  2. Pick one home for brownfield decisions and always use it.
  3. Write to both so nothing is missed.
- Recommendation: (1). It is not a preference of this stage; it is the rule
  `decision-records` states first, and it is the only option that cannot
  create the parallel log that same skill forbids:
  `decision-records/SKILL.md#"never spawn a competing second log"`.
  (3) creates two sources of truth for one decision and is excluded.
- Pending because: option (1) needs one fact this analysis cannot have in
  advance — which log the project already keeps. Resolved per-project in B6,
  not in this document.
```

**The third branch the draft dropped, and why it is the central case.** `decision-records`' list has **three** branches, not two. Branch 2 is `docs/adr/` (also `doc/adr/`) for *a code repo with no convention* — which is the brownfield case this entire stage is about. A table of homes that skips it would send every such project to `02-DOCS/wiki/decisions/`, a harness-workspace path, in a repo that is not a harness workspace. It is restored here, in `DECISIONS.md` §1 and §2, and in P1 above.

**Why a stack conflict would not have exposed this.** Both positions are `approved convention`; neither is debt, neither is drift, and each is correct inside its own skill. The conflict exists only because the skills are installed together — which makes it exactly the class §7 means by "conflictos … entre skills", and exactly the class `analyze` cannot see, because no skill is one of its four artifacts (`analyze/SKILL.md` §"Inputs — locate the four artifacts").

**The adjacent positions, kept as context and not as conflict.** Recorded here because dropping them entirely would lose a real fact about the catalog, and recording them as positions would restate the draft's error:

- `plan`, `implement`, `review`, `parallel` and `constitution` append SDD-phase decisions to `02-DOCS/wiki/sdd/decisions.md`. Different subject: a decision taken while building, not an ADR-worthy forward choice.
- `init` treats `02-DOCS/wiki/harness/decisions.md` as the append-only harness log, and ships the only check anywhere near this question — `skills/init/scripts/verify.sh#"no decisions log at 02-DOCS/wiki/harness/decisions.md"`, which is a `warn`, not a failure. Worth recording and not worth promoting into a resolution: a warning is a nudge, and treating it as a verdict would be this procedure deciding by whichever file happened to ship code.

---

## 7. Validation rules — the deterministic half

A validator checks, with no model involved. These extend the rule list in `CUSTOMIZATION-SCHEMA.md` §3; they do not replace it.

1. All seven fields present and non-empty.
2. `Evidence` contains ≥2 positions.
3. Every position carries exactly one category from the six, or the explicit `n/a — skill side` form with its B4 type.
4. Every position carries ≥1 evidence reference, and **every reference is in one of the four forms of §2.1**:
   - **4a.** F1 — the path resolves **and** the quoted fragment occurs verbatim in the file. Where a line hint is given, the fragment must occur **on that line**; otherwise the rule fails and the error reports the line the fragment is actually on.
   - **4b.** F2 — the path resolves and a heading matching the anchor exists. F3 — population, count and method all present. F4 — the form parses and the run report carries the user's verbatim words.
   - **4c.** No reference is a bare `path:line`. An F4 reference whose decision has since landed in a file must have been upgraded to F2 against that file and section.
   - **4d.** A reference into a skill resolves under `.rsc/skills/<id>/`, not `skills/<id>/`: in a consumer project the latter does not exist, and the governance transformation shifts the body by a measured 13 lines, so a line taken from the catalog names the wrong line in the installed copy.
5. `Scope` non-empty.
6. `Confidence` ∈ {`high`,`medium`,`low`} **and** carries a falsifier clause.
7. `Alternatives` lists ≥2.
8. `Recommendation` names one of the listed alternatives verbatim.
9. `Status` ∈ the **six** values of §3: `open`, `resolved-by-decision`, `pending-decision`, `recorded`, `not-a-conflict`, `deferred`.
10. A `resolved-by-decision` record cites the deciding file **and** section — form F2, never a line.
11. A position categorized `migration` states a current state, a target state, and that it requires a decision (`CUSTOMIZATION-SCHEMA.md` §3 rule 7).
12. No position asserts that an environment permission, guard or safety rule may be disabled; such a record **is itself the finding** (`CUSTOMIZATION-SCHEMA.md` §3 rule 8).
13. **Greenfield gate:** where the project has no source files and no manifests, no position may carry `observed pattern`, `debt` or `migration` (`BROWNFIELD.md` §3). An F4 reference can never support those three categories either, from the other direction.
14. A position marked `FIXTURE` is never counted as project evidence by any downstream step.
15. A `pending-decision` conflict carries a **non-empty enumerated list of blocked actions** (§4). The list is checkable for presence; whether it is the right list is not.
16. **Skill↔skill coverage floor** (the one rule that checks *recall* rather than form): the run's inventory must contain **every** skill pair whose description cosine similarity is at or above the declared threshold, plus every `recommends:` edge and every `NOT`-clause naming among the selected skills. A missing pair is a deterministic failure. See `BROWNFIELD.md` B1.

**And the boundary — narrower than it was, and still wide.** Rules 1–15 check that a record is *well formed*. None of them can check that the record is *right*, or that the category chosen is the correct one. Rule 16 is the single exception: it checks one axis of **recall**, and it checks it completely, because the candidate set is computable from the catalog with no model and no agent run.

What rule 16 does **not** cover is the larger half. It bounds skill↔skill pairs that collide *in their descriptions*; it says nothing about two skills that conflict in their bodies while describing themselves differently, and nothing at all about **project↔skill** recall, which depends on reading the project. A run that finds no project↔skill conflict still produces zero records there and still passes every rule. That remains invisible to this validator by construction, and `BROWNFIELD.md` §5 and `DESIGN.md` §5 state it rather than letting the rule count imply otherwise.
