"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAttestationRecord = parseAttestationRecord;
exports.generateKeyPair = generateKeyPair;
exports.runScopedArtifactReference = runScopedArtifactReference;
exports.validateRenderableAttestationContract = validateRenderableAttestationContract;
exports.signCanonicalAttestation = signCanonicalAttestation;
exports.signAttestation = signAttestation;
exports.verifyAttestation = verifyAttestation;
exports.loadTrustedKeys = loadTrustedKeys;
exports.buildChangeBundle = buildChangeBundle;
exports.authorizeChange = authorizeChange;
exports.evaluateAmendment = evaluateAmendment;
exports.applyAmendment = applyAmendment;
exports.saveAttestation = saveAttestation;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const index_1 = require("../../evidence-model/src/index");
function canonicalBytes(value) {
    return Buffer.from((0, index_1.stableStringify)(value), 'utf8');
}
function isStringArray(value) {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
function parseAttestationRecord(value) {
    if (!value || typeof value !== 'object') {
        return { ok: false, reason: 'invalid attestation shape: expected object' };
    }
    const candidate = value;
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
    const signatureRecord = signature;
    if (signatureRecord.algorithm !== 'ed25519' || typeof signatureRecord.keyId !== 'string' || typeof signatureRecord.value !== 'string') {
        return { ok: false, reason: 'invalid attestation shape: malformed signature' };
    }
    if (candidate.payload !== undefined && (typeof candidate.payload !== 'object' || candidate.payload === null || Array.isArray(candidate.payload))) {
        return { ok: false, reason: 'invalid attestation shape: payload must be an object when present' };
    }
    return { ok: true, attestation: candidate };
}
function generateKeyPair() {
    const pair = crypto_1.default.generateKeyPairSync('ed25519');
    return {
        publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        privateKeyPem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    };
}
function runScopedArtifactReference(subjectFile) {
    const match = /^\.ts-quality\/runs\/([^/]+)\/(.+)$/.exec((0, index_1.normalizePath)(subjectFile));
    if (!match || !match[2]) {
        return undefined;
    }
    return {
        runId: match[1] ?? '',
        artifactName: match[2] ?? ''
    };
}
function validateRenderableAttestationContract(attestation, options) {
    const context = {};
    const payload = attestation.payload ?? {};
    const issuerIssue = (0, index_1.validateAttestationMetadata)(attestation.issuer, 'attestation issuer', { trimEmpty: true });
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
    let subjectIssue;
    let normalizedSubject;
    if (hasSubjectFile && rawSubjectFile !== undefined && typeof rawSubjectFile !== 'string') {
        subjectIssue = 'attestation payload subjectFile must be a string';
    }
    else if (typeof rawSubjectFile === 'string') {
        if (rawSubjectFile.trim().length === 0) {
            subjectIssue = 'subject file missing from attestation payload';
        }
        else if (path_1.default.isAbsolute(rawSubjectFile)) {
            subjectIssue = 'subject file must be repo-relative';
        }
        else {
            const subjectFileIssue = (0, index_1.validateAttestationMetadata)(rawSubjectFile, 'attestation payload subjectFile', { trimEmpty: true });
            if (subjectFileIssue) {
                subjectIssue = subjectFileIssue;
            }
            else {
                normalizedSubject = (0, index_1.normalizePath)(rawSubjectFile);
                context.subjectFile = normalizedSubject;
            }
        }
    }
    else if (requireSubjectFile) {
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
        }
        else if (typeof rawRunId === 'string') {
            const runIdIssue = (0, index_1.validateAttestationMetadata)(rawRunId, 'attestation payload runId', { trimEmpty: true });
            if (runIdIssue) {
                subjectIssue = runIdIssue;
            }
            else if (!scopedSubject) {
                subjectIssue = 'attestation payload runId requires a run-scoped subject path';
            }
            else if (rawRunId !== scopedSubject.runId) {
                subjectIssue = 'attestation payload runId does not match subject path';
            }
        }
    }
    if (!subjectIssue) {
        if (hasArtifactName && rawArtifactName !== undefined && typeof rawArtifactName !== 'string') {
            subjectIssue = 'attestation payload artifactName must be a string';
        }
        else if (typeof rawArtifactName === 'string') {
            const artifactNameIssue = (0, index_1.validateAttestationMetadata)(rawArtifactName, 'attestation payload artifactName', { trimEmpty: true });
            if (artifactNameIssue) {
                subjectIssue = artifactNameIssue;
            }
            else if (!scopedSubject) {
                subjectIssue = 'attestation payload artifactName requires a run-scoped subject path';
            }
            else if (rawArtifactName !== scopedSubject.artifactName) {
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
function signCanonicalAttestation(unsigned, privateKeyPem) {
    const payload = {
        ...unsigned,
        signature: {
            ...unsigned.signature,
            value: ''
        }
    };
    const signature = crypto_1.default.sign(null, canonicalBytes(payload), privateKeyPem);
    return {
        ...payload,
        signature: {
            ...payload.signature,
            value: signature.toString('base64')
        }
    };
}
function signAttestation(subject) {
    const payload = subject.payload ?? {};
    const renderableContract = validateRenderableAttestationContract({ issuer: subject.issuer, payload }, {
        requireSubjectFile: Object.prototype.hasOwnProperty.call(payload, 'subjectFile') || Object.prototype.hasOwnProperty.call(payload, 'runId') || Object.prototype.hasOwnProperty.call(payload, 'artifactName')
    });
    if (!renderableContract.ok) {
        throw new Error(renderableContract.reason);
    }
    const unsigned = {
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
function verifyAttestation(attestation, trustedKeys) {
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
    const ok = crypto_1.default.verify(null, canonicalBytes(payload), publicKeyPem, Buffer.from(verifiedAttestation.signature.value, 'base64'));
    return { ok, reason: ok ? 'verified' : 'signature mismatch' };
}
function loadTrustedKeys(keyDir) {
    const keys = {};
    if (!fs_1.default.existsSync(keyDir)) {
        return keys;
    }
    for (const entry of fs_1.default.readdirSync(keyDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.pub.pem')) {
            continue;
        }
        const keyId = entry.name.replace(/\.pub\.pem$/, '');
        keys[keyId] = fs_1.default.readFileSync(path_1.default.join(keyDir, entry.name), 'utf8');
    }
    return keys;
}
function buildChangeBundle(rootDir, run, agentId, action) {
    const fileDigests = {};
    for (const filePath of run.changedFiles) {
        const absolute = path_1.default.join(rootDir, filePath);
        fileDigests[filePath] = fs_1.default.existsSync(absolute)
            ? (0, index_1.fileDigest)(absolute)
            : 'sha256:missing';
    }
    return {
        version: '1',
        kind: 'change-bundle',
        action,
        agentId,
        runId: run.runId,
        createdAt: new Date().toISOString(),
        changedFiles: run.changedFiles.map((item) => (0, index_1.normalizePath)(item)),
        fileDigests,
        runDigest: (0, index_1.digestObject)(run)
    };
}
function grantMatches(grant, action, changedFiles) {
    if (!grant.actions.includes(action)) {
        return false;
    }
    if (changedFiles.length === 0) {
        return false;
    }
    if (!changedFiles.every((filePath) => (0, index_1.matchesAny)(grant.paths, filePath))) {
        return false;
    }
    if (grant.denyPaths && changedFiles.some((filePath) => (0, index_1.matchesAny)(grant.denyPaths ?? [], filePath))) {
        return false;
    }
    return true;
}
function collectApprovalRequirements(constitution, changedFiles) {
    return constitution
        .filter((rule) => rule.kind === 'approval' && changedFiles.some((filePath) => (0, index_1.matchesAny)(rule.paths, filePath)))
        .flatMap((rule) => rule.roles);
}
function validOverride(overrides, targetId, changedFiles, agents) {
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
function uniqueApprovalsForTarget(approvals, approvers, targetId) {
    const unique = new Map();
    for (const approval of approvals) {
        if (approval.targetId !== targetId || !approvers.has(approval.by) || unique.has(approval.by)) {
            continue;
        }
        unique.set(approval.by, approval);
    }
    return [...unique.values()];
}
function validateAmendmentChanges(proposal, constitution) {
    const reasons = [];
    const activeRuleIds = new Set(constitution.map((rule) => rule.id));
    for (const change of proposal.changes) {
        if (change.action === 'add') {
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
        if (change.action === 'remove') {
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
function authorizeChange(agentId, action, bundle, run, agents, constitution, attestations, overrides) {
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
    const requiredAttestations = new Set(grant.requireAttestations ?? []);
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
function evaluateAmendment(proposal, constitution, agents) {
    const maintainers = new Set(agents.filter((agent) => agent.kind === 'human' && (agent.roles.includes('maintainer') || agent.roles.includes('admin'))).map((agent) => agent.id));
    const acceptedApprovals = uniqueApprovalsForTarget(proposal.approvals, maintainers, proposal.id);
    const changeValidationErrors = validateAmendmentChanges(proposal, constitution);
    const sensitiveRules = proposal.changes.filter((change) => {
        const current = constitution.find((rule) => rule.id === change.ruleId);
        const candidate = change.rule;
        const kind = candidate?.kind ?? current?.kind;
        return kind === 'boundary' || kind === 'rollback' || kind === 'risk';
    });
    const requiredApprovals = sensitiveRules.length > 0 ? 2 : 1;
    if (changeValidationErrors.length > 0) {
        return {
            proposalId: proposal.id,
            outcome: 'denied',
            reasons: changeValidationErrors,
            approvalsAccepted: acceptedApprovals.map((item) => item.by),
            requiredApprovals
        };
    }
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
function applyAmendment(proposal, constitution) {
    const changeValidationErrors = validateAmendmentChanges(proposal, constitution);
    if (changeValidationErrors.length > 0) {
        throw new Error(changeValidationErrors[0]);
    }
    let current = [...constitution];
    for (const change of proposal.changes) {
        if (change.action === 'remove') {
            current = current.filter((rule) => rule.id !== change.ruleId);
        }
        else if (change.action === 'add' && change.rule) {
            current.push(change.rule);
        }
        else if (change.action === 'replace' && change.rule) {
            current = current.map((rule) => (rule.id === change.ruleId ? change.rule : rule));
        }
    }
    return current;
}
function saveAttestation(filePath, attestation) {
    (0, index_1.writeJson)(filePath, attestation);
}
//# sourceMappingURL=index.js.map