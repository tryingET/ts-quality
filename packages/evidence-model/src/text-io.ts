import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/** Safe rendering of untrusted text, run ids, stable JSON, digests and small file IO helpers. */

const UNSAFE_ATTESTATION_METADATA_PATTERN = /[\x00-\x1F\x7F-\x9F\u2028\u2029]|\p{Cf}/u;
function renderUnsafeCodePoint(value: string): string {
  const codePoint = value.codePointAt(0);
  if (codePoint === undefined) {
    return value;
  }
  return codePoint <= 0xFFFF
    ? `\\u${codePoint.toString(16).padStart(4, '0')}`
    : `\\u{${codePoint.toString(16)}}`;
}
export function hasUnsafeAttestationMetadata(value: string): boolean {
  return UNSAFE_ATTESTATION_METADATA_PATTERN.test(value);
}
export function renderSafeText(value: string): string {
  return Array.from(value).map((item) => {
    if (item === '\\') {
      return '\\\\';
    }
    return hasUnsafeAttestationMetadata(item) ? renderUnsafeCodePoint(item) : item;
  }).join('');
}
export function validateAttestationMetadata(value: string, field: string, options?: { allowEmpty?: boolean; trimEmpty?: boolean }): string | undefined {
  const trimEmpty = options?.trimEmpty ?? false;
  const isEmpty = trimEmpty ? value.trim().length === 0 : value.length === 0;
  if (!options?.allowEmpty && isEmpty) {
    return `${field} missing`;
  }
  if (hasUnsafeAttestationMetadata(value)) {
    return `${field} contains unsupported control characters`;
  }
  return undefined;
}
export function createRunId(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}
export function assertSafeRunId(runId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) {
    throw new Error(`runId must use only letters, numbers, dot, underscore, and hyphen: ${runId}`);
  }
  return runId;
}
export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}
export function stableSortKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortKeys(item)) as T;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, inner]) => [key, stableSortKeys(inner)]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}
export function stableStringify(value: unknown): string {
  return JSON.stringify(stableSortKeys(value), null, 2);
}
export function sha256Hex(input: string | Uint8Array): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
export function digestObject(value: unknown): string {
  return `sha256:${sha256Hex(stableStringify(value))}`;
}
export function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}
export function writeText(filePath: string, contents: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents, 'utf8');
}
export function readJson<T>(filePath: string): T {
  return JSON.parse(readText(filePath)) as T;
}
export function writeJson(filePath: string, value: unknown): void {
  writeText(filePath, `${stableStringify(value)}\n`);
}
export function fileDigest(filePath: string): string {
  return `sha256:${sha256Hex(fs.readFileSync(filePath))}`;
}
export function readMaybe<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  return readJson<T>(filePath);
}
export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
export function nowIso(): string {
  return new Date().toISOString();
}
