import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import test from 'node:test';
import assert from 'assert/strict';
import { latestRunId, readRun, repoRoot, tempCopyOfFixture } from './helpers.mjs';

const cli = path.join(repoRoot, 'dist', 'packages', 'ts-quality', 'src', 'cli.js');

test('authorize projects run-bound governance and invariant evidence into the decision artifact', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  result = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'release-bot'], { encoding: 'utf8' });
  const denied = JSON.parse(result.stdout);
  assert.equal(denied.outcome === 'deny' || denied.outcome === 'require-human-approver' || denied.outcome === 'request-more-proof', true);

  const runId = latestRunId(target);
  assert.equal(denied.evidenceContext.runId, runId);
  assert.equal(denied.evidenceContext.artifactPaths.run, `.ts-quality/runs/${runId}/run.json`);
  assert.equal(denied.evidenceContext.artifactPaths.bundle, `.ts-quality/runs/${runId}/bundle.release-bot.merge.json`);
  assert.equal(denied.evidenceContext.governanceErrors.some((item) => item.ruleId === 'auth-risk-budget'), true);
  assert.equal(denied.evidenceContext.riskyInvariant.invariantId, 'auth.refresh.validity');
  assert.deepEqual(denied.evidenceContext.riskyInvariant.evidenceProvenance, { explicit: 3, inferred: 1, missing: 1 });
  assert.equal(denied.evidenceContext.riskyInvariant.signals.some((item) => item.signalId === 'scenario-support' && item.mode === 'missing'), true);

  const overridesPath = path.join(target, '.ts-quality', 'overrides.json');
  fs.writeFileSync(overridesPath, JSON.stringify([
    {
      kind: 'override',
      by: 'maintainer',
      role: 'maintainer',
      rationale: 'Human reviewed and accepts temporary risk for fixture scenario.',
      createdAt: new Date().toISOString(),
      targetId: `${runId}:release-bot:merge`
    }
  ], null, 2));
  result = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'release-bot'], { encoding: 'utf8' });
  const approved = JSON.parse(result.stdout);
  assert.equal(approved.outcome, 'approve');
  assert.equal(approved.overrideUsed, 'maintainer');
  assert.equal(approved.evidenceContext.runId, runId);
  assert.equal(approved.evidenceContext.riskyInvariant.invariantId, 'auth.refresh.validity');
});

test('attest sign and verify produce a valid signed claim', () => {
  const target = tempCopyOfFixture('governed-app');
  spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  const runId = latestRunId(target);
  const subject = path.join('.ts-quality', 'runs', runId, 'verdict.json');
  const output = path.join('.ts-quality', 'attestations', 'ci.tests.passed.json');
  const sign = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', subject, '--claims', 'ci.tests.passed', '--out', output], { encoding: 'utf8' });
  assert.equal(sign.status, 0);
  const verify = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', output, '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.match(verify.stdout, /verified/);
});


test('authorize ignores attestations that target an older run', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-empty-'));
  let result = spawnSync('node', [cli, 'init', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  fs.writeFileSync(path.join(target, '.ts-quality', 'agents.ts'), `export default [
  {
    id: 'release-bot',
    kind: 'automation',
    roles: ['ci'],
    grants: [
      {
        id: 'release-bot-merge',
        actions: ['merge'],
        paths: ['**'],
        minMergeConfidence: 0,
        requireAttestations: ['ci.tests.passed'],
        requireHumanReview: false
      }
    ]
  }
];
`, 'utf8');

  result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const run1 = latestRunId(target);
  const subject = path.join('.ts-quality', 'runs', run1, 'verdict.json');
  const output = path.join('.ts-quality', 'attestations', 'ci.tests.passed.json');
  result = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', subject, '--claims', 'ci.tests.passed', '--out', output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const run2 = latestRunId(target);
  assert.notEqual(run1, run2);

  result = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'release-bot'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const decision = JSON.parse(result.stdout);
  assert.equal(decision.outcome, 'request-more-proof');
  assert.deepEqual(decision.missingProof, ['ci.tests.passed']);
});
