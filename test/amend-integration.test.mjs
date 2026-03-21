import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import test from 'node:test';
import assert from 'assert/strict';
import { repoRoot, tempCopyOfFixture } from './helpers.mjs';

const cli = path.join(repoRoot, 'dist', 'packages', 'ts-quality', 'src', 'cli.js');

test('amend evaluates sensitive proposal with duplicate approvals as needing more approval', () => {
  const target = tempCopyOfFixture('governed-app');
  const proposalPath = path.join(target, 'proposal.json');
  fs.writeFileSync(proposalPath, JSON.stringify({
    id: 'amend-auth-risk',
    title: 'Tune auth risk budget',
    rationale: 'Need a temporary policy adjustment during migration.',
    evidence: ['migration plan approved'],
    changes: [{
      action: 'replace',
      ruleId: 'auth-risk-budget',
      rule: {
        kind: 'risk',
        id: 'auth-risk-budget',
        paths: ['src/auth/**'],
        message: 'Adjusted during migration window.',
        maxCrap: 20,
        minMutationScore: 0.7,
        minMergeConfidence: 60
      }
    }],
    approvals: [
      { by: 'maintainer', role: 'maintainer', rationale: 'ok', createdAt: new Date().toISOString(), targetId: 'amend-auth-risk' },
      { by: 'maintainer', role: 'maintainer', rationale: 'duplicate fixture approval', createdAt: new Date().toISOString(), targetId: 'amend-auth-risk' }
    ]
  }, null, 2));
  const result = spawnSync('node', [cli, 'amend', '--root', target, '--proposal', proposalPath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.outcome, 'needs-approvals');
});

test('amend --apply writes a loadable constitution module', () => {
  const target = tempCopyOfFixture('governed-app');
  const proposalPath = path.join(target, 'proposal-apply.json');
  fs.writeFileSync(proposalPath, JSON.stringify({
    id: 'amend-payments-approval-message',
    title: 'Clarify payment approval wording',
    rationale: 'Non-sensitive wording update.',
    evidence: ['docs updated'],
    changes: [{
      action: 'replace',
      ruleId: 'payments-maintainer-approval',
      rule: {
        kind: 'approval',
        id: 'payments-maintainer-approval',
        paths: ['src/payments/**'],
        message: 'Payment changes require explicit maintainer review.',
        minApprovals: 1,
        roles: ['maintainer']
      }
    }],
    approvals: [
      { by: 'maintainer', role: 'maintainer', rationale: 'wording ok', createdAt: new Date().toISOString(), targetId: 'amend-payments-approval-message' }
    ]
  }, null, 2));

  let result = spawnSync('node', [cli, 'amend', '--root', target, '--proposal', proposalPath, '--apply'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.outcome, 'approved');
  const constitutionText = fs.readFileSync(path.join(target, '.ts-quality', 'constitution.ts'), 'utf8');
  assert.match(constitutionText, /export default/);
  result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('amend --apply preserves json constitution format when configured', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.rmSync(path.join(target, 'ts-quality.config.ts'), { force: true });
  fs.writeFileSync(path.join(target, 'ts-quality.config.json'), JSON.stringify({
    sourcePatterns: ['src/**/*.js'],
    testPatterns: ['test/**/*.js'],
    coverage: { lcovPath: 'coverage/lcov.info' },
    mutations: { testCommand: ['node', '--test'], coveredOnly: true, timeoutMs: 10000, maxSites: 4 },
    policy: { maxChangedCrap: 30, minMutationScore: 0.5, minMergeConfidence: 50 },
    changeSet: { files: ['src/auth/token.js'] },
    invariantsPath: '.ts-quality/invariants.ts',
    constitutionPath: '.ts-quality/constitution.json',
    agentsPath: '.ts-quality/agents.ts',
    approvalsPath: '.ts-quality/approvals.json',
    waiversPath: '.ts-quality/waivers.json',
    overridesPath: '.ts-quality/overrides.json',
    attestationsDir: '.ts-quality/attestations',
    trustedKeysDir: '.ts-quality/keys'
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(target, '.ts-quality', 'constitution.json'), JSON.stringify([
    {
      kind: 'approval',
      id: 'payments-maintainer-approval',
      paths: ['src/payments/**'],
      message: 'Payments changes require a maintainer approval.',
      minApprovals: 1,
      roles: ['maintainer']
    }
  ], null, 2), 'utf8');

  const proposalPath = path.join(target, 'proposal-json-apply.json');
  fs.writeFileSync(proposalPath, JSON.stringify({
    id: 'amend-payments-approval-json',
    title: 'Clarify payment approval wording in json constitution',
    rationale: 'Non-sensitive wording update.',
    evidence: ['docs updated'],
    changes: [{
      action: 'replace',
      ruleId: 'payments-maintainer-approval',
      rule: {
        kind: 'approval',
        id: 'payments-maintainer-approval',
        paths: ['src/payments/**'],
        message: 'Payment changes require explicit maintainer review.',
        minApprovals: 1,
        roles: ['maintainer']
      }
    }],
    approvals: [
      { by: 'maintainer', role: 'maintainer', rationale: 'wording ok', createdAt: new Date().toISOString(), targetId: 'amend-payments-approval-json' }
    ]
  }, null, 2));

  let result = spawnSync('node', [cli, 'amend', '--root', target, '--proposal', proposalPath, '--apply'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const constitutionText = fs.readFileSync(path.join(target, '.ts-quality', 'constitution.json'), 'utf8');
  assert.doesNotMatch(constitutionText, /export default/);
  assert.equal(Array.isArray(JSON.parse(constitutionText)), true);
  result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('amend --apply preserves commonjs constitution modules when configured', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.writeFileSync(path.join(target, 'ts-quality.config.ts'), `export default {
  sourcePatterns: ['src/**/*.js'],
  testPatterns: ['test/**/*.js'],
  coverage: { lcovPath: 'coverage/lcov.info' },
  mutations: { testCommand: ['node', '--test'], coveredOnly: true, timeoutMs: 10000, maxSites: 4 },
  policy: { maxChangedCrap: 30, minMutationScore: 0.5, minMergeConfidence: 50 },
  changeSet: { files: ['src/auth/token.js'] },
  invariantsPath: '.ts-quality/invariants.ts',
  constitutionPath: '.ts-quality/constitution.cjs',
  agentsPath: '.ts-quality/agents.ts',
  approvalsPath: '.ts-quality/approvals.json',
  waiversPath: '.ts-quality/waivers.json',
  overridesPath: '.ts-quality/overrides.json',
  attestationsDir: '.ts-quality/attestations',
  trustedKeysDir: '.ts-quality/keys'
};
`, 'utf8');
  fs.writeFileSync(path.join(target, '.ts-quality', 'constitution.cjs'), `module.exports = [
  {
    kind: 'approval',
    id: 'payments-maintainer-approval',
    paths: ['src/payments/**'],
    message: 'Payments changes require a maintainer approval.',
    minApprovals: 1,
    roles: ['maintainer']
  }
];
`, 'utf8');

  const proposalPath = path.join(target, 'proposal-cjs-apply.json');
  fs.writeFileSync(proposalPath, JSON.stringify({
    id: 'amend-payments-approval-cjs',
    title: 'Clarify payment approval wording in cjs constitution',
    rationale: 'Non-sensitive wording update.',
    evidence: ['docs updated'],
    changes: [{
      action: 'replace',
      ruleId: 'payments-maintainer-approval',
      rule: {
        kind: 'approval',
        id: 'payments-maintainer-approval',
        paths: ['src/payments/**'],
        message: 'Payment changes require explicit maintainer review.',
        minApprovals: 1,
        roles: ['maintainer']
      }
    }],
    approvals: [
      { by: 'maintainer', role: 'maintainer', rationale: 'wording ok', createdAt: new Date().toISOString(), targetId: 'amend-payments-approval-cjs' }
    ]
  }, null, 2));

  let result = spawnSync('node', [cli, 'amend', '--root', target, '--proposal', proposalPath, '--apply'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const constitutionText = fs.readFileSync(path.join(target, '.ts-quality', 'constitution.cjs'), 'utf8');
  assert.match(constitutionText, /^module\.exports = /);
  assert.doesNotMatch(constitutionText, /export default/);
  result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('amend denies invalid action values instead of silently ignoring them', () => {
  const target = tempCopyOfFixture('governed-app');
  const proposalPath = path.join(target, 'proposal-invalid-action.json');
  const before = fs.readFileSync(path.join(target, '.ts-quality', 'constitution.ts'), 'utf8');
  fs.writeFileSync(proposalPath, JSON.stringify({
    id: 'amend-invalid-action',
    title: 'Use an invalid amendment action',
    rationale: 'adversarial regression',
    evidence: ['validated'],
    changes: [{
      action: 'rename',
      ruleId: 'payments-maintainer-approval',
      rule: {
        kind: 'approval',
        id: 'payments-maintainer-approval',
        paths: ['src/payments/**'],
        message: 'Invalid action should be rejected.',
        minApprovals: 1,
        roles: ['maintainer']
      }
    }],
    approvals: [
      { by: 'maintainer', role: 'maintainer', rationale: 'reject invalid action', createdAt: new Date().toISOString(), targetId: 'amend-invalid-action' }
    ]
  }, null, 2));

  const result = spawnSync('node', [cli, 'amend', '--root', target, '--proposal', proposalPath, '--apply'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.outcome, 'denied');
  assert.match(parsed.reasons[0], /invalid action rename/);
  assert.equal(fs.readFileSync(path.join(target, '.ts-quality', 'constitution.ts'), 'utf8'), before);
});

test('amend denies duplicate constitution rule ids instead of silently applying them', () => {
  const target = tempCopyOfFixture('governed-app');
  const proposalPath = path.join(target, 'proposal-duplicate-id.json');
  const before = fs.readFileSync(path.join(target, '.ts-quality', 'constitution.ts'), 'utf8');
  fs.writeFileSync(proposalPath, JSON.stringify({
    id: 'amend-duplicate-rule-id',
    title: 'Introduce duplicate rule id',
    rationale: 'adversarial regression',
    evidence: ['validated'],
    changes: [{
      action: 'add',
      ruleId: 'payments-maintainer-approval',
      rule: {
        kind: 'approval',
        id: 'payments-maintainer-approval',
        paths: ['src/payments/**'],
        message: 'Duplicate rule id should be rejected.',
        minApprovals: 2,
        roles: ['maintainer']
      }
    }],
    approvals: [
      { by: 'maintainer', role: 'maintainer', rationale: 'reject duplicate ids', createdAt: new Date().toISOString(), targetId: 'amend-duplicate-rule-id' }
    ]
  }, null, 2));

  const result = spawnSync('node', [cli, 'amend', '--root', target, '--proposal', proposalPath, '--apply'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.outcome, 'denied');
  assert.match(parsed.reasons[0], /duplicate constitution rule id/);
  assert.equal(fs.readFileSync(path.join(target, '.ts-quality', 'constitution.ts'), 'utf8'), before);
});

test('amend denies replace operations that target no existing rule', () => {
  const target = tempCopyOfFixture('governed-app');
  const proposalPath = path.join(target, 'proposal-missing-rule.json');
  const before = fs.readFileSync(path.join(target, '.ts-quality', 'constitution.ts'), 'utf8');
  fs.writeFileSync(proposalPath, JSON.stringify({
    id: 'amend-missing-rule',
    title: 'Replace missing rule',
    rationale: 'adversarial regression',
    evidence: ['validated'],
    changes: [{
      action: 'replace',
      ruleId: 'missing-rule',
      rule: {
        kind: 'approval',
        id: 'missing-rule',
        paths: ['src/payments/**'],
        message: 'Missing rule should not be replaceable.',
        minApprovals: 1,
        roles: ['maintainer']
      }
    }],
    approvals: [
      { by: 'maintainer', role: 'maintainer', rationale: 'reject missing targets', createdAt: new Date().toISOString(), targetId: 'amend-missing-rule' }
    ]
  }, null, 2));

  const result = spawnSync('node', [cli, 'amend', '--root', target, '--proposal', proposalPath, '--apply'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.outcome, 'denied');
  assert.match(parsed.reasons[0], /targets no existing constitution rule/);
  assert.equal(fs.readFileSync(path.join(target, '.ts-quality', 'constitution.ts'), 'utf8'), before);
});
