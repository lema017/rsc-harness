# Brownfield compatibility analysis — the procedure

**Status:** draft, stage 3. Specification only; no code written by this stage.
**Covers:** requirements §7 (brownfield compatibility) and the §8 fields a finding must carry forward.
**Language:** English, because it ships to consumers (D7).
**Acceptance criterion:** 10. Its deterministic half is the output schema; its model half is behavior G5. Both are bounded in §10 below.

---

## 0. What this is, and what it is not

This procedure runs **in the consumer project**, over that project's code and its own customizations. It is the second of the two machines `ARCHITECTURE.md` §0 separates: it never writes to the fork's catalog, and the fork's upstream-maintenance machine never runs it.

It is **not** `analyze`. The distinction is load-bearing enough to state as a table, because the two look alike and own different failures:

| | `skills/analyze/SKILL.md` | This procedure |
|---|---|---|
| Reads | Four SDD documents against each other (`analyze/SKILL.md:28-33`) | Skills against the project's code, config, deps, tests and docs |
| Opens code? | **Never** — "never open a code file to 'just fix it'" (`analyze/SKILL.md:16`) | Yes; representative samples are its primary evidence |
| When | Sixth SDD phase, pre-implementation gate (`analyze/SKILL.md:14`) | After install, or on demand, before a skill's configuration is called ready |
| Writes | One report, overwritten per run (`analyze/SKILL.md:85`) | One report **plus** proposed per-skill customizations, each approved before it lands |
| Decisions | Logs none — "analyze decides nothing" (`analyze/SKILL.md:87`) | Records them, per [`DECISIONS.md`](./DECISIONS.md) |
| Unit of finding | Severity + two artifacts + locations (`analyze/SKILL.md:82`) | Seven fields + a category per position, per [`CONFLICT-RECORD.md`](./CONFLICT-RECORD.md) |

**They coexist without overlapping.** `analyze` checks a project's documents for internal consistency; this procedure checks the *skills* against the project's reality. A project can pass `analyze` with four perfectly consistent documents and still have a skill recommending a state-management library it abandoned two years ago. Nothing in `analyze` would notice, because the skill is not one of its four inputs.

**What is reused from `analyze` deliberately:** its absolute rule ("Report only. Resolve nothing", `:16`), its severity scale (`:67-74`), its coverage-map idea (`:49-65`) in the form of B1's inventory table, and its `result-envelope` block (`:104-118`) so the same dispatcher can chain this step.

---

## 1. Invocation and where the procedure lives

| | Decision | Why |
|---|---|---|
| **Shipped form** | A package-owned document regenerated at `.rsc/governance/brownfield-v1.md` on install, beside `.rsc/governance/v1.md` (`CONTRACT.md:16`) | It needs no new skill. Strategy B freezes `skills/` byte-identical (`ARCHITECTURE.md:24`), and the conformance validator demands 274 of 274 (`CONTRACT.md:56`); a 275th skill would move both |
| **Why the dangling-pointer argument does not apply here** | `.rsc/` is gitignored, so `.rsc/governance/v1.md` does not exist in a fresh clone — which is why the contract's five rules live in the preamble instead (`CONTRACT.md:18`). This procedure is never needed before install: it analyzes a project whose harness is already installed | The asymmetry is justified, not inherited |
| **Invoked by** | An explicit command, offered once when installation finishes and callable at any time thereafter (`PLAN.md` §4) | Installation stays deterministic and fast. It must not analyze in bulk at install time |
| **Scope of one run** | The **selected** skills only, never the 274 | `PLAN.md` §4: "limitada a las skills seleccionadas" |

**Open dependency, declared rather than assumed:** which stage implements that command is not assigned by `PLAN.md` §5. Stage 3 specifies its contract; it does not own the CLI. See §11.

**There is no hook.** Skill application is not an observable event in any assistant (F32; `CONTRACT.md:219`), so nothing in this procedure can be enforced at the moment it matters. The only code in the loop is the schema validator, and what it denies is a **malformed artifact**, not a bad analysis. §10 keeps the two apart.

---

## 2. The eight steps

The numbering is §7's own, 1:1. Each step has inputs, an output, and a stopping criterion. A step with no stopping criterion is an invitation to read forever, which is the failure mode this procedure exists to bound.

### B1 — Inventory the selected skills, and the visible ones that could compete

**Inputs**
- `.rsc.json` keys `skills`, `ownSkills`, `targets` (`scripts/lib/manifest-file.js:18`).
- The distributed base `.rsc/skills/<id>/` — the only copy any assistant reads (`targets/index.js:9-13`).
- Each skill's `recommends:` and `tags:` frontmatter. Measured: **274 of 274** carry both.
- Each skill's `description:` boundary clause. Measured: **273 of 274** carry an explicit `NOT … (that is \`x\`)` form; the exception is `skills/suggest/SKILL.md`.
- Candidate competitors, computed not guessed: `descriptionCollisions(corpus, minimum)` (`scripts/lib/text-rank.js:102-112`) returns description pairs by descending cosine similarity. `scripts/routing-audit.js:16` already treats `0.80` as the collision ceiling for the catalog.

**Output** — one row per skill:

```text
skill | role       | why                                  | inspectable
------|------------|--------------------------------------|-------------
 x    | selected   | .rsc.json#skills                     | yes
 y    | competitor | description collision 0.83 with x     | yes
 z    | competitor | x recommends: z                      | yes
 w    | competitor | named in x's NOT clause              | yes
 v    | unknown    | personal/global/plugin source        | NO — see limit
```

**Stopping criterion.** Every selected skill appears exactly once; every competitor row carries a computed or quoted reason, never an impression; every non-inspectable source is named with the reason it could not be inspected.

**The limit that must be written, not implied.** `.rsc.json` is not the set of skills the assistant can use. Requirement §8 forbids promising otherwise, and personal, global and plugin skills are outside the harness's view. Coverage of the inventory is therefore reported as **insufficient evidence** on that axis in every run, with the sources that were and were not visible. A conflict with a skill nobody could enumerate is a conflict this procedure will not find, and saying so is the only honest option.

### B2 — Analyze the project: documentation, dependencies, versions, configuration, tests, code samples

**Inputs, deterministic first**
- `detectRepoProfile(dir)` (`scripts/detect-repo.js:46-86`) → `{stacks, packageManagers, scripts, testRunners, monorepo, signals, commands, strictTdd}`. It decides **by file presence** and cannot tell an approved convention from an accident — which is precisely why its output enters as *fact*, never as *category* (`CUSTOMIZATION-SCHEMA.md:71`).
- `scanProject(root)` (`scripts/lib/onboarding.js:78`) → `{signals, stacks, complexitySignals, markdownCount, sourceFileCount}`.
- Manifests and lockfiles, read for pinned versions.

**Inputs, read second**
- `CODEBASE-MAP.md` at the repo root, if it exists. It is the artifact `skills/codebase-onboarding/SKILL.md:17` owns, it is committed (`:113`), and its `## Stack` / `## Entry points` / `## Hotspots` sections are exactly the breadth this step needs.
- `02-DOCS/wiki/index.md`, the Knowledge map, to locate what the project already documents.
- `02-DOCS/wiki/sdd/constitution.md`, and whether its frontmatter still says `status: draft` (`skills/constitution/SKILL.md:89`).
- The project's decision log(s), per [`DECISIONS.md`](./DECISIONS.md) §2.
- Any existing `02-DOCS/wiki/skills/<id>/README.md` — read **before** the skill, per contract §2 (`CONTRACT.md:70-76`).

**Delegate instead of improvising.** If `CODEBASE-MAP.md` is absent and the repo is beyond "tiny", do not invent a reconnaissance method: hand off to `codebase-onboarding`, which already has an ordered pass and a per-shape effort table (`codebase-onboarding/SKILL.md:38`, `:76-82`), then resume at B2 with its map as input. Its two operating rules — breadth before depth, hypothesis before answer (`:35-36`) — are the ones this step would otherwise have to restate.

**Output** — a project evidence sheet. Six rows minimum, one per §7 dimension, each cell either an evidence reference or an explicit absence with its reason:

```text
dimension      | evidence                                      | how
---------------|-----------------------------------------------|------------
documentation  | 02-DOCS/wiki/index.md, 14 articles            | read
dependencies   | pubspec.yaml:31-44                            | read
versions       | Flutter 3.38 (pubspec.yaml:8) vs skill 3.44   | read
configuration  | analysis_options.yaml absent                  | NOT PRESENT
tests          | testRunners: ["flutter test"]                 | detectRepoProfile
code samples   | 34 provider declarations, 31 Riverpod         | sampled, see rule
```

**The representative-sample rule.** A sample is only evidence if it is reproducible. Every sampled claim states the population, the count and the selection method — `"31 of 34 providers"` (`CUSTOMIZATION-SCHEMA.md:138`), not `"mostly Riverpod"`. A claim whose population cannot be stated is **insufficient evidence** and is recorded as such.

**Stopping criterion.** No empty cell. Every dimension has evidence or a named absence. Sampling stops when a further sample cannot change the category of any open position — not when the reader feels confident.

### B3 — Read the skills and their relevant references

**Inputs.** The `SKILL.md` body of every selected skill, plus **only** the references a B2 finding actually touches. Progressive loading is a contract rule, not a courtesy (`CONTRACT.md:175-186`).

**Measured limit on references.** Under Cursor a skill's own auxiliary files cannot be reached by a relative path from the rule file Cursor reads; 79 skills link that way today (`CONTRACT.md:78`). Where this procedure runs under Cursor, "consult its references" is structurally unavailable for those links, and the affected positions carry **insufficient evidence** with that reason, rather than a guess at what the reference said.

**Output.** Per skill: the sections read, with line ranges, and the references opened or deliberately skipped.

**Stopping criterion.** Every inventoried skill read once; no open finding cites an unread reference; no reference opened that no finding cites.

### B4 — Extract requirements, constraints, preferences and assumptions

§7 names four kinds. They are not interchangeable, and conflating them is how a procedure like this turns a recommendation into a mandate:

| Kind | What it is | What losing to the project means |
|---|---|---|
| **Requirement** | The skill will not work correctly without it | The project side becomes a **registered exception**, per contract §7 |
| **Constraint** | A bound the skill imposes (version floors, "never both") | Violating it makes the project side **debt**, not convention |
| **Preference** | An opinionated default, overridable | **Nothing.** No exception, no migration. The skill's own escape hatch applies |
| **Assumption** | Something the skill takes for granted about the project | Not a conflict at all. It is a **scope question**: does this skill apply here? |

**Output.** A typed claim list per skill, every claim with `skill-file:line`. A claim that cannot be typed from the skill's own text is recorded as **insufficient evidence** against that skill, not typed by inference.

**Why this step carries the most weight.** The §7 worked example turns on it. `skills/flutter/SKILL.md:12` recommends Riverpod 3; `:14` says in the same breath that "Escape hatches are first-class: **Bloc/Cubit** instead of Riverpod when the team already runs Bloc". Typed correctly, Riverpod is a **preference** with a declared escape hatch, and a project on Bloc triggers no conflict requiring resolution. Typed as a requirement, the same evidence manufactures a migration the skill explicitly disclaims — which is the exact harm §7 forbids. The full record is [`CONFLICT-RECORD.md`](./CONFLICT-RECORD.md) §5.

**Stopping criterion.** Every claim typed and located, or explicitly marked unresolvable with its reason.

### B5 — Detect conflicts: project ↔ skill, and skill ↔ skill

**The conflict test, stated so it can be applied and disputed.** Two claims conflict **iff all three hold**:

1. **Same scope.** Their scopes intersect — same package, path or subproject. Two claims about different packages of a monorepo do not conflict (`CONTRACT.md:109`).
2. **Same decision subject.** They answer the same question, not adjacent questions.
3. **Not jointly satisfiable.** One artifact cannot honor both.

Anything failing one of the three is **adjacency**, and adjacency is not reported as conflict. Before declaring a skill↔skill conflict, read both descriptions' `NOT …` clauses: 273 of 274 declare their boundary explicitly, and most apparent overlaps are already settled there.

**Two sources, both required by §7:**
- **project ↔ skill** — a typed claim from B4 against the evidence sheet from B2.
- **skill ↔ skill** — two typed claims from two inventoried skills. These are the ones no `analyze` run can find, because neither skill is one of its four artifacts. A real, verifiable instance is worked through in [`CONFLICT-RECORD.md`](./CONFLICT-RECORD.md) §6.

**Output.** One conflict record per conflict, in the format of [`CONFLICT-RECORD.md`](./CONFLICT-RECORD.md): the seven §7 fields, plus one of the six categories on **each position**.

**Stopping criterion.** Every conflict carries all seven fields and a category per position; **no conflict carries a resolution yet**. B5 detects; B6 resolves. A step that detects and resolves in one motion is the silent-resolution failure the contract forbids (`CONTRACT.md:156`).

**What no validator can check here.** A conflict that was never detected leaves no trace. Recall is invisible to every deterministic instrument in this design, and §10 says so instead of implying otherwise.

### B6 — Resolve what an explicit decision in force already settles

A conflict is resolved **without asking** when, and only when, a decision satisfies all three of:

1. **In force**, not pending. A constitution with `status: draft` is not in force (`skills/constitution/SKILL.md:89`; `CONTRACT.md:97`). A customization with `status: draft` is read and reported but does not outrank the skill (`CUSTOMIZATION-SCHEMA.md:29`).
2. **Covering**, i.e. its declared scope contains the conflict's scope (`CONTRACT.md:103-107`). `scope` is mandatory precisely so this test is answerable (`CUSTOMIZATION-SCHEMA.md:34`).
3. **Not superseded** — see [`DECISIONS.md`](./DECISIONS.md) §4.

**Precedence is the contract's, unchanged** (`CONTRACT.md:113-123`): environment permissions and higher-priority policy, then approved project decisions (constitution, then the per-skill customization within its scope), then the skill's generic recommendation. Level 1 is not negotiable from a customization, and a file attempting it **is itself the finding** (`CUSTOMIZATION-SCHEMA.md:86`).

**Constitution against per-skill customization.** The constitution wins **and** the conflict is recorded as a registered exception in the customization's `## Exceptions` section (`CONTRACT.md:123`; `CUSTOMIZATION-SCHEMA.md:44`). Winning silently is not a resolution: the person who wrote the per-skill file believed it applied, and they are the ones who need to know it does not.

**Output.** Each resolved conflict moves to status `resolved-by-decision` with the citation — file and section, per contract §9 (`CONTRACT.md:162-169`). Nothing is asked. Nothing is written to the code.

**Stopping criterion.** A conflict leaves B6 either resolved with a citation, or still open. There is no third state, and "probably covered" is open.

### B7 — Ask only about material ambiguities

Governed entirely by [`QUESTIONS.md`](./QUESTIONS.md). The three rules §7 states literally: questions **explain consequences**; they **do not repeat clearly documented information**; pending decisions **block the affected actions, not all independent work**.

**Output.** One ranked batch, each question carrying its consequence and the analysis's own recommendation (`CONTRACT.md:155`).

**Stopping criterion.** Only questions passing the materiality test in [`QUESTIONS.md`](./QUESTIONS.md) §2 are asked, and they are asked once as a batch rather than dripped (`skills/clarify/SKILL.md:87`).

### B8 — Record the decisions and revalidate

**Outputs, three kinds, each with its own home** — routing table in [`DECISIONS.md`](./DECISIONS.md) §2:
1. **The run report** — point-in-time, at `02-DOCS/wiki/brownfield/<slug>.md`. One wiki level, OKF frontmatter with a non-empty `type:`, indexed in `02-DOCS/wiki/index.md`.
2. **Proposed per-skill customizations** — `02-DOCS/wiki/skills/<id>/README.md`, in the format of `CUSTOMIZATION-SCHEMA.md`. **Each is a proposal the user approves before it is written** (`PLAN.md` §4). A customization invented from a conjecture freezes technical debt as if it were a decision, which is worse than having none.
3. **Decision records** — per the routing table, in the project's existing log. Never a parallel one.

**Write only where there is evidence.** `PLAN.md` §4 is explicit: a customization is written only where a real conflict or an approved convention was found. Silence is a valid outcome, and absence of a customization is a valid state (`CONTRACT.md:80`).

**Revalidation.** Every recorded decision carries its revalidation condition, in the shape upstream already uses: `reevaluateWhen` on a deferred decision (`scripts/lib/onboarding.js:196-197`). The existing re-evaluation entry point is the precedent to follow, not replace: `rsc reassess` (`scripts/rsc.js:789` → `runReassessment()` at `:355-375`) re-scans the project, reports which deferred decisions the new evidence now triggers, and **installs nothing** — "Review a new plan; nothing has been installed" (`scripts/rsc.js:368`). Brownfield revalidation behaves identically: it reports and proposes; it never applies.

**Stopping criterion.** No decision without a revalidation condition; no write without approval; every written file passes the schema validator before the step is considered done. Requirement §8 is the checklist: skill and version reviewed, decisions with scope and reasons, evidence, exceptions, approval status, date and review conditions. Two of those have no slot in the current schema — see §11.

---

## 3. Greenfield

Requirement §7's last paragraph: clarify the relevant decisions **without inventing evidence of existing code**. Operationally that is a gate on *which categories are even reachable*, which makes it checkable instead of aspirational.

**Discriminator, deterministic:** `scanProject().sourceFileCount` (`scripts/lib/onboarding.js:84`) together with the presence of any manifest `signals`. No source files and no manifests is greenfield. Anything else is brownfield, including a repo with one manifest and no code — that is brownfield with an empty sheet, not greenfield.

**What changes per step:**

| Step | Greenfield behavior |
|---|---|
| B1 | Unchanged. A selection exists with or without code |
| B2 | Mostly `NOT PRESENT`, and that is a **valid result**, not a failure. No cell may be filled by inference |
| B3, B4 | Unchanged. The skills exist regardless of the project |
| B5 | **Only skill↔skill conflicts are possible.** A project↔skill conflict requires project evidence; with none, there is none |
| B6 | Resolves from the constitution and from intent the user has actually stated in conversation. Nothing else is in force |
| B7 | Questions come from declared intent, not from code. This is where greenfield does its real work |
| B8 | Writes only where a decision was genuinely taken. Expect few files, or none |

**The category gate, which a validator can enforce:** with no existing code, **`observed pattern`, `debt` and `migration` are unreachable**. Each of the three asserts something about code that exists — what it does, what is known-wrong in it, what state it is moving from. Only `approved convention` (a decision the user takes now), `exception` and `insufficient evidence` remain available. A greenfield run that emits any of the three forbidden categories has invented evidence, and that is a deterministic failure, not a matter of taste.

**And the incremental consequence** (`PLAN.md` §4): on a new project there is barely anything to analyze, so value accumulates over time as evidence appears. That is what the `reassess` mechanism is for, and why B8's revalidation condition is mandatory rather than decorative.

---

## 4. Result envelope

This step ends with the same parseable block every SDD phase emits, so a dispatcher can chain it without reading prose (contract: `skills/sdd/SKILL.md`; shape copied from `skills/analyze/SKILL.md:104-118`):

```json result-envelope
{
  "status": "complete|blocked|failed",
  "executive_summary": "Selected skills read against the project's own evidence; conflicts categorized, decisions recorded.",
  "artifact": "02-DOCS/wiki/brownfield/<slug>.md",
  "next_recommended": "implement",
  "risk": "low|medium|high",
  "skill_resolution": {
    "used": [],
    "missing": [],
    "fallback": [],
    "compact_rules": [
      "A finding without a location is an opinion.",
      "Detect in B5, resolve in B6. Never in one motion.",
      "No category that asserts existing code, on a project with none."
    ]
  },
  "evidence": [
    "inventory covers every selected skill",
    "every evidence sheet dimension filled or explicitly absent",
    "every conflict carries seven fields and a category per position",
    "every resolution carries the citation that settled it"
  ]
}
```

---

## 5. Conformance and compliance, kept apart

Requirement §6 forbids conflating them, and nearly all of this procedure is on the compliance side.

**Conformance — deterministic, checkable, and genuinely guaranteed.** The validator reads the artifacts this procedure produces and rejects the malformed: the six required frontmatter keys, the two required sections, a category from the six per finding, an evidence reference per finding, a legal `status`, a non-empty `scope`, a migration carrying current state and target state and the words that it requires a decision, and no decision purporting to disable a permission or guard (`CUSTOMIZATION-SCHEMA.md:79-87`). Plus, from this document: all seven §7 fields per conflict, and the greenfield category gate of §3.

**Compliance — measured, never guaranteed.** Whether the model inventories honestly, samples representatively, types a claim correctly, notices a conflict at all, or stops asking when the answer is already written: none of that is enforceable. F32 removes the only place a guard could sit — skill application is not an observable event, so there is nothing to hook (`CONTRACT.md:219`). The single gate that touches this procedure is **G5**, "ask when evidence is insufficient", threshold ≥ 85 % with **both** failure modes scored, asking too little and asking too much (`ACCEPTANCE.md:26`; `EVALUATION.md:63-64`, `:209`).

**What that leaves unmeasured, stated rather than glossed:** conflict-detection recall and category correctness have no gate in the 180-cell matrix. A run that silently finds nothing is indistinguishable, to every instrument in this design, from a project with nothing to find. §11 proposes the addition; this stage does not pretend it exists.

---

## 6. Open items this stage hands on

| # | Item | Owner |
|---|---|---|
| 1 | Which stage implements the invocation command, and its exact name | Coordinator; `PLAN.md` §5 assigns no owner |
| 2 | `CUSTOMIZATION-SCHEMA.md` has no `type:` key, but `02-DOCS/wiki/` is an OKF v0.1 bundle where every non-reserved `.md` needs a non-empty `type` (`skills/harness/references/wiki-protocol.md:839-840`); `index.md` and `log.md` are the only exempt files (`:856-858`). `README.md` is not among them | Proposed schema change, stage 1 owns the file |
| 3 | `CUSTOMIZATION-SCHEMA.md` carries no slot for the **skill version or commit reviewed** nor for the **review conditions**, both required by requirement §8. `catalog-version` is available deterministically (`scripts/lib/manifest-file.js:18`); a per-skill content digest is not — `governance-digest` digests the preamble, not the skill (`CONTRACT.md:36`) | Proposed schema change; a per-skill digest would be stage 4's transformer |
| 4 | `wiki/` supports **one** level of topic subdirectory only (`wiki-protocol.md:82`, `:866`), and `wiki/skills/<id>/README.md` is two. `PLAN.md` §4 already lists the documented extension as in scope | Stage 7 documentation; named here because this procedure writes into that path |
| 5 | The validator's invocation point includes `npm run gate`, which **does not exist** in `package.json` today — verified independently here, and `CUSTOMIZATION-SCHEMA.md:96` now says the same and assigns it to **stage 6**. This procedure's artifacts are validated at that point, so it inherits that dependency | Stage 6 |
| 6 | No gate measures conflict-detection recall or category correctness | Proposed addition to `EVALUATION.md` |
