// Acceptance criterion 4, as a library — so the same audit can run in two places that are NOT the
// same place, and give the same verdict in both.
//
// Stage 4 built this audit inside `scripts/verify-catalog-conformance.js`, which installs all 274
// skills into a disposable project and sweeps them. That instrument answers "does THIS REPOSITORY
// produce a conformant catalog?". It cannot answer the question a consumer actually has, which is
// "are the 274 skills in MY project governed, right now?" — because it needs the repository's
// `skills/` mirror, which a consumer does not have, and because it installs, which a consumer did
// not ask for.
//
// Stage 4 found why that gap matters (ledger §2n, D13): `restoreEntry` in `scripts/lib/backups.js`
// is a SECOND writer inside `.rsc/skills/`, and `install-apply.js` puts `baseDir(...)` in the
// snapshot set. A snapshot taken over a base that came from upstream captures it ungoverned, so
// `rscg restore` can hand a project back a base with no contract — and the 17 symlinking targets
// read that file immediately. D13 decided the semantics do not change: `restore` is a time machine
// and must stay one. What changes is that the product can now SAY it, which needs this audit to be
// callable outside the fork's own checkout.
//
// So the audit lives here, with no dependency on `install-apply.js`, and both callers import it:
// the Stage 4 sweep (which adds the install and the three passes) and `rscg conformance` (which
// adds nothing — it only reads). One implementation, two callers; a second copy is exactly the
// defect this session already committed once, with `contract-v1.md`.

import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { baseDir, targetPaths, TARGET_IDS } from '../../targets/index.js';
import { readManifest } from './manifest-file.js';
import {
  BLOCK_BEGIN, BLOCK_END, GOVERNANCE_VERSION, PARENT_PACKAGE,
  customizationPathFor, digestOf, governanceOf, parentReferences, renderBlock,
} from './governance.js';

/** Everything criterion 4 asks of one distributed `SKILL.md`, as a list of failures. */
export function auditBase(id, text) {
  const bad = [];
  const info = governanceOf(text);
  if (!info.block) bad.push('no governance block');
  if (!info.keys.governance) bad.push('no `governance` key');
  if (!info.keys['governance-customization']) bad.push('no `governance-customization` key');
  if (!info.keys['governance-digest']) bad.push('no `governance-digest` key');
  // A partial is exactly this: something of governance present, something else missing.
  if (info.block && !info.complete) bad.push('PARTIAL: block present, a key missing');
  if (!info.block && Object.keys(info.keys).length) bad.push('PARTIAL: keys present, no block');
  if (info.block && !info.digestMatches) bad.push('digest does not match its own block');
  if (info.keys.governance && info.keys.governance !== GOVERNANCE_VERSION) bad.push(`governance is ${info.keys.governance}`);
  if (info.keys['governance-customization'] && info.keys['governance-customization'] !== customizationPathFor(id)) {
    bad.push(`customization path is ${info.keys['governance-customization']}`);
  }
  if (info.keys['governance-digest'] && info.keys['governance-digest'] !== digestOf(renderBlock(id))) {
    bad.push('digest is not the digest of THIS skill\'s rendered block');
  }
  const opens = text.split(BLOCK_BEGIN).length - 1;
  const closes = text.split(BLOCK_END).length - 1;
  if (opens !== 1) bad.push(`DUPLICATE: ${opens} opening markers`);
  if (closes !== 1) bad.push(`DUPLICATE: ${closes} closing markers`);
  for (const key of ['governance', 'governance-customization', 'governance-digest']) {
    const n = (text.match(new RegExp(`^${key}:`, 'gm')) || []).length;
    if (n !== 1) bad.push(`DUPLICATE: ${n} \`${key}\` keys`);
  }
  // "Read this before applying the skill below" is false if the block sits at the bottom.
  const marker = BLOCK_BEGIN.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  if (!new RegExp(`\\n---\\n${marker}`).test(text)) bad.push('the block does not open the body');
  // D16, and the half of criterion 4 that was decidable but not instrumented. A distributed skill
  // that still names the parent's package hands the reader a runnable `npx <parent> add <id>` whose
  // installer writes a base with NO contract into a fork-governed project. That is a governance
  // failure in the delivery, measured in the same place every other one is, with the line number so
  // the finding is actionable instead of merely true. (The literal specifier lives in exactly one
  // place, `PARENT_PACKAGE` in governance.js, so `gi03` has one exception to make and not many.)
  for (const { line, text: at } of parentReferences(text)) {
    bad.push(`line ${line} names the parent package ${PARENT_PACKAGE}: ${at}`);
  }
  return bad;
}

/** What the target handed the assistant, audited per target family. */
export function auditDelivery(target, id, cwd, home, basePath) {
  if (target === 'cursor') {
    const mdc = join(cwd, '.cursor', 'rules', `${id}.mdc`);
    if (!existsSync(mdc)) return ['no .mdc delivered'];
    const text = readFileSync(mdc, 'utf8');
    const bad = [];
    const block = (text.match(/<!-- rsc-governance:begin [^\n]*?-->[\s\S]*?<!-- rsc-governance:end -->/) || [])[0] || null;
    if (!block) bad.push('no governance block in the .mdc');
    // The one genuinely transformed delivery: a rendering fault here is invisible to both the base
    // validator and the digest, so the bytes are compared against the rendered block directly.
    else if (block !== renderBlock(id)) bad.push('the .mdc block is not byte-identical to the rendered block');
    // DUPLICATES, in the one delivery where they were not being counted. `auditBase` counts markers
    // and keys; this branch never ran it, and the extraction above takes the FIRST match, so a `.mdc`
    // carrying the body twice — two opening markers, two closing ones, double the bytes — reported
    // conformant. Demonstrated by mutating `targets/cursor.js` to write the body twice: the
    // instrument said 274/274, failures: 0. Found by the independent review of stage 4.
    const opens = text.split(BLOCK_BEGIN).length - 1;
    const closes = text.split(BLOCK_END).length - 1;
    if (opens !== 1) bad.push(`DUPLICATE: ${opens} opening markers in the .mdc`);
    if (closes !== 1) bad.push(`DUPLICATE: ${closes} closing markers in the .mdc`);
    // And the block must OPEN the body, right after the frontmatter `targets/cursor.js` rewrites.
    // "Read this before applying the skill below" is false if the block sits anywhere else, and the
    // base's own version of this check cannot speak for a file whose frontmatter was replaced.
    if (block && !new RegExp(`^---\\n[\\s\\S]*?\\n---\\n${BLOCK_BEGIN.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}`).test(text)) {
      bad.push('the .mdc block does not open the body after the rewritten frontmatter');
    }
    // The declared hole, asserted rather than assumed (CONTRACT.md §1).
    for (const key of ['governance:', 'governance-customization:', 'governance-digest:']) {
      if (new RegExp(`^${key}`, 'm').test(text)) bad.push(`the .mdc now carries \`${key}\` — CONTRACT.md §1 says it does not`);
    }
    // D16 on the one RE-RENDERED delivery. `auditBase` cannot speak for a file cursor.js rebuilt
    // from its own frontmatter plus a body it rewrote, which is exactly why the duplicate-marker
    // class had to be added here too after stage 4's review.
    for (const { line, text: at } of parentReferences(text)) {
      bad.push(`the .mdc names the parent package at line ${line}: ${at}`);
    }
    return bad;
  }
  // Derived from the target table rather than hardcoded, so adding a target cannot silently fall
  // out of this audit.
  const dir = targetPaths(target, home, cwd).skillDir(id);
  const md = join(dir, 'SKILL.md');
  if (!existsSync(md)) return ['no SKILL.md delivered'];
  const bad = [];
  // 17 of 18 targets deliver a SYMLINK to the base, so the delivered file IS the base file. That is
  // the claim `CONTRACT.md` §1 makes, and until stage 4's independent review it was not measured:
  // the old check read
  //
  //     if (lstatSync(dir).isSymbolicLink() && realpath(dir) !== realpath(base)) bad.push(…)
  //
  // so a delivery that was NOT a symlink never entered the branch and produced no finding, and the
  // byte comparison that followed is byte-identical by construction immediately after an install.
  // Demonstrated by forcing `linkOrCopy`'s Windows path (`cpSync`): every delivery became a real
  // copy and the instrument still reported 274/274, failures: 0.
  //
  // So the two conditions are separated, and "not a link" is a finding of its own. A copy that stops
  // tracking the base does not go wrong at install time — it goes wrong on the next governed change,
  // silently, forever, which is precisely the failure a conformance validator exists to catch.
  const kind = deliveryKind(target, id, cwd, home);
  if (kind === 'copy') {
    if (process.platform === 'win32') {
      // On Windows copying is correct BY DESIGN (`targets/index.js`: relative dir symlinks need
      // Developer Mode and are not reliably followed by skill discovery). The class is measured the
      // other way there — the whole subtree must equal the base — and declared as limit L5, because
      // this repository has no Windows environment to run it in.
      const differing = treeDifferences(dir, basePath);
      if (differing.length) bad.push(`the copied delivery differs from the base in: ${differing.slice(0, 5).join(', ')}`);
    } else {
      bad.push('the delivery is a COPY, not a symlink to the governed base: `linkOrCopy` fell back, '
        + 'so this skill stops tracking the base from here on');
    }
  } else if (kind === 'symlink') {
    try {
      if (realpathSync(dir) !== realpathSync(basePath)) bad.push('the delivered directory does not resolve to the governed base');
    } catch { bad.push('could not resolve the delivered symlink'); }
  } else {
    bad.push(`could not classify the delivered directory (${kind})`);
  }
  if (readFileSync(md, 'utf8') !== readFileSync(join(basePath, 'SKILL.md'), 'utf8')) {
    bad.push('the delivered SKILL.md differs from the governed base');
  }
  return bad;
}

/**
 * How a target delivered one skill. One definition, two uses: the audit above turns it into a
 * finding, and the report counts it — because "17 of 18 targets symlink" is a sentence that needs a
 * number behind it, and nothing was producing one.
 *
 * @returns {'symlink'|'copy'|'cursor-mdc'|'missing'|'unreadable'}
 */
export function deliveryKind(target, id, cwd, home = homedir()) {
  if (target === 'cursor') {
    return existsSync(join(cwd, '.cursor', 'rules', `${id}.mdc`)) ? 'cursor-mdc' : 'missing';
  }
  const dir = targetPaths(target, home, cwd).skillDir(id);
  try {
    const stat = lstatSync(dir);
    if (stat.isSymbolicLink()) return 'symlink';
    if (stat.isDirectory()) return 'copy';
    return 'unreadable';
  } catch { return 'missing'; }
}

/** Relative paths where two trees disagree, by bytes. Used only on the Windows copy path. */
function treeDifferences(a, b, prefix = '') {
  const out = [];
  let entries;
  try { entries = readdirSync(a, { withFileTypes: true }); } catch { return [prefix || '.']; }
  for (const e of entries.sort((x, y) => x.name.localeCompare(y.name))) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    const left = join(a, e.name);
    const right = join(b, e.name);
    if (e.isDirectory()) { out.push(...treeDifferences(left, right, rel)); continue; }
    try {
      if (readFileSync(left).equals(readFileSync(right))) continue;
    } catch { /* fall through to the push below */ }
    out.push(rel);
  }
  return out;
}

/**
 * The body each target's always-on layer ends up reading. For `claude` that is NOT the hook target
 * — `targets/claude.js` writes a PATH into `settings.json` and the hook reads the file at run time,
 * so following the stored path is the only non-vacuous way to look at it (the vacuity this avoids
 * was shipped once in this design's earlier draft).
 */
export function alwaysOnSurface(target, cwd, home) {
  const paths = targetPaths(target, home, cwd);
  if (target === 'claude') {
    let settings;
    try { settings = JSON.parse(readFileSync(join(cwd, '.claude', 'settings.json'), 'utf8')); }
    catch { return { error: 'no .claude/settings.json' }; }
    const commands = Object.values(settings.hooks ?? {}).flat()
      .flatMap((e) => e.hooks ?? []).map((h) => h.command).filter((c) => typeof c === 'string');
    const wired = (commands.join(' ').match(/\$\{CLAUDE_PROJECT_DIR\}\/[^"'\s]+/g) || [])
      .map((p) => p.replace('${CLAUDE_PROJECT_DIR}/', '')).filter((p) => p.endsWith('.md'));
    if (wired.length !== 1) return { error: `expected exactly one wired .md body, got ${JSON.stringify(wired)}` };
    const abs = join(cwd, wired[0]);
    if (!existsSync(abs)) return { error: `the wired body does not exist: ${wired[0]}` };
    return { from: wired[0], text: readFileSync(abs, 'utf8') };
  }
  if (!existsSync(paths.hookTarget)) return { error: `no hook target at ${relative(cwd, paths.hookTarget)}` };
  return { from: relative(cwd, paths.hookTarget), text: readFileSync(paths.hookTarget, 'utf8') };
}

/** The skill bases materialized in a project: `.rsc/skills/<id>/`, the only copy any assistant reads. */
export function installedBaseIds(cwd = process.cwd()) {
  try {
    return readdirSync(join(cwd, '.rsc', 'skills'), { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch { return []; }
}

/**
 * The ungoverned bases among a set of absolute paths — the question `restore` and the onboarding
 * rollback need answered, and nothing wider. A path that is not a skill base is ignored; a base
 * whose `SKILL.md` is gone is reported, because an absent file is not a governed one.
 *
 * Same audit as everywhere else: `auditBase`. This returns the subset of ids with findings, not a
 * second, laxer notion of "governed".
 */
export function ungovernedAmong(cwd, paths) {
  const bases = new Set();
  for (const p of paths || []) {
    const rel = relative(cwd, String(p)).split(/[/\\]/);
    if (rel[0] === '.rsc' && rel[1] === 'skills' && rel[2] && !rel[2].startsWith('..')) bases.add(rel[2]);
  }
  const out = [];
  for (const id of [...bases].sort()) {
    const md = join(baseDir(id, cwd), 'SKILL.md');
    if (!existsSync(md)) { out.push({ id, reasons: ['no SKILL.md at the base'] }); continue; }
    let bad;
    try { bad = auditBase(id, readFileSync(md, 'utf8')); }
    catch (err) { bad = [`could not be read: ${err.code || err.message}`]; }
    if (bad.length) out.push({ id, reasons: bad });
  }
  return out;
}

/**
 * Criterion 4 over a CONSUMER project: every base in `.rsc/skills/`, plus the per-target delivery
 * of each declared assistant, plus the always-on surface of each — which must carry NO governance.
 *
 * Read-only. It installs nothing, writes nothing and reaches no network. `ran: false` when the
 * project has no `.rsc/skills/`, which is a valid state (nothing is installed) and not a finding.
 *
 * `targets` defaults to what `.rsc.json` declares, intersected with the targets whose state file is
 * actually on disk — the declaration can name an assistant this machine never installed, and
 * reporting that as a conformance failure would be a lie about governance.
 */
export function auditInstalledProject({ cwd = process.cwd(), home = homedir(), targets = null, deliveries = true } = {}) {
  const ids = installedBaseIds(cwd);
  if (!existsSync(join(cwd, '.rsc', 'skills'))) {
    return { ran: false, reason: 'no .rsc/skills/ in this project — nothing is installed here', cwd };
  }
  let declared = targets;
  if (!declared) {
    let manifestTargets = [];
    try { manifestTargets = readManifest(cwd)?.targets || []; } catch { manifestTargets = []; }
    declared = manifestTargets.filter((t) => TARGET_IDS.includes(t));
  }
  const present = declared.filter((t) => existsSync(targetPaths(t, home, cwd).stateFile));

  const report = {
    ran: true,
    cwd,
    governanceVersion: GOVERNANCE_VERSION,
    installed: ids.length,
    governed: 0,
    ungoverned: [],
    targets: {},
    alwaysOn: {},
    declaredTargets: declared,
    auditedTargets: present,
    targetsDeclaredButNotInstalled: declared.filter((t) => !present.includes(t)),
  };

  for (const id of ids) {
    const md = join(baseDir(id, cwd), 'SKILL.md');
    if (!existsSync(md)) { report.ungoverned.push({ id, reasons: ['no SKILL.md at the base'] }); continue; }
    let bad;
    try { bad = auditBase(id, readFileSync(md, 'utf8')); }
    catch (err) { bad = [`could not be read: ${err.code || err.message}`]; }
    if (bad.length) report.ungoverned.push({ id, reasons: bad });
    else report.governed += 1;
  }

  for (const target of deliveries ? present : []) {
    const bad = [];
    let ok = 0;
    const kinds = {};
    for (const id of ids) {
      const findings = auditDelivery(target, id, cwd, home, baseDir(id, cwd));
      const kind = deliveryKind(target, id, cwd, home);
      kinds[kind] = (kinds[kind] || 0) + 1;
      if (findings.length) bad.push({ id, reasons: findings });
      else ok += 1;
    }
    // Counted, not asserted in prose: `CONTRACT.md` §1 claims 17 of 18 targets symlink to the base,
    // and before stage 4's review nothing produced the number that claim needs.
    report.targets[target] = { delivered: ok, of: ids.length, kinds, failures: bad };
    const surface = alwaysOnSurface(target, cwd, home);
    report.alwaysOn[target] = surface.error
      ? { error: surface.error }
      : {
        from: surface.from,
        bytes: Buffer.byteLength(surface.text),
        // The always-on body applies no skill, so the preamble has no referent there. A block that
        // reached it is a defect in the other direction: context paid on every turn, for nothing.
        carriesGovernance: surface.text.includes(BLOCK_BEGIN) || surface.text.includes(BLOCK_END),
        // D16, and the WORST case of it: this is the surface Claude Code re-emits at every
        // SessionStart and after every compaction, so a parent-named command here is an instruction
        // the agent is handed again and again. Until now this class was decidable from the bytes the
        // instrument already had in hand and nothing asked the question — the same shape of gap the
        // stage-4 review found twice, where a check existed and measured nothing.
        namesParent: parentReferences(surface.text),
      };
  }

  report.deliveriesAudited = deliveries;
  report.conformant = report.ungoverned.length === 0
    && Object.values(report.targets).every((t) => t.failures.length === 0)
    && Object.values(report.alwaysOn).every((a) => !a.error && !a.carriesGovernance
      && !(a.namesParent || []).length);
  return report;
}

/** One line per finding, plus a summary. The format a human reads; `--json` gives the other one. */
export function formatConformance(report) {
  if (!report.ran) return [report.reason];
  const out = [];
  for (const { id, reasons } of report.ungoverned) out.push(`UNGOVERNED .rsc/skills/${id}/SKILL.md: ${reasons.join('; ')}`);
  for (const [target, t] of Object.entries(report.targets)) {
    for (const { id, reasons } of t.failures) out.push(`DELIVERY ${target} ${id}: ${reasons.join('; ')}`);
  }
  for (const [target, a] of Object.entries(report.alwaysOn)) {
    if (a.error) { out.push(`ALWAYS-ON ${target}: ${a.error}`); continue; }
    if (a.carriesGovernance) out.push(`ALWAYS-ON ${target}: the governance block reached ${a.from} — it must not`);
    // File and line, because this finding is a line of text a consumer has to be able to go and
    // look at — and because a verdict with no location is the kind of report nobody can act on.
    for (const { line, text } of a.namesParent || []) {
      out.push(`ALWAYS-ON ${target}: ${a.from}:${line} names the parent package — ${text}`);
    }
  }
  out.push('');
  out.push(`${report.governed}/${report.installed} installed skills carry the governance contract (${report.governanceVersion}).`);
  for (const [target, t] of Object.entries(report.targets)) {
    const kinds = Object.entries(t.kinds || {}).map(([k, n]) => `${n} ${k}`).join(', ');
    out.push(`  ${target}: ${t.delivered}/${t.of} delivered conformant`
      + `${kinds ? ` (${kinds})` : ''}`
      + `, always-on ${(() => {
        const a = report.alwaysOn[target];
        if (a?.error) return 'ERROR';
        if (a?.carriesGovernance) return 'CARRIES GOVERNANCE';
        if (a?.namesParent?.length) return `NAMES THE PARENT (${a.namesParent.length}×)`;
        return 'clean';
      })()}`);
  }
  if (report.targetsDeclaredButNotInstalled.length) {
    out.push(`  declared in .rsc.json but not installed on this machine: ${report.targetsDeclaredButNotInstalled.join(', ')}`);
  }
  // Without this line the report reads as self-contradictory, and the contradiction is only
  // apparent: a delivery is "conformant" when it still TRACKS its base, which is the question
  // delivery conformance asks. A symlink to an ungoverned base is a correct symlink to the wrong
  // content, so both numbers are right and only saying so makes them readable together.
  if (report.ungoverned.length && Object.values(report.targets).some((t) => t.delivered > 0)) {
    out.push('');
    out.push('A delivery counts as conformant when it still tracks its base, so the deliveries above');
    out.push(`are correct links to ${report.ungoverned.length} base(s) that carry no contract. The assistant`);
    out.push('is reading ungoverned content through a healthy link.');
  }
  if (!report.conformant) {
    out.push('');
    out.push('What puts it back: run an install or a sync in this project. The transformation is');
    out.push('idempotent, so re-running it over an already-governed base changes nothing.');
  }
  return out;
}
