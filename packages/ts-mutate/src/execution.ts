import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import ts from 'typescript';
import {
  digestObject,
  type ExecutionReceipt,
  fileDigest,
  listFiles,
  type MutationResult,
  type MutationSite,
  normalizePath,
  readJson,
  writeJson
} from '../../evidence-model/src/index';

/** Running test commands with bounded output, the execution fingerprint and the mutation result cache. */

export interface MutationManifest {
  version: '2';
  entries: Record<string, MutationResult>;
}
export type MutationErrorKind = NonNullable<MutationResult['errorKind']>;
interface CommandOutcome {
  receipt: ExecutionReceipt;
  errorKind?: MutationErrorKind | undefined;
}
export interface RepoFileDigest {
  filePath: string;
  digest: string;
}
// Bumped when mutant-workspace or outcome semantics change so cached results from older versions are not reused
// (9: a signal-killed test process is an error, not a kill).
const MUTATION_RUNTIME_VERSION = '9';
const SANITIZED_MUTATION_ENV_KEYS = ['NODE_TEST_CONTEXT'];
const MUTATION_WORKSPACE_EXCLUDES = ['.git', 'node_modules', '.ts-quality'];
export const MUTATION_WORKSPACE_EXCLUDE_SET = new Set(MUTATION_WORKSPACE_EXCLUDES);
function mutationCommandEnv(baseEnv: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  const env = { ...baseEnv };
  for (const key of SANITIZED_MUTATION_ENV_KEYS) {
    delete env[key];
  }
  return env;
}
function mutationEnvFingerprint(env: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([, value]) => typeof value === 'string' && value.length > 0)
      .sort(([left], [right]) => left.localeCompare(right))
  ) as Record<string, string>;
}
export function hasSyntaxErrors(filePath: string, sourceText: string): boolean {
  const transpileResult = ts.transpileModule(sourceText, {
    fileName: filePath,
    compilerOptions: {
      allowJs: true,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS
    },
    reportDiagnostics: true
  });
  return (transpileResult.diagnostics ?? []).some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
}
function stdioText(value: string | Buffer | undefined): string {
  return typeof value === 'string' ? value : value ? value.toString('utf8') : '';
}
const DETAILS_HEAD = 200;
const DETAILS_TAIL = 600;
/**
 * Bounds recorded command output but keeps both ends: the start says what failed, and test runners name the failing
 * tests at the end. The omitted middle is marked.
 */
export function boundedDetails(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= DETAILS_HEAD + DETAILS_TAIL + 3) {
    return trimmed;
  }
  return `${trimmed.slice(0, DETAILS_HEAD).trimEnd()} … ${trimmed.slice(-DETAILS_TAIL).trimStart()}`;
}
function commandDetails(result: ReturnType<typeof spawnSync>): string {
  return boundedDetails(`${stdioText(result.stdout).trim()}\n${stdioText(result.stderr).trim()}`);
}
function requiredExecutable(command: string[]): string {
  const executable = command[0];
  if (!executable) {
    throw new Error('Mutation test command must contain an executable argument.');
  }
  return executable;
}
export function runCommand(cwd: string, testCommand: string[], timeoutMs: number): CommandOutcome {
  const started = Date.now();
  const result = spawnSync(requiredExecutable(testCommand), testCommand.slice(1), {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    shell: process.platform === 'win32',
    env: mutationCommandEnv()
  });
  const durationMs = Date.now() - started;
  const exitCode = typeof result.status === 'number' ? result.status : undefined;
  if (result.error) {
    const error = result.error as { code?: string; message?: string };
    const timedOut = error.code === 'ETIMEDOUT';
    return {
      receipt: { status: timedOut ? 'timeout' : 'error', exitCode, durationMs, details: error.message ?? 'unknown test command error' },
      errorKind: timedOut ? 'timeout' : error.code === 'ENOENT' ? 'command-missing' : 'spawn'
    };
  }
  if (result.status === null && result.signal) {
    // A process killed by a signal (OOM killer, external kill) never reached an assertion verdict.
    return {
      receipt: { status: 'error', durationMs, details: boundedDetails(`test command terminated by signal ${result.signal}. ${commandDetails(result)}`) },
      errorKind: 'signal'
    };
  }
  return { receipt: { status: result.status === 0 ? 'pass' : 'fail', exitCode, durationMs, details: commandDetails(result) } };
}
export function runCommandReceipt(cwd: string, testCommand: string[], timeoutMs: number): ExecutionReceipt {
  return runCommand(cwd, testCommand, timeoutMs).receipt;
}
export function canonicalRuntimeMirrorRoots(runtimeMirrorRoots: string[] | undefined): string[] {
  const seen = new Set<string>();
  const roots: string[] = [];
  for (const candidate of runtimeMirrorRoots ?? ['dist']) {
    const normalized = normalizePath(candidate);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    roots.push(normalized);
  }
  return roots.length > 0 ? roots : ['dist'];
}
function mutationFingerprintFilePaths(repoRoot: string): string[] {
  return listFiles(repoRoot, { excludeDirs: MUTATION_WORKSPACE_EXCLUDES })
    .filter((filePath) => {
      if (filePath.split('/').some((segment) => MUTATION_WORKSPACE_EXCLUDE_SET.has(segment))) {
        return false;
      }
      const absolutePath = path.join(repoRoot, filePath);
      try {
        return fs.lstatSync(absolutePath).isFile();
      } catch {
        return false;
      }
    });
}
export function repoFileDigests(repoRoot: string): RepoFileDigest[] {
  return mutationFingerprintFilePaths(repoRoot)
    .map((filePath) => ({ filePath, digest: fileDigest(path.join(repoRoot, filePath)) }));
}
export function buildExecutionFingerprint(testCommand: string[], runtimeMirrorRoots: string[], repoFiles: RepoFileDigest[]): string {
  const effectiveEnv = mutationCommandEnv();
  return digestObject({
    mutationRuntimeVersion: MUTATION_RUNTIME_VERSION,
    testCommand,
    runtimeMirrorRoots,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    env: mutationEnvFingerprint(effectiveEnv),
    repoFiles
  });
}
export function manifestKey(repoRoot: string, site: MutationSite, executionFingerprint: string): string {
  const absolutePath = path.join(repoRoot, site.filePath);
  const fileText = fs.readFileSync(absolutePath, 'utf8');
  return digestObject({ site, sourceDigest: digestObject(fileText), executionFingerprint });
}
export function loadManifest(filePath: string | undefined): MutationManifest {
  if (!filePath || !fs.existsSync(filePath)) {
    return { version: '2', entries: {} };
  }
  const manifest = readJson<MutationManifest>(filePath);
  return manifest.version === '2' ? manifest : { version: '2', entries: {} };
}
export function saveManifest(filePath: string | undefined, manifest: MutationManifest): void {
  if (!filePath) {
    return;
  }
  writeJson(filePath, manifest);
}
