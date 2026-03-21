import test from 'node:test';
import assert from 'assert/strict';
import { importDist } from './helpers.mjs';

const legitimacy = await importDist('packages', 'legitimacy', 'src', 'index.js');

test('signAttestation and verifyAttestation round-trip', () => {
  const pair = legitimacy.generateKeyPair();
  const attestation = legitimacy.signAttestation({
    issuer: 'ci.verify',
    keyId: 'ci.verify',
    privateKeyPem: pair.privateKeyPem,
    subjectType: 'change-bundle',
    subjectDigest: 'sha256:abc',
    claims: ['ci.tests.passed']
  });
  const result = legitimacy.verifyAttestation(attestation, { 'ci.verify': pair.publicKeyPem });
  assert.equal(result.ok, true);
});

test('signAttestation rejects blank, spoofed, or inconsistent rendered metadata', () => {
  const pair = legitimacy.generateKeyPair();
  assert.throws(() => legitimacy.signAttestation({
    issuer: '   ',
    keyId: 'ci.verify',
    privateKeyPem: pair.privateKeyPem,
    subjectType: 'change-bundle',
    subjectDigest: 'sha256:abc',
    claims: ['ci.tests.passed']
  }), /attestation issuer missing/);
  assert.throws(() => legitimacy.signAttestation({
    issuer: 'ci.verify\u200Bshadow',
    keyId: 'ci.verify',
    privateKeyPem: pair.privateKeyPem,
    subjectType: 'change-bundle',
    subjectDigest: 'sha256:abc',
    claims: ['ci.tests.passed']
  }), /attestation issuer contains unsupported control characters/);
  assert.throws(() => legitimacy.signAttestation({
    issuer: 'ci.verify',
    keyId: 'ci.verify',
    privateKeyPem: pair.privateKeyPem,
    subjectType: 'change-bundle',
    subjectDigest: 'sha256:abc',
    claims: ['ci.tests.passed'],
    payload: {
      subjectFile: 'bundle.json\u0085Subject: injected'
    }
  }), /attestation payload subjectFile contains unsupported control characters/);
  assert.throws(() => legitimacy.signAttestation({
    issuer: 'ci.verify',
    keyId: 'ci.verify',
    privateKeyPem: pair.privateKeyPem,
    subjectType: 'change-bundle',
    subjectDigest: 'sha256:abc',
    claims: ['ci.tests.passed'],
    payload: {
      subjectFile: 'bundle.json',
      runId: 'run-1\u202Eevil'
    }
  }), /attestation payload runId contains unsupported control characters/);
  assert.throws(() => legitimacy.signAttestation({
    issuer: 'ci.verify',
    keyId: 'ci.verify',
    privateKeyPem: pair.privateKeyPem,
    subjectType: 'json-artifact',
    subjectDigest: 'sha256:abc',
    claims: ['ci.tests.passed'],
    payload: {
      subjectFile: '.ts-quality/runs/run-a/verdict.json',
      runId: 'run-b',
      artifactName: 'verdict.json'
    }
  }), /attestation payload runId does not match subject path/);
  assert.throws(() => legitimacy.signAttestation({
    issuer: 'ci.verify',
    keyId: 'ci.verify',
    privateKeyPem: pair.privateKeyPem,
    subjectType: 'file',
    subjectDigest: 'sha256:abc',
    claims: ['ci.tests.passed'],
    payload: {
      runId: 'run-a'
    }
  }), /subject file missing from attestation payload/);
});


test('authorizeChange requires override grants to match the overridden scope', () => {
  const decision = legitimacy.authorizeChange(
    'release-bot',
    'merge',
    {
      version: '1',
      kind: 'change-bundle',
      action: 'merge',
      agentId: 'release-bot',
      runId: 'run-1',
      createdAt: new Date().toISOString(),
      changedFiles: ['src/payments/ledger.js'],
      fileDigests: {},
      runDigest: 'sha256:x'
    },
    {
      runId: 'run-1',
      changedFiles: ['src/payments/ledger.js'],
      governance: [],
      verdict: { mergeConfidence: 90 }
    },
    [
      { id: 'release-bot', kind: 'automation', roles: ['ci'], grants: [{ id: 'release', actions: ['merge'], paths: ['src/**'], requireHumanReview: true }] },
      { id: 'security-lead', kind: 'human', roles: ['security'], grants: [{ id: 'security-override', actions: ['override'], paths: ['src/auth/**'] }] }
    ],
    [],
    [],
    [{ kind: 'override', by: 'security-lead', role: 'security', rationale: 'wrong scope', createdAt: new Date().toISOString(), targetId: 'run-1:release-bot:merge' }]
  );

  assert.notEqual(decision.outcome, 'approve');
});


test('evaluateAmendment enforces maintainer approvals and evidence', () => {
  const agents = [{ id: 'maintainer', kind: 'human', roles: ['maintainer'], grants: [] }];
  const constitution = [{ kind: 'boundary', id: 'rule-1', from: ['src/**'], to: ['src/internal/**'], mode: 'forbid', message: 'x' }];
  const pending = legitimacy.evaluateAmendment({
    id: 'amend-1',
    title: 'remove rule',
    rationale: 'test',
    evidence: ['migration validated'],
    changes: [{ action: 'remove', ruleId: 'rule-1' }],
    approvals: [{ by: 'maintainer', role: 'maintainer', rationale: 'ok', createdAt: new Date().toISOString(), targetId: 'amend-1' }]
  }, constitution, agents);
  assert.equal(pending.outcome, 'needs-approvals');
});

test('evaluateAmendment counts only unique approvers targeting the proposal id', () => {
  const agents = [
    { id: 'maintainer', kind: 'human', roles: ['maintainer'], grants: [] },
    { id: 'admin', kind: 'human', roles: ['admin'], grants: [] }
  ];
  const constitution = [{ kind: 'risk', id: 'rule-1', paths: ['src/**'], message: 'x', minMergeConfidence: 70 }];
  const pending = legitimacy.evaluateAmendment({
    id: 'amend-2',
    title: 'remove risk rule',
    rationale: 'test',
    evidence: ['migration validated'],
    changes: [{ action: 'remove', ruleId: 'rule-1' }],
    approvals: [
      { by: 'maintainer', role: 'maintainer', rationale: 'ok', createdAt: new Date().toISOString(), targetId: 'amend-2' },
      { by: 'maintainer', role: 'maintainer', rationale: 'duplicate', createdAt: new Date().toISOString(), targetId: 'amend-2' },
      { by: 'admin', role: 'admin', rationale: 'wrong target', createdAt: new Date().toISOString(), targetId: 'other-proposal' }
    ]
  }, constitution, agents);
  assert.equal(pending.outcome, 'needs-approvals');
  assert.deepEqual(pending.approvalsAccepted, ['maintainer']);
});

test('evaluateAmendment denies invalid runtime action values', () => {
  const agents = [{ id: 'maintainer', kind: 'human', roles: ['maintainer'], grants: [] }];
  const constitution = [{ kind: 'approval', id: 'rule-1', paths: ['src/**'], message: 'x', minApprovals: 1, roles: ['maintainer'] }];
  const decision = legitimacy.evaluateAmendment({
    id: 'amend-invalid-action',
    title: 'bad action',
    rationale: 'test',
    evidence: ['validated'],
    changes: [{ action: 'rename', ruleId: 'rule-1' }],
    approvals: [{ by: 'maintainer', role: 'maintainer', rationale: 'ok', createdAt: new Date().toISOString(), targetId: 'amend-invalid-action' }]
  }, constitution, agents);
  assert.equal(decision.outcome, 'denied');
  assert.match(decision.reasons[0], /invalid action rename/);
});
