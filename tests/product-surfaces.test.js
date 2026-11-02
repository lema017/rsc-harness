// Product surfaces — the files a human or an agent reads FIRST.
//
// Stage 7. The delivery sweep (`tests/governance-identity.test.js`, D16) walks an *installed
// consumer project*; it cannot see `README.md`, `SECURITY.md` or `site/`, and those three are
// exactly where the parent's name survived: 18 parent specifiers in `README.md`, 10 of them on
// executable `npx` lines, and `site/llms.txt` — the instruction file for agents — telling them to
// run the parent. This test covers that blind spot.
//
// THREE THINGS THE INDEPENDENT REVIEW OF STAGE 7 FOUND HERE, all of them this file's fault:
//
//   `package.json` was not a surface. It is the file npm RENDERS, and the only one besides
//     `README.md` that enters the tarball, and its `bugs.url` pointed at an issues page that is
//     DISABLED — the exact pattern `ps04` forbids, in the one file `ps04` was not looking at. It is
//     in the swept set now.
//
//   The bare-command detector was blind to three ordinary shapes, and 9 of 11 probe lines walked
//     straight through it: a command that CLOSES A SENTENCE (`. , ) ;` were outside the suffix
//     class), the verbs `help` and `agent-model` (missing from the list, while the README's own
//     table shows `rscg help` — one letter apart), and a command inside a QUOTED STRING (`"` and
//     `'` were outside the prefix class), which is the shape the two site pages already use because
//     the command lives inside JSON-LD. Widening the prefix class immediately found a real defect
//     nothing had ever reported: `site/assets/rsc.js` typed `$ rsc onboard` into the animated
//     terminal on the landing page, in a quoted array element, in a file the stage had declared
//     clean at "0 specifiers".
//
//   `ps05`, the inverse assertion, did not cover `site/index.html` or `site/es/index.html`. Both
//     could have been stripped of the fork's identity and still passed all seven checks — the two
//     surfaces rewritten from 13 parent specifiers each.
//
// It separates two classes that look alike and must be decided differently:
//
//   SPECIFIER / COMMAND — the npm package name, or any line a reader or an agent could execute.
//     These always belong to the fork. A `site/` that ships zero files in the tarball still
//     instructs agents, and an instruction that installs the parent over the fork is the accident
//     REQUIREMENTS §10 exists to prevent.
//
//   URL — decided one at a time, because the fork does not own every page it needs to name.
//     A link that CREDITS the parent (the repository it is forked from, its author, its licence)
//     MUST keep pointing at the parent: rewriting it would erase the attribution MIT requires and
//     turn `ericrisco.github.io` / `github.com/ericrisco` into a 404 — `targets/memslop-offer.mjs`
//     already records that trap for a different project. A link a reader would follow to USE this
//     fork points at the fork. A fork page that does not exist is not invented.
//
// Every tolerated parent reference is listed below as an exact line with a written reason, and an
// allowance that stops matching is itself a failure — so the list cannot quietly rot.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const PARENT_PKG = ['@eric', 'risco/rsc'].join('');      // split so this file is not its own hit
const PARENT_USER = ['eric', 'risco'].join('');
const PARENT_PAGES_HOST = `${PARENT_USER}.github.io`;
const PARENT_REPO_URL = `https://github.com/${PARENT_USER}/rsc-harness`;
const FORK_PAGES_HOST = 'lema017.github.io';

/**
 * The branch the fork actually lives on, and the reason half the assertions below exist.
 *
 * `main` is still the PARENT's tree, untouched. Measured, not assumed:
 *
 *   $ git show origin/main:package.json   -> name @ericrisco/rsc, bin { rsc, rsc-install }
 *   $ git cat-file -e origin/main:scripts/lib/governance.js   -> does not exist on origin/main
 *   $ git ls-tree origin/main docs/       -> empty
 *
 * So anything that FETCHES this repository without naming this branch fetches the parent, and
 * anything that LINKS into the repository without naming it resolves against `main` and shows the
 * parent's README. A6 of the stage-7 review was exactly that defect in the README's primary call to
 * action, three sections below a passage that had already reasoned about this same fact to choose
 * relative image paths.
 *
 * WHEN THE BRANCH MERGES: change this constant to 'main' in the same commit, and `ps07` will then
 * require every pin to move with it — including the `-b` flag in the README, which exists only
 * until that merge.
 */
const FORK_BRANCH = 'fork/bootstrap';

const TEXT_EXT = new Set(['.md', '.html', '.txt', '.xml', '.json', '.js', '.mjs', '.svg', '.css']);

/** Every file a human or an agent reads before anything is installed. */
function surfaces() {
  const out = [];
  // `package.json` is here because npm renders it and it travels in the tarball — the review found
  // it was the one product surface with no sweep over it at all.
  for (const top of ['README.md', 'SECURITY.md', 'package.json', 'site']) {
    const abs = join(ROOT, top);
    if (!existsSync(abs)) continue;
    const walk = (p) => {
      const st = statSync(p);
      if (st.isDirectory()) { for (const e of readdirSync(p).sort()) walk(join(p, e)); return; }
      if (TEXT_EXT.has(extname(p))) out.push(relative(ROOT, p));
    };
    walk(abs);
  }
  return out;
}

/**
 * Attribution the fork keeps on purpose. Exact line, exact file, with the reason it stays.
 * Anything carrying the parent's name and NOT listed here is a failure.
 */
const ALLOWED = [
  { file: 'README.md',
    line: '**A governed fork of [`rsc-harness`](https://github.com/' + PARENT_USER + '/rsc-harness).**',
    why: 'the subtitle naming what this is a fork of; the link must resolve to the parent' },
  { file: 'README.md',
    line: 'This repository is a **GitHub fork of [`' + PARENT_USER + '/rsc-harness`](https://github.com/' + PARENT_USER + '/rsc-harness)**,',
    why: 'attribution sentence; same reason' },
  { file: 'README.md',
    line: 'created and maintained by [Eric Risco](https://github.com/' + PARENT_USER + '). It is not affiliated with or',
    why: 'credit to the original author; the profile link belongs to him' },
  { file: 'README.md',
    line: '| npm package | [`' + PARENT_PKG + '`](https://www.npmjs.com/package/' + PARENT_PKG + ') | `@lema017/rsc-governed` *(not published yet)* |',
    why: 'the identity table states what the parent package IS; it is a citation in a comparison '
       + 'row, never an instruction, and the fork cell beside it carries the fork specifier' },
  { file: 'README.md',
    line: '| Repository | [`' + PARENT_USER + '/rsc-harness`](https://github.com/' + PARENT_USER + '/rsc-harness) | [`lema017/rsc-harness`](https://github.com/lema017/rsc-harness/tree/' + FORK_BRANCH + ') *(on `' + FORK_BRANCH + '`; `main` is still upstream\'s tree)* |',
    why: 'same identity table, repository row. The fork half carries the branch because a reader '
       + 'CLICKS this one, and the bare repository URL resolves against the default branch, which '
       + 'is still the parent\'s tree' },
  { file: 'README.md',
    line: '**The parent.** `rsc-harness` — [`' + PARENT_USER + '/rsc-harness`](https://github.com/' + PARENT_USER + '/rsc-harness),',
    why: 'the credits section; MIT requires the notice and the link has to reach the parent' },
  { file: 'SECURITY.md',
    line: '[`' + PARENT_USER + '/rsc-harness`](https://github.com/' + PARENT_USER + '/rsc-harness) (© 2026 Eric Risco, MIT).',
    why: 'states which project this is forked from, so a reporter can route the finding' },
  { file: 'SECURITY.md',
    line: '(`{"enabled":true}`, checked): **[report to `' + PARENT_USER + '/rsc-harness`](https://github.com/' + PARENT_USER + '/rsc-harness/security/advisories/new)**.',
    why: 'inherited code is upstream\'s to fix and upstream has private reporting enabled; this '
       + 'fork does not, so routing the reporter there is the only working channel' },
  { file: 'site/llms.txt',
    line: '> A governed fork of rsc-harness (github.com/' + PARENT_USER + '/rsc-harness, (c) 2026 Eric Risco, MIT),',
    why: 'the agent instruction file must say whose work this is before it says what to run' },
  { file: 'site/llms.txt',
    line: '- [Forked from](' + PARENT_REPO_URL + '): rsc-harness by Eric Risco, MIT — the upstream this tracks',
    why: 'the one attribution link in the key-links list' },
];

/**
 * The ONE class of bare parent command that stays, with the reason, the bound and the date.
 *
 * `package.json`'s `rscFixes` is a symptom log inherited from upstream: `{ fixedIn, symptom }` pairs
 * read off the registry's `/latest` document by `targets/auto-update.mjs`, which prints the symptom
 * verbatim when a project's installed version is older than `fixedIn`. Three of those strings name
 * `rsc doctor` / `rsc capabilities`, and the honest reading is that they are HISTORY, not
 * instructions: they describe what the parent's CLI did wrong at 2.0.8, 2.0.19 and 2.0.20. Rewriting
 * them to say `rscg` would claim the fork shipped those bugs and those fixes.
 *
 * The bound that makes them harmless, and it is checked below, not asserted in prose: every
 * `fixedIn` in this file is BELOW the fork's own version, so `fixesSince(installed, latest)` can
 * never select one for a consumer of this package — the fork's first publishable version is 3.7.4
 * and a consumer cannot be on anything older than that.
 *
 * What is NOT excused by this: the same strings would be a real defect if `rscFixes` ever gained an
 * entry at or above the fork's version, and `ps01` fails on it then.
 */
const ALLOWED_COMMANDS = [
  { file: 'package.json', rule: "the parent's bare `rsc` command with a subcommand",
    needle: 'rsc doctor reports commandOrphans',
    why: "inherited `rscFixes` symptom for 2.0.8 — upstream's bug report, below the fork's floor" },
  { file: 'package.json', rule: "the parent's bare `rsc` command with a subcommand",
    needle: 'rsc doctor reported missing pieces',
    why: 'inherited `rscFixes` symptom for 2.0.19, same reason' },
  { file: 'package.json', rule: "the parent's bare `rsc` command with a subcommand",
    needle: 'rsc doctor reported every hook script as missing',
    why: 'inherited `rscFixes` symptom for 2.0.20, same reason' },
];

/** Allowances that apply to a fragment inside a long machine-generated line (JSON-LD, HTML). */
const ALLOWED_FRAGMENTS = [
  { files: ['site/index.html', 'site/es/index.html'],
    fragment: '"isBasedOn":"' + PARENT_REPO_URL + '"',
    why: 'schema.org attribution: declares the parent as the work this is based on' },
  { files: ['site/index.html', 'site/es/index.html'],
    fragment: '"name":"Eric Risco","url":"https://github.com/' + PARENT_USER + '","sameAs":["https://github.com/' + PARENT_USER + '"]',
    why: 'schema.org author node for the original author' },
  { files: ['site/index.html', 'site/es/index.html'],
    fragment: '<a href="' + PARENT_REPO_URL + '">Forked from rsc-harness</a>',
    why: 'the visible attribution link in the page footer links' },
];

/** A line that a person or an agent could execute. */
const RUNNERS = String.raw`(?:npx|bunx|pnpm\s+dlx|yarn\s+dlx|npm\s+(?:i|install|exec)(?:\s+-g|\s+--global)?)`;

/**
 * Every subcommand the CLI actually answers to, taken from the `COMMANDS` set in `scripts/rsc.js`
 * plus `help`. The previous list was hand-copied and missing `help`, `agent-model`, `catalog`,
 * `knowledge-sync`, `git-permissions`, `main` and `isolation` — and the README's own command table
 * prints `rscg help`, so a missing `g` on that line was invisible to every check in this file.
 */
const CLI_VERBS = [
  'onboard', 'reassess', 'add', 'install', 'consult', 'list', 'catalog', 'capabilities',
  'conformance', 'brownfield', 'audit', 'registry', 'doctor', 'sync', 'knowledge-sync',
  'git-permissions', 'agent-model', 'agents', 'main', 'isolation', 'memory', 'review', 'ingest',
  'copy', 'sello', 'worktrees', 'backups', 'restore', 'upgrade', 'repair', 'uninstall', 'purge',
  'help',
].join('|');

/**
 * What may sit immediately BEFORE the bare binary, and immediately AFTER the subcommand.
 *
 * Both classes were too narrow, and the gap was not theoretical in either direction:
 *
 *   PREFIX gained `"` `'` and `·`. The two site pages carry their commands inside JSON-LD strings
 *     and inside a `·`-separated prompt line, so a quoted `"rsc onboard"` was unreachable. That
 *     widening found `site/assets/rsc.js` typing `$ rsc onboard` into the landing page's animated
 *     terminal, as a quoted array element, which no sweep had ever seen.
 *   SUFFIX gained `. , ; : ! ? ) ] }`. Without them a parent command that simply ENDED A SENTENCE —
 *     "Then run rsc onboard." — passed all seven checks in this file.
 *
 * What is deliberately NOT in the prefix class: `/` and `-`. `@lema017/rsc-governed`,
 * `scripts/rsc.js` and `rsc-install` must stay clean, and they are the shapes this file's own
 * documentation and install lines use. `ps06` holds both directions.
 */
const CMD_PREFIX = '(?:^|[\\s`>(\\[\'"·])';
const CMD_SUFFIX = '(?:[\\s`"\'<.,;:!?)\\]}]|$)';

function executableParentCommands(text) {
  const hits = [];
  const lines = text.split('\n');
  const runnerParent = new RegExp(`${RUNNERS}\\s+(?:-y\\s+)?${PARENT_PKG.replace('/', '\\/')}`, 'i');
  const runnerBare = new RegExp(`${RUNNERS}\\s+(?:-y\\s+)?rsc(?:@|\\s|\`|"|'|$)`, 'i');
  const bareVerb = new RegExp(`${CMD_PREFIX}rsc\\s+(?:${CLI_VERBS})${CMD_SUFFIX}`);
  lines.forEach((line, i) => {
    for (const [re, rule] of [[runnerParent, 'runner + parent specifier'],
                              [runnerBare, "runner + the parent's bare `rsc` binary"],
                              [bareVerb, "the parent's bare `rsc` command with a subcommand"]]) {
      if (re.test(line)) hits.push({ n: i + 1, rule, line: line.trim().slice(0, 160) });
    }
  });
  return hits;
}

function parentMentions(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    if (line.includes(PARENT_PKG) || line.includes(PARENT_USER)) hits.push({ n: i + 1, line });
  });
  return hits;
}

const FILES = surfaces();

test('ps00 · the sweep actually has surfaces to look at', () => {
  assert.ok(FILES.includes('README.md'), 'README.md must be in the swept set');
  assert.ok(FILES.includes('SECURITY.md'), 'SECURITY.md must be in the swept set');
  assert.ok(FILES.some((f) => f.startsWith('site/')), 'site/ must be in the swept set');
  assert.ok(FILES.length >= 8, `expected a real surface set, got ${FILES.length}: ${FILES}`);
});

test('ps01 · no product surface carries an executable command naming the parent', () => {
  const findings = [];
  const usedAllowances = new Set();
  for (const f of FILES) {
    for (const h of executableParentCommands(readFileSync(join(ROOT, f), 'utf8'))) {
      const excused = ALLOWED_COMMANDS.find(
        (a) => a.file === f && a.rule === h.rule && h.line.includes(a.needle),
      );
      if (excused) { usedAllowances.add(excused.needle); continue; }
      findings.push(`${f}:${h.n}  [${h.rule}]  ${h.line}`);
    }
  }
  assert.deepEqual(findings, [],
    `an executable command naming the parent reached a product surface:\n  ${findings.join('\n  ')}`);

  // Same anti-rot rule `ps02` applies to attribution: an allowance that stops matching is a
  // failure, so the list empties itself instead of outliving the thing it excused.
  const stale = ALLOWED_COMMANDS.filter((a) => !usedAllowances.has(a.needle))
    .map((a) => `${a.file}: ${a.needle}`);
  assert.deepEqual(stale, [],
    `a command allowance matched nothing — delete it or re-justify it:\n  ${stale.join('\n  ')}`);

  // And the bound that makes those three harmless, measured rather than promised: no `rscFixes`
  // entry may reach the fork's own version, because one that did WOULD be printed to a consumer.
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const cmp = (a, b) => {
    const x = a.split('.').map(Number); const y = b.split('.').map(Number);
    for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  };
  const reachable = (pkg.rscFixes || []).filter((fx) => cmp(fx.fixedIn, pkg.version) >= 0)
    .map((fx) => fx.fixedIn);
  assert.deepEqual(reachable, [],
    'an `rscFixes` entry is at or above this package\'s version, so `targets/auto-update.mjs` can '
    + `print its symptom to a consumer. The inherited allowances above no longer hold: ${reachable}`);
});

test('ps02 · every remaining mention of the parent is declared attribution', () => {
  const unlisted = [];
  const usedLines = new Set();
  const usedFragments = new Set();

  for (const f of FILES) {
    const text = readFileSync(join(ROOT, f), 'utf8');
    for (const { n, line } of parentMentions(text)) {
      const exact = ALLOWED.find((a) => a.file === f && a.line === line.trim());
      if (exact) { usedLines.add(`${exact.file}::${exact.line}`); continue; }
      // A long generated line may carry several tolerated fragments; strip each declared one and
      // require that nothing of the parent is left over.
      let residue = line;
      let matchedAny = false;
      for (const fr of ALLOWED_FRAGMENTS) {
        if (!fr.files.includes(f)) continue;
        if (residue.includes(fr.fragment)) {
          residue = residue.split(fr.fragment).join('');
          usedFragments.add(fr.fragment);
          matchedAny = true;
        }
      }
      if (matchedAny && !residue.includes(PARENT_PKG) && !residue.includes(PARENT_USER)) continue;
      unlisted.push(`${f}:${n}  ${line.trim().slice(0, 150)}`);
    }
  }

  assert.deepEqual(unlisted, [],
    `undeclared reference to the parent on a product surface:\n  ${unlisted.join('\n  ')}\n`
    + 'Either point it at the fork, or add it to ALLOWED with the reason it must stay.');

  const staleLines = ALLOWED.filter((a) => !usedLines.has(`${a.file}::${a.line}`))
    .map((a) => `${a.file}: ${a.line.slice(0, 90)}`);
  assert.deepEqual(staleLines, [],
    `an attribution allowance no longer matches anything — re-justify or delete it:\n  ${staleLines.join('\n  ')}`);

  const staleFragments = ALLOWED_FRAGMENTS.filter((f) => !usedFragments.has(f.fragment))
    .map((f) => f.fragment.slice(0, 90));
  assert.deepEqual(staleFragments, [],
    `an attribution fragment allowance matched nothing:\n  ${staleFragments.join('\n  ')}`);
});

test("ps03 · the parent's Pages host never appears on a product surface", () => {
  const findings = [];
  for (const f of FILES) {
    readFileSync(join(ROOT, f), 'utf8').split('\n').forEach((line, i) => {
      if (line.includes(PARENT_PAGES_HOST)) findings.push(`${f}:${i + 1}  ${line.trim().slice(0, 140)}`);
    });
  }
  // Attribution never needs the parent's website: the repository URL is the credit, and a reader
  // following the parent's site would be reading the parent's install instructions.
  assert.deepEqual(findings, [],
    `the parent's Pages host reached a product surface:\n  ${findings.join('\n  ')}`);
});

test('ps04 · no surface links to a fork page that does not exist', () => {
  // Measured 2026-11-02: lema017.github.io/rsc-harness/ -> 404 (Actions disabled, Pages never
  // deployed); registry.npmjs.org/@lema017%2Frsc-governed -> 404 (never published);
  // repos/lema017/rsc-harness has_issues=false. Linking any of them is a broken promise.
  const FORBIDDEN = [
    { needle: 'npmjs.com/package/@lema017', why: 'the fork is not published to npm' },
    { needle: 'github.com/lema017/rsc-harness/issues', why: 'issues are disabled on the fork' },
  ];
  const findings = [];
  for (const f of FILES) {
    const text = readFileSync(join(ROOT, f), 'utf8');
    text.split('\n').forEach((line, i) => {
      for (const { needle, why } of FORBIDDEN) {
        if (line.includes(needle)) findings.push(`${f}:${i + 1}  [${why}]  ${line.trim().slice(0, 130)}`);
      }
      // The fork's Pages host is legitimate self-identification INSIDE site/ (canonical, og:url,
      // sitemap): those are not links a reader clicks, and they become correct the moment Pages is
      // enabled. In prose a reader does click — but only a LINK is a click, so naming the host as a
      // measured fact ("returns 404") is exactly what the limits section is for and must not trip.
      if (!f.startsWith('site/')) {
        const asLink = new RegExp(`(?:\\]\\(|href=["']|src=["']|https?://)[^\\s"')]*${FORK_PAGES_HOST.replace('.', '\\.')}`);
        if (asLink.test(line)) {
          findings.push(`${f}:${i + 1}  [fork Pages is not deployed]  ${line.trim().slice(0, 130)}`);
        }
      }
    });
  }
  assert.deepEqual(findings, [], `a link to a fork page that does not exist:\n  ${findings.join('\n  ')}`);
});

test('ps06 · the detectors fire on planted defects — the checks are not vacuous', () => {
  // Four instruments in this project have shipped a check that could not fail. This one asserts
  // the opposite on synthetic input, so the trap cannot be re-laid by a later edit that quietly
  // narrows a regex. The end-to-end version (planting a line in the real README, running the
  // suite, restoring) is recorded in docs/fork/stage7/VERIFICATION.md.
  const planted = [
    `npx ${PARENT_PKG}@latest onboard`,
    `Run \`npx ${PARENT_PKG}@latest onboard\` in the project root.`,
    `npm install -g ${PARENT_PKG}`,
    'npx rsc@latest onboard',
    '`rsc sync` keeps it current',
    '<code>rsc onboard</code>',
    // The three shapes the review measured this detector walking straight past. They are kept as
    // separate lines, not folded into one, because each one failed for its own reason and a single
    // combined probe would pass on any one of the three fixes.
    'Then run rsc onboard.',                        // suffix: a command that ends a sentence
    'Use rsc sync, then reload the assistant.',     // suffix: a comma
    '(see rsc doctor)',                             // suffix: a closing parenthesis
    'Run rsc list; it prints what is installed',    // suffix: a semicolon
    'rsc help',                                     // verb: absent from the old list
    'rsc agent-model claude opus',                  // verb: absent from the old list
    '"rsc onboard"',                                // prefix: a double quote (JSON-LD)
    "'rsc sync'",                                   // prefix: a single quote (JS array element)
    '"description":"rsc onboard installs the harness"',
    "['$ ', 't-acc', 'rsc onboard', 't-ink'],",     // the real `site/assets/rsc.js` line, verbatim
  ];
  for (const line of planted) {
    assert.equal(executableParentCommands(line).length > 0, true,
      `the executable-command detector missed: ${line}`);
  }
  const clean = [
    'npx @lema017/rsc-governed@latest onboard',
    '`rscg sync` keeps it current',
    'npm install -g @lema017/rsc-governed',
    '| CLI command | `rsc` | `rscg` |',             // the identity table names, not commands
    '`rsc-install` is the parent entry point',
    // The widened classes must not start firing on the fork's own shapes. These are the five the
    // README and `llms.txt` actually use, and `/` and `-` stay out of the prefix class for them.
    'node /path/to/rsc-harness/scripts/rsc.js onboard',
    '`node <clone>/scripts/rsc.js <command>`',
    'git clone -b fork/bootstrap https://github.com/lema017/rsc-harness.git',
    '"rscg onboard"',
    '`rscg catalog` prints all 274 ids; `rscg help` prints the rest',
  ];
  for (const line of clean) {
    assert.deepEqual(executableParentCommands(line), [],
      `the executable-command detector produced a false positive on: ${line}`);
  }
  assert.equal(parentMentions(`see https://github.com/${PARENT_USER}/rsc-harness`).length, 1,
    'the mention detector must see a parent URL');
  assert.equal(parentMentions('see https://github.com/lema017/rsc-harness').length, 0,
    'the mention detector must not see the fork as the parent');
});

test('ps05 · the fork identity is actually present where the parent used to be', () => {
  // The inverse assertion: a surface stripped of the parent but naming nothing would pass ps01-ps04.
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  assert.match(readme, /@lema017\/rsc-governed/, 'README must name the fork package');
  assert.match(readme, /npx @lema017\/rsc-governed@latest onboard/, 'README must show the fork install command');
  const llms = readFileSync(join(ROOT, 'site/llms.txt'), 'utf8');
  assert.match(llms, /npx @lema017\/rsc-governed@latest onboard/, 'llms.txt must instruct agents to run the fork');
  assert.match(llms, /rscg sync/, 'llms.txt must name the fork CLI, not the parent binary');

  // The two pages the review found uncovered. Each was rewritten from 13 parent specifiers, and
  // each could have been emptied of the fork's identity and still passed ps01-ps04: nothing to
  // install is not the same as nothing wrong.
  for (const page of ['site/index.html', 'site/es/index.html']) {
    const html = readFileSync(join(ROOT, page), 'utf8');
    assert.match(html, /npx @lema017\/rsc-governed@latest onboard/,
      `${page} must show the fork install command, not merely omit the parent's`);
    assert.match(html, /"@lema017\/rsc-governed"/,
      `${page}'s JSON-LD must name the fork package: that is the string an agent reads`);
    assert.match(html, /rscg onboard/, `${page}'s terminal must type the fork CLI`);
  }

  // `package.json` is the npm-rendered surface, and a fork that renamed nothing there would still
  // pass every negative check in this file.
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@lema017/rsc-governed');
  assert.deepEqual(Object.keys(pkg.bin).sort(), ['rscg', 'rscg-install']);
});

test('ps07 · nothing that fetches or links this fork resolves to the parent via the default branch', () => {
  // A3 of the stage-7 review, and the sharpest finding in it: the README's primary call to action
  // was `git clone https://github.com/lema017/rsc-harness.git`, then `node …/scripts/rsc.js
  // onboard`, then "prints `rscg 3.7.4`". A clone with no `-b` takes the DEFAULT branch, `main` is
  // the parent's tree, so a reader who obeyed the front page ran the PARENT's installer and got an
  // ungoverned base — the accident REQUIREMENTS §10 and D16 exist to prevent, surviving on the
  // cover. Its own stage had already reasoned about this exact fact, three sections above, to
  // choose relative image paths for the diagrams.
  //
  // This is the class of defect that cannot come back, so it is pinned structurally rather than by
  // string: any line that CLONES this repository names the branch, and any field npm uses as this
  // package's own destination names it too.
  const branchFlag = new RegExp(`-b\\s+${FORK_BRANCH.replace('/', '\\/')}\\b`);
  const findings = [];

  for (const f of FILES) {
    readFileSync(join(ROOT, f), 'utf8').split('\n').forEach((line, i) => {
      if (!/\bclone\b/.test(line)) return;
      if (!/lema017\/rsc-harness/.test(line)) return;
      if (!branchFlag.test(line)) {
        findings.push(`${f}:${i + 1}  [clone without -b ${FORK_BRANCH} takes the parent]  ${line.trim().slice(0, 130)}`);
      }
    });
  }

  // npm renders `homepage` and `bugs.url` as this package's own pages. Both pointed at the bare
  // repository, which resolves against the default branch — so "homepage" was the PARENT's README,
  // and `bugs.url` was an issues page that is DISABLED on this repository. A needle list cannot
  // catch the first of those: `…/rsc-harness#readme` names the fork and still shows the parent.
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  for (const [field, url] of [['homepage', pkg.homepage], ['bugs.url', pkg.bugs.url]]) {
    if (!url.includes(`/${FORK_BRANCH}`)) {
      findings.push(`package.json  [${field} resolves against the default branch]  ${url}`);
    }
  }

  // `site/llms.txt` is the file that exists because of D16: it is read by agents, not people, and
  // it told them to clone the repository with no branch and to read the README at a URL that
  // resolves to the parent's. Both are pinned here by name because this surface has no reader who
  // would notice.
  const llms = readFileSync(join(ROOT, 'site/llms.txt'), 'utf8');
  if (!branchFlag.test(llms)) findings.push('site/llms.txt  [the agent clone instruction names no branch]');
  if (!llms.includes(`lema017/rsc-harness/tree/${FORK_BRANCH}`)) {
    findings.push('site/llms.txt  [the "Repository and README" link resolves against the default branch]');
  }

  // A LINK into the fork's repository, in prose, is also a link to the parent's README while `main`
  // has not moved. `site/index.html` and `site/es/index.html` are the declared exception and the
  // reason is the one `ps04` already uses for the fork's Pages host: those are the page's own
  // navigation and self-identification (star button, footer, JSON-LD `codeRepository`), `site/`
  // ships ZERO files in the tarball, and the pages cannot be deployed at all while Actions are
  // disabled. Measured 2026-11-02: 9 such URLs in each page. They become correct on the same merge.
  const bareRepo = /(?:\]\(|href=["'])https:\/\/github\.com\/lema017\/rsc-harness(?:#readme)?(?=["')])/;
  for (const f of FILES) {
    if (f.startsWith('site/')) continue;
    readFileSync(join(ROOT, f), 'utf8').split('\n').forEach((line, i) => {
      if (bareRepo.test(line)) {
        findings.push(`${f}:${i + 1}  [a link into the fork repo with no branch shows the parent's README]  ${line.trim().slice(0, 120)}`);
      }
    });
  }

  assert.deepEqual(findings, [],
    'an instruction or a package field would hand the reader the PARENT:\n  ' + findings.join('\n  ')
    + `\n(If ${FORK_BRANCH} has merged into the default branch, change FORK_BRANCH at the top of `
    + 'this file to the new branch and retire the -b flag everywhere in the same commit.)');
});

test('ps08 · the customization example the README tells you to copy passes the real validator', async () => {
  // A4 of the stage-7 review. The README printed a worked customization and said «create this and
  // commit it» — and the fork's OWN validator reported two rule-6 errors on it: the decision named
  // no category and carried no `Evidence:` line. The prose beside it named the two rules the
  // example did satisfy (nine keys, both sections) and was silent about the one it broke, so a
  // reader would copy the shape, believe their decision was in force, and find it flagged.
  //
  // Prose cannot be tested. A FIXTURE can, so the block is now extracted from the README itself and
  // run through `validateCustomizationSource` — the same function `npm run gate` calls. If the
  // README ever teaches a shape the validator rejects, this fails before a reader can copy it.
  const { validateCustomizationSource, errorsOf } =
    await import('../scripts/lib/customization-validator.js');

  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const lines = readme.split('\n');
  const head = lines.findIndex((l) => l.startsWith('## Customizing a skill for your project'));
  assert.ok(head > 0, 'the README section that carries the example is gone — rename this test with it');

  let src = null;
  for (let i = head; i < lines.length && src === null; i += 1) {
    if (lines[i].trim() !== '```markdown') continue;
    const body = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim() === '```') { src = `${body.join('\n')}\n`; break; }
      body.push(lines[j]);
    }
  }
  assert.ok(src, 'no ```markdown fixture under the customization section');
  assert.match(src, /^---\n/, 'the fixture must start with frontmatter — this is a customization file');

  const where = '02-DOCS/wiki/skills/flutter/README.md';
  const found = validateCustomizationSource({ file: where, src, dirName: 'flutter', catalog: ['flutter'] });
  const findings = found.findings || found;
  assert.deepEqual(
    findings.map((x) => `${x.rule || x.id}: ${x.message || x.detail}`), [],
    'the README is teaching a customization its own validator rejects',
  );

  // NEGATIVE CONTROL, and it is the whole point: a validator that found nothing because it was
  // pointed at the wrong thing, or because the extraction returned an empty string, would report
  // exactly the same zero. Removing the one key the README makes a point of — `scope`, which it
  // says has no default — must produce a finding.
  const noScope = src.replace(/^scope:\n(?:[ \t]+-.*\n)+/m, '');
  assert.notEqual(noScope, src, 'the control did not actually remove `scope:` from the fixture');
  const control = validateCustomizationSource({ file: where, src: noScope, dirName: 'flutter', catalog: ['flutter'] });
  assert.ok(errorsOf(control).length > 0,
    'removing `scope:` produced no error, so this test proves nothing about the fixture');
});
