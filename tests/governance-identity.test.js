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

  // `scripts/lib/upstream-*.js` belongs to the maintenance machine (stage 5), whose job is to LOOK
  // FOR the parent's name in the fork's artifacts. Naming it there is the point, not a leak.
  const real = offenders.filter((p) => !/upstream-/.test(p));
  assert.deepEqual(real, [], `these still name ${PARENT_PACKAGE}:\n  ${real.join('\n  ')}`);
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

test('gi13 · DECLARED LIMIT, pinned by count: the frozen catalog still names the parent, and the always-on surface is the worst case',
  { timeout: 300000 }, async () => {
    // This test exists because the sweep in gi11 found something this stage must NOT fix on its own,
    // and a limitation nobody counts is a limitation that drifts.
    //
    // THE MEASUREMENT. `skills/` is a byte-identical mirror of the incorporated upstream commit —
    // that IS Strategy B — and it names the parent's package 81 times, 10 of them in
    // `skills/suggest/SKILL.md`, which is the always-on body. `scripts/lib/governance.js`
    // (`writeAlwaysOn`) ships that file to `.rsc/governance/always-on.md` BYTE-IDENTICAL on purpose,
    // so that "the governance cost of that surface is exactly zero bytes" is an exact, checkable
    // claim — and `scripts/verify-catalog-conformance.js` asserts the byte-identity.
    //
    // THE CONSEQUENCE, which is a §10 defect and not a cosmetic one. In Claude Code that body is
    // re-emitted at every SessionStart and after every compaction, and it instructs the agent to run
    // `npx @ericrisco/rsc add <id>` and `npx @ericrisco/rsc@latest reassess`. A consumer of the FORK
    // who follows it downloads and runs the PARENT's CLI in a fork-governed project, which is
    // literally the "reinstalar accidentalmente el padre" that §10 asks the fork to prevent.
    //
    // WHY IT IS NOT FIXED HERE. `PLAN.md` §3 already assigns the answer — "el renombrado de identidad
    // forma parte de la misma transformación … un paso mecánico y auditable del mismo transformador"
    // — and that transformation is stage 2's and stage 4's, with a declared property this stage will
    // not break from the side: `stripGovernance(transformSkillMd(x)) === x`, asserted by
    // `tests/md-block-fidelity.test.js`, plus the always-on byte-identity asserted by
    // `tests/governance-always-on.test.js` and by the criterion-4 instrument. Rewriting identity
    // inside the transformation breaks reversibility; rewriting it only in `writeAlwaysOn` breaks the
    // byte-identity claim. Either is a decision about another stage's invariant.
    //
    // So: counted, named, and pinned. If the count moves in either direction, this test says so.
    const catalog = (() => {
      let n = 0;
      const walk = (dir) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const path = join(dir, e.name);
          if (e.isDirectory()) { walk(path); continue; }
          let text;
          try { text = readFileSync(path, 'utf8'); } catch { continue; }
          n += (text.match(/@ericrisco\/rsc/g) || []).length;
        }
      };
      walk(join(ROOT, 'skills'));
      return n;
    })();
    assert.equal(catalog, 81,
      `the frozen catalog names ${PARENT_PACKAGE} ${catalog} times, not the 81 this limit was measured at. `
      + 'If upstream changed, re-measure and update the declared limit. If the transformation started '
      + 'rewriting identity, this limit is closing and DISTRIBUTION.md must say so.');

    const alwaysOnSource = readFileSync(join(ROOT, 'skills', 'suggest', 'SKILL.md'), 'utf8');
    const inBody = (alwaysOnSource.match(/@ericrisco\/rsc/g) || []).length;
    assert.equal(inBody, 10, 'the always-on body\'s share of the limit');
    assert.match(alwaysOnSource, /npx @ericrisco\/rsc add <id>/,
      'the worst case is a RUNNABLE command in the surface re-emitted every turn, not a mention in prose');

    // And the shipped copy carries exactly that, which is the thing a consumer actually reads.
    const { applyInstall } = await import('../scripts/install-apply.js');
    const cwd = scratch('gi-limit-');
    const home = scratch('gi-limit-home-');
    await applyInstall({ skillIds: ['suggest'], target: 'claude', home, cwd });
    const shipped = readFileSync(join(cwd, '.rsc', 'governance', 'always-on.md'), 'utf8');
    assert.equal(shipped, alwaysOnSource, 'byte-identical, by design (writeAlwaysOn)');
    assert.equal((shipped.match(/@ericrisco\/rsc/g) || []).length, inBody,
      'so the limit reaches the consumer unchanged — which is the declaration, not an accident');
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
