import fs from 'fs';
import path from 'path';
import test from 'node:test';
import assert from 'assert/strict';
import { spawnSync } from 'child_process';
import { distModule, tempCopyOfFixture } from './helpers.mjs';

const cli = distModule('packages', 'ts-quality', 'src', 'cli.js');
const runId = 'auth-token-first-slice';

function runCli(args, cwd) {
  return spawnSync('node', [cli, ...args], { cwd, encoding: 'utf8' });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeWeakBoundaryTest(target) {
  fs.writeFileSync(path.join(target, 'test', 'token.test.js'), `const assert = require('node:assert/strict');
const { isRefreshExpired, canRefresh } = require('../src/auth/token.js');

const token = { expiresAtMs: 1000 };
assert.equal(canRefresh(token, 999), true, 'active token before expiry allows access');
assert.equal(isRefreshExpired(token, 1001), true, 'expired token denies access after boundary');
`, 'utf8');
}

test('minimal external adoption fixture executes doctor -> witness -> check -> report/explain -> retention', () => {
  const target = tempCopyOfFixture('minimal-external-adoption');

  const doctor = runCli(['doctor', '--root', target, '--config', 'ts-quality.config.json', '--machine', '--changed', 'src/auth/token.js'], target);
  assert.equal(doctor.status, 0, doctor.stderr);
  assert.match(doctor.stdout, /^TSQ_DOCTOR_MACHINE_V1\n/);
  assert.match(doctor.stdout, /changed\tok\tfiles=src\/auth\/token\.js/);
  assert.match(doctor.stdout, /command_arg=ts-quality\tcommand_arg=witness\tcommand_arg=test/);

  const witness = runCli([
    'witness', 'test',
    '--root', target,
    '--invariant', 'auth.refresh.validity',
    '--scenario', 'expired-boundary',
    '--source-files', 'src/auth/token.js',
    '--test-files', 'test/token.test.js',
    '--out', '.ts-quality/witnesses/auth-refresh-expired-boundary.json',
    '--', 'node', '--test', 'test/token.test.js'
  ], target);
  assert.equal(witness.status, 0, witness.stderr);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'witnesses', 'auth-refresh-expired-boundary.json')), true);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'witnesses', 'auth-refresh-expired-boundary.receipt.json')), true);

  const check = runCli(['check', '--root', target, '--config', 'ts-quality.config.json', '--changed', 'src/auth/token.js', '--run-id', runId], target);
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /Outcome: pass/);

  const run = readJson(path.join(target, '.ts-quality', 'runs', runId, 'run.json'));
  assert.deepEqual(run.changedFiles, ['src/auth/token.js']);
  assert.equal(run.executionWitnesses, undefined, 'manual witness should be consumed without needing scenario-configured auto-run duplication');
  assert.equal(run.behaviorClaims[0]?.evidenceSummary?.scenarioResults[0]?.supportKind, 'execution-witness');
  assert.deepEqual(run.behaviorClaims[0]?.evidenceSummary?.executionWitnessFiles, ['.ts-quality/witnesses/auth-refresh-expired-boundary.json']);
  assert.equal(run.verdict.outcome, 'pass');

  const report = runCli(['report', '--root', target, '--run-id', runId], target);
  assert.equal(report.status, 0, report.stderr);
  assert.match(report.stdout, /# ts-quality report/);

  const explain = runCli(['explain', '--root', target, '--run-id', runId], target);
  assert.equal(explain.status, 0, explain.stderr);
  assert.match(explain.stdout, /scenario results: expired-boundary=execution-backed witness matched/);

  const retention = runCli(['retention', '--root', target, '--config', 'ts-quality.config.json', '--machine'], target);
  assert.equal(retention.status, 0, retention.stderr);
  assert.match(retention.stdout, /^TSQ_RETENTION_PLAN_V1\n/);
  assert.match(retention.stdout, /keep\tpresent\tts-quality\.config\.json\treason=ts-quality configuration/);
  assert.match(retention.stdout, /keep\tpresent\t\.ts-quality\/witnesses\/auth-refresh-expired-boundary\.json\treason=execution witness record/);
  assert.match(retention.stdout, /ignore\tpattern\t\.ts-quality\/runs\/\treason=generated immutable run bundles/);
  assert.match(retention.stdout, /ignore\tpresent\tcoverage\/lcov\.info\treason=generated LCOV output/);
});

test('minimal external adoption fixture preserves truthful mutation-survivor failure despite coverage and witness evidence', () => {
  const target = tempCopyOfFixture('minimal-external-adoption');
  writeWeakBoundaryTest(target);

  const witness = runCli([
    'witness', 'test',
    '--root', target,
    '--invariant', 'auth.refresh.validity',
    '--scenario', 'expired-boundary',
    '--source-files', 'src/auth/token.js',
    '--test-files', 'test/token.test.js',
    '--out', '.ts-quality/witnesses/auth-refresh-expired-boundary.json',
    '--', 'node', '--test', 'test/token.test.js'
  ], target);
  assert.equal(witness.status, 0, witness.stderr);

  const check = runCli(['check', '--root', target, '--config', 'ts-quality.config.json', '--changed', 'src/auth/token.js', '--run-id', 'auth-token-weak-boundary'], target);
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /Outcome: fail/);
  assert.match(check.stdout, /Evidence closure: Tighten focused assertions/);
  assert.match(check.stdout, /Coverage basis: 1 file\(s\), changed-function min 100%/);
  assert.match(check.stdout, /Mutation basis: 0 killed \/ 1 site\(s\), 1 survived/);

  const run = readJson(path.join(target, '.ts-quality', 'runs', 'auth-token-weak-boundary', 'run.json'));
  assert.equal(run.behaviorClaims[0]?.evidenceSummary?.scenarioResults[0]?.supportKind, 'execution-witness');
  assert.equal(run.coverage[0]?.pct, 100);
  assert.deepEqual(run.mutations.map((mutation) => ({ status: mutation.status, original: mutation.original, replacement: mutation.replacement })), [{
    status: 'survived',
    original: '>=',
    replacement: '>'
  }]);
  assert.equal(run.nextEvidenceAction?.primaryAction.kind, 'mutation-survivors');
  assert.deepEqual(run.nextEvidenceAction?.primaryAction.suggestedEditFiles, ['test/token.test.js']);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'runs', 'auth-token-weak-boundary', 'mutation-remediation.json')), true);
});
