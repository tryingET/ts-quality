import fs from 'fs';
import path from 'path';
import {
  type PolicyFinding,
  type RunArtifact,
  assertSafeRunId,
  listFiles,
  normalizePath,
  readJson,
  renderSafeText,
  sha256Hex,
  stableStringify
} from '../../evidence-model/src/index';
import {
  DEFAULT_PACKAGE_INDEX_PATH,
  PACKAGE_INDEX_INSPECTION_KIND,
  PACKAGE_INDEX_KIND,
  PACKAGE_INDEX_SCHEMA_VERSION,
  type PackageIndex,
  type PackageIndexEvidence,
  type PackageIndexFileRef,
  type PackageIndexPackage,
  type PackageIndexRun,
  assertRelativeReference,
  byCodeUnit,
  fail,
  manifestPath,
  owningPackage,
  parsePackageIndex
} from './package-index-schema';

export {
  DEFAULT_PACKAGE_INDEX_PATH,
  PACKAGE_INDEX_INSPECTION_KIND,
  PACKAGE_INDEX_KIND,
  PACKAGE_INDEX_SCHEMA_VERSION,
  parsePackageIndex
};
export type { PackageIndex, PackageIndexEvidence, PackageIndexFileRef, PackageIndexPackage, PackageIndexRun };

/**
 * Package artifact-reference index writer and inspector: which packages exist (directories with a package.json), which
 * runs hold evidence for them, and digests of the canonical run packet files. It only references; it copies no verdict,
 * computes no plan and claims no coverage. inspect re-reads every reference and reports facts, never approval.
 */

export interface PackageIndexDeps {
  /** Loads a run with repository containment and a supported run version. */
  loadRun(rootDir: string, runId: string): RunArtifact;
  latestRunId(rootDir: string): string;
  /** Every file the run's verdict depends on (changed files, control plane) with the digest recorded at check time. */
  driftSubjects(run: RunArtifact): Array<{ subject: string; path: unknown; expected: string }>;
  toolVersion: string;
}

export type ReferenceState = 'fresh' | 'changed' | 'missing';

/**
 * Resolves a root-relative path segment by segment with lstat, so no symbolic link is ever followed. Returns
 * undefined when the path does not exist; refuses symlinks and non-regular files.
 */
function containedFile(rootReal: string, relative: string, kind: string): string | undefined {
  let current = rootReal;
  const segments = relative.split('/');
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' || (error as NodeJS.ErrnoException).code === 'ENOTDIR') {
        return undefined;
      }
      throw error;
    }
    if (stat.isSymbolicLink()) {
      return fail(`${kind} ${relative} traverses a symbolic link; references must be regular files inside the root.`);
    }
    const last = index === segments.length - 1;
    if (!last && !stat.isDirectory()) {
      return undefined;
    }
    if (last && !stat.isFile()) {
      return fail(`${kind} ${relative} is not a regular file.`);
    }
  }
  return current;
}

/** Digest of a contained regular file, 'sha256:missing' when absent; refuses unsafe paths, symlinks and non-files. */
function containedDigest(rootReal: string, relative: unknown, kind: string): string {
  if (typeof relative !== 'string' || path.posix.isAbsolute(relative) || path.win32.isAbsolute(relative)) {
    return fail(`${kind} path must be a relative path inside the root: ${JSON.stringify(relative)}`);
  }
  const absolute = containedFile(rootReal, assertRelativeReference(normalizePath(relative), kind), kind);
  return absolute ? `sha256:${sha256Hex(fs.readFileSync(absolute))}` : 'sha256:missing';
}

function indexedRun(index: PackageIndex, runId: string): PackageIndexRun {
  return index.runs.find((run) => run.runId === runId) ?? fail(`package index lists no run ${runId}.`);
}

function fileRef(rootReal: string, relative: string, kind: string): PackageIndexFileRef {
  const absolute = containedFile(rootReal, relative, kind) ?? fail(`${kind} not found: ${relative}`);
  const bytes = fs.readFileSync(absolute);
  return { path: relative, sha256: `sha256:${sha256Hex(bytes)}`, bytes: bytes.length };
}

function referenceState(rootReal: string, ref: PackageIndexFileRef, kind: string): ReferenceState {
  const absolute = containedFile(rootReal, ref.path, kind);
  if (!absolute) {
    return 'missing';
  }
  return `sha256:${sha256Hex(fs.readFileSync(absolute))}` === ref.sha256 ? 'fresh' : 'changed';
}

/** Directories that contain a package.json, outside node_modules, dist, .git and .ts-quality (the ones check skips). */
export function discoverIndexPackages(rootDir: string): string[] {
  return listFiles(rootDir, { include: /(?:^|\/)package\.json$/u })
    .map((manifest) => normalizePath(path.posix.dirname(manifest)) || '.')
    .sort(byCodeUnit);
}

function runPacketFiles(rootReal: string, runId: string): string[] {
  const runDir = `.ts-quality/runs/${runId}`;
  const publication = containedFile(rootReal, `${runDir}/publication.json`, 'run publication record');
  if (publication) {
    const record = readJson<{ files?: unknown }>(publication);
    const files = Array.isArray(record.files) ? record.files : fail(`Run ${runId} has a malformed publication record.`);
    const listed = files.map((file) => assertRelativeReference(file, `run ${runId} packet file`));
    return [...new Set([...listed, 'publication.json'])].map((file) => `${runDir}/${file}`).sort(byCodeUnit);
  }
  // Older packets carry no publication record: reference every regular file of the run directory.
  const absoluteRunDir = path.join(rootReal, runDir);
  return listFiles(absoluteRunDir, { excludeDirs: [] }).map((file) => `${runDir}/${file}`).sort(byCodeUnit);
}

function selectPackages(rootReal: string, options: { packages?: string[]; all?: boolean }): { mode: 'all' | 'selected'; packages: string[] } {
  const hasSelection = options.packages !== undefined && options.packages.length > 0;
  if (hasSelection === Boolean(options.all)) {
    return fail('Name the packages to index with --package <dir[,dir]> or index every discovered package with --all (exactly one).');
  }
  const discovered = discoverIndexPackages(rootReal);
  if (options.all) {
    if (discovered.length === 0) {
      return fail('No package.json was found under the root; there is no package to index.');
    }
    return { mode: 'all', packages: discovered };
  }
  const selected = [...new Set((options.packages ?? []).map((entry) => normalizePath(entry) || '.'))].sort(byCodeUnit);
  for (const entry of selected) {
    if (!discovered.includes(entry)) {
      fail(`--package ${entry} is not a discovered package directory (a directory with a package.json under the root). Known: ${discovered.join(', ') || 'none'}.`);
    }
  }
  return { mode: 'selected', packages: selected };
}

/** Resolves an absolute path through its deepest existing ancestor, so a symlinked root still matches. */
function canonicalAbsolute(candidate: string): string {
  let existing = path.resolve(candidate);
  const tail: string[] = [];
  while (!fs.existsSync(existing) && path.dirname(existing) !== existing) {
    tail.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  return path.join(fs.realpathSync(existing), ...tail);
}

function resolveIndexPath(rootReal: string, candidate: string | undefined, kind: string): string {
  const raw = candidate ?? DEFAULT_PACKAGE_INDEX_PATH;
  const relative = path.isAbsolute(raw) ? path.relative(rootReal, canonicalAbsolute(raw)).split(path.sep).join('/') : raw;
  assertRelativeReference(relative, kind);
  // Case-insensitive, because .ts-quality/Runs is the same directory on case-insensitive file systems.
  const lowered = relative.toLowerCase();
  if (lowered === '.ts-quality/runs' || lowered.startsWith('.ts-quality/runs/')) {
    return fail(`${kind} must not be inside .ts-quality/runs: run packets are immutable.`);
  }
  return relative;
}

/** Builds and atomically writes the index. Identical repository state and run selection give identical bytes. */
export function writePackageIndex(rootDir: string, options: { packages?: string[]; all?: boolean; runIds?: string[]; out?: string }, deps: PackageIndexDeps): { index: PackageIndex; indexPath: string } {
  const rootReal = fs.realpathSync(rootDir);
  const scope = selectPackages(rootReal, options);
  const indexPath = resolveIndexPath(rootReal, options.out, 'package index output');
  const explicitIds = options.runIds ?? [];
  const selection: PackageIndexRun['selection'] = explicitIds.length > 0 ? 'explicit' : 'latest-pointer';
  const runIds = [...new Set(explicitIds.length > 0 ? explicitIds : [deps.latestRunId(rootReal)])].map((runId) => assertSafeRunId(runId));
  const runs = runIds.map((runId) => {
    const run = deps.loadRun(rootReal, runId);
    return {
      runId,
      selection,
      createdAt: run.createdAt,
      runVersion: String(run.version),
      changedFiles: [...new Set(run.changedFiles.map((file) => normalizePath(file)))].sort(byCodeUnit),
      artifacts: runPacketFiles(rootReal, runId).map((file) => fileRef(rootReal, file, `run ${runId} packet file`))
    } satisfies PackageIndexRun;
  }).sort((left, right) => byCodeUnit(left.runId, right.runId));

  // Ownership uses every discovered package, so a file of an unselected package is never attributed to a selected one.
  const allPackages = discoverIndexPackages(rootReal);
  const evidenceByPackage = new Map<string, PackageIndexEvidence[]>(scope.packages.map((entry) => [entry, []]));
  const outside: PackageIndexEvidence[] = [];
  for (const run of runs) {
    const grouped = new Map<string, string[]>();
    const unowned: string[] = [];
    for (const file of run.changedFiles) {
      const owner = owningPackage(file, allPackages);
      if (owner !== undefined && evidenceByPackage.has(owner)) {
        grouped.set(owner, [...(grouped.get(owner) ?? []), file]);
      } else {
        unowned.push(file);
      }
    }
    for (const [owner, files] of grouped) {
      evidenceByPackage.get(owner)?.push({ runId: run.runId, changedFiles: files });
    }
    if (unowned.length > 0) {
      outside.push({ runId: run.runId, changedFiles: unowned });
    }
  }

  const packages = scope.packages.map((entry): PackageIndexPackage => {
    const manifest = fileRef(rootReal, manifestPath(entry), `package ${entry} manifest`);
    const parsed = readJson<{ name?: unknown }>(path.join(rootReal, manifest.path));
    const evidence = evidenceByPackage.get(entry) ?? [];
    return {
      path: entry,
      name: typeof parsed.name === 'string' ? parsed.name : null,
      manifest,
      status: evidence.length > 0 ? 'evidence-present' : 'no-run-evidence',
      evidence
    };
  });
  const withoutEvidence = packages.filter((entry) => entry.status === 'no-run-evidence').map((entry) => entry.path);
  const index: PackageIndex = {
    kind: PACKAGE_INDEX_KIND,
    schemaVersion: PACKAGE_INDEX_SCHEMA_VERSION,
    tool: { name: 'ts-quality', version: deps.toolVersion },
    authority: 'references-only',
    scope: { mode: scope.mode, discovery: 'package-json', packages: scope.packages },
    runs,
    packages,
    outsideIndexedPackages: outside,
    completeness: {
      packageCount: packages.length,
      withEvidence: packages.length - withoutEvidence.length,
      withoutEvidence,
      complete: withoutEvidence.length === 0,
      executedCoverageClaim: 'none'
    },
    upload: {
      root: '.',
      paths: [...new Set([indexPath, ...runs.flatMap((run) => run.artifacts.map((ref) => ref.path)), ...packages.map((entry) => entry.manifest.path)])]
        .sort(byCodeUnit)
    }
  };
  writeAtomically(rootReal, indexPath, `${stableStringify(index)}\n`);
  return { index, indexPath };
}

function writeAtomically(rootReal: string, relative: string, contents: string): void {
  const absolute = path.join(rootReal, relative);
  const parent = path.posix.dirname(relative);
  if (parent !== '.') {
    // Refuse a symlinked or non-directory parent before creating anything, then create what is missing.
    let current = rootReal;
    for (const segment of parent.split('/')) {
      current = path.join(current, segment);
      const stat = fs.lstatSync(current, { throwIfNoEntry: false });
      if (!stat) {
        break;
      }
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        fail(`package index output ${relative} must not traverse a symbolic link or a file.`);
      }
    }
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
  }
  const existing = fs.lstatSync(absolute, { throwIfNoEntry: false });
  if (existing && !existing.isFile()) {
    fail(`package index output ${relative} exists and is not a regular file.`);
  }
  const temporary = `${absolute}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, contents, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temporary, absolute);
}

export interface PackageQualityFacts {
  runId: string;
  state: 'available' | 'unavailable';
  reason?: string;
  runOutcome?: string;
  runMergeConfidence?: number;
  findingsInPackage?: { error: number; warn: number; info: number };
  /** current: the evaluated source still matches; drifted: it changed; unavailable: it is absent here (for example an uploaded copy). */
  source?: { state: 'current' | 'drifted' | 'unavailable'; subjects: string[] };
}

export interface PackageIndexInspection {
  kind: typeof PACKAGE_INDEX_INSPECTION_KIND;
  version: '1';
  authority: string;
  index: { path: string; sha256: string; toolVersion: string };
  filter: string[] | null;
  references: { fresh: number; changed: number; missing: number; state: 'fresh' | 'stale' };
  enumeration: { mode: 'all' | 'selected'; state: 'current' | 'changed' | 'not-applicable'; added: string[]; removed: string[] };
  completeness: PackageIndex['completeness'];
  outsideIndexedPackages: PackageIndexEvidence[];
  runs: Array<{ runId: string; selection: PackageIndexRun['selection']; artifacts: Array<{ path: string; state: ReferenceState }> }>;
  /** current: references fresh and source unchanged; source-unavailable: references fresh, source absent; stale: something changed. */
  packages: Array<{ path: string; name: string | null; status: PackageIndexPackage['status']; manifest: ReferenceState; state: 'current' | 'source-unavailable' | 'stale' | 'no-run-evidence'; quality: PackageQualityFacts[] }>;
}

/** A finding counts for a package when its scope names one of the package's changed files in that run. */
function countFindings(findings: PolicyFinding[], files: string[]): { error: number; warn: number; info: number } {
  const owned = new Set(files);
  const counts = { error: 0, warn: 0, info: 0 };
  for (const finding of findings) {
    const inPackage = finding.scope.some((entry) => owned.has(normalizePath(entry)));
    if (inPackage && (finding.level === 'error' || finding.level === 'warn' || finding.level === 'info')) {
      counts[finding.level] += 1;
    }
  }
  return counts;
}

/** Re-reads every reference of an index and reports facts. Read-only; refusals (schema, containment) throw. */
export function inspectPackageIndex(rootDir: string, options: { index?: string; packages?: string[] }, deps: PackageIndexDeps): PackageIndexInspection {
  const rootReal = fs.realpathSync(rootDir);
  const indexPath = resolveIndexPath(rootReal, options.index, 'package index');
  const absolute = containedFile(rootReal, indexPath, 'package index') ?? fail(`package index not found: ${indexPath}`);
  const bytes = fs.readFileSync(absolute);
  const index = parsePackageIndex(bytes.toString('utf8'), indexPath);
  const filter = options.packages && options.packages.length > 0
    ? [...new Set(options.packages.map((entry) => normalizePath(entry) || '.'))].sort(byCodeUnit)
    : null;
  for (const entry of filter ?? []) {
    if (!index.packages.some((item) => item.path === entry)) {
      fail(`--package ${entry} is not in the index. Indexed: ${index.packages.map((item) => item.path).join(', ')}.`);
    }
  }
  const selectedPackages = index.packages.filter((entry) => !filter || filter.includes(entry.path));
  const selectedRunIds = new Set(filter ? selectedPackages.flatMap((entry) => entry.evidence.map((item) => item.runId)) : index.runs.map((run) => run.runId));
  const selectedRuns = index.runs.filter((run) => selectedRunIds.has(run.runId));

  const counts = { fresh: 0, changed: 0, missing: 0 };
  const tally = (state: ReferenceState): ReferenceState => {
    counts[state] += 1;
    return state;
  };
  const runStates = new Map<string, boolean>();
  const runs = selectedRuns.map((run) => {
    const artifacts = run.artifacts.map((ref) => ({ path: ref.path, state: tally(referenceState(rootReal, ref, `run ${run.runId} artifact`)) }));
    runStates.set(run.runId, artifacts.every((item) => item.state === 'fresh'));
    return { runId: run.runId, selection: run.selection, artifacts };
  });
  const loaded = new Map<string, RunArtifact | string>();
  const loadIndexedRun = (runId: string): RunArtifact | string => {
    if (!loaded.has(runId)) {
      if (!runStates.get(runId)) {
        loaded.set(runId, 'run packet changed or missing since indexing');
      } else {
        try {
          loaded.set(runId, deps.loadRun(rootReal, runId));
        } catch (error) {
          loaded.set(runId, error instanceof Error ? error.message : String(error));
        }
      }
    }
    return loaded.get(runId) as RunArtifact | string;
  };
  const packages = selectedPackages.map((entry) => {
    const manifest = tally(referenceState(rootReal, entry.manifest, `package ${entry.path} manifest`));
    const quality = entry.evidence.map((evidence): PackageQualityFacts => {
      const run = loadIndexedRun(evidence.runId);
      if (typeof run === 'string') {
        return { runId: evidence.runId, state: 'unavailable', reason: run };
      }
      const recorded = indexedRun(index, evidence.runId).changedFiles;
      const actualChanged = [...new Set(run.changedFiles.map((file) => normalizePath(file)))].sort(byCodeUnit);
      if (stableStringify(actualChanged) !== stableStringify(recorded)) {
        fail(`${indexPath} run ${evidence.runId} lists changed files that differ from its run packet.`);
      }
      const subjects = deps.driftSubjects(run).map((item) => ({ ...item, actual: containedDigest(rootReal, item.path, `run ${evidence.runId} ${item.subject}`) }));
      const drift = subjects.filter((item) => item.actual !== item.expected);
      // Unavailable only when every evaluated file is absent (an uploaded copy); a single deleted file is drift.
      const sourceState = drift.length === 0 ? 'current' : subjects.every((item) => item.actual === 'sha256:missing') ? 'unavailable' : 'drifted';
      return {
        runId: evidence.runId,
        state: 'available',
        runOutcome: run.verdict.outcome,
        runMergeConfidence: run.verdict.mergeConfidence,
        findingsInPackage: countFindings(run.verdict.findings, evidence.changedFiles),
        source: { state: sourceState, subjects: drift.map((item) => item.subject).sort(byCodeUnit) }
      };
    });
    const stale = manifest !== 'fresh' || quality.some((item) => item.state === 'unavailable' || item.source?.state === 'drifted');
    const unverified = quality.some((item) => item.source?.state === 'unavailable');
    const state: PackageIndexInspection['packages'][number]['state'] = entry.status === 'no-run-evidence'
      ? 'no-run-evidence'
      : stale ? 'stale' : unverified ? 'source-unavailable' : 'current';
    return { path: entry.path, name: entry.name, status: entry.status, manifest, state, quality };
  });

  let enumeration: PackageIndexInspection['enumeration'] = { mode: index.scope.mode, state: 'not-applicable', added: [], removed: [] };
  if (index.scope.mode === 'all') {
    const current = discoverIndexPackages(rootReal);
    const added = current.filter((entry) => !index.scope.packages.includes(entry));
    const removed = index.scope.packages.filter((entry) => !current.includes(entry));
    enumeration = { mode: 'all', state: added.length === 0 && removed.length === 0 ? 'current' : 'changed', added, removed };
  }
  return {
    kind: PACKAGE_INDEX_INSPECTION_KIND,
    version: '1',
    authority: 'facts only: not a verdict, approval, release permission or executed-coverage claim',
    index: { path: indexPath, sha256: `sha256:${sha256Hex(bytes)}`, toolVersion: index.tool.version },
    filter,
    references: { ...counts, state: counts.changed === 0 && counts.missing === 0 ? 'fresh' : 'stale' },
    enumeration,
    completeness: index.completeness,
    outsideIndexedPackages: filter ? [] : index.outsideIndexedPackages,
    runs,
    packages
  };
}

export function renderPackageIndexWrite(index: PackageIndex, indexPath: string): string {
  return [
    `Package index written: ${indexPath}`,
    `Packages: ${index.completeness.packageCount} (${index.scope.mode}); with run evidence: ${index.completeness.withEvidence}; without: ${index.completeness.withoutEvidence.join(', ') || 'none'}`,
    `Runs: ${index.runs.map((run) => `${run.runId} (${run.selection})`).join(', ')}`,
    `Files to upload with the index: ${index.upload.paths.length}`,
    'References only: not a verdict, approval or executed-coverage claim.',
    ''
  ].join('\n');
}

export function renderPackageIndexInspection(inspection: PackageIndexInspection): string {
  const lines = [
    `Package index: ${renderSafeText(inspection.index.path)} (${inspection.index.sha256})`,
    `References: ${inspection.references.state} (fresh ${inspection.references.fresh}, changed ${inspection.references.changed}, missing ${inspection.references.missing})`,
    `Enumeration: ${inspection.enumeration.state}${inspection.enumeration.added.length > 0 ? `; added ${inspection.enumeration.added.join(', ')}` : ''}${inspection.enumeration.removed.length > 0 ? `; removed ${inspection.enumeration.removed.join(', ')}` : ''}`,
    `Indexed completeness: ${inspection.completeness.withEvidence}/${inspection.completeness.packageCount} packages with run evidence`
  ];
  for (const entry of inspection.packages) {
    // Paths, names and reasons can come from an uploaded artifact: render them inert.
    lines.push(`- ${renderSafeText(entry.path)}${entry.name ? ` (${renderSafeText(entry.name)})` : ''}: ${entry.state}; manifest ${entry.manifest}`);
    for (const quality of entry.quality) {
      lines.push(quality.state === 'available'
        ? `  run ${quality.runId}: outcome ${quality.runOutcome} (run-wide), findings in package error ${quality.findingsInPackage?.error ?? 0} warn ${quality.findingsInPackage?.warn ?? 0}; source ${quality.source?.state}`
        : `  run ${quality.runId}: unavailable (${renderSafeText(quality.reason ?? '')})`);
    }
  }
  lines.push(inspection.authority, '');
  return lines.join('\n');
}
