# RSC Governance Contract — v1

**Status:** draft, stage 1. Not yet applied to the catalog.
**Covers:** requirements §5 (per-project customization) and §6 (governance contract).
**Language:** English, because this is a product artifact that ships to consumers (D7).

---

## 0. What this contract is, and what it is not

Governance is carried by **two artifacts**, not one:

| | Artifact | Where | Owner |
|---|---|---|---|
| **A** | The **preamble** — 787 bytes of template, 780–805 rendered | Injected into every distributed `SKILL.md` between markers | Generated. Never hand-edited |
| **B** | **This document** | Regenerated at `.rsc/governance/v1.md` on install | Package-owned. Not project-owned |

**A is normative and self-sufficient.** B is the full text, not a prerequisite. This is a deliberate choice forced by evidence: `.rsc/` is listed in `.gitignore`, so B **does not exist in a fresh clone until install runs**. A pointer that can dangle cannot be the only place the rules live. The five rules are therefore written in A, and B expands them.

**What this contract does not do.** It does not guarantee compliance. The preamble's presence is a property of the *artifact*, verified deterministically on all 274 skills. Whether a model *follows* it is a separate question, measured by evaluation with a stated confidence interval, and guaranteed only where a code guard denies an action outright. Requirement §6 forbids conflating the two, and §12 of this document keeps them in separate tables.

---

## 1. Identity, version and integrity

Three **flat** frontmatter keys are added to each distributed skill. Flat because `scripts/lib/frontmatter.js` is a hand-rolled line parser, not YAML: a nested object would be read as unrelated top-level keys. Hyphens are valid (`[A-Za-z_][\w-]*`).

```yaml
governance: v1
governance-customization: 02-DOCS/wiki/skills/<official-name>/README.md
governance-digest: <12 hex chars>
```

- `governance` — the contract version this skill was transformed against. Bump to `v2` only when a rule **changes meaning**; wording clarifications keep `v1`.
- `governance-customization` — the literal path for *this* skill, precomputed. The reader never constructs a path, so there is nothing to construct wrongly. Safe because the directory name equals the `name:` key in 274 of 274.
- `governance-digest` — digest of the rendered preamble block. It makes **partial or tampered injection detectable in the distributed base** `.rsc/skills/`, where the conformance validator runs. It is the one key with **no copy in the body**, so unlike the other two it is not redundant — and because frontmatter is stripped from the delivered surfaces, it does not reach them. Those surfaces are regenerated from the base on every install and `sync`, so their integrity derives from the base's and is not claimed independently. That, which is what turns acceptance criterion 4 ("0 partials") into something a validator can actually check.

The preamble body is delimited by:

```
<!-- rsc-governance:begin v1 -->
…
<!-- rsc-governance:end -->
```

Markers, not position. Re-running the transformation **replaces** the block between markers rather than appending, which is what makes it idempotent. Verified: the whole catalog transformed twice is byte-identical after the second pass, with no skill carrying two blocks.

**The body is the only channel that reaches every assistant, so two of the three keys are redundant — `governance-digest` is not, and its scope is stated below.** Measured: `targets/cursor.js:7` replaces the entire frontmatter with `description` + `alwaysApply` (`stripFrontmatter` at `:28-30`), so the `.mdc` Cursor receives does not contain these keys even though the base does; `_md-block.js:28,73-74` drops them on the always-on surface too. Nothing a reader needs to know may live only in the frontmatter. The keys serve the conformance validator and the maintenance machine; the block in the body serves the model.

**All 274 skills carry it, with no exception**, and it costs nothing. One of them, `suggest`, is also the source of the always-on body. An earlier draft of this document ordered three byte ceilings raised to accommodate it; that was wrong and is retracted. The three ceilings read the repository's own `skills/suggest/SKILL.md`, which Strategy B freezes byte-identical to upstream forever, so they never trip — see [`ARCHITECTURE.md`](./ARCHITECTURE.md) §4 for the measurement. What was real is that the preamble reached the always-on body, which `install-apply.js:294` renders from the *transformed* copy: 779 bytes, about 200 tokens, on every turn, for the 17 assistants with no per-turn hook, and no test measuring it. In that surface the block has no referent — there is no "skill below" being applied — so the transformation strips it in `wireHook`, the always-on path only, leaving every per-skill rendering untouched. The conformance validator still demands 274 of 274 over the distributed base, a 273 is still a failure, and the per-turn cost is **zero bytes**.

---

## 2. Discovery and reading of customizations

**The path is fixed:**

```
02-DOCS/wiki/skills/<official-name>/README.md
```

One file per skill, named by the official skill identifier. `02-DOCS` is the documentation root; the audit settled that this root is **not** configurable, so §5's "if the audit proves the root is configurable" clause is inert. Auxiliary documents may be linked from the README; the README is the single entry point.

**Required order of operations:**

1. Check whether the customization exists.
2. If it exists, **read it before applying the skill** — not afterwards, not as a cross-check.
3. Follow its references when they are relevant.
4. Apply its decisions **within the scope it declares**.
5. If it does not exist, use the original skill with no project-specific adjustment.

**Measured limitation on step 3.** Every path this contract or a customization cites must be **anchored at the project root**, never relative to the file citing it. In Cursor, a skill's own auxiliary files exist in the project but cannot be reached by a relative path from the rule file Cursor actually reads — 79 skills link that way today and those links are broken there. The customization path in this contract is root-anchored and survives in all five target assistants; "consult its references" is, for a skill's own references under Cursor, **structurally impossible** and is declared as a limit rather than promised.

**Absence is valid.** Do not create an empty file. Do not ask the user a question whose only subject is the absence. This does not suppress any question the task or the skill itself requires.

**Absent and broken are different states.** A file that exists but is unreadable, invalid or self-contradictory must be named, and the work must not continue down the "absent" path: ask how to proceed. Reporting it and then applying the skill unchanged *is* the fallthrough, because it converts a project's explicit instruction into its opposite while sounding like diligence. An earlier draft said only "must be reported", which the preamble contradicted by saying "stop"; the rule is neither a hard stop nor a report-and-continue — it is a question.

**Customizations belong to the project.** They are versioned in Git and must survive installation, `sync`, `repair`, update and the reconstruction of a clean clone.

---

## 3. General decisions and specific decisions

| | Artifact | Role |
|---|---|---|
| General | `02-DOCS/wiki/sdd/constitution.md` | Project-wide non-negotiables |
| Specific | `02-DOCS/wiki/skills/<name>/README.md` | How one skill applies in this project |

A specific decision **narrows** a general one; it does not contradict it. When it does contradict, §5 of this document applies — the conflict is surfaced, not resolved by whichever file was read last.

Note for implementers: the constitution written by `rsc onboard` is a **draft** (`status: draft`, "not ratified"), ratified later by the `constitution` phase. Nothing in this contract may assume a ratified constitution exists at install time.

---

## 4. Scope by module, package or subproject

A customization **declares its scope**. Outside that scope the original skill applies unchanged.

- No declared scope → the scope is the whole repository.
- A declared scope → paths, packages or subprojects, stated explicitly.
- Two customizations whose scopes overlap for the same skill → a conflict under §5, never a merge.

In a monorepo this is the difference between a usable rule and an unusable one: "we use Riverpod" is true of one package and false of another, and a contract that cannot say *where* a decision holds will spread it everywhere.

---

## 5. Precedence

Highest first. Each level may narrow the ones below it; none may override the ones above it.

1. **Environment permissions and higher-priority instructions and policies.** A customization **cannot** disable a permission, a guard or a safety rule. A file that tries to is itself the finding.
2. **Approved project decisions** — the constitution, then the per-skill customization within its declared scope.
3. **The skill's original generic recommendation.**

Within its scope, an approved project decision beats a generic recommendation. That is the whole point of the customization: the skill knows the craft, the project knows itself.

**Conflict between levels 2a and 2b** (constitution vs per-skill): the constitution wins, **and** the conflict is logged as a registered exception under §7. Winning silently is not allowed, because the per-skill file was written by someone who believed it applied, and they are the ones who need to know it does not.

---

## 6. Missing, stale or contradictory documentation

| State | Required behavior |
|---|---|
| **Missing** | Apply the original. Do not invent. Do not create a placeholder |
| **Unreadable or invalid** | Name the file and the reason, then **ask**. Do not fall through to "missing", and do not continue as if it had been read |
| **Internally contradictory** | Name both sides with their locations, then **ask**. Do not pick one |
| **Stale** — contradicted by the code it describes | Report the divergence as an observed pattern against an approved convention. **Do not edit the code to match the document, and do not edit the document to match the code.** Both are decisions for the user |

Staleness is the common case in a brownfield project, and it is the one where a helpful-looking action does the most damage: silently "fixing" either side destroys the evidence that they disagreed.

---

## 7. Exceptions and migrations

Two named outcomes, both of which must be **recorded rather than applied**:

- **Registered exception** — a case where an approved decision knowingly does not hold. It carries: what the decision is, where the exception applies, why, and who accepted it. An exception that is not written down is indistinguishable from a violation.
- **Migration** — a divergence whose resolution is a change over time rather than a judgement. It carries: the current state, the target state, and the fact that **it requires a decision**. A migration is never executed by the act of detecting it.

A renamed upstream skill is the sharpest instance. No stable skill identifier exists — `origin:` is `risco` on all 274, so it is authorship, not identity. A rename is therefore detectable only by content similarity, and **must** be reported as a migration requiring human confirmation. Applying it silently would leave `02-DOCS/wiki/skills/<old-name>/README.md` orphaned and never consulted again, which is exactly the silent loss of governance §5 forbids.

---

## 8. Questions and conflict resolution

- **Resolve internally first.** Read the spec, the constitution, the customization and the code before asking anything. A question whose answer is already written is noise, and noise teaches the user to approve without reading.
- **Ask when evidence is insufficient.** Not when it is merely incomplete — when deciding would mean guessing.
- **Carry your own recommendation.** A question offered without a proposed answer transfers the work instead of the decision.
- **Never resolve a conflict by choosing a side.** Name both sides with their locations and hand the decision back.

The refinement of *how* questions are composed is deliberately **out of scope** for this work, at the user's decision, and will be addressed separately. This clause states the minimum the contract requires; it does not define a questioning protocol.

---

## 9. Evidence and traceability

Every governance-relevant statement carries its source:

- A customization that was read → its path.
- A decision that was applied → the file and the section it came from.
- A finding → a location, and the category it falls under: approved convention, observed pattern, debt, exception, migration, or insufficient evidence.
- A claim that something was verified → how. "Verified" means executed, not read.

A finding without a location is an opinion. A category without evidence is a guess with a label on it.

---

## 10. Progressive context loading

The budget is real, so the contract is layered:

| Layer | Cost | When it is paid |
|---|---|---|
| Preamble (A) | 780–805 B per skill, 211 KiB across 274 | On load of that skill |
| This document (B) | Once, on demand | Only when a rule needs its full text |
| The customization | One file | Only for the skill being applied |
| Its auxiliary documents | Per reference | Only when relevant to the task |

Nothing in this contract instructs a reader to load all customizations, or all of this document, up front. The preamble's job is to be small enough to always be there and complete enough to rarely need expanding.

---

## 11. Usage paths

Requirement §6 demands all four be considered. They are not equally supported, and the contract says so rather than pretending:

| Path | How the contract reaches it |
|---|---|
| **Explicit invocation** | The preamble is in the `SKILL.md` the assistant loads |
| **Automatic selection** | Measured per assistant: native in **claude** and **deepseek**; **blind** in cursor, where the mechanism exists but the skill description is truncated to about 5% of itself (`cursor.js:7`); **absent** in codex and antigravity, where nothing even tells the assistant where the skills are. For three of the five this path is not available today |
| **Reference from another skill** | The referenced skill carries its own preamble, so governance travels with it rather than with the caller |
| **Internal flows** | Covered only where the flow loads a `SKILL.md`. A flow that reads a skill's `references/` directly bypasses the preamble — a residual limitation to be measured, not assumed away |

---

## 12. Guaranteed by code, dependent on the model, measured by evaluation

Requirement §6 requires these documented **separately**. Filling the first table needs the per-assistant enforcement evidence now being gathered; what is already certain is the shape.

**Guaranteed by code** — a guard denies the action; no model judgement involved. Measured by installing the harness for each assistant and running the guards:

| Assistant | Denies today? | Mechanism |
|---|---|---|
| **claude** | **Yes, conditionally** | Four `PreToolUse` entries (`targets/claude.js:195,209,225,311`); guards return `permissionDecision: "deny"`. **Only where `rsc sync` has run.** In a fresh clone no guard exists — `.rsc/` is gitignored — and the bootstrap returns context only, by design: *"informing someone is not denying them"* (`clone-bootstrap.mjs:371-374`) |
| **codex** | No | Generated hooks carry no `PreToolUse` |
| **cursor** | No | Only `beforeSubmitPrompt`, which is pre-turn, not pre-tool |
| **antigravity** | No | No hooks file is generated at all |
| **deepseek** | No, but the machinery works | Wiring a `PreToolUse` by hand makes the bridge return `{"decision":"block"}` (`targets/deepseek-bridge.mjs:67-69,77`) |

Two findings bound this table further, and both are load-bearing:

> **Skill application is not an observable event.** The only tool matchers in the repository are `Bash` and `Edit|Write|MultiEdit|NotebookEdit`; `Skill` appears as neither a tool nor a matcher anywhere in `scripts/`, `targets/` or `tests/`. **No clause of this contract can be enforced at the moment a skill is applied, on any assistant.** What code can deny is a tool call, which is a different event.

> **The guard can be removed by the project it guards.** `.claude/settings.json` travels in Git and is not covered by the generated `.gitignore`, so the hook entry can be deleted in a commit.

**Therefore nothing in this contract depends on denial.** Where denial exists it is reinforcement; where it does not, governance is text the model may ignore — which is measured, not promised.

**Dependent on the model** — the preamble instructs; nothing forces.
- Reading the customization before applying the skill.
- Honoring it within its scope.
- Reporting a conflict instead of resolving it.
- Asking when evidence is insufficient.

**Measured by evaluation** — see [`EVALUATION.md`](./EVALUATION.md).
- G1 consultation, G2 fidelity, G3 fallback, G4 precedence, G5 asking, G6 no regression.
- 180 cells, N=3, 540 executions plus 60 in reserve, over 6 skills and 5 assistants.
- Reported with its confidence interval. An observed 95% over 90 observations supports "≥ 90%", not "≥ 95%".

---

## 13. Degradation

What happens when a piece is missing, stated so that failure is predictable rather than improvised:

| Missing piece | Behavior |
|---|---|
| `.rsc/governance/v1.md` (fresh clone, before install) | The five rules in the preamble stand on their own. Say the full contract is not installed; do not infer rules that are not in the preamble |
| The preamble (an untransformed skill) | The skill is **not governed**. Do not simulate governance from memory of this document. An ungoverned skill must be reported as such by the conformance validator |
| `02-DOCS/` entirely | No customizations exist. Apply originals. This is the valid absent case, not an error |
| The constitution | Per-skill customizations still apply within their scope. Say that no ratified general decision exists |
| A customization's linked auxiliary document | Report the broken link. The README's own decisions still apply |
| The hook entry in `.claude/settings.json`, deleted in a commit | Governance degrades to advisory on that assistant. Report it; do not restore it silently, because someone committed that deletion |
