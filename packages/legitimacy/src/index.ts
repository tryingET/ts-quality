import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  type Agent,
  type AmendmentDecision,
  type AmendmentProposal,
  type Approval,
  type Attestation,
  type AuthorizationDecision,
  type AuthorityGrant,
  type ConstitutionRule,
  type OverrideRecord,
  type RunArtifact,
  digestObject,
  matchPattern,
  matchesAny,
  normalizePath,
  stableStringify,
  writeJson
} from '../../evidence-model/src/index';

export interface ChangeBundle {
  version: '1';
  kind: 'change-bundle';
  action: string;
  agentId: string;
  runId: string;
  createdAt: string;
  changedFiles: string[];
  fileDigests: Record<string, string>;
  runDigest: string;
}

function canonicalBytes(value: unknown): Uint8Array {
  return Buffer.from(stableStringify(value), 'utf8');
}

export function generateKeyPair(): { publicKeyPem: string; privateKeyPem: string } {
  const pair = crypto.generateKeyPairSync('ed25519');
  return {
    publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  };
}

export function signAttestation(subject: { subjectType: string; subjectDigest: string; issuer: string; claims: string[]; payload?: Record<string, unknown>; keyId: string; privateKeyPem: string; issuedAt?: string; }): Attestation {
  const unsigned = {
    version: '1' as const,
    kind: 'attestation' as const,
    issuer: subject.issuer,
    subjectType: subject.subjectType,
    subjectDigest: subject.subjectDigest,
    claims: subject.claims,
    issuedAt: subject.issuedAt ?? new Date().toISOString(),
    payload: subject.payload ?? {},
    signature: {
      algorithm: 'ed25519' as const,
      keyId: subject.keyId,
      value: ''
    }
  };
  const signature = crypto.sign(null, canonicalBytes({ ...unsigned, signature: { ...unsigned.signature, value: '' } }), subject.privateKeyPem);
  return {
    ...unsigned,
    signature: {
      ...unsigned.signature,
      value: signature.toString('base64')
    }
  };
}

export function verifyAttestation(attestation: Attestation, trustedKeys: Record<string, string>): { ok: boolean; reason: string } {
  const publicKeyPem = trustedKeys[attestation.signature.keyId];
  if (!publicKeyPem) {
    return { ok: false, reason: `Missing trusted public key for ${attestation.signature.keyId}` };
  }
  const payload = {
    ...attestation,
    signature: {
      ...attestation.signature,
      value: ''
    }
  };
  const ok = crypto.verify(null, canonicalBytes(payload), publicKeyPem, Buffer.from(attestation.signature.value, 'base64'));
  return { ok, reason: ok ? 'verified' : 'signature mismatch' };
}

export function loadTrustedKeys(keyDir: string): Record<string, string> {
  const keys: Record<string, string> = {};
  if (!fs.existsSync(keyDir)) {
    return keys;
  }
  for (const entry of fs.readdirSync(keyDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.pub.pem')) {
      continue;
    }
    const keyId = entry.name.replace(/\.pub\.pem$/, '');
    keys[keyId] = fs.readFileSync(path.join(keyDir, entry.name), 'utf8');
  }
  return keys;
}

export function buildChangeBundle(rootDir: string, run: RunArtifact, agentId: string, action: string): ChangeBundle {
  const fileDigests: Record<string, string> = {};
  for (const filePath of run.changedFiles) {
    const absolute = path.join(rootDir, filePath);
    fileDigests[filePath] = fs.existsSync(absolute)
      ? digestObject(fs.readFileSync(absolute, 'utf8'))
      : 'sha256:missing';
  }
  return {
    version: '1',
    kind: 'change-bundle',
    action,
    agentId,
    runId: run.runId,
    createdAt: new Date().toISOString(),
    changedFiles: run.changedFiles.map((item) => normalizePath(item)),
    fileDigests,
    runDigest: digestObject(run)
  };
}

function grantMatches(grant: AuthorityGrant, action: string, changedFiles: string[]): boolean {
  if (!grant.actions.includes(action)) {
    return false;
  }
  if (changedFiles.length === 0) {
    return false;
  }
  if (!changedFiles.every((filePath) => matchesAny(grant.paths, filePath))) {
    return false;
  }
  if (grant.denyPaths && changedFiles.some((filePath) => matchesAny(grant.denyPaths ?? [], filePath))) {
    return false;
  }
  return true;
}

function collectApprovalRequirements(constitution: ConstitutionRule[], changedFiles: string[]): string[] {
  return constitution
    .filter((rule): rule is Extract<ConstitutionRule, { kind: 'approval' }> => rule.kind === 'approval' && changedFiles.some((filePath) => matchesAny(rule.paths, filePath)))
    .flatMap((rule) => rule.roles);
}

function validOverride(overrides: OverrideRecord[], targetId: string, changedFiles: string[], agents: Agent[]): OverrideRecord | undefined {
  return overrides.find((override) => {
    if (override.targetId !== targetId) {
      return false;
    }
    const agent = agents.find((candidate) => candidate.id === override.by && candidate.kind === 'human');
    if (!agent) {
      return false;
    }
    if (override.role && !agent.roles.includes(override.role)) {
      return false;
    }
    return agent.grants.some((grant) => grantMatches(grant, 'override', changedFiles));
  });
}

function uniqueApprovalsForTarget(approvals: Approval[], approvers: Set<string>, targetId: string): Approval[] {
  const unique = new Map<string, Approval>();
  for (const approval of approvals) {
    if (approval.targetId !== targetId || !approvers.has(approval.by) || unique.has(approval.by)) {
      continue;
    }
    unique.set(approval.by, approval);
  }
  return [...unique.values()];
}

export function authorizeChange(agentId: string, action: string, bundle: ChangeBundle, run: RunArtifact, agents: Agent[], constitution: ConstitutionRule[], attestations: Attestation[], overrides: OverrideRecord[]): AuthorizationDecision {
  const agent = agents.find((item) => item.id === agentId);
  if (!agent) {
    return {
      id: `${bundle.runId}:${agentId}:${action}`,
      agentId,
      action,
      outcome: 'deny',
      reasons: [`Unknown agent ${agentId}`],
      scope: bundle.changedFiles,
      missingProof: [],
      requiredApprovers: [],
      consideredAttestations: []
    };
  }

  if (bundle.changedFiles.length === 0) {
    return {
      id: `${bundle.runId}:${agentId}:${action}`,
      agentId,
      action,
      outcome: 'deny',
      reasons: ['No changed files were bound to this authorization request. Re-run check with explicit changes or allow it to default to discovered source files.'],
      scope: bundle.changedFiles,
      missingProof: [],
      requiredApprovers: [],
      consideredAttestations: attestations.map((item) => item.issuer)
    };
  }

  const matchingGrants = agent.grants.filter((grant) => grantMatches(grant, action, bundle.changedFiles));
  if (matchingGrants.length === 0) {
    return {
      id: `${bundle.runId}:${agentId}:${action}`,
      agentId,
      action,
      outcome: 'deny',
      reasons: ['No authority grant covers the requested action and scope.'],
      scope: bundle.changedFiles,
      missingProof: [],
      requiredApprovers: [],
      consideredAttestations: attestations.map((item) => item.issuer)
    };
  }

  const grant = matchingGrants[0];
  if (!grant) {
    return {
      id: `${bundle.runId}:${agentId}:${action}`,
      agentId,
      action,
      outcome: 'deny',
      reasons: ['No matching grant remained after evaluation.'],
      scope: bundle.changedFiles,
      missingProof: [],
      requiredApprovers: [],
      consideredAttestations: attestations.map((item) => item.issuer)
    };
  }
  const requiredAttestations = new Set<string>(grant.requireAttestations ?? []);
  const attestationClaims = new Set(attestations.flatMap((item) => item.claims));
  const missingProof = [...requiredAttestations].filter((claim) => !attestationClaims.has(claim));
  const requiredApprovers = collectApprovalRequirements(constitution, bundle.changedFiles);
  const override = validOverride(overrides, `${bundle.runId}:${agentId}:${action}`, bundle.changedFiles, agents);

  if (override) {
    return {
      id: `${bundle.runId}:${agentId}:${action}`,
      agentId,
      action,
      outcome: 'approve',
      reasons: [`Override by ${override.by}: ${override.rationale}`],
      scope: bundle.changedFiles,
      missingProof: [],
      requiredApprovers: [],
      consideredAttestations: attestations.map((item) => item.issuer),
      overrideUsed: override.by
    };
  }

  if (run.governance.some((finding) => finding.level === 'error')) {
    return {
      id: `${bundle.runId}:${agentId}:${action}`,
      agentId,
      action,
      outcome: 'deny',
      reasons: ['Governance violations block authorization until resolved or explicitly overridden.'],
      scope: bundle.changedFiles,
      missingProof,
      requiredApprovers,
      consideredAttestations: attestations.map((item) => item.issuer)
    };
  }

  if (typeof grant.minMergeConfidence === 'number' && run.verdict.mergeConfidence < grant.minMergeConfidence) {
    return {
      id: `${bundle.runId}:${agentId}:${action}`,
      agentId,
      action,
      outcome: agent.kind === 'human' ? 'request-more-proof' : 'require-human-approver',
      reasons: [`Merge confidence ${run.verdict.mergeConfidence} is below grant minimum ${grant.minMergeConfidence}.`],
      scope: bundle.changedFiles,
      missingProof,
      requiredApprovers,
      consideredAttestations: attestations.map((item) => item.issuer)
    };
  }

  if (missingProof.length > 0) {
    return {
      id: `${bundle.runId}:${agentId}:${action}`,
      agentId,
      action,
      outcome: 'request-more-proof',
      reasons: ['Required attestations are missing for this action.'],
      scope: bundle.changedFiles,
      missingProof,
      requiredApprovers,
      consideredAttestations: attestations.map((item) => item.issuer)
    };
  }

  if ((grant.requireHumanReview || (agent.kind !== 'human' && requiredApprovers.length > 0)) && agent.kind !== 'human') {
    return {
      id: `${bundle.runId}:${agentId}:${action}`,
      agentId,
      action,
      outcome: 'require-human-approver',
      reasons: ['This scope requires a human approver with standing.'],
      scope: bundle.changedFiles,
      missingProof: [],
      requiredApprovers,
      consideredAttestations: attestations.map((item) => item.issuer)
    };
  }

  return {
    id: `${bundle.runId}:${agentId}:${action}`,
    agentId,
    action,
    outcome: 'approve',
    reasons: ['Grant scope, confidence floor, and attestation burden were satisfied.'],
    scope: bundle.changedFiles,
    missingProof: [],
    requiredApprovers,
    consideredAttestations: attestations.map((item) => item.issuer)
  };
}

export function evaluateAmendment(proposal: AmendmentProposal, constitution: ConstitutionRule[], agents: Agent[]): AmendmentDecision {
  const maintainers = new Set(agents.filter((agent) => agent.kind === 'human' && (agent.roles.includes('maintainer') || agent.roles.includes('admin'))).map((agent) => agent.id));
  const acceptedApprovals = uniqueApprovalsForTarget(proposal.approvals, maintainers, proposal.id);
  const sensitiveRules = proposal.changes.filter((change) => {
    const current = constitution.find((rule) => rule.id === change.ruleId);
    const candidate = change.rule;
    const kind = candidate?.kind ?? current?.kind;
    return kind === 'boundary' || kind === 'rollback' || kind === 'risk';
  });
  const requiredApprovals = sensitiveRules.length > 0 ? 2 : 1;
  if (acceptedApprovals.length < requiredApprovals) {
    return {
      proposalId: proposal.id,
      outcome: 'needs-approvals',
      reasons: [`Need ${requiredApprovals} maintainer approval(s) but only ${acceptedApprovals.length} unique targeted approval(s) were supplied.`],
      approvalsAccepted: acceptedApprovals.map((item) => item.by),
      requiredApprovals
    };
  }
  if (proposal.evidence.length === 0) {
    return {
      proposalId: proposal.id,
      outcome: 'denied',
      reasons: ['Amendments require explicit migration or validation evidence.'],
      approvalsAccepted: acceptedApprovals.map((item) => item.by),
      requiredApprovals
    };
  }
  return {
    proposalId: proposal.id,
    outcome: 'approved',
    reasons: ['Approvals and supporting evidence satisfy amendment requirements.'],
    approvalsAccepted: acceptedApprovals.map((item) => item.by),
    requiredApprovals
  };
}

export function applyAmendment(proposal: AmendmentProposal, constitution: ConstitutionRule[]): ConstitutionRule[] {
  let current = [...constitution];
  for (const change of proposal.changes) {
    if (change.action === 'remove') {
      current = current.filter((rule) => rule.id !== change.ruleId);
    } else if (change.action === 'add' && change.rule) {
      current.push(change.rule);
    } else if (change.action === 'replace' && change.rule) {
      current = current.map((rule) => (rule.id === change.ruleId ? change.rule! : rule));
    }
  }
  return current;
}

export function saveAttestation(filePath: string, attestation: Attestation): void {
  writeJson(filePath, attestation);
}
