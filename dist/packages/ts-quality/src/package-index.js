"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePackageIndex = exports.PACKAGE_INDEX_SCHEMA_VERSION = exports.PACKAGE_INDEX_KIND = exports.PACKAGE_INDEX_INSPECTION_KIND = exports.DEFAULT_PACKAGE_INDEX_PATH = void 0;
exports.discoverIndexPackages = discoverIndexPackages;
exports.writePackageIndex = writePackageIndex;
exports.inspectPackageIndex = inspectPackageIndex;
exports.renderPackageIndexWrite = renderPackageIndexWrite;
exports.renderPackageIndexInspection = renderPackageIndexInspection;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../../evidence-model/src/index");
const package_index_schema_1 = require("./package-index-schema");
Object.defineProperty(exports, "DEFAULT_PACKAGE_INDEX_PATH", { enumerable: true, get: function () { return package_index_schema_1.DEFAULT_PACKAGE_INDEX_PATH; } });
Object.defineProperty(exports, "PACKAGE_INDEX_INSPECTION_KIND", { enumerable: true, get: function () { return package_index_schema_1.PACKAGE_INDEX_INSPECTION_KIND; } });
Object.defineProperty(exports, "PACKAGE_INDEX_KIND", { enumerable: true, get: function () { return package_index_schema_1.PACKAGE_INDEX_KIND; } });
Object.defineProperty(exports, "PACKAGE_INDEX_SCHEMA_VERSION", { enumerable: true, get: function () { return package_index_schema_1.PACKAGE_INDEX_SCHEMA_VERSION; } });
Object.defineProperty(exports, "parsePackageIndex", { enumerable: true, get: function () { return package_index_schema_1.parsePackageIndex; } });
/**
 * Resolves a root-relative path segment by segment with lstat, so no symbolic link is ever followed. Returns
 * undefined when the path does not exist; refuses symlinks and non-regular files.
 */
function containedFile(rootReal, relative, kind) {
    let current = rootReal;
    const segments = relative.split('/');
    for (const [index, segment] of segments.entries()) {
        current = path_1.default.join(current, segment);
        let stat;
        try {
            stat = fs_1.default.lstatSync(current);
        }
        catch (error) {
            if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
                return undefined;
            }
            throw error;
        }
        if (stat.isSymbolicLink()) {
            return (0, package_index_schema_1.fail)(`${kind} ${relative} traverses a symbolic link; references must be regular files inside the root.`);
        }
        const last = index === segments.length - 1;
        if (!last && !stat.isDirectory()) {
            return undefined;
        }
        if (last && !stat.isFile()) {
            return (0, package_index_schema_1.fail)(`${kind} ${relative} is not a regular file.`);
        }
    }
    return current;
}
/** Digest of a contained regular file, 'sha256:missing' when absent; refuses unsafe paths, symlinks and non-files. */
function containedDigest(rootReal, relative, kind) {
    if (typeof relative !== 'string' || path_1.default.posix.isAbsolute(relative) || path_1.default.win32.isAbsolute(relative)) {
        return (0, package_index_schema_1.fail)(`${kind} path must be a relative path inside the root: ${JSON.stringify(relative)}`);
    }
    const absolute = containedFile(rootReal, (0, package_index_schema_1.assertRelativeReference)((0, index_1.normalizePath)(relative), kind), kind);
    return absolute ? `sha256:${(0, index_1.sha256Hex)(fs_1.default.readFileSync(absolute))}` : 'sha256:missing';
}
function indexedRun(index, runId) {
    return index.runs.find((run) => run.runId === runId) ?? (0, package_index_schema_1.fail)(`package index lists no run ${runId}.`);
}
function fileRef(rootReal, relative, kind) {
    const absolute = containedFile(rootReal, relative, kind) ?? (0, package_index_schema_1.fail)(`${kind} not found: ${relative}`);
    const bytes = fs_1.default.readFileSync(absolute);
    return { path: relative, sha256: `sha256:${(0, index_1.sha256Hex)(bytes)}`, bytes: bytes.length };
}
function referenceState(rootReal, ref, kind) {
    const absolute = containedFile(rootReal, ref.path, kind);
    if (!absolute) {
        return 'missing';
    }
    return `sha256:${(0, index_1.sha256Hex)(fs_1.default.readFileSync(absolute))}` === ref.sha256 ? 'fresh' : 'changed';
}
/** Directories that contain a package.json, outside node_modules, dist, .git and .ts-quality (the ones check skips). */
function discoverIndexPackages(rootDir) {
    return (0, index_1.listFiles)(rootDir, { include: /(?:^|\/)package\.json$/u })
        .map((manifest) => (0, index_1.normalizePath)(path_1.default.posix.dirname(manifest)) || '.')
        .sort(package_index_schema_1.byCodeUnit);
}
function runPacketFiles(rootReal, runId) {
    const runDir = `.ts-quality/runs/${runId}`;
    const publication = containedFile(rootReal, `${runDir}/publication.json`, 'run publication record');
    if (publication) {
        const record = (0, index_1.readJson)(publication);
        const files = Array.isArray(record.files) ? record.files : (0, package_index_schema_1.fail)(`Run ${runId} has a malformed publication record.`);
        const listed = files.map((file) => (0, package_index_schema_1.assertRelativeReference)(file, `run ${runId} packet file`));
        return [...new Set([...listed, 'publication.json'])].map((file) => `${runDir}/${file}`).sort(package_index_schema_1.byCodeUnit);
    }
    // Older packets carry no publication record: reference every regular file of the run directory.
    const absoluteRunDir = path_1.default.join(rootReal, runDir);
    return (0, index_1.listFiles)(absoluteRunDir, { excludeDirs: [] }).map((file) => `${runDir}/${file}`).sort(package_index_schema_1.byCodeUnit);
}
function selectPackages(rootReal, options) {
    const hasSelection = options.packages !== undefined && options.packages.length > 0;
    if (hasSelection === Boolean(options.all)) {
        return (0, package_index_schema_1.fail)('Name the packages to index with --package <dir[,dir]> or index every discovered package with --all (exactly one).');
    }
    const discovered = discoverIndexPackages(rootReal);
    if (options.all) {
        if (discovered.length === 0) {
            return (0, package_index_schema_1.fail)('No package.json was found under the root; there is no package to index.');
        }
        return { mode: 'all', packages: discovered };
    }
    const selected = [...new Set((options.packages ?? []).map((entry) => (0, index_1.normalizePath)(entry) || '.'))].sort(package_index_schema_1.byCodeUnit);
    for (const entry of selected) {
        if (!discovered.includes(entry)) {
            (0, package_index_schema_1.fail)(`--package ${entry} is not a discovered package directory (a directory with a package.json under the root). Known: ${discovered.join(', ') || 'none'}.`);
        }
    }
    return { mode: 'selected', packages: selected };
}
/** Resolves an absolute path through its deepest existing ancestor, so a symlinked root still matches. */
function canonicalAbsolute(candidate) {
    let existing = path_1.default.resolve(candidate);
    const tail = [];
    while (!fs_1.default.existsSync(existing) && path_1.default.dirname(existing) !== existing) {
        tail.unshift(path_1.default.basename(existing));
        existing = path_1.default.dirname(existing);
    }
    return path_1.default.join(fs_1.default.realpathSync(existing), ...tail);
}
function resolveIndexPath(rootReal, candidate, kind) {
    const raw = candidate ?? package_index_schema_1.DEFAULT_PACKAGE_INDEX_PATH;
    const relative = path_1.default.isAbsolute(raw) ? path_1.default.relative(rootReal, canonicalAbsolute(raw)).split(path_1.default.sep).join('/') : raw;
    (0, package_index_schema_1.assertRelativeReference)(relative, kind);
    // Case-insensitive, because .ts-quality/Runs is the same directory on case-insensitive file systems.
    const lowered = relative.toLowerCase();
    if (lowered === '.ts-quality/runs' || lowered.startsWith('.ts-quality/runs/')) {
        return (0, package_index_schema_1.fail)(`${kind} must not be inside .ts-quality/runs: run packets are immutable.`);
    }
    return relative;
}
/** Builds and atomically writes the index. Identical repository state and run selection give identical bytes. */
function writePackageIndex(rootDir, options, deps) {
    const rootReal = fs_1.default.realpathSync(rootDir);
    const scope = selectPackages(rootReal, options);
    const indexPath = resolveIndexPath(rootReal, options.out, 'package index output');
    const explicitIds = options.runIds ?? [];
    const selection = explicitIds.length > 0 ? 'explicit' : 'latest-pointer';
    const runIds = [...new Set(explicitIds.length > 0 ? explicitIds : [deps.latestRunId(rootReal)])].map((runId) => (0, index_1.assertSafeRunId)(runId));
    const runs = runIds.map((runId) => {
        const run = deps.loadRun(rootReal, runId);
        return {
            runId,
            selection,
            createdAt: run.createdAt,
            runVersion: String(run.version),
            changedFiles: [...new Set(run.changedFiles.map((file) => (0, index_1.normalizePath)(file)))].sort(package_index_schema_1.byCodeUnit),
            artifacts: runPacketFiles(rootReal, runId).map((file) => fileRef(rootReal, file, `run ${runId} packet file`))
        };
    }).sort((left, right) => (0, package_index_schema_1.byCodeUnit)(left.runId, right.runId));
    // Ownership uses every discovered package, so a file of an unselected package is never attributed to a selected one.
    const allPackages = discoverIndexPackages(rootReal);
    const evidenceByPackage = new Map(scope.packages.map((entry) => [entry, []]));
    const outside = [];
    for (const run of runs) {
        const grouped = new Map();
        const unowned = [];
        for (const file of run.changedFiles) {
            const owner = (0, package_index_schema_1.owningPackage)(file, allPackages);
            if (owner !== undefined && evidenceByPackage.has(owner)) {
                grouped.set(owner, [...(grouped.get(owner) ?? []), file]);
            }
            else {
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
    const packages = scope.packages.map((entry) => {
        const manifest = fileRef(rootReal, (0, package_index_schema_1.manifestPath)(entry), `package ${entry} manifest`);
        const parsed = (0, index_1.readJson)(path_1.default.join(rootReal, manifest.path));
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
    const index = {
        kind: package_index_schema_1.PACKAGE_INDEX_KIND,
        schemaVersion: package_index_schema_1.PACKAGE_INDEX_SCHEMA_VERSION,
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
                .sort(package_index_schema_1.byCodeUnit)
        }
    };
    writeAtomically(rootReal, indexPath, `${(0, index_1.stableStringify)(index)}\n`);
    return { index, indexPath };
}
function writeAtomically(rootReal, relative, contents) {
    const absolute = path_1.default.join(rootReal, relative);
    const parent = path_1.default.posix.dirname(relative);
    if (parent !== '.') {
        // Refuse a symlinked or non-directory parent before creating anything, then create what is missing.
        let current = rootReal;
        for (const segment of parent.split('/')) {
            current = path_1.default.join(current, segment);
            const stat = fs_1.default.lstatSync(current, { throwIfNoEntry: false });
            if (!stat) {
                break;
            }
            if (stat.isSymbolicLink() || !stat.isDirectory()) {
                (0, package_index_schema_1.fail)(`package index output ${relative} must not traverse a symbolic link or a file.`);
            }
        }
        fs_1.default.mkdirSync(path_1.default.dirname(absolute), { recursive: true });
    }
    const existing = fs_1.default.lstatSync(absolute, { throwIfNoEntry: false });
    if (existing && !existing.isFile()) {
        (0, package_index_schema_1.fail)(`package index output ${relative} exists and is not a regular file.`);
    }
    const temporary = `${absolute}.${process.pid}.tmp`;
    fs_1.default.writeFileSync(temporary, contents, { encoding: 'utf8', flag: 'wx' });
    fs_1.default.renameSync(temporary, absolute);
}
/** A finding counts for a package when its scope names one of the package's changed files in that run. */
function countFindings(findings, files) {
    const owned = new Set(files);
    const counts = { error: 0, warn: 0, info: 0 };
    for (const finding of findings) {
        const inPackage = finding.scope.some((entry) => owned.has((0, index_1.normalizePath)(entry)));
        if (inPackage && (finding.level === 'error' || finding.level === 'warn' || finding.level === 'info')) {
            counts[finding.level] += 1;
        }
    }
    return counts;
}
/** Re-reads every reference of an index and reports facts. Read-only; refusals (schema, containment) throw. */
function inspectPackageIndex(rootDir, options, deps) {
    const rootReal = fs_1.default.realpathSync(rootDir);
    const indexPath = resolveIndexPath(rootReal, options.index, 'package index');
    const absolute = containedFile(rootReal, indexPath, 'package index') ?? (0, package_index_schema_1.fail)(`package index not found: ${indexPath}`);
    const bytes = fs_1.default.readFileSync(absolute);
    const index = (0, package_index_schema_1.parsePackageIndex)(bytes.toString('utf8'), indexPath);
    const filter = options.packages && options.packages.length > 0
        ? [...new Set(options.packages.map((entry) => (0, index_1.normalizePath)(entry) || '.'))].sort(package_index_schema_1.byCodeUnit)
        : null;
    for (const entry of filter ?? []) {
        if (!index.packages.some((item) => item.path === entry)) {
            (0, package_index_schema_1.fail)(`--package ${entry} is not in the index. Indexed: ${index.packages.map((item) => item.path).join(', ')}.`);
        }
    }
    const selectedPackages = index.packages.filter((entry) => !filter || filter.includes(entry.path));
    const selectedRunIds = new Set(filter ? selectedPackages.flatMap((entry) => entry.evidence.map((item) => item.runId)) : index.runs.map((run) => run.runId));
    const selectedRuns = index.runs.filter((run) => selectedRunIds.has(run.runId));
    const counts = { fresh: 0, changed: 0, missing: 0 };
    const tally = (state) => {
        counts[state] += 1;
        return state;
    };
    const runStates = new Map();
    const runs = selectedRuns.map((run) => {
        const artifacts = run.artifacts.map((ref) => ({ path: ref.path, state: tally(referenceState(rootReal, ref, `run ${run.runId} artifact`)) }));
        runStates.set(run.runId, artifacts.every((item) => item.state === 'fresh'));
        return { runId: run.runId, selection: run.selection, artifacts };
    });
    const loaded = new Map();
    const loadIndexedRun = (runId) => {
        if (!loaded.has(runId)) {
            if (!runStates.get(runId)) {
                loaded.set(runId, 'run packet changed or missing since indexing');
            }
            else {
                try {
                    loaded.set(runId, deps.loadRun(rootReal, runId));
                }
                catch (error) {
                    loaded.set(runId, error instanceof Error ? error.message : String(error));
                }
            }
        }
        return loaded.get(runId);
    };
    const packages = selectedPackages.map((entry) => {
        const manifest = tally(referenceState(rootReal, entry.manifest, `package ${entry.path} manifest`));
        const quality = entry.evidence.map((evidence) => {
            const run = loadIndexedRun(evidence.runId);
            if (typeof run === 'string') {
                return { runId: evidence.runId, state: 'unavailable', reason: run };
            }
            const recorded = indexedRun(index, evidence.runId).changedFiles;
            const actualChanged = [...new Set(run.changedFiles.map((file) => (0, index_1.normalizePath)(file)))].sort(package_index_schema_1.byCodeUnit);
            if ((0, index_1.stableStringify)(actualChanged) !== (0, index_1.stableStringify)(recorded)) {
                (0, package_index_schema_1.fail)(`${indexPath} run ${evidence.runId} lists changed files that differ from its run packet.`);
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
                source: { state: sourceState, subjects: drift.map((item) => item.subject).sort(package_index_schema_1.byCodeUnit) }
            };
        });
        const stale = manifest !== 'fresh' || quality.some((item) => item.state === 'unavailable' || item.source?.state === 'drifted');
        const unverified = quality.some((item) => item.source?.state === 'unavailable');
        const state = entry.status === 'no-run-evidence'
            ? 'no-run-evidence'
            : stale ? 'stale' : unverified ? 'source-unavailable' : 'current';
        return { path: entry.path, name: entry.name, status: entry.status, manifest, state, quality };
    });
    let enumeration = { mode: index.scope.mode, state: 'not-applicable', added: [], removed: [] };
    if (index.scope.mode === 'all') {
        const current = discoverIndexPackages(rootReal);
        const added = current.filter((entry) => !index.scope.packages.includes(entry));
        const removed = index.scope.packages.filter((entry) => !current.includes(entry));
        enumeration = { mode: 'all', state: added.length === 0 && removed.length === 0 ? 'current' : 'changed', added, removed };
    }
    return {
        kind: package_index_schema_1.PACKAGE_INDEX_INSPECTION_KIND,
        version: '1',
        authority: 'facts only: not a verdict, approval, release permission or executed-coverage claim',
        index: { path: indexPath, sha256: `sha256:${(0, index_1.sha256Hex)(bytes)}`, toolVersion: index.tool.version },
        filter,
        references: { ...counts, state: counts.changed === 0 && counts.missing === 0 ? 'fresh' : 'stale' },
        enumeration,
        completeness: index.completeness,
        outsideIndexedPackages: filter ? [] : index.outsideIndexedPackages,
        runs,
        packages
    };
}
function renderPackageIndexWrite(index, indexPath) {
    return [
        `Package index written: ${indexPath}`,
        `Packages: ${index.completeness.packageCount} (${index.scope.mode}); with run evidence: ${index.completeness.withEvidence}; without: ${index.completeness.withoutEvidence.join(', ') || 'none'}`,
        `Runs: ${index.runs.map((run) => `${run.runId} (${run.selection})`).join(', ')}`,
        `Files to upload with the index: ${index.upload.paths.length}`,
        'References only: not a verdict, approval or executed-coverage claim.',
        ''
    ].join('\n');
}
function renderPackageIndexInspection(inspection) {
    const lines = [
        `Package index: ${(0, index_1.renderSafeText)(inspection.index.path)} (${inspection.index.sha256})`,
        `References: ${inspection.references.state} (fresh ${inspection.references.fresh}, changed ${inspection.references.changed}, missing ${inspection.references.missing})`,
        `Enumeration: ${inspection.enumeration.state}${inspection.enumeration.added.length > 0 ? `; added ${inspection.enumeration.added.join(', ')}` : ''}${inspection.enumeration.removed.length > 0 ? `; removed ${inspection.enumeration.removed.join(', ')}` : ''}`,
        `Indexed completeness: ${inspection.completeness.withEvidence}/${inspection.completeness.packageCount} packages with run evidence`
    ];
    for (const entry of inspection.packages) {
        // Paths, names and reasons can come from an uploaded artifact: render them inert.
        lines.push(`- ${(0, index_1.renderSafeText)(entry.path)}${entry.name ? ` (${(0, index_1.renderSafeText)(entry.name)})` : ''}: ${entry.state}; manifest ${entry.manifest}`);
        for (const quality of entry.quality) {
            lines.push(quality.state === 'available'
                ? `  run ${quality.runId}: outcome ${quality.runOutcome} (run-wide), findings in package error ${quality.findingsInPackage?.error ?? 0} warn ${quality.findingsInPackage?.warn ?? 0}; source ${quality.source?.state}`
                : `  run ${quality.runId}: unavailable (${(0, index_1.renderSafeText)(quality.reason ?? '')})`);
        }
    }
    lines.push(inspection.authority, '');
    return lines.join('\n');
}
//# sourceMappingURL=package-index.js.map