"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAttestationRecordAtRoot = verifyAttestationRecordAtRoot;
exports.attestationAppliesToRun = attestationAppliesToRun;
exports.attestationVerificationAppliesToRun = attestationVerificationAppliesToRun;
exports.loadVerifiedAttestations = loadVerifiedAttestations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const index_1 = require("../../evidence-model/src/index");
const index_2 = require("../../legitimacy/src/index");
const cli_paths_1 = require("./cli-paths");
/** Loading and verifying the attestations that apply to a run; shared by projections and authorization. */
function verifyAttestationRecordAtRoot(rootDir, source, attestation, trustedKeys) {
    const contract = (0, index_2.validateRenderableAttestationContract)(attestation, { requireSubjectFile: true });
    const contextFields = contract.context;
    const record = {
        version: '1',
        source,
        ...(contextFields.issuer ? { issuer: contextFields.issuer } : {}),
        ok: false,
        reason: 'verification did not run',
        ...(contextFields.subjectFile ? { subjectFile: contextFields.subjectFile } : {}),
        ...(contextFields.runId ? { runId: contextFields.runId } : {}),
        ...(contextFields.artifactName ? { artifactName: contextFields.artifactName } : {})
    };
    if (!contract.ok) {
        return { ...record, reason: contract.reason };
    }
    const subjectFile = contextFields.subjectFile;
    if (!subjectFile) {
        return { ...record, reason: 'subject file missing from attestation payload' };
    }
    let subjectResolution;
    let relativeSubject;
    try {
        subjectResolution = (0, index_1.resolveRepoLocalPath)(rootDir, subjectFile, { allowMissing: true, kind: 'attestation subject' });
        relativeSubject = (0, cli_paths_1.lexicalRelativePathInsideRoot)(rootDir, subjectResolution.absolutePath);
    }
    catch {
        return { ...record, reason: 'subject file escapes repository root' };
    }
    if (!relativeSubject || relativeSubject !== subjectFile) {
        return { ...record, reason: 'subject file escapes repository root' };
    }
    if (!fs_1.default.existsSync(subjectResolution.canonicalPath)) {
        return { ...record, reason: `subject file missing: ${subjectFile}` };
    }
    const signature = (0, index_2.verifyAttestation)(attestation, trustedKeys);
    if (!signature.ok) {
        return { ...record, reason: signature.reason };
    }
    const digest = (0, index_1.fileDigest)(subjectResolution.canonicalPath);
    if (!digestsMatch(digest, attestation.subjectDigest)) {
        return { ...record, reason: 'subject digest mismatch' };
    }
    return { ...record, ok: true, reason: 'verified' };
}
/** Compares digest strings in constant time for equal lengths; unequal lengths are simply unequal. */
function digestsMatch(actual, expected) {
    const actualBytes = Buffer.from(actual, 'utf8');
    const expectedBytes = Buffer.from(expected, 'utf8');
    return actualBytes.length === expectedBytes.length && (0, crypto_1.timingSafeEqual)(actualBytes, expectedBytes);
}
function attestationAppliesToRun(attestation, runId) {
    const payload = attestation.payload;
    const subjectFile = typeof payload?.['subjectFile'] === 'string' ? payload['subjectFile'] : undefined;
    if (!subjectFile || path_1.default.isAbsolute(subjectFile)) {
        return false;
    }
    const scopedSubject = (0, index_2.runScopedArtifactReference)(subjectFile);
    if (!scopedSubject || scopedSubject.runId !== runId) {
        return false;
    }
    const payloadRunId = typeof payload?.['runId'] === 'string' ? payload['runId'] : undefined;
    return payloadRunId === undefined || payloadRunId === runId;
}
function attestationVerificationAppliesToRun(record, runId) {
    if (record.runId) {
        return record.runId === runId;
    }
    if (!record.subjectFile || path_1.default.isAbsolute(record.subjectFile)) {
        return false;
    }
    const scopedSubject = (0, index_2.runScopedArtifactReference)(record.subjectFile);
    return scopedSubject?.runId === runId;
}
function attestationFiles(rootDir, dirRelative) {
    const directory = (0, index_1.resolveRepoLocalPath)(rootDir, dirRelative, { allowMissing: true, kind: 'attestations dir' }).absolutePath;
    if (!fs_1.default.existsSync(directory)) {
        return [];
    }
    return fs_1.default.readdirSync(directory).filter((entry) => entry.endsWith('.json')).map((entry) => path_1.default.join(directory, entry)).sort();
}
function loadVerifiedAttestations(rootDir, attestationsDir, trustedKeysDir) {
    const keysDir = (0, index_1.resolveRepoLocalPath)(rootDir, trustedKeysDir, { allowMissing: true, kind: 'trusted keys dir' }).absolutePath;
    const keys = (0, index_2.loadTrustedKeys)(keysDir);
    const verification = [];
    const attestations = [];
    for (const filePath of attestationFiles(rootDir, attestationsDir)) {
        const source = path_1.default.basename(filePath);
        let rawText;
        try {
            rawText = fs_1.default.readFileSync(filePath, 'utf8');
        }
        catch {
            verification.push({ version: '1', source, ok: false, reason: 'unreadable attestation file' });
            continue;
        }
        let rawAttestation;
        try {
            rawAttestation = JSON.parse(rawText);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            verification.push({ version: '1', source, ok: false, reason: `invalid JSON: ${message}` });
            continue;
        }
        const parsed = (0, index_2.parseAttestationRecord)(rawAttestation);
        if (!parsed.ok) {
            verification.push({ version: '1', source, ok: false, reason: parsed.reason });
            continue;
        }
        const attestation = parsed.attestation;
        const result = verifyAttestationRecordAtRoot(rootDir, source, attestation, keys);
        verification.push(result);
        if (result.ok) {
            attestations.push(attestation);
        }
    }
    return { attestations, verification };
}
//# sourceMappingURL=attestations.js.map