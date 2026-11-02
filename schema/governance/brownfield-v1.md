# Brownfield compatibility analysis — the procedure

**Status:** draft, stage 3. Specification only; no code written by this stage.
**Covers:** requirements §7 (brownfield compatibility) and the §8 fields a finding must carry forward.
**Language:** English, because it ships to consumers (D7).
**Acceptance criterion:** 10. Its deterministic half is the output schema; its model half is behavior G5. Both are bounded in §5 below.

**How this document cites things, and why it matters here more than elsewhere.** Governance documents and code are cited by **section plus quoted fragment**, not by line number. Two measured reasons, both of which bit this stage: the governance transformation inserts 13 lines ahead of a skill's body, so the catalog copy and the installed copy disagree about every body line; and the stage-1 documents were edited after this stage closed, moving every line citation into them. A section and a sentence survive both. `CONFLICT-RECORD.md` §2.1 turns this from a convention into a validated rule.

---

## 0. What this is, and what it is not

This procedure runs **in the consumer project**, over that project's code and its own customizations. It is the second of the two machines `ARCHITECTURE.md` §0 separates: it never writes to the fork's catalog, and the fork's upstream-maintenance machine never runs it.

It is **not** `analyze`. The distinction is load-bearing enough to state as a table, because the two look alike and own different failures:

| | `skills/analyze/SKILL.md` | This procedure |
|---|---|---|
| Reads | Four SDD documents against each other (`analyze/SKILL.md` §"Inputs — locate the four artifacts") | Skills against the project's code, config, deps, tests and docs |
| Opens code? | **Never** — `analyze/SKILL.md#"never open a code file to \"just fix it\""` | Yes; representative samples are its primary evidence |
| When | Sixth SDD phase, pre-implementation gate (`analyze/SKILL.md#"Sixth phase of the rsc-sdd chain"`) | After install, or on demand, before a skill's configuration is called ready |
| Writes | One report, overwritten per run (`analyze/SKILL.md#"Write the report to \`02-DOCS/wiki/sdd/analysis/<slug>.md\`"`) | One report **plus** proposed per-skill customizations, each approved before it lands |
| Decisions | Logs none — `analyze/SKILL.md#"analyze decid"`es nothing | Records them, per [`DECISIONS.md`](./DECISIONS.md) |
| Unit of finding | Severity + two artifacts + locations (`analyze/SKILL.md#"**Findings table**"`) | Seven fields + a category per position, per [`CONFLICT-RECORD.md`](./CONFLICT-RECORD.md) |

**They coexist without overlapping.** `analyze` checks a project's documents for internal consistency; this procedure checks the *skills* against the project's reality. A project can pass `analyze` with four perfectly consistent documents and still have a skill recommending a state-management library it abandoned two years ago. Nothing in `analyze` would notice, because the skill is not one of its four inputs.

**What is reused from `analyze` deliberately:** its absolute rule (`analyze/SKILL.md#"**Report only. Resolve nothing.**"`), its severity scale (§"Severity scale"), its coverage-map idea in the form of B1's inventory table, and its `result-envelope` block so the same dispatcher can chain this step.

---

## 1. Invocation and where the procedure lives

| | Decision | Why |
|---|---|---|
| **Shipped form** | A package-owned document regenerated at `.rsc/governance/brownfield-v1.md` on install, beside `.rsc/governance/v1.md` (`CONTRACT.md` §0) | It needs no new skill. Strategy B freezes `skills/` byte-identical (`ARCHITECTURE.md` §1), and the conformance validator demands 274 of 274 (`CONTRACT.md` §1); a 275th skill would move both |
| **Why the dangling-pointer argument does not apply here** | `.rsc/` is gitignored, so `.rsc/governance/v1.md` does not exist in a fresh clone — which is why the contract's five rules live in the preamble instead (`CONTRACT.md` §0). This procedure is never needed before install: it analyzes a project whose harness is already installed | The asymmetry is justified, not inherited |
| **Invoked by** | An explicit command, offered once when installation finishes and callable at any time thereafter (`PLAN.md` §4) | Installation stays deterministic and fast. It must not analyze in bulk at install time |
| **Scope of one run** | The **selected** skills only, never the 274 | `PLAN.md` §4: "limitada a las skills seleccionadas" |

**Open dependency, declared rather than assumed:** which stage implements that command is not assigned by `PLAN.md` §5. Stage 3 specifies its contract; it does not own the CLI. See §6, item 1.

**There is no hook.** Skill application is not an observable event in any assistant (F32; `CONTRACT.md` §12), so nothing in this procedure can be enforced at the moment it matters. The only code in the loop is the schema validator, and what it denies is a **malformed artifact**, not a bad analysis. §5 keeps the two apart.

---

## 2. The eight steps

The numbering is §7's own, 1:1. Each step has inputs, an output, and a stopping criterion. A step with no stopping criterion is an invitation to read forever, which is the failure mode this procedure exists to bound.

### B1 — Inventory the selected skills, and the visible ones that could compete

**Inputs**
- `.rsc.json` keys `skills`, `ownSkills`, `targets` (`scripts/lib/manifest-file.js`, the `.rsc.json` reader).
- The distributed base `.rsc/skills/<id>/` — the only copy any assistant reads (`targets/index.js#"export function baseDir"`).
- Each skill's `recommends:` and `tags:` frontmatter. Measured: **274 of 274** carry both keys, and **267 of 274** carry a non-empty `recommends:` — the seven that are `[]` (`author-skill`, `debug`, `orient`, `parallel`, `ship`, `suggest`, `worktrees`) contribute no edge, which is a fact about those seven and not a gap in the method.
- Each skill's `description:` boundary clause. Measured: **273 of 274** carry an explicit `NOT … (that is \`x\`)` form; the exception is `suggest`.
- Candidate competitors, computed not guessed: `descriptionCollisions(corpus, minimum)` (`scripts/lib/text-rank.js`, `#"export function descriptionCollisions(corpus, minimum = 0.5)"`) returns description pairs by descending cosine similarity.

**The threshold, declared here rather than left to the reader — and it is not `0.80`.** The earlier draft of this step pointed at `scripts/routing-audit.js#"maxCollision: 0.80"` and named no threshold of its own. That is the wrong number twice over. `0.80` is `FLOORS.maxCollision`, a **failure ceiling**: the audit fails the catalog when the single worst pair reaches it (`#"if (collisions[0]?.score >= FLOORS.maxCollision)"`). The audit's own call site uses a different number — `#"descriptionCollisions(buildTextCorpus(manifest.skills), 0.45)"` — and the function's default is `0.5`.

Measured over this catalog's 274 skills:

```text
threshold   pairs   skills involved   note
  0.80          0          0          a catalog that PASSES its own audit has none
  0.60          9         --
  0.50         34         --
  0.45         46         65          the number routing-audit actually uses
  0.40         71         --
```

So **B1 uses `0.45`**, and `0.80` keeps its own meaning: *grave collision, the catalog is in breach*. A competitor set built at `0.80` would be empty on any catalog that passes `routing:audit`, which is to say the step would always report "no competitors" and always look like it had worked.

**Output** — one row per skill:

```text
skill | role       | why                                      | inspectable
------|------------|------------------------------------------|-------------
 x    | selected   | .rsc.json#skills                         | yes
 y    | competitor | description collision 0.52 with x (≥0.45) | yes
 z    | competitor | x recommends: z                          | yes
 w    | competitor | named in x's NOT clause                  | yes
 v    | unknown    | personal/global/plugin source            | NO — see limit
```

*Row `y` is illustrative. `0.52` is a plausible value for this catalog; the highest real pair in it is `linkedin-carousels`/`linkedin-content` at `0.737`, so any example above that would be impossible, not merely synthetic.*

**Stopping criterion — and this one bounds coverage, not just form.** Three conditions:

1. Every selected skill appears exactly once; every competitor row carries a computed or quoted reason, never an impression; every non-inspectable source is named with the reason it could not be inspected.
2. **Completeness on the computable axis:** the inventory contains **every** pair of inventoried skills at or above `0.45`, **every** `recommends:` edge among them, and **every** skill named in an inventoried skill's `NOT` clause. This is decidable without a model and without an agent run — the catalog is on disk — so a missing pair is a failure, not a judgement call. Rule 16 of `CONFLICT-RECORD.md` §7 is the check.
3. Where a required pair is deliberately excluded, the exclusion is a row with its reason, not an absence.

**What condition 2 buys, stated exactly so it is not oversold.** It is a **floor on recall for one axis**: skill↔skill conflicts whose two skills collide *in their descriptions*, plus the declared edges. It is the only recall guarantee anywhere in this design, and it costs nothing — no evaluation runs, no planted fixtures. It does **not** cover two skills that conflict in their bodies while describing themselves differently, and it says nothing about project↔skill recall. §5 keeps that accounting.

**The limit that must be written, not implied.** `.rsc.json` is not the set of skills the assistant can use. Requirement §8 forbids promising otherwise, and personal, global and plugin skills are outside the harness's view. Coverage of the inventory is therefore reported as **insufficient evidence** on that axis in every run, with the sources that were and were not visible. A conflict with a skill nobody could enumerate is a conflict this procedure will not find, and saying so is the only honest option.

### B2 — Analyze the project: documentation, dependencies, versions, configuration, tests, code samples

**Inputs, deterministic first**
- `detectRepoProfile(dir)` (`scripts/detect-repo.js`, `#"export function detectRepoProfile"`) → `{stacks, packageManagers, scripts, testRunners, monorepo, signals, commands, strictTdd}`. It decides **by file presence** and cannot tell an approved convention from an accident — which is precisely why its output enters as *fact*, never as *category*: `CUSTOMIZATION-SCHEMA.md` §2, `#"it is deterministic and it cannot tell an approved convention from an accident"`.
- `scanProject(root)` (`scripts/lib/onboarding.js#"export function scanProject"`) → `{signals, stacks, complexitySignals, markdownCount, sourceFileCount}`.
- Manifests and lockfiles, read for pinned versions.

**Inputs, read second**
- `CODEBASE-MAP.md` at the repo root, if it exists. It is the artifact `codebase-onboarding/SKILL.md#"a single living file, \`CODEBASE-MAP.md\`"` owns, it is committed (`#"**Commit it.**"`), and its `## Stack` / `## Entry points` / `## Hotspots` sections are exactly the breadth this step needs.
- `02-DOCS/wiki/index.md`, the Knowledge map, to locate what the project already documents.
- `02-DOCS/wiki/sdd/constitution.md`, and whether its frontmatter still says `status: draft` (`constitution/SKILL.md#"**A draft is \"complete me\", not \"amend me\".**"`).
- The project's decision log(s), per [`DECISIONS.md`](./DECISIONS.md) §2.
- Any existing `02-DOCS/wiki/skills/<id>/README.md` — read **before** the skill, per contract §2 (`CONTRACT.md` §2).

**Delegate instead of improvising.** If `CODEBASE-MAP.md` is absent and the repo is beyond "tiny", do not invent a reconnaissance method: hand off to `codebase-onboarding`, which already has an ordered pass and a per-shape effort table (`codebase-onboarding/SKILL.md` §"The recon pass — ordered"), then resume at B2 with its map as input. Its two operating rules — `#"**Breadth before depth.**"`, `#"**Hypothesis before answer.**"` — are the ones this step would otherwise have to restate.

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

**The representative-sample rule.** A sample is only evidence if it is reproducible. Every sampled claim states the population, the count and the selection method — form F3 of `CONFLICT-RECORD.md` §2.1: `"31 of 34 providers"`, as in the worked example of `CUSTOMIZATION-SCHEMA.md` §5, never `"mostly Riverpod"`. A claim whose population cannot be stated is **insufficient evidence** and is recorded as such.

**Stopping criterion — rewritten, because the first version only stopped reading and did not stop stopping.** It said: *sampling stops when a further sample cannot change the category of any open position*. Knowing that requires knowing what the unsampled files contain, so it is **not decidable** — and worse, it is trivially satisfiable in the wrong direction. "2 of 2000, alphabetical order" passed it. The eight stopping criteria as first written all prevented reading forever and none of them prevented stopping too early, which is the symmetric failure and the more likely one.

So, per dimension:

1. **No empty cell.** Every dimension has evidence or a named absence.
2. **Stability over two batches.** For a sampled dimension, draw a batch, record the proportion, draw a second batch of the same size, record it again. Sampling may stop when the two proportions agree within the tolerance the run declares, and **both counts and both denominators go in the report**. A single batch never satisfies this.
3. **Declared selection method.** Alphabetical, random with a seed, or exhaustive — named, so the sample is reproducible. "Alphabetical, first 2" satisfies rule 1 and fails rule 2, which is the point.
4. An exhaustive count is always admissible and always ends the dimension.

**What this does and does not fix.** It makes "stopped too early" visible: a reader can see one batch where there should be two, or two batches that disagree. It does **not** make the sample representative — rule 2 can be satisfied by two unrepresentative batches that happen to agree. Representativeness stays model behavior, property 5 of `DESIGN.md` §5, and no instrument in this design measures it.

### B3 — Read the skills and their relevant references

**Inputs.** The body of `.rsc/skills/<id>/SKILL.md` for every selected skill — the installed copy, which is the only one a consumer project has — plus **only** the references a B2 finding actually touches. Progressive loading is a contract rule, not a courtesy (`CONTRACT.md` §10).

**The installed copy is not the catalog copy.** Measured: the governance transformation inserts **13 lines** ahead of the body, so `skills/<id>/SKILL.md` and `.rsc/skills/<id>/SKILL.md` disagree about every body line number. Everything B3 records cites the installed path, and cites it by section or quoted fragment rather than by line — `CONFLICT-RECORD.md` §2.1 has the forms and the measurement.

**Measured limit on references.** Under Cursor a skill's own auxiliary files cannot be reached by a relative path from the rule file Cursor reads; 79 skills link that way today (`CONTRACT.md` §2). Where this procedure runs under Cursor, "consult its references" is structurally unavailable for those links, and the affected positions carry **insufficient evidence** with that reason, rather than a guess at what the reference said.

**Output.** Per skill: the sections read, named by heading, and the references opened or deliberately skipped.

**Stopping criterion.** Every inventoried skill read once; no open finding cites an unread reference; no reference opened that no finding cites.

### B4 — Extract requirements, constraints, preferences and assumptions

§7 names four kinds. They are not interchangeable, and conflating them is how a procedure like this turns a recommendation into a mandate:

| Kind | What it is | What losing to the project means |
|---|---|---|
| **Requirement** | The skill will not work correctly without it | The project side becomes a **registered exception**, per contract §7 |
| **Constraint** | A bound the skill imposes (version floors, "never both") | Violating it makes the project side **debt**, not convention |
| **Preference** | An opinionated default, overridable | **Nothing.** No exception, no migration. The skill's own escape hatch applies |
| **Assumption** | Something the skill takes for granted about the project | Not a conflict at all. It is a **scope question**: does this skill apply here? |

**Output.** A typed claim list per skill, every claim carrying an evidence reference in form F1 or F2 of `CONFLICT-RECORD.md` §2.1 — a quoted fragment or a heading, never a bare line. A claim that cannot be typed from the skill's own text is recorded as **insufficient evidence** against that skill, not typed by inference.

**Why this step carries the most weight.** The §7 worked example turns on it. The `flutter` skill recommends Riverpod 3 — `#"**Riverpod 3** with codegen for shared/async state"` — and in the same breath says `#"Escape hatches are first-class: **Bloc/Cubit** instead of Riverpod when the team already runs Bloc"`. Typed correctly, Riverpod is a **preference** with a declared escape hatch, and a project on Bloc triggers no conflict requiring resolution. Typed as a requirement, the same evidence manufactures a migration the skill explicitly disclaims — which is the exact harm §7 forbids. The full record is [`CONFLICT-RECORD.md`](./CONFLICT-RECORD.md) §5.

**Stopping criterion — with a floor, for the same reason B2 needed one.** The first version said only *every claim typed and located*, which bounds the form of what was extracted and says nothing about how much. Two claims from a 400-line skill passed it.

1. Every claim typed and located, or explicitly marked unresolvable with its reason.
2. **At least one typed claim, or an explicit "nothing claimed here", per level-2 section of the skill.** The section list is deterministic — a heading scan — so the denominator is known before the step starts and the coverage is checkable afterwards.
3. A section that genuinely imposes nothing is recorded as such. An empty row is a finding; a missing row is a gap.

Rule 2 is a floor on **breadth**, not on correctness. Whether the claim extracted from a section is the right claim, or the only one, remains model behavior — properties 7 and 8 of `DESIGN.md` §5 keep those apart.

### B5 — Detect conflicts: project ↔ skill, and skill ↔ skill

**The conflict test, stated so it can be applied and disputed.** Two claims conflict **iff all three hold**:

1. **Same scope.** Their scopes intersect — same package, path or subproject. Two claims about different packages of a monorepo do not conflict (`CONTRACT.md` §4).
2. **Same decision subject.** They answer the same question, not adjacent questions.
3. **Not jointly satisfiable.** One artifact cannot honor both.

Anything failing one of the three is **adjacency**, and adjacency is not reported as conflict. Before declaring a skill↔skill conflict, read both descriptions' `NOT …` clauses: 273 of 274 declare their boundary explicitly, and most apparent overlaps are already settled there.

**Two sources, both required by §7:**
- **project ↔ skill** — a typed claim from B4 against the evidence sheet from B2.
- **skill ↔ skill** — two typed claims from two inventoried skills. These are the ones no `analyze` run can find, because neither skill is one of its four artifacts. A real, verifiable instance is worked through in [`CONFLICT-RECORD.md`](./CONFLICT-RECORD.md) §6.

**Output.** One conflict record per conflict, in the format of [`CONFLICT-RECORD.md`](./CONFLICT-RECORD.md): the seven §7 fields, plus one of the six categories on **each position**.

**Stopping criterion.** Every conflict carries all seven fields and a category per position; **no conflict carries a resolution yet**; and B1's computable pair set is fully accounted for — every pair at or above the threshold either produced a record or carries a written reason why it did not. B5 detects; B6 resolves. A step that detects and resolves in one motion is the silent-resolution failure the contract forbids (`CONTRACT.md` §8).

**What no validator can check here, now that one axis is checkable.** B1's floor covers description-collision pairs and declared edges, so a run that silently skips one of those **does** fail a rule. Everything else is still dark: two skills that conflict in their bodies while describing themselves differently, and the whole **project↔skill** axis, whose recall depends on how the project was read. A conflict never detected on those axes leaves no trace, and §5 keeps that accounting instead of letting the new floor imply the whole problem is solved.

### B6 — Resolve what an explicit decision in force already settles

A conflict is resolved **without asking** when, and only when, a decision satisfies all three of:

1. **In force**, not pending. A constitution with `status: draft` is not in force (`constitution/SKILL.md#"status: draft"`; `CONTRACT.md` §3). A customization with `status: draft` is read and reported but does not outrank the skill — `CUSTOMIZATION-SCHEMA.md` §1, `status` row: `#"A \`draft\` is read and reported, but does not outrank the skill's original"`.
2. **Covering**, i.e. its declared scope contains the conflict's scope (`CONTRACT.md` §4). `scope` is mandatory precisely so this test is answerable — `CUSTOMIZATION-SCHEMA.md` §1, `scope` row: `#"an omitted scope is a validation error, not an implicit \"everywhere\""`.
3. **Not superseded** — see [`DECISIONS.md`](./DECISIONS.md) §4.

**Precedence is the contract's, unchanged** (`CONTRACT.md` §5): environment permissions and higher-priority policy, then approved project decisions (constitution, then the per-skill customization within its scope), then the skill's generic recommendation. Level 1 is not negotiable from a customization, and a file attempting it **is itself the finding** — `CUSTOMIZATION-SCHEMA.md` §3, rule 8: `#"an attempt is itself the finding"`.

**Constitution against per-skill customization.** The constitution wins **and** the conflict is recorded as a registered exception in the customization's `## Exceptions` section (`CONTRACT.md` §5; `CUSTOMIZATION-SCHEMA.md` §2, `## Exceptions` row). Winning silently is not a resolution: the person who wrote the per-skill file believed it applied, and they are the ones who need to know it does not.

**Output.** Each resolved conflict moves to status `resolved-by-decision` with the citation — file and section, per contract §9 (`CONTRACT.md` §9). Nothing is asked. Nothing is written to the code.

**Stopping criterion.** A conflict leaves B6 either resolved with a citation, or still open. There is no third state, and "probably covered" is open.

### B7 — Ask only about material ambiguities

Governed entirely by [`QUESTIONS.md`](./QUESTIONS.md). The three rules §7 states literally: questions **explain consequences**; they **do not repeat clearly documented information**; pending decisions **block the affected actions, not all independent work**.

**How much of the third rule is computable, said plainly.** "Affected" is a conjunction: *inside the conflict's `Scope`* — a path test, computable — **and** *the action commits to one of the conflict's positions* — judgement, which no validator can decide. With `Scope: repo`, which is legal and is the scope of the skill↔skill conflict in `CONFLICT-RECORD.md` §6, the computable half matches every path and settles nothing. So each `pending-decision` conflict **enumerates its blocked actions as a list**, written when the status is set (`CONFLICT-RECORD.md` §4, rule 15). The list makes the blockade reviewable and over-blocking visible; it does not make it enforced, because there is no hook (F32).

**Output.** One ranked batch, each question carrying its consequence, the analysis's own recommendation (`CONTRACT.md` §8), and the enumerated list of what it blocks.

**Stopping criterion.** Only questions passing the materiality test in [`QUESTIONS.md`](./QUESTIONS.md) §2 are asked, and they are asked once as a batch rather than dripped (`clarify/SKILL.md#"**One batch, ranked, then stop.**"`).

### B8 — Record the decisions and revalidate

**Outputs, three kinds, each with its own home** — routing table in [`DECISIONS.md`](./DECISIONS.md) §2:
1. **The run report** — point-in-time, at `02-DOCS/wiki/brownfield/<slug>.md`. One wiki level, OKF frontmatter with a non-empty `type:`, indexed in `02-DOCS/wiki/index.md`.
2. **Proposed per-skill customizations** — `02-DOCS/wiki/skills/<id>/README.md`, in the format of `CUSTOMIZATION-SCHEMA.md`. **Each is a proposal the user approves before it is written** (`PLAN.md` §4). A customization invented from a conjecture freezes technical debt as if it were a decision, which is worse than having none.
3. **Decision records** — per the routing table, in the project's existing log. Never a parallel one.

**Write only where there is evidence.** `PLAN.md` §4 is explicit: a customization is written only where a real conflict or an approved convention was found. Silence is a valid outcome, and absence of a customization is a valid state (`CONTRACT.md` §2).

**Revalidation.** Every recorded decision carries its revalidation condition, in the key the schema now provides for it: `reevaluate-when`, whose name and evaluator are upstream's `reevaluateWhen` (`scripts/lib/onboarding.js`, `#"reevaluateWhen"`). The existing re-evaluation entry point is the precedent to follow, not replace: `rsc reassess` (`scripts/rsc.js`, `runReassessment()`) re-scans the project, reports which deferred decisions the new evidence now triggers, and **installs nothing** — `#"Review a new plan; nothing has been installed"`. Brownfield revalidation behaves identically: it reports and proposes; it never applies.

**Stopping criterion.** No decision without a revalidation condition; no write without approval; every written file passes the customization validator before the step is considered done. Requirement §8 is the checklist: skill and version reviewed, decisions with scope and reasons, evidence, exceptions, approval status, date and review conditions. **All eight now have a slot**: Stage 1 added `type`, `catalog-version` and `reevaluate-when` to the schema's frontmatter after this stage raised the gap, and `CUSTOMIZATION-SCHEMA.md` §3 rule 1 requires **nine** keys. What is still missing is not a slot but a granularity — see §6, item 5.

---

## 3. Greenfield

Requirement §7's last paragraph: clarify the relevant decisions **without inventing evidence of existing code**. Operationally that is a gate on *which categories are even reachable*, which makes it checkable instead of aspirational.

**Discriminator, deterministic — and written as the literal condition, because the prose version of it was wrong.** The earlier draft said *no source files and no manifests is greenfield*, and pointed at `scanProject().signals`. But `signals` is not a manifest list: `scripts/lib/onboarding.js` pushes `` `manifest:${entry.name}` `` for a manifest and, separately, `` `markdown:${markdownCount}` `` once at the end. Testing `signals.length === 0` therefore classifies **any repo containing a README** as brownfield — which *opens* the three categories this gate exists to close, on a project with no code at all. The condition is:

```js
const { sourceFileCount, signals } = scanProject(root);
const isGreenfield =
  sourceFileCount === 0 &&
  signals.filter((s) => s.startsWith('manifest:')).length === 0;
```

Anything else is brownfield, including a repo with one manifest and no code — that is brownfield with an empty sheet, not greenfield. A repo with only a README is **greenfield**, and the gate holds.

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

This step ends with the same parseable block every SDD phase emits, so a dispatcher can chain it without reading prose (contract: `skills/sdd/SKILL.md`; shape copied from `analyze/SKILL.md`, its ```` ```json result-envelope ```` block):

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

**Conformance — deterministic, checkable, and genuinely guaranteed.** The validator reads the artifacts this procedure produces and rejects the malformed: the **nine** required frontmatter keys, the two required sections, a category from the six per finding, an evidence reference per finding, a legal `status`, a non-empty `scope`, a migration carrying current state and target state and the words that it requires a decision, and no decision purporting to disable a permission or guard (`CUSTOMIZATION-SCHEMA.md` §3). Plus, from this document and `CONFLICT-RECORD.md` §7: all seven §7 fields per conflict, evidence in one of the four admissible reference forms, an enumerated block list on every `pending-decision`, the greenfield category gate of §3, and the skill↔skill coverage floor of B1.

**Compliance — measured, never guaranteed.** Whether the model inventories honestly, samples representatively, types a claim correctly, notices a project↔skill conflict at all, or stops asking when the answer is already written: none of that is enforceable. F32 removes the only place a guard could sit — skill application is not an observable event, so there is nothing to hook (`CONTRACT.md` §12). The single gate that touches this procedure is **G5**, "ask when evidence is insufficient", threshold ≥ 85 % with **both** failure modes scored, asking too little and asking too much (`ACCEPTANCE.md` criterion 10; `EVALUATION.md` §4 and §8).

**What that leaves unmeasured, stated rather than glossed.** The gap is now smaller than it was and it is still the largest thing in this design, so here is the accounting rather than an adjective:

| Axis | Covered? | By what |
|---|---|---|
| skill↔skill, pairs colliding in their descriptions at ≥ 0.45 | **yes, completely** | B1's coverage floor + `CONFLICT-RECORD.md` §7 rule 16. Deterministic, costs no evaluation runs |
| skill↔skill, declared `recommends:` edges and `NOT`-clause namings | **yes, completely** | same |
| skill↔skill, two skills that conflict in their **bodies** while describing themselves differently | **no** | Nothing computes it. Would need a semantic gate |
| **project↔skill recall** | **no** | Depends on how the project was read. No instrument sees it |
| Category correctness (approved convention vs observed pattern) | **no** | Judgement about whether a ratification exists |

**And the part the floor does not fix, said once more because it is the easiest sentence to lose.** A run that opens the project, reads nothing useful and emits zero project↔skill conflicts produces zero records and passes every rule including rule 16, because rule 16 only asks about pairs computable from the catalog. That run is indistinguishable, to every instrument here, from a project with nothing to find. The 181-cell evaluation matrix has no gate for it; G5 measures **asking**, not **detecting**. §6 item 6 proposes the gate and names what it would cost. **Declaring this is not mitigating it**, and the coverage floor above must not be read as having closed it.

---

## 6. Open items this stage hands on

| # | Item | Owner |
|---|---|---|
| 1 | Which stage implements the invocation command, and its exact name | **Stage 6**, by the coordinator's decision. `PLAN.md` §5 assigned no owner; stage 6 is where `.rsc/governance/` is regenerated on install and update, so the command lands beside the thing it depends on |
| 2 | **Nothing stops this procedure's artifacts from being validated, because nothing validates them.** `validateCustomizations` (`scripts/lib/customization-validator.js`, `#"export function validateCustomizations"`) walks exactly one root — `CUSTOMIZATION_ROOT`, `#"join('02-DOCS', 'wiki', 'skills')"`. The run report at `02-DOCS/wiki/brownfield/<slug>.md` and the conflict records in it are read by nothing: `grep -rn brownfield scripts/ package.json` returns empty. So the 16 rules of `CONFLICT-RECORD.md` §7 and the 17 deterministic properties of `DESIGN.md` §5 are **decidable but uninstrumented** | **Stage 6.** The module to extend is `scripts/lib/customization-validator.js`; the second root to walk is `02-DOCS/wiki/brownfield/`. See item 3 for where it is called from |
| 3 | **The invocation points that exist today, so the extension has somewhere to live.** Two, both real: `install`/`sync`, already wired — `scripts/install-apply.js` imports the validator and calls it (`#"report = validateCustomizations({ cwd, catalogRoot: ROOT })"`) — and `npm run governance:customizations` → `scripts/validate-customizations.js`. `npm run gate` is the **third, future** point: it does not exist, `package.json` defines 17 scripts and none of them is `gate`, and `CUSTOMIZATION-SCHEMA.md` §3 says the same and assigns it to stage 6 | Stage 6 |
| 4 | `wiki/` supports **one** level of topic subdirectory only (`skills/harness/references/wiki-protocol.md`, `#"one level"`), and `wiki/skills/<id>/README.md` is two. `PLAN.md` §4 already lists the documented extension as in scope | Stage 7 documentation; named here because this procedure writes into that path |
| 5 | **A per-skill content digest does not exist, and `catalog-version` is the honest granularity until it does.** The schema now carries `catalog-version`, so requirement §8's "skill y versión o commit revisado" has a slot — but the slot records the catalog, not the skill, so "this skill changed" is detected at catalog granularity and over-reports. `governance-digest` does not help: it digests the rendered preamble, not the skill body (`CONTRACT.md` §1) | Stage 4 owns the transformer, which is where a per-skill digest would be produced |
| 6 | No gate measures **project↔skill** conflict-detection recall or category correctness. B1's floor closes the computable skill↔skill axis at zero cost; these two are not computable and would need evaluation runs, against a D6 ceiling of ~600 that is already allocated | Proposed addition to `EVALUATION.md`; the runs must be found or the coverage declared pending, per `PLAN.md` §11 criterion 14 |
