import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Stage 6 — `npm run gate`, the second root of the project-artifact validator, and the two gaps
// stage 4's independent review found in the criterion-4 audit.
//
// Everything here is a NEGATIVE test or a mutation. That is deliberate and it is the only thing that
// makes this file worth running: three documents cited `npm run gate` as an instrument while no
// `package.json` defined it, and the criterion-4 instrument reported `274/274, failures: 0` with two
// classes of fault present. A validator that cannot fail reports the same thing as one that passes.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'scripts', 'rsc.js');

const TMP = [];
function scratch(prefix) {
  const d = mkdtempSync(join(tmpdir(), prefix));
  TMP.push(d);
  return d;
}
test.after(() => { for (const d of TMP) rmSync(d, { recursive: true, force: true }); });

// ── the gate exists, and says what it does not cover ──────────────────────────

test('gg01 · `npm run gate` exists, and includes the two checks stage 6 was asked to put in it', async () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts.gate, '`npm run gate` was cited by three documents and defined by none');
  const { CHECKS, NOT_IN_THE_GATE } = await import('../scripts/gate.js');
  const ids = CHECKS.map((c) => c.id);
  assert.ok(ids.includes('governance:check'), ids.join(', '));
  assert.ok(ids.includes('governance:customizations'), ids.join(', '));
  assert.ok(ids.includes('skills-invariant'), 'Strategy B IS that invariant; a gate that skips it checks the wrong thing');
  // A gate that hides what it does not check is worse than one that checks less.
  const excluded = NOT_IN_THE_GATE.map(([id]) => id);
  for (const id of ['npm test', 'eval-lint.sh', 'routing:audit', 'spec:gate', 'knowledge:doctor', 'drift:knowledge']) {
    assert.ok(excluded.includes(id), `${id} is neither in the gate nor declared as excluded`);
  }
  for (const [, why] of NOT_IN_THE_GATE) assert.ok(why.length > 20, 'every exclusion carries its reason');
});

test('gg02 · the gate runs green here, in seconds, and reports its own coverage', { timeout: 300000 }, () => {
  const out = spawnSync(process.execPath, [join(ROOT, 'scripts', 'gate.js')], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(out.status ?? 0, 0, `${out.stdout}${out.stderr}`);
  assert.match(out.stdout, /7\/7 passed/, out.stdout);
  assert.match(out.stdout, /Not in this gate, and why/, 'it must print what it does not cover');
  assert.doesNotMatch(out.stdout, /^SKIP/m, 'nothing should be skipped in this clone');
});

test('gg02b · a check that ran and had NOTHING to look at reports VOID, not PASS', { timeout: 300000 }, () => {
  // `ARCHITECTURE.md` flagged three inherited validators as "vacuos en clon limpio" — they pass by
  // having nothing to examine. `governance:customizations` has exactly that shape in THIS
  // repository, which is not a consumer project and has no `02-DOCS/`. So the gate says so on
  // itself, rather than letting "7/7 passed" imply coverage it does not have.
  const out = spawnSync(process.execPath, [join(ROOT, 'scripts', 'gate.js')], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(out.status ?? 0, 0, `${out.stdout}${out.stderr}`);
  assert.match(out.stdout, /^VOID {2}governance:customizations/m, out.stdout);
  assert.match(out.stdout, /nothing to validate here: this repository is not a consumer project/, out.stdout);
  assert.match(out.stdout, /\(1 with nothing to check here\)/, 'and the summary line carries it');
  assert.match(out.stdout, /A VOID check ran and had nothing to look at\. It is not a failure and it is not coverage\./);
  // The other six must NOT be void: they examine the catalog, which is right here.
  assert.equal((out.stdout.match(/^VOID /gm) || []).length, 1, out.stdout);
});

test('gg03 · a skipped check is reported as SKIP, never folded into the pass count', async () => {
  // The `skills-invariant` check needs an `origin/main` ref. In a clone without one it must say so,
  // because "I could not run" and "I found nothing" are different answers.
  const { skillsInvariant } = await import('../scripts/gate.js');
  const bare = scratch('gg-bare-');
  spawnSync('git', ['init', '-q'], { cwd: bare });
  const out = skillsInvariant(bare);
  assert.equal(out.status, 'skip', JSON.stringify(out));
  assert.match(out.detail, /origin\/main/, 'and it names what would make it runnable');

  const here = skillsInvariant(ROOT);
  assert.equal(here.status, 'pass', JSON.stringify(here));
  assert.match(here.detail, /0 lines/, 'the invariant is reported with its measurement, not an adjective');
});

// ── the SECOND root: the brownfield run report ────────────────────────────────

const GOOD_RECORD = `### C1 — Where an ADR-worthy forward choice is filed

- Scope: repo
- Status: pending-decision
- Blocks (enumerated, per §4):
    - creating a new numbered ADR file for a choice this run surfaced
- Confidence: high — would drop to medium if the project turned out to keep no log at all
- Impact: one ADR-worthy choice filed in the home the other skill does not read is invisible to it.

#### Evidence — positions

| # | Side | Position | Category | Evidence (form per §2.1) |
|---|---|---|---|---|
| P1 | skill \`decision-records\` | Home is chosen by first match | **approved convention** | F2 · \`.rsc/skills/decision-records/SKILL.md\` §"Decide home + naming once" |
| P2 | project | 31 of 34 records already live in docs/adr | **observed pattern** | F3 · population \`docs/adr/*.md\`, 34 records, counted by exhaustive grep |

- Alternatives:
  1. Follow the skill's first match — read what the project already has.
  2. Pick one home for brownfield decisions and always use it.
- Recommendation: (1). It is the rule the skill states first.
`;

function runReport(cwd, { frontmatter = 'type: brownfield-run\n', body = GOOD_RECORD, name = 'run.md', index = true } = {}) {
  const dir = join(cwd, '02-DOCS', 'wiki', 'brownfield');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), `---\n${frontmatter}---\n\n# Brownfield run\n\n## B1 — Inventory\n\n`
    + '| skill | role | why | inspectable |\n|---|---|---|---|\n'
    + '| decision-records | selected | .rsc.json#skills | yes |\n\n'
    + `## Conflicts\n\n${body}`);
  if (index) {
    mkdirSync(join(cwd, '02-DOCS', 'wiki'), { recursive: true });
    writeFileSync(join(cwd, '02-DOCS', 'wiki', 'index.md'), `# Knowledge map\n\n- [run](brownfield/${name})\n`);
  }
  // The skill the evidence cites has to exist, because rule 4b checks that the path resolves.
  const skill = join(cwd, '.rsc', 'skills', 'decision-records');
  mkdirSync(skill, { recursive: true });
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: decision-records\n---\n\n## Decide home + naming once\n\nbody\n');
  mkdirSync(join(cwd, 'docs', 'adr'), { recursive: true });
  return join(dir, name);
}

async function validate(cwd, opts = {}) {
  const { validateBrownfieldRuns } = await import('../scripts/lib/customization-validator.js');
  return validateBrownfieldRuns({ cwd, ...opts });
}
const idsOf = (report) => report.findings.map((f) => f.ruleId).sort();
const errorsIn = (report) => report.findings.filter((f) => f.severity === 'error');

test('gg04 · absence of the brownfield root is a valid state, not a finding', async () => {
  const report = await validate(scratch('gg-absent-'));
  assert.equal(report.ran, false);
  assert.deepEqual(report.findings, []);
});

test('gg05 · a well-formed run report passes every rule it can be checked against', async () => {
  const cwd = scratch('gg-good-');
  runReport(cwd);
  const report = await validate(cwd, { greenfield: false, skills: [], selected: ['decision-records'] });
  assert.equal(report.ran, true);
  assert.deepEqual(errorsIn(report).map((f) => `${f.ruleId}: ${f.message}`), [], 'a clean report must produce no errors');
  assert.equal(report.records.length, 1);
  assert.equal(report.records[0].status, 'pending-decision');
});

test('gg06 · NEGATIVE: every missing field is NAMED, with its rule and the record', async () => {
  const cwd = scratch('gg-fields-');
  runReport(cwd, { body: '### C1 — A conflict with nothing in it\n\nnot even a field.\n' });
  const report = await validate(cwd, { greenfield: false });
  const messages = errorsIn(report).map((f) => f.message).join('\n');
  for (const field of ['Scope', 'Impact', 'Confidence', 'Recommendation', 'Status', 'Alternatives']) {
    assert.match(messages, new RegExp('has no .' + field + '. field'), field + ' was not named:\n' + messages);
  }
  assert.match(messages, /has no positions block/);
  for (const f of errorsIn(report)) {
    assert.ok(f.file.endsWith('run.md'), 'every finding names the file');
    assert.ok(f.ruleId, 'and the rule that produced it');
  }
});

test('gg07 · NEGATIVE: a bare `path:line` is rejected, and a drifted fragment names the real line', async () => {
  const cwd = scratch('gg-evidence-');
  const bad = GOOD_RECORD
    .replace('F2 · `.rsc/skills/decision-records/SKILL.md` §"Decide home + naming once"',
      'F1 · `.rsc/skills/decision-records/SKILL.md:1#"Decide home + naming once"`')
    .replace('F3 · population `docs/adr/*.md`, 34 records, counted by exhaustive grep',
      'F1 · `.rsc/skills/decision-records/SKILL.md:9`');
  runReport(cwd, { body: bad });
  const report = await validate(cwd, { greenfield: false });
  const messages = errorsIn(report).map((f) => f.message).join('\n');
  // 4c: a line with no fragment is not an admissible form at all.
  assert.match(messages, /with no quoted fragment/, messages);
  // 4a: the fragment IS at line 5, the citation says line 1 — and the error says where it really is.
  assert.match(messages, /the fragment is at `\.rsc\/skills\/decision-records\/SKILL\.md:5`, not at the cited `:1`/, messages);
});

test('gg08 · NEGATIVE: rule 4d — a skill cited at `skills/` instead of `.rsc/skills/`', async () => {
  const cwd = scratch('gg-4d-');
  runReport(cwd, { body: GOOD_RECORD.replace('`.rsc/skills/decision-records/SKILL.md`', '`skills/decision-records/SKILL.md`') });
  const report = await validate(cwd, { greenfield: false });
  assert.ok(errorsIn(report).some((f) => f.ruleId === 'B4d'), idsOf(report).join(', '));
  assert.match(errorsIn(report).find((f) => f.ruleId === 'B4d').message, /13 lines/,
    'the error must say WHY, because the citation looks right in the fork\'s own checkout');
});

test('gg09 · NEGATIVE: a hedged or doubled category is the finding, not something to settle by order', async () => {
  const cwd = scratch('gg-cat-');
  runReport(cwd, { body: GOOD_RECORD.replace('**observed pattern**', 'observed pattern, not really an approved convention') });
  const report = await validate(cwd, { greenfield: false });
  const f = errorsIn(report).find((x) => x.ruleId === 'B3');
  assert.ok(f, idsOf(report).join(', '));
  assert.match(f.message, /names 2 categories/, f.message);
});

test('gg10 · NEGATIVE: a confidence with no falsifier, and a status outside the six', async () => {
  const cwd = scratch('gg-conf-');
  runReport(cwd, {
    body: GOOD_RECORD
      .replace('- Confidence: high — would drop to medium if the project turned out to keep no log at all', '- Confidence: high')
      .replace('- Status: pending-decision', '- Status: probably-fine'),
  });
  const report = await validate(cwd, { greenfield: false });
  const messages = errorsIn(report).map((f) => f.message).join('\n');
  assert.match(messages, /states a confidence with no falsifier/, messages);
  assert.match(messages, /`Status: probably-fine`/, messages);
});

test('gg11 · NEGATIVE: a recommendation that is not one of the alternatives', async () => {
  const cwd = scratch('gg-rec-');
  runReport(cwd, { body: GOOD_RECORD.replace('- Recommendation: (1). It is the rule the skill states first.', '- Recommendation: (7). Something else entirely.') });
  const report = await validate(cwd, { greenfield: false });
  assert.ok(errorsIn(report).some((f) => f.ruleId === 'B8'), idsOf(report).join(', '));
});

test('gg12 · NEGATIVE: rule 15 — a `pending-decision` that enumerates nothing', async () => {
  const cwd = scratch('gg-blocks-');
  runReport(cwd, { body: GOOD_RECORD.replace(/- Blocks \(enumerated, per §4\):\n {4}- creating a new numbered ADR file for a choice this run surfaced\n/, '') });
  const report = await validate(cwd, { greenfield: false });
  const f = errorsIn(report).find((x) => x.ruleId === 'B15');
  assert.ok(f, idsOf(report).join(', '));
  assert.match(f.message, /over-blocking visible/, 'the reason is the point of the rule');
});

test('gg13 · NEGATIVE: rule 12 — a position that asserts a guard may be disabled IS the finding', async () => {
  const cwd = scratch('gg-guard-');
  runReport(cwd, { body: GOOD_RECORD.replace('31 of 34 records already live in docs/adr', 'the project disables the gitmoji guard for this package') });
  const report = await validate(cwd, { greenfield: false });
  assert.ok(errorsIn(report).some((f) => f.ruleId === 'B12'), idsOf(report).join(', '));
});

test('gg13b · and rule 12 does NOT fire on a position that NEGATES it', async () => {
  // M5 of stage 6's review, measured on the real validator: the predicate was
  // `DISABLING_VERB.test(text) && GUARDED_NOUN.test(text)` — two independent keyword probes — so it
  // fired on sentences that say the opposite. At severity `error` that is an `exit 1` from
  // `npm run gate`, which means a CORRECT brownfield report took the gate down for mentioning
  // guards in a negated clause.
  for (const claim of [
    'this project does not disable any guard, ever',
    'no position here asks to bypass a permission',
    'we never bypass a permission in this repo',
  ]) {
    const cwd = scratch('gg-guard-neg-');
    runReport(cwd, { body: GOOD_RECORD.replace('31 of 34 records already live in docs/adr', claim) });
    const report = await validate(cwd, { greenfield: false });
    assert.deepEqual(errorsIn(report).filter((f) => f.ruleId === 'B12'), [],
      `a negated clause is not an assertion: ${claim}`);
  }

  // And the clause scan stops at the break, so a negation in a NEIGHBOURING clause does not buy
  // silence for a real attempt.
  const cwd = scratch('gg-guard-pos-');
  runReport(cwd, {
    body: GOOD_RECORD.replace('31 of 34 records already live in docs/adr',
      'this hook should not run, so disable the branch-guard here'),
  });
  assert.ok(errorsIn(await validate(cwd, { greenfield: false })).some((f) => f.ruleId === 'B12'),
    'suppressing on any negation anywhere in the sentence would be the opposite defect');
});

test('gg13c · rule 8 and rule 12 share ONE predicate, and its recall gap is declared', async () => {
  const { assertsDisabling, validateCustomizationSource } = await import('../scripts/lib/customization-validator.js');

  // One definition, not two copies that drift — the defect this session already committed once with
  // `contract-v1.md`. Rule 8 lives in the customization schema and rule 12 in the conflict-record
  // format, and they are the same question asked of two file formats.
  const source = readFileSync(join(ROOT, 'scripts', 'lib', 'customization-validator.js'), 'utf8');
  assert.equal((source.match(/DISABLING_VERB\.test\(/g) || []).length, 1,
    'the verb probe must be reached through `assertsDisabling` only');
  assert.equal((source.match(/export function assertsDisabling/g) || []).length, 1);

  // Rule 8, through the real file validator: the stated attempt is an error, the negation is not.
  const customization = (decision) => [
    '---', 'skill: orient', 'status: approved', 'scope: repo', 'type: skill-customization',
    'owner: me', 'updated: 2026-11-02', 'reevaluate-when: the lane changes', 'evidence: CONTRACT.md §1',
    '---', '', '## Decisions', '',
    `- ${decision} — evidence: CONTRACT.md §1 · category: approved convention`, '',
    '## Out of scope', '', '- nothing', '',
  ].join('\n');
  const attempt = validateCustomizationSource({
    file: 'orient/README.md', src: customization('the danger-guard hook must be disabled for this repo'), dirName: 'orient',
  });
  assert.ok(attempt.findings.some((f) => f.ruleId === 'R8'), JSON.stringify(attempt.findings.map((f) => f.ruleId)));
  const negated = validateCustomizationSource({
    file: 'orient/README.md', src: customization('this project does not disable any guard, ever'), dirName: 'orient',
  });
  assert.deepEqual(negated.findings.filter((f) => f.ruleId === 'R8'), [],
    'rule 8 inherited the same defect and inherits the same fix');

  // THE DECLARED GAP, pinned so it is a stated limit and not a surprise. These three ask for a
  // guard to be turned off in plain English and name no verb in the list. Recall is NOT measured
  // and is not measurable; if a later change starts catching one of these, this assertion is where
  // the limit gets re-declared rather than quietly widened.
  for (const text of [
    'the lane gate is unnecessary noise here and should stop running',
    'we removed the pre-commit check from this repository on purpose',
    'the gitmoji rule is not enforced in this project and must not be',
  ]) {
    assert.equal(assertsDisabling(text), false, `declared recall gap changed: ${text}`);
  }
  // And the things it must still catch, so the gap above is not read as "it catches nothing".
  for (const text of [
    'the danger-guard hook must be disabled for this repo',
    'the project disables the gitmoji guard for this package',
    'ship-guard is bypassed on release branches',
    'we waive the pre-tool-use permission for this package',
  ]) {
    assert.equal(assertsDisabling(text), true, `a stated attempt must still be the finding: ${text}`);
  }
});

test('gg14 · NEGATIVE: rule 13 — greenfield cannot emit a category that asserts existing code', async () => {
  const cwd = scratch('gg-green-');
  runReport(cwd);
  const asBrownfield = await validate(cwd, { greenfield: false });
  assert.ok(!errorsIn(asBrownfield).some((f) => f.ruleId === 'B13'), 'with code present, `observed pattern` is legal');
  const asGreenfield = await validate(cwd, { greenfield: true });
  const f = errorsIn(asGreenfield).find((x) => x.ruleId === 'B13');
  assert.ok(f, idsOf(asGreenfield).join(', '));
  assert.match(f.message, /invented the evidence/, f.message);
});

test('gg15 · NEGATIVE: a missing or wrong `type:` breaks the OKF bundle the file lives in', async () => {
  const none = scratch('gg-okf-1-');
  runReport(none, { frontmatter: 'updated: 2026-11-02\n' });
  assert.ok(errorsIn(await validate(none, { greenfield: false })).some((f) => f.ruleId === 'BR1'));

  const wrong = scratch('gg-okf-2-');
  runReport(wrong, { frontmatter: 'type: notes\n' });
  const f = errorsIn(await validate(wrong, { greenfield: false })).find((x) => x.ruleId === 'BR1');
  assert.match(f.message, /must be `brownfield-run`/, f.message);
});

test('gg16 · NEGATIVE: an unindexed run report is reported (property 32)', async () => {
  const cwd = scratch('gg-index-');
  runReport(cwd, { index: false });
  writeFileSync(join(cwd, '02-DOCS', 'wiki', 'index.md'), '# Knowledge map\n\nnothing here\n');
  const f = errorsIn(await validate(cwd, { greenfield: false })).find((x) => x.ruleId === 'BR32');
  assert.ok(f, 'an unindexed wiki article is one nobody finds');
});

test('gg17 · rule 16 — the coverage FLOOR fails on a missing partner and passes on a complete inventory', async () => {
  const cwd = scratch('gg-floor-');
  runReport(cwd);
  const skills = [
    { id: 'decision-records', description: 'Write an ADR. NOT a running log (that is `continuous-learning`).', tags: ['adr'], recommends: ['continuous-learning'] },
    { id: 'continuous-learning', description: 'Keep a running log of lessons.', tags: ['log'], recommends: [] },
    { id: 'unrelated', description: 'Bake a cake with flour and sugar.', tags: ['cake'], recommends: [] },
  ];
  const missing = await validate(cwd, { greenfield: false, skills, selected: ['decision-records'] });
  const floor = errorsIn(missing).filter((f) => f.ruleId === 'B16');
  assert.ok(floor.length, 'a declared `recommends:` edge outside the inventory is a deterministic failure');
  assert.match(floor[0].message, /continuous-learning/, floor[0].message);
  assert.match(floor.map((f) => f.message).join('\n'), /recommends|NOT clause/, 'and it says which rule required the pair');

  // Add the row and the floor is satisfied — a deliberate exclusion is a ROW with its reason.
  const path = join(cwd, '02-DOCS', 'wiki', 'brownfield', 'run.md');
  writeFileSync(path, readFileSync(path, 'utf8').replace(
    '| decision-records | selected | .rsc.json#skills | yes |',
    '| decision-records | selected | .rsc.json#skills | yes |\n| continuous-learning | competitor | decision-records recommends it | yes |',
  ));
  const complete = await validate(cwd, { greenfield: false, skills, selected: ['decision-records'] });
  assert.deepEqual(errorsIn(complete).filter((f) => f.ruleId === 'B16'), [], 'a complete inventory passes');
});

test('gg18 · a rule that could not RUN is reported as not-run, and never counts as a pass', async () => {
  const { errorsOf, formatFindings } = await import('../scripts/lib/customization-validator.js');
  const cwd = scratch('gg-notrun-');
  runReport(cwd);
  // No `greenfield` fact and no `.rsc.json#skills`: rules 13 and 16 cannot be decided.
  const report = await validate(cwd);
  const notRun = report.findings.filter((f) => f.severity === 'not-run');
  assert.equal(notRun.length, 2, notRun.map((f) => f.ruleId).join(', '));
  assert.deepEqual(notRun.map((f) => f.ruleId).sort(), ['B13-not-run', 'B16-not-run']);
  for (const f of notRun) assert.match(f.message, /Not checked is not the same as no finding/);
  assert.ok(!errorsOf(report).some((f) => f.severity === 'not-run'), 'not-run must not fail the gate');
  assert.ok(formatFindings(report, cwd).some((l) => l.startsWith('NOT-RUN')), 'but it must be visible, labelled as itself');
});

test('gg19 · install and sync are real invocation points for the second root', { timeout: 300000 }, async () => {
  const { applyInstall } = await import('../scripts/install-apply.js');
  const cwd = scratch('gg-wired-');
  const home = scratch('gg-wired-home-');
  runReport(cwd, { body: '### C1 — A broken record\n\nno fields at all.\n' });
  const state = await applyInstall({ skillIds: ['suggest'], target: 'claude', home, cwd });

  const written = join(cwd, '.rsc', 'governance', 'brownfield.json');
  assert.ok(existsSync(written), 'the install must write the second root\'s report, as it does the first\'s');
  const report = JSON.parse(readFileSync(written, 'utf8'));
  assert.equal(report.ran, true);
  assert.ok(report.errors > 0, 'and a malformed record must be named there');
  assert.ok(state.governance.brownfield.ran, 'and returned in the state, like the customization report');
  // An install must NOT die over a wiki page: the contract's answer to a broken file is to ask.
  assert.ok(existsSync(join(cwd, '.rsc', 'skills', 'suggest', 'SKILL.md')), 'the install still completed');
});

test('gg20 · `rscg brownfield` hands over the procedure and the computed candidate set', { timeout: 300000 }, async () => {
  const { applyInstall } = await import('../scripts/install-apply.js');
  const cwd = scratch('gg-cmd-');
  const home = scratch('gg-cmd-home-');
  await applyInstall({ skillIds: ['suggest', 'decision-records'], target: 'claude', home, cwd });
  writeFileSync(join(cwd, '.rsc.json'), JSON.stringify({
    version: 1, targets: ['claude'], skills: ['decision-records'], agents: [], ownSkills: [], optOuts: [],
  }));

  const out = spawnSync(process.execPath, [CLI, 'brownfield'], { cwd, encoding: 'utf8' });
  assert.equal(out.status ?? 0, 0, `${out.stdout}${out.stderr}`);
  assert.match(out.stdout, /\.rsc\/governance\/brownfield-v1\.md/, 'the procedure must be shipped and named by path');
  assert.ok(existsSync(join(cwd, '.rsc', 'governance', 'brownfield-v1.md')), 'and actually be there');
  assert.match(out.stdout, /B1 CANDIDATE COMPETITORS — computed, not guessed, at threshold 0\.45/, out.stdout);
  assert.match(out.stdout, /0\.80 is the failure CEILING/, 'the threshold has to carry why it is not 0.80');
  assert.match(out.stdout, /COVERAGE FLOOR/, out.stdout);
  assert.match(out.stdout, /it does not read the\nproject/, 'and it must say what it does NOT do');

  const json = spawnSync(process.execPath, [CLI, 'brownfield', '--json'], { cwd, encoding: 'utf8' });
  const parsed = JSON.parse(json.stdout);
  assert.equal(parsed.threshold, 0.45);
  assert.ok(Array.isArray(parsed.competitors));
  assert.ok(parsed.competitors.every((c) => c.reasons.length), 'every candidate carries a computed reason');
});

test('gg20b · the brownfield procedure is a MANAGED path, so restore and purge know about it',
  { timeout: 300000 }, async () => {
    // It is package-owned, like the contract, and it has to be in the snapshot set for the same
    // reason `install-apply.js` already states about every artifact it writes: "a file rsc writes
    // but omits here is silently absent from the snapshot, so `rsc restore` cannot bring it back".
    const { managedPathsForInstall, applyInstall } = await import('../scripts/install-apply.js');
    const cwd = scratch('gg-managed-');
    const home = scratch('gg-managed-home-');
    const rel = managedPathsForInstall({ skillIds: ['suggest'], target: 'claude', home, cwd })
      .map((p) => p.slice(cwd.length + 1).split('\\').join('/'));
    for (const path of ['.rsc/governance/brownfield-v1.md', '.rsc/governance/v1.md', '.rsc/governance/always-on.md']) {
      assert.ok(rel.includes(path), `${path} is written but not declared as managed:\n  ${rel.join('\n  ')}`);
    }
    const state = await applyInstall({ skillIds: ['suggest'], target: 'claude', home, cwd });
    assert.equal(state.governance.procedure, '.rsc/governance/brownfield-v1.md');
    assert.ok(readFileSync(join(cwd, '.rsc', 'governance', 'brownfield-v1.md'))
      .equals(readFileSync(join(ROOT, 'schema', 'governance', 'brownfield-v1.md'))),
    'and it is byte-identical to the shipped copy, which `npm run governance:check` ties to its source');
  });

test('gg21 · `rscg brownfield --validate` runs the record rules and exits non-zero on a broken one', { timeout: 300000 }, () => {
  const cwd = scratch('gg-cmdval-');
  runReport(cwd, { body: '### C1 — A broken record\n\nnothing.\n' });
  const out = spawnSync(process.execPath, [CLI, 'brownfield', '--validate'], { cwd, encoding: 'utf8' });
  assert.equal(out.status, 1, out.stdout);
  assert.match(out.stdout, /ERROR .*run\.md/, out.stdout);
  assert.match(out.stdout, /conflict record\(s\)/, out.stdout);
});

// ── the two gaps stage 4's independent review found, proved by mutation ───────

test('gg22 · MUTATION: a delivery that is a COPY instead of a symlink is now a finding',
  { timeout: 300000 }, async () => {
    // Before this fix, `auditDelivery` read
    //   `if (lstat(dir).isSymbolicLink() && realpath(dir) !== realpath(base)) bad.push(…)`
    // so a non-symlink never entered the branch, and the byte comparison that followed is identical
    // by construction right after an install. Forcing `linkOrCopy`'s Windows path made all 18
    // deliveries real copies and the instrument still reported 274/274, failures: 0.
    const { applyInstall } = await import('../scripts/install-apply.js');
    const { auditDelivery, deliveryKind } = await import('../scripts/lib/conformance.js');
    const cwd = scratch('gg-mut-link-');
    const home = scratch('gg-mut-link-home-');
    await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'claude', home, cwd });

    const base = join(cwd, '.rsc', 'skills', 'flutter');
    const delivered = join(cwd, '.claude', 'skills', 'flutter');
    assert.equal(deliveryKind('claude', 'flutter', cwd, home), 'symlink', 'the fixture must start as a symlink');
    assert.deepEqual(auditDelivery('claude', 'flutter', cwd, home, base), [], 'and be conformant');

    // The mutation: replace the link with a real copy, byte-identical, exactly as the old check
    // could not distinguish from the real thing.
    rmSync(delivered, { recursive: true, force: true });
    cpSync(base, delivered, { recursive: true });
    assert.equal(deliveryKind('claude', 'flutter', cwd, home), 'copy');
    assert.equal(readFileSync(join(delivered, 'SKILL.md'), 'utf8'), readFileSync(join(base, 'SKILL.md'), 'utf8'),
      'the bytes are identical, which is why the byte comparison alone could never see this');

    const findings = auditDelivery('claude', 'flutter', cwd, home, base);
    if (process.platform === 'win32') {
      assert.deepEqual(findings, [], 'on Windows a copy is correct by design (limit L5)');
    } else {
      assert.ok(findings.some((f) => /is a COPY, not a symlink/.test(f)), findings.join('; '));
      assert.ok(findings.some((f) => /stops tracking the base/.test(f)), 'and it says what goes wrong, which is later');
    }
  });

test('gg23 · MUTATION: a doubled governance block in the Cursor `.mdc` is now a finding',
  { timeout: 300000 }, async () => {
    // The `.mdc` is the only delivery that is re-rendered rather than linked, and the only one the
    // instrument itself says a rendering fault would be invisible to. The block was extracted with
    // `match(...)[0]` — the FIRST match — and the marker counting lived only in `auditBase`, which
    // never ran on a `.mdc`. Doubling the body in `targets/cursor.js` produced 2 opening and 2
    // closing markers, 35 712 B instead of 17 885, and `274/274, failures: 0`.
    const { applyInstall } = await import('../scripts/install-apply.js');
    const { auditDelivery } = await import('../scripts/lib/conformance.js');
    const cwd = scratch('gg-mut-mdc-');
    const home = scratch('gg-mut-mdc-home-');
    await applyInstall({ skillIds: ['suggest', 'flutter'], target: 'cursor', home, cwd });

    const base = join(cwd, '.rsc', 'skills', 'flutter');
    const mdc = join(cwd, '.cursor', 'rules', 'flutter.mdc');
    assert.deepEqual(auditDelivery('cursor', 'flutter', cwd, home, base), [], 'the fixture must start conformant');

    const original = readFileSync(mdc, 'utf8');
    const m = original.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
    writeFileSync(mdc, `${m[1]}${m[2]}${m[2]}`);     // the body twice, exactly as the mutation did
    const doubled = auditDelivery('cursor', 'flutter', cwd, home, base);
    assert.ok(doubled.some((f) => /DUPLICATE: 2 opening markers/.test(f)), doubled.join('; '));
    assert.ok(doubled.some((f) => /DUPLICATE: 2 closing markers/.test(f)), doubled.join('; '));
    assert.ok(readFileSync(mdc, 'utf8').length > original.length * 1.8, 'and the file really did double');

    // And a block that no longer opens the body: same file, different fault, also previously unseen.
    writeFileSync(mdc, `${m[1]}# a heading someone prepended\n\n${m[2]}`);
    const moved = auditDelivery('cursor', 'flutter', cwd, home, base);
    assert.ok(moved.some((f) => /does not open the body/.test(f)), moved.join('; '));

    writeFileSync(mdc, original);
    assert.deepEqual(auditDelivery('cursor', 'flutter', cwd, home, base), [], 'and it is clean again when restored');
  });

test('gg26 · `prepublishOnly` CHECKS the committed manifest instead of rewriting it first', async () => {
  // B6 of stage 6's review: `prepublishOnly` was `npm run manifest && npm run gate`, and the gate's
  // second check is `manifest:check` — so the publish regenerated `manifest.json` and then verified
  // the file it had just written. Vacuous by composition. Measured on a two-skill catalog with one
  // directory removed: check-before-regenerate exits 1 ("manifest.json is stale"), and
  // regenerate-then-check prints `manifest OK (1 skills, …)` and exits 0. The side effect is the
  // part that matters: a publish could ship a manifest different from the committed one and leave
  // no record of having done so.
  const { CHECKS } = await import('../scripts/gate.js');
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

  // The chain is EXPANDED from package.json, not asserted as a string, so rephrasing it does not
  // buy a pass and a future `npm run manifest && npm run prepublish-something` is still caught.
  const expand = (command, depth = 0) => {
    if (depth > 6) return [command];
    return command.split('&&').map((s) => s.trim()).flatMap((step) => {
      const viaNpm = /^npm run ([\w:-]+)$/.exec(step);
      if (viaNpm && pkg.scripts[viaNpm[1]]) return expand(pkg.scripts[viaNpm[1]], depth + 1);
      if (/^node scripts\/gate\.js$/.test(step)) {
        return CHECKS.flatMap((c) => (c.argv ? [`node ${c.argv.join(' ')}`] : [`<fn ${c.id}>`]));
      }
      return [step];
    });
  };
  const chain = expand(pkg.scripts.prepublishOnly);
  const manifestSteps = chain.filter((s) => s.includes('build-manifest.js'));
  assert.ok(manifestSteps.length, `nothing in the publish chain looks at the manifest:\n  ${chain.join('\n  ')}`);
  const writes = manifestSteps.findIndex((s) => !/--check|--validate/.test(s));
  const checks = manifestSteps.findIndex((s) => /--check/.test(s));
  assert.ok(checks >= 0, `the publish chain never CHECKS the manifest:\n  ${manifestSteps.join('\n  ')}`);
  assert.ok(writes === -1 || writes > checks,
    'a step that REGENERATES manifest.json runs before the step that checks it, which makes the '
    + `check vacuous:\n  ${manifestSteps.join('\n  ')}`);

  // And by execution, because the ordering argument above is still an argument. A catalog one
  // directory shorter than the committed manifest must make this chain fail.
  const mini = scratch('gg-manifest-');
  for (const dir of ['scripts', 'targets', 'schema']) cpSync(join(ROOT, dir), join(mini, dir), { recursive: true });
  cpSync(join(ROOT, 'package.json'), join(mini, 'package.json'));
  symlinkSync(join(ROOT, 'node_modules'), join(mini, 'node_modules'));
  for (const id of ['orient', 'suggest']) {
    cpSync(join(ROOT, 'skills', id), join(mini, 'skills', id), { recursive: true });
  }
  const build = (args) => spawnSync(process.execPath, [join(mini, 'scripts', 'build-manifest.js'), ...args],
    { cwd: mini, encoding: 'utf8' });
  assert.equal(build([]).status, 0, 'the fixture needs a manifest to begin with');
  rmSync(join(mini, 'skills', 'suggest'), { recursive: true, force: true });

  // Replay the real steps, in the real order, from the expanded chain.
  let exit = 0;
  let said = '';
  for (const step of manifestSteps) {
    const out = build(step.replace(/^node \S+/, '').trim().split(/\s+/).filter(Boolean));
    said += `${out.stdout}${out.stderr}`;
    exit = out.status ?? 0;
    if (exit !== 0) break;
  }
  assert.equal(exit, 1, `a truncated catalog must fail the publish chain, and it printed:\n${said}`);
  assert.match(said, /manifest\.json is stale/, said);
});

test('gg27 · the `! grep` correction in ci.yml, executed in its three states', () => {
  // B4 of stage 6's review: this was filed as NOT VERIFIED and it was verifiable all along, without
  // touching the user's account. The workflow cannot RUN (Actions are disabled on the fork), but the
  // shell block is a shell block, so it is extracted from `ci.yml` itself — not retyped — and run.
  //
  // What it replaced: `! grep -r <patterns> .`, which turns grep's exit 2 ("I could not finish the
  // scan") into a PASS, because `!` only distinguishes zero from non-zero. That is the defect class
  // this whole session keeps meeting: a check that cannot run reporting success.
  //
  // DECLARED about the measurement: the runner is ubuntu-latest with GNU grep, and this machine's
  // `grep` in PATH is ugrep. PATH is pinned to /usr/bin:/bin so the system grep decides, not a
  // user-installed shim, and the three exit codes being relied on (0 found, 1 not found, 2 error)
  // are POSIX, not a GNU extension.
  const yaml = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8').split('\n');
  const step = yaml.findIndex((l) => /^\s*-\s*name:\s*cleanup gate/.test(l));
  assert.ok(step >= 0, 'the cleanup-gate step is gone from ci.yml — this test has nothing to verify');
  const runAt = yaml.findIndex((l, i) => i > step && /^\s*run:\s*\|\s*$/.test(l));
  assert.ok(runAt > step, 'the cleanup-gate step no longer carries a block scalar');
  const indent = (l) => l.length - l.trimStart().length;
  const body = [];
  for (let i = runAt + 1; i < yaml.length; i += 1) {
    if (yaml[i].trim() && indent(yaml[i]) <= indent(yaml[runAt])) break;
    body.push(yaml[i]);
  }
  const pad = Math.min(...body.filter((l) => l.trim()).map(indent));
  const script = body.map((l) => l.slice(pad)).join('\n');
  assert.match(script, /grep -rIn/, script);
  assert.ok(!/^\s*!\s*grep/m.test(script), 'the `! grep` form is back, and it reads exit 2 as success');

  const fixture = scratch('gg-cleanup-');
  const sh = join(fixture, 'cleanup.sh');
  writeFileSync(sh, script);
  const runIn = (dir) => spawnSync('bash', [sh], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' },
  });

  // 1. clean tree → exit 0, and it says why.
  const clean = join(fixture, 'clean');
  mkdirSync(clean, { recursive: true });
  writeFileSync(join(clean, 'a.md'), 'nothing retired here\n');
  const ok = runIn(clean);
  assert.equal(ok.status, 0, `${ok.stdout}${ok.stderr}`);
  assert.match(ok.stdout, /clean: no residue/, ok.stdout);

  // 2. planted residue → exit 1, naming the finding.
  const dirty = join(fixture, 'dirty');
  mkdirSync(dirty, { recursive: true });
  writeFileSync(join(dirty, 'b.md'), 'see sync-bundles for the old model\n');
  const found = runIn(dirty);
  assert.equal(found.status, 1, `${found.stdout}${found.stderr}`);
  assert.match(`${found.stdout}${found.stderr}`, /retired marketplace-distribution residue/, found.stdout);

  // 3. the scan itself fails → exit 1, NOT 0. This is the case the correction exists for.
  assert.notEqual(process.getuid?.(), 0,
    'running as root cannot stage an unreadable directory, so state 3 cannot be measured here — '
    + 'which is a check that could not run, not a check that passed');
  const broken = join(fixture, 'broken');
  const locked = join(broken, 'locked');
  mkdirSync(locked, { recursive: true });
  writeFileSync(join(locked, 'c.md'), 'anything\n');
  spawnSync('chmod', ['000', locked]);
  const failed = runIn(broken);
  spawnSync('chmod', ['755', locked]);
  assert.equal(failed.status, 1,
    `a scan that could not finish must FAIL, and it exited ${failed.status}:\n${failed.stdout}${failed.stderr}`);
  assert.match(`${failed.stdout}${failed.stderr}`, /the scan itself failed \(grep exit 2\)/,
    `${failed.stdout}${failed.stderr}`);
  assert.match(`${failed.stdout}${failed.stderr}`, /a check that cannot run is not a pass/);
});

// ── A1 of stage 6's review: the §10 sweep was narrower than §10 ──────────────

/**
 * Hits that are NOT the parent harness: two other repositories of the same author. `mem-slop` is a
 * third-party tool the harness offers, and `ericrisco/RSC` is an inherited `.gitignore` comment
 * about a migration. A blanket rename would have turned both into 404s, which is why `gi04` exists.
 */
const NOT_THE_PARENT = /ericrisco\/(?:mem-slop|RSC\b)/g;

/**
 * Paths where the parent's name is there ON PURPOSE, each with the reason. These are pattern-only,
 * not count-pinned, because every one of them is owned by a stage that is editing it right now and
 * a pinned number would be a tripwire on someone else's work. Three of the four groups are already
 * under a STRICTER rule than this sweep: `gi03` allows the parent's name ZERO times anywhere in
 * `scripts/ targets/ schema/ .github/ package.json`, so where the two overlap this sweep defers to
 * the test that demands more.
 */
const BY_DESIGN = [
  [/^docs\/fork\//, 'the fork\'s own record: `REQUIREMENTS.md` is the user\'s prompt verbatim, and the '
    + 'ledger and the stage documents quote measurements of the parent\'s name. A sweep that demanded '
    + 'zero here would be demanding that the record be falsified'],
  [/^scripts\/(lib\/)?upstream-|^tests\/governance-upstream-maintenance\.test\.js$/,
    'the stage-5 maintenance machine, whose job is to LOOK FOR the parent\'s name in the fork\'s artifacts'],
  [/^scripts\/lib\/governance\.js$/, 'D16\'s identity map: the token table that performs the rename'],
  [/^tests\/(governance-(identity|always-on|gate|suggested-commands)|product-surfaces)\.test\.js$|^tests\/worktree-reaper\.test\.js$/,
    'tests that ASSERT about the parent\'s name, which is the opposite of leaking it — this file '
    + 'included: the sweep below quotes what it is hunting for, and found itself on the first run. '
    + '`product-surfaces` joined after stage 7, and the way it got in is worth keeping: the '
    + 'coordinator ran this sweep while that file was still UNTRACKED, so `git ls-files` could '
    + 'not see it, recorded "green", and the very commit that recorded it is what made the file '
    + 'tracked and this test red. Verifying before the action that changes what is measured is '
    + 'not verifying. '
    + '`governance-suggested-commands` joined the group after D16: a test that proves no consumer-'
    + 'visible instruction names the parent has to PLANT one to detect it, which is the same reason '
    + '`gi03` excepts the identity map. Added by the coordinator, not by the stage that wrote the '
    + 'list — D16 landed after it, so the sweep caught a genuine gap rather than a stale entry'],
];

/**
 * Generated from `skills/`, which Strategy B freezes. Not independently editable — a hand edit fails
 * `npm run manifest:check` — so this is L-D5 showing through a derived file, not a second defect.
 * Count-pinned, because `skills/` does not move.
 */
const DERIVED_FROM_THE_FROZEN_CATALOG = { 'manifest.json': { spec: 2, url: 0 } };

/**
 * KNOWN EXCEPTIONS, written down 2026-11-02, to be EMPTIED by stage 7.
 *
 * `PLAN.md` assigns "README, imágenes y documentación" to stage 7, so the work is not stage 6's.
 * The numbers are. Each is an upper bound: progress passes without touching this list, growth fails,
 * and an entry that reaches zero must be DELETED — the assertion below says so, which is what makes
 * the list get emptied instead of rotting.
 *
 * TWO NUMBERS PER PATH, because they are TWO DIFFERENT DECISIONS and a single total hid that:
 *
 *   `spec` — the package specifier `@ericrisco/rsc`. This is the class D16's identity map rewrites,
 *            and the class that is RUNNABLE: an agent or a human who obeys one installs the parent's
 *            CLI, whose installer writes an ungoverned base.
 *   `url`  — everything else the bare token appears in, and none of it is a find-and-replace. It is
 *            upstream's Pages host (`ericrisco.github.io/rsc-harness`), upstream's repository
 *            (`github.com/ericrisco/rsc-harness`) and, in the site's JSON-LD, the AUTHOR's profile
 *            (`github.com/ericrisco`, twice per page). A token map over the bare word would turn the
 *            first two into 404s and strip attribution MIT requires from the third — the same trap
 *            `gi04` exists for with mem-slop. Some of these should become the fork's (the site's own
 *            canonical links, the stars fetch); some should stay upstream's (attribution). Stage 7
 *            decides them one at a time.
 */
const CARRIED_TO_STAGE_7 = {
  // RECONCILED by the coordinator after stage 7 landed. `spec` fell 49 → 2 across these paths and
  // `url` 89 → 24; four entries reached zero on BOTH counts and were DELETED, which is what this
  // list's own assertion demands — `site/sitemap.xml`, `site/robots.txt`, `site/diagram.svg` and
  // `site/assets/rsc.js`. The last two are worth naming as they go: `diagram.svg` carried
  // `npx @ericrisco/rsc@latest` DRAWN INSIDE THE IMAGE, which no text sweep of the repository had
  // ever counted, and `assets/rsc.js` asked the GitHub API for the PARENT repository's stars on a
  // page inviting you to star the fork.
  //
  // The two specifiers left in README.md are both inside one parent-vs-fork comparison row. They
  // are not runnable by construction: the whole job of that cell is to print the parent's package
  // name beside the fork's so the two cannot be confused, which is what §10 asks for.
  'README.md': { spec: 2, url: 8 },
  'site/index.html': { spec: 0, url: 5 },
  'site/es/index.html': { spec: 0, url: 5 },
  'site/llms.txt': { spec: 0, url: 2 },
  // The one count that GREW, 1 → 4, and all four must point at the parent. Two are the fork
  // disclosure and the MIT copyright notice, which the licence requires. Two are vulnerability
  // routing: a flaw in INHERITED code goes to the parent's advisory form, because the parent is the
  // only party who can fix it for everyone downstream — and that form is live (`enabled: true`,
  // measured), while this fork's own private reporting is not. None of the four is runnable.
  'SECURITY.md': { spec: 0, url: 4 },
};

test('gg25 · the §10 sweep covers EVERY tracked path outside `skills/`, with a dated exception list', () => {
  // A1 of stage 6's review. The stage's own sweep was scoped to `scripts/ targets/ tests/ schema/
  // .github/ package.json`, and `gi03` walks those same roots — so `README.md`, `site/`,
  // `SECURITY.md` and `package-lock.json` were never looked at, and nothing freezes them: the
  // Strategy B invariant is `skills/` and only `skills/`. 142 bare-token references were sitting
  // there, including the README that travels in the tarball and `site/llms.txt`, which is the file
  // that tells an agent what to run.
  //
  // The lesson this sweep is built against: an exception list that swallows the tree passes
  // forever. So the list is explicit, dated, mostly count-pinned, and the only wildcard groups are
  // paths a STRICTER test already owns.
  const ls = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  assert.equal(ls.status, 0,
    `the sweep could not enumerate the tree — that is a FAILED check, not a passed one: ${ls.stderr}`);
  const tracked = ls.stdout.split('\0').filter(Boolean);
  assert.ok(tracked.length > 1500, `${tracked.length} tracked paths — the enumeration looks truncated`);
  const outside = tracked.filter((p) => !p.startsWith('skills/'));
  assert.ok(outside.length > 200, `${outside.length} paths outside skills/ — the sweep is looking at too little`);

  const counts = new Map();
  for (const rel of outside) {
    let text;
    try { text = readFileSync(join(ROOT, rel), 'utf8'); } catch { continue; }
    const bare = (text.replace(NOT_THE_PARENT, '').match(/ericrisco/g) || []).length;
    if (!bare) continue;
    const spec = (text.match(/@ericrisco\/rsc/g) || []).length;
    counts.set(rel, { spec, url: bare - spec, bare });
  }

  const declared = { ...DERIVED_FROM_THE_FROZEN_CATALOG, ...CARRIED_TO_STAGE_7 };
  const unexplained = [];
  const grown = [];
  for (const [rel, hit] of counts) {
    if (BY_DESIGN.some(([re]) => re.test(rel))) continue;
    if (!Object.hasOwn(declared, rel)) { unexplained.push(`${rel} (spec ${hit.spec}, url ${hit.url})`); continue; }
    for (const kind of ['spec', 'url']) {
      if (hit[kind] > declared[rel][kind]) grown.push(`${rel} ${kind}: ${hit[kind]} > the declared ${declared[rel][kind]}`);
    }
  }
  assert.deepEqual(unexplained.sort(), [],
    'these tracked paths name the parent and are in no declared group. Nothing freezes them, so '
    + 'either fix them or write them down with a reason:\n  ' + unexplained.sort().join('\n  '));
  assert.deepEqual(grown, [], `the parent's name SPREAD since this list was written:\n  ${grown.join('\n  ')}`);

  // And the list has to empty itself. An entry at zero is a line of paperwork pretending to be a
  // limitation, which is how an exception list becomes the thing that hides the next A1.
  const stale = Object.keys(declared).filter((rel) => !counts.has(rel));
  assert.deepEqual(stale.sort(), [],
    `fixed — now delete these from the exception list in this test:\n  ${stale.sort().join('\n  ')}`);

  // The totals, reported so the ledger quotes a measurement and not a memory. The RUNNABLE class is
  // the one that matters for §10, and it is the smaller of the two.
  const sum = (kind) => Object.keys(CARRIED_TO_STAGE_7).reduce((s, rel) => s + (counts.get(rel)?.[kind] || 0), 0);
  assert.ok(sum('spec') <= 49, `the stage-7 specifier surface is ${sum('spec')}, over the 49 measured on 2026-11-02`);
  assert.ok(sum('url') <= 89, `the stage-7 URL surface is ${sum('url')}, over the 89 measured on 2026-11-02`);
});

test('gg24 · the catalog size has a FLOOR, so a truncated `skills/` cannot report 100 %', async () => {
  // THIS TEST USED TO MEASURE NOTHING, and rewriting it matters more than the floor it guards.
  //
  // It asserted that the instrument's SOURCE contained the string "catalog size floor" and called
  // `arg('expect')`. The independent review of stage 6 mutated the floor to a condition that can
  // never fire and this test stayed GREEN — because a test that greps the implementation for a
  // phrase is testing the phrase. It also found the floor itself was not one: it compared
  // `ids.length` against `manifest.json`'s count, and BOTH SIDES DERIVE FROM `skills/`, since
  // `build-manifest.js` generates the manifest from that tree. Deleting 5 skills and regenerating
  // gave `269 | 269 | floor failures = []`.
  //
  // So the floor now compares against a committed blob at `origin/main`, which cannot move when the
  // working tree does, and this test runs the floor OVER FIXTURES. Every case below fails if the
  // comparison is weakened, which is the property the old version lacked.
  const { catalogSizeFloor, committedCatalogCount, workingTreeManifestCount } =
    await import('../scripts/verify-catalog-conformance.js');
  const floorFindings = (o) => catalogSizeFloor(o).failures.filter((f) => f.startsWith('catalog size floor'));

  // THE TRUNCATED CATALOG: the case the floor exists for, and the one the old floor let through.
  const truncated = floorFindings({ found: 269, committedCount: 274, manifestCount: 269 });
  assert.equal(truncated.length, 1, `a truncated catalog must be a finding: ${JSON.stringify(truncated)}`);
  assert.match(truncated[0], /TRUNCATED/);
  assert.match(truncated[0], /269 skills but origin\/main's manifest counts 274/,
    'and it must name both numbers, or the reader cannot tell how far off it is');

  // The exact shape the review demonstrated: the manifest regenerated from the truncated tree, so
  // the two working-tree readings AGREE. The old floor reported nothing here; the new one still bites.
  assert.equal(catalogSizeFloor({ found: 269, committedCount: 274, manifestCount: 269 })
    .failures.filter((f) => f.startsWith('manifest freshness')).length, 0,
  'premise: a regenerated manifest agrees with the truncated tree, which is why that check is not a floor');

  // THE INTACT CATALOG: no finding, or the floor is just noise.
  assert.deepEqual(floorFindings({ found: 274, committedCount: 274, manifestCount: 274 }), []);
  // A catalog that GREW (an upstream integration) is not a truncation.
  assert.deepEqual(floorFindings({ found: 280, committedCount: 274, manifestCount: 280 }), []);

  // NO REFERENCE IS A FAILURE, NOT A PASS: an unanchored denominator is the condition this refuses.
  const unanchored = floorFindings({ found: 274, committedCount: null, manifestCount: 274 });
  assert.equal(unanchored.length, 1, 'no committed reference must fail loudly');
  assert.match(unanchored[0], /no reference independent of the tree under test/);

  // And the pinned expectation still works, for a release gate that wants the number it measured.
  assert.equal(floorFindings({ found: 274, committedCount: 274, manifestCount: 274, expected: '273' }).length, 1);
  assert.deepEqual(floorFindings({ found: 274, committedCount: 274, manifestCount: 274, expected: '274' }), []);

  // §3: the number must not be fixed in the code.
  const source = readFileSync(join(ROOT, 'scripts', 'verify-catalog-conformance.js'), 'utf8');
  assert.ok(!/ids\.length !== 274/.test(source), '§3: the number must not be fixed in the code');

  // And the real reference resolves in this checkout, so the floor is live and not merely testable.
  const committed = committedCatalogCount();
  const dirs = readdirSync(join(ROOT, 'skills'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(ROOT, 'skills', e.name, 'SKILL.md'))).length;
  assert.equal(typeof committed, 'number', 'origin/main must carry a manifest count to compare against');
  assert.ok(dirs >= committed, `the working tree has ${dirs} skills, origin/main committed ${committed}`);
  assert.equal(workingTreeManifestCount(), dirs, 'and the working-tree manifest is current');
});
