import fs from 'fs';
import path from 'path';
import { normalizePath } from './paths';
import { digestObject, fileDigest, readJson } from './text-io';
import {
  ChangedRegion,
  CoverageEvidence,
  LineSpan,
  MutationResult,
  PackageEntity,
  RepositoryEntity
} from './types-core';
import { PolicyFinding, Waiver } from './types-governance';

/** Source and test discovery, glob matching, coverage lookup, package inference, waivers and unified diffs. */

export const DEFAULT_SOURCE_PATTERNS = ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx', 'src/**/*.mjs', 'src/**/*.cjs'];
export const DEFAULT_TEST_PATTERNS = [
  'test/**/*.js',
  'test/**/*.mjs',
  'test/**/*.cjs',
  'test/**/*.ts',
  'test/**/*.tsx',
  'tests/**/*.js',
  'tests/**/*.mjs',
  'tests/**/*.cjs',
  'tests/**/*.ts',
  'tests/**/*.tsx',
  '**/*.test.js',
  '**/*.test.mjs',
  '**/*.test.cjs',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.js',
  '**/*.spec.mjs',
  '**/*.spec.cjs',
  '**/*.spec.ts',
  '**/*.spec.tsx'
] as const;
export function listFiles(rootDir: string, options?: { include?: RegExp; excludeDirs?: string[] }): string[] {
  const include = options?.include ?? /./;
  const excludeDirs = new Set((options?.excludeDirs ?? ['node_modules', 'dist', '.git', '.ts-quality']).map((item) => normalizePath(item)));
  const output: string[] = [];

  function visit(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentDir, entry.name);
      const relative = normalizePath(path.relative(rootDir, absolute));
      if (entry.isDirectory()) {
        if (excludeDirs.has(entry.name) || excludeDirs.has(relative)) {
          continue;
        }
        visit(absolute);
        continue;
      }
      if (include.test(relative)) {
        output.push(relative);
      }
    }
  }

  if (fs.existsSync(rootDir)) {
    visit(rootDir);
  }
  return output.sort();
}
function hasHiddenDirectory(filePath: string): boolean {
  return normalizePath(filePath).split('/').slice(0, -1).some((segment) => segment.startsWith('.') && segment !== '.' && segment !== '..');
}
function patternTargetsHiddenDirectory(pattern: string): boolean {
  return normalizePath(pattern).split('/').some((segment) => segment.startsWith('.') && segment !== '.' && segment !== '..');
}
/**
 * Pattern match for source/test discovery. Hidden directories (.next, .turbo, .cache, generated snapshots such as
 * .ontology/snapshots) hold tool state rather than repository code, so a broad pattern like `**\/*.test.ts` must not
 * reach into them; a pattern that names a hidden directory explicitly (for example `.storybook/**`) still does.
 */
export function matchesDiscoveryPattern(pattern: string, filePath: string): boolean {
  return matchPattern(pattern, filePath) && (!hasHiddenDirectory(filePath) || patternTargetsHiddenDirectory(pattern));
}
export function collectSourceFiles(rootDir: string, patterns: string[] = [...DEFAULT_SOURCE_PATTERNS]): string[] {
  const files = listFiles(rootDir, { include: /\.(ts|tsx|js|jsx|mjs|cjs)$/ });
  return files.filter((filePath) => patterns.some((pattern) => matchesDiscoveryPattern(pattern, filePath)));
}
export function globToRegExp(pattern: string): RegExp {
  const normalized = normalizePath(pattern);
  let output = '^';

  for (let index = 0; index < normalized.length; ) {
    if (normalized.slice(index, index + 3) === '**/') {
      output += '(?:.*/)?';
      index += 3;
      continue;
    }
    if (normalized.slice(index, index + 2) === '**') {
      output += '.*';
      index += 2;
      continue;
    }

    const current = normalized[index] ?? '';
    if (current === '*') {
      output += '[^/]*';
      index += 1;
      continue;
    }

    output += current.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    index += 1;
  }

  output += '$';
  return new RegExp(output);
}
export function matchPattern(pattern: string, value: string): boolean {
  const normalizedPattern = normalizePath(pattern);
  const normalizedValue = normalizePath(value);
  if (normalizedPattern.startsWith('path:')) {
    return matchPattern(normalizedPattern.slice(5), normalizedValue);
  }
  if (!normalizedPattern.includes('*')) {
    return normalizedPattern === normalizedValue;
  }
  return globToRegExp(normalizedPattern).test(normalizedValue);
}
export function matchesAny(patterns: string[], value: string): boolean {
  return patterns.some((pattern) => matchPattern(pattern, value));
}
export interface CoverageResolution {
  match: 'exact' | 'suffix' | 'missing' | 'ambiguous';
  evidence?: CoverageEvidence | undefined;
  candidates?: string[] | undefined;
}
export function resolveCoverageEvidence(filePath: string, coverage: CoverageEvidence[]): CoverageResolution {
  const normalized = normalizePath(filePath);
  const exact = coverage.find((item) => normalizePath(item.filePath) === normalized);
  if (exact) {
    return { match: 'exact', evidence: exact };
  }
  const suffixMatches = coverage.filter((item) => normalizePath(item.filePath).endsWith(`/${normalized}`));
  if (suffixMatches.length === 1) {
    return { match: 'suffix', evidence: suffixMatches[0] };
  }
  if (suffixMatches.length > 1) {
    return { match: 'ambiguous', candidates: suffixMatches.map((item) => normalizePath(item.filePath)).sort((left, right) => left.localeCompare(right)) };
  }
  return { match: 'missing' };
}
export function findCoverageEvidence(filePath: string, coverage: CoverageEvidence[]): CoverageEvidence | undefined {
  return resolveCoverageEvidence(filePath, coverage).evidence;
}
export function repoDigest(rootDir: string, filePaths: string[]): string {
  const entries = filePaths.map((filePath) => ({ filePath, digest: fileDigest(path.join(rootDir, filePath)) }));
  return digestObject(entries);
}
export function inferPackages(rootDir: string): PackageEntity[] {
  const packageJsonFiles = listFiles(rootDir, { include: /package\.json$/ });
  return packageJsonFiles.map((filePath) => {
    const packageDir = normalizePath(path.dirname(filePath));
    const packageJson = readJson<{ name?: string }>(path.join(rootDir, filePath));
    return {
      name: packageJson.name ?? packageDir,
      dir: packageDir === '.' ? '' : packageDir
    };
  });
}
export function resolvePackageName(filePath: string, packages: PackageEntity[]): string | undefined {
  const normalized = normalizePath(filePath);
  const match = packages
    .filter((entry) => normalized === entry.dir || normalized.startsWith(`${entry.dir}/`) || entry.dir === '')
    .sort((left, right) => right.dir.length - left.dir.length)[0];
  return match?.name;
}
export function buildRepositoryEntity(rootDir: string, filePaths: string[]): RepositoryEntity {
  const packages = inferPackages(rootDir);
  return {
    rootDir: normalizePath(rootDir),
    name: path.basename(rootDir),
    packages,
    digest: repoDigest(rootDir, filePaths)
  };
}
export function loadOptionalJsonArray<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return readJson<T[]>(filePath);
}
export function isWaiverActive(waiver: Waiver, nowIso: string): boolean {
  if (!waiver.expiresAt) {
    return true;
  }
  return new Date(nowIso).getTime() <= new Date(waiver.expiresAt).getTime();
}
export function isFindingWaived(finding: PolicyFinding, waivers: Waiver[], nowIso: string): Waiver | undefined {
  return waivers.find((waiver) => waiver.ruleId === (finding.ruleId ?? finding.code) && isWaiverActive(waiver, nowIso) && finding.scope.every((scope) => waiver.scope.some((item) => matchPattern(item, scope) || item === scope)));
}
export function parseUnifiedDiff(diffText: string): ChangedRegion[] {
  const regions: ChangedRegion[] = [];
  let currentFile: string | undefined;
  let counter = 0;
  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      currentFile = normalizePath(line.slice(6));
      continue;
    }
    const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (match && currentFile) {
      const startLine = Number(match[1]);
      const lineCount = Number(match[2] ?? '1');
      regions.push({
        filePath: currentFile,
        hunkId: `hunk-${counter++}`,
        span: {
          startLine,
          endLine: startLine + Math.max(lineCount - 1, 0)
        }
      });
    }
  }
  return regions;
}
export function summarizeMutationScore(results: MutationResult[]): { killed: number; survived: number; total: number; measured: boolean; score: number } {
  const killed = results.filter((result) => result.status === 'killed').length;
  const survived = results.filter((result) => result.status === 'survived').length;
  const total = killed + survived;
  return {
    killed,
    survived,
    total,
    measured: total > 0,
    score: total === 0 ? 0 : killed / total
  };
}
export function changedFileSet(changedFiles: string[], changedRegions: ChangedRegion[]): Set<string> {
  return new Set([...changedFiles.map((item) => normalizePath(item)), ...changedRegions.map((item) => normalizePath(item.filePath))]);
}
export function spanOverlaps(line: number, span: LineSpan): boolean {
  return line >= span.startLine && line <= span.endLine;
}
