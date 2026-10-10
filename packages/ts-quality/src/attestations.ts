import fs from 'fs';
import path from 'path';
import { timingSafeEqual } from 'crypto';
import { type Attestation, type AttestationVerificationRecord, fileDigest, resolveRepoLocalPath } from '../../evidence-model/src/index';
import {
  loadTrustedKeys,
  parseAttestationRecord,
  runScopedArtifactReference,
  validateRenderableAttestationContract,
  verifyAttestation
} from '../../legitimacy/src/index';
import { lexicalRelativePathInsideRoot } from './cli-paths';

/** Loading and verifying the attestations that apply to a run; shared by projections and authorization. */

export function verifyAttestationRecordAtRoot(rootDir: string, source: string, attestation: Attestation, trustedKeys: Record<string, string>): AttestationVerificationRecord {
  const contract = validateRenderableAttestationContract(attestation, { requireSubjectFile: true });
  const contextFields = contract.context;
  const record: AttestationVerificationRecord = {
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
  let subjectResolution: { absolutePath: string; relativePath: string; canonicalPath: string };
  let relativeSubject: string | undefined;
  try {
    subjectResolution = resolveRepoLocalPath(rootDir, subjectFile, { allowMissing: true, kind: 'attestation subject' });
    relativeSubject = lexicalRelativePathInsideRoot(rootDir, subjectResolution.absolutePath);
  } catch {
    return { ...record, reason: 'subject file escapes repository root' };
  }
  if (!relativeSubject || relativeSubject !== subjectFile) {
    return { ...record, reason: 'subject file escapes repository root' };
  }
  if (!fs.existsSync(subjectResolution.canonicalPath)) {
    return { ...record, reason: `subject file missing: ${subjectFile}` };
  }
  const signature = verifyAttestation(attestation, trustedKeys);
  if (!signature.ok) {
    return { ...record, reason: signature.reason };
  }
  const digest = fileDigest(subjectResolution.canonicalPath);
  if (!digestsMatch(digest, attestation.subjectDigest)) {
    return { ...record, reason: 'subject digest mismatch' };
  }
  return { ...record, ok: true, reason: 'verified' };
}
/** Compares digest strings in constant time for equal lengths; unequal lengths are simply unequal. */
function digestsMatch(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
export function attestationAppliesToRun(attestation: Attestation, runId: string): boolean {
  const payload = attestation.payload;
  const subjectFile = typeof payload?.['subjectFile'] === 'string' ? payload['subjectFile'] : undefined;
  if (!subjectFile || path.isAbsolute(subjectFile)) {
    return false;
  }
  const scopedSubject = runScopedArtifactReference(subjectFile);
  if (!scopedSubject || scopedSubject.runId !== runId) {
    return false;
  }
  const payloadRunId = typeof payload?.['runId'] === 'string' ? payload['runId'] : undefined;
  return payloadRunId === undefined || payloadRunId === runId;
}
export function attestationVerificationAppliesToRun(record: AttestationVerificationRecord, runId: string): boolean {
  if (record.runId) {
    return record.runId === runId;
  }
  if (!record.subjectFile || path.isAbsolute(record.subjectFile)) {
    return false;
  }
  const scopedSubject = runScopedArtifactReference(record.subjectFile);
  return scopedSubject?.runId === runId;
}
function attestationFiles(rootDir: string, dirRelative: string): string[] {
  const directory = resolveRepoLocalPath(rootDir, dirRelative, { allowMissing: true, kind: 'attestations dir' }).absolutePath;
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory).filter((entry: string) => entry.endsWith('.json')).map((entry: string) => path.join(directory, entry)).sort();
}
export function loadVerifiedAttestations(rootDir: string, attestationsDir: string, trustedKeysDir: string): { attestations: Attestation[]; verification: AttestationVerificationRecord[] } {
  const keysDir = resolveRepoLocalPath(rootDir, trustedKeysDir, { allowMissing: true, kind: 'trusted keys dir' }).absolutePath;
  const keys = loadTrustedKeys(keysDir);
  const verification: AttestationVerificationRecord[] = [];
  const attestations: Attestation[] = [];
  for (const filePath of attestationFiles(rootDir, attestationsDir)) {
    const source = path.basename(filePath);
    let rawText: string;
    try {
      rawText = fs.readFileSync(filePath, 'utf8');
    } catch {
      verification.push({ version: '1', source, ok: false, reason: 'unreadable attestation file' });
      continue;
    }
    let rawAttestation: unknown;
    try {
      rawAttestation = JSON.parse(rawText);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      verification.push({ version: '1', source, ok: false, reason: `invalid JSON: ${message}` });
      continue;
    }
    const parsed = parseAttestationRecord(rawAttestation);
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
