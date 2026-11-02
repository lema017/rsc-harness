# Question policy — what counts as material, and what a question must carry

**Status:** draft, stage 3.
**Covers:** requirement §7 step 7 and its three literal constraints: questions **explain consequences**; they **do not repeat clearly documented information**; pending decisions **block the affected actions, not all independent work**.
**Language:** English (D7).
**Measured by:** G5, threshold ≥ 85 %, with **both** failure modes scored — asking when the evidence already answered is a failure in the same way as not asking (`EVALUATION.md` §4, `:66`, `:209`; `ACCEPTANCE.md` criterion 10).

---

## 1. Where this sits

The contract states the minimum and explicitly declines to define a questioning protocol: "The refinement of *how* questions are composed is deliberately **out of scope** for this work, at the user's decision" (`CONTRACT.md` §8). `PLAN.md` §4 lists the same exclusion.

This document stays inside that boundary. It defines **which** ambiguities get asked about and **what each question must carry** — the minimum the contract requires, made applicable. It does not propose a question-refinement method, a tree, a frontier, or any change to `clarify` or `idea-refinement`.

Where upstream already has a discipline, it is reused rather than restated. The triage below is `clarify/SKILL.md#"**Resolve what you already can.**"`'s, verbatim in its three labels.

---

## 2. Materiality — four tests, all of which must pass

§7 says "ambigüedades materiales" and leaves the word undefined. An adjective is not a criterion, so here is the test. **An ambiguity is material only if it passes all four.**

| # | Test | Fails when | Checkable by |
|---|---|---|---|
| **M1** | **Unresolved.** No decision in force answers it, and no document the analysis has read answers it | The constitution, a customization, an ADR, the decision log or the skill's own text already says it | Enumerable: the five sources of `DECISIONS.md` §1, plus the skill body. A question that fails M1 is the noise `CONTRACT.md` §8 names |
| **M2** | **Consequential.** At least one concrete action changes depending on the answer | The two answers produce the same file, same dependency, same structure | Name the action. If you cannot name one, M2 fails |
| **M3** | **Underdetermined.** Deciding would mean guessing, not merely working harder | More evidence inside the project would settle it. **Then gather it** — `CONTRACT.md` §8: "Ask when evidence is insufficient. Not when it is merely incomplete" | Ask: "is there a file I have not read that would answer this?" Yes → not yet material |
| **M4** | **In scope.** It falls inside the scope of the skills this run inventoried | It is a project decision this run has no business raising — the state of the backlog, a hiring question, a roadmap preference | The conflict's `Scope` field against B1's inventory |

**M3 is the one that does the work.** Most apparent ambiguities are incomplete evidence, not insufficient evidence, and the difference is whether another `grep` would settle it. "Does this project use Bloc or Riverpod" is not a question for the user while `apps/mobile/lib/**` is unread. It becomes a question only once the code has been counted and the count is genuinely split, or once the code is clear and no *decision* ratifies it.

**And M1 has a second edge that costs more than it looks.** Absence is a valid, documented state. "Do not ask the user a question whose only subject is the absence" of a customization (`CONTRACT.md` §2), and "La ausencia es válida: no crear archivos vacíos ni preguntar únicamente por esa ausencia" (requirement §5). A missing customization is not an ambiguity; it is an answer.

---

## 3. Triage — the three outcomes, upstream's names

Every candidate ambiguity from B5 lands in exactly one bucket. The labels are `clarify/SKILL.md` §"The pass"'s:

| Bucket | Meaning | Action | Lands as |
|---|---|---|---|
| **resolved-internally** | A source already answers it | **Cite the source.** Showing the work is what stops the same thing being re-litigated next run (`clarify/SKILL.md#"Citing what you read"`) | `resolved-by-decision`, with the citation |
| **inferable** | A safe default exists, matched to what the project already does | **Propose it, do not assume it.** State it as "assumed unless you object", in the shape `clarify/SKILL.md` §"Register" sets | **`open`, with the proposal attached and visible** — see below |
| **must-ask** | Passes M1–M4 | Ask it, per §4 | `pending-decision` |

**Where `inferable` lands, corrected.** An earlier draft sent it to `recorded`. That state does not fit and the state machine says so: `CONFLICT-RECORD.md` §3 reaches `recorded` only from `pending-decision`, by *the user answering*, and defines it as **"Answered and written to its home"**. A proposed inference is neither answered nor written, and `PLAN.md` §4 requires the user's approval before any write — so landing it in `recorded` would have the state machine assert, of a conjecture, exactly the two things that are not true of it.

It lands in **`open`** instead, with the proposal attached. `open` already means *detected, not yet triaged against decisions in force*, and it already permits the skill to be applied with the conflict surfaced, which is what "assumed unless you object" needs. No new state is required, and inventing a `proposed` state would have added a seventh value to a machine whose six this document also had to stop miscounting.

**`inferable` is not a loophole.** The difference between proposing a default and assuming one is that a proposal is visible and reversible. `clarify/SKILL.md#"An assumption is an unrecorded decision"`. And the category matters as much as the state: an inferred default is an `observed pattern`, never an `approved convention`, because nobody approved it — `CUSTOMIZATION-SCHEMA.md` §2: `#"The code does this; nobody approved it"`, `#"Never cite it as a rule"`.

---

## 4. What every question must carry

Four elements. A question missing any of them is incomplete, not merely terse.

1. **The consequence** — one line stating what changes depending on the answer. §7 requires it literally. "Which state management?" is not a question; "Which state management for `apps/mobile` — it decides whether the next 12 screens are written against Bloc or Riverpod, and mixing them is forbidden by the skill" is.
2. **Its own recommendation** — "Carry your own recommendation. A question offered without a proposed answer transfers the work instead of the decision" (`CONTRACT.md` §8; `clarify/SKILL.md#"**Carry your own recommendation**"`). The user confirms or overrides, which is far less effort than authoring from scratch.
3. **Both sides with their locations** — never a resolved side presented as settled. "Never resolve a conflict by choosing a side. Name both sides with their locations and hand the decision back" (`CONTRACT.md` §8).
4. **What it blocks** — which actions wait on the answer, and which do not. §5 below.

**And the register.** The report is read in the register the harness has recorded: `technical_level` in `02-DOCS/wiki/harness/user-profile.md` (`clarify/SKILL.md#"**The harness profile.**"`; `analyze/SKILL.md`, same register rule). The register changes how a question reads, never which questions are asked.

---

## 5. Blocking — affected actions only

§7: "Las decisiones pendientes bloquean las acciones afectadas, no todo el trabajo independiente."

**Only half of "affected" is computable, and this document used to claim both halves were.** `CONFLICT-RECORD.md` §4 defines it as a conjunction:

1. The action's target path is inside the conflict's `Scope` — **a path-prefix test, computable**.
2. The action would commit to one of the conflict's positions — **judgement**. Nothing decides this but a reader.

And condition 1 does no work in the case that matters most. `Scope: repo` is legal, and it is the scope of the skill↔skill conflict in `CONFLICT-RECORD.md` §6: with a repo-wide scope **every** path in the project satisfies condition 1, so the entire blocking decision rests on condition 2's judgement. Calling that "computable" would oversell the one instrument this section has.

**So the blockade is declared, not derived.** Every `pending-decision` conflict **enumerates the actions it blocks**, as a list written when the status is set — `CONFLICT-RECORD.md` §4, and rule 15 of §7 checks the list is there. A validator can confirm a list exists; it cannot confirm the list is right. What the list buys is reviewability in both directions: a reader can say "that is not blocked" as easily as "you missed one", and over-blocking becomes visible instead of being an invisible judgement that quietly halts work. Over-blocking is §7's harder failure mode, and an enumerated list is the only defense against it that leaves a trace.

The consequence is that a brownfield run **never returns "blocked" as a whole** because questions are outstanding. It returns the report, the resolved findings, the proposed customizations for everything settled, and a list of pending decisions each naming its own blast radius. A run that halts everything until all questions are answered has redesigned the harness, not governed it.

```text
3 questions pending, 9 skills inventoried

  Q1  scope apps/mobile/lib/state
      blocks: 1 proposed customization (flutter)
              writing apps/mobile/lib/state/*.dart
  Q2  scope repo, ADR home for a forward choice
      blocks: creating a new numbered ADR file
              appending a forward choice to wiki/harness/decisions.md
      does NOT block: SDD-phase decisions in wiki/sdd/decisions.md,
              per-skill customizations, the run report
  Q3  scope apps/api
      blocks: 1 proposed customization (go)

  proceeding meanwhile: 7 customizations proposed, report written,
  inventory and evidence sheet complete
```

**Q2 above is the interesting case**, and it is real — it is C2 of [`CONFLICT-RECORD.md`](./CONFLICT-RECORD.md). Note how much narrower it is than this document's earlier version, which said Q2 "blocks writing any decision record". It does not. C2 is a disagreement between two skills about where an **ADR-worthy forward choice** is filed; it says nothing about an SDD-phase decision, and nothing about the per-skill customizations, which have their own home and no competing claim on it. Blocking "any decision record" on C2 would be blocking real work on what §6 of `CONFLICT-RECORD.md` shows to be, for most of its old positions, mere **adjacency** — the over-asking failure of §7, committed by the document that names it. The enumerated list is what makes that mistake visible instead of plausible.

---

## 6. Asking — once, ranked, then stop

- **One batch, ranked by leverage.** Not dripped over turns, not thirty at once: "Thirty questions is noise that buries the three that matter" — `clarify/SKILL.md#"Thirty questions is noise that buries the three that matter"`, `#"**One batch, ranked, then stop.**"`.
- **Rank by how much the answer changes.** A question whose two answers lead to two different architectures outranks a cosmetic one (`clarify/SKILL.md#"**Rank by leverage.**"`).
- **Then wait.** "Never ask and answer in the same breath" (`clarify/SKILL.md#"**One batch, ranked, then stop.**"`).
- **Record the outcome of every candidate, including the ones not asked.** `clarify/SKILL.md#"**Declare what you did with each entry.**"` requires a declared outcome per entry, because "an entry you silently dropped is the gap that comes back at implementation time". Here: every B5 candidate appears in the report as resolved-internally with its citation, inferable with its proposal, asked, or deferred with its `reevaluateWhen`.

---

## 7. The two failure modes, and why the second one is the easier to commit

G5 scores both, and the cell passes only if neither fires (`EVALUATION.md` §4).

| Mode | Looks like | Caught by |
|---|---|---|
| **Under-asking** | Picking the likeliest answer and writing it down as fact — which is exactly what the `insufficient evidence` category exists to forbid: `CUSTOMIZATION-SCHEMA.md` §2, `#"Ask. Do not pick the likeliest answer and write it down as fact"` | G5; and partly by the validator, since a decision must carry evidence in one of the four forms of `CONFLICT-RECORD.md` §2.1, so a guess has to either quote something that exists or fail |
| **Over-asking** | Asking what the constitution, an ADR or the skill already answered; asking about an absence; asking before reading; **blocking an action on an adjacency rather than a conflict** | G5 only. **No validator catches it.** The enumerated block list of §5 makes the last of these *visible*, which is not the same as caught |

"Preguntar de más no es seguro: es ruido que entrena al usuario a aceptar sin leer" (`EVALUATION.md` §4). Over-asking is the easier failure because it feels like diligence, and because nothing in the deterministic half of this design can see it: a report with forty well-formed questions passes every schema rule in [`CONFLICT-RECORD.md`](./CONFLICT-RECORD.md) §7. M1 and M3 are the whole defense, and they are model behavior, measured at ≥ 85 % and guaranteed nowhere.

**And the demonstration is in this stage's own history.** `CONFLICT-RECORD.md` §6 documents a `pending-decision` that, as first written, blocked "writing any decision record" on a set of positions most of which were adjacency by its own three-part test. That is over-asking, authored by the documents that define over-asking — which is the most honest available evidence for the claim that M1 and M3 are judgement and that judgement fails quietly.

---

## 8. Greenfield

With no code, M3 inverts: there is no further evidence to gather, so an ambiguity that would be "incomplete" in a brownfield project is genuinely underdetermined here. §7's last paragraph is the instruction — clarify the relevant decisions **without inventing evidence of existing code** — and questions are how a greenfield run does its work.

Three rules hold anyway, and they are what stop a greenfield run from manufacturing a brownfield one:

1. **No question may presuppose code that does not exist.** "Should we keep the existing Bloc setup?" asked of an empty repository is a leading question that invents its own premise.
2. **An answer given in conversation is an `approved convention` the moment the user states it, and never an `observed pattern`.** The three categories that assert existing code — `observed pattern`, `debt`, `migration` — remain unreachable (`BROWNFIELD.md` §3), and rule 13 of `CONFLICT-RECORD.md` §7 enforces it deterministically.
3. **That answer's evidence is form F4, `user-decision, <ISO date>`.** This is new, and it closes a contradiction the earlier draft left open: rule 2 above makes a conversational answer an `approved convention` immediately, while the evidence rule demanded a reference resolving to an existing path — and a decision taken thirty seconds ago has no path. Read literally, **every project-side position in a greenfield run was invalid by construction**, or had to be demoted to `insufficient evidence`, which would deny something the user had just decided. Recording the user's own decision is the only work requirement §7 assigns to greenfield, so a rule that makes it unrecordable defeats the section it belongs to.

**How F4 stays honest** (`CONFLICT-RECORD.md` §2.2 has the rule):

- It carries the **date** and the user's **verbatim words** in the run report. A paraphrase is not F4, because a paraphrase is the analysis's reading of the decision rather than the decision.
- It is **provisional**. Once the decision lands in its home — the customization, the ADR, the constitution amendment — the reference is **upgraded to F2** against that file and section, and rule 4c checks the upgrade happened. F4 is a bridge across the gap between "decided" and "written", not a permanent licence to cite a conversation.
- It can support **only** `approved convention` and `exception`. It can never support `observed pattern`, `debt` or `migration`, because those assert something about code and a conversation is not code. That is rule 13's gate reached from the other side, so the two cannot be played against each other.
