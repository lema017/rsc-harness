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

### Two declared limitations you should know about before you read §3

**(1) The frozen catalog.** The catalog under `skills/` is a **byte-identical mirror** of the upstream commit this fork incorporates — that is the whole of its maintenance strategy — and it names `@ericrisco/rsc` **81 times**, of which **10 are in the always-on body** (`skills/suggest/SKILL.md`). Not prose: **all 81 are `npx @ericrisco/rsc`**, runnable commands. That body is shipped unchanged to `.rsc/governance/always-on.md`, and in Claude Code it is re-emitted at every session start and after every compaction.

**Consequence, stated plainly:** an agent that follows that line will download and run the **parent's** CLI inside a fork-governed project. The fork does not yet rewrite it. `PLAN.md` §3 already assigns the fix — identity rewriting as a step of the same transformation that applies governance — and §6 tracks it as **L-D5**. The count is pinned by a test (`tests/governance-identity.test.js`, `gi13`), so it cannot drift quietly in either direction.

**(2) The product surface outside the catalog, which nothing freezes.** `README.md` — which **travels in the tarball** and is the npm package page — carries **10 runnable `npx @ericrisco/rsc…` lines**, an `npm i -g @ericrisco/rsc`, and the sentence *"`package.json` is named `@ericrisco/rsc`"*, which is **false today**. `site/llms.txt`, the **instruction file for agents**, says *"Run: `npx @ericrisco/rsc@latest onboard`"*. That is **L-D10**, and the first version of this document did not have it: its sweep was scoped to the executable tree and these paths were never looked at. They are stage 7's to fix and were always stage 6's to declare.

**So §10 has two open items, not one**, and §6 says what each is and who owns it.

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

**And §10's "verifica identidad, versión e integridad del artefacto", which the first version of this document left undone.** It had tested the **tarball manifest**, which is a different claim from "the artifact installs and runs". The independent review did it, and it has been reproduced here — entirely local, `--offline`, with `HOME` and the npm cache inside the dedicated folder, nothing authenticated and nothing published:

```
$ npm pack --pack-destination .fork-tmp/stage6r
lema017-rsc-governed-3.7.4.tgz        5 650 047 B · 1 792 files · unpacked 14.4 MB
shasum 37f5ddf04d43f4db844de3119e9163ba3ea3f4ac

$ cd <throwaway project> && npm install --offline ../lema017-rsc-governed-3.7.4.tgz
added 7 packages, and audited 8 packages in 3s · found 0 vulnerabilities

$ ls node_modules/.bin/
rscg   rscg-install

$ node_modules/.bin/rscg --version
rscg 3.7.4                                                                 EXIT 0

$ node -e "…require('@lema017/rsc-governed/package.json')…"
@lema017/rsc-governed 3.7.4 {"rscg":"scripts/rsc.js","rscg-install":"scripts/install-apply.js"}
```

**Identity, version and integrity: pass, locally.** The installed package's own metadata names the fork, both binaries are linked, the CLI runs under the fork's command name and reports the fork's version. This is also how `L-D10` stopped being an inference: `README.md` is at the root of the installed package, with its 10 runnable `npx @ericrisco/rsc…` lines, and `site/` is not there at all.

**Nothing has been published.** No `npm publish` and no registry-authenticated dry run was performed. `@lema017/rsc-governed` returns `404` from the registry, so the name is free and the version in `package.json` is what a first release would carry. The **registry** half of the artifact check therefore stays open (L-D4): installing a local tarball and installing what the registry serves are not the same claim.

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

The package name appears **four times** in that file — `git show origin/main:targets/auto-update.mjs | grep -c ericrisco` → `4` — and **two of them are the dangerous kind**:

```js
const res = await fetch('https://registry.npmjs.org/@ericrisco%2frsc/latest', …);   // which package to watch
: ['npx', '-y', `@ericrisco/rsc@${version}`];                                       // which package to install
```

The other two are the **text of the notice** (`npx @ericrisco/rsc@latest`, twice), and those two *are* covered: `tests/update-notice-symptoms.test.js` asserts the command the notice prints, which is why the rename broke it and why it is listed among the inherited assertions this change had to repair.

*(The first version of this section said "twice". It was wrong — stage 6's independent review ran the grep and got 4. The substantive claim survives unchanged and is the one worth keeping: **four times, two of them of the dangerous class, and no inherited test touches either of those two**.)*

**No inherited test touches either of the two dangerous lines.** Every one of them short-circuits the lookup with `RSC_LATEST` or `RSC_LATEST_JSON` and replaces the installer with `RSC_AUTO_UPDATE_CMD`, precisely so the suite stays offline. A fork that renamed its package and left those two strings alone would ship a consumer that polls the parent and then **installs the parent over the fork, in the background, on a timer** — which is literally the accident §10 asks to prevent, and it would have passed the whole test suite.

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

### 3.5 Races, and partially activated states

§10 asks for two things in one bullet — *"Evita carreras y estados parcialmente activados"* — and the first half went unanswered in the first version of these documents. `grep -in "carrera\|race"` over all three returned **0**. The mechanism was there, inherited and working; what was missing was saying so and measuring it. Added after M7 of the independent review.

Three guards, all in `targets/auto-update.mjs`, all inherited:

| Guard | What implements it | What it prevents |
|---|---|---|
| **The version is pinned** | `launchUpdate(root, latest, …)` builds `@lema017/rsc-governed@${version}`, never `@latest` | Two sessions that saw different `latest` documents cannot install different things over each other, and nothing published between the check and the install slips in |
| **One installer in flight per version** | `.rsc/auto-update.json` holds `{from, to, startedAt}`; `AUTO_RUNNING_MS = 15 min` | A second session opened while an update is installing prints *"still installing itself in the background"* and **launches nothing** |
| **One attempt per version per day** | `AUTO_RETRY_MS = 24 h` | A failed background install falls back to **asking**, with the log path, instead of retrying on every session open |

And the "partially activated" half, which is a different mechanism in a different place: an update **takes effect in the next session**, never mid-session — the skills for this session are already loaded — and the install that applies it is the transaction of §4.2, which rolls back whole.

Verified by execution, `gr15`, counting **launches** rather than reading the lock file, because "it wrote a state file" and "it did not start a second installer" are different claims: first session → 1 launch and the state file names `3.7.0 → 3.7.9`; second session inside the window → **still 1**; backdated one hour → it asks, *"retries once a day"*, **still 1**; backdated 25 hours → **2**, and exactly 2. Mutated: with the in-flight guard removed (`since = Infinity`), the second session launches a second installer and `gr15` goes red.

**Not verified:** the guard is per project directory, so it does not serialise two different projects updating at once — they are independent `npx` runs writing to different trees, which is not a race the mechanism claims to arbitrate. And no test runs two sessions *concurrently*; `gr15` runs them in sequence, which is the state machine's own unit of work (`startedAt` vs now), not a thread race.

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

1. **`rscg restore` says it — in the dry run as well as in the real restore.** After a real restore it names every base that came back without a contract, states that *the restore is correct*, says a sync puts them back and that the transformation is idempotent, and points at `rscg conformance`. It is silent when nothing came back ungoverned (`gr04`, `gr05`).

   **This was broken when the first version of this document was written, and M3 of the independent review found it.** The whole block lived inside `if (!dry)`, so `restore --dry-run` — the one tool whose entire job is to help you decide **whether** to restore — printed nothing. Reproduced here on the same four-step scenario as above, before changing anything: dry run → **0 warning lines**, exit 0; real restore → `⚠️  1 restored skill base(s) carry NO governance contract: flutter — no governance block`. (The review's own run named `analyze`; the skill depends on the fixture, the behaviour does not.) Every sentence in this document was literally true and the product withheld the consequence at the moment of the decision.

   **The fix, and why it is not just moving the block.** The two modes have to audit **different bytes**. After a real restore the project *is* the answer, so the installed files are audited (`ungovernedAmong`). In a dry run nothing has moved — the installed base is typically the **governed** one the restore is about to replace — so auditing the project would answer the wrong question and report nothing. The dry run audits the bytes the **snapshot holds**, read out of its own `files/.rsc/skills/*/SKILL.md` by `snapshotSkillBases()`, through the same `auditBase` as criterion 4. A base the snapshot recorded as absent stores no content and is correctly absent from the audit: a path that will not come back cannot come back ungoverned. The message is in the conditional (*"would be correct"*, *"would no longer point at"*), because nothing has happened yet.

   Pinned by `gr02b`, which asserts the finding comes from the snapshot by first checking the **installed** base is governed — so the weaker fix that audits the project fails it — and by `gr02c`, which asserts silence when the snapshot holds governed bases, so a warning printed unconditionally fails too. Mutated both ways.
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
- **A check that cannot run prints `SKIP`, never `PASS` — and the exit code says so too.** `skills-invariant` needs an `origin/main` ref; in a clone without one it says so and says what would make it runnable. The first version of this bullet stopped at the label, and that was the gap M1 of the independent review measured: the label said `SKIP` while the **exit code** said `0`, including for the check that *is* the Strategy B invariant, and `prepublishOnly` reads the exit code. Corrected by the coordinator, verified with the reviewer's own experiment: the copy without `.git` that exited `0` now exits `1`, this tree still exits `0` because nothing skips here, and a **missing** validator is now a `fail` — "a check that cannot be found is a failed check, not a skipped one" — because deleting a script used to buy a pass. `--allow-skip` accepts a gap deliberately, and never for a publish.

The composition is not invented here: `ARCHITECTURE.md` §"Qué se adopta, qué se arregla, qué se descarta" already ruled on every inherited check, and this gate is the four it adopts plus the two the fork added plus the Strategy B invariant. The "130 s" figure that document quoted was a manual sum of six scripts; the gate measures **seconds, not minutes**, with the 22× spread documented above.

### 5.1 `prepublishOnly` is the gate, and nothing else — because the composition was vacuous

It used to be `npm run manifest && npm run gate`, and B6 of the independent review named why that is worse than it looks: the gate's second check is `manifest:check`, so the publish **regenerated `manifest.json` and then verified the file it had just written**. Measured on a two-skill fixture with one directory removed:

```
$ node scripts/build-manifest.js --check            # against the COMMITTED manifest
manifest.json is stale — run `npm run manifest`                                   EXIT 1

$ node scripts/build-manifest.js && node scripts/build-manifest.js --check   # the old chain
manifest OK (1 skills, 34 agents, 33 commands)                                    EXIT 0
```

The consequence is not only a check that cannot fail: a publish could **ship a manifest different from the committed one and leave no record of having done so**. `prepublishOnly` is now `npm run gate` alone, so the manifest is **checked before anything regenerates it** — a stale manifest stops the publish and the fix is `npm run manifest` plus a commit, which is the state a release should be in anyway. `npm version` still regenerates and stages it, which is where that belongs. Pinned by `gg26`, which **expands the chain out of `package.json` and `CHECKS`** rather than asserting a string, and then runs the expanded steps against a truncated catalog; restoring the old composition turns it red.

---

## 6. Residual limitations

| # | Limitation | Why it stands |
|---|---|---|
| **L-D1** | **npm provenance is unavailable.** | Actions are disabled (`{"enabled":false}`). npm requires a supported cloud CI/CD provider and a cloud-hosted runner. `release.yml` is provenance-ready and cannot run. |
| **L-D2** | **Trusted Publishing is not configured.** | Same precondition. It is the right destination and it would deliver provenance automatically; configuring an OIDC trust for a workflow that cannot run would be unverifiable. |
| **L-D3** | **2FA is NOT VERIFIED.** | It is an npm account setting and reading it needs the maintainer's session, which the isolation rules forbid these processes from having (`npm profile get` → `E401` under the sandboxed `HOME`). The repository owner must confirm it. |
| **L-D4** | **Nothing is published; the registry half of the artifact check is still open.** | No publish and no registry-authenticated dry run was performed. `@lema017/rsc-governed` → `404`. The **local** half of §10's *"verifica identidad, versión e integridad del artefacto"* is now verified by execution (see below), but "the published artifact installs cleanly **from the registry**" remains untested, and that is a different claim. |
| **L-D5** | **The frozen catalog names the parent 81 times, 10 of them in the always-on body**, and **all 81 are `npx @ericrisco/rsc` — runnable commands, not prose.** | Strategy B freezes `skills/`; `PLAN.md` §3 assigns the rewrite to the transformation, whose reversibility property (`stripGovernance(transform(x)) === x`, asserted in `tests/governance-base.test.js`, **not** in `md-block-fidelity` — see `DESIGN.md` §2) and always-on byte-identity claim belong to other stages. Counted and pinned by `gi13` so it cannot drift silently. Heaviest: `init/references/recommend-skills.md` 15, `suggest/SKILL.md` 10 (the always-on body), `suggest/evals/cases.yaml` 8. **One of two open items that bear directly on §10**; the other is L-D10. |
| **L-D6** | **An existing consumer of the parent keeps watching the parent until it runs the fork once.** | Their `.rsc/auto-update.mjs` is a copy inside their project. One run of the fork rewrites it. |
| **L-D7** | **Windows is not validated by execution.** | No Windows environment. On Windows the installer copies real files instead of symlinking, which is correct by design; the conformance audit measures that case by comparing the whole subtree against the base, and that path has never been run. |
| **L-D8** | **Rule 14 of the conflict-record format is not instrumented.** | "A position marked `FIXTURE` is never counted as project evidence by any downstream step" is a property of a downstream step, not of a file, so there is nothing in the validator to check. Declared rather than counted as covered. |
| **L-D9** | **`npm test` is not a binary gate.** | `tests/knowledge-sync.test.js` is non-deterministic in **pristine upstream**, which fails a strict superset of the cases this fork does (D12). The authoritative run is 1 588 tests / 6 failures / 0 cancelled / 1 h 33 m, with all six attributed and none new. |
| **L-D10** | **The product surface outside `skills/` still names the parent, and it is NOT frozen by anything.** 138 bare-token references over 9 tracked paths — and they are **two different decisions**, not one find-and-replace. | **(a) Specifier, 49:** `@ericrisco/rsc` in `README.md` (18), `site/index.html` (13), `site/es/index.html` (13), `site/llms.txt` (4), `site/diagram.svg` (1). This is the class D16's identity map rewrites and the class that is **runnable**. **(b) URL, 89:** upstream's Pages host, upstream's repository and — twice per site page, in JSON-LD — the **author's profile**, which MIT attribution requires keeping. A token map over the bare word would make 404s of the first two and strip attribution from the third: the mem-slop trap of `gi04`, one scale up. Some should become the fork's (the site's own canonical links, the GitHub-API stars fetch in `site/assets/rsc.js`, `SECURITY.md`'s advisory form), some should stay upstream's. **Stage 7 owns the work** (`PLAN.md` assigns README, images and documentation there); stage 6 owes the declaration, and owed it from the start. Pinned per path and per class by `gg25`, which sweeps **every tracked path outside `skills/`** with a dated exception list it is designed to force empty. |
| **L-D11** | **Rule 12 / rule 8 of the project-artifact validators is a lexical heuristic with unmeasured recall.** | A disabling verb plus a guarded noun, minus the negations. Three plain paraphrases that ask for a guard to be turned off name no verb in the list and are not detected, and the set of English paraphrases is not enumerable. Declared the way rule 14 is declared, and pinned by `gg13c` so the declared gap is a stated limit rather than a surprise. See `DESIGN.md` §6. |

**Two facts that separate the halves of L-D10, because they are not the same problem:**

- **`README.md` travels in the tarball.** Verified by packing and installing: it is at the root of the installed package, so it is what a consumer reads in `node_modules` **and** it is the npm package page. It carries **10 runnable `npx @ericrisco/rsc…` lines**, an `npm i -g @ericrisco/rsc`, and the sentence *"`package.json` is named `@ericrisco/rsc`"*, which is **false today**.
- **`site/` ships zero files.** `files` is `scripts targets schema skills manifest.json`, so the site is a **Pages** surface, not a package surface. It is still a real problem — `site/llms.txt` is the **instruction file for agents** (*"Run: `npx @ericrisco/rsc@latest onboard`"*) and `site/assets/rsc.js` fetches the **parent** repository's stars, so the fork's own site would show the parent's — but it reaches visitors, not `node_modules`.

**What L-D5 and L-D10 mean for acceptance criterion 13** — *"Actualización automática desde el fork, sin reinstalar el padre, con activación coherente y sin estados parciales"* — stated rather than rounded up:

| Half of criterion 13 | Verdict |
|---|---|
| The fork's own update machinery never reaches the parent | ✅ **verified by execution** — `gi05`, `gi06`, `gi10`, `gi11`: the registry URL, the `npx` argv, the installed hook copy and every fork-written artifact |
| Coherent activation in the next session, no partial states | ✅ **verified** — same-major installs itself pinned to the exact version seen and takes effect next session (`gi07`); the onboarding transaction rolls back whole and leaves no accepted receipt, measured against the tree as it was before the transaction (`gr11`) |
| **No races between concurrent activations** | ✅ **verified by execution** — `gr15` counts launches: one installer in flight per version per project, one attempt per version per day, and the version pinned to the one the session saw. §3.5 states what it does **not** cover |
| **Nothing instructs a consumer to reinstall the parent** | ❌ **NOT met, in two places.** The always-on body, re-emitted every session, says `npx @ericrisco/rsc add <id>` (L-D5) — **and** `README.md`, which travels in the tarball and is the npm page, carries 10 runnable `npx @ericrisco/rsc…` lines plus a sentence about the package name that is false (L-D10). `site/llms.txt`, the instruction file for agents, says `npx @ericrisco/rsc@latest onboard`. The *mechanism* is clean; the *instruction surface* is not, and it is wider than the catalog |

So criterion 13 is **three quarters verified and one quarter open**, and the open quarter is L-D5 **and** L-D10. It is recorded that way here rather than as a tick, because a criterion marked green on the strength of its verified halves is exactly the kind of claim this project has spent five stages learning to distrust — and because the first version of this section called L-D5 *"the one open item that bears directly on §10"*, which was **false**: it was one of two, and the other one ships in the tarball.

---

## 7. Where to look next

- [`DESIGN.md`](./DESIGN.md) — why each of these was built the way it was, in Spanish, for whoever maintains it.
- [`VERIFICATION.md`](./VERIFICATION.md) — every command that produced a number above, with its output.
- [`../stage1/CONTRACT.md`](../stage1/CONTRACT.md) — the governance contract itself.
- [`../stage3/BROWNFIELD.md`](../stage3/BROWNFIELD.md) — the procedure `rscg brownfield` hands over, also shipped to `.rsc/governance/brownfield-v1.md`.
