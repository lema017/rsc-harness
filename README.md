# `rsc-governed`

**A governed fork of [`rsc-harness`](https://github.com/ericrisco/rsc-harness).**
Same catalog of 274 skills. One thing added: every skill now carries a written contract telling the
assistant to read your project's own decisions before it applies that skill — and to use the original
skill, unchanged, when your project has not decided anything.

![skills](https://img.shields.io/badge/skills-274-63d68a?labelColor=12161c)
![targets](https://img.shields.io/badge/assistant%20targets-18-63d68a?labelColor=12161c)
![contract](https://img.shields.io/badge/governance%20contract-v1-63d68a?labelColor=12161c)
![license](https://img.shields.io/badge/license-MIT-63d68a?labelColor=12161c)
![npm](https://img.shields.io/badge/npm-not%20published%20yet-9ca3af?labelColor=12161c)

> **Status, in one line.** The fork is built and measured; **nothing is published to npm yet**, and
> GitHub Actions are disabled on this repository. [Guarantees and limits](#guarantees-and-limits)
> says exactly what that means, with numbers.

---

## What this is, for someone who has not met `rsc` before

An AI coding assistant is only as good as what it reads before it starts. `rsc-harness` gives your
project that reading material: a place for project knowledge (`02-DOCS/`), tested tool connections
(`01-TOOLS/`), a handful of skills chosen from a catalog of 274, and hooks that check the work before
the assistant claims it is done. It is a local command-line tool — no server, no account, no API key.

**What this fork adds.** In the original, a skill is generic advice: a Flutter skill recommends what
the Flutter community recommends. In a real codebase that is often wrong — your team already chose a
different state library two years ago, and wrote that down. This fork makes every skill start by
asking your project:

> *Is there a decision about this skill at `02-DOCS/wiki/skills/<skill>/README.md`?
> If yes, read it first and stay inside the scope it declares. If no, use the original skill
> unchanged. If it is there but unreadable or self-contradictory, say so and ask — never pretend it
> was absent.*

That paragraph is not pasted into skills by hand, one at a time. It is a preamble — a 787-byte
template, with the skill's own name substituted into it — **compiled into all 274 skills by a
deterministic transformer**, plus a validator that fails if any skill is missing it. So what is
guaranteed is that the text is *present*, in every skill, byte-comparably. Whether the model then
*obeys* it is a different claim with a different answer, and this README gives it in
[Guarantees and limits](#guarantees-and-limits).

---

## How a skill reaches your project, and what it does before it acts

[![Customizing an existing skill: the fork package installs a governed SKILL.md carrying a governance preamble and links it into five assistants, where cursor receives SKILL.md only — no references/ and no frontmatter keys; the project owner writes an optional customization at 02-DOCS/wiki/skills/<name>/README.md and commits it; before the skill acts it checks that path — present and valid means read and apply within the documented scope, absent means use the original skill unchanged, unreadable or contradictory means surface it and ask; the customization survives install, sync, repair, update and a clean clone, and code enforcement exists today only on Claude Code, where the guard can still be removed by a committed setting.](docs/fork/diagrams/01-customize-existing-skill.svg)](docs/fork/diagrams/01-customize-existing-skill.svg)

*Editable source: [`docs/fork/diagrams/01-customize-existing-skill.svg`](docs/fork/diagrams/01-customize-existing-skill.svg) — hand-written SVG, no binary export. **On a phone, tap the image**: at 375 px the drawing is scaled to about a quarter size and the body text lands near 3 px, so the picture is a link to the full-size file, which the browser can then zoom.*

**Why that drawing says five assistants and the numbers below say eighteen.** Both are measured, and
they measure different things. The contract is **measured on all 18** assistant targets the
installer supports — 274/274 on each. Governance is **promised on the 5** the support matrix names
([`PLAN.md`](docs/fork/PLAN.md) §9). The other 13 install exactly as upstream installs them, with
**no governance claim** attached. That is a declared boundary, not a gap someone forgot to close.

---

## Relation to the parent, and credit where it is due

This repository is a **GitHub fork of [`ericrisco/rsc-harness`](https://github.com/ericrisco/rsc-harness)**,
created and maintained by [Eric Risco](https://github.com/ericrisco). It is not affiliated with or
endorsed by him.

- **Copyright © 2026 Eric Risco** for all inherited work. That notice stays in [`LICENSE`](LICENSE)
  and is never replaced. The fork's own copyright is **additional**, never a substitute.
- Everything under [`skills/`](skills) is **byte-identical to upstream at 3.7.4, commit
  `481b1ec9`** — the frozen base of every measurement in this README. Upstream has since released
  **3.7.5** (`cb9e051d`), which this fork has deliberately **not** integrated (decision D14), so
  `skills/` is not identical to upstream's current `main` and does not claim to be. The governance
  is applied at install time, not by editing the catalog, so no upstream file is hand-edited and no
  Apache-2.0 §4(b) modification notice is owed on the derived `design` material.
- **No trademark rights are claimed or granted** (Apache-2.0 §6). The package and the command are
  renamed precisely so nothing here can be mistaken for the parent's release.
- Upstream changes arrive only through the manual maintenance run described below. **This fork never
  sends anything upstream automatically**, and its `upstream` push remote is disabled.

| | Parent | This fork |
|---|---|---|
| npm package | [`@ericrisco/rsc`](https://www.npmjs.com/package/@ericrisco/rsc) | `@lema017/rsc-governed` *(not published yet)* |
| CLI command | `rsc` | `rscg` |
| Install entry point | `rsc-install` | `rscg-install` |
| Repository | [`ericrisco/rsc-harness`](https://github.com/ericrisco/rsc-harness) | [`lema017/rsc-harness`](https://github.com/lema017/rsc-harness/tree/fork/bootstrap) *(on `fork/bootstrap`; `main` is still upstream's tree)* |
| Licence | MIT | MIT, upstream copyright intact |

**Why a different command and not just a different scope.** A shared `rsc` binary means whichever
package was installed globally last wins, silently, and the losing project is driven by the other
one's CLI. `rscg` cannot collide.

**What is deliberately *not* renamed.** `.rsc/`, `.rsc.json`, `.rsc-state.json`, `.rsc/skills/`, the
`RSC_*` environment variables and the documented error codes keep their names. They are a contract
with every project already installed and with committed assistant hook configurations; renaming them
would break existing installations for no gain.

**Where the fork's own state actually lives.** Under `.rsc/governance/` — the full contract, the
always-on body and the brownfield procedure — written from the package on every install and owned by
it, so nothing of the fork's is kept inside `.rsc.json` for the parent's CLI to drop. A separate
settings file, `.rsc.fork.json`, is a **recorded decision that is not implemented**
([`ARCHITECTURE.md`](docs/fork/stage1/ARCHITECTURE.md) §8): measured today, no file under
`scripts/`, `targets/`, `schema/` or `tests/` mentions that name. If it is ever built it belongs to
a later stage, with its own backup inventory and drift check; this README will not claim it before
then.

---

## What the fork changes

| | Change | Why |
|---|---|---|
| **Governed catalog** | All **274** skills carry the v1 governance contract when installed — measured 274/274 across **18** assistant targets, over **3** installation passes | The requirement is *every* skill, not a sample |
| **Per-project customizations** | A fixed, validated path: `02-DOCS/wiki/skills/<skill>/README.md` | One entry point the skill can always find; the documentation root was audited and is **not** configurable |
| **Absence is a valid answer** | No customization → the original skill, unchanged. No empty files are created and no question is asked just for the absence | A harness that nags about missing paperwork gets uninstalled |
| **Broken is not absent** | An unreadable, invalid or contradictory customization is surfaced, never treated as missing | Otherwise the original skill runs while the project believes its own decision is in force |
| **Brownfield analysis** | `rscg brownfield` analyses the selected skills against the project's real code, config, tests and docs, and separates *approved convention* from *observed pattern*, *technical debt*, *exception*, *migration in progress* and *insufficient evidence* | A skill recommending a library you abandoned is the normal failure in an existing codebase |
| **A conformance command** | `rscg conformance` answers "does every installed skill carry the contract?" **in your project**, read-only | Before this, that question could only be answered inside this repository |
| **Own identity** | `@lema017/rsc-governed` / `rscg`; every suggested command, hook, bootstrap and updater names the fork | So nothing can reinstall the parent over the fork by accident |
| **A maintenance machine** | A resumable, gated run that pulls upstream, re-applies governance and refuses to promote an integration it could not prove | See [Keeping up with upstream](#keeping-up-with-upstream) |

The reasoning behind each decision, including the ones that were rejected, is in the project ledger:
[`docs/fork/LEDGER.md`](docs/fork/LEDGER.md) §4 and §2n/§2p/§2r/§2t (decisions D1–D16).

---

## Install and first steps

### Today

`@lema017/rsc-governed` **is not on npm yet** — the registry returns `404`, measured. Until it is
published, run it from a clone:

```bash
git clone -b fork/bootstrap https://github.com/lema017/rsc-harness.git
cd /path/to/your/project
node /path/to/rsc-harness/scripts/rsc.js onboard
```

**`-b fork/bootstrap` is not optional, and this is the one thing to get right.** This repository's
default branch is still `main`, and `main` is the parent's tree untouched — measured: the parent's
package name and version, `bin: rsc`, no `scripts/lib/governance.js`, no `docs/fork/` at all. A
`git clone` without `-b` therefore brings the **parent**, and running its `onboard` writes an
**ungoverned** harness into your project:
exactly the accident [§10 of the requirements](docs/fork/REQUIREMENTS.md) and decision D16 exist to
prevent. The branch flag goes away the day `fork/bootstrap` merges into `main`, and not before;
until then a clone of `main` is the parent, whatever the repository is called.

Check which one you got before you run anything: `node …/scripts/rsc.js --version` prints
**`rscg 3.7.4`** on the fork and `rsc 3.7.4` on the parent. One letter is the whole difference.

### Once it is published

```bash
npx @lema017/rsc-governed@latest onboard
```

Or, for a short command: `npm install -g @lema017/rsc-governed`, then `rscg onboard`.

### What `onboard` does

It asks a few questions, reads only your project root, and then **prints the exact plan** — what it
will install, what it will defer and what it will exclude, each with its reason. **Nothing is written
before you accept that plan.** Add `--target claude,codex,…` to choose assistants; without it, it
uses the one already installed here and asks rather than guessing if there are two.

Afterwards:

| Command | What it does |
|---|---|
| `rscg catalog` · `rscg list` | print all 274 catalog ids; print what is installed **here** |
| `rscg add <id…>` | add skills later |
| `rscg brownfield` | analyse the selected skills against this codebase |
| `rscg conformance` | read-only: does every installed skill carry the contract? |
| `rscg doctor` · `rscg repair` | diagnose; fix what drifted, showing you first |
| `rscg backups` · `rscg restore <id\|latest>` | every write takes a snapshot first; `--dry-run` reports and changes nothing |
| `rscg sync` · `rscg upgrade` | refresh the installed harness |
| `rscg help` | the full list |

---

## Customizing a skill for your project

Create `02-DOCS/wiki/skills/<official-skill-id>/README.md` and commit it. It belongs to your project,
not to the harness.

```markdown
---
skill: flutter
governance: v1
type: skill-customization
status: approved
updated: 2026-11-01
catalog-version: 3.7.4
reevaluate-when: the flutter skill changes its state-management recommendation
scope:
  - apps/mobile
evidence: codebase analysis, 2026-11-01, accepted by the user
---

# flutter — project customization

## Decisions

- **BLoC for state management.**
  Category: approved convention · Scope: apps/mobile
  Evidence: `apps/mobile/lib/main.dart:14`; 28 of 31 state holders are blocs
  Decided: 2026-11-01, accepted by the user

## Out of scope

Anything outside `apps/mobile`. There the skill's own recommendations apply unchanged.
```

Three things that block the file, not two. **Nine frontmatter keys are required**; `## Decisions` and
`## Out of scope` are both mandatory — a file that only says what it decides implies, by silence,
that it decided everything; and **every decision must name one of the six categories exactly and
carry an `Evidence:` line**. That is why the decision above is not a bare sentence: *approved
convention · observed pattern · debt · exception · migration · insufficient evidence*, spelled the
way the schema spells them, because "an approved convention, probably" is as unusable as none.
`scope` has no default either: an omitted scope is a validation error, not an implicit "everywhere".

**The block above is not an illustration — it is a fixture.** A test extracts it from this file and
runs the fork's own `validateCustomizationSource` over it, requiring **zero findings**; if this
README ever teaches a shape the validator rejects, the test fails before a reader can copy it. The
full schema, including orphans and renames, is in
[`docs/fork/stage1/CUSTOMIZATION-SCHEMA.md`](docs/fork/stage1/CUSTOMIZATION-SCHEMA.md), and
`rscg brownfield` writes files in this shape for you to approve.

**Your customizations are protected by code, not by convention.** They survive install, `sync`,
`repair`, update and a fresh clone; the standard path is excluded from the write path of knowledge
sync, with a negative test that fails if the exclusion ever disappears, and another that proves an
ordinary knowledge file in the same position *is* removed — so the test cannot pass vacuously.

The contract that governs precedence, scope, exceptions, migrations and what to do with stale
documentation is [`docs/fork/stage1/CONTRACT.md`](docs/fork/stage1/CONTRACT.md).

---

## Working in an existing codebase (brownfield)

`rscg brownfield` never assumes the skill is right and the project is wrong. For each selected skill
it inventories competing skills, reads the project's documentation, dependencies, versions, config,
tests and representative code, and reports conflicts. Every conflict carries seven fields —
**evidence, scope, impact, confidence, alternatives, recommendation, status** — and every position is
labelled as one of six things: approved convention · observed pattern · technical debt · exception ·
migration in progress · insufficient evidence.

It **reports; it does not resolve**. It asks only about material ambiguities, and a pending decision
blocks the affected action, not all the independent work. Proposed customizations are shown to you
and written only after you approve them.

Full procedure: [`docs/fork/stage3/BROWNFIELD.md`](docs/fork/stage3/BROWNFIELD.md).

---

## Keeping up with upstream

[![Updating the fork with upstream changes: an npm script that never ships to consumers queries upstream and stops if there is nothing new, prepares a branch or worktree, analyses impact and merges into the pristine snapshot, which merges cleanly because governance does not live there; then the transformer is re-run, deterministic validators check the full catalogue, semantic evaluations are specified but not instrumented and not yet run, and evidence is produced; finally publication happens only with the authorization given for that run — nothing is published yet and GitHub Actions are disabled, so npm provenance and trusted publishing are unavailable — consumers update themselves within the same major, and each project's customizations are never rewritten.](docs/fork/diagrams/03-upstream-maintenance.svg)](docs/fork/diagrams/03-upstream-maintenance.svg)

*Editable source: [`docs/fork/diagrams/03-upstream-maintenance.svg`](docs/fork/diagrams/03-upstream-maintenance.svg) — hand-written SVG, no binary export. **Tap it on a phone** for the full-size file, for the reason given under the first diagram.*

Maintenance is **started by hand**, monthly or when you want it. Nothing runs on a timer and there is
no service to keep alive.

```sh
npm run upstream:check                    # what changed upstream? stops if nothing did
npm run upstream:maintain -- --authorize integrate
```

It is **not** a `rscg` subcommand and it is **not in the published package**: consumers must never
integrate upstream directly, so the maintenance machinery is excluded from the tarball on purpose.

The run is resumable — its state lives on disk and in Git — and it is **gated**. A merge with no
textual conflicts is explicitly *not* accepted as proof of functional compatibility; the verdict comes
from twelve named checks (mirror invariant, catalog parity, contract conformance on every added and
modified skill in a real install, idempotence, vendored subtrees, third-party attribution, each of the
fork's own edits surviving *in intent*, the impacted test subset, customizations, the retired-skill
registry, fork identity, semantic evaluations). **A required check that did not run counts as
failing**, by name — a gate that cannot fail would report the same thing as one that passes.

This is not theoretical: upstream 3.7.5 brought a third vendored subtree with new attribution
obligations, and the gate **blocked** the integration rather than letting it ship uncredited.

Operator's guide: [`docs/fork/stage5/MAINTENANCE.md`](docs/fork/stage5/MAINTENANCE.md).

---

## How your projects get updates

Once a validated version is published, projects update themselves from the **fork's** package. They
never integrate upstream.

- **Same major:** installed in the background, pinned to the exact version just seen — never
  `@latest`, so nothing published in between slips in — and active in the next session.
- **New major:** it asks first.
- **Opt out:** create `.rsc/.no-auto-update` and every release becomes a question again.
- **Offline, 404 or a malformed response:** nothing is said and nothing is installed.
- A failed verification **keeps your installation working** and explains the blockage.

What was measured: the registry URL, the `npx` argument list, the hook copy actually installed in a
project, and a full recursive sweep of a freshly installed project — the fork in every place, the
parent in none. Detail, including the two lines where a careless rename would have made every
consumer install the parent over the fork on a timer:
[`docs/fork/stage6/DISTRIBUTION.md`](docs/fork/stage6/DISTRIBUTION.md) §3.

---

## Guarantees and limits

This section exists because the easiest way to lie about a harness is to describe what it instructs
and let the reader assume that is what happens.

### Carrying the contract is guaranteed. Obeying it is not.

**Two different claims, and only one of them is measured as a certainty.**

- **Conformance — what the artifact *carries*.** Deterministic, byte-comparable, measured:
  **274 of 274** skills carry the v1 contract, across **18** assistant targets, over **3**
  installation passes, with zero failures; a second installation of the same scope is byte-identical.
  Evidence: [`docs/fork/stage4/VERIFICATION.md`](docs/fork/stage4/VERIFICATION.md).
- **Compliance — whether the model *obeys* it.** Not guaranteed, by anyone, ever. The preamble
  instructs; nothing forces. The only thing that can force is a guard that denies the action, and
  **the only assistant where such a guard exists today is Claude Code**. `codex`, `cursor` and
  `antigravity` generate no pre-tool hook at all; DeepSeek's bridge can block, but nothing wires it.

**Worse: skill application is not an observable event on any assistant.** What code can deny is a
*tool call*, which is a different thing. So no clause of this contract is enforced at the moment a
skill is applied, anywhere. Where denial exists it is reinforcement, not the mechanism.

**And the guards are removable by the project they guard.** `.claude/settings.json` and a committed
`.rsc.json` travel in Git, so a pull request can turn a guard off. That is upstream's design — a
guard that guesses gets switched off, and a harness that blocks real work gets uninstalled — and it
is written down rather than hidden.

**The behavioural side has been specified and budgeted, and has not been run.** The evaluation
design is **181 cells at N = 3**, which is **49 + 100 + 32**: 49 scenarios over the 27 internal
harness skills, 100 over a seeded stratified sample of the rest, and 8 parity scenarios on each of
the four non-reference assistants. It is deliberately **not** behaviours × assistants × skills —
[`EVALUATION.md`](docs/fork/stage1/EVALUATION.md) §3 and §5 name that product as *"the arithmetic
that destroyed coverage"*, because multiplying by five assistants cut the skills covered from 57 to
6. Breadth is bought on one reference assistant; the other four buy a cheaper, binary
divergence check. **No semantic evaluation has been executed**, in this stage or any other, and the
maintenance gate reports that check as *not instrumented* rather than green.

### Residual limits, as measured

| | Limit |
|---|---|
| **L1** | The full test suite has not been run against the transformed catalog in one pass. The authoritative run measured **1 588 tests = 1 581 passing + 6 failures attributed one by one + 1 skipped**, 0 cancelled, ~94 minutes. The skipped one is a self-documenting conditional: there is no materialized `.rsc/danger-guard.mjs` in this checkout, so it has nothing to compare and says so instead of passing. **That run predates the rewrite of this README**, and 14 subtests across six inherited test files still assert the *parent's* product copy — the per-skill folder list, the profile menu, the lane prose, the clone-bootstrap wording. They are red today and the count above does not include them; re-aiming them at the fork's own copy is maintenance work this stage did not do. |
| **L2** | `eval-lint.sh` is never run: it writes to a literal `/tmp`, outside the project. Recorded as not verified rather than counted as a pass. |
| **L3** | Whether Claude Code exposes a tool name for *applying a skill* is **not verifiable** without running the real client with your session. It is not attempted. |
| **L4** | Whether `codex`, `cursor` and `antigravity` would honour a `deny` is untested — it needs their binaries, and no global installs are made. |
| **L5** | **Windows is not validated by execution.** On Windows the installer copies real files instead of creating symlinks; there is no Windows environment here. |
| **L6** | **Cursor's automatic skill selection is blind.** Cursor's adapter replaces the real skill description with a stub — measured at roughly **95 % of the description lost**. Governance still reaches Cursor, because it travels in the body; what does not reach it is the text that would let Cursor pick the right skill. Left as a declared limit by decision, not repaired. |
| **L7** | **"Idle machine" was not achievable** on the machine that took these measurements. What is claimed, and all that is claimed, is that no other work *of this project* ran in parallel. Durations are therefore indicative; byte comparisons are unaffected. |

### Publication, as it stands today

**GitHub Actions are disabled on this repository** (measured: `{"enabled":false}`, zero registered
workflows). Everything below follows from that one fact.

| | State |
|---|---|
| npm provenance | **Not available.** npm requires a supported cloud CI/CD provider and a cloud-hosted runner. `release.yml` is provenance-ready and cannot run. A hand publish carries none. |
| Trusted Publishing | **Not compatible today**, same precondition. It is the right destination; configuring an OIDC trust for a workflow that cannot run would be unverifiable. |
| Least-privilege workflow permissions | **Done**, explicitly. |
| 2FA on the publishing account | **Not verified.** It is an npm account setting and reading it needs the maintainer's session, which these processes are forbidden to hold. The repository owner has to confirm it. |
| Anything published | **No.** Nothing has been published; `@lema017/rsc-governed` is `404` on the registry. |

Enabling Actions would make provenance work with no code change. Until the repository owner decides
to, this table is the honest answer, and the requirement that asks for those mechanisms *"when they
are compatible"* is met by documenting the limitation, not by promising it.

**Three more things this repository does not have**, so nobody hunts for them: issues are disabled on
the fork, GitHub Pages is not deployed (`lema017.github.io/rsc-harness/` returns `404`), and private
vulnerability reporting is off. See [`SECURITY.md`](SECURITY.md) for where to send a security report
in the meantime.

---

## Where the detail lives

| Topic | Document |
|---|---|
| Requirements this fork was built against | [`docs/fork/REQUIREMENTS.md`](docs/fork/REQUIREMENTS.md) |
| Plan, scope, exclusions, acceptance criteria | [`docs/fork/PLAN.md`](docs/fork/PLAN.md) |
| Every decision, with the evidence and the retractions | [`docs/fork/LEDGER.md`](docs/fork/LEDGER.md) |
| Architecture and the residual limits L1–L7 | [`docs/fork/stage1/ARCHITECTURE.md`](docs/fork/stage1/ARCHITECTURE.md) |
| The governance contract, v1 | [`docs/fork/stage1/CONTRACT.md`](docs/fork/stage1/CONTRACT.md) |
| Customization schema | [`docs/fork/stage1/CUSTOMIZATION-SCHEMA.md`](docs/fork/stage1/CUSTOMIZATION-SCHEMA.md) |
| Evaluation design and budget (not yet executed) | [`docs/fork/stage1/EVALUATION.md`](docs/fork/stage1/EVALUATION.md) |
| Brownfield procedure | [`docs/fork/stage3/BROWNFIELD.md`](docs/fork/stage3/BROWNFIELD.md) |
| Conformance measurements | [`docs/fork/stage4/VERIFICATION.md`](docs/fork/stage4/VERIFICATION.md) |
| Upstream maintenance, operator's guide | [`docs/fork/stage5/MAINTENANCE.md`](docs/fork/stage5/MAINTENANCE.md) |
| Distribution, update, recovery, residual limitations | [`docs/fork/stage6/DISTRIBUTION.md`](docs/fork/stage6/DISTRIBUTION.md) |
| README, diagrams and their validation | [`docs/fork/stage7/VERIFICATION.md`](docs/fork/stage7/VERIFICATION.md) |

Both diagrams live in [`docs/fork/diagrams/`](docs/fork/diagrams). A third,
[`02-add-new-skill.svg`](docs/fork/diagrams/02-add-new-skill.svg), covers what happens when upstream
adds a skill.

**Read this page on GitHub, on the `fork/bootstrap` branch — measured, not guessed.** Of the 21
local destinations above, **18 are not in the npm tarball**: `docs/` ships **0 files** by design
(`package.json`'s `files` list excludes it) and `SECURITY.md` is not packaged either, so from
`node_modules` only `LICENSE`, `manifest.json` and `schema/ecc-originality.json` resolve. And on the
npm *package page*, which rewrites relative links against the repository's **default branch**,
`docs/fork/` does not exist on `main` at all — so both §13 diagrams and every documentation link
would render dead there today. This is decidable without publishing, and it is declared here rather
than listed as unverified. It stops being true the moment `fork/bootstrap` merges into `main`, which
is the same event that retires the `-b` flag in the install command above.

**The catalog** is 274 skills — core control-plane skills, frameworks, databases, devops, design,
data, AI and business workflows. `rscg catalog` prints all 274 ids with their descriptions and
[`manifest.json`](manifest.json) is the machine-readable source; both are counted, not quoted from
here. A project installs a handful, not all 274 — that is the whole point of the plan `onboard`
prints. (`rscg list` is the other question: it prints what is installed in *this* project, which in
an empty one is `(nothing installed)`.)

---

## Credits and third-party work

**The parent.** `rsc-harness` — [`ericrisco/rsc-harness`](https://github.com/ericrisco/rsc-harness),
© 2026 Eric Risco, MIT. Everything this fork is useful for, it is useful for because of that work.

Most of the catalog was written there. These parts were not, and keep their authors' credit. The
**Form** column matters, and *mirrored* comes in two strengths that it would be dishonest to print
as one:

- **mirrored, hash-pinned** — shipped byte-for-byte, with the upstream commit **and a SHA-256 per
  file** recorded in `skills/ux/upstream/UPSTREAM.json` (31 hashes and 6), and
  `tests/ux-upstream.test.js` fails if any single file drifts from its hash.
- **mirrored, commit-pinned** — shipped byte-for-byte and unmodified, with the upstream commit and
  version recorded, but **no per-file hash**: `skills/design/engine/UPSTREAM.json` carries no
  `files` map, so nothing hashes those 38 files and drift there would be caught by review, not by a
  test. Declared rather than repaired: generating that map is a maintenance change with its own
  evidence, and the honest move here was to correct the claim instead of widening the scope to fit
  it.

| Component | Source | Licence | Form |
|---|---|---|---|
| `design-eng` · `animate` · `animate-expo` · `review-animations` · `improve-animations` · `find-animation-opportunities` · `animation-vocabulary` · `apple-design` · `prototype` · `pick-ui-library` · `write-swift` · `ask-sonner` | [emilkowalski/skills](https://github.com/emilkowalski/skills) by Emil Kowalski, commit `d23d7f8` | MIT | adapted |
| the engine of `design` (`skills/design/engine/`) — 38 files | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) v2.1.4, commit `6010f91` | MIT | **mirrored**, commit-pinned |
| the four modes, the fresh review and the `DESIGN.md` record in `design` (text rewritten, no code) | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus, `skill-v4.7.0`, commit `8644175` | Apache-2.0 | adapted |
| `skills/ux/upstream/ux-designer/` — 31 files (29 references, `GUIDE.md`, `LICENSE`) | [szilu/ux-designer-skill](https://github.com/szilu/ux-designer-skill), commit `c869d32` | MIT, © 2026 Szilárd Hajba | **mirrored**, hash-pinned |
| `skills/ux/upstream/ux-usability-foundations/` — 6 files (4 references, `GUIDE.md`, `LICENSE`) | [hueyexe/frontend-agent-skills](https://github.com/hueyexe/frontend-agent-skills), commit `2841c07` | MIT, © 2026 hueyexe | **mirrored**, hash-pinned |
| the answer-first habits in `orient` | [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) | MIT | adapted |
| the scroll-scrubbed camera flight, the frame handoff between clips and the phone fixes behind `scroll-film` (prose and engine rewritten) | [oso95/scroll-world](https://github.com/oso95/scroll-world) | MIT | adapted |

The inherited README summarised this table as *"adapted, not mirrored"* for every row. That was
inaccurate for three of them, and the two UX sources were missing from it altogether; both are fixed
above, and the file counts were wrong too: they came from the reference lists and left out each
subtree's own `LICENSE` — the attribution file, in the rows this correction exists to fix. The
licence texts travel with the files — `skills/ux/THIRD_PARTY.md`, `skills/design/THIRD_PARTY.md`,
`skills/design/IMPECCABLE-LICENSE.txt`, and the `LICENSE` and `UPSTREAM.json` beside each mirrored
subtree — and, for the two `ux` subtrees and only those, a test fails if a mirrored file drifts from
its recorded hash.

### A note on `schema/ecc-originality.u64`

This 746 KB file ships in the package and is **derived data, not source**: 93 337 fingerprints, each
the **first 64 bits of a SHA-256 of an 8-gram**, sorted and irreversible. Its receipt
([`schema/ecc-originality.json`](schema/ecc-originality.json)) records the corpus it was generated
from — `affaan-m/everything-claude-code` at revision `90430ab3` — the normalization, the n-gram size
and the SHA-256 of the data itself. No file, line or sentence of the source corpus is present or
recoverable, so this fork's position is that it carries no third-party licence obligation. That is a
position, stated with its reasoning, **not legal advice**; the receipt records no licence field for
the revision used, and the source repository is public and MIT-licensed at the time of writing. The
source is credited here regardless, because crediting costs nothing and silence is what the audit
flagged.

**Not credited here, deliberately:** the third vendored subtree that arrived in upstream 3.7.5. This
fork has **not** integrated 3.7.5, so that code is not shipped, and crediting it would claim we ship
something we do not. When it is integrated, it joins the table in the same maintenance run that
brings it — the gate refuses to promote it otherwise.

---

## License

MIT — see [`LICENSE`](LICENSE).

Copyright © 2026 Eric Risco (original work, preserved).
Copyright © 2026 the `rsc-governed` fork maintainers (changes in this fork), **in addition to** the
notice above, never in place of it.
