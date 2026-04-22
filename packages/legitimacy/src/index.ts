import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  type Agent,
  type AmendmentDecision,
  type AmendmentDecisionProposalContext,
  type AmendmentProposal,
  type Approval,
  type Attestation,
  type AuthorizationDecision,
  type AuthorityGrant,
  type ConstitutionRule,
  type OverrideRecord,
  type RunArtifact,
  digestObject,
  fileDigest,
  matchPattern,
  matchesAny,
  normalizePath,
  stableStringify,
  validateAttestationMetadata,
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function parseAttestationRecord(value: unknown): { ok: true; attestation: Attestation } | { ok: false; reason: string } {
  if (!value || typeof value !== 'object') {
    return { ok: false, reason: 'invalid attestation shape: expected object' };
  }
  const candidate = value as Record<string, unknown>;
  const signature = candidate.signature;
  if (candidate.version !== '1' || candidate.kind !== 'attestation') {
    return { ok: false, reason: 'invalid attestation shape: version/kind mismatch' };
  }
  if (typeof candidate.issuer !== 'string' || typeof candidate.subjectType !== 'string' || typeof candidate.subjectDigest !== 'string' || !isStringArray(candidate.claims) || typeof candidate.issuedAt !== 'string') {
    return { ok: false, reason: 'invalid attestation shape: missing issuer, subject, claims, or issuedAt' };
  }
  if (!signature || typeof signature !== 'object') {
    return { ok: false, reason: 'invalid attestation shape: missing signature' };
  }
  const signatureRecord = signature as Record<string, unknown>;
  if (signatureRecord.algorithm !== 'ed25519' || typeof signatureRecord.keyId !== 'string' || typeof signatureRecord.value !== 'string') {
    return { ok: false, reason: 'invalid attestation shape: malformed signature' };
  }
  if (candidate.payload !== undefined && (typeof candidate.payload !== 'object' || candidate.payload === null || Array.isArray(candidate.payload))) {
    return { ok: false, reason: 'invalid attestation shape: payload must be an object when present' };
  }
  return { ok: true, attestation: candidate as unknown as Attestation };
}

export function generateKeyPair(): { publicKeyPem: string; privateKeyPem: string } {
  const pair = crypto.generateKeyPairSync('ed25519');
  return {
    publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  };
}

export function runScopedArtifactReference(subjectFile: string): { runId: string; artifactName: string } | undefined {
  const match = /^\.ts-quality\/runs\/([^/]+)\/(.+)$/.exec(normalizePath(subjectFile));
  if (!match || !match[2]) {
    return undefined;
  }
  return {
    runId: match[1] ?? '',
    artifactName: match[2] ?? ''
  };
}

export function validateRenderableAttestationContract(attestation: { issuer: string; payload?: Record<string, unknown> | undefined }, options?: { requireSubjectFile?: boolean }): { ok: true; context: { issuer?: string; subjectFile?: string; runId?: string; artifactName?: string } } | { ok: false; reason: string; context: { issuer?: string; subjectFile?: string; runId?: string; artifactName?: string } } {
  const context: { issuer?: string; subjectFile?: string; runId?: string; artifactName?: string } = {};
  const payload = attestation.payload ?? {};
  const issuerIssue = validateAttestationMetadata(attestation.issuer, 'attestation issuer', { trimEmpty: true });
  if (!issuerIssue) {
    context.issuer = attestation.issuer;
  }

  const hasSubjectFile = Object.prototype.hasOwnProperty.call(payload, 'subjectFile');
  const hasRunId = Object.prototype.hasOwnProperty.call(payload, 'runId');
  const hasArtifactName = Object.prototype.hasOwnProperty.call(payload, 'artifactName');
  const requireSubjectFile = options?.requireSubjectFile ?? false;

  const rawSubjectFile = payload.subjectFile;
  const rawRunId = payload.runId;
  const rawArtifactName = payload.artifactName;

  let subjectIssue: string | undefined;
  let normalizedSubject: string | undefined;

  if (hasSubjectFile && rawSubjectFile !== undefined && typeof rawSubjectFile !== 'string') {
    subjectIssue = 'attestation payload subjectFile must be a string';
  } else if (typeof rawSubjectFile === 'string') {
    if (rawSubjectFile.trim().length === 0) {
      subjectIssue = 'subject file missing from attestation payload';
    } else if (path.isAbsolute(rawSubjectFile)) {
      subjectIssue = 'subject file must be repo-relative';
    } else {
      const subjectFileIssue = validateAttestationMetadata(rawSubjectFile, 'attestation payload subjectFile', { trimEmpty: true });
      if (subjectFileIssue) {
        subjectIssue = subjectFileIssue;
      } else {
        normalizedSubject = normalizePath(rawSubjectFile);
        context.subjectFile = normalizedSubject;
      }
    }
  } else if (requireSubjectFile) {
    subjectIssue = 'subject file missing from attestation payload';
  }

  const scopedSubject = normalizedSubject ? runScopedArtifactReference(normalizedSubject) : undefined;
  if (scopedSubject) {
    context.runId = scopedSubject.runId;
    context.artifactName = scopedSubject.artifactName;
  }

  if (!subjectIssue) {
    if (hasRunId && rawRunId !== undefined && typeof rawRunId !== 'string') {
      subjectIssue = 'attestation payload runId must be a string';
    } else if (typeof rawRunId === 'string') {
      const runIdIssue = validateAttestationMetadata(rawRunId, 'attestation payload runId', { trimEmpty: true });
      if (runIdIssue) {
        subjectIssue = runIdIssue;
      } else if (!scopedSubject) {
        subjectIssue = 'attestation payload runId requires a run-scoped subject path';
      } else if (rawRunId !== scopedSubject.runId) {
        subjectIssue = 'attestation payload runId does not match subject path';
      }
    }
  }

  if (!subjectIssue) {
    if (hasArtifactName && rawArtifactName !== undefined && typeof rawArtifactName !== 'string') {
      subjectIssue = 'attestation payload artifactName must be a string';
    } else if (typeof rawArtifactName === 'string') {
      const artifactNameIssue = validateAttestationMetadata(rawArtifactName, 'attestation payload artifactName', { trimEmpty: true });
      if (artifactNameIssue) {
        subjectIssue = artifactNameIssue;
      } else if (!scopedSubject) {
        subjectIssue = 'attestation payload artifactName requires a run-scoped subject path';
      } else if (rawArtifactName !== scopedSubject.artifactName) {
        subjectIssue = 'attestation payload artifactName does not match subject path';
      }
    }
  }

  if (issuerIssue) {
    return { ok: false, reason: issuerIssue, context };
  }
  if (subjectIssue) {
    return { ok: false, reason: subjectIssue, context };
  }
  return { ok: true, context };
}

export function signCanonicalAttestation(unsigned: Attestation, privateKeyPem: string): Attestation {
  const payload = {
    ...unsigned,
    signature: {
      ...unsigned.signature,
      value: ''
    }
  };
  const signature = crypto.sign(null, canonicalBytes(payload), privateKeyPem);
  return {
    ...payload,
    signature: {
      ...payload.signature,
      value: signature.toString('base64')
    }
  };
}

export function signAttestation(subject: { subjectType: string; subjectDigest: string; issuer: string; claims: string[]; payload?: Record<string, unknown>; keyId: string; privateKeyPem: string; issuedAt?: string; }): Attestation {
  const payload = subject.payload ?? {};
  const renderableContract = validateRenderableAttestationContract({ issuer: subject.issuer, payload }, {
    requireSubjectFile: Object.prototype.hasOwnProperty.call(payload, 'subjectFile') || Object.prototype.hasOwnProperty.call(payload, 'runId') || Object.prototype.hasOwnProperty.call(payload, 'artifactName')
  });
  if (!renderableContract.ok) {
    throw new Error(renderableContract.reason);
  }
  const unsigned: Attestation = {
    version: '1',
    kind: 'attestation',
    issuer: subject.issuer,
    subjectType: subject.subjectType,
    subjectDigest: subject.subjectDigest,
    claims: subject.claims,
    issuedAt: subject.issuedAt ?? new Date().toISOString(),
    payload,
    signature: {
      algorithm: 'ed25519',
      keyId: subject.keyId,
      value: ''
    }
  };
  return signCanonicalAttestation(unsigned, subject.privateKeyPem);
}

export function verifyAttestation(attestation: Attestation, trustedKeys: Record<string, string>): { ok: boolean; reason: string } {
  const parsed = parseAttestationRecord(attestation);
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason };
  }
  const verifiedAttestation = parsed.attestation;
  const publicKeyPem = trustedKeys[verifiedAttestation.signature.keyId];
  if (!publicKeyPem) {
    return { ok: false, reason: `Missing trusted public key for ${verifiedAttestation.signature.keyId}` };
  }
  const payload = {
    ...verifiedAttestation,
    signature: {
      ...verifiedAttestation.signature,
      value: ''
    }
  };
  const ok = crypto.verify(null, canonicalBytes(payload), publicKeyPem, Buffer.from(verifiedAttestation.signature.value, 'base64'));
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
      ? fileDigest(absolute)
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

const VALID_AMENDMENT_ACTIONS = new Set<AmendmentProposal['changes'][number]['action']>(['add', 'remove', 'replace']);
const SENSITIVE_AMENDMENT_RULE_KINDS = new Set<ConstitutionRule['kind']>(['boundary', 'rollback', 'risk']);

function isAmendmentChangeAction(action: unknown): action is AmendmentProposal['changes'][number]['action'] {
  return typeof action === 'string' && VALID_AMENDMENT_ACTIONS.has(action as AmendmentProposal['changes'][number]['action']);
}

function buildAmendmentProposalContext(
  proposal: AmendmentProposal,
  constitution: ConstitutionRule[]
): AmendmentDecisionProposalContext {
  const constitutionById = new Map(constitution.map((rule) => [rule.id, rule]));
  const changes = proposal.changes.map((change) => {
    const current = constitutionById.get(change.ruleId);
    const currentRuleKind = current?.kind;
    const proposedRuleKind = change.rule?.kind;
    const sensitivity: 'standard' | 'sensitive' = SENSITIVE_AMENDMENT_RULE_KINDS.has(proposedRuleKind ?? currentRuleKind ?? 'approval') ? 'sensitive' : 'standard';
    return {
      action: String(change.action),
      ruleId: change.ruleId,
      currentRuleKind,
      proposedRuleKind,
      sensitivity
    };
  });
  const sensitiveRuleIds = [...new Set(changes.filter((change) => change.sensitivity === 'sensitive').map((change) => change.ruleId))];
  return {
    title: proposal.title,
    rationale: proposal.rationale,
    evidence: [...proposal.evidence],
    changes,
    approvalBurdenBasis: sensitiveRuleIds.length > 0 ? 'sensitive-rule-change' : 'standard-rule-change',
    sensitiveRuleIds
  };
}

function validateAmendmentChanges(proposal: AmendmentProposal, constitution: ConstitutionRule[]): string[] {
  const reasons: string[] = [];
  const activeRuleIds = new Set(constitution.map((rule) => rule.id));

  for (const change of proposal.changes) {
    const action = change.action;
    if (!isAmendmentChangeAction(action)) {
      reasons.push(`Amendment change ${change.ruleId} has invalid action ${String(action)}. Valid actions: add, remove, replace.`);
      continue;
    }

    if (action === 'add') {
      if (!change.rule) {
        reasons.push(`Amendment add ${change.ruleId} must include a replacement rule.`);
        continue;
      }
      if (change.rule.id !== change.ruleId) {
        reasons.push(`Amendment add ${change.ruleId} must keep change.rule.id aligned with change.ruleId.`);
        continue;
      }
      if (activeRuleIds.has(change.rule.id)) {
        reasons.push(`Amendment add ${change.rule.id} would create a duplicate constitution rule id.`);
        continue;
      }
      activeRuleIds.add(change.rule.id);
      continue;
    }

    if (action === 'remove') {
      if (!activeRuleIds.has(change.ruleId)) {
        reasons.push(`Amendment remove ${change.ruleId} targets no existing constitution rule.`);
        continue;
      }
      activeRuleIds.delete(change.ruleId);
      continue;
    }

    if (!change.rule) {
      reasons.push(`Amendment replace ${change.ruleId} must include a replacement rule.`);
      continue;
    }
    if (!activeRuleIds.has(change.ruleId)) {
      reasons.push(`Amendment replace ${change.ruleId} targets no existing constitution rule.`);
      continue;
    }
    if (change.rule.id !== change.ruleId) {
      reasons.push(`Amendment replace ${change.ruleId} may not rename the constitution rule id.`);
      continue;
    }
  }

  return reasons;
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
      reasons: ['No changed files were bound to this authorization request. Re-run check with explicit changes.'],
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
  const changeValidationErrors = validateAmendmentChanges(proposal, constitution);
  const proposalContext = buildAmendmentProposalContext(proposal, constitution);
  const requiredApprovals = proposalContext.sensitiveRuleIds.length > 0 ? 2 : 1;
  if (changeValidationErrors.length > 0) {
    return {
      proposalId: proposal.id,
      outcome: 'denied',
      reasons: changeValidationErrors,
      approvalsAccepted: acceptedApprovals.map((item) => item.by),
      requiredApprovals,
      proposalContext
    };
  }
  if (acceptedApprovals.length < requiredApprovals) {
    return {
      proposalId: proposal.id,
      outcome: 'needs-approvals',
      reasons: [`Need ${requiredApprovals} maintainer approval(s) but only ${acceptedApprovals.length} unique targeted approval(s) were supplied.`],
      approvalsAccepted: acceptedApprovals.map((item) => item.by),
      requiredApprovals,
      proposalContext
    };
  }
  if (proposal.evidence.length === 0) {
    return {
      proposalId: proposal.id,
      outcome: 'denied',
      reasons: ['Amendments require explicit migration or validation evidence.'],
      approvalsAccepted: acceptedApprovals.map((item) => item.by),
      requiredApprovals,
      proposalContext
    };
  }
  return {
    proposalId: proposal.id,
    outcome: 'approved',
    reasons: ['Approvals and supporting evidence satisfy amendment requirements.'],
    approvalsAccepted: acceptedApprovals.map((item) => item.by),
    requiredApprovals,
    proposalContext
  };
}

export function applyAmendment(proposal: AmendmentProposal, constitution: ConstitutionRule[]): ConstitutionRule[] {
  const changeValidationErrors = validateAmendmentChanges(proposal, constitution);
  if (changeValidationErrors.length > 0) {
    throw new Error(changeValidationErrors[0]);
  }
  let current = [...constitution];
  for (const change of proposal.changes) {
    if (change.action === 'remove') {
      current = current.filter((rule) => rule.id !== change.ruleId);
    } else if (change.action === 'add' && change.rule) {
      current.push(change.rule);
    } else if (change.action === 'replace' && change.rule) {
      const replacement = change.rule;
      current = current.map((rule) => (rule.id === change.ruleId ? replacement : rule));
    }
  }
  return current;
}

export function saveAttestation(filePath: string, attestation: Attestation): void {
  writeJson(filePath, attestation);
}
