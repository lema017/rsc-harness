// Fork test. Upstream's knowledge sync brings a teammate's knowledge changes into your branch, and
// a file the exchange branch no longer has is removed locally with `git rm`. That `rm` fires exactly
// when YOU never touched the file, which is the condition under which a project's skill customization
// is most defenceless.
//
// The approved scope (PLAN.md §4, B-R1) first said to exclude `02-DOCS/wiki/skills/` from checkout,
// rm and push alike. Measured, that would have cost more than it bought: customizations would stop
// propagating between teammates, and propagating them is half of why they exist — they are the team's
// decisions about a skill. The user chose the narrower rule: exclude the DELETE only.
//
// So this file pins both halves, because an exclusion that is too wide is as wrong as one that is too
// narrow, and only the control below can tell them apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { applyIncoming, KNOWLEDGE_BRANCH, isGoverned } from '../targets/knowledge-sync.mjs';

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const write = (repo, rel, body) => {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), body);
};

const CUSTOM = '02-DOCS/wiki/skills/flutter/README.md';
const CONTROL = '02-DOCS/wiki/other/note.md';
const MINE = 'Riverpod is the approved convention here.\n';

/**
 * A remote, a seed that pushes both files to `main` and to the exchange branch, and a local clone
 * that has touched neither. Then a teammate deletes both on the exchange branch.
 */
function team() {
  const tmp = mkdtempSync(join(tmpdir(), 'rsc-gks-'));
  const remote = join(tmp, 'remote.git');
  git(tmp, 'init', '-q', '--bare', '-b', 'main', remote);

  const seed = join(tmp, 'seed');
  git(tmp, 'clone', '-q', remote, seed);
  git(seed, 'config', 'user.name', 'Seed');
  git(seed, 'config', 'user.email', 'seed@x');
  write(seed, CUSTOM, MINE);
  write(seed, CONTROL, 'a note everyone shares\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'seed');
  git(seed, 'push', '-q', 'origin', 'main');
  git(seed, 'push', '-q', 'origin', `main:${KNOWLEDGE_BRANCH}`);
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');

  // The teammate, with an identity of their own so the message can name them.
  const ana = join(tmp, 'ana');
  git(tmp, 'clone', '-q', remote, ana);
  git(ana, 'config', 'user.name', 'Ana');
  git(ana, 'config', 'user.email', 'ana@x');
  git(ana, 'checkout', '-q', '-B', KNOWLEDGE_BRANCH, `origin/${KNOWLEDGE_BRANCH}`);
  git(ana, 'rm', '-q', CUSTOM, CONTROL);
  git(ana, 'commit', '-q', '-m', 'drop both');
  git(ana, 'push', '-q', 'origin', KNOWLEDGE_BRANCH);

  // Me: a clone that has touched neither file, which is what makes `take` fire.
  const eric = join(tmp, 'eric');
  git(tmp, 'clone', '-q', remote, eric);
  git(eric, 'config', 'user.name', 'Eric');
  git(eric, 'config', 'user.email', 'eric@x');
  git(eric, 'fetch', '-q', 'origin', KNOWLEDGE_BRANCH);

  return { tmp, eric };
}

test('gks01 · a teammate deleting a customization does NOT delete mine, and I am told who did it', () => {
  const { tmp, eric } = team();
  try {
    const said = applyIncoming(eric, { seenBy: {}, ours: ['eric@x'] });

    assert.equal(readFileSync(join(eric, CUSTOM), 'utf8'), MINE,
      'the customization must survive byte for byte — REQUIREMENTS §5: it must not be lost');

    // The first version of this assertion was `said.some(l => /flutter/.test(l) && /Ana/.test(l))`,
    // and it passed with the refusal disabled: `byAuthor` renders «de Ana: flutter/README.md» inside
    // the ordinary «📥 Traídos» line, so the ordinary message satisfied it. An assertion that can be
    // satisfied for the wrong reason is not an assertion. It has to be the refusal itself.
    const refusal = said.find((l) => /No lo aplico/.test(l));
    assert.ok(refusal, `the refusal must be reported. Got: ${JSON.stringify(said)}`);
    assert.match(refusal, /flutter/, 'the refusal must name the file');
    assert.match(refusal, /Ana/, 'the refusal must name who deleted it');

    // And the reporting must be coherent: nothing may claim to have brought what it refused.
    const brought = said.find((l) => l.startsWith('\u{1F4E5}'));
    if (brought) assert.doesNotMatch(brought, /flutter/,
      'the customization was refused, so the "brought" line must not list it');
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('gks02 · CONTROL: an ordinary knowledge file deleted the same way IS removed', () => {
  const { tmp, eric } = team();
  try {
    applyIncoming(eric, { seenBy: {}, ours: ['eric@x'] });

    // Without this the test above would pass just as well if the whole delete path were broken, or if
    // the exclusion were a blanket one. This is the half that proves the rule is narrow.
    assert.equal(git(eric, 'ls-files', '--', CONTROL), '',
      'a non-customization deletion must still be applied: the exclusion is the delete of a customization, not the delete');
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('gks03 · the predicate is a prefix over the subtree, and nothing wider', () => {
  assert.equal(isGoverned('02-DOCS/wiki/skills/flutter/README.md'), true);
  assert.equal(isGoverned('02-DOCS/wiki/skills/nextjs/references/state.md'), true);
  // Neighbours that must stay ordinary knowledge. `02-DOCS/wiki/skillsets/` is the one that an
  // `includes`-style or loosely anchored check would swallow.
  assert.equal(isGoverned('02-DOCS/wiki/skillsets/team.md'), false);
  assert.equal(isGoverned('02-DOCS/wiki/index.md'), false);
  assert.equal(isGoverned('02-DOCS/wiki/harness/user-profile.md'), false);
});
