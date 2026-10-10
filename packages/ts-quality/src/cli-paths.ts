import fs from 'fs';
import path from 'path';
import { normalizePath, resolveRepoLocalPath } from '../../evidence-model/src/index';

/** Repository-local path resolution for CLI arguments, with containment errors phrased for operators. */

function portablePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}
export function resolveCliPath(rootDir: string, candidate: string, options?: { preferRoot?: boolean }): string {
  if (path.isAbsolute(candidate)) {
    return candidate;
  }
  const cwdResolved = path.resolve(process.cwd(), candidate);
  const rootResolved = path.resolve(rootDir, candidate);
  const rootRelativeFromCwd = portablePath(path.relative(process.cwd(), rootDir));
  const normalizedCandidate = portablePath(candidate);
  if (fs.existsSync(rootResolved)) {
    return rootResolved;
  }
  if (fs.existsSync(cwdResolved)) {
    return cwdResolved;
  }
  if (rootRelativeFromCwd && (normalizedCandidate === rootRelativeFromCwd || normalizedCandidate.startsWith(`${rootRelativeFromCwd}/`) )) {
    return cwdResolved;
  }
  return options?.preferRoot === false ? cwdResolved : rootResolved;
}
export function lexicalRelativePathInsideRoot(rootDir: string, absolutePath: string): string | undefined {
  const relative = portablePath(path.relative(rootDir, absolutePath));
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    return undefined;
  }
  return normalizePath(relative);
}
function remapCliRepoLocalError(error: unknown, kind: string, candidate: string): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith(`${kind} must stay inside repository root:`)) {
    throw new Error(`${kind} must be inside --root: ${candidate}`);
  }
  if (message.startsWith(`${kind} not found:`)) {
    throw new Error(`${kind} not found: ${candidate}`);
  }
  throw error instanceof Error ? error : new Error(message);
}
export function resolveCliRepoLocalPath(rootDir: string, candidate: string, options?: { allowMissing?: boolean; kind?: string; preferRoot?: boolean }): { absolutePath: string; relativePath: string; canonicalPath: string } {
  const pathOptions = options?.preferRoot !== undefined ? { preferRoot: options.preferRoot } : undefined;
  const resolvedCandidate = resolveCliPath(rootDir, candidate, pathOptions);
  const resolutionOptions: { allowMissing?: boolean; kind?: string } = {};
  if (options?.allowMissing !== undefined) {
    resolutionOptions.allowMissing = options.allowMissing;
  }
  if (options?.kind !== undefined) {
    resolutionOptions.kind = options.kind;
  }
  try {
    return resolveRepoLocalPath(rootDir, resolvedCandidate, resolutionOptions);
  } catch (error) {
    remapCliRepoLocalError(error, options?.kind ?? 'path', candidate);
  }
}
export function resolveCliAttestationSubject(rootDir: string, candidate: string, options?: { allowMissing?: boolean }): { absolutePath: string; canonicalPath: string; recordedPath: string } {
  const resolution = resolveCliRepoLocalPath(rootDir, candidate, options?.allowMissing !== undefined ? { allowMissing: options.allowMissing, kind: 'attestation subject' } : { kind: 'attestation subject' });
  const recordedPath = lexicalRelativePathInsideRoot(rootDir, resolution.absolutePath);
  if (!recordedPath) {
    throw new Error(`attestation subject must be inside --root: ${candidate}`);
  }
  return {
    absolutePath: resolution.absolutePath,
    canonicalPath: resolution.canonicalPath,
    recordedPath
  };
}
