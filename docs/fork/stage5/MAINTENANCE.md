# Maintaining this fork against upstream

This fork tracks [`ericrisco/rsc-harness`](https://github.com/ericrisco/rsc-harness) and adds a
governance contract to every skill it distributes. Upstream keeps shipping releases, so once in a
while somebody has to pull them in. This is how.

Maintenance is **started by hand**. There is no service, no scheduled job and no bot. You run one
command, read what it says, and decide.

Maintenance runs **in this repository**, never in a project that consumes the package. Consumers do
not integrate upstream; they update from a published release of this fork.

---

## Before the first run

You need a clone of this fork with both remotes wired:

```sh
git remote -v
# origin    https://github.com/lema017/rsc-harness.git   (fetch/push)
# upstream  https://github.com/ericrisco/rsc-harness.git (fetch)
```

The parent repository is public, so every upstream query runs **anonymously**: the credential helper
is disabled for each git invocation, prompts are off, and the askpass hooks are removed from the
environment. Nothing you have stored is offered to it, and no URL printed in a report can carry a
token.

Node 18 or newer. No API key, no external service, nothing leaves the machine.

---

## The monthly run

### 1. Ask what changed

```sh
npm run upstream:check
```

```
run 20261102T072425Z-fc6fc1 (authorization: survey)
  survey: DONE — 2 new upstream commit(s): 481b1ec9 → cb9e051d
  classify: DONE — added 0, removed 0, modified 1, rename candidates 0 · 2 notice(s)
```

If upstream has nothing new it says so and stops, having prepared nothing:

```
  survey: DONE — no changes: `upstream/main` is cb9e051d, which this fork already incorporated
No changes from upstream. Nothing prepared, merged or published.
```

`upstream:check` updates `refs/remotes/upstream/main` and nothing else — no branch moves, no file in
your working tree changes. It has to download the objects, because you cannot classify a change you
do not have. Add `--no-fetch` if you want it strictly read-only; the run will then tell you the data
may be stale rather than pretending it is current.

### 2. Integrate

```sh
npm run upstream:maintain -- --authorize integrate
```

This prepares a branch (`fork/upstream-<sha>`), merges, and verifies the governance transformation
over exactly the skills the change touched. Add `--worktree` to work in an isolated worktree instead
of switching branches in place.

### 3. Validate

```sh
npm run upstream:maintain -- --resume --authorize validate
```

This runs **the gate**, which is the part that matters. See below.

### 4. Promote, if this run is authorized to

```sh
npm run upstream:maintain -- --resume --authorize publish --promote main
```

Promotion needs two things at once: `publish` authorization **and** a passing gate. Without
`--promote` the run tells you the exact command instead of running it. The npm release is a separate,
manual step: the `release.yml` workflow is `workflow_dispatch` only, so merging never publishes by
itself.

---

## The maintenance gate: what counts as proof

> Not to be confused with `npm run gate`, this repository's standing deterministic gate. That one
> answers "is this tree healthy?". This one answers "is this *integration* safe to promote?", and it
> is specific to one upstream change.

**A merge with no textual conflicts is not accepted as proof of functional compatibility.** The merge
result is recorded as evidence, marked as not counting, and the verdict is computed only from these
checks. A required check that did not run counts as failing, by name — a gate that cannot fail would
report the same thing as one that passes.

| | Check | What it measures |
|---|---|---|
| G1 | mirror invariant | `skills/` is still byte-identical to the integrated upstream commit |
| G2 | catalog parity | the integrated catalog is exactly upstream's: nothing lost, nothing invented |
| G3 | contract conformance | every added and modified skill carries the contract in a **real install** |
| G4 | idempotence | a second install of the same scope is byte-identical |
| G5 | vendored subtrees | untouched in the repository **and** in the delivered copy |
| G6 | attribution | new or changed third-party notices are acknowledged |
| G7 | divergence intact | each of this fork's own edits survived the merge **in intent** |
| G8 | impacted tests | the derived test subset runs with no **new** failures |
| G9 | customizations | a deletion is reported orphaned; a rename is never rehomed |
| G10 | retired registry | a deleted skill's consequence is recorded |
| G12 | fork identity | the merge did not restore the parent's package name or command |
| G11 | semantic evaluations | **not instrumented** — see below |

### G11 is honest about itself

The semantic evaluations run on the session's own agents, so no script here can execute them. G11 is
therefore **required and not instrumented**: it cannot pass by itself and it cannot be forgotten.
The run writes a worklist to `evidence/semantic-evaluation-worklist.json` and blocks until you record
a result:

```sh
npm run upstream:maintain -- --resume --ack 'G11=N=3 over connect-tool, all cases above threshold'
```

Decidable is not instrumented. Where this fork cannot run something, it says so instead of passing it.

### When the gate blocks

Each failing check names its own fix. The ones you will actually meet:

**G6 — new third-party notices.** Upstream vendored something new. The run names the files and reads
the declared licence out of `UPSTREAM.json`. Update this fork's notice inventory and the README
third-party table, then:

```sh
npm run upstream:maintain -- --resume --ack 'G6=README table and PLAN §2 updated in <commit>'
```

A notice that ships without being acknowledged is still an unmet obligation. This is the failure a
clean merge and a green test suite both miss.

**G7 — a divergence was reverted, or a new one is unwatched.** Either the merge undid one of this
fork's edits (the probe says which, and what the edit was *for*), or a file this fork now diverges on
has no intent probe yet. Re-apply the edit, or add the probe to `DIVERGENCE_PROBES` in
`scripts/lib/upstream-survey.js`.

**G8 — a new test failure.** Preexisting upstream failures are declared with their provenance and do
not block; anything else does. `tests/eval-lint.test.js` is never run, because it writes outside the
project, and the run reports that rather than counting it as a pass.

**G10 — a deleted skill.** When upstream deletes a skill, the delivered link is pruned but the
**shared base under `.rsc/skills/<id>/` is not** — the installer prunes a base only for an id listed
in `RETIRED_SKILLS`, which is a hand-written map. So consumers keep a governed base for a skill that
no longer exists until somebody adds the entry. The run names the consequence and asks for the entry
to be added by hand, in `scripts/lib/retired-skills.js` **and** in the inline copy inside
`targets/clone-bootstrap.mjs`. It also tells you that the entry is a new permanent divergence in a
file upstream edits.

**G12 — the parent's identity came back.** Upstream owns `package.json`, this fork has modified it,
and a three-way merge of a release bump can quietly restore `@ericrisco/rsc` or the `rsc` command.
That would point every consumer's auto-update at the parent. Fix the merge result.

---

## The four classes of upstream change

| Class | What the run does |
|---|---|
| **added** | Governed by construction: the transformation runs at install over whatever the catalog contains, so there is no list for anyone to update. A semantic evaluation is mandatory. |
| **modified** | The contract is re-injected between its own markers, so re-governing replaces rather than appends. Re-evaluated. |
| **removed** | The project's customization **survives byte-identical** and is reported as orphaned. It is never deleted: it is the project's property. The shared base is not pruned — see G10. |
| **renamed** | **Reported as a migration requiring a decision. Never applied.** |

### Why a rename is never applied

The catalog carries no stable skill identifier — `origin: risco` is the value in every one of the 274
`SKILL.md` files — so a rename is indistinguishable from a deletion plus an addition. Git's
similarity detection is reported as *evidence about a pair*, with its score, and the pair stays in
both the added and the removed lists until you decide.

Applying it silently would leave the project's customization indexed under the old name and never
consulted again. A rename applied without being asked is a failure of this fork's acceptance criteria
even when the result would have been right.

---

## Resuming

Every run writes a journal to `docs/fork/stage5/runs/<runId>/`:

```
state.json     the journal — phases, decisions, evidence pointers, publication status
report.md      what happened, in prose, including what was NOT done
evidence/      the expensive measurements, so nobody has to reproduce them
```

It is written **before** each phase starts and after each one finishes, atomically, so a crash leaves
a visible `running` rather than a silent gap. Resume with:

```sh
npm run upstream:maintain -- --resume            # the most recent run
npm run upstream:maintain -- --resume <runId>    # a specific one
```

An interrupted phase is **re-run**, never assumed finished. Every phase is written to be safe to
repeat: `prepare` reuses its own branch, `integrate` notices it already merged, `govern` installs
into a fresh disposable project.

The journal lives under `docs/fork/` because it is version-controlled: the record of what was
incorporated belongs beside the merge that incorporated it.

A corrupt or unreadable journal is reported as an error, never as "no run in progress".

---

## Authorization

The scope you grant at the start of a run is a **ceiling**, checked per phase:

| Scope | Reaches |
|---|---|
| `survey` | ask upstream, classify — read-only beyond the fetch |
| `integrate` | branch or worktree, merge, verify governance |
| `validate` | the gate, the evaluation worklist, the bounded fixes, the report |
| `publish` | promotion |

A phase above the ceiling is skipped **with its reason written down**, so the report says what was
not done. Widening the scope on a resume reopens those phases; narrowing it closes them again. Every
grant is recorded with its timestamp.

---

## What gets fixed automatically, and what does not

The run regenerates exactly two things, both of which this repository already treats as generated:

- `manifest.json`, via `scripts/build-manifest.js`
- `schema/governance/*`, via `scripts/governance-sync.js`

Everything else becomes a **named manual action** in the report. In particular the run never writes a
`RETIRED_SKILLS` entry, never resolves a rename, and never edits a skill: those are decisions, and
surfacing a decision is not the same as taking one.

Nothing in this flow ever writes inside `skills/`. That directory is a byte-identical mirror of
upstream, and the governance transformation happens at install time instead. The run measures the
invariant before and after the transformation and fails if it moved.

---

## Flags

| Flag | Meaning |
|---|---|
| `--check` | survey and classify only; no branch, no merge |
| `--authorize <scope>` | `survey` \| `integrate` \| `validate` \| `publish` |
| `--resume [runId]` | continue a run; with no id, the most recent one |
| `--ack <CHECK>=<text>` | record the result a check needs (`G6`, `G10`, `G11`) |
| `--promote <branch>` | merge the integration branch into `<branch>`; needs `publish` and a pass |
| `--worktree [dir]` | integrate in an isolated worktree instead of switching branches |
| `--remote <name>` | default `upstream` |
| `--ref <branch>` | default `main` |
| `--base <commit>` | the commit you believe was last incorporated; the only way a rebase upstream becomes visible |
| `--offline` | work from the local remote-tracking ref; records the real fetch as not verified |
| `--no-fetch` | reach the remote but download nothing; records the classification as possibly stale |
| `--state-root <dir>` | where runs are written; default `docs/fork/stage5/runs` |
| `--json <file>` | machine-readable result |

---

## Limits, stated

- **A rebase upstream is invisible without a recorded base.** The commit this fork last incorporated
  is measured as the merge base, and a merge base is an ancestor of the new upstream head by
  definition — so no measurement of it can reveal that upstream rewrote its branch. Pass `--base`
  with the head from the previous report to make it visible. Unrelated histories *are* detected, and
  block.
- **Durations measured during a run are not authoritative.** A strictly idle machine is not
  achievable here; the authoritative full-suite figures live in the project ledger.
- **The gate's test subset is a subset.** It is derived from what changed — the fork's own governance
  suite always, plus the test files upstream changed, the catalog readers when the catalog changed,
  and every test that mentions a changed source file by name. The full suite is reserved for
  promotion to a release.
- **`tests/eval-lint.test.js` is never run**, because it writes to a literal `/tmp`, outside the
  project. The run reports it as not verified rather than counting it as a pass.
- **The semantic evaluations are not instrumented**, by design and not by omission. See G11.
