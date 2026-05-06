import fs from 'fs';
import path from 'path';
import test from 'node:test';
import assert from 'assert/strict';
import { spawnSync } from 'child_process';
import { distModule, tempCopyOfFixture } from './helpers.mjs';

const cli = distModule('packages', 'ts-quality', 'src', 'cli.js');
const runId = 'complex-ts-monorepo-fixture';

function runCli(args) {
  return spawnSync('node', [cli, ...args], { encoding: 'utf8' });
}

function readRun(rootDir) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, '.ts-quality', 'runs', runId, 'run.json'), 'utf8'));
}

test('complex TypeScript monorepo fixture proves source-map LCOV, hunk scope, package attribution, runtime mirrors, and witness refresh', () => {
  const target = tempCopyOfFixture('complex-ts-monorepo');
  const check = runCli(['check', '--root', target, '--run-id', runId]);
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /Outcome: pass/);
  assert.match(check.stdout, /Execution witnesses: auto-ran 1, skipped 0/);

  const run = readRun(target);
  assert.deepEqual(run.changedFiles, ['packages/api/src/token.ts']);
  assert.deepEqual(run.changedRegions, [{
    filePath: 'packages/api/src/token.ts',
    hunkId: 'hunk-0',
    span: { startLine: 6, endLine: 7 }
  }]);
  assert.deepEqual(run.analysis?.runtimeMirrorRoots, ['dist']);
  assert.equal(run.analysis?.coverageLcovPath, 'coverage/api-token.lcov.info');

  assert.deepEqual(run.coverage.map((entry) => entry.filePath), ['packages/api/src/token.ts']);
  assert.equal(run.coverage.some((entry) => entry.filePath.includes('/dist/')), false);

  const sourceFile = run.files.find((file) => file.filePath === 'packages/api/src/token.ts');
  assert.equal(sourceFile?.packageName, '@fixture/api');
  assert.equal(run.repo.packages.some((item) => item.name === '@fixture/api' && item.dir === 'packages/api'), true);

  assert.equal(run.mutationBaseline?.status, 'pass');
  assert.deepEqual(run.mutations.map((mutation) => ({
    filePath: mutation.filePath,
    status: mutation.status,
    original: mutation.original,
    replacement: mutation.replacement,
    testCommand: mutation.testCommand
  })), [{
    filePath: 'packages/api/src/token.ts',
    status: 'killed',
    original: '>=',
    replacement: '>',
    testCommand: ['node', 'packages/api/test/token.test.js']
  }]);

  assert.equal(run.executionWitnesses?.autoRan.length, 1);
  assert.deepEqual(run.executionWitnesses?.autoRan[0]?.sourceFiles, ['packages/api/src/token.ts']);
  assert.deepEqual(run.executionWitnesses?.autoRan[0]?.testFiles, ['packages/api/test/token.test.js']);
  assert.equal(run.behaviorClaims[0]?.evidenceSummary?.scenarioResults[0]?.supportKind, 'execution-witness');
  assert.equal(run.nextEvidenceAction?.primaryAction.kind, 'none');
  assert.equal(run.verdict.outcome, 'pass');

  const report = runCli(['report', '--root', target, '--json', '--run-id', runId]);
  assert.equal(report.status, 0, report.stderr);
  assert.equal(JSON.parse(report.stdout).runId, runId);

  const explain = runCli(['explain', '--root', target, '--run-id', runId]);
  assert.equal(explain.status, 0, explain.stderr);
  assert.match(explain.stdout, /evidence semantics: execution-backed witness artifacts matched/);

  const govern = runCli(['govern', '--root', target, '--run-id', runId]);
  assert.equal(govern.status, 0, govern.stderr);
  assert.match(govern.stdout, /Generated 1 governance step\(s\) from 0 finding\(s\)/);
});
