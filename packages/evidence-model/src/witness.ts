import fs from 'fs';
import path from 'path';
import {
  type ExecutionWitnessBinding,
  type ExecutionWitnessRecord,
  digestObject,
  fileDigest,
  resolveRepoLocalPath,
  stableStringify
} from './index';

// Only hashes are persisted; values may contain private execution settings.
const ENV_KEYS = ['PATH', 'NODE_OPTIONS', 'NODE_ENV', 'TZ', 'LANG', 'LC_ALL'];
const CONTEXT_NAMES = ['package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'tsconfig.json'];

function contentDigest(rootDir: string, file: string, allowMissing = false): string {
  const resolved = resolveRepoLocalPath(rootDir, file, { allowMissing, kind: 'execution witness binding' });
  if (resolved.relativePath !== file) throw new Error('noncanonical witness binding path');
  if (!fs.existsSync(resolved.absolutePath)) return 'sha256:missing';
  if (!fs.statSync(resolved.absolutePath).isFile()) throw new Error('witness binding requires a regular file');
  return fileDigest(resolved.absolutePath);
}

function contextFiles(files: string[]): string[] {
  const dirs = new Set(['.']);
  for (const file of files) {
    let dir = path.posix.dirname(file);
    while (dir !== '.') {
      dirs.add(dir);
      dir = path.posix.dirname(dir);
    }
  }
  return [...dirs].flatMap(dir => CONTEXT_NAMES.map(name => path.posix.join(dir, name))).sort();
}

export function createExecutionWitnessBinding(rootDir: string, sourceFiles: string[], testFiles: string[], command: string[], timeoutMs?: number): ExecutionWitnessBinding {
  const digests = (files: string[], allowMissing = false): Record<string, string> => Object.fromEntries(
    [...new Set(files)].sort().map(file => [file, contentDigest(rootDir, file, allowMissing)])
  );
  const basis = {
    version: '1' as const,
    sourceDigests: digests(sourceFiles),
    testDigests: digests(testFiles),
    contextDigests: digests(contextFiles([...sourceFiles, ...testFiles]), true),
    command: [...command],
    timeoutMs: timeoutMs ?? null,
    environmentDigest: digestObject(Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key] ?? null]))),
    runtime: { node: process.version, platform: process.platform, arch: process.arch }
  };
  return { ...basis, fingerprint: digestObject(basis) };
}

// lstat detects dangling links that existsSync/realpath cannot safely classify.
// Witness outputs intentionally disallow symlink components, even in-root ones.
export function assertExecutionWitnessOutputPath(rootDir: string, absolutePath: string): void {
  const relative = path.relative(path.resolve(rootDir), absolutePath);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('execution witness output must stay inside repository root');
  }
  let current = path.resolve(rootDir);
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error('execution witness output symlinks are not supported');
  }
}

// Execution-local mutation guard only: never persisted or used for pass selection.
// ctime/inode detect rewrite-and-restore that byte endpoint checks cannot see.
export function executionWitnessInputState(rootDir: string, binding: ExecutionWitnessBinding): string {
  const files = [...Object.keys(binding.sourceDigests), ...Object.keys(binding.testDigests), ...Object.keys(binding.contextDigests)];
  const entries = [...new Set(files)].sort().map(file => {
    const resolved = resolveRepoLocalPath(rootDir, file, { allowMissing: true, kind: 'execution witness binding' });
    let target = resolved.absolutePath;
    while (!fs.existsSync(target)) target = path.dirname(target);
    const stat = fs.statSync(target, { bigint: true });
    return [file, target, stat.dev.toString(), stat.ino.toString(), stat.size.toString(), stat.mtimeNs.toString(), stat.ctimeNs.toString()];
  });
  return stableStringify(entries);
}

export function executionWitnessBindingIssue(rootDir: string, record: ExecutionWitnessRecord): string | undefined {
  if (record.binding === undefined) return 'legacy unbound witness; rerun witness test or witness refresh to migrate';
  try {
    const binding = record.binding;
    if (binding.version !== '1' || !Array.isArray(binding.command) || binding.command.length === 0
      || binding.command.some(arg => typeof arg !== 'string' || arg.length === 0)
      || (binding.timeoutMs !== null && (!Number.isFinite(binding.timeoutMs) || binding.timeoutMs <= 0))) {
      return 'malformed execution binding; rerun witness';
    }
    const current = createExecutionWitnessBinding(rootDir, record.sourceFiles, record.testFiles ?? [], binding.command, binding.timeoutMs ?? undefined);
    if (stableStringify(binding) !== stableStringify(current)) return 'stale or malformed content/execution binding; rerun witness';
  } catch {
    return 'missing, unsafe or malformed content/execution binding; rerun witness';
  }
  return undefined;
}
