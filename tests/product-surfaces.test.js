// Product surfaces — the files a human or an agent reads FIRST.
//
// Stage 7. The delivery sweep (`tests/governance-identity.test.js`, D16) walks an *installed
// consumer project*; it cannot see `README.md`, `SECURITY.md` or `site/`, and those three are
// exactly where the parent's name survived: 18 parent specifiers in `README.md`, 10 of them on
// executable `npx` lines, and `site/llms.txt` — the instruction file for agents — telling them to
// run the parent. This test covers that blind spot.
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

const TEXT_EXT = new Set(['.md', '.html', '.txt', '.xml', '.json', '.js', '.mjs', '.svg', '.css']);

/** Every file a human or an agent reads before anything is installed. */
function surfaces() {
  const out = [];
  for (const top of ['README.md', 'SECURITY.md', 'site']) {
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
    line: '| Repository | [`' + PARENT_USER + '/rsc-harness`](https://github.com/' + PARENT_USER + '/rsc-harness) | [`lema017/rsc-harness`](https://github.com/lema017/rsc-harness) |',
    why: 'same identity table, repository row' },
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
const CLI_VERBS = [
  'onboard', 'reassess', 'add', 'install', 'consult', 'list', 'capabilities', 'conformance',
  'brownfield', 'audit', 'registry', 'doctor', 'sync', 'agents', 'memory', 'review', 'ingest',
  'copy', 'sello', 'worktrees', 'backups', 'restore', 'upgrade', 'repair', 'uninstall', 'purge',
].join('|');

function executableParentCommands(text) {
  const hits = [];
  const lines = text.split('\n');
  const runnerParent = new RegExp(`${RUNNERS}\\s+(?:-y\\s+)?${PARENT_PKG.replace('/', '\\/')}`, 'i');
  const runnerBare = new RegExp(`${RUNNERS}\\s+(?:-y\\s+)?rsc(?:@|\\s|\`|"|'|$)`, 'i');
  const bareVerb = new RegExp('(?:^|[\\s`>(\\[])rsc\\s+(?:' + CLI_VERBS + ')(?:[\\s`"\'<]|$)');
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
  for (const f of FILES) {
    for (const h of executableParentCommands(readFileSync(join(ROOT, f), 'utf8'))) {
      findings.push(`${f}:${h.n}  [${h.rule}]  ${h.line}`);
    }
  }
  assert.deepEqual(findings, [],
    `an executable command naming the parent reached a product surface:\n  ${findings.join('\n  ')}`);
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
});
