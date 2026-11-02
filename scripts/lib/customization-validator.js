// The deterministic half of acceptance criteria 8 and 10: is a project's per-skill customization
// WELL FORMED? No model involved, and nothing here decides whether a customization is right — only
// whether it says what the schema requires it to say.
//
// `docs/fork/stage1/CUSTOMIZATION-SCHEMA.md` §3 is the specification; the rule ids below are that
// section's numbering, kept verbatim so a finding can be traced to the rule that produced it.
//
// Two properties the contract (§2, §6) makes non-negotiable, and that shape this whole file:
//
//   ABSENT AND BROKEN ARE DIFFERENT STATES. A file that exists but does not parse is NEVER reported
//   as missing. Every finding carries the file path and the rule, because an error that does not
//   name the file is the same as silence to whoever has to fix it.
//
//   IT REPORTS, IT DOES NOT DECIDE. Findings are returned, never thrown. An install that died
//   because a wiki page had a broken frontmatter would be a worse harness than one that installs
//   and names the page — and the contract's answer to a broken file is to ASK, which is a
//   conversation, not an exit code.
//
// Declared limit, so it is not oversold: rule 8 detects a STATED attempt to disable a guard. A
// decision that disables one without saying so is not detectable by any keyword rule, and the
// model-dependent half lives in EVALUATION.md's G4. The direction of the error is deliberate: a
// sentence that merely sounds like it disables a guard gets named and asked about, because
// precedence level 1 is not negotiable from this file.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Where customizations live, relative to the project root. Fixed, not configurable (C1). */
export const CUSTOMIZATION_ROOT = join('02-DOCS', 'wiki', 'skills');

export const REQUIRED_KEYS = [
  'skill', 'governance', 'status', 'updated', 'scope', 'evidence',
  'type', 'catalog-version', 'reevaluate-when',
];
export const ALLOWED_STATUS = ['approved', 'draft', 'superseded'];
export const REQUIRED_TYPE = 'skill-customization';
export const CATEGORIES = [
  'approved convention', 'observed pattern', 'debt', 'exception', 'migration', 'insufficient evidence',
];

const DISABLING_VERB = /\b(disabl\w*|deactivat\w*|turn(?:s|ed)?\s+off|switch(?:es|ed)?\s+off|bypass\w*|circumvent\w*|suppress\w*|opt(?:s|ed)?[-\s]out(?:\s+of)?|waive\w*|override(?:s|d)?|skip(?:s|ped|ping)?|exempt\w*)\b/i;
const GUARDED_NOUN = /\b(guard|guards|guardrail\w*|safety\s+\w+|safeguard\w*|permission|permissions|hook|hooks|pre-?tool-?use|sandbox|danger-guard|ship-guard|branch-guard|gitmoji-guard|copy-guard)\b/i;

/** A bare date is exactly what rule 4c rejects: the schema asks for a condition. */
const BARE_DATE = /^(?:\d{4}-\d{2}-\d{2}|\d{4}\/\d{2}\/\d{2}|\d{2}[-/]\d{2}[-/]\d{4}|\d{4}-\d{2}|\d{4})$/;

function finding(file, rule, ruleId, message, severity = 'error') {
  return { file, rule, ruleId, message, severity };
}

/**
 * Parse a customization frontmatter the way the repository's own reader does — a line parser, not
 * YAML — and report the lines it could not read instead of skipping them.
 *
 * `parseFrontmatter` in `scripts/lib/frontmatter.js` silently ignores an unparseable line, which is
 * right for its job (reading a catalog it trusts) and wrong for this one: a line nobody could read
 * is the broken-frontmatter case, and it has to surface as such rather than as a missing key.
 */
export function parseCustomizationFrontmatter(src) {
  const m = String(src).match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { ok: false, keys: {}, badLines: [], noBlock: true };
  const lines = m[1].split('\n');
  const keys = {};
  const badLines = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    const item = line.match(/^\s+-\s*(.*)$/);
    if (item) {
      // A list item only makes sense under a key that opened a list.
      const owner = Object.keys(keys).at(-1);
      if (owner && (keys[owner] === '' || Array.isArray(keys[owner]))) {
        keys[owner] = [...(Array.isArray(keys[owner]) ? keys[owner] : []), unquote(item[1].trim())];
      } else {
        badLines.push({ line: i + 2, text: line });
      }
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) { badLines.push({ line: i + 2, text: line }); continue; }
    keys[kv[1]] = kv[2].trim() === '' ? '' : unquote(kv[2].trim());
  }
  return { ok: badLines.length === 0, keys, badLines, noBlock: false };
}

function unquote(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}

/** Split the body into `## ` sections, keyed by heading text. */
function sectionsOf(body) {
  const out = new Map();
  const re = /^##\s+(.+?)\s*$/gm;
  const hits = [...body.matchAll(re)];
  for (let i = 0; i < hits.length; i += 1) {
    const start = hits[i].index + hits[i][0].length;
    const end = i + 1 < hits.length ? hits[i + 1].index : body.length;
    out.set(hits[i][1].trim().toLowerCase(), body.slice(start, end));
  }
  return out;
}

/** Top-level `- ` list entries of a section, each with its indented continuation lines. */
function entriesOf(section) {
  if (!section) return [];
  const out = [];
  for (const line of section.split('\n')) {
    if (/^[-*]\s+\S/.test(line)) out.push(line);
    else if (out.length && /^\s+\S/.test(line)) out[out.length - 1] += `\n${line}`;
    else if (line.trim() === '') continue;
  }
  return out;
}

function firstLine(entry) {
  return entry.split('\n')[0].replace(/^[-*]\s+/, '').replace(/\*\*/g, '').trim();
}

/**
 * Validate one customization file.
 *
 * @param {object} o
 * @param {string} o.file         absolute path, for reporting
 * @param {string} o.src          file contents
 * @param {string} o.dirName      the containing directory name (rule 2)
 * @param {string[]} [o.catalog]  skill ids in the distributed catalog (rule 2)
 * @returns {{file: string, findings: object[], orphaned: boolean, skill: string|null}}
 */
export function validateCustomizationSource({ file, src, dirName, catalog = null }) {
  const findings = [];
  const fm = parseCustomizationFrontmatter(src);

  // Rule 1 — the frontmatter parses, and all nine required keys are present.
  if (fm.noBlock) {
    findings.push(finding(file, 'rule 1 — frontmatter parses', 'R1',
      'no frontmatter block: the file must open with a `---` fenced frontmatter'));
  } else if (!fm.ok) {
    for (const bad of fm.badLines) {
      findings.push(finding(file, 'rule 1 — frontmatter parses', 'R1',
        `line ${bad.line} is not a \`key: value\` pair or a list item: ${JSON.stringify(bad.text)}`));
    }
  }
  const missing = REQUIRED_KEYS.filter((k) => fm.keys[k] === undefined || fm.keys[k] === '');
  if (missing.length) {
    findings.push(finding(file, 'rule 1 — all nine required keys present', 'R1',
      `missing or empty required key(s): ${missing.join(', ')}`));
  }

  // Rule 2 — `skill` equals the containing directory name, and names a skill in the catalog.
  const skill = typeof fm.keys.skill === 'string' && fm.keys.skill ? fm.keys.skill : null;
  if (skill && dirName && skill !== dirName) {
    findings.push(finding(file, 'rule 2 — `skill` equals the containing directory name', 'R2',
      `frontmatter says \`skill: ${skill}\` but the directory is \`${dirName}\``));
  }
  // Orphaned is REPORTED, never an error and never silently rehomed to a similar name (§4).
  const orphaned = Boolean(skill && catalog && !catalog.includes(skill));
  if (orphaned) {
    findings.push(finding(file, 'rule 2 / §4 — orphaned customization', 'R2-orphan',
      `\`${skill}\` is not in the distributed catalog: the customization survives on disk and is `
      + 'reported as orphaned. A rename is a migration requiring a decision, never an automatic rehome',
      'orphaned'));
  }

  // Rule 3 — status is one of the three allowed values.
  if (fm.keys.status && !ALLOWED_STATUS.includes(fm.keys.status)) {
    findings.push(finding(file, 'rule 3 — `status` is approved · draft · superseded', 'R3',
      `\`status: ${fm.keys.status}\` is not one of ${ALLOWED_STATUS.join(', ')}`));
  }

  // Rule 4 — scope is present and non-empty. No default: an omitted scope is an error, because an
  // implicit "everywhere" is how one package's decision spreads across a monorepo.
  const scope = fm.keys.scope;
  const scopeEmpty = scope === undefined || scope === '' || (Array.isArray(scope) && scope.length === 0);
  if (scopeEmpty && !missing.includes('scope')) {
    findings.push(finding(file, 'rule 4 — `scope` is present and non-empty', 'R4',
      'scope is declared but empty; state `repo` or list the paths, packages or subprojects'));
  }

  // Rule 4b — `type` keeps the file conformant to the OKF bundle it lives inside.
  if (fm.keys.type !== undefined && fm.keys.type !== '' && fm.keys.type !== REQUIRED_TYPE) {
    findings.push(finding(file, `rule 4b — \`type\` equals \`${REQUIRED_TYPE}\``, 'R4b',
      `\`type: ${fm.keys.type}\` must be \`${REQUIRED_TYPE}\``));
  }

  // Rule 4c — `reevaluate-when` states a condition, not a date. `updated` already gives the date;
  // the trigger "the skill changed" needs a condition to compare against.
  const when = fm.keys['reevaluate-when'];
  if (typeof when === 'string' && when !== '' && BARE_DATE.test(when.trim())) {
    findings.push(finding(file, 'rule 4c — `reevaluate-when` states a condition, not a date', 'R4c',
      `\`reevaluate-when: ${when}\` is a date; state the condition that should bring this file back for review`));
  }

  // Rule 5 — both required sections exist.
  const body = String(src).replace(/^---\n[\s\S]*?\n---\n?/, '');
  const sections = sectionsOf(body);
  for (const required of ['decisions', 'out of scope']) {
    if (!sections.has(required)) {
      findings.push(finding(file, 'rule 5 — `## Decisions` and `## Out of scope` both exist', 'R5',
        `the \`## ${required === 'decisions' ? 'Decisions' : 'Out of scope'}\` section is missing`));
    }
  }

  const decisions = entriesOf(sections.get('decisions'));
  const migrationSection = entriesOf(sections.get('migrations'));

  for (const entry of decisions) {
    const label = firstLine(entry) || '(unnamed decision)';
    const categoryLine = /^\s*category\s*:\s*(.+)$/im.exec(entry);
    // The category is the FIRST TOKEN of the line (`Category: <one> · Scope: …`), matched exactly.
    // The previous version was `CATEGORIES.find((c) => line.includes(c))` over a list whose first
    // element is `approved convention`, so a line reading «observed pattern, not an approved
    // convention» resolved to `approved convention` — the silent promotion CUSTOMIZATION-SCHEMA.md
    // §2 says this schema exists to prevent, since it would turn every accident in the codebase into
    // law. Ambiguity is the finding, not something to settle by declaration order. Found by the
    // independent review of stage 2.
    const named = categoryLine ? categoryLine[1].split('·')[0].trim().toLowerCase() : null;
    const category = CATEGORIES.includes(named) ? named : null;

    // Rule 6 — every decision names one of the six categories and carries an evidence reference.
    if (!category) {
      findings.push(finding(file, 'rule 6 — every decision names one of the six categories', 'R6',
        named
          ? `decision "${label}" names "${named}", which is not one of the six categories exactly; `
            + `an approximate or hedged category is as unusable as none. One of: ${CATEGORIES.join(' · ')}`
          : `decision "${label}" names no category; one of: ${CATEGORIES.join(' · ')}`));
    }
    if (!/^\s*evidence\s*:\s*\S/im.test(entry)) {
      findings.push(finding(file, 'rule 6 — every decision carries an evidence reference', 'R6',
        `decision "${label}" carries no \`Evidence:\` reference`));
    }

    // Rule 7 — a migration states current, target, and that it requires a decision.
    if (category === 'migration') findings.push(...migrationFindings(file, entry, label));

    // Rule 8 — precedence level 1 is not negotiable from this file, and an attempt is the finding.
    if (DISABLING_VERB.test(entry) && GUARDED_NOUN.test(entry)) {
      findings.push(finding(file, 'rule 8 — no decision may disable a permission, a guard or a safety rule', 'R8',
        `decision "${label}" reads as an attempt to disable or bypass a permission, guard or safety rule; `
        + 'precedence level 1 of the contract cannot be narrowed from a customization, and the attempt is itself the finding'));
    }
  }

  for (const entry of migrationSection) {
    findings.push(...migrationFindings(file, entry, firstLine(entry) || '(unnamed migration)'));
    if (DISABLING_VERB.test(entry) && GUARDED_NOUN.test(entry)) {
      findings.push(finding(file, 'rule 8 — no decision may disable a permission, a guard or a safety rule', 'R8',
        `migration "${firstLine(entry)}" reads as an attempt to disable or bypass a permission, guard or safety rule`));
    }
  }

  return { file, findings, orphaned, skill };
}

function migrationFindings(file, entry, label) {
  const out = [];
  if (!/^\s*current\s*:/im.test(entry) || !/\btarget\s*:/i.test(entry)) {
    out.push(finding(file, 'rule 7 — a migration states a current state and a target state', 'R7',
      `migration "${label}" does not state both \`Current:\` and \`Target:\``));
  }
  if (!/requires\s+a\s+decision/i.test(entry)) {
    out.push(finding(file, 'rule 7 — a migration states that it requires a decision', 'R7',
      `migration "${label}" does not state that it **requires a decision**; detecting a migration never executes it`));
  }
  return out;
}

/** The ids the distributed catalog ships, read from the package's own `skills/`. */
export function catalogIds(catalogRoot = PKG_ROOT) {
  try {
    return readdirSync(join(catalogRoot, 'skills'), { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(catalogRoot, 'skills', e.name, 'SKILL.md')))
      .map((e) => e.name)
      .sort();
  } catch { return []; }
}

/**
 * Validate every customization in a project. Returns `{ ran: false }` when the project has no
 * `02-DOCS/wiki/skills/` — absence is valid and is not a finding (contract §2).
 *
 * This is the function `install` and `sync` call.
 */
export function validateCustomizations({ cwd = process.cwd(), catalogRoot = PKG_ROOT, catalog = null } = {}) {
  const root = join(cwd, CUSTOMIZATION_ROOT);
  if (!existsSync(root)) return { ran: false, root: CUSTOMIZATION_ROOT, files: [], findings: [], orphaned: [] };
  const ids = catalog || catalogIds(catalogRoot);
  let dirs = [];
  try {
    dirs = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() || e.isSymbolicLink());
  } catch (err) {
    return {
      ran: true,
      root: CUSTOMIZATION_ROOT,
      files: [],
      orphaned: [],
      findings: [finding(root, 'rule 1 — the customization root is readable', 'R0',
        `cannot read \`${CUSTOMIZATION_ROOT}\`: ${err.code || err.message}. An unreadable directory is `
        + 'not an absent one, and must not be treated as "no customizations exist"')],
    };
  }
  const findings = [];
  const files = [];
  const orphaned = [];
  for (const dir of dirs.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = join(root, dir.name, 'README.md');
    if (!existsSync(file)) {
      // A directory under the customization root with no README is not "absent": somebody made the
      // directory. Named, so it can be finished or removed.
      findings.push(finding(file, 'rule 1 — one README.md per customized skill', 'R1',
        `\`${relative(cwd, join(root, dir.name))}\` exists but carries no README.md`));
      continue;
    }
    let src;
    try { src = readFileSync(file, 'utf8'); } catch (err) {
      findings.push(finding(file, 'rule 1 — the file is readable', 'R1',
        `cannot read the file: ${err.code || err.message}. Unreadable is not absent`));
      continue;
    }
    const result = validateCustomizationSource({ file, src, dirName: dir.name, catalog: ids });
    files.push(file);
    if (result.orphaned) orphaned.push(result.skill);
    findings.push(...result.findings);
  }
  return { ran: true, root: CUSTOMIZATION_ROOT, files, findings, orphaned };
}

/** Errors only — the orphan report is a statement about the catalog, not a defect in the file. */
export function errorsOf(report) {
  return (report.findings || []).filter((f) => f.severity === 'error');
}

/** One line per finding, each naming the file and the rule. The format a human reads. */
export function formatFindings(report, cwd = process.cwd()) {
  return (report.findings || []).map((f) => {
    const where = f.file.startsWith(cwd) ? relative(cwd, f.file) : f.file;
    return `${f.severity === 'orphaned' ? 'ORPHANED' : 'ERROR'} ${where}: ${f.rule} — ${f.message}`;
  });
}
