// @ts-check

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWorkflow, stepRunning } from './release-diagnostics-workflow.mjs';

/**
 * Read-only, offline release diagnostics (decision180 G8). They read local files only: no Git, npm, network or
 * GitHub call, and no command is executed. A passing preview is a diagnostic, never release permission; publishing
 * stays with the GitHub Release workflow (.github/workflows/publish.yml) and the release task that owns it.
 */

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), '..');

export const RELEASE_DIAGNOSTICS_KIND = 'ts-quality-release-diagnostics';
export const RELEASE_DIAGNOSTICS_SCHEMA_VERSION = 1;
const AUTHORITY = 'diagnostic only: not release permission; publishing stays with the GitHub Release workflow (publish.yml)';
const EXPECTED = {
  packageName: 'ts-quality',
  repository: 'github.com/tryingET/ts-quality',
  owner: 'tryingET',
  repositoryName: 'ts-quality',
  workflow: '.github/workflows/publish.yml',
  workflowFilename: 'publish.yml',
  environment: 'npm-publish',
  stagedPackageDir: '.ts-quality/npm/ts-quality/package'
};
const TAG_PATTERN = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u;
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u;
export const CHECK_CODES = [
  'target.manifest', 'target.package-name', 'target.version', 'target.workspace-version', 'target.bin',
  'tag.format', 'tag.matches-version',
  'workflow.present', 'workflow.release-trigger', 'workflow.oidc', 'workflow.environment', 'workflow.intent-check', 'workflow.proof', 'workflow.publish-command', 'workflow.staged-package',
  'provenance.repository', 'provenance.trusted-publisher',
  'notes.release-notes', 'notes.changelog'
];

export class UsageError extends Error {}

/** @param {Buffer | string} bytes */
function digest(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

/**
 * A root-relative POSIX path with no traversal, absolute form or control characters.
 * @param {unknown} candidate
 * @param {string} kind
 */
export function assertRelative(candidate, kind) {
  if (typeof candidate !== 'string' || candidate.length === 0 || /[\u0000-\u001f\u007f\\]/u.test(candidate)
    || path.posix.isAbsolute(candidate) || path.win32.isAbsolute(candidate)) {
    throw new UsageError(`${kind} must be a relative path inside the root: ${JSON.stringify(candidate)}`);
  }
  const normalized = path.posix.normalize(candidate);
  if (normalized !== candidate || normalized === '..' || normalized.startsWith('../')) {
    throw new UsageError(`${kind} must stay inside the root: ${JSON.stringify(candidate)}`);
  }
  return candidate;
}

/**
 * Resolves a relative path with lstat on every segment so no symbolic link is followed.
 * @param {string} rootReal
 * @param {string} relative
 * @returns {{ state: 'file', absolute: string } | { state: 'missing' } | { state: 'refused', reason: string }}
 */
export function containedFile(rootReal, relative) {
  let current = rootReal;
  const segments = relative.split('/');
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat) {
      return { state: 'missing' };
    }
    if (stat.isSymbolicLink()) {
      return { state: 'refused', reason: `${relative} is or traverses a symbolic link` };
    }
    if (index < segments.length - 1 && !stat.isDirectory()) {
      return { state: 'missing' };
    }
    if (index === segments.length - 1 && !stat.isFile()) {
      return { state: 'refused', reason: `${relative} is not a regular file` };
    }
  }
  return { state: 'file', absolute: current };
}

/**
 * Resolves a user-supplied output or report path (relative to the root, or absolute inside it).
 * @param {string} rootReal
 * @param {string} candidate
 * @param {string} kind
 */
export function rootRelative(rootReal, candidate, kind) {
  const relative = path.isAbsolute(candidate) ? path.relative(rootReal, canonicalAbsolute(candidate)).split(path.sep).join('/') : candidate;
  return assertRelative(relative, kind);
}

/**
 * Resolves an absolute path through its deepest existing ancestor, so a symlinked root still matches.
 * @param {string} candidate
 */
function canonicalAbsolute(candidate) {
  let existing = path.resolve(candidate);
  /** @type {string[]} */
  const tail = [];
  while (!fs.existsSync(existing) && path.dirname(existing) !== existing) {
    tail.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  return path.join(fs.realpathSync(existing), ...tail);
}

/**
 * The real root directory; a missing root is a usage error, not a failed check.
 * @param {string | undefined} root
 */
export function realRoot(root) {
  try {
    return fs.realpathSync(root ?? defaultRoot);
  } catch {
    throw new UsageError(`--root ${JSON.stringify(root)} does not exist`);
  }
}

/** @param {string} left @param {string} right */
function byCodeUnit(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** @param {string} rootReal */
function releaseNotesListing(rootReal) {
  return listReleaseNotes(rootReal).join('\n');
}

/**
 * Reads the local inputs the checks need; every read is recorded with its digest.
 * @param {string} rootReal
 */
function readInputs(rootReal) {
  /** @type {Array<{ path: string, kind: 'file' | 'listing', sha256: string }>} */
  const inputs = [];
  /** @type {Map<string, { text?: string, error?: string }>} */
  const files = new Map();
  /** Missing and refused reads are recorded too, so a file that appears later makes the report stale. @param {string} relative */
  const read = (relative) => {
    const resolved = containedFile(rootReal, relative);
    if (resolved.state === 'file') {
      const bytes = fs.readFileSync(resolved.absolute);
      inputs.push({ path: relative, kind: 'file', sha256: digest(bytes) });
      files.set(relative, { text: bytes.toString('utf8') });
    } else {
      inputs.push({ path: relative, kind: 'file', sha256: resolved.state });
      files.set(relative, { error: resolved.state === 'missing' ? `${relative} is missing` : resolved.reason });
    }
    return files.get(relative) ?? {};
  };
  return { inputs, read };
}

/**
 * The state of a recorded input now: its digest, 'missing' or 'refused' (never followed).
 * @param {string} rootReal
 * @param {{ path: string, kind: string }} input
 */
function inputDigest(rootReal, input) {
  if (input.kind === 'listing') {
    return digest(releaseNotesListing(rootReal));
  }
  const resolved = containedFile(rootReal, input.path);
  return resolved.state === 'file' ? digest(fs.readFileSync(resolved.absolute)) : resolved.state;
}

/** @param {string | undefined} text */
function parseJson(text) {
  if (text === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** @param {unknown} url */
function normalizeRepository(url) {
  return typeof url === 'string' ? url.replace(/^git\+/u, '').replace(/^https?:\/\//u, '').replace(/^git@github\.com:/u, 'github.com/').replace(/\.git$/u, '') : '';
}

/**
 * Offline preview of the release prerequisites for one tag.
 * @param {{ root?: string, tag?: string }} options
 */
export function previewRelease(options = {}) {
  const rootReal = realRoot(options.root);
  const { inputs, read } = readInputs(rootReal);
  /** @type {Array<{ code: string, ok: boolean, boundary: string, message: string }>} */
  const checks = [];
  /**
   * @param {string} code
   * @param {boolean} ok
   * @param {string} message
   */
  const check = (code, ok, message) => checks.push({ code, ok, boundary: code.split('.')[0] ?? code, message });

  const manifestFile = read('packages/ts-quality/package.json');
  const manifest = parseJson(manifestFile.text);
  check('target.manifest', manifest !== undefined, manifest !== undefined ? 'packages/ts-quality/package.json is readable JSON' : `public package manifest unusable: ${manifestFile.error ?? 'not valid JSON'}`);
  const packageName = typeof manifest?.name === 'string' ? manifest.name : '';
  const version = typeof manifest?.version === 'string' ? manifest.version : '';
  check('target.package-name', packageName === EXPECTED.packageName, `package name ${JSON.stringify(packageName)}; expected ${EXPECTED.packageName}`);
  check('target.version', VERSION_PATTERN.test(version), `package version ${JSON.stringify(version)} must be semver`);
  const workspace = parseJson(read('package.json').text);
  const workspaceVersion = typeof workspace?.version === 'string' ? workspace.version : '';
  check('target.workspace-version', workspaceVersion !== '' && workspaceVersion === version, `workspace version ${JSON.stringify(workspaceVersion)} must equal package version ${JSON.stringify(version)}`);
  check('target.bin', typeof manifest?.bin?.[EXPECTED.packageName] === 'string', `bin.${EXPECTED.packageName} must name the CLI entrypoint`);

  const tag = options.tag ?? `v${version}`;
  check('tag.format', TAG_PATTERN.test(tag), `tag ${JSON.stringify(tag)} must be v<semver>`);
  check('tag.matches-version', tag === `v${version}`, `tag ${JSON.stringify(tag)} must equal v${version}`);

  const workflowFile = read(EXPECTED.workflow);
  const workflow = workflowFile.text ?? '';
  const parsed = readWorkflow(workflow);
  const publishStep = stepRunning(parsed, /^npm publish\b/u);
  const intentStep = stepRunning(parsed, /^npm run release:intent:check\b/u);
  const proofStep = stepRunning(parsed, /^npm run verify:ci\b/u);
  check('workflow.present', workflowFile.text !== undefined, workflowFile.text !== undefined ? `${EXPECTED.workflow} is present` : `${EXPECTED.workflow} unusable: ${workflowFile.error}`);
  check('workflow.release-trigger', parsed.triggers.length === 1 && parsed.triggers[0] === 'release' && /^\[?\s*published\s*\]?$/u.test(parsed.releaseTypes),
    `publishing must trigger only on a published GitHub Release (triggers: ${parsed.triggers.join(', ') || 'none'}; release types: ${parsed.releaseTypes || 'none'})`);
  check('workflow.oidc', /^\s+id-token:\s*write\s*(#.*)?$/mu.test(workflow), 'the publish job needs id-token: write for Trusted Publishing');
  check('workflow.environment', new RegExp(`^\\s+environment:\\s*(?:${EXPECTED.environment}\\s*(?:#.*)?$|\\n\\s+name:\\s*${EXPECTED.environment}\\s*(?:#.*)?$)`, 'mu').test(workflow), `the publish job must run in the ${EXPECTED.environment} environment`);
  check('workflow.intent-check', intentStep >= 0 && (publishStep < 0 || intentStep < publishStep), 'a step must run npm run release:intent:check (tag equals package version) before publishing');
  check('workflow.proof', proofStep >= 0 && (publishStep < 0 || proofStep < publishStep), 'a step must run npm run verify:ci before publishing');
  check('workflow.publish-command', stepRunning(parsed, /^npm publish --provenance --access public\b/u) >= 0, 'a step must publish with npm publish --provenance --access public');
  check('workflow.staged-package', publishStep >= 0 && parsed.steps[publishStep]?.workingDirectory === EXPECTED.stagedPackageDir, `the publish step must run in ${EXPECTED.stagedPackageDir}`);

  const repository = normalizeRepository(manifest?.repository?.url);
  check('provenance.repository', repository === EXPECTED.repository, `repository.url resolves to ${JSON.stringify(repository)}; provenance needs ${EXPECTED.repository}`);
  const publisher = [`owner: '${EXPECTED.owner}'`, `repository: '${EXPECTED.repositoryName}'`, `workflowFilename: '${EXPECTED.workflowFilename}'`, `environmentName: '${EXPECTED.environment}'`];
  check('provenance.trusted-publisher', publisher.every((line) => workflow.includes(line)), `the workflow's expected trusted publisher must name ${publisher.join(', ')}`);

  const notes = listReleaseNotes(rootReal).filter((name) => name.endsWith(`-v${version}-github-release.md`));
  inputs.push({ path: 'docs/releases', kind: 'listing', sha256: digest(releaseNotesListing(rootReal)) });
  for (const name of notes) {
    read(`docs/releases/${name}`);
  }
  check('notes.release-notes', version !== '' && notes.length === 1, notes.length === 1 ? `docs/releases/${notes[0]}` : `expected exactly one docs/releases/<date>-v${version}-github-release.md, found ${notes.length}`);
  const changelog = read('CHANGELOG.md').text ?? '';
  check('notes.changelog', version !== '' && changelog.includes(`\n## [${version}]`), `CHANGELOG.md must have a ## [${version}] section`);

  const failed = checks.filter((item) => !item.ok).map((item) => item.code);
  return {
    kind: RELEASE_DIAGNOSTICS_KIND,
    schemaVersion: RELEASE_DIAGNOSTICS_SCHEMA_VERSION,
    authority: AUTHORITY,
    offline: true,
    target: {
      packageName,
      version,
      tag,
      tagSource: options.tag === undefined ? 'derived' : 'argument',
      prereleaseTag: tag.includes('-'),
      npmDistTag: 'set by the GitHub Release prerelease flag (publish.yml: next when marked prerelease, else latest)'
    },
    inputs: inputs.sort((left, right) => byCodeUnit(left.path, right.path)),
    checks,
    summary: { checkCount: checks.length, failed, ok: failed.length === 0 }
  };
}

/** @param {string} rootReal */
function listReleaseNotes(rootReal) {
  const docs = fs.lstatSync(path.join(rootReal, 'docs'), { throwIfNoEntry: false });
  const releases = fs.lstatSync(path.join(rootReal, 'docs', 'releases'), { throwIfNoEntry: false });
  if (!docs?.isDirectory() || !releases?.isDirectory()) {
    return [];
  }
  return fs.readdirSync(path.join(rootReal, 'docs', 'releases'), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort(byCodeUnit);
}

/**
 * Schema check for an untrusted report: anything not understood is refused.
 * @param {string} text
 * @param {string} source
 */
export function parseReleaseReport(text, source) {
  /** @type {any} */
  let report;
  try {
    report = JSON.parse(text);
  } catch {
    throw new UsageError(`${source} is not valid JSON.`);
  }
  if (!report || typeof report !== 'object' || report.kind !== RELEASE_DIAGNOSTICS_KIND) {
    throw new UsageError(`${source} is not a ${RELEASE_DIAGNOSTICS_KIND} report.`);
  }
  if (report.schemaVersion !== RELEASE_DIAGNOSTICS_SCHEMA_VERSION) {
    throw new UsageError(`${source} has unsupported release diagnostics schema version ${JSON.stringify(report.schemaVersion)}; this script reads ${RELEASE_DIAGNOSTICS_SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(report.inputs) || !Array.isArray(report.checks) || !report.summary || typeof report.target !== 'object' || report.target === null) {
    throw new UsageError(`${source} must carry target, inputs, checks and summary.`);
  }
  for (const input of report.inputs) {
    assertRelative(input?.path, 'report input');
    if ((input.kind !== 'file' && input.kind !== 'listing') || typeof input.sha256 !== 'string' || !/^(?:sha256:[a-f0-9]{64}|missing|refused)$/u.test(input.sha256)) {
      throw new UsageError(`${source} input ${input.path} needs a kind and a sha256 digest, missing or refused.`);
    }
  }
  for (const item of report.checks) {
    if (!CHECK_CODES.includes(item?.code) || typeof item.ok !== 'boolean' || typeof item.message !== 'string') {
      throw new UsageError(`${source} has an unknown check code ${String(item?.code)} or a malformed check.`);
    }
  }
  // Every check must be recorded exactly once, in order: an empty or partial report can never read as passing.
  if (JSON.stringify(report.checks.map((/** @type {{ code: string }} */ item) => item.code)) !== JSON.stringify(CHECK_CODES)) {
    throw new UsageError(`${source} must record each of the ${CHECK_CODES.length} checks exactly once, in order.`);
  }
  const failed = report.checks.filter((/** @type {{ ok: boolean }} */ item) => !item.ok).map((/** @type {{ code: string }} */ item) => item.code);
  if (JSON.stringify(report.summary.failed) !== JSON.stringify(failed) || report.summary.ok !== (failed.length === 0) || report.summary.checkCount !== report.checks.length) {
    throw new UsageError(`${source} summary disagrees with its checks.`);
  }
  return report;
}

/**
 * Reloads a written report and re-digests its inputs. Read-only.
 * @param {{ root?: string, report: string }} options
 */
export function inspectReleaseReport(options) {
  const rootReal = realRoot(options.root);
  const relative = rootRelative(rootReal, options.report, 'release diagnostics report');
  const resolved = containedFile(rootReal, relative);
  if (resolved.state !== 'file') {
    throw new UsageError(resolved.state === 'missing' ? `release diagnostics report not found: ${relative}` : `release diagnostics report refused: ${resolved.reason}`);
  }
  const bytes = fs.readFileSync(resolved.absolute);
  const report = parseReleaseReport(bytes.toString('utf8'), relative);
  const inputs = report.inputs.map((/** @type {{ path: string, kind: string, sha256: string }} */ input) => {
    const now = inputDigest(rootReal, input);
    const state = now === input.sha256 ? 'fresh' : now === 'missing' ? 'missing' : 'changed';
    return { path: input.path, state };
  });
  return {
    kind: 'ts-quality-release-diagnostics-inspection',
    version: '1',
    authority: AUTHORITY,
    report: { path: relative, sha256: digest(bytes) },
    target: report.target,
    state: inputs.every((/** @type {{ state: string }} */ input) => input.state === 'fresh') ? 'current' : 'stale',
    inputs,
    summary: report.summary
  };
}

/**
 * @param {string} rootReal
 * @param {string} relative
 * @param {string} contents
 */
export function writeContained(rootReal, relative, contents) {
  const lowered = relative.toLowerCase();
  if (lowered === '.ts-quality/runs' || lowered.startsWith('.ts-quality/runs/')) {
    throw new UsageError(`output ${relative} must not be inside .ts-quality/runs: run packets are immutable.`);
  }
  let current = rootReal;
  for (const segment of path.posix.dirname(relative).split('/').filter((item) => item !== '.')) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat) {
      break;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new UsageError(`output ${relative} must not traverse a symbolic link or a file.`);
    }
  }
  const absolute = path.join(rootReal, relative);
  const existing = fs.lstatSync(absolute, { throwIfNoEntry: false });
  if (existing && !existing.isFile()) {
    throw new UsageError(`output ${relative} exists and is not a regular file.`);
  }
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, contents, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temporary, absolute);
}

/**
 * @param {string[]} argv
 * @param {Record<string, 'value' | 'flag'>} allowed
 */
export function parseOptions(argv, allowed) {
  /** @type {Record<string, string | boolean>} */
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index] ?? '';
    const kind = allowed[name];
    if (!kind) {
      throw new UsageError(`unknown option ${name}`);
    }
    if (name in options) {
      throw new UsageError(`${name} may only be given once`);
    }
    if (kind === 'flag') {
      options[name] = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new UsageError(`${name} requires a value`);
    }
    options[name] = value;
    index += 1;
  }
  return options;
}

/** @param {any} report */
function renderReport(report) {
  return [
    `Release diagnostics for ${report.target.packageName || '?'} ${report.target.tag}${report.target.prereleaseTag ? ' (prerelease tag; the dist-tag follows the GitHub Release prerelease flag)' : ''}: ${report.summary.ok ? 'all offline checks pass' : `failing ${report.summary.failed.join(', ')}`}`,
    ...report.checks.map((/** @type {{ ok: boolean, code: string, message: string }} */ item) => `- ${item.ok ? 'ok  ' : 'FAIL'} ${item.code}: ${item.message}`),
    report.authority,
    ''
  ].join('\n');
}

const USAGE = `Usage: node scripts/release-diagnostics.mjs preview [--root <dir>] [--tag <tag>] [--out <file>] [--json]
       node scripts/release-diagnostics.mjs inspect --report <file> [--root <dir>] [--json]
Offline and read-only: reads local files, runs no command and grants no release permission.
Exit codes: 0 checks pass (or inspect loaded), 1 a check failed, 2 usage error or refused input.
`;

/** @param {string[]} argv */
function main(argv) {
  const [command, ...rest] = argv;
  if (command === 'preview') {
    const options = parseOptions(rest, { '--root': 'value', '--tag': 'value', '--out': 'value', '--json': 'flag' });
    const rootReal = realRoot(typeof options['--root'] === 'string' ? options['--root'] : undefined);
    const out = typeof options['--out'] === 'string' ? rootRelative(rootReal, options['--out'], '--out') : undefined;
    const report = previewRelease({ root: rootReal, ...(typeof options['--tag'] === 'string' ? { tag: options['--tag'] } : {}) });
    const json = `${JSON.stringify(report, null, 2)}\n`;
    if (out) {
      writeContained(rootReal, out, json);
    }
    process.stdout.write(options['--json'] ? json : renderReport(report));
    return report.summary.ok ? 0 : 1;
  }
  if (command === 'inspect') {
    const options = parseOptions(rest, { '--root': 'value', '--report': 'value', '--json': 'flag' });
    if (typeof options['--report'] !== 'string') {
      throw new UsageError('inspect requires --report <file>');
    }
    const inspection = inspectReleaseReport({ report: options['--report'], ...(typeof options['--root'] === 'string' ? { root: options['--root'] } : {}) });
    process.stdout.write(options['--json']
      ? `${JSON.stringify(inspection, null, 2)}\n`
      : `Release diagnostics report ${inspection.report.path}: ${inspection.state}; recorded checks ${inspection.summary.ok ? 'pass' : `fail (${inspection.summary.failed.join(', ')})`}\n${inspection.authority}\n`);
    return 0;
  }
  throw new UsageError(`unknown command ${JSON.stringify(command ?? '')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    // Exit 1 is reserved for a failed check; any other error is a refusal.
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${error instanceof UsageError ? USAGE : ''}`);
    process.exitCode = 2;
  }
}
