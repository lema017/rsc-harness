import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Stage 6 — THE FORK IDENTITY, and the §2 obligation it is most likely to break.
//
// Requirement §2 asks for two things that pull in opposite directions from a rename: "conservar las
// funciones originales del harness" and "mantener actualizaciones automáticas de los proyectos
// consumidores". §10 then asks for "un paquete con scope e identidad propia" and to review
// "actualizador, hooks, bootstrap, recuperación, comandos sugeridos, documentación y workflows para
// evitar reinstalar accidentalmente el padre".
//
// So the rename has a sharp edge: the auto-update mechanism holds the package name TWICE — in the
// registry URL it polls and in the `npx` argv it launches — and NEITHER is covered by the inherited
// tests, because they all set `RSC_LATEST`/`RSC_AUTO_UPDATE_CMD` to stay offline. A fork that
// renamed the package and left those two strings alone would ship a consumer that polls the PARENT
// and installs the PARENT over the fork, on a timer, in the background. That is risk 3 of PLAN §10
// and B-R2 of the audit, and these tests are what make it false.
//
// And the other half: the things that must NOT be renamed, because they are a consumer's on-disk
// contract. `.rsc/`, `.rsc.json`, `.rsc-state.json`, `.rsc/skills/` are read by the transformer, by
// the 18 adapters and by the criterion-4 instrument. Renaming them would break every existing
// installation, so the tests below assert they are UNCHANGED, which is as load-bearing as the
// assertions that something did change.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

const PACKAGE = '@lema017/rsc-governed';
const CLI = 'rscg';
const PARENT_PACKAGE = '@ericrisco/rsc';

const TMP = [];
function scratch(prefix) {
  const d = mkdtempSync(join(tmpdir(), prefix));
  TMP.push(d);
  return d;
}
test.after(() => { for (const d of TMP) rmSync(d, { recursive: true, force: true }); });

// ── the package's own identity ────────────────────────────────────────────────

test('gi01 · the package, the bin and the repository are the fork\'s, not the parent\'s', () => {
  assert.equal(PKG.name, PACKAGE);
  assert.deepEqual(Object.keys(PKG.bin).sort(), [CLI, `${CLI}-install`]);
  assert.equal(PKG.bin[CLI], 'scripts/rsc.js');
  assert.ok(!Object.hasOwn(PKG.bin, 'rsc'), 'the parent\'s command name must not be claimed: a global install of both would collide');
  assert.ok(!Object.hasOwn(PKG.bin, 'rsc-install'));
  for (const field of [PKG.homepage, PKG.repository.url, PKG.bugs.url]) {
    assert.match(field, /lema017\/rsc-harness/, `${field} still points at the parent repository`);
  }
});

test('gi02 · upstream authorship is preserved, which MIT requires and the fork owes anyway', () => {
  assert.equal(PKG.license, 'MIT');
  const license = readFileSync(join(ROOT, 'LICENSE'), 'utf8');
  assert.match(license, /Copyright \(c\) 2026 Eric Risco/, 'the copyright notice is not ours to remove');
  assert.ok(
    JSON.stringify(PKG.contributors || []).includes('Eric Risco'),
    'the upstream author is credited in the package metadata, not only in LICENSE',
  );
});

// ── nothing executable names the parent ───────────────────────────────────────

test('gi03 · no executable surface names the parent package — one documented exception', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, e.name);
      if (e.isDirectory()) { walk(path); continue; }
      if (!/\.(js|mjs|cjs|json|ya?ml|sh)$/.test(e.name)) continue;
      const text = readFileSync(path, 'utf8');
      if (text.includes(PARENT_PACKAGE)) offenders.push(path.slice(ROOT.length + 1));
    }
  };
  for (const dir of ['scripts', 'targets', 'schema', '.github']) walk(join(ROOT, dir));
  if (readFileSync(join(ROOT, 'package.json'), 'utf8').includes(PARENT_PACKAGE)) offenders.push('package.json');

  // Two files name the parent because naming it is their job, not because it leaked.
  // `scripts/lib/upstream-*.js` is the maintenance machine (stage 5), whose job is to LOOK FOR the
  // parent's name in the fork's artifacts. `scripts/lib/governance.js` is D16's identity map, whose
  // job is to REWRITE it: the token has to be written down somewhere, and the alternatives are both
  // worse — assembling it from fragments hides the one string a maintainer needs to grep for, and
  // renaming the module under the `upstream-` exception would be a lie, since `gi14` asserts those
  // files do NOT ship and a map needed at install time must.
  const EXCEPTED = [/upstream-/, /^scripts\/lib\/governance\.js$/];
  const real = offenders.filter((p) => !EXCEPTED.some((re) => re.test(p)));
  assert.deepEqual(real, [], `these still name ${PARENT_PACKAGE}:\n  ${real.join('\n  ')}`);

  // And the exception is a CHECKED property, not a hole: in the map module the parent's name may
  // appear only in its own declaration and in prose explaining it. Anywhere else — a template, an
  // argv, a default — the exception stops applying and this fails, which is the harm gi03 exists to
  // catch. (The first version of this assertion asked for "never inside a command" and fired on the
  // comment that quotes `npx @ericrisco/rsc add <id>` to explain why this module exists. A comment
  // cannot execute; the predicate was the imprecise part, so it was tightened rather than relaxed.)
  const map = readFileSync(join(ROOT, 'scripts', 'lib', 'governance.js'), 'utf8');
  const stray = map.split('\n')
    .map((line, i) => [i + 1, line])
    .filter(([, line]) => line.includes(PARENT_PACKAGE))
    .filter(([, line]) => !/^\s*(\/\/|\*|\/\*)/.test(line) && !/PARENT_PACKAGE\s*=/.test(line));
  assert.deepEqual(stray, [], 'in the identity map the parent may be named only by its declaration and by comments');
});

test('gi04 · and the mem-slop URL is deliberately NOT renamed: it is a different project', () => {
  // `targets/memslop-offer.mjs` offers a third-party tool that happens to share an author with the
  // parent harness. A blanket `grep ericrisco | sed` would have rewritten it into a 404, which is
  // why the rename was decided site by site rather than by one pass.
  const text = readFileSync(join(ROOT, 'targets', 'memslop-offer.mjs'), 'utf8');
  assert.match(text, /ericrisco\/mem-slop/, 'mem-slop is not this fork\'s to rename');
  assert.ok(!text.includes(PARENT_PACKAGE), 'but the harness package must not be named here either');
});

// ── the auto-update mechanism: the §2 risk, measured ──────────────────────────

test('gi05 · the update check polls the FORK\'s registry document, not the parent\'s', () => {
  const src = readFileSync(join(ROOT, 'targets', 'auto-update.mjs'), 'utf8');
  const urls = [...src.matchAll(/registry\.npmjs\.org\/([^'"`\s]+)/g)].map((m) => m[1]);
  assert.ok(urls.length, 'the update check must poll a registry document');
  for (const url of urls) {
    assert.match(url, /@lema017%2frsc-governed/, `the check polls ${url}`);
    assert.ok(!url.includes('ericrisco'), `the check still polls the parent: ${url}`);
  }
  // No inherited test covers this line, because every one of them short-circuits the lookup with
  // RSC_LATEST / RSC_LATEST_JSON. It is asserted on the source for exactly that reason.
  assert.match(src, /`@lema017\/rsc-governed@\$\{version\}`/, 'and the background install must pull the fork');
});

test('gi06 · the auto-update still WORKS after the rename, and names the fork\'s command', async () => {
  const { updateNotice } = await import('../targets/auto-update.mjs');
  const root = scratch('gi-update-');
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc', '.version'), '3.7.0\n');
  // `.no-auto-update` is a PROJECT decision that brings back the question for every release — the
  // "opción de desactivar actualizaciones automáticas" §10 requires. Used here to read the notice.
  writeFileSync(join(root, '.rsc', '.no-auto-update'), '');

  const notice = await updateNotice(root, { RSC_LATEST: '3.7.9', RSC_NO_UPDATE_CHECK: '' });
  assert.match(notice, /3\.7\.9 is out — you have 3\.7\.0/, `the notice did not fire:\n${notice}`);
  assert.match(notice, /npx @lema017\/rsc-governed@latest/, 'and it must name the FORK\'s command');
  assert.ok(!notice.includes(PARENT_PACKAGE), `the notice sends the user to the parent:\n${notice}`);

  const quiet = await updateNotice(root, { RSC_LATEST: '3.7.0', RSC_NO_UPDATE_CHECK: '' });
  assert.equal(quiet, '', 'a current project is told nothing');
});

test('gi07 · the same-major / new-major split survives the rename (§10)', async () => {
  const { updateNotice } = await import('../targets/auto-update.mjs');
  const fake = join(scratch('gi-cmd-'), 'noop.mjs');
  writeFileSync(fake, 'process.exit(0)\n');
  const env = { RSC_NO_UPDATE_CHECK: '', RSC_AUTO_UPDATE_CMD: JSON.stringify([process.execPath, fake]) };

  const same = scratch('gi-same-');
  mkdirSync(join(same, '.rsc'), { recursive: true });
  writeFileSync(join(same, '.rsc', '.version'), '3.7.0\n');
  const sameOut = await updateNotice(same, { ...env, RSC_LATEST: '3.7.9' });
  assert.match(sameOut, /installing itself in the background/, 'same major installs itself; it does not ask');

  const major = scratch('gi-major-');
  mkdirSync(join(major, '.rsc'), { recursive: true });
  writeFileSync(join(major, '.rsc', '.version'), '3.7.0\n');
  const majorOut = await updateNotice(major, { ...env, RSC_LATEST: '4.0.0' });
  assert.match(majorOut, /new major version/, 'a new major asks first');
  assert.match(majorOut, /npx @lema017\/rsc-governed@latest/);
});

test('gi08 · the symptom channel still travels: `rscFixes` keeps its key name', async () => {
  const { updateNotice } = await import('../targets/auto-update.mjs');
  // `fixesSince(doc.rscFixes, …)` reads the field off the registry's `/latest` document, which IS
  // the published package.json. Renaming the key would have silently emptied the channel: the
  // notice would still fire, just with no symptoms, and nothing would have failed.
  assert.ok(Array.isArray(PKG.rscFixes), 'the published package must still carry rscFixes');
  const root = scratch('gi-fixes-');
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc', '.version'), '3.7.0\n');
  writeFileSync(join(root, '.rsc', '.no-auto-update'), '');
  const doc = { version: '3.7.9', rscFixes: [{ fixedIn: '3.7.5', symptom: 'a thing that was broken' }] };
  const notice = await updateNotice(root, { RSC_NO_UPDATE_CHECK: '', RSC_LATEST_JSON: JSON.stringify(doc) });
  assert.match(notice, /a thing that was broken \(fixed in 3\.7\.5\)/, `symptoms did not arrive:\n${notice}`);
});

test('gi09 · the RSC_* protocol is NOT renamed: it is read by hooks and asserted by error code', () => {
  // These names are a contract with things outside this package: assistant hook configurations that
  // a consumer has already committed, and documented error codes that users and CI match on.
  // `RSCG_*` would have been tidier and would have broken every one of them.
  const sweep = ['targets/auto-update.mjs', 'scripts/rsc.js', 'scripts/lib/onboarding-apply.js']
    .map((p) => readFileSync(join(ROOT, p), 'utf8')).join('\n');
  for (const name of ['RSC_NO_UPDATE_CHECK', 'RSC_LATEST', 'RSC_AUTO_UPDATE_CMD', 'RSC_ONBOARDING_INCOMPLETE', 'RSC_ONBOARDING_REQUIRED']) {
    assert.ok(sweep.includes(name), `${name} was renamed; it is a contract with hooks and callers outside this package`);
  }
  assert.ok(!/\bRSCG_[A-Z]/.test(sweep), 'no RSCG_* variable was invented alongside them');
});

// ── the on-disk contract, measured on a real install ──────────────────────────

test('gi10 · an install still writes the UNCHANGED on-disk paths a consumer depends on',
  { timeout: 300000 }, async () => {
    const { applyInstall } = await import('../scripts/install-apply.js');
    const cwd = scratch('gi-install-');
    const home = scratch('gi-home-');
    await applyInstall({ skillIds: ['suggest', 'orient'], target: 'claude', home, cwd });

    // Renaming any of these would break every existing installation, and the transformer, the 18
    // adapters and the criterion-4 instrument all read them.
    for (const path of [
      '.rsc', '.rsc/skills', '.rsc/skills/orient/SKILL.md', '.rsc/.version',
      '.claude/skills/orient/SKILL.md',
    ]) {
      assert.ok(existsSync(join(cwd, path)), `${path} is missing: the on-disk contract moved`);
    }
    // The state file's name is `.rsc-state.json` whatever the target's root is, so it is read off
    // the target table rather than guessed — guessing its directory is how this test first failed.
    const { targetPaths } = await import('../targets/index.js');
    const stateFile = targetPaths('claude', home, cwd).stateFile;
    assert.ok(existsSync(stateFile), `${stateFile} is missing: the on-disk contract moved`);
    assert.match(stateFile, /\.rsc-state\.json$/, 'the state file name is a consumer contract and was not renamed');
    assert.ok(!existsSync(join(cwd, '.rscg')), 'no parallel `.rscg/` tree was invented');

    // And the installed hook copy — the one that actually runs on the consumer's machine, session
    // after session — must name the fork. This is the measurement B-R2 asked for: the source being
    // right is not the same claim as the copy being right.
    const installed = readFileSync(join(cwd, '.rsc', 'auto-update.mjs'), 'utf8');
    assert.ok(!installed.includes(PARENT_PACKAGE), 'the INSTALLED update hook still points at the parent');
    assert.match(installed, /@lema017%2frsc-governed/, 'the installed hook must poll the fork');
    assert.match(installed, /@lema017\/rsc-governed@\$\{version\}/, 'and install the fork');
  });

test('gi11 · nothing the FORK WRITES names the parent package',
  { timeout: 300000 }, async () => {
    const { applyInstall } = await import('../scripts/install-apply.js');
    const cwd = scratch('gi-sweep-');
    const home = scratch('gi-sweep-home-');
    await applyInstall({ skillIds: ['suggest', 'orient'], target: 'claude', home, cwd });

    const offenders = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isSymbolicLink()) continue;              // the delivery links back into `.rsc/skills/`
        const path = join(dir, e.name);
        if (e.isDirectory()) { walk(path); continue; }
        let text;
        try { text = readFileSync(path, 'utf8'); } catch { continue; }
        const hits = (text.match(/@ericrisco\/rsc/g) || []).length;
        if (hits) offenders.push({ path: path.slice(cwd.length + 1), hits });
      }
    };
    walk(cwd);

    // Two populations, and the whole point of this test is that they are not the same claim.
    //
    // FORK-WRITTEN artifacts — hooks, bootstrap, the contract, the state, the gitignore block — are
    // this stage's work and must be clean. `.rsc/governance/always-on.md` is excluded here and
    // measured in gi13 instead, because it is a byte-identical COPY of a frozen catalog file.
    const derived = (p) => p.startsWith('.rsc/skills/') || p.startsWith('.claude/skills/')
      || p === '.rsc/governance/always-on.md';
    const written = offenders.filter((o) => !derived(o.path));
    assert.deepEqual(written, [], `fork-written artifacts still name ${PARENT_PACKAGE}:\n  `
      + written.map((o) => `${o.path} (${o.hits})`).join('\n  '));
  });

test('gi13 · the frozen catalog still names the parent 81 times — and the DELIVERY names it zero times',
  { timeout: 300000 }, async () => {
    // THIS TEST USED TO PIN A DECLARED LIMIT. D16 closed it, so what it pins has changed shape, and
    // the before/after belongs in one place: the limit and its closure are the same measurement read
    // from two sides.
    //
    // WHAT IT PINNED. Stage 6's sweep found a real §10 defect it was not allowed to fix in a parallel
    // round: `skills/` is a byte-identical mirror of the incorporated upstream commit — that IS
    // Strategy B — and it names the parent's package 81 times, 10 of them in `skills/suggest/SKILL.md`,
    // the always-on body. `writeAlwaysOn` shipped that file BYTE-IDENTICAL on purpose, so a consumer
    // of the FORK was handed `npx @ericrisco/rsc add <id>` at every SessionStart and after every
    // compaction. Obey it and you download the PARENT's CLI into a fork-governed project, whose
    // installer writes a base with no contract — the blind spot stage 2 closed in `ensureBase` and
    // stage 4 found again in `restore`. The stage counted and pinned it instead of fixing it, because
    // closing it meant reformulating two other stages' invariants in a parallel round.
    //
    // WHAT IT PINS NOW: both halves, as a pair, because neither is meaningful alone.
    //   * the MIRROR still names the parent 81 times, and MUST — rewriting `skills/` would break the
    //     Strategy B invariant, which is `git diff --numstat origin/main -- skills/` at 0 lines;
    //   * the DELIVERY names it ZERO times, because the identity map runs at the install boundary.
    // The limit did not shrink; it closed, and the two numbers together are what says so.
    //
    // The two invariants in the way were REFORMULATED, not dropped: `tests/governance-base.test.js`
    // (the governance block stays additive and reversible; the identity rewrite is idempotent and
    // exactly invertible, with per-file counts) and `tests/governance-always-on.test.js` (equal to
    // upstream after the map, with the +70 B delta measured). The negative test that makes a
    // parent-named consumer instruction a FAILURE is `tests/governance-suggested-commands.test.js`.
    const countIn = (dir) => {
      let n = 0;
      const walk = (d) => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const path = join(d, e.name);
          if (e.isDirectory()) { walk(path); continue; }
          let text;
          try { text = readFileSync(path, 'utf8'); } catch { continue; }
          n += (text.match(/@ericrisco\/rsc/g) || []).length;
        }
      };
      walk(dir);
      return n;
    };
    const catalog = countIn(join(ROOT, 'skills'));
    assert.equal(catalog, 81,
      `the frozen catalog names ${PARENT_PACKAGE} ${catalog} times, not the 81 measured. This is the `
      + 'MIRROR, and it is supposed to: Strategy B freezes it byte-identical to upstream. If upstream '
      + 'changed, re-measure — and check the identity map still covers every shape it uses.');

    const alwaysOnSource = readFileSync(join(ROOT, 'skills', 'suggest', 'SKILL.md'), 'utf8');
    const inBody = (alwaysOnSource.match(/@ericrisco\/rsc/g) || []).length;
    assert.equal(inBody, 10, 'the always-on body\'s share of the mirror');
    assert.match(alwaysOnSource, /npx @ericrisco\/rsc add <id>/,
      'the worst case is a RUNNABLE command in the surface re-emitted every turn, not a mention in prose');

    // AND THE CLOSURE: what a consumer actually reads, counted exactly the same way.
    const { applyInstall } = await import('../scripts/install-apply.js');
    const cwd = scratch('gi-limit-');
    const home = scratch('gi-limit-home-');
    await applyInstall({ skillIds: ['suggest', 'init'], target: 'claude', home, cwd });

    const shipped = readFileSync(join(cwd, '.rsc', 'governance', 'always-on.md'), 'utf8');
    assert.equal((shipped.match(/@ericrisco\/rsc/g) || []).length, 0,
      'the always-on surface names the parent zero times — the defect D16 closed');
    assert.match(shipped, /npx @lema017\/rsc-governed add <id>/,
      'and the command is still THERE, naming the fork: closed by rewriting, not by deleting');
    assert.equal(countIn(join(cwd, '.rsc', 'skills')), 0,
      'and no governed base names it either, `references/` and `evals/` included');
    assert.equal(countIn(join(cwd, '.rsc', 'governance')), 0, 'nor any governance artifact');

    // Non-vacuity: `init` is installed because its `references/` carried 15 of the 81, so an install
    // that quietly stopped materializing reference files would otherwise read as a clean result.
    assert.ok(readdirSync(join(cwd, '.rsc', 'skills', 'init', 'references')).length > 0,
      'init/references/ reached the delivery, so counting zero there is a measurement');
    assert.match(
      readFileSync(join(cwd, '.rsc', 'skills', 'init', 'references', 'recommend-skills.md'), 'utf8'),
      /@lema017\/rsc-governed/, 'and it names the fork',
    );
  });

test('gi12 · `rscg --version` reports under the fork\'s command name', async () => {
  const { spawnSync } = await import('node:child_process');
  const cwd = scratch('gi-version-');
  const out = spawnSync(process.execPath, [join(ROOT, 'scripts', 'rsc.js'), '--version'], { cwd, encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, new RegExp(`^${CLI} ${PKG.version.replace(/\./g, '\\.')}`), out.stdout);
});

// ── the distributed surface: what ships and what deliberately does not ────────

test('gi14 · the maintenance machinery does NOT ship, and the consumer-side runtime does',
  { timeout: 300000 }, async () => {
    // §10 is literal: "Los consumidores no integran upstream directamente", and `PLAN.md` §4 keeps
    // the two machines apart — maintenance runs in the FORK's repository, over `upstream`; the
    // brownfield analysis and the conformance audit run in the CONSUMER's project. `files` carries
    // `scripts` wholesale, so without the two negations below the maintenance machinery travelled to
    // every consumer: inert, because no `bin` reaches it, but it is surface that has no function
    // there. The conformance validator is the OPPOSITE case and must ship, because it is what
    // `rscg conformance` runs to answer "are my skills governed?" on that machine.
    const { spawnSync } = await import('node:child_process');
    const out = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(out.status, 0, out.stderr);
    const shipped = new Set(JSON.parse(out.stdout)[0].files.map((f) => f.path));

    for (const path of ['scripts/upstream-maintain.js', 'scripts/lib/upstream-gate.js',
      'scripts/lib/upstream-state.js', 'scripts/lib/upstream-survey.js']) {
      assert.ok(!shipped.has(path), `${path} must not ship: maintenance runs in the fork's repository`);
    }
    for (const path of ['scripts/lib/conformance.js', 'scripts/verify-catalog-conformance.js',
      'scripts/validate-customizations.js', 'scripts/gate.js',
      'schema/governance/preamble-v1.txt', 'schema/governance/contract-v1.md',
      'schema/governance/brownfield-v1.md']) {
      assert.ok(shipped.has(path), `${path} must ship: a consumer runs it`);
    }

    // And no `bin` entry exposes maintenance, which would create exactly the surface §10 forbids.
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    assert.deepEqual(Object.keys(pkg.bin).sort(), [CLI, `${CLI}-install`]);
    assert.ok(!JSON.stringify(pkg.bin).includes('upstream'), 'no bin entry may reach the maintenance machine');
    // The npm scripts, however, are how the maintainer starts it, in this repository.
    assert.ok(pkg.scripts['upstream:check'] && pkg.scripts['upstream:maintain'],
      'the maintainer still needs a documented entry point (§9)');
  });

test('gi15 · every licence and attribution file in the catalog reaches the tarball (criterion 6)',
  { timeout: 300000 }, async () => {
    // Criterion 6 asks that licences, notices and `THIRD_PARTY` be present in the tarball. The
    // list is DISCOVERED rather than written down, so a file upstream adds cannot fall out of the
    // check by nobody remembering to add it — which is how the old baseline came to omit
    // `skills/ux/THIRD_PARTY.md` and count eight where there were nine.
    const { spawnSync } = await import('node:child_process');
    const found = spawnSync('find', ['LICENSE', 'skills', 'targets', 'scripts', 'schema',
      '-iname', '*licen*', '-o', '-iname', '*third*party*', '-o', '-iname', '*notice*',
      '-o', '-iname', '*attrib*', '-o', '-iname', 'COPYING*', '-o', '-iname', '*acknowledg*'],
    { cwd: ROOT, encoding: 'utf8' });
    const onDisk = found.stdout.split('\n').map((s) => s.trim()).filter(Boolean).sort();
    assert.ok(onDisk.length >= 10, `expected at least 10 licence/attribution paths, found ${onDisk.length}`);

    const out = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: ROOT, encoding: 'utf8' });
    const shipped = new Set(JSON.parse(out.stdout)[0].files.map((f) => f.path));
    const missing = onDisk.filter((p) => !shipped.has(p));
    assert.deepEqual(missing, [], `these licence/attribution files do not reach the tarball:\n  ${missing.join('\n  ')}`);

    // The two vendored subtrees carry their own, and excluding them from governance must not
    // exclude them from the package.
    for (const path of ['skills/ux/upstream/ux-designer/LICENSE', 'skills/design/engine/LICENSE']) {
      assert.ok(shipped.has(path), `${path} is a vendored subtree's own licence`);
    }
  });
