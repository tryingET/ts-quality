import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import test from 'node:test';
import assert from 'assert/strict';
import { repoRoot, tempCopyOfFixture } from './helpers.mjs';

// CLI integration: strict option parsing, attestation key generation and execution witness commands.

const cli = path.join(repoRoot, 'dist', 'packages', 'ts-quality', 'src', 'cli.js');

test('check rejects missing values for value options instead of silently continuing', () => {
  const target = tempCopyOfFixture('governed-app');
  const result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', '--changed', 'src/auth/token.js'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^--run-id requires a value\n$/);
});

test('check rejects duplicate value options instead of silently taking the last root', () => {
  const target = tempCopyOfFixture('governed-app');
  const result = spawnSync('node', [cli, 'check', '--root', target, '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^--root may only be specified once\n$/);
});

test('check rejects repeated --changed instead of treating it as a multi-file list', () => {
  const target = tempCopyOfFixture('governed-app');
  const result = spawnSync('node', [cli, 'check', '--root', target, '--changed', 'src/auth/token.js', '--changed', 'src/auth/other.js'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^--changed may only be specified once\n$/);
});

test('retention rejects --json because machine-readable modes are command-specific', () => {
  const target = tempCopyOfFixture('governed-app');
  const result = spawnSync('node', [cli, 'retention', '--root', target, '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^unexpected option --json for retention\n$/);
});

test('authorize rejects duplicate agent options instead of silently taking the last value', () => {
  const target = tempCopyOfFixture('governed-app');
  const result = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'release-bot', '--agent', 'maintainer'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^--agent may only be specified once\n$/);
});

test('attest verify rejects duplicate attestation options instead of silently taking the last value', () => {
  const target = tempCopyOfFixture('governed-app');
  const result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation=.ts-quality/attestations/first.json', '--attestation', '.ts-quality/attestations/second.json'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^--attestation may only be specified once\n$/);
});

test('attest keygen creates a usable key pair and reports exact output paths', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'generated-key-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const generatedDir = path.join(target, '.ts-quality', 'generated-keys');
  const privateKeyPath = path.join(generatedDir, 'generated.pem');
  const publicKeyPath = path.join(generatedDir, 'generated.pub.pem');
  result = spawnSync('node', [cli, 'attest', 'keygen', '--root', target, '--out-dir', '.ts-quality/generated-keys', '--key-id', 'generated'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${privateKeyPath}\n${publicKeyPath}\n`);
  assert.equal(fs.existsSync(privateKeyPath), true);
  assert.equal(fs.existsSync(publicKeyPath), true);

  result = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.generated', '--key-id', 'generated', '--private-key', '.ts-quality/generated-keys/generated.pem', '--subject', '.ts-quality/runs/generated-key-run/verdict.json', '--claims', 'ci.tests.passed', '--out', '.ts-quality/attestations/generated.json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/generated.json', '--trusted-keys', '.ts-quality/generated-keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ci\.generated: verified \(verified\)$/m);
  assert.match(result.stdout, /^Subject: \.ts-quality\/runs\/generated-key-run\/verdict\.json$/m);
  assert.match(result.stdout, /^Run: generated-key-run$/m);
  assert.match(result.stdout, /^Artifact: verdict\.json$/m);
});

test('witness test --help renders first-witness habit guidance', () => {
  const result = spawnSync('node', [cli, 'witness', 'test', '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: ts-quality witness test/);
  assert.match(result.stdout, /lexical invariant match should graduate to execution-backed support/);
  assert.match(result.stdout, /Choosing the command after --:/);
  assert.match(result.stdout, /Start from the changed source file and the focused test file/);
  assert.match(result.stdout, /Use a repo-global npm test only as baseline evidence/);
  assert.match(result.stdout, /one invariant, one scenario, one changed behavior/);
  assert.match(result.stdout, /put the exact proof command in package\.json/);
  assert.equal(result.stderr, '');
});

test('witness refresh runs configured impacted witness commands and reports scope skips', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.writeFileSync(path.join(target, '.ts-quality', 'invariants.ts'), `export default [
  {
    id: 'auth.refresh.validity',
    title: 'Refresh token validity',
    description: 'Expired refresh tokens must never authorize access.',
    severity: 'high',
    selectors: ['path:src/auth/**', 'symbol:isRefreshExpired'],
    scenarios: [
      {
        id: 'expired-boundary',
        description: 'exact expiry boundary denies access',
        keywords: ['active token before expiry allows access'],
        failurePathKeywords: ['exact expiry boundary denies access'],
        executionWitnessCommand: ['node', '--test', 'test/token.test.js'],
        executionWitnessOutput: '.ts-quality/witnesses/auth-refresh-expired-boundary.json',
        executionWitnessTestFiles: ['test/token.test.js'],
        executionWitnessTimeoutMs: 5000,
        expected: 'deny'
      }
    ]
  },
  {
    id: 'payments.exactly-once',
    title: 'Payment recording is effectively exactly once',
    description: 'Duplicate payment ids must not be recorded twice.',
    severity: 'critical',
    selectors: ['path:src/payments/**'],
    scenarios: [
      {
        id: 'duplicate-payment',
        description: 'duplicate payment id returns duplicate',
        keywords: ['duplicate payment id returns duplicate'],
        executionWitnessCommand: ['node', '--test', 'test/token.test.js'],
        executionWitnessOutput: '.ts-quality/witnesses/payments-duplicate.json',
        executionWitnessTestFiles: ['test/token.test.js'],
        executionWitnessTimeoutMs: 5000,
        expected: 'duplicate'
      }
    ]
  }
];
`, 'utf8');

  const result = spawnSync('node', [cli, 'witness', 'refresh', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /auth\.refresh\.validity:expired-boundary -> .*auth-refresh-expired-boundary\.json \(pass; receipt=.*auth-refresh-expired-boundary\.receipt\.json\)/);
  assert.match(result.stdout, /skipped payments\.exactly-once:duplicate-payment -> \.ts-quality\/witnesses\/payments-duplicate\.json \(invariant not impacted by changed scope\)/);
  const witness = JSON.parse(fs.readFileSync(path.join(target, '.ts-quality', 'witnesses', 'auth-refresh-expired-boundary.json'), 'utf8'));
  assert.equal(witness.status, 'pass');
  assert.equal(witness.invariantId, 'auth.refresh.validity');
  assert.equal(witness.scenarioId, 'expired-boundary');
  const receipt = JSON.parse(fs.readFileSync(path.join(target, '.ts-quality', 'witnesses', 'auth-refresh-expired-boundary.receipt.json'), 'utf8'));
  assert.equal(receipt.kind, 'execution-witness-receipt');
  assert.equal(receipt.receipt.status, 'pass');
  assert.equal(receipt.witnessPath, '.ts-quality/witnesses/auth-refresh-expired-boundary.json');
});

test('witness test writes a pass execution witness from a passing runtime proof command', () => {
  const target = tempCopyOfFixture('governed-app');
  const out = '.ts-quality/witnesses/auth-refresh-expired-boundary.json';
  const result = spawnSync('node', [
    cli,
    'witness',
    'test',
    '--root', target,
    '--invariant', 'auth.refresh.validity',
    '--scenario', 'expired-boundary',
    '--source-files', 'src/auth/token.js',
    '--test-files', 'test/token.test.js',
    '--out', out,
    '--',
    'node', '--test', 'test/token.test.js'
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Wrote execution witness:/);
  assert.match(result.stdout, /Receipt: .*auth-refresh-expired-boundary\.receipt\.json/);
  assert.match(result.stdout, /Status: pass/);
  const witness = JSON.parse(fs.readFileSync(path.join(target, out), 'utf8'));
  assert.equal(witness.kind, 'execution-witness');
  assert.equal(witness.invariantId, 'auth.refresh.validity');
  assert.equal(witness.scenarioId, 'expired-boundary');
  assert.equal(witness.status, 'pass');
  assert.deepEqual(witness.sourceFiles, ['src/auth/token.js']);
  assert.deepEqual(witness.testFiles, ['test/token.test.js']);
  const receipt = JSON.parse(fs.readFileSync(path.join(target, '.ts-quality', 'witnesses', 'auth-refresh-expired-boundary.receipt.json'), 'utf8'));
  assert.equal(receipt.kind, 'execution-witness-receipt');
  assert.equal(receipt.receipt.status, 'pass');
  assert.deepEqual(receipt.command, ['node', '--test', 'test/token.test.js']);
});

test('check consumes manual execution witnesses from the default witness directory', () => {
  const target = tempCopyOfFixture('governed-app');
  const out = '.ts-quality/witnesses/auth-refresh-expired-boundary.json';
  const witness = spawnSync('node', [
    cli,
    'witness',
    'test',
    '--root', target,
    '--invariant', 'auth.refresh.validity',
    '--scenario', 'expired-boundary',
    '--source-files', 'src/auth/token.js',
    '--test-files', 'test/token.test.js',
    '--out', out,
    '--',
    'node', '--test', 'test/token.test.js'
  ], { encoding: 'utf8' });
  assert.equal(witness.status, 0, witness.stderr);

  const check = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'manual-witness-consumed'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const run = JSON.parse(fs.readFileSync(path.join(target, '.ts-quality', 'runs', 'manual-witness-consumed', 'run.json'), 'utf8'));
  const claim = run.behaviorClaims.find((item) => item.invariantId === 'auth.refresh.validity');
  assert.ok(claim);
  assert.equal(claim.evidenceSummary.evidenceSemantics, 'execution-backed');
  assert.deepEqual(claim.evidenceSummary.executionWitnessFiles, [out]);
  assert.equal(claim.evidenceSummary.scenarioResults[0].supportKind, 'execution-witness');
  assert.equal(run.nextEvidenceAction.evidenceBasis.witness.status, 'execution-backed');
  assert.equal(run.executionWitnesses, undefined);
  const checkSummaryText = fs.readFileSync(path.join(target, '.ts-quality', 'runs', 'manual-witness-consumed', 'check-summary.txt'), 'utf8');
  assert.match(checkSummaryText, /Execution witness is present; remaining risk comes from/);
});

test('witness test writes a fail execution witness when the runtime proof command fails', () => {
  const target = tempCopyOfFixture('governed-app');
  const out = '.ts-quality/witnesses/auth-refresh-expired-boundary.fail.json';
  const result = spawnSync('node', [
    cli,
    'witness',
    'test',
    '--root', target,
    '--invariant', 'auth.refresh.validity',
    '--scenario', 'expired-boundary',
    '--source-files', 'src/auth/token.js',
    '--test-files', 'test/token.test.js',
    '--out', out,
    '--',
    'node', '--eval', 'console.error(["first line", "second line"].join(String.fromCharCode(10))); process.exit(2)'
  ], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /execution witness command fail; wrote fail witness to/);
  // Escaped exactly once at the CLI error boundary, never pre-escaped.
  assert.match(result.stderr, /first line\\u000asecond line/);
  assert.doesNotMatch(result.stderr, /\\\\u000a/);
  const witness = JSON.parse(fs.readFileSync(path.join(target, out), 'utf8'));
  assert.equal(witness.status, 'fail');
  assert.equal(witness.invariantId, 'auth.refresh.validity');
  assert.equal(witness.scenarioId, 'expired-boundary');
  const receipt = JSON.parse(fs.readFileSync(path.join(target, '.ts-quality', 'witnesses', 'auth-refresh-expired-boundary.fail.receipt.json'), 'utf8'));
  assert.equal(receipt.kind, 'execution-witness-receipt');
  assert.equal(receipt.receipt.status, 'fail');
});

test('check auto-generates execution witnesses for impacted scenarios with configured witness commands', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.writeFileSync(path.join(target, '.ts-quality', 'invariants.ts'), `export default [
  {
    id: 'auth.refresh.validity',
    title: 'Refresh token validity',
    description: 'Expired refresh tokens must never authorize access.',
    severity: 'high',
    selectors: ['path:src/auth/**', 'symbol:isRefreshExpired'],
    scenarios: [
      {
        id: 'expired-boundary',
        description: 'exact expiry boundary denies access',
        keywords: ['active token before expiry allows access'],
        failurePathKeywords: ['exact expiry boundary denies access'],
        executionWitnessCommand: ['node', '--test', 'test/token.test.js'],
        executionWitnessOutput: '.ts-quality/witnesses/auth-refresh-expired-boundary.json',
        executionWitnessTestFiles: ['test/token.test.js'],
        executionWitnessTimeoutMs: 5000,
        expected: 'deny'
      }
    ]
  }
];
`, 'utf8');

  const check = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'witness-auto-run'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /Execution witnesses: auto-ran 1, skipped 0/);
  const witnessPath = path.join(target, '.ts-quality', 'witnesses', 'auth-refresh-expired-boundary.json');
  assert.equal(fs.existsSync(witnessPath), true);
  const witness = JSON.parse(fs.readFileSync(witnessPath, 'utf8'));
  assert.equal(witness.status, 'pass');
  assert.equal(witness.invariantId, 'auth.refresh.validity');
  assert.equal(witness.scenarioId, 'expired-boundary');
  assert.deepEqual(witness.sourceFiles, ['src/auth/token.js']);
  assert.deepEqual(witness.testFiles, ['test/token.test.js']);
  const receipt = JSON.parse(fs.readFileSync(path.join(target, '.ts-quality', 'witnesses', 'auth-refresh-expired-boundary.receipt.json'), 'utf8'));
  assert.equal(receipt.kind, 'execution-witness-receipt');
  assert.equal(receipt.receipt.status, 'pass');
  const run = JSON.parse(fs.readFileSync(path.join(target, '.ts-quality', 'runs', 'witness-auto-run', 'run.json'), 'utf8'));
  const claim = run.behaviorClaims.find((item) => item.invariantId === 'auth.refresh.validity');
  assert.ok(claim);
  assert.equal(claim.evidenceSummary.evidenceSemantics, 'execution-backed');
  assert.deepEqual(claim.evidenceSummary.executionWitnessFiles, ['.ts-quality/witnesses/auth-refresh-expired-boundary.json']);
  assert.equal(claim.evidenceSummary.scenarioResults[0].supportKind, 'execution-witness');
  assert.match(run.verdict.reasons.join('\n'), /execution-backed invariant\(s\) still carry residual evidence pressure: .*mutation-pressure/);
  assert.doesNotMatch(run.verdict.reasons.join('\n'), /need stronger test evidence or failure-path coverage/);
  assert.equal(run.executionWitnesses.autoRan.length, 1);
  assert.equal(run.executionWitnesses.autoRan[0].receiptPath, '.ts-quality/witnesses/auth-refresh-expired-boundary.receipt.json');
  assert.equal(run.executionWitnesses.autoRan[0].receipt.status, 'pass');
  assert.equal(run.executionWitnesses.skipped.length, 0);
  const checkSummaryText = fs.readFileSync(path.join(target, '.ts-quality', 'runs', 'witness-auto-run', 'check-summary.txt'), 'utf8');
  assert.match(checkSummaryText, /Execution witness is present; remaining risk comes from/);
  const witnessSummaryText = fs.readFileSync(path.join(target, '.ts-quality', 'runs', 'witness-auto-run', 'execution-witnesses.txt'), 'utf8');
  assert.match(witnessSummaryText, /Execution witnesses: auto-ran 1, skipped 0/);
  assert.match(witnessSummaryText, /receipt=\.ts-quality\/witnesses\/auth-refresh-expired-boundary\.receipt\.json/);
  const witnessSummaryJson = JSON.parse(fs.readFileSync(path.join(target, '.ts-quality', 'runs', 'witness-auto-run', 'execution-witnesses.json'), 'utf8'));
  assert.equal(witnessSummaryJson.autoRan[0].receiptPath, '.ts-quality/witnesses/auth-refresh-expired-boundary.receipt.json');
});
