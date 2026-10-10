// @ts-check

import fs from 'fs';
import os from 'os';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

/** @typedef {{ testFile: string, exitCode: number }} TestFailure */

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), '..');
const root = path.resolve(process.env['TS_QUALITY_TEST_RUNNER_ROOT'] ?? defaultRoot);
const testDir = path.join(root, 'test');
const cacheRoot = process.env['XDG_CACHE_HOME'] ?? path.join(os.homedir(), '.cache');
const testTempRoot = path.join(cacheRoot, 'ts-quality', 'test-runner');
const failFast = process.env['TS_QUALITY_TEST_RUNNER_FAIL_FAST'] === '1';
const skipBuild = process.env['TS_QUALITY_TEST_RUNNER_SKIP_BUILD'] === '1';
const keepTemp = process.env['TS_QUALITY_TEST_RUNNER_KEEP_TEMP'] === '1';
// A run directory older than this belongs to an interrupted run; a live run touches its directory far more often.
const STALE_RUN_MS = 24 * 60 * 60 * 1000;
const SANITIZED_TEST_RUNNER_ENV_KEYS = ['NODE_TEST_CONTEXT'];
const failureSummaryPath = path.join(root, '.ts-quality', 'test-runner', 'failure-summary.json');

fs.mkdirSync(testTempRoot, { recursive: true });
fs.mkdirSync(path.dirname(failureSummaryPath), { recursive: true });
fs.rmSync(failureSummaryPath, { force: true });

/**
 * Removes run directories that interrupted runs left behind. Only `run-*` directories older than STALE_RUN_MS are
 * touched, so a concurrent run and anything else in the cache stay.
 * @param {number} now
 */
function pruneStaleRuns(now) {
  for (const entry of fs.readdirSync(testTempRoot)) {
    const entryPath = path.join(testTempRoot, entry);
    const stat = fs.lstatSync(entryPath, { throwIfNoEntry: false });
    if (entry.startsWith('run-') && stat?.isDirectory() && now - stat.mtimeMs > STALE_RUN_MS) {
      fs.rmSync(entryPath, { recursive: true, force: true });
    }
  }
}

pruneStaleRuns(Date.now());
// Every test file gets this run's own TMPDIR; tests create temp directories freely and the run removes them all.
const runTempDir = fs.mkdtempSync(path.join(testTempRoot, 'run-'));
let runTempHandled = false;
function releaseRunTemp() {
  if (runTempHandled) {
    return;
  }
  runTempHandled = true;
  if (keepTemp) {
    process.stderr.write(`kept test temp directory: ${runTempDir}\n`);
    return;
  }
  fs.rmSync(runTempDir, { recursive: true, force: true });
}
process.on('exit', releaseRunTemp);
for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.on(signal, () => {
    releaseRunTemp();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  });
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import('child_process').SpawnSyncOptions} [options]
 */
function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    ...options
  });
}

/**
 * @param {NodeJS.ProcessEnv} [baseEnv]
 * @returns {NodeJS.ProcessEnv}
 */
function testCommandEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  for (const key of SANITIZED_TEST_RUNNER_ENV_KEYS) {
    delete env[key];
  }
  return env;
}

/**
 * @param {TestFailure[]} failures
 * @param {number} totalFiles
 */
function writeFailureSummary(failures, totalFiles) {
  const summary = {
    version: 1,
    outcome: 'fail',
    mode: failFast ? 'fail-fast' : 'full-surface',
    totalFiles,
    failedFiles: failures.map(({ testFile, exitCode }) => ({ testFile, exitCode }))
  };
  fs.writeFileSync(failureSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

if (!skipBuild) {
  const build = run('tsc', ['-p', 'tsconfig.json'], { stdio: 'inherit' });
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
}

const testFiles = fs.readdirSync(testDir)
  .filter((fileName) => fileName.endsWith('.test.mjs'))
  .sort((left, right) => left.localeCompare(right))
  .map((fileName) => path.posix.join('test', fileName));

/** @type {TestFailure[]} */
const failures = [];

for (const testFile of testFiles) {
  const result = run('node', ['--test', testFile], {
    env: {
      ...testCommandEnv(process.env),
      TMPDIR: runTempDir,
      TMP: runTempDir,
      TEMP: runTempDir
    }
  });
  if (result.status === 0) {
    continue;
  }

  failures.push({ testFile, exitCode: result.status ?? 1 });
  process.stderr.write(`\n--- failing test file: ${testFile} (exit=${result.status ?? 1}) ---\n`);
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (failFast) {
    writeFailureSummary(failures, testFiles.length);
    process.stderr.write(`\nFail-fast: stopping after first failing test file (${testFile}, exit=${result.status ?? 1}).\n`);
    process.exit(result.status ?? 1);
  }
}

if (failures.length > 0) {
  writeFailureSummary(failures, testFiles.length);
  process.stderr.write(`\nTest suite failed in ${failures.length} file(s):\n`);
  for (const failure of failures) {
    process.stderr.write(`- ${failure.testFile} (exit=${failure.exitCode})\n`);
  }
  process.exit(1);
}
