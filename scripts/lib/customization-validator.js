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
import { buildTextCorpus, descriptionCollisions } from './text-rank.js';

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Where customizations live, relative to the project root. Fixed, not configurable (C1). */
export const CUSTOMIZATION_ROOT = join('02-DOCS', 'wiki', 'skills');

/**
 * The SECOND root, added by stage 6 on the coordinator's decision 2 (ledger §2m).
 *
 * `BROWNFIELD.md` §6 item 2 names the defect exactly: the run report and the conflict records that
 * `02-DOCS/wiki/brownfield/<slug>.md` holds were read by nothing, so the 16 rules of
 * `CONFLICT-RECORD.md` §7 and 22 of the deterministic properties of `DESIGN.md` §5 were
 * **decidable and uninstrumented** — the same defect stage 1's review found in the customization
 * validator, one document later.
 */
export const BROWNFIELD_ROOT = join('02-DOCS', 'wiki', 'brownfield');

export const REQUIRED_KEYS = [
  'skill', 'governance', 'status', 'updated', 'scope', 'evidence',
  'type', 'catalog-version', 'reevaluate-when',
];
export const ALLOWED_STATUS = ['approved', 'draft', 'superseded'];
export const REQUIRED_TYPE = 'skill-customization';
export const CATEGORIES = [
  'approved convention', 'observed pattern', 'debt', 'exception', 'migration', 'insufficient evidence',
];

/**
 * A brownfield run report is an OKF document inside the `wiki/` bundle, so rule 1 of the bundle
 * requires a non-empty `type:` on it (`skills/harness/references/wiki-protocol.md`). The VALUE is
 * fixed here the same way `skill-customization` was fixed in stage 1: a key whose value is free is
 * a key no validator can check.
 */
export const BROWNFIELD_TYPE = 'brownfield-run';

/** `CONFLICT-RECORD.md` §3 — the six states, and nothing else. */
export const CONFLICT_STATUS = [
  'open', 'resolved-by-decision', 'pending-decision', 'recorded', 'not-a-conflict', 'deferred',
];
export const CONFIDENCE = ['high', 'medium', 'low'];
/** The one position marker that is not a category: `CONFLICT-RECORD.md` §7 rule 3. */
const SKILL_SIDE = /\bn\/a\s*(?:—|--|-)\s*skill side\b/i;

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

/**
 * One line per finding, each naming the file and the rule. The format a human reads.
 *
 * The severity label is derived from the severity, not from a two-way guess: `not-run` exists so a
 * rule that could not be CHECKED never prints as a rule that found nothing.
 */
const SEVERITY_LABEL = { error: 'ERROR', orphaned: 'ORPHANED', 'not-run': 'NOT-RUN' };
export function formatFindings(report, cwd = process.cwd()) {
  return (report.findings || []).map((f) => {
    const where = f.file.startsWith(cwd) ? relative(cwd, f.file) : f.file;
    return `${SEVERITY_LABEL[f.severity] || String(f.severity).toUpperCase()} ${where}: ${f.rule} — ${f.message}`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// The SECOND root: `02-DOCS/wiki/brownfield/<slug>.md`, the brownfield run report and the conflict
// records inside it. Stage 6 deliverable, coordinator decision 2 (ledger §2m).
//
// The rule ids below are `CONFLICT-RECORD.md` §7's own numbering, kept verbatim so a finding can be
// traced to the rule that produced it — the same convention this file already follows for
// `CUSTOMIZATION-SCHEMA.md` §3.
//
// WHAT IS INSTRUMENTED HERE AND WHAT IS NOT. §7's own boundary paragraph says rules 1–15 check that
// a record is well formed and rule 16 is the only one that checks recall. This validator implements
// 1–13, 15 and 16. Rule 14 — "a position marked FIXTURE is never counted as project evidence by any
// downstream step" — is a property of a DOWNSTREAM step, not of this file, so there is nothing here
// to check; it is reported as a declared limit rather than silently counted as covered. Decidable
// is not instrumented, and the reverse claim is the one this fork keeps catching itself making.

/** `### C<n> — <title>` opens a conflict record; everything up to the next one belongs to it. */
function conflictRecordsOf(body) {
  const hits = [...body.matchAll(/^###\s+(C\d+[A-Za-z]*)\s*(?:—|--|-)\s*(.+?)\s*$/gm)];
  return hits.map((hit, i) => ({
    id: hit[1],
    title: hit[2].trim(),
    raw: body.slice(hit.index, i + 1 < hits.length ? hits[i + 1].index : body.length),
  }));
}

/** A `- Field: value` line plus its indented continuation — the flat shape rule 1 counts. */
function recordField(raw, name) {
  // `$` would mean END OF LINE under the `m` flag that `^` needs, which truncated every field at
  // its first line break — `Impact` and `Confidence` are routinely two lines. `(?![\s\S])` is
  // end-of-input regardless of flags. Found by gg05, which is why that test asserts an empty finding
  // list rather than "no finding of kind X": a parser bug shows up as a FALSE finding.
  const re = new RegExp(`^[-*]\\s+${name}\\s*:\\s*([\\s\\S]*?)(?=\\n[-*#]|\\n\\|\\s*#|\\n\\n|(?![\\s\\S]))`, 'im');
  const hit = re.exec(raw);
  return hit ? hit[1].replace(/\n\s+/g, ' ').trim() : null;
}

/** Table rows of the positions block: `| P1 | side | position | category | evidence |`. */
function positionsOf(raw) {
  const out = [];
  for (const line of raw.split('\n')) {
    if (!/^\s*\|/.test(line)) continue;
    const cells = line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
    if (cells.length < 5) continue;
    if (/^-{2,}$|^:?-+:?$/.test(cells[0])) continue;     // separator row
    if (!/^P\d+$/i.test(cells[0])) continue;             // header row, or not a position
    out.push({ ref: cells[0], side: cells[1], claim: cells[2], category: cells[3], evidence: cells[4], line });
  }
  return out;
}

/** `- Alternatives:` followed by an indented numbered list. Returns the item texts. */
function alternativesOf(raw) {
  const hit = /^[-*]\s+Alternatives\s*:\s*\n([\s\S]*?)(?=\n[-*]\s+\S|\n###|(?![\s\S]))/im.exec(raw);
  if (!hit) {
    // The single-line form, `- Alternatives: a; b` — accepted, split on `;`.
    const inline = recordField(raw, 'Alternatives');
    return inline ? inline.split(/;|·/).map((s) => s.trim()).filter(Boolean) : [];
  }
  const items = [];
  for (const line of hit[1].split('\n')) {
    if (/^\s+\d+[.)]\s+\S/.test(line)) items.push(line.replace(/^\s+\d+[.)]\s+/, '').trim());
    else if (items.length && /^\s+\S/.test(line)) items[items.length - 1] += ` ${line.trim()}`;
  }
  return items;
}

/** `- Blocks (…):` followed by an indented list — rule 15's enumeration. */
function blockedActionsOf(raw) {
  const hit = /^[-*]\s+Blocks\b[^\n:]*:\s*\n([\s\S]*?)(?=\n[-*]\s+\S|\n###|(?![\s\S]))/im.exec(raw);
  if (!hit) return [];
  return hit[1].split('\n')
    .filter((l) => /^\s+[-*]\s+\S/.test(l))
    .map((l) => l.replace(/^\s+[-*]\s+/, '').trim())
    .filter((l) => !/^not blocked/i.test(l));
}

/** Headings of a markdown file, for the F2 anchor check. */
function headingsOf(text) {
  return [...String(text).matchAll(/^#{1,6}\s+(.+?)\s*$/gm)].map((m) => m[1].trim());
}

const F1_RE = /`([^`\n#]+?)(?::(\d+)(?:-\d+)?)?#"((?:[^"\\]|\\.)*)"`/g;
const F2_BACKTICK_RE = /`([^`\n#]+\.(?:md|txt|js|mjs|json|ya?ml))`\s*§\s*"?([^",\n`]+)"?/g;
const F2_HASH_RE = /`([^`\n#]+\.(?:md|txt))#([^"\n`][^\n`]*)`/g;
const BARE_LINE_RE = /`([^`\n#"]+?):(\d+)(?:-\d+)?`(?!\s*#)/g;
const F4_RE = /user-decision,\s*(\d{4}-\d{2}-\d{2})/;

/**
 * Rule 4 over one position's evidence cell: every reference must be in one of the four admissible
 * forms of `CONFLICT-RECORD.md` §2.1, and F1's quoted fragment must still be IN the file.
 *
 * The ordering §2.1 insists on is implemented literally: the fragment is the evidence, the line is
 * a subordinate hint, and when they disagree this reports the line the fragment is actually on.
 * "The line exists" was the old rule, and it passed the citation its own author got wrong.
 */
export function evidenceFindings({ file, record, position, cwd, readFile = readFileSync }) {
  const out = [];
  const cell = position.evidence || '';
  const label = `${record.id} ${position.ref}`;
  const declared = [...cell.matchAll(/\bF([1-4])\b/g)].map((m) => Number(m[1]));
  if (!declared.length) {
    out.push(finding(file, 'rule 4 — every position carries ≥1 evidence reference in one of the four forms', 'B4',
      `${label} names no evidence form; write F1, F2, F3 or F4 (CONFLICT-RECORD.md §2.1)`));
    return out;
  }

  const resolve = (p) => join(cwd, ...p.split('/').filter((seg) => seg && seg !== '.'));
  const exists = (p) => { try { return existsSync(resolve(p)); } catch { return false; } };
  const read = (p) => { try { return readFile(resolve(p), 'utf8'); } catch { return null; } };

  // Rule 4d — a reference INTO A SKILL anchors at `.rsc/skills/<id>/`, never `skills/<id>/`.
  for (const m of cell.matchAll(/`((?:\.\/)?skills\/[^`\n]+)`/g)) {
    out.push(finding(file, 'rule 4d — a skill reference resolves under `.rsc/skills/`', 'B4d',
      `${label} cites \`${m[1]}\`; in a consumer project \`skills/\` does not exist and the governance `
      + 'transformation shifts the body by 13 lines, so a line taken from the catalog names the wrong '
      + 'line in the installed copy. Anchor at `.rsc/skills/<id>/`'));
  }

  // Rule 4c — a bare `path:line` is not an admissible form. It is accepted ONLY inside F1, where it
  // is a hint; the regex below deliberately excludes the `#"…"` case.
  for (const m of cell.matchAll(BARE_LINE_RE)) {
    out.push(finding(file, 'rule 4c — no reference is a bare `path:line`', 'B4c',
      `${label} cites \`${m[1]}:${m[2]}\` with no quoted fragment; a line number alone passes even when `
      + 'the citation has drifted. Use F1: `path#"verbatim fragment"`'));
  }

  if (declared.includes(1)) {
    const hits = [...cell.matchAll(F1_RE)];
    if (!hits.length) {
      out.push(finding(file, 'rule 4a — F1 is `path#"verbatim fragment"`', 'B4a',
        `${label} declares F1 but carries no \`path#"fragment"\` reference`));
    }
    for (const [, path, lineHint, rawFragment] of hits) {
      if (!exists(path)) {
        out.push(finding(file, 'rule 4a — the F1 path resolves', 'B4a', `${label}: \`${path}\` does not resolve from the project root`));
        continue;
      }
      const text = read(path);
      if (text === null) {
        out.push(finding(file, 'rule 4a — the F1 path is readable', 'B4a', `${label}: \`${path}\` cannot be read`));
        continue;
      }
      const fragment = rawFragment.replace(/\\(.)/g, '$1');
      const lines = text.split('\n');
      const at = lines.findIndex((l) => l.includes(fragment));
      if (at < 0) {
        out.push(finding(file, 'rule 4a — the F1 fragment occurs verbatim in the file', 'B4a',
          `${label}: ${JSON.stringify(fragment.slice(0, 80))} is not in \`${path}\`. The fragment is the `
          + 'evidence: if the file was rewritten, the citation is stale and must be re-read, not re-numbered'));
        continue;
      }
      if (lineHint && !(lines[Number(lineHint) - 1] || '').includes(fragment)) {
        out.push(finding(file, 'rule 4a — a line hint must agree with the fragment', 'B4a',
          `${label}: the fragment is at \`${path}:${at + 1}\`, not at the cited \`:${lineHint}\`. `
          + 'The fragment wins; the line is a hint, and it is stale'));
      }
    }
  }

  if (declared.includes(2)) {
    const hits = [...cell.matchAll(F2_BACKTICK_RE), ...cell.matchAll(F2_HASH_RE)];
    if (!hits.length) {
      out.push(finding(file, 'rule 4b — F2 is `path` §section, or `path#heading`', 'B4b',
        `${label} declares F2 but carries no \`path\` + section anchor`));
    }
    for (const [, path, anchor] of hits) {
      if (!exists(path)) {
        out.push(finding(file, 'rule 4b — the F2 path resolves', 'B4b', `${label}: \`${path}\` does not resolve from the project root`));
        continue;
      }
      const text = read(path);
      if (text === null) {
        out.push(finding(file, 'rule 4b — the F2 path is readable', 'B4b', `${label}: \`${path}\` cannot be read`));
        continue;
      }
      const wanted = String(anchor).trim().toLowerCase();
      // A numeric `§3` anchors a section of a document that numbers its own sections; accept it when
      // any heading carries that number, and otherwise require a heading that contains the text.
      const numeric = /^\d+(\.\d+)?$/.test(wanted);
      const headings = headingsOf(text).map((h) => h.toLowerCase());
      const matched = numeric
        ? headings.some((h) => h.startsWith(`${wanted}.`) || h.startsWith(`${wanted} `) || h === wanted)
        : headings.some((h) => h.includes(wanted) || wanted.includes(h));
      if (!matched) {
        out.push(finding(file, 'rule 4b — the F2 anchor names a heading that exists', 'B4b',
          `${label}: \`${path}\` has no heading matching §${anchor}`));
      }
    }
  }

  if (declared.includes(3)) {
    // F3 — counted population: the three parts must be present, and never a line.
    const hasPopulation = /\bpopulation\b/i.test(cell) || /`[^`\n]*[*/][^`\n]*`/.test(cell);
    const hasCount = /\b\d+\s+(?:of\s+\d+\s+)?\w+/.test(cell);
    const hasMethod = /\b(counted|method|measured|sampled|enumerat\w+|grep|exhaustive)\b/i.test(cell);
    const missing = [!hasPopulation && 'population', !hasCount && 'count', !hasMethod && 'selection method'].filter(Boolean);
    if (missing.length) {
      out.push(finding(file, 'rule 4b — F3 states population, count and method', 'B4b',
        `${label} declares F3 but states no ${missing.join(', ')}. "31 of 34 providers", never "mostly Riverpod"`));
    }
  }

  if (declared.includes(4)) {
    if (!F4_RE.test(cell)) {
      out.push(finding(file, 'rule 4b — F4 is `user-decision, <ISO date>`', 'B4b',
        `${label} declares F4 but does not carry \`user-decision, <YYYY-MM-DD>\``));
    } else if (!/"[^"]{3,}"|«[^»]{3,}»|“[^”]{3,}”/.test(record.raw)) {
      // §2.2 bound 1: F4 carries the user's OWN WORDS, quoted verbatim. A paraphrase is not F4.
      out.push(finding(file, 'rule 4b — F4 carries the user\'s verbatim words', 'B4b',
        `${label} declares F4 but the record quotes nothing the user said; a paraphrase is not F4 (§2.2)`));
    }
    // §2.2 bound 3, reached from the other side as rule 13 does: a conversation is not code.
    const cat = (position.category || '').replace(/\*/g, '').trim().toLowerCase();
    for (const forbidden of ['observed pattern', 'debt', 'migration']) {
      if (cat.includes(forbidden)) {
        out.push(finding(file, 'rule 4b / §2.2 — F4 cannot support a category that asserts code', 'B4b',
          `${label} is \`${forbidden}\` on F4 evidence alone; those three assert something about code, `
          + 'and a conversation is not code'));
      }
    }
  }
  return out;
}

/**
 * One conflict record against `CONFLICT-RECORD.md` §7 rules 1–13 and 15.
 *
 * @param {object} o
 * @param {string} o.file     absolute path of the run report, for reporting
 * @param {object} o.record   `{id, title, raw}` from `conflictRecordsOf`
 * @param {string} o.cwd      project root, for resolving evidence paths
 * @param {boolean|null} o.greenfield  true when the project has no source files and no manifests
 */
export function validateConflictRecord({ file, record, cwd, greenfield = null }) {
  const findings = [];
  const raw = record.raw;
  const where = `${record.id}`;

  // Rule 1 — all seven fields present and non-empty. `Evidence` is the positions block.
  const positions = positionsOf(raw);
  const fields = {
    Scope: recordField(raw, 'Scope'),
    Impact: recordField(raw, 'Impact'),
    Confidence: recordField(raw, 'Confidence'),
    Recommendation: recordField(raw, 'Recommendation'),
    Status: recordField(raw, 'Status'),
  };
  const alternatives = alternativesOf(raw);
  for (const [name, value] of Object.entries(fields)) {
    if (!value) {
      findings.push(finding(file, 'rule 1 — all seven fields present and non-empty', 'B1',
        `${where} has no \`${name}\` field`));
    }
  }
  if (!alternatives.length) {
    findings.push(finding(file, 'rule 1 — all seven fields present and non-empty', 'B1',
      `${where} has no \`Alternatives\` field`));
  }
  if (!positions.length) {
    findings.push(finding(file, 'rule 1 — all seven fields present and non-empty', 'B1',
      `${where} has no positions block; \`Evidence\` IS the positions block (§1), not a second account`));
  }

  // Rule 2 — ≥2 positions. One position is not a conflict; it is an observation.
  if (positions.length === 1) {
    findings.push(finding(file, 'rule 2 — `Evidence` contains ≥2 positions', 'B2',
      `${where} carries 1 position; a conflict has at least two sides`));
  }

  // Rule 3 — exactly one of the six categories per position, or the explicit `n/a — skill side`.
  for (const p of positions) {
    const cat = (p.category || '').replace(/\*/g, '').trim();
    if (SKILL_SIDE.test(cat)) continue;
    const named = CATEGORIES.filter((c) => cat.toLowerCase().includes(c));
    if (named.length === 1) continue;
    findings.push(finding(file, 'rule 3 — one category from the six per position', 'B3',
      named.length > 1
        ? `${where} ${p.ref} names ${named.length} categories (${named.join(' + ')}); a position holds exactly one. `
          + 'Split it, the way CONFLICT-RECORD.md §5 splits 31 files from 3'
        : `${where} ${p.ref} names no category exactly; one of: ${CATEGORIES.join(' · ')}, or \`n/a — skill side\``));
  }

  // Rule 4 — evidence forms, delegated so the four forms live in one place.
  for (const p of positions) findings.push(...evidenceFindings({ file, record, position: p, cwd }));

  // Rule 5 — `Scope` non-empty. Same rule as the schema's: no implicit "everywhere".
  if (fields.Scope !== null && !fields.Scope) {
    findings.push(finding(file, 'rule 5 — `Scope` non-empty', 'B5',
      `${where} declares an empty \`Scope\`; state \`repo\` or list the paths, packages or subprojects`));
  }

  // Rule 6 — `Confidence` ∈ three, AND it carries a falsifier. A confidence without one is a mood.
  if (fields.Confidence) {
    const value = fields.Confidence.toLowerCase().split(/[\s—–-]/).filter(Boolean)[0];
    if (!CONFIDENCE.includes(value)) {
      findings.push(finding(file, 'rule 6 — `Confidence` ∈ high · medium · low', 'B6',
        `${where} says \`Confidence: ${fields.Confidence.slice(0, 40)}\`; one of ${CONFIDENCE.join(', ')}`));
    }
    const falsifier = /(?:—|--|–)\s*\S/.test(fields.Confidence)
      && /\b(would|unless|if|until|once)\b/i.test(fields.Confidence);
    if (!falsifier) {
      findings.push(finding(file, 'rule 6 — `Confidence` carries a falsifier clause', 'B6',
        `${where} states a confidence with no falsifier; say the one thing that would change it, `
        + 'or it is the same guess with a label on it'));
    }
  }

  // Rule 7 — ≥2 genuine alternatives. A single foregone option is theatre.
  if (alternatives.length === 1) {
    findings.push(finding(file, 'rule 7 — `Alternatives` lists ≥2', 'B7',
      `${where} lists 1 alternative; a single foregone option is theatre`));
  }

  // Rule 8 — `Recommendation` names one of the listed alternatives, verbatim or by its number.
  if (fields.Recommendation && alternatives.length) {
    const byNumber = [...fields.Recommendation.matchAll(/\((\d+)\)/g)].map((m) => Number(m[1]));
    const picked = byNumber.filter((n) => n >= 1 && n <= alternatives.length);
    const verbatim = alternatives.some((alt) => {
      const head = alt.replace(/[`*]/g, '').split(/[.,;—]/)[0].trim().toLowerCase();
      return head.length > 8 && fields.Recommendation.replace(/[`*]/g, '').toLowerCase().includes(head);
    });
    if (!picked.length && !verbatim) {
      findings.push(finding(file, 'rule 8 — `Recommendation` names one of the listed alternatives', 'B8',
        `${where} recommends something that is not one of its ${alternatives.length} alternatives; `
        + 'name it by its number, as `(1)`, or quote it'));
    }
    if (byNumber.length && !picked.length) {
      findings.push(finding(file, 'rule 8 — `Recommendation` names one of the listed alternatives', 'B8',
        `${where} recommends (${byNumber.join(', ')}) but only ${alternatives.length} alternatives are listed`));
    }
  }

  // Rule 9 — `Status` ∈ the six states of §3.
  const status = fields.Status ? fields.Status.split(/[\s—–]/)[0].trim() : null;
  if (status && !CONFLICT_STATUS.includes(status)) {
    findings.push(finding(file, 'rule 9 — `Status` ∈ the six states of §3', 'B9',
      `${where} says \`Status: ${status}\`; one of ${CONFLICT_STATUS.join(', ')}`));
  }

  // Rule 10 — a `resolved-by-decision` cites the deciding file AND section: form F2, never a line.
  if (status === 'resolved-by-decision') {
    const resolvedBy = recordField(raw, 'Resolved by');
    if (!resolvedBy) {
      findings.push(finding(file, 'rule 10 — a `resolved-by-decision` cites the deciding file and section', 'B10',
        `${where} is resolved-by-decision but carries no \`Resolved by\` field`));
    }
    const hasF2 = [...raw.matchAll(F2_BACKTICK_RE)].length > 0 || [...raw.matchAll(F2_HASH_RE)].length > 0;
    if (!hasF2) {
      findings.push(finding(file, 'rule 10 — the deciding citation is F2 (file + section), never a line', 'B10',
        `${where} is resolved-by-decision but no position cites a file AND a section in form F2; `
        + '"a decision exists" with no section is not a citation'));
    }
  }

  // Rule 11 — a `migration` position states current, target, and that it requires a decision.
  for (const p of positions) {
    if (!/migration/i.test(p.category || '')) continue;
    const scope = `${p.line}\n${raw}`;
    if (!/\bcurrent\s*:/i.test(scope) || !/\btarget\s*:/i.test(scope)) {
      findings.push(finding(file, 'rule 11 — a `migration` states a current state and a target state', 'B11',
        `${where} ${p.ref} is a migration and does not state both \`Current:\` and \`Target:\``));
    }
    if (!/requires\s+a\s+decision/i.test(scope)) {
      findings.push(finding(file, 'rule 11 — a `migration` states that it requires a decision', 'B11',
        `${where} ${p.ref} is a migration and does not state that it **requires a decision**; `
        + 'detecting a migration never executes it'));
    }
  }

  // Rule 12 — no position asserts a permission, guard or safety rule may be disabled. The attempt
  // IS the finding: precedence level 1 of the contract cannot be narrowed from a project artifact.
  for (const p of positions) {
    const text = `${p.claim} ${p.evidence}`;
    if (DISABLING_VERB.test(text) && GUARDED_NOUN.test(text)) {
      findings.push(finding(file, 'rule 12 — no position asserts a guard may be disabled', 'B12',
        `${where} ${p.ref} reads as an assertion that a permission, guard or safety rule may be `
        + 'disabled or bypassed; the record is itself the finding'));
    }
  }

  // Rule 13 — greenfield gate: with no source files and no manifests, three categories are
  // unreachable, because each asserts something about code that exists.
  if (greenfield === true) {
    for (const p of positions) {
      const cat = (p.category || '').toLowerCase();
      for (const forbidden of ['observed pattern', 'debt', 'migration']) {
        if (cat.includes(forbidden)) {
          findings.push(finding(file, 'rule 13 — greenfield gate: no category that asserts existing code', 'B13',
            `${where} ${p.ref} is \`${forbidden}\` in a project with no source files and no manifests; `
            + 'each of the three asserts something about code that exists, so emitting one invented the evidence'));
        }
      }
    }
  }

  // Rule 15 — a `pending-decision` enumerates its blocked actions. `Scope: repo` is legal, which
  // makes the computable half of "affected" vacuous, so the list is WRITTEN, not derived.
  if (status === 'pending-decision' && !blockedActionsOf(raw).length) {
    findings.push(finding(file, 'rule 15 — a `pending-decision` enumerates its blocked actions', 'B15',
      `${where} is pending-decision and enumerates no blocked actions. The list is what makes the `
      + 'blockade reviewable, and over-blocking visible — the easier of the two failures to commit'));
  }

  return { record: record.id, findings, positions: positions.length, status };
}

/**
 * Rule 16 — the skill↔skill coverage FLOOR, and the only rule anywhere in this design that checks
 * *recall* rather than form.
 *
 * `BROWNFIELD.md` B1's stopping criterion: the run's inventory must contain **every** pair of
 * inventoried skills at or above the declared threshold `0.45`, **every** `recommends:` edge among
 * them, and **every** skill named in an inventoried skill's `NOT` clause. The candidate set is
 * computed from the catalog on disk, so a missing pair is a deterministic failure and not a
 * judgement call — and it costs zero agent runs.
 *
 * `0.45` is the threshold the catalog's own auditor uses
 * (`scripts/routing-audit.js#"descriptionCollisions(buildTextCorpus(manifest.skills), 0.45)"`).
 * `0.80` is `FLOORS.maxCollision`, a failure ceiling: measured over these 274 it yields ZERO pairs,
 * so a competitor set built at `0.80` would always report "no competitors" and always look as if it
 * had worked.
 */
export const COLLISION_THRESHOLD = 0.45;

/** The `NOT … (that is \`x\`)` boundary clause: the skills a description explicitly disclaims. */
export function notClauseTargets(description, known) {
  const out = new Set();
  const text = String(description || '');
  const after = text.slice(text.search(/\bNOT\b/));
  if (!after) return out;
  for (const m of after.matchAll(/`([a-z0-9][a-z0-9-]*)`/g)) if (known.has(m[1])) out.add(m[1]);
  return out;
}

/** Rows of the run report's inventory table — the first column is the skill id. */
export function inventoryOf(body) {
  // `\Z` is not a JavaScript escape: it was matching a literal "Z". This section regex only ever
  // worked because a later heading happened to match first.
  const section = /^#{2,4}\s+[^\n]*\b(?:inventor\w+|B1)\b[^\n]*$([\s\S]*?)(?=^#{2,4}\s|(?![\s\S]))/im.exec(body);
  const scope = section ? section[1] : body;
  const ids = new Set();
  for (const line of scope.split('\n')) {
    if (!/^\s*\|/.test(line) && !/^\s*[a-z0-9][a-z0-9-]*\s*\|/.test(line)) continue;
    const first = line.replace(/^\s*\|/, '').split('|')[0].replace(/`/g, '').trim();
    if (/^[a-z0-9][a-z0-9-]*$/.test(first) && first !== 'skill' && !/^-+$/.test(first)) ids.add(first);
  }
  return ids;
}

/**
 * @param {object} o
 * @param {Set<string>} o.inventory  skill ids the run report inventoried
 * @param {string[]} o.selected      `.rsc.json#skills` — the skills the run was asked about
 * @param {Array} o.skills           manifest skill records: `{id, description, tags, recommends}`
 */
export function coverageFloorFindings({ file, inventory, selected, skills, threshold = COLLISION_THRESHOLD }) {
  const findings = [];
  const known = new Set(skills.map((s) => s.id));
  const byId = new Map(skills.map((s) => [s.id, s]));
  const subjects = selected.filter((id) => known.has(id));
  if (!subjects.length) return findings;

  const missing = new Map();   // partner id -> why it was required
  const require = (id, why) => { if (!inventory.has(id) && known.has(id)) missing.set(id, why); };

  // Declared edges first: they are exact, and they cost nothing.
  for (const id of subjects) {
    for (const rec of byId.get(id)?.recommends || []) require(rec, `\`${id}\` recommends: \`${rec}\``);
    for (const not of notClauseTargets(byId.get(id)?.description, known)) {
      require(not, `\`${not}\` is named in \`${id}\`'s NOT clause`);
    }
  }

  // Then the computed axis: description collisions at or above the declared threshold.
  const corpus = buildTextCorpus(skills);
  for (const { left, right, score } of descriptionCollisions(corpus, threshold)) {
    if (subjects.includes(left)) require(right, `description collision ${score.toFixed(3)} with \`${left}\` (≥ ${threshold})`);
    if (subjects.includes(right)) require(left, `description collision ${score.toFixed(3)} with \`${right}\` (≥ ${threshold})`);
  }

  for (const [id, why] of [...missing].sort()) {
    findings.push(finding(file, 'rule 16 — skill↔skill coverage floor', 'B16',
      `\`${id}\` is missing from the inventory: ${why}. B1's stopping criterion requires every such `
      + 'pair, edge and NOT-naming to appear; a deliberate exclusion is a ROW with its reason, not an absence'));
  }
  // Every selected skill appears exactly once — B1's first condition, cheap and separate.
  for (const id of subjects) {
    if (!inventory.has(id)) {
      findings.push(finding(file, 'rule 16 / B1 — every selected skill appears in the inventory', 'B16',
        `\`${id}\` is declared in \`.rsc.json#skills\` and does not appear in the inventory`));
    }
  }
  return findings;
}

/** Validate one brownfield run report: its OKF frontmatter, then each conflict record inside it. */
export function validateBrownfieldSource({ file, src, cwd, greenfield = null, indexed = null, floor = null }) {
  const findings = [];
  const fm = parseCustomizationFrontmatter(src);

  // OKF rule 1 — a non-empty `type:` on every non-reserved `.md` in the `wiki/` bundle. Without it
  // this fork prescribes a non-conformant file inside a conformant bundle, and nothing catches it.
  if (fm.noBlock) {
    findings.push(finding(file, 'OKF rule 1 — the run report carries frontmatter', 'BR1',
      'no frontmatter block: `02-DOCS/wiki/` is an OKF bundle and every non-reserved `.md` in it needs one'));
  } else {
    for (const bad of fm.badLines) {
      findings.push(finding(file, 'OKF rule 1 — the frontmatter parses', 'BR1',
        `line ${bad.line} is not a \`key: value\` pair or a list item: ${JSON.stringify(bad.text)}`));
    }
    if (!fm.keys.type) {
      findings.push(finding(file, `OKF rule 1 — \`type\` is present and non-empty`, 'BR1',
        `the run report carries no \`type:\`; it must be \`${BROWNFIELD_TYPE}\``));
    } else if (fm.keys.type !== BROWNFIELD_TYPE) {
      findings.push(finding(file, `OKF rule 1 — \`type\` equals \`${BROWNFIELD_TYPE}\``, 'BR1',
        `\`type: ${fm.keys.type}\` must be \`${BROWNFIELD_TYPE}\``));
    }
  }

  const body = String(src).replace(/^---\n[\s\S]*?\n---\n?/, '');
  // DESIGN.md §5 property 32: the report exists AND is indexed in the knowledge map.
  if (indexed === false) {
    findings.push(finding(file, 'DESIGN.md §5 property 32 — the report is indexed in `02-DOCS/wiki/index.md`', 'BR32',
      'the run report is not listed in `02-DOCS/wiki/index.md`; an unindexed wiki article is one nobody finds'));
  }

  const records = conflictRecordsOf(body);
  const results = records.map((record) => validateConflictRecord({ file, record, cwd, greenfield }));
  for (const r of results) findings.push(...r.findings);

  if (floor) findings.push(...coverageFloorFindings({ file, ...floor }));

  return { file, findings, records: results.map((r) => ({ id: r.record, positions: r.positions, status: r.status })) };
}

/**
 * Walk `02-DOCS/wiki/brownfield/` and validate every run report in it.
 *
 * `{ran: false}` when the directory is absent: a project that never ran the analysis has no report,
 * and absence is a valid state — the same rule the customization root follows (contract §2). An
 * UNREADABLE directory is NOT an absent one and is reported as such.
 *
 * Deterministic and offline. The coverage floor (rule 16) is computed only when the manifest and
 * `.rsc.json` are both readable; when either is missing the rule is reported as not run, never as
 * passed, because "no finding" and "not checked" are different states.
 */
export function validateBrownfieldRuns({ cwd = process.cwd(), catalogRoot = PKG_ROOT, skills = null, selected = null, greenfield = null } = {}) {
  const root = join(cwd, BROWNFIELD_ROOT);
  if (!existsSync(root)) {
    return { ran: false, root: BROWNFIELD_ROOT, files: [], findings: [], records: [], floorRan: false };
  }
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true })
      .filter((e) => (e.isFile() || e.isSymbolicLink()) && e.name.endsWith('.md'))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    return {
      ran: true, root: BROWNFIELD_ROOT, files: [], records: [], floorRan: false,
      findings: [finding(root, 'rule 1 — the brownfield root is readable', 'BR0',
        `cannot read \`${BROWNFIELD_ROOT}\`: ${err.code || err.message}. An unreadable directory is not an `
        + 'absent one, and must not be treated as "no runs exist"')],
    };
  }

  let index = null;
  try { index = readFileSync(join(cwd, '02-DOCS', 'wiki', 'index.md'), 'utf8'); } catch { index = null; }

  // The two inputs rule 16 needs. Either one missing means the rule did not run — reported, not
  // assumed to have passed.
  let catalogSkills = skills;
  if (!catalogSkills) {
    try { catalogSkills = JSON.parse(readFileSync(join(catalogRoot, 'manifest.json'), 'utf8')).skills || null; }
    catch { catalogSkills = null; }
  }
  let selectedIds = selected;
  if (!selectedIds) {
    try { selectedIds = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8')).skills || null; }
    catch { selectedIds = null; }
  }
  const floorRan = Boolean(catalogSkills && Array.isArray(selectedIds) && selectedIds.length);

  const findings = [];
  const files = [];
  const records = [];
  for (const entry of entries) {
    const file = join(root, entry.name);
    let src;
    try { src = readFileSync(file, 'utf8'); } catch (err) {
      findings.push(finding(file, 'rule 1 — the file is readable', 'BR1',
        `cannot read the file: ${err.code || err.message}. Unreadable is not absent`));
      continue;
    }
    const body = src.replace(/^---\n[\s\S]*?\n---\n?/, '');
    const result = validateBrownfieldSource({
      file, src, cwd, greenfield,
      indexed: index === null ? null : index.includes(entry.name),
      floor: floorRan
        ? { inventory: inventoryOf(body), selected: selectedIds, skills: catalogSkills }
        : null,
    });
    files.push(file);
    records.push(...result.records.map((r) => ({ ...r, file })));
    findings.push(...result.findings);
  }
  // Rule 13 needs one fact this function is not given: whether the project has any source files.
  // Computing it means walking the tree (`scanProject`), which `install` and `sync` have no reason
  // to pay for, so the caller passes it. Unknown is reported as NOT RUN — never as a pass.
  if (files.length && greenfield === null) {
    findings.push(finding(root, 'rule 13 — greenfield gate', 'B13-not-run',
      'the greenfield gate did not run: the caller did not say whether this project has source files. '
      + '`rscg brownfield --validate` and `npm run gate` compute it; `install` and `sync` do not, because '
      + 'walking the tree is not theirs to pay for. Not checked is not the same as no finding', 'not-run'));
  }
  if (files.length && !floorRan) {
    findings.push(finding(root, 'rule 16 — skill↔skill coverage floor', 'B16-not-run',
      'the coverage floor did not run: '
      + `${catalogSkills ? '' : 'the catalog manifest could not be read'}`
      + `${!catalogSkills && !Array.isArray(selectedIds) ? '; ' : ''}`
      + `${Array.isArray(selectedIds) && selectedIds.length ? '' : '`.rsc.json#skills` is absent or empty'}`
      + '. Not checked is not the same as no finding', 'not-run'));
  }
  return { ran: true, root: BROWNFIELD_ROOT, files, findings, records, floorRan };
}
