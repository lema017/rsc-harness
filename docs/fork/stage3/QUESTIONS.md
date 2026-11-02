# Question policy — what counts as material, and what a question must carry

**Status:** draft, stage 3.
**Covers:** requirement §7 step 7 and its three literal constraints: questions **explain consequences**; they **do not repeat clearly documented information**; pending decisions **block the affected actions, not all independent work**.
**Language:** English (D7).
**Measured by:** G5, threshold ≥ 85 %, with **both** failure modes scored — asking when the evidence already answered is a failure in the same way as not asking (`EVALUATION.md:63`, `:66`, `:209`; `ACCEPTANCE.md:26`).

---

## 1. Where this sits

The contract states the minimum and explicitly declines to define a questioning protocol: "The refinement of *how* questions are composed is deliberately **out of scope** for this work, at the user's decision" (`CONTRACT.md:158`). `PLAN.md` §4 lists the same exclusion.

This document stays inside that boundary. It defines **which** ambiguities get asked about and **what each question must carry** — the minimum the contract requires, made applicable. It does not propose a question-refinement method, a tree, a frontier, or any change to `clarify` or `idea-refinement`.

Where upstream already has a discipline, it is reused rather than restated. The triage below is `skills/clarify/SKILL.md:79`'s, verbatim in its three labels.

---

## 2. Materiality — four tests, all of which must pass

§7 says "ambigüedades materiales" and leaves the word undefined. An adjective is not a criterion, so here is the test. **An ambiguity is material only if it passes all four.**

| # | Test | Fails when | Checkable by |
|---|---|---|---|
| **M1** | **Unresolved.** No decision in force answers it, and no document the analysis has read answers it | The constitution, a customization, an ADR, the decision log or the skill's own text already says it | Enumerable: the five sources of `DECISIONS.md` §1, plus the skill body. A question that fails M1 is the noise `CONTRACT.md:153` names |
| **M2** | **Consequential.** At least one concrete action changes depending on the answer | The two answers produce the same file, same dependency, same structure | Name the action. If you cannot name one, M2 fails |
| **M3** | **Underdetermined.** Deciding would mean guessing, not merely working harder | More evidence inside the project would settle it. **Then gather it** — `CONTRACT.md:154`: "Ask when evidence is insufficient. Not when it is merely incomplete" | Ask: "is there a file I have not read that would answer this?" Yes → not yet material |
| **M4** | **In scope.** It falls inside the scope of the skills this run inventoried | It is a project decision this run has no business raising — the state of the backlog, a hiring question, a roadmap preference | The conflict's `Scope` field against B1's inventory |

**M3 is the one that does the work.** Most apparent ambiguities are incomplete evidence, not insufficient evidence, and the difference is whether another `grep` would settle it. "Does this project use Bloc or Riverpod" is not a question for the user while `apps/mobile/lib/**` is unread. It becomes a question only once the code has been counted and the count is genuinely split, or once the code is clear and no *decision* ratifies it.

**And M1 has a second edge that costs more than it looks.** Absence is a valid, documented state. "Do not ask the user a question whose only subject is the absence" of a customization (`CONTRACT.md:80`), and "La ausencia es válida: no crear archivos vacíos ni preguntar únicamente por esa ausencia" (requirement §5). A missing customization is not an ambiguity; it is an answer.

---

## 3. Triage — the three outcomes, upstream's names

Every candidate ambiguity from B5 lands in exactly one bucket. The labels are `skills/clarify/SKILL.md:79`'s:

| Bucket | Meaning | Action | Lands as |
|---|---|---|---|
| **resolved-internally** | A source already answers it | **Cite the source.** Showing the work is what stops the same thing being re-litigated next run (`clarify/SKILL.md:28`) | `resolved-by-decision`, with the citation |
| **inferable** | A safe default exists, matched to what the project already does | **Propose it, do not assume it.** State it as "assumed unless you object" (`clarify/SKILL.md:18`) | `recorded`, category `observed pattern`, with the proposal visible |
| **must-ask** | Passes M1–M4 | Ask it, per §4 | `pending-decision` |

**`inferable` is not a loophole.** The difference between proposing a default and assuming one is that a proposal is visible and reversible. "An assumption is an unrecorded decision" (`clarify/SKILL.md:123`). And the category it lands as matters: an inferred default is an `observed pattern`, never an `approved convention`, because nobody approved it (`CUSTOMIZATION-SCHEMA.md:65`).

---

## 4. What every question must carry

Four elements. A question missing any of them is incomplete, not merely terse.

1. **The consequence** — one line stating what changes depending on the answer. §7 requires it literally. "Which state management?" is not a question; "Which state management for `apps/mobile` — it decides whether the next 12 screens are written against Bloc or Riverpod, and mixing them is forbidden by the skill" is.
2. **Its own recommendation** — "Carry your own recommendation. A question offered without a proposed answer transfers the work instead of the decision" (`CONTRACT.md:155`; `clarify/SKILL.md:85`). The user confirms or overrides, which is far less effort than authoring from scratch.
3. **Both sides with their locations** — never a resolved side presented as settled. "Never resolve a conflict by choosing a side. Name both sides with their locations and hand the decision back" (`CONTRACT.md:156`).
4. **What it blocks** — which actions wait on the answer, and which do not. §5 below.

**And the register.** The report is read in the register the harness has recorded: `technical_level` in `02-DOCS/wiki/harness/user-profile.md` (`clarify/SKILL.md:26`; `analyze/SKILL.md:20`). The register changes how a question reads, never which questions are asked.

---

## 5. Blocking — affected actions only

§7: "Las decisiones pendientes bloquean las acciones afectadas, no todo el trabajo independiente." `CONFLICT-RECORD.md` §4 defines affected computably: inside the conflict's `Scope` **and** committing to one of its positions.

The consequence is that a brownfield run **never returns "blocked" as a whole** because questions are outstanding. It returns the report, the resolved findings, the proposed customizations for everything settled, and a list of pending decisions each naming its own blast radius. A run that halts everything until all questions are answered has redesigned the harness, not governed it.

```text
3 questions pending, 9 skills inventoried

  Q1  scope apps/mobile/lib/state  → blocks 1 proposed customization (flutter)
  Q2  scope repo, decision-log home → blocks writing any decision record
  Q3  scope apps/api               → blocks 1 proposed customization (go)

  proceeding meanwhile: 7 customizations proposed, report written,
  inventory and evidence sheet complete
```

**Q2 above is the interesting case**, and it is real — it is C2 of [`CONFLICT-RECORD.md`](./CONFLICT-RECORD.md). A pending question about *where decisions are written* blocks writing decision records, and nothing else. The analysis still runs, the conflicts are still found, the customizations are still proposed; only the act of filing lands in the queue behind the answer.

---

## 6. Asking — once, ranked, then stop

- **One batch, ranked by leverage.** Not dripped over turns, not thirty at once: "Thirty questions is noise that buries the three that matter" (`clarify/SKILL.md:125`; `:87`).
- **Rank by how much the answer changes.** A question whose two answers lead to two different architectures outranks a cosmetic one (`clarify/SKILL.md:81`).
- **Then wait.** "Never ask and answer in the same breath" (`clarify/SKILL.md:87`).
- **Record the outcome of every candidate, including the ones not asked.** `clarify/SKILL.md:43-45` requires a declared outcome per entry, because "an entry you silently dropped is the gap that comes back at implementation time". Here: every B5 candidate appears in the report as resolved-internally with its citation, inferable with its proposal, asked, or deferred with its `reevaluateWhen`.

---

## 7. The two failure modes, and why the second one is the easier to commit

G5 scores both, and the cell passes only if neither fires (`EVALUATION.md:66`).

| Mode | Looks like | Caught by |
|---|---|---|
| **Under-asking** | Picking the likeliest answer and writing it down as fact — which is exactly what the `insufficient evidence` category exists to forbid (`CUSTOMIZATION-SCHEMA.md:69`) | G5; and partly by the validator, since a decision must carry evidence, so a guess has to either cite something or fail |
| **Over-asking** | Asking what the constitution, an ADR or the skill already answered; asking about an absence; asking before reading | G5 only. **No validator catches it** |

"Preguntar de más no es seguro: es ruido que entrena al usuario a aceptar sin leer" (`EVALUATION.md:66`). Over-asking is the easier failure because it feels like diligence, and because nothing in the deterministic half of this design can see it: a report with forty well-formed questions passes every schema rule in [`CONFLICT-RECORD.md`](./CONFLICT-RECORD.md) §7. M1 and M3 are the whole defense, and they are model behavior, measured at ≥ 85 % and guaranteed nowhere.

---

## 8. Greenfield

With no code, M3 inverts: there is no further evidence to gather, so an ambiguity that would be "incomplete" in a brownfield project is genuinely underdetermined here. §7's last paragraph is the instruction — clarify the relevant decisions **without inventing evidence of existing code** — and questions are how a greenfield run does its work.

Two rules hold anyway, and they are what stop a greenfield run from manufacturing a brownfield one:

1. **No question may presuppose code that does not exist.** "Should we keep the existing Bloc setup?" asked of an empty repository is a leading question that invents its own premise.
2. **An answer given in conversation is an `approved convention` the moment the user states it, and never an `observed pattern`.** The three categories that assert existing code — `observed pattern`, `debt`, `migration` — remain unreachable (`BROWNFIELD.md` §3), and rule 13 of `CONFLICT-RECORD.md` §7 enforces it deterministically.
