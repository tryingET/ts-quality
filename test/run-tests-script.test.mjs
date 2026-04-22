import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import test from 'node:test';
import assert from 'assert/strict';
import { repoRoot } from './helpers.mjs';

const runTestsScript = path.join(repoRoot, 'scripts', 'run-tests.mjs');

function tempRunnerRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-runner-'));
  fs.mkdirSync(path.join(root, 'test'), { recursive: true });
  return root;
}

function failureSummaryPath(rootDir) {
  return path.join(rootDir, '.ts-quality', 'test-runner', 'failure-summary.json');
}

function writeFixtureTests(rootDir) {
  const testRoot = path.join(rootDir, 'test');
  const markerPath = path.join(rootDir, 'after-pass.marker');

  fs.writeFileSync(path.join(testRoot, 'a-fail.test.mjs'), [
    "import test from 'node:test';",
    "import assert from 'assert/strict';",
    "test('fails first', () => {",
    "  assert.equal(1, 2);",
    '});',
    ''
  ].join('\n'), 'utf8');

  fs.writeFileSync(path.join(testRoot, 'b-pass-after-fail.test.mjs'), [
    "import fs from 'fs';",
    "import test from 'node:test';",
    `const markerPath = ${JSON.stringify(markerPath)};`,
    "test('still runs after earlier failure', () => {",
    "  fs.writeFileSync(markerPath, 'ran', 'utf8');",
    '});',
    ''
  ].join('\n'), 'utf8');

  return { markerPath, summaryPath: failureSummaryPath(rootDir) };
}

function writePassingTest(rootDir) {
  const testRoot = path.join(rootDir, 'test');
  fs.writeFileSync(path.join(testRoot, 'only-pass.test.mjs'), [
    "import test from 'node:test';",
    "import assert from 'assert/strict';",
    "test('passes', () => {",
    "  assert.equal(1, 1);",
    '});',
    ''
  ].join('\n'), 'utf8');
}

test('run-tests continues after the first failing file, prints an aggregate failure summary, and writes a deterministic failure artifact', () => {
  const rootDir = tempRunnerRoot();
  const { markerPath, summaryPath } = writeFixtureTests(rootDir);

  const result = spawnSync('node', [runTestsScript], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      TS_QUALITY_TEST_RUNNER_ROOT: rootDir,
      TS_QUALITY_TEST_RUNNER_SKIP_BUILD: '1'
    }
  });

  assert.equal(result.status, 1, result.stderr);
  assert.equal(fs.existsSync(markerPath), true, 'expected later passing test file to run after an earlier failure');
  assert.match(result.stderr, /Test suite failed in 1 file\(s\):/);
  assert.match(result.stderr, /a-fail\.test\.mjs/);
  assert.doesNotMatch(result.stderr, /Fail-fast:/);
  assert.deepEqual(JSON.parse(fs.readFileSync(summaryPath, 'utf8')), {
    version: 1,
    outcome: 'fail',
    mode: 'full-surface',
    totalFiles: 2,
    failedFiles: [
      {
        testFile: 'test/a-fail.test.mjs',
        exitCode: 1
      }
    ]
  });
});

test('run-tests keeps fail-fast available as an explicit opt-in and records that mode in the failure artifact', () => {
  const rootDir = tempRunnerRoot();
  const { markerPath, summaryPath } = writeFixtureTests(rootDir);

  const result = spawnSync('node', [runTestsScript], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      TS_QUALITY_TEST_RUNNER_ROOT: rootDir,
      TS_QUALITY_TEST_RUNNER_SKIP_BUILD: '1',
      TS_QUALITY_TEST_RUNNER_FAIL_FAST: '1'
    }
  });

  assert.equal(result.status, 1, result.stderr);
  assert.equal(fs.existsSync(markerPath), false, 'expected fail-fast mode to stop before later test files run');
  assert.match(result.stderr, /Fail-fast: stopping after first failing test file/);
  assert.deepEqual(JSON.parse(fs.readFileSync(summaryPath, 'utf8')), {
    version: 1,
    outcome: 'fail',
    mode: 'fail-fast',
    totalFiles: 2,
    failedFiles: [
      {
        testFile: 'test/a-fail.test.mjs',
        exitCode: 1
      }
    ]
  });
});


test('run-tests removes stale failure artifacts before a clean passing run', () => {
  const rootDir = tempRunnerRoot();
  const summaryPath = failureSummaryPath(rootDir);
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, '{"stale":true}\n', 'utf8');
  writePassingTest(rootDir);

  const result = spawnSync('node', [runTestsScript], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      TS_QUALITY_TEST_RUNNER_ROOT: rootDir,
      TS_QUALITY_TEST_RUNNER_SKIP_BUILD: '1'
    }
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(summaryPath), false, 'expected passing run to clear stale failure summary artifacts');
});
