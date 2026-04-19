import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import test from 'node:test';
import assert from 'assert/strict';
import { latestRunId, repoRoot, tempCopyOfFixture } from './helpers.mjs';

const cli = path.join(repoRoot, 'dist', 'packages', 'ts-quality', 'src', 'cli.js');

test('concise operator outputs keep stable provenance framing', () => {
  const target = tempCopyOfFixture('governed-app');
  const check = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(check.status, 0);
  const runId = latestRunId(target);
  const base = path.join(target, '.ts-quality', 'runs', runId);
  const summary = fs.readFileSync(path.join(base, 'pr-summary.md'), 'utf8');
  const checkSummary = fs.readFileSync(path.join(base, 'check-summary.txt'), 'utf8');
  const plan = fs.readFileSync(path.join(base, 'plan.txt'), 'utf8');
  const govern = fs.readFileSync(path.join(base, 'govern.txt'), 'utf8');
  const expectedCheckSummary = fs.readFileSync(path.join(repoRoot, 'examples', 'artifacts', 'governed-app', 'check-summary.txt'), 'utf8');
  assert.match(summary, /^---\nsummary:/);
  assert.match(summary, /Merge confidence: \*\*[0-9]+\/100\*\*/);
  assert.match(summary, /Best next action:/);
  assert.match(summary, /Surviving mutants:/);
  assert.match(summary, /Evidence provenance: explicit [0-9]+, inferred [0-9]+, missing [0-9]+/);
  assert.match(summary, /focused-test-alignment \[clear; mode=inferred\]: 1 focused test file aligned to invariant scope/);
  assert.match(summary, /scenario-support \[missing; mode=missing\]: 0\/1 scenario\(s\) have deterministic support/);
  assert.match(checkSummary, /^Merge confidence: [0-9]+\/100/);
  assert.match(checkSummary, /Best next action:/);
  assert.match(checkSummary, /Invariant evidence at risk: auth\.refresh\.validity/);
  assert.match(checkSummary, /Evidence provenance: explicit [0-9]+, inferred [0-9]+, missing [0-9]+/);
  assert.match(checkSummary, /scenario-support \[missing; mode=missing\]: 0\/1 scenario\(s\) have deterministic support/);
  assert.doesNotMatch(checkSummary, /^Obligation:/m);
  assert.equal(checkSummary, expectedCheckSummary);
  assert.match(plan, /Invariant evidence at risk: auth\.refresh\.validity/);
  assert.match(plan, /Evidence provenance: explicit [0-9]+, inferred [0-9]+, missing [0-9]+/);
  assert.match(plan, /mutation-pressure \[warning; mode=explicit\]: [0-9]+ surviving mutants across [0-9]+ mutation sites/);
  assert.match(govern, /Invariant evidence at risk: auth\.refresh\.validity/);
  assert.match(govern, /scenario-support \[missing; mode=missing\]: 0\/1 scenario\(s\) have deterministic support/);
});

test('authorization sample keeps exact run-bound evidence context', () => {
  const target = tempCopyOfFixture('governed-app');
  const check = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'sample-governed-app-run'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const authorize = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'release-bot'], { encoding: 'utf8' });
  assert.equal(authorize.status, 0, authorize.stderr);
  const expected = fs.readFileSync(path.join(repoRoot, 'examples', 'artifacts', 'governed-app', 'authorize.release-bot.json'), 'utf8');
  assert.equal(authorize.stdout, expected.endsWith('\n') ? expected : `${expected}\n`);
});

test('amendment sample keeps exact proposal-context output parity', () => {
  const target = tempCopyOfFixture('governed-app');
  const proposalPath = path.join(target, 'proposal.json');
  fs.writeFileSync(proposalPath, JSON.stringify({
    id: 'sample-amendment',
    title: 'Sample amendment',
    rationale: 'Documented migration window.',
    evidence: ['migration validated'],
    changes: [{
      action: 'replace',
      ruleId: 'auth-risk-budget',
      rule: {
        kind: 'risk',
        id: 'auth-risk-budget',
        paths: ['src/auth/**'],
        message: 'Adjusted sample policy.',
        maxCrap: 20,
        minMutationScore: 0.7,
        minMergeConfidence: 60
      }
    }],
    approvals: [
      { by: 'maintainer', role: 'maintainer', rationale: 'approve', createdAt: '2026-01-01T00:15:00.000Z', targetId: 'sample-amendment' },
      { by: 'maintainer', role: 'maintainer', rationale: 'second recorded approval', createdAt: '2026-01-01T00:15:00.000Z', targetId: 'sample-amendment' }
    ]
  }, null, 2));
  const amend = spawnSync('node', [cli, 'amend', '--root', target, '--proposal', proposalPath], { encoding: 'utf8' });
  assert.equal(amend.status, 0, amend.stderr);
  const expected = fs.readFileSync(path.join(repoRoot, 'examples', 'artifacts', 'governed-app', 'amend.json'), 'utf8');
  const normalizedExpected = expected.endsWith('\n') ? expected : `${expected}\n`;
  assert.equal(amend.stdout, normalizedExpected);
  const persisted = fs.readFileSync(path.join(target, '.ts-quality', 'amendments', 'sample-amendment.result.json'), 'utf8');
  assert.equal(persisted, normalizedExpected);
  const expectedText = fs.readFileSync(path.join(repoRoot, 'examples', 'artifacts', 'governed-app', 'amend.txt'), 'utf8');
  const normalizedExpectedText = expectedText.endsWith('\n') ? expectedText : `${expectedText}\n`;
  const persistedText = fs.readFileSync(path.join(target, '.ts-quality', 'amendments', 'sample-amendment.result.txt'), 'utf8');
  assert.equal(persistedText, normalizedExpectedText);
});

test('attestation verification sample keeps exact signed subject context', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'sample-governed-app-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', '.ts-quality/runs/sample-governed-app-run/verdict.json', '--claims', 'ci.tests.passed', '--out', '.ts-quality/attestations/ci.tests.passed.json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const verify = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/ci.tests.passed.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(verify.status, 0, verify.stderr);
  result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'sample-governed-app-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const runtimeVerify = fs.readFileSync(path.join(target, '.ts-quality', 'runs', 'sample-governed-app-run', 'attestation-verify.txt'), 'utf8');
  const expected = fs.readFileSync(path.join(repoRoot, 'examples', 'artifacts', 'governed-app', 'attestation.verify.txt'), 'utf8');
  const normalizedExpected = expected.endsWith('\n') ? expected : `${expected}\n`;
  assert.equal(verify.stdout, normalizedExpected);
  assert.equal(runtimeVerify, normalizedExpected);
});
