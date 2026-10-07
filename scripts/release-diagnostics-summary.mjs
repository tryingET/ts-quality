// @ts-check

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CHECK_CODES, UsageError, containedFile, inspectReleaseReport, parseOptions, realRoot, rootRelative, writeContained } from './release-diagnostics.mjs';
import { verificationCommands } from './verify.mjs';

/**
 * Downstream summary that links three separate kinds of facts (decision180 U13): quality obligations from a package
 * index, the recorded verification execution, and offline release prerequisites. It never joins them into one
 * status, approval or release permission, and compare reports differences only between comparable sections.
 */

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), '..');
export const REPO_SUMMARY_KIND = 'ts-quality-repo-summary';
export const REPO_SUMMARY_SCHEMA_VERSION = 1;
// The full ladder is whatever scripts/verify.mjs runs (install excluded), so the two cannot drift apart.
const FULL_VERIFICATION = verificationCommands(true).map((step) => `${step.command} ${step.args.join(' ')}`);
const SMOKE_VERIFICATION = 'npm run smoke --silent';

/** @param {Buffer} bytes */
function digest(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

/**
 * @param {string} rootReal
 * @param {string} candidate
 * @param {string} kind
 */
function readContained(rootReal, candidate, kind) {
  const relative = rootRelative(rootReal, candidate, kind);
  const resolved = containedFile(rootReal, relative);
  if (resolved.state !== 'file') {
    throw new UsageError(resolved.state === 'missing' ? `${kind} not found: ${relative}` : `${kind} refused: ${resolved.reason}`);
  }
  const bytes = fs.readFileSync(resolved.absolute);
  return { relative, bytes, sha256: digest(bytes) };
}

/**
 * Parses the `$ command ... exit=<status>` blocks scripts/verify.mjs records. A non-numeric status (verify.mjs writes
 * exit=null for a signal or a spawn failure) and a block with no exit line both count as failures (exit null).
 * @param {string} text
 */
export function parseVerificationLog(text) {
  /** @type {Array<{ command: string, exit: number | null }>} */
  const commands = [];
  /** @type {string | undefined} */
  let open;
  for (const line of text.split('\n')) {
    if (open === undefined && line.startsWith('$ ')) {
      open = line.slice(2).trim();
      continue;
    }
    const exit = /^exit=(\S*)$/u.exec(line.trim());
    if (open !== undefined && exit) {
      commands.push({ command: open, exit: /^\d+$/u.test(exit[1] ?? '') ? Number(exit[1]) : null });
      open = undefined;
    }
  }
  if (open !== undefined) {
    commands.push({ command: open, exit: null });
  }
  const passed = new Set(commands.filter((entry) => entry.exit === 0).map((entry) => entry.command));
  const mode = commands.some((entry) => entry.exit !== 0)
    ? 'failed'
    : FULL_VERIFICATION.every((command) => passed.has(command)) ? 'full' : passed.has(SMOKE_VERIFICATION) ? 'smoke' : 'partial';
  return { commands, mode };
}

/** @param {string} entry */
function normalizePackagePath(entry) {
  const normalized = path.posix.normalize(entry.replace(/\\/gu, '/')).replace(/\/+$/u, '');
  return normalized === '' ? '.' : normalized;
}

/**
 * @param {string} rootReal
 * @param {string} indexPath
 * @param {string[] | undefined} packages
 */
async function qualitySection(rootReal, indexPath, packages) {
  const api = await import(pathToFileURL(path.join(defaultRoot, 'dist/packages/ts-quality/src/index.js')).href);
  /** @type {any} */
  let inspection;
  try {
    inspection = api.inspectPackageIndexFile(rootReal, { index: indexPath, ...(packages ? { packages: packages.map(normalizePackagePath) } : {}) });
  } catch (error) {
    throw new UsageError(`package index refused: ${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    state: 'provided',
    source: { path: inspection.index.path, sha256: inspection.index.sha256 },
    references: inspection.references.state,
    enumeration: inspection.enumeration.state,
    completeness: inspection.completeness,
    packages: inspection.packages.map((/** @type {any} */ entry) => ({
      path: entry.path,
      name: entry.name,
      state: entry.state,
      runs: entry.quality.map((/** @type {any} */ item) => item.state === 'available'
        ? { runId: item.runId, outcome: item.runOutcome, findings: item.findingsInPackage, source: item.source.state }
        : { runId: item.runId, unavailable: item.reason })
    }))
  };
}

/**
 * @param {{ root?: string, packageIndex?: string, verificationLog?: string, releaseReport?: string, packages?: string[] }} options
 */
export async function buildRepoSummary(options) {
  const rootReal = realRoot(options.root);
  if (!options.packageIndex && !options.verificationLog && !options.releaseReport) {
    throw new UsageError('name at least one source: --package-index, --verification-log or --release-report');
  }
  if (options.packages && !options.packageIndex) {
    throw new UsageError('--package filters the quality section and needs --package-index');
  }
  const notProvided = { state: 'not-provided' };
  /** @type {Record<string, unknown>} */
  let verification = notProvided;
  if (options.verificationLog) {
    const log = readContained(rootReal, options.verificationLog, 'verification log');
    const parsed = parseVerificationLog(log.bytes.toString('utf8'));
    if (parsed.commands.length === 0) {
      throw new UsageError(`verification log ${log.relative} records no command`);
    }
    verification = {
      state: 'provided',
      source: { path: log.relative, sha256: log.sha256 },
      mode: parsed.mode,
      commands: parsed.commands,
      recorded: 'a recorded verification log: what ran and how it exited then; not live CI status'
    };
  }
  /** @type {Record<string, unknown>} */
  let release = notProvided;
  if (options.releaseReport) {
    const inspection = inspectReleaseReport({ root: rootReal, report: options.releaseReport });
    const failed = new Set(inspection.summary.failed);
    release = {
      state: 'provided',
      source: inspection.report,
      report: inspection.state,
      target: inspection.target,
      checkCount: inspection.summary.checkCount,
      failed: inspection.summary.failed,
      checks: Object.fromEntries(CHECK_CODES.map((code) => [code, failed.has(code) ? 'fail' : 'pass']))
    };
  }
  return {
    kind: REPO_SUMMARY_KIND,
    schemaVersion: REPO_SUMMARY_SCHEMA_VERSION,
    authority: 'separate facts: no combined status, approval or release permission',
    filter: options.packages ? [...new Set(options.packages.map(normalizePackagePath))].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)) : null,
    quality: options.packageIndex ? await qualitySection(rootReal, options.packageIndex, options.packages) : notProvided,
    verification,
    release
  };
}

/**
 * @param {string} rootReal
 * @param {string} candidate
 * @param {string} kind
 */
function loadSummary(rootReal, candidate, kind) {
  const file = readContained(rootReal, candidate, kind);
  /** @type {any} */
  let value;
  try {
    value = JSON.parse(file.bytes.toString('utf8'));
  } catch {
    throw new UsageError(`${kind} ${file.relative} is not valid JSON`);
  }
  if (!value || typeof value !== 'object' || value.kind !== REPO_SUMMARY_KIND) {
    throw new UsageError(`${kind} ${file.relative} is not a ${REPO_SUMMARY_KIND}`);
  }
  if (value.schemaVersion !== REPO_SUMMARY_SCHEMA_VERSION) {
    throw new UsageError(`${kind} ${file.relative} has unsupported repo summary schema version ${JSON.stringify(value.schemaVersion)}; this script reads ${REPO_SUMMARY_SCHEMA_VERSION}`);
  }
  for (const section of ['quality', 'verification', 'release']) {
    if (!value[section] || (value[section].state !== 'provided' && value[section].state !== 'not-provided')) {
      throw new UsageError(`${kind} ${file.relative} has a malformed ${section} section`);
    }
  }
  /** @param {boolean} ok @param {string} section */
  const shape = (ok, section) => {
    if (!ok) {
      throw new UsageError(`${kind} ${file.relative} has a malformed ${section} section`);
    }
  };
  const isObject = (/** @type {unknown} */ item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item);
  if (value.quality.state === 'provided') {
    shape(Array.isArray(value.quality.packages) && value.quality.packages.every((/** @type {any} */ entry) => isObject(entry) && typeof entry.path === 'string' && typeof entry.state === 'string' && Array.isArray(entry.runs)), 'quality');
  }
  if (value.verification.state === 'provided') {
    shape(typeof value.verification.mode === 'string' && Array.isArray(value.verification.commands) && value.verification.commands.every((/** @type {any} */ entry) => isObject(entry) && typeof entry.command === 'string'), 'verification');
  }
  if (value.release.state === 'provided') {
    shape(isObject(value.release.target) && isObject(value.release.checks) && typeof value.release.report === 'string', 'release');
  }
  shape(value.filter === null || (Array.isArray(value.filter) && value.filter.every((/** @type {unknown} */ entry) => typeof entry === 'string')), 'filter');
  return { file, value };
}

/** @param {any} entry */
function packageFacts(entry) {
  return { state: entry.state, runs: entry.runs };
}

/**
 * Section-by-section differences; a section is compared only when both summaries hold comparable facts.
 * @param {{ root?: string, baseline: string, candidate: string }} options
 */
export function compareRepoSummaries(options) {
  const rootReal = realRoot(options.root);
  const baseline = loadSummary(rootReal, options.baseline, 'baseline summary');
  const candidate = loadSummary(rootReal, options.candidate, 'candidate summary');
  const before = baseline.value;
  const after = candidate.value;

  /** @type {Record<string, unknown>} */
  let quality;
  const packagePaths = (/** @type {any} */ summary) => summary.quality.packages.map((/** @type {any} */ entry) => entry.path);
  if (before.quality.state !== 'provided' || after.quality.state !== 'provided') {
    quality = { comparable: false, reason: 'quality facts not provided in both summaries' };
  } else if (JSON.stringify(before.filter) !== JSON.stringify(after.filter) || JSON.stringify(packagePaths(before)) !== JSON.stringify(packagePaths(after))) {
    quality = { comparable: false, reason: 'package filter or package set differs' };
  } else {
    quality = {
      comparable: true,
      references: { baseline: before.quality.references, candidate: after.quality.references },
      enumeration: { baseline: before.quality.enumeration, candidate: after.quality.enumeration },
      packages: before.quality.packages.map((/** @type {any} */ entry, /** @type {number} */ index) => {
        const next = after.quality.packages[index];
        return { path: entry.path, baseline: packageFacts(entry), candidate: packageFacts(next), changed: JSON.stringify(packageFacts(entry)) !== JSON.stringify(packageFacts(next)) };
      })
    };
  }

  /** @type {Record<string, unknown>} */
  let verification;
  if (before.verification.state !== 'provided' || after.verification.state !== 'provided') {
    verification = { comparable: false, reason: 'verification facts not provided in both summaries' };
  } else if (before.verification.mode !== after.verification.mode) {
    verification = { comparable: false, reason: `verification mode ${before.verification.mode} vs ${after.verification.mode}` };
  } else {
    /** @param {Array<{ command: string, exit: number }>} commands */
    const keyed = (commands) => {
      /** @type {Map<string, number>} */
      const seen = new Map();
      return new Map(commands.map((entry) => {
        const occurrence = (seen.get(entry.command) ?? 0) + 1;
        seen.set(entry.command, occurrence);
        return [`${entry.command}#${occurrence}`, entry.exit];
      }));
    };
    const left = keyed(before.verification.commands);
    const right = keyed(after.verification.commands);
    verification = {
      comparable: true,
      mode: before.verification.mode,
      commands: [...new Set([...left.keys(), ...right.keys()])].map((key) => ({
        command: key.replace(/#\d+$/u, ''),
        baselineExit: left.get(key) ?? null,
        candidateExit: right.get(key) ?? null,
        changed: left.get(key) !== right.get(key)
      }))
    };
  }

  /** @type {Record<string, unknown>} */
  let release;
  if (before.release.state !== 'provided' || after.release.state !== 'provided') {
    release = { comparable: false, reason: 'release facts not provided in both summaries' };
  } else if (before.release.target?.packageName !== after.release.target?.packageName) {
    release = { comparable: false, reason: 'release target package differs' };
  } else {
    /** A code a summary did not record is reported as not-recorded, never as a pass. @param {any} summary @param {string} code */
    const status = (summary, code) => {
      const value = summary.release.checks?.[code];
      return value === 'pass' || value === 'fail' ? value : 'not-recorded';
    };
    release = {
      comparable: true,
      targets: { baseline: before.release.target, candidate: after.release.target },
      reports: { baseline: before.release.report, candidate: after.release.report },
      checks: CHECK_CODES.map((code) => ({ code, baseline: status(before, code), candidate: status(after, code), changed: status(before, code) !== status(after, code) }))
    };
  }
  return {
    kind: 'ts-quality-repo-summary-comparison',
    version: '1',
    claims: 'differences only: no improvement, approval or release permission is inferred',
    baseline: { path: baseline.file.relative, sha256: baseline.file.sha256 },
    candidate: { path: candidate.file.relative, sha256: candidate.file.sha256 },
    quality,
    verification,
    release
  };
}

/** @param {any} summary */
function renderSummary(summary) {
  const lines = [`Repo summary (separate facts; no combined status)${summary.filter ? ` for ${summary.filter.join(', ')}` : ''}`];
  lines.push(summary.quality.state === 'provided'
    ? `- quality (${summary.quality.source.path}): references ${summary.quality.references}; ${summary.quality.packages.map((/** @type {any} */ entry) => `${entry.path} ${entry.state}`).join(', ')}`
    : '- quality: not provided');
  lines.push(summary.verification.state === 'provided'
    ? `- verification (${summary.verification.source.path}): ${summary.verification.mode}, ${summary.verification.commands.length} recorded command(s)`
    : '- verification: not provided');
  lines.push(summary.release.state === 'provided'
    ? `- release (${summary.release.source.path}, ${summary.release.report}): ${summary.release.failed.length === 0 ? 'all offline checks passed' : `failing ${summary.release.failed.join(', ')}`}`
    : '- release: not provided');
  lines.push(summary.authority, '');
  return lines.join('\n');
}

const USAGE = `Usage: node scripts/release-diagnostics-summary.mjs summary [--root <dir>] [--package-index <file>] [--package <dir[,dir]>] [--verification-log <file>] [--release-report <file>] [--out <file>] [--json]
       node scripts/release-diagnostics-summary.mjs compare --baseline <file> --candidate <file> [--root <dir>] [--json]
Read-only apart from --out; runs no command. Exit codes: 0 done, 2 usage error or refused input.
`;

/** @param {string[]} argv */
async function main(argv) {
  const [command, ...rest] = argv;
  if (command === 'summary') {
    const options = parseOptions(rest, { '--root': 'value', '--package-index': 'value', '--package': 'value', '--verification-log': 'value', '--release-report': 'value', '--out': 'value', '--json': 'flag' });
    /** @param {string} name */
    const value = (name) => (typeof options[name] === 'string' ? /** @type {string} */ (options[name]) : undefined);
    const rootReal = realRoot(value('--root'));
    const out = value('--out') ? rootRelative(rootReal, /** @type {string} */ (value('--out')), '--out') : undefined;
    const packages = value('--package')?.split(',').map((item) => item.trim()).filter(Boolean);
    /** @type {{ root: string, packageIndex?: string, verificationLog?: string, releaseReport?: string, packages?: string[] }} */
    const summaryOptions = { root: rootReal };
    const packageIndex = value('--package-index');
    const verificationLog = value('--verification-log');
    const releaseReport = value('--release-report');
    if (packageIndex) {
      summaryOptions.packageIndex = packageIndex;
    }
    if (verificationLog) {
      summaryOptions.verificationLog = verificationLog;
    }
    if (releaseReport) {
      summaryOptions.releaseReport = releaseReport;
    }
    if (packages && packages.length > 0) {
      summaryOptions.packages = packages;
    }
    const summary = await buildRepoSummary(summaryOptions);
    const json = `${JSON.stringify(summary, null, 2)}\n`;
    if (out) {
      writeContained(rootReal, out, json);
    }
    process.stdout.write(options['--json'] ? json : renderSummary(summary));
    return 0;
  }
  if (command === 'compare') {
    const options = parseOptions(rest, { '--root': 'value', '--baseline': 'value', '--candidate': 'value', '--json': 'flag' });
    if (typeof options['--baseline'] !== 'string' || typeof options['--candidate'] !== 'string') {
      throw new UsageError('compare requires --baseline <file> and --candidate <file>');
    }
    const comparison = compareRepoSummaries({
      baseline: options['--baseline'],
      candidate: options['--candidate'],
      ...(typeof options['--root'] === 'string' ? { root: options['--root'] } : {})
    });
    process.stdout.write(options['--json']
      ? `${JSON.stringify(comparison, null, 2)}\n`
      : `${['quality', 'verification', 'release'].map((section) => {
        const facts = /** @type {any} */ (comparison)[section];
        return `- ${section}: ${facts.comparable ? 'comparable' : `not comparable (${facts.reason})`}`;
      }).join('\n')}\n${comparison.claims}\n`);
    return 0;
  }
  throw new UsageError(`unknown command ${JSON.stringify(command ?? '')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  }, (error) => {
    // The documented exit codes are 0 and 2: every error is a refusal, reported without a stack.
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${error instanceof UsageError ? USAGE : ''}`);
    process.exitCode = 2;
  });
}
