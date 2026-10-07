// @ts-check

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { UsageError, assertRelative, containedFile, parseOptions } from './release-diagnostics.mjs';

/**
 * CI producer/reader roundtrip for the package artifact-reference index (decision180 U12). produce runs a ts-quality
 * CLI (CI passes the installed tarball's bin) against fixtures/native-package-index and stages exactly the index's
 * upload.paths; read inspects a downloaded copy with a CLI and asserts what an uploaded index must prove.
 */

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '..');
const RUN_IDS = ['ci-api-run', 'ci-web-run'];

/**
 * @param {string} cli
 * @param {string[]} args
 */
function runCli(cli, args) {
  const env = { ...process.env };
  delete env['NODE_TEST_CONTEXT'];
  // A .js entrypoint runs under this node; an installed bin shim runs directly. Never through a shell.
  const result = cli.endsWith('.js')
    ? spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env })
    : spawnSync(cli, args, { encoding: 'utf8', env, shell: false });
  if (result.status !== 0) {
    throw new Error(`ts-quality ${args.join(' ')} failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

/** @param {string | undefined} candidate */
function cliPath(candidate) {
  return path.resolve(candidate ?? path.join(root, 'dist/packages/ts-quality/src/cli.js'));
}

/**
 * Lists every regular file below a directory as POSIX paths; refuses symbolic links.
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {string[]}
 */
function listTree(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) {
      throw new Error(`artifact entry ${relative} is a symbolic link`);
    }
    return entry.isDirectory() ? listTree(path.join(dir, entry.name), relative) : [relative];
  }).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/** @param {{ cli?: string, outDir: string }} options */
export function produce(options) {
  const cli = cliPath(options.cli);
  const outDir = path.resolve(options.outDir);
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length > 0) {
    throw new UsageError(`--out-dir ${outDir} must be empty or absent`);
  }
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-package-index-ci-'));
  try {
    fs.cpSync(path.join(root, 'fixtures/native-package-index'), project, { recursive: true });
    runCli(cli, ['check', '--root', project, '--changed', 'packages/api/src/limit.js', '--run-id', 'ci-api-run']);
    runCli(cli, ['check', '--root', project, '--changed', 'packages/web/src/label.js', '--run-id', 'ci-web-run']);
    const index = JSON.parse(runCli(cli, ['index', 'write', '--root', project, '--all', '--run-id', RUN_IDS.join(','), '--json']));
    const projectReal = fs.realpathSync(project);
    for (const file of index.upload.paths) {
      const relative = assertRelative(file, 'upload path');
      const source = containedFile(projectReal, relative);
      if (source.state !== 'file') {
        throw new Error(`upload path ${relative} is not a regular file in the project`);
      }
      fs.mkdirSync(path.dirname(path.join(outDir, relative)), { recursive: true });
      fs.copyFileSync(source.absolute, path.join(outDir, relative));
    }
    return { outDir, files: index.upload.paths.length, runs: RUN_IDS };
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
}

/** @param {{ cli?: string, artifactDir: string }} options */
export function read(options) {
  const cli = cliPath(options.cli);
  const artifactDir = fs.realpathSync(options.artifactDir);
  // Sweep the download for symbolic links before anything reads it.
  const files = listTree(artifactDir);
  const inspection = JSON.parse(runCli(cli, ['index', 'inspect', '--root', artifactDir, '--json']));
  const index = JSON.parse(fs.readFileSync(path.join(artifactDir, '.ts-quality/package-index.json'), 'utf8'));
  /** @type {string[]} */
  const problems = [];
  const extra = files.filter((file) => !index.upload.paths.includes(file));
  if (extra.length > 0) {
    problems.push(`artifact holds files outside upload.paths: ${extra.join(', ')}`);
  }
  if (inspection.references.state !== 'fresh') {
    problems.push(`references are ${inspection.references.state} (changed ${inspection.references.changed}, missing ${inspection.references.missing})`);
  }
  if (inspection.enumeration.state !== 'current') {
    problems.push(`package enumeration is ${inspection.enumeration.state}`);
  }
  if (JSON.stringify(inspection.runs.map((/** @type {{ runId: string }} */ run) => run.runId)) !== JSON.stringify(RUN_IDS)) {
    problems.push(`runs are ${inspection.runs.map((/** @type {{ runId: string }} */ run) => run.runId).join(', ')}`);
  }
  for (const entry of inspection.packages.filter((/** @type {{ status: string }} */ item) => item.status === 'evidence-present')) {
    // Sources are not uploaded, so a faithful copy reports them unavailable, never current.
    if (entry.state !== 'source-unavailable' || !entry.quality.every((/** @type {{ state: string }} */ item) => item.state === 'available')) {
      problems.push(`package ${entry.path} is ${entry.state} with quality ${entry.quality.map((/** @type {{ state: string }} */ item) => item.state).join(', ')}`);
    }
  }
  if (inspection.completeness.executedCoverageClaim !== 'none') {
    problems.push('the index claims executed coverage');
  }
  if (problems.length > 0) {
    throw new Error(`package index roundtrip failed:\n- ${problems.join('\n- ')}`);
  }
  return { references: inspection.references, packages: inspection.packages.map((/** @type {{ path: string, state: string }} */ entry) => `${entry.path}: ${entry.state}`) };
}

const USAGE = `Usage: node scripts/native-package-index-ci.mjs produce --out-dir <dir> [--cli <ts-quality bin or cli.js>]
       node scripts/native-package-index-ci.mjs read --artifact-dir <dir> [--cli <ts-quality bin or cli.js>]
`;

/** @param {string[]} argv */
function main(argv) {
  const [command, ...rest] = argv;
  if (command === 'produce') {
    const options = parseOptions(rest, { '--out-dir': 'value', '--cli': 'value' });
    if (typeof options['--out-dir'] !== 'string') {
      throw new UsageError('produce requires --out-dir <dir>');
    }
    const result = produce({ outDir: options['--out-dir'], ...(typeof options['--cli'] === 'string' ? { cli: options['--cli'] } : {}) });
    process.stdout.write(`package-index-ci: produced ${result.files} upload file(s) for ${result.runs.join(', ')} in ${result.outDir}\n`);
    return;
  }
  if (command === 'read') {
    const options = parseOptions(rest, { '--artifact-dir': 'value', '--cli': 'value' });
    if (typeof options['--artifact-dir'] !== 'string') {
      throw new UsageError('read requires --artifact-dir <dir>');
    }
    const result = read({ artifactDir: options['--artifact-dir'], ...(typeof options['--cli'] === 'string' ? { cli: options['--cli'] } : {}) });
    process.stdout.write(`package-index-ci: references ${result.references.state} (${result.references.fresh} fresh); ${result.packages.join('; ')}\n`);
    return;
  }
  throw new UsageError(`unknown command ${JSON.stringify(command ?? '')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${error instanceof UsageError ? USAGE : ''}`);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  }
}
