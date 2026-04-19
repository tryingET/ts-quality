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
  assert.deepEqual(denied.evidenceContext.attestationVerification, {
    verifiedCount: 0,
    failedCount: 0,
    records: []
  });
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

test('authorize writes bundle digests that match the run artifact file digests', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const runId = latestRunId(target);
  result = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'release-bot'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const run = readRun(target);
  const bundle = JSON.parse(fs.readFileSync(path.join(target, '.ts-quality', 'runs', runId, 'bundle.release-bot.merge.json'), 'utf8'));
  for (const filePath of run.changedFiles) {
    const runFile = run.files.find((item) => item.filePath === filePath);
    assert.equal(bundle.fileDigests[filePath], runFile?.digest, filePath);
  }
  assert.deepEqual(bundle.attestationVerification, {
    verifiedCount: 0,
    failedCount: 0,
    records: []
  });
});

test('attest sign and verify produce a valid signed claim with exact subject context', () => {
  const target = tempCopyOfFixture('governed-app');
  spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  const runId = latestRunId(target);
  const subject = path.join('.ts-quality', 'runs', runId, 'verdict.json');
  const output = path.join('.ts-quality', 'attestations', 'ci.tests.passed.json');
  const sign = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', subject, '--claims', 'ci.tests.passed', '--out', output], { encoding: 'utf8' });
  assert.equal(sign.status, 0);
  const verify = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', output, '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.match(verify.stdout, /^ci\.verify: verified \(verified\)$/m);
  assert.match(verify.stdout, new RegExp(`^Subject: \\.ts-quality/runs/${runId}/verdict\\.json$`, 'm'));
  assert.match(verify.stdout, new RegExp(`^Run: ${runId}$`, 'm'));
  assert.match(verify.stdout, /^Artifact: verdict\.json$/m);
});


test('attest sign rejects subjects outside the repository root', () => {
  const target = tempCopyOfFixture('governed-app');
  const foreignRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-foreign-subject-'));
  const foreignSubject = path.join(foreignRoot, 'verdict.json');
  fs.writeFileSync(foreignSubject, '{"foreign":true}\n', 'utf8');
  const output = path.join('.ts-quality', 'attestations', 'foreign.json');
  const result = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', foreignSubject, '--claims', 'ci.tests.passed', '--out', output], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /attestation subject must be inside --root/);
});

test('authorize ignores attestations that target an older run', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-attestation-scope-'));
  fs.mkdirSync(path.join(target, 'src'), { recursive: true });
  fs.mkdirSync(path.join(target, 'test'), { recursive: true });
  fs.writeFileSync(path.join(target, 'src', 'math.js'), 'export function add(a, b) { return a + b; }\n', 'utf8');
  fs.writeFileSync(path.join(target, 'test', 'math.test.js'), "import test from 'node:test'; import assert from 'assert/strict'; import { add } from '../src/math.js'; test('add', () => assert.equal(add(1, 2), 3));\n", 'utf8');

  let result = spawnSync('node', [cli, 'init', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  fs.writeFileSync(path.join(target, 'ts-quality.config.ts'), `export default {
  sourcePatterns: ['src/**/*.js'],
  testPatterns: ['test/**/*.js'],
  coverage: { lcovPath: 'coverage/lcov.info' },
  mutations: { testCommand: ['node', '--test'], coveredOnly: false, timeoutMs: 10000, maxSites: 5 },
  policy: { maxChangedCrap: 30, minMutationScore: 0, minMergeConfidence: 0 },
  changeSet: { files: ['src/math.js'] },
  invariantsPath: '.ts-quality/invariants.ts',
  constitutionPath: '.ts-quality/constitution.ts',
  agentsPath: '.ts-quality/agents.ts',
  approvalsPath: '.ts-quality/approvals.json',
  waiversPath: '.ts-quality/waivers.json',
  overridesPath: '.ts-quality/overrides.json',
  attestationsDir: '.ts-quality/attestations',
  trustedKeysDir: '.ts-quality/keys'
};
`, 'utf8');
  fs.writeFileSync(path.join(target, '.ts-quality', 'constitution.ts'), 'export default [];\n', 'utf8');
  fs.writeFileSync(path.join(target, '.ts-quality', 'invariants.ts'), 'export default [];\n', 'utf8');
  fs.writeFileSync(path.join(target, '.ts-quality', 'agents.ts'), `export default [
  {
    id: 'release-bot',
    kind: 'automation',
    roles: ['ci'],
    grants: [
      {
        id: 'release-bot-merge',
        actions: ['merge'],
        paths: ['src/**'],
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

test('authorize accepts rollback evidence that is bound to the exact evaluated run', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-run-bound-rollback-'));
  fs.mkdirSync(path.join(target, 'src'), { recursive: true });
  fs.mkdirSync(path.join(target, 'test'), { recursive: true });
  fs.writeFileSync(path.join(target, 'src', 'flag.js'), 'function isOne(value) { return value === 1; }\nmodule.exports = { isOne };\n', 'utf8');
  fs.writeFileSync(path.join(target, 'test', 'flag.test.js'), "const test = require('node:test'); const assert = require('node:assert/strict'); const { isOne } = require('../src/flag.js'); test('isOne', () => { assert.equal(isOne(1), true); assert.equal(isOne(2), false); });\n", 'utf8');

  let result = spawnSync('node', [cli, 'init', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  fs.writeFileSync(path.join(target, 'ts-quality.config.ts'), `export default {
  sourcePatterns: ['src/**/*.js'],
  testPatterns: ['test/**/*.js'],
  coverage: { lcovPath: 'coverage/lcov.info' },
  mutations: { testCommand: ['node', '--test'], coveredOnly: false, timeoutMs: 10000, maxSites: 5 },
  policy: { maxChangedCrap: 30, minMutationScore: 0, minMergeConfidence: 0 },
  changeSet: { files: ['src/flag.js'] },
  invariantsPath: '.ts-quality/invariants.ts',
  constitutionPath: '.ts-quality/constitution.ts',
  agentsPath: '.ts-quality/agents.ts',
  approvalsPath: '.ts-quality/approvals.json',
  waiversPath: '.ts-quality/waivers.json',
  overridesPath: '.ts-quality/overrides.json',
  attestationsDir: '.ts-quality/attestations',
  trustedKeysDir: '.ts-quality/keys'
};
`, 'utf8');
  fs.writeFileSync(path.join(target, '.ts-quality', 'constitution.ts'), `export default [
  {
    kind: 'rollback',
    id: 'need-ci-proof',
    paths: ['src/**'],
    message: 'Attach CI rollback evidence before merge.',
    requireEvidence: ['ci.tests.passed']
  }
];
`, 'utf8');
  fs.writeFileSync(path.join(target, '.ts-quality', 'invariants.ts'), 'export default [];\n', 'utf8');
  fs.writeFileSync(path.join(target, '.ts-quality', 'agents.ts'), `export default [
  {
    id: 'maintainer',
    kind: 'human',
    roles: ['maintainer'],
    grants: [
      {
        id: 'maintainer-merge',
        actions: ['merge'],
        paths: ['src/**'],
        minMergeConfidence: 0
      }
    ]
  }
];
`, 'utf8');

  result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const runId = latestRunId(target);

  result = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'maintainer'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  let decision = JSON.parse(result.stdout);
  assert.equal(decision.outcome, 'deny');
  assert.match(decision.reasons[0], /Governance violations block authorization/);

  result = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', path.join('.ts-quality', 'runs', runId, 'verdict.json'), '--claims', 'ci.tests.passed', '--out', path.join('.ts-quality', 'attestations', 'ci.tests.passed.json')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  result = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'maintainer'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  decision = JSON.parse(result.stdout);
  assert.equal(decision.outcome, 'approve');
  assert.deepEqual(decision.evidenceContext.governanceErrors, []);
  assert.deepEqual(decision.evidenceContext.attestationVerification, {
    verifiedCount: 1,
    failedCount: 0,
    records: [
      {
        version: '1',
        source: 'ci.tests.passed.json',
        issuer: 'ci.verify',
        ok: true,
        reason: 'verified',
        subjectFile: `.ts-quality/runs/${runId}/verdict.json`,
        runId,
        artifactName: 'verdict.json'
      }
    ]
  });
  const bundle = JSON.parse(fs.readFileSync(path.join(target, '.ts-quality', 'runs', runId, 'bundle.maintainer.merge.json'), 'utf8'));
  assert.deepEqual(bundle.attestationVerification, decision.evidenceContext.attestationVerification);
});

test('authorize denies repository drift after the evaluated run', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-run-drift-'));
  fs.mkdirSync(path.join(target, 'src'), { recursive: true });
  fs.mkdirSync(path.join(target, 'test'), { recursive: true });
  fs.writeFileSync(path.join(target, 'src', 'flag.js'), 'function isOne(value) { return value === 1; }\nmodule.exports = { isOne };\n', 'utf8');
  fs.writeFileSync(path.join(target, 'test', 'flag.test.js'), "const test = require('node:test'); const assert = require('node:assert/strict'); const { isOne } = require('../src/flag.js'); test('isOne', () => { assert.equal(isOne(1), true); assert.equal(isOne(2), false); });\n", 'utf8');
  fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: 'run-drift-test' }, null, 2));
  fs.mkdirSync(path.join(target, '.ts-quality'), { recursive: true });
  fs.writeFileSync(path.join(target, 'ts-quality.config.json'), JSON.stringify({
    sourcePatterns: ['src/**/*.js'],
    testPatterns: ['test/**/*.js'],
    mutations: { testCommand: ['node', '--test'], coveredOnly: false, timeoutMs: 10000, maxSites: 5 },
    changeSet: { files: ['src/flag.js'] },
    invariantsPath: '.ts-quality/invariants.json',
    constitutionPath: '.ts-quality/constitution.json',
    agentsPath: '.ts-quality/agents.json'
  }, null, 2));
  fs.writeFileSync(path.join(target, '.ts-quality', 'invariants.json'), '[]\n', 'utf8');
  fs.writeFileSync(path.join(target, '.ts-quality', 'constitution.json'), '[]\n', 'utf8');
  fs.writeFileSync(path.join(target, '.ts-quality', 'agents.json'), JSON.stringify([
    {
      id: 'maintainer',
      kind: 'human',
      roles: ['maintainer'],
      grants: [
        {
          id: 'maintainer-merge',
          actions: ['merge'],
          paths: ['src/**'],
          minMergeConfidence: 60
        }
      ]
    }
  ], null, 2));

  let result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  fs.writeFileSync(path.join(target, 'src', 'flag.js'), 'function isOne(value) { return value >= 1; }\nmodule.exports = { isOne };\n', 'utf8');

  result = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'maintainer'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const decision = JSON.parse(result.stdout);
  assert.equal(decision.outcome, 'deny');
  assert.match(decision.reasons[0], /Repository changed since run/);
});

test('authorize denies control-plane drift after the evaluated run', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'control-plane-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  fs.writeFileSync(path.join(target, '.ts-quality', 'constitution.ts'), 'export default [];\n', 'utf8');
  fs.writeFileSync(path.join(target, '.ts-quality', 'agents.ts'), `export default [
  {
    id: 'release-bot',
    kind: 'automation',
    roles: ['ci'],
    grants: [
      {
        id: 'release-bot-merge',
        actions: ['merge'],
        paths: ['src/**'],
        minMergeConfidence: 0,
        requireHumanReview: false
      }
    ]
  }
];
`, 'utf8');

  result = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'release-bot'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const decision = JSON.parse(result.stdout);
  assert.equal(decision.outcome, 'deny');
  assert.match(decision.reasons[0], /control plane drifted/);
});

test('authorize denies empty authorization scope instead of matching grants vacuously', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-empty-scope-'));
  let result = spawnSync('node', [cli, 'init', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'maintainer'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const decision = JSON.parse(result.stdout);
  assert.equal(decision.outcome, 'deny');
  assert.match(decision.reasons[0], /No changed files were bound/);
  assert.deepEqual(decision.scope, []);
});
