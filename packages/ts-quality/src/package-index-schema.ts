import path from 'path';
import { assertSafeRunId, stableStringify } from '../../evidence-model/src/index';

/**
 * Package artifact-reference index schema: the versioned shapes, the path rules every reference obeys, and the strict
 * reader for an untrusted index. The writer and inspector live in package-index.ts.
 */

export const PACKAGE_INDEX_KIND = 'ts-quality-package-index';
export const PACKAGE_INDEX_SCHEMA_VERSION = 1;
export const PACKAGE_INDEX_INSPECTION_KIND = 'ts-quality-package-index-inspection';
export const DEFAULT_PACKAGE_INDEX_PATH = '.ts-quality/package-index.json';

export interface PackageIndexFileRef {
  path: string;
  sha256: string;
  bytes: number;
}

export interface PackageIndexRun {
  runId: string;
  selection: 'explicit' | 'latest-pointer';
  createdAt: string;
  runVersion: string;
  changedFiles: string[];
  artifacts: PackageIndexFileRef[];
}

export interface PackageIndexEvidence {
  runId: string;
  changedFiles: string[];
}

export interface PackageIndexPackage {
  path: string;
  name: string | null;
  manifest: PackageIndexFileRef;
  status: 'evidence-present' | 'no-run-evidence';
  evidence: PackageIndexEvidence[];
}

export interface PackageIndex {
  kind: typeof PACKAGE_INDEX_KIND;
  schemaVersion: typeof PACKAGE_INDEX_SCHEMA_VERSION;
  tool: { name: 'ts-quality'; version: string };
  authority: 'references-only';
  scope: { mode: 'all' | 'selected'; discovery: 'package-json'; packages: string[] };
  runs: PackageIndexRun[];
  packages: PackageIndexPackage[];
  outsideIndexedPackages: PackageIndexEvidence[];
  completeness: { packageCount: number; withEvidence: number; withoutEvidence: string[]; complete: boolean; executedCoverageClaim: 'none' };
  upload: { root: '.'; paths: string[] };
}

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export function fail(message: string): never {
  throw new Error(message);
}

/** Code-unit order, independent of the process locale, so index bytes are identical everywhere. */
export function byCodeUnit(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** A root-relative POSIX path with no traversal, no absolute form and no control characters. */
export function assertRelativeReference(candidate: unknown, kind: string): string {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 4096) {
    return fail(`${kind} must be a non-empty relative path.`);
  }
  if (/[\u0000-\u001f\u007f\\]/u.test(candidate) || path.posix.isAbsolute(candidate) || path.win32.isAbsolute(candidate)) {
    return fail(`${kind} must be a relative POSIX path inside the root: ${JSON.stringify(candidate)}`);
  }
  const normalized = path.posix.normalize(candidate);
  if (normalized !== candidate || normalized === '..' || normalized.startsWith('../')) {
    return fail(`${kind} must stay inside the root in normalized form: ${JSON.stringify(candidate)}`);
  }
  return candidate;
}

export function manifestPath(packagePath: string): string {
  return packagePath === '.' ? 'package.json' : `${packagePath}/package.json`;
}

/** Longest enclosing package wins; the root package '.' encloses every file. */
export function owningPackage(filePath: string, packages: string[]): string | undefined {
  return packages
    .filter((entry) => entry === '.' || filePath === entry || filePath.startsWith(`${entry}/`))
    .sort((left, right) => right.length - left.length || byCodeUnit(left, right))[0];
}

function assertFileRef(value: unknown, kind: string): PackageIndexFileRef {
  const ref = value as Partial<PackageIndexFileRef> | null;
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
    return fail(`${kind} must be an object.`);
  }
  assertRelativeReference(ref.path, `${kind} path`);
  if (typeof ref.sha256 !== 'string' || !DIGEST_PATTERN.test(ref.sha256) || !Number.isSafeInteger(ref.bytes) || (ref.bytes as number) < 0) {
    return fail(`${kind} ${String(ref.path)} needs a sha256:<hex> digest and a byte count.`);
  }
  return ref as PackageIndexFileRef;
}

function stringArray(value: unknown, kind: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    return fail(`${kind} must be an array of strings.`);
  }
  return value as string[];
}

/**
 * Schema check for an untrusted index. Every known field is checked strictly and cross-checked (each run's changed
 * files are partitioned exactly once between packages and outsideIndexedPackages); unknown additive fields are ignored.
 */
export function parsePackageIndex(text: string, source: string): PackageIndex {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fail(`${source} is not valid JSON.`);
  }
  const index = value as Partial<PackageIndex> | null;
  if (!index || typeof index !== 'object' || Array.isArray(index) || index.kind !== PACKAGE_INDEX_KIND) {
    return fail(`${source} is not a ${PACKAGE_INDEX_KIND}.`);
  }
  if (index.schemaVersion !== PACKAGE_INDEX_SCHEMA_VERSION) {
    return fail(`${source} has unsupported package index schema version ${JSON.stringify(index.schemaVersion)}; this ts-quality reads ${PACKAGE_INDEX_SCHEMA_VERSION}.`);
  }
  const scope = index.scope as Partial<PackageIndex['scope']> | undefined;
  if (!scope || (scope.mode !== 'all' && scope.mode !== 'selected') || scope.discovery !== 'package-json') {
    return fail(`${source} has a malformed scope.`);
  }
  const scopePackages = stringArray(scope.packages, `${source} scope.packages`).map((entry) => entry === '.' ? entry : assertRelativeReference(entry, 'indexed package path'));
  if (!Array.isArray(index.runs) || !Array.isArray(index.packages) || !Array.isArray(index.outsideIndexedPackages)) {
    return fail(`${source} must list runs, packages and outsideIndexedPackages.`);
  }
  const isRecord = (value: unknown): boolean => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  if (![...index.runs, ...index.packages, ...index.outsideIndexedPackages].every(isRecord)) {
    return fail(`${source} runs, packages and outsideIndexedPackages must hold objects.`);
  }
  const runIds = new Set<string>();
  for (const run of index.runs as Array<Partial<PackageIndexRun>>) {
    if (typeof run.runId !== 'string') {
      fail(`${source} has a run without a runId.`);
    }
    const runId = assertSafeRunId(run.runId as string);
    if (runIds.has(runId) || (run.selection !== 'explicit' && run.selection !== 'latest-pointer') || typeof run.createdAt !== 'string' || typeof run.runVersion !== 'string') {
      fail(`${source} run ${runId} is malformed or duplicated.`);
    }
    runIds.add(runId);
    stringArray(run.changedFiles, `${source} run ${runId} changedFiles`).forEach((file) => assertRelativeReference(file, `run ${runId} changed file`));
    if (!Array.isArray(run.artifacts)) {
      fail(`${source} run ${runId} must list artifacts.`);
    }
    const artifacts = run.artifacts.map((ref) => assertFileRef(ref, `run ${runId} artifact`));
    if (!artifacts.some((ref) => ref.path === `.ts-quality/runs/${runId}/run.json`) || !artifacts.every((ref) => ref.path.startsWith(`.ts-quality/runs/${runId}/`))) {
      fail(`${source} run ${runId} artifacts must include its run.json and stay inside .ts-quality/runs/${runId}/.`);
    }
  }
  const evidenceRunsKnown = (evidence: unknown, kind: string): void => {
    if (!Array.isArray(evidence)) {
      fail(`${kind} evidence must be an array.`);
    }
    for (const entry of evidence as Array<Partial<PackageIndexEvidence>>) {
      if (!isRecord(entry) || !runIds.has(String(entry.runId))) {
        fail(`${kind} references run ${String(entry?.runId)} that the index does not list.`);
      }
      stringArray(entry.changedFiles, `${kind} changedFiles`).forEach((file) => assertRelativeReference(file, `${kind} changed file`));
    }
  };
  const packagePaths = new Set<string>();
  for (const entry of index.packages as Array<Partial<PackageIndexPackage>>) {
    const packagePath = entry?.path === '.' ? '.' : assertRelativeReference(entry?.path, 'indexed package path');
    if (packagePaths.has(packagePath) || !scopePackages.includes(packagePath)) {
      fail(`${source} package ${packagePath} is duplicated or outside the recorded scope.`);
    }
    packagePaths.add(packagePath);
    if (assertFileRef(entry.manifest, `package ${packagePath} manifest`).path !== manifestPath(packagePath)) {
      fail(`${source} package ${packagePath} manifest must be ${manifestPath(packagePath)}.`);
    }
    if ((entry.status !== 'evidence-present' && entry.status !== 'no-run-evidence') || (entry.name !== null && typeof entry.name !== 'string')) {
      fail(`${source} package ${packagePath} has a malformed status or name.`);
    }
    evidenceRunsKnown(entry.evidence, `package ${packagePath}`);
    if ((entry.status === 'evidence-present') !== ((entry.evidence as unknown[]).length > 0)) {
      fail(`${source} package ${packagePath} status disagrees with its evidence.`);
    }
  }
  if (packagePaths.size !== scopePackages.length) {
    fail(`${source} scope lists packages the index does not describe.`);
  }
  evidenceRunsKnown(index.outsideIndexedPackages, 'outsideIndexedPackages');
  assertEvidencePartition(index as PackageIndex, source);
  const packages = index.packages as PackageIndexPackage[];
  const withoutEvidence = packages.filter((entry) => entry.status === 'no-run-evidence').map((entry) => entry.path);
  const completeness = index.completeness as Partial<PackageIndex['completeness']> | undefined;
  if (!completeness || completeness.packageCount !== packages.length || completeness.withEvidence !== packages.length - withoutEvidence.length
    || stableStringify(completeness.withoutEvidence) !== stableStringify(withoutEvidence) || completeness.complete !== (withoutEvidence.length === 0)
    || completeness.executedCoverageClaim !== 'none') {
    fail(`${source} completeness disagrees with its packages.`);
  }
  const upload = index.upload as Partial<PackageIndex['upload']> | undefined;
  if (!upload || upload.root !== '.') {
    fail(`${source} has a malformed upload list.`);
  }
  stringArray(upload.paths, `${source} upload.paths`).forEach((entry) => assertRelativeReference(entry, 'upload path'));
  if (!index.tool || index.tool.name !== 'ts-quality' || typeof index.tool.version !== 'string' || index.authority !== 'references-only') {
    fail(`${source} has a malformed tool or authority field.`);
  }
  return index as PackageIndex;
}

/**
 * Each run's changed files must be attributed exactly once: to the deepest indexed package enclosing them, or to
 * outsideIndexedPackages. A package lists each run at most once. Anything else is a forged or corrupted index.
 */
function assertEvidencePartition(index: PackageIndex, source: string): void {
  const indexed = index.packages.map((entry) => entry.path);
  for (const run of index.runs) {
    const expected = [...new Set(run.changedFiles)].sort(byCodeUnit);
    if (expected.length !== run.changedFiles.length) {
      fail(`${source} run ${run.runId} lists a changed file twice.`);
    }
    const seen: string[] = [];
    for (const entry of index.packages) {
      const evidence = entry.evidence.filter((item) => item.runId === run.runId);
      if (evidence.length > 1) {
        fail(`${source} package ${entry.path} lists run ${run.runId} more than once.`);
      }
      for (const file of evidence[0]?.changedFiles ?? []) {
        if (owningPackage(file, indexed) !== entry.path) {
          fail(`${source} attributes ${file} to package ${entry.path}, which does not own it.`);
        }
        seen.push(file);
      }
    }
    const outside = index.outsideIndexedPackages.filter((item) => item.runId === run.runId);
    if (outside.length > 1) {
      fail(`${source} outsideIndexedPackages lists run ${run.runId} more than once.`);
    }
    seen.push(...(outside[0]?.changedFiles ?? []));
    if (stableStringify([...seen].sort(byCodeUnit)) !== stableStringify(expected)) {
      fail(`${source} run ${run.runId}: package evidence and outsideIndexedPackages must partition its changed files exactly.`);
    }
  }
}
