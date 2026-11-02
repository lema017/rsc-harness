# Security policy

This is `rsc-governed`, a governed fork of
[`ericrisco/rsc-harness`](https://github.com/ericrisco/rsc-harness) (© 2026 Eric Risco, MIT).
Where to send a report depends on which of the two the bug belongs to.

## Reporting a vulnerability

### In this fork's own code

**This fork has no private reporting channel enabled yet.** Checked, not assumed: GitHub's private
vulnerability reporting on `lema017/rsc-harness` returns `{"enabled":false}`, and issues are
disabled on the repository. So there is nowhere here to file a private report today.

Until the repository owner turns one on, contact the owner of
[`lema017/rsc-harness`](https://github.com/lema017) directly and say you have a security finding
about `rsc-governed`. **Do not open it anywhere public first** — and since issues are off, the usual
accidental-public-disclosure route is at least closed by default.

What this fork owns, and is therefore in scope here: the governance transformation, the governance
preamble and always-on body, the customization reader and validator, the conformance and brownfield
commands, the identity rename, the auto-update path and the upstream-maintenance machinery.

### In code inherited from `rsc-harness`

Report it to the parent, which **does** have private reporting enabled
(`{"enabled":true}`, checked): **[report to `ericrisco/rsc-harness`](https://github.com/ericrisco/rsc-harness/security/advisories/new)**.
That is the right place for anything in the installer, the hooks, the assistant adapters or the
skill catalog as upstream ships them — a fix there reaches every user of both projects, and this
fork picks it up at the next maintenance run. Telling us too is welcome, so the fix is tracked here.

If you are unsure which it is, say so and report it once; a misrouted report costs a forward, and a
public zero-day costs everyone.

A useful report says what you did, what happened, and what you expected. A reproduction beats a
description. You do not need a proof of concept, a CVSS score or a suggested patch.

**What to expect.** This is an unfunded project: there is no bug bounty and no SLA. There is also
**nothing published yet** — `@lema017/rsc-governed` is not on npm — so today a fix is a commit, not
a release. Your finding gets credited unless you would rather it did not.

## What this is, so scope is not a guess

`rsc-governed` is a local command-line tool. It installs skill content into an AI assistant's
directories, writes hooks that the assistant then runs on your machine, and keeps session records
under `.rsc/`. It has no server, no accounts and no network service. The interesting attack surface
is where **someone else's input reaches your machine or your assistant**:

- **`.rsc.json` and `.rsc.fork.json`** travel through git, so their contents are written by anyone
  who can open a pull request, and parts of them are read back into the model's context. Anything
  that escapes validation and lands in that text is worth reporting.
- **Per-skill customizations at `02-DOCS/wiki/skills/<skill>/README.md`** are this fork's own
  addition and the same shape of risk, with more reach: they also travel through git, and the
  contract instructs the assistant to **read them before applying the skill**. A customization that
  can steer the assistant beyond the scope it declares, or that escapes the schema validator into
  the context verbatim, is a finding here even though the mechanism is prose.
- **Hooks** are wired into your assistant's settings and run commands. A path that lets a repository
  decide what those commands are is a real finding.
- **Session records and memory** hold your work. Anything that makes them readable from a project,
  worktree or scope that should not see them counts, and so does anything that writes them where
  they were not meant to go.
- **Skill and agent content**, including the governance preamble, is injected into the model's
  context. Content that can make the assistant act against the user's intent is in scope.
- **The installer** writes into directories you share with your own work. Anything that overwrites
  or deletes what `rscg` did not create is a finding, whether or not it is exploitable.
- **The update path.** `targets/auto-update.mjs` decides which package a project installs in the
  background. Anything that can redirect it — to the parent, or anywhere else — is a finding of the
  most serious class this project has.

Out of scope: the assistants themselves (report those to their vendors), npm registry or GitHub
infrastructure, and anything that needs an attacker who already has your shell.

## Before you report a guard

The guards (commit conventions, dangerous-command denial, branch discipline) **fail open on purpose**
and each one has a documented per-project switch. That is an inherited design decision, written
down, not an oversight: a guard that guesses is a guard that gets turned off, and a harness that
blocks real work gets uninstalled. "The guard can be bypassed" is only a finding if the bypass makes
the guard **claim it is armed while it is not** — that one we do want to hear about.

Two things the fork states rather than defends, so they are not reported as discoveries:

- **Code-level denial exists today only on Claude Code.** On the other assistants the governance
  contract is text the model may ignore; the project documents that instead of implying enforcement.
- **A committed `.rsc.json` or `.claude/settings.json` can disarm a guard**, because both travel in
  git. Both are in [the README's limits](README.md#guarantees-and-limits).
