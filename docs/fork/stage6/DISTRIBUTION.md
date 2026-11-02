# Distribution, update and recovery

**Status:** stage 6 deliverable. Product documentation, English (D7).
**Covers:** requirements §2 ("conservar las funciones originales del harness", "mantener actualizaciones automáticas de los proyectos consumidores"), §9 and §10; `PLAN.md` §8 bullets *Distribución* and *Recuperación*.
**Audience:** anyone deciding whether to depend on this package, and anyone who has to publish it.

Every number below was produced by running something. Where a thing could not be run, it says so and says why — "not checked" and "no finding" are different states, and this document never prints one as the other.

---

## 1. Identity

| | Parent | This fork |
|---|---|---|
| npm package | `@ericrisco/rsc` | **`@lema017/rsc-governed`** |
| CLI command | `rsc` | **`rscg`** |
| Install entry point | `rsc-install` | **`rscg-install`** |
| Repository | `ericrisco/rsc-harness` | `lema017/rsc-harness` (a GitHub fork of it) |
| License | MIT | MIT, with the upstream copyright notice intact |

The command name is deliberately different, not merely the scope. A shared `rsc` binary would mean that whichever of the two packages was installed globally last wins, silently, and the losing project would be driven by the other one's CLI. `rscg` cannot collide.

**What this means if you already run the parent.** Nothing of yours is renamed. `.rsc/`, `.rsc.json`, `.rsc-state.json` and `.rsc/skills/` keep their names and their meanings, because they are a contract with every project already installed: the transformation reads them, all eighteen assistant adapters read them, and renaming them would break every existing installation for no gain. The same applies to the `RSC_*` environment variables (`RSC_NO_UPDATE_CHECK`, `RSC_LATEST`, …) and to the documented error codes (`RSC_ONBOARDING_INCOMPLETE`, `RSC_ONBOARDING_REQUIRED`), which are read by assistant hook configurations people have already committed and matched on by CI.

So the rule, stated once: **the package and the command are the fork's; the on-disk layout and the hook protocol are not the fork's to rename.**

### What the fork asks you to run

```bash
npx @lema017/rsc-governed@latest onboard     # first time, in your project
npx @lema017/rsc-governed@latest             # bring an existing harness up to date
rscg doctor                                  # with a global install
rscg conformance                             # "are my installed skills governed?"
rscg brownfield                               # analyze an existing project against its skills
```

### One declared limitation you should know about before you read §3

The catalog under `skills/` is a **byte-identical mirror** of the upstream commit this fork incorporates — that is the whole of its maintenance strategy — and upstream's own prose names `@ericrisco/rsc` **81 times**, of which **10 are in the always-on body** (`skills/suggest/SKILL.md`). That body is shipped unchanged to `.rsc/governance/always-on.md`, and in Claude Code it is re-emitted at every session start and after every compaction. It contains runnable instructions such as `npx @ericrisco/rsc add <id>`.

**Consequence, stated plainly:** an agent that follows that line will download and run the **parent's** CLI inside a fork-governed project. The fork does not yet rewrite it. `PLAN.md` §3 already assigns the fix — identity rewriting as a step of the same transformation that applies governance — and §6 of this document tracks it as the one open item that touches §10 directly. The count is pinned by a test (`tests/governance-identity.test.js`, `gi13`), so it cannot drift quietly in either direction.

---

## 2. Publishing: what this fork can and cannot promise

`PLAN.md` §8 asked for npm provenance, migration to Trusted Publishing "if compatible", least-privilege workflow permissions, and 2FA. Here is each one against what was measured, not against what was hoped.

### 2.1 GitHub Actions are disabled on this fork — verified, not assumed

```
$ gh api repos/lema017/rsc-harness/actions/permissions
{"enabled":false,"sha_pinning_required":false}

$ gh api repos/lema017/rsc-harness/actions/workflows --jq '{total:.total_count}'
{"total":0}
```

Three workflow files exist in `.github/workflows/` (`ci.yml`, `release.yml`, `pages.yml`) and **none of them is registered or can run**. Everything in §2.2 and §2.3 follows from this one fact.

### 2.2 Provenance: **not available today.** Not "configured and waiting" — unavailable.

npm's requirements, quoted from its own documentation:

> "In order to establish provenance, you must use a supported cloud CI/CD provider and a cloud-hosted runner to publish your packages."

and the supported list is **GitHub Actions** and **GitLab CI/CD**. A publish from a laptop cannot carry provenance at all; the flag has nowhere to get an OIDC identity from.

| Requirement | State |
|---|---|
| npm CLI ≥ 9.5.0 | ✅ `10.9.8` |
| public `repository` in `package.json` matching where you publish from, case-sensitive | ✅ `git+https://github.com/lema017/rsc-harness.git` |
| a supported cloud CI/CD provider actually able to run | ❌ **Actions disabled** |
| `id-token: write` in the publishing job | ✅ present in `release.yml`, on the `release` job only |
| `npm publish --provenance --access public` | ✅ present in `release.yml` |

So `release.yml` is **provenance-ready and cannot run**. The fork claims readiness, never provenance. If the repository owner enables Actions, provenance starts working with no code change; until then, a release published by hand has none, and this document is the place that says so.

### 2.3 Trusted Publishing: **not compatible today**, and the reason is the same one

npm's supported trusted publishers are **GitHub Actions (GitHub-hosted runners)**, **GitLab CI/CD (GitLab.com shared runners)** and **CircleCI (cloud)**; self-hosted runners are explicitly unsupported. Trusted publishing is OIDC from inside a CI workflow, so it has the same precondition as provenance and fails for the same reason.

Two further facts worth having before anyone calls this a quick win:

- Trusted publishing **auto-generates provenance** from GitHub Actions and GitLab CI/CD — so enabling Actions and migrating would deliver both at once, and the `--provenance` flag and the `NPM_TOKEN` secret could both be dropped.
- It would **not** deliver provenance via CircleCI, which npm excludes. A CircleCI migration would therefore satisfy "Trusted Publishing" and fail "provenance", which is exactly the kind of half-answer `PLAN.md` §8 asks to document rather than claim.

**The fork's position:** Trusted Publishing is the correct destination and is **blocked on a repository setting the fork does not change on its own**. The migration is one `permissions` block and one package-settings change once Actions are on; it is not attempted while they are off, because configuring an OIDC trust relationship for a workflow that cannot run would be a configuration nobody can verify.

### 2.4 Least-privilege workflow permissions: **done**, and it was wrong before

| Workflow | Before | Now |
|---|---|---|
| `ci.yml` | **no `permissions:` block at all** — it inherited the repository default, which can be read-write | `permissions: contents: read` at workflow level |
| `release.yml` | `contents: write` + `id-token: write` at **workflow** level, so the read-only `news` job also held the token that can push to `main` and mint an npm identity | `contents: read` at workflow level; `news` gets `contents: read`, `release` gets `contents: write` + `id-token: write` |
| `pages.yml` | `contents: read`, `pages: write`, `id-token: write` | unchanged — each one is needed by the deploy |

One more defect was fixed while in there, because it is a gate that lied. `ci.yml`'s cleanup check was written as `! grep …`, which turns grep's **exit 2** — "I could not finish the scan" — into a **PASS**. It now distinguishes three states: residue found → fail, clean → pass, scan failed → fail. A check that cannot run must not report success.

### 2.5 2FA: **NOT VERIFIED**, with the reason

2FA is an npm **account** setting, and reading it needs the maintainer's npm session:

```
$ npm profile get          # with HOME pointed at the dedicated sandbox
npm error code E401
npm error 401 Unauthorized - GET https://registry.npmjs.org/-/npm/v1/user
```

That 401 is the isolation working as instructed, not a finding about the account: every process in this work runs with `HOME` inside the dedicated folder and has no access to the user's credentials or session. The account is known to be authenticated as `lema017` from a check the coordinator ran outside the sandbox, but **the 2FA setting itself is unverified and recorded as such.** It is a setting the repository owner must confirm in their npm account; no code in this fork can confirm it, and none pretends to.

### 2.6 What was verified about the artifact

```
$ npm pack --dry-run
name:          @lema017/rsc-governed
version:       3.7.4
filename:      lema017-rsc-governed-3.7.4.tgz
package size:  5.4 MB      unpacked: 13.8 MB      total files: 1792
```

*(1 796 before the `files` negations that keep the upstream-maintenance machinery out of the tarball — exactly the four files excluded. §10 is literal that consumers do not integrate upstream, so the machine that does lives in the fork's repository and ships nowhere.)*

`LICENSE`, `package.json`, `manifest.json`, the three shipped governance artifacts (`schema/governance/{preamble-v1.txt,contract-v1.md,brownfield-v1.md}`) and the scripts a consumer needs at runtime (`scripts/gate.js`, `scripts/lib/conformance.js`, `scripts/verify-catalog-conformance.js`, `scripts/validate-customizations.js`) are all in the tarball; `docs/` is not, which is why the authoritative governance documents are copied into `schema/governance/` by `npm run governance:sync` and asserted byte-identical by `npm run governance:check`.

**Nothing has been published.** No `npm publish` and no registry-authenticated dry run was performed. `@lema017/rsc-governed` returns `404` from the registry, so the name is free and the version in `package.json` is what a first release would carry.

### 2.7 Version numbering, and why it tracks upstream

The fork's version is **3.7.4**: the same number as the upstream commit it incorporates. That is deliberate. `catalog-version` in every per-skill customization records the catalog a decision was reviewed against, and the whole stage-1/stage-3 apparatus cites `3.7.4`; a fork that restarted at `0.1.0` would make those records unreadable against upstream. There is no collision risk, because the auto-update check compares the project's `.rsc/.version` against **the fork's** registry document, never the parent's.

---

## 3. Consumers keep updating themselves — and it is the thing a rename breaks

This is requirement §2, verbatim: *"Mantener actualizaciones automáticas de los proyectos consumidores."* It is also the single highest risk in the whole identity change, so it was measured rather than reasoned about.

### 3.1 How the mechanism actually works

`targets/auto-update.mjs` is a standalone module copied to `.rsc/auto-update.mjs` at install, like the other hooks. Each session:

1. It reads the installed version from `.rsc/.version`, written at every install and sync.
2. It fetches the package's `/latest` document from the npm registry, with a 1.5 s timeout, and fails silent on anything unexpected (offline, 404, parse error → nothing is said).
3. If a newer version exists **in the same major**, it launches the update in the background, pinned to the exact version it just saw — never `@latest`, so nothing published in between slips in — and the update takes effect in the next session.
4. If the newer version is a **new major**, it asks instead.
5. `.rsc/.no-auto-update` is a project decision that brings back the question for every release. That is §10's "opción de desactivar actualizaciones automáticas".
6. The `/latest` document is the published `package.json`, so its `rscFixes` field rides along for free, and the notice names **symptoms** rather than a version number.

### 3.2 Where the parent's name lived, and why no inherited test covered it

The package name appears **twice** in that file, and both are the dangerous kind:

```js
const res = await fetch('https://registry.npmjs.org/@ericrisco%2frsc/latest', …);   // which package to watch
: ['npx', '-y', `@ericrisco/rsc@${version}`];                                       // which package to install
```

**No inherited test touches either line.** Every one of them short-circuits the lookup with `RSC_LATEST` or `RSC_LATEST_JSON` and replaces the installer with `RSC_AUTO_UPDATE_CMD`, precisely so the suite stays offline. A fork that renamed its package and left those two strings alone would ship a consumer that polls the parent and then **installs the parent over the fork, in the background, on a timer** — which is literally the accident §10 asks to prevent, and it would have passed the whole test suite.

Both now name the fork, and `tests/governance-identity.test.js` asserts them **on the source**, for exactly that reason (`gi05`).

### 3.3 What was measured

| Claim | How | Result |
|---|---|---|
| The update check polls the fork | `gi05`, asserted on the source of `targets/auto-update.mjs` | `@lema017%2frsc-governed`, and no `ericrisco` in any registry URL |
| The background install pulls the fork | `gi05` | `` `@lema017/rsc-governed@${version}` `` |
| The notice still fires, and names the fork's command | `gi06`, `updateNotice()` with `RSC_LATEST=3.7.9` over an installed `3.7.0` | "3.7.9 is out — you have 3.7.0", `npx @lema017/rsc-governed@latest`, no parent reference |
| A current project is told nothing | `gi06`, `RSC_LATEST=3.7.0` | empty notice |
| Same major installs itself; a new major asks | `gi07` | "installing itself in the background" / "new major version" |
| The symptom channel still works | `gi08`, a `/latest` document carrying `rscFixes` | "a thing that was broken (fixed in 3.7.5)" |
| The **installed copy** in a consumer project names the fork | `gi10`, read off `.rsc/auto-update.mjs` after a real install | fork in both places, parent in neither |
| Nothing the fork **writes** into a project names the parent | `gi11`, full recursive sweep of a freshly installed project | zero, excluding the frozen catalog copies of §1 |
| The on-disk contract is unchanged | `gi10` | `.rsc/`, `.rsc/skills/`, `.rsc/.version`, `.rsc-state.json`, `.claude/skills/<id>/SKILL.md` all present; no `.rscg/` invented |

### 3.4 The one thing that is still true and uncomfortable

An **existing consumer of the parent** carries the parent's `.rsc/auto-update.mjs`, because that file is a copy inside their project. Until they run the fork once, their project keeps watching the parent. After one `npx @lema017/rsc-governed@latest`, every hook copy is rewritten and the project follows the fork. There is no way to reach into a project nobody has run anything in, and the fork does not pretend otherwise.

---

## 4. Recovery

`PLAN.md` §8: *"Una verificación fallida conserva la instalación funcional y explica el bloqueo; respaldo y restauración comprobados; sin estados parcialmente activados."* All three were executed, including the failure path.

### 4.1 Backup and restore

Every install, sync, uninstall, agent reset and repair takes a snapshot **before** it writes, under `.rsc/backups/<timestamp>-<operation>-<target>/`, with a manifest listing every managed path and how it was held (file, directory, symlink, or absent). `rscg backups` lists them; `rscg restore <id|latest>` puts them back; `rscg restore --dry-run` reports and changes nothing.

Measured (`tests/governance-recovery.test.js`): a snapshot of a governed base, a destructive overwrite, and a restore return the original **byte for byte**; a dry run reports the same paths and leaves the destroyed file in place.

### 4.2 A failed verification conserves the install and explains the blockage

The onboarding transaction is the place where this matters, because it writes across many paths at once. `applyAcceptedOnboarding` snapshots the whole governed set, applies, writes the receipt, and then **verifies**; any difference, and any throw from any step, rolls the entire transaction back and raises:

```
RSC_ONBOARDING_INCOMPLETE: <the real cause>. Recover with: <the exact command>.
```

Measured by injecting a failure into the install step: the error names the real cause, carries the recovery command, and **no accepted receipt is left in `.rsc.json`** — which is what makes "no partially activated state" checkable rather than aspirational, since the receipt is the thing that makes a harness "accepted".

### 4.3 D13 — `restore` can hand back an ungoverned skill, and now it says so

This is the finding stage 4 measured and the coordinator decided. It is worth stating precisely, because the correct behaviour looks like a bug.

**The mechanism.** There are two writers inside `.rsc/skills/`: `governBase`, which applies the contract, and `restoreEntry` in `scripts/lib/backups.js`, a raw `cpSync`, which does not. The install's snapshot set includes the skill base directories, and the snapshot is taken **before** the install writes. So if a base arrived from upstream — ungoverned — the snapshot captures it ungoverned, and the install then governs it. A later `restore` of that snapshot returns the ungoverned file, and the seventeen symlinking assistants read it immediately.

**Reproduced**, in `tests/governance-recovery.test.js` `gr03`:

```
1. fork install                 → governed = true
2. base rewound to upstream     → governed = false
3. fork install again           → governed = true   (and the snapshot holds step 2)
4. rscg restore latest          → governed = false
   .claude delivery resolves: true | bytes identical to the base: true
```

**The decision: the semantics do not change.** `restore` is a time machine. Re-governing on restore would hand the user a state they did not ask for, which is a worse failure than the one it would hide.

**What changed instead — three places, all measured:**

1. **`rscg restore` says it.** After a real restore it names every base that came back without a contract, states that *the restore is correct*, says a sync puts them back and that the transformation is idempotent, and points at `rscg conformance`. It is silent when nothing came back ungoverned (`gr04`, `gr05`).
2. **The onboarding rollback says it too.** The same `restoreBackup` runs automatically there, so `RSC_ONBOARDING_INCOMPLETE` now names what the rollback left behind (`gr12`). The nuance is kept: a rollback returns a project to a state it was already in, so it invents no missing contract.
3. **`rscg doctor` reports it whenever anyone looks** — and does **not** fold it into `healthy`, because `healthy` means "the installed harness works", which is what CI and editor extensions read, and an ungoverned skill works; it just works with no contract (`gr13`, `gd02`).

### 4.4 `rscg conformance` — the question a consumer could not ask before

Until now, "does every distributed skill carry the contract?" could only be answered **inside this repository**, by an instrument that installs all 274 skills for 18 targets. A consumer had no command at all.

```
$ rscg conformance                     # measured on a 3-skill fixture, tests gr07/gr08
3/3 installed skills carry the governance contract (v1).
  claude: 3/3 delivered conformant (3 symlink), always-on clean
```

On a project with the whole catalog installed the ratio is `274/274`; the figure above is the one an
executed test produced, which is the only kind this fork prints.

It is read-only: it installs nothing, writes nothing and reaches no network. It exits `1` when it ran and found something, and `0` when nothing is installed — because "nothing is installed here" is a fact about the project, not a conformance failure, and a CI reading the exit code must not confuse the two.

It **reuses** the criterion-4 audit rather than restating it. `auditBase`, `auditDelivery` and `alwaysOnSurface` have exactly one definition each, in `scripts/lib/conformance.js`, and the repository-side instrument imports them from there; a test asserts the two share the same function object (`gr09`). A second copy that drifts is the defect this project has already committed once.

---

## 5. `npm run gate`

Three documents cited `npm run gate` as an instrument while no `package.json` defined it. It exists now: `scripts/gate.js`, deterministic, offline, writing nothing outside the repository.

```
PASS  validate                        frontmatter + recommends of every skill in the catalog
PASS  manifest:check                  manifest.json is current for the catalog on disk
PASS  governance:check                the shipped governance artifacts match their sources
VOID  governance:customizations       both project-artifact roots
      nothing to validate here: this repository is not a consumer project.
      Non-vacuous only where 02-DOCS/ exists
PASS  skills-invariant                `skills/` is still byte-identical to upstream
PASS  drift:check                     every prose link in the catalog resolves
PASS  originality:check               the pinned third-party fingerprints still hold

7/7 passed (1 with nothing to check here) · 1.6s – 36.7s, see below
```

**`VOID`, not `PASS`, and that distinction is the third property.** `ARCHITECTURE.md` flagged three
inherited validators as vacuous in a clean clone — they pass by having nothing to examine. The
project-artifact check has exactly that shape *in this repository*, which is not a consumer project
and has no `02-DOCS/`. Its real invocation points are `install`/`sync` and `rscg brownfield
--validate` inside a project. A check that ran and had nothing to look at is not a failure and it is
not coverage, so it gets its own word.

**On that duration:** the same seven checks measured **13.3 s**, then **36.7 s** with a test suite
running beside them, then **1.6 s** once the machine went quiet and the filesystem cache was warm. A
22× spread on identical work. No number here is authoritative — "an idle machine" is a condition this
project has measured as unreachable (limit L7) — and the honest claim is the order of magnitude:
**seconds, not minutes**, which is what makes it usable in the iteration loop `npm test` cannot
serve. Three measurements of one thing are a better argument for that caveat than any sentence.

Two further properties matter as much as the checks:

- **It prints what it does not cover, with the reason** — `npm test`, `eval-lint.sh`, `routing:audit`, `spec:gate`, `knowledge:doctor`, `drift:knowledge`, `design:upstream` and the full criterion-4 sweep, each with the sentence that explains why it is out. A gate that hides its own coverage is worse than one that checks less.
- **A check that cannot run prints `SKIP`, never `PASS`.** `skills-invariant` needs an `origin/main` ref; in a clone without one it says so and says what would make it runnable.

The composition is not invented here: `ARCHITECTURE.md` §"Qué se adopta, qué se arregla, qué se descarta" already ruled on every inherited check, and this gate is the four it adopts plus the two the fork added plus the Strategy B invariant. The "130 s" figure that document quoted was a manual sum of six scripts; the gate measures **13.3 s**.

---

## 6. Residual limitations

| # | Limitation | Why it stands |
|---|---|---|
| **L-D1** | **npm provenance is unavailable.** | Actions are disabled (`{"enabled":false}`). npm requires a supported cloud CI/CD provider and a cloud-hosted runner. `release.yml` is provenance-ready and cannot run. |
| **L-D2** | **Trusted Publishing is not configured.** | Same precondition. It is the right destination and it would deliver provenance automatically; configuring an OIDC trust for a workflow that cannot run would be unverifiable. |
| **L-D3** | **2FA is NOT VERIFIED.** | It is an npm account setting and reading it needs the maintainer's session, which the isolation rules forbid these processes from having (`npm profile get` → `E401` under the sandboxed `HOME`). The repository owner must confirm it. |
| **L-D4** | **Nothing is published.** | No publish and no registry-authenticated dry run was performed. `@lema017/rsc-governed` → `404`. So "the published artifact installs cleanly from the registry" is untested; `npm pack --dry-run` tested the tarball, which is not the same claim. |
| **L-D5** | **The frozen catalog names the parent 81 times, 10 of them in the always-on body**, including the runnable `npx @ericrisco/rsc add <id>`. | Strategy B freezes `skills/`; `PLAN.md` §3 assigns the rewrite to the transformation, whose reversibility property (`stripGovernance(transform(x)) === x`) and always-on byte-identity claim belong to other stages. Counted and pinned by `gi13` so it cannot drift silently. **This is the one open item that bears directly on §10.** |

**What L-D5 means for acceptance criterion 13** — *"Actualización automática desde el fork, sin reinstalar el padre, con activación coherente y sin estados parciales"* — stated rather than rounded up:

| Half of criterion 13 | Verdict |
|---|---|
| The fork's own update machinery never reaches the parent | ✅ **verified by execution** — `gi05`, `gi06`, `gi10`, `gi11`: the registry URL, the `npx` argv, the installed hook copy and every fork-written artifact |
| Coherent activation in the next session, no partial states | ✅ **verified** — same-major installs itself pinned to the exact version seen and takes effect next session (`gi07`); the onboarding transaction rolls back whole and leaves no accepted receipt (`gr11`) |
| **Nothing instructs a consumer to reinstall the parent** | ❌ **NOT met.** The always-on body, read every turn, says `npx @ericrisco/rsc add <id>`. The *mechanism* is clean; the *instruction surface* is not |

So criterion 13 is **two thirds verified and one third open**, and the open third is L-D5. It is recorded that way here rather than as a tick, because a criterion marked green on the strength of its verified halves is exactly the kind of claim this project has spent four stages learning to distrust.
| **L-D6** | **An existing consumer of the parent keeps watching the parent until it runs the fork once.** | Their `.rsc/auto-update.mjs` is a copy inside their project. One run of the fork rewrites it. |
| **L-D7** | **Windows is not validated by execution.** | No Windows environment. On Windows the installer copies real files instead of symlinking, which is correct by design; the conformance audit measures that case by comparing the whole subtree against the base, and that path has never been run. |
| **L-D8** | **Rule 14 of the conflict-record format is not instrumented.** | "A position marked `FIXTURE` is never counted as project evidence by any downstream step" is a property of a downstream step, not of a file, so there is nothing in the validator to check. Declared rather than counted as covered. |
| **L-D9** | **`npm test` is not a binary gate.** | `tests/knowledge-sync.test.js` is non-deterministic in **pristine upstream**, which fails a strict superset of the cases this fork does (D12). The authoritative run is 1 588 tests / 6 failures / 0 cancelled / 1 h 33 m, with all six attributed and none new. |

---

## 7. Where to look next

- [`DESIGN.md`](./DESIGN.md) — why each of these was built the way it was, in Spanish, for whoever maintains it.
- [`VERIFICATION.md`](./VERIFICATION.md) — every command that produced a number above, with its output.
- [`../stage1/CONTRACT.md`](../stage1/CONTRACT.md) — the governance contract itself.
- [`../stage3/BROWNFIELD.md`](../stage3/BROWNFIELD.md) — the procedure `rscg brownfield` hands over, also shipped to `.rsc/governance/brownfield-v1.md`.
