"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncompleteRunPacketError = void 0;
exports.reserveRunId = reserveRunId;
exports.injectTestFault = injectTestFault;
exports.stageRunArtifact = stageRunArtifact;
exports.publishRunArtifact = publishRunArtifact;
exports.writeRunArtifact = writeRunArtifact;
exports.readLatestRun = readLatestRun;
exports.listRunIds = listRunIds;
exports.loadRun = loadRun;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const paths_1 = require("./paths");
const text_io_1 = require("./text-io");
/** Run id reservation, staged atomic publication of run packets, the latest pointer and loading of published runs. */
// Reservations are retained even after failure: retry with a new id, never rebind approvals.
function reserveRunId(rootDir, runId) {
    const safeRunId = (0, text_io_1.assertSafeRunId)(runId);
    const runsRoot = (0, paths_1.resolveRepoLocalPath)(rootDir, '.ts-quality/runs', { allowMissing: true, kind: 'run storage' }).absolutePath;
    (0, text_io_1.ensureDir)(runsRoot);
    const artifactRoot = path_1.default.join(runsRoot, safeRunId);
    const occupied = () => new Error(`Run ${safeRunId} already exists or is reserved. Use a new run id for a new check.`);
    if (fs_1.default.existsSync(artifactRoot)) {
        throw occupied();
    }
    try {
        fs_1.default.writeFileSync(path_1.default.join(runsRoot, `.${safeRunId}.reserved`), '', { flag: 'wx' });
    }
    catch (error) {
        if (error.code === 'EEXIST') {
            throw occupied();
        }
        throw error;
    }
}
const RUN_PUBLICATION_FILE = 'publication.json';
class IncompleteRunPacketError extends Error {
}
exports.IncompleteRunPacketError = IncompleteRunPacketError;
/** Test-only fault injection for crash-recovery proofs: TS_QUALITY_TEST_FAULT=<point> aborts at that point. */
function injectTestFault(point) {
    if (process.env['TS_QUALITY_TEST_FAULT'] === point) {
        throw new Error(`injected fault at ${point}`);
    }
}
function runsRootFor(rootDir) {
    const runsRoot = (0, paths_1.resolveRepoLocalPath)(rootDir, '.ts-quality/runs', { allowMissing: true, kind: 'run storage' }).absolutePath;
    (0, text_io_1.ensureDir)(runsRoot);
    return runsRoot;
}
/** Builds a run packet in a hidden staging directory; nothing under the run id is visible until it is published. */
function stageRunArtifact(rootDir, run) {
    const safeRunId = (0, text_io_1.assertSafeRunId)(run.runId);
    const stagingDir = fs_1.default.mkdtempSync(path_1.default.join(runsRootFor(rootDir), `.${safeRunId}.staging-`));
    fs_1.default.writeFileSync(path_1.default.join(stagingDir, 'run.json'), `${(0, text_io_1.stableStringify)(run)}\n`, { flag: 'wx' });
    injectTestFault('after-run-json');
    (0, text_io_1.writeJson)(path_1.default.join(stagingDir, 'verdict.json'), run.verdict);
    return { runId: safeRunId, stagingDir };
}
function writeLatestPointer(rootDir, runId) {
    const pointerPath = path_1.default.join(rootDir, '.ts-quality', 'latest.json');
    const temporaryPath = `${pointerPath}.${process.pid}.${Date.now()}.tmp`;
    fs_1.default.writeFileSync(temporaryPath, `${(0, text_io_1.stableStringify)({ latestRunId: runId })}\n`, 'utf8');
    // rename replaces the pointer atomically, so readers never see a torn latest.json.
    fs_1.default.renameSync(temporaryPath, pointerPath);
}
/**
 * Publishes a staged packet with one directory rename. An existing run is never replaced; on failure the staging
 * directory is removed. The latest pointer moves only after the complete packet is visible.
 */
function publishRunArtifact(rootDir, staged) {
    const target = path_1.default.join(runsRootFor(rootDir), staged.runId);
    try {
        const files = fs_1.default.readdirSync(staged.stagingDir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name);
        const publication = { version: '1', kind: 'run-packet-publication', runId: staged.runId, files: [...files, RUN_PUBLICATION_FILE].sort((left, right) => left.localeCompare(right)) };
        (0, text_io_1.writeJson)(path_1.default.join(staged.stagingDir, RUN_PUBLICATION_FILE), publication);
        injectTestFault('before-publish');
        if (fs_1.default.existsSync(target)) {
            throw new Error(`Run ${staged.runId} already exists; published packets are never replaced. Use a new run id for a new check.`);
        }
        fs_1.default.renameSync(staged.stagingDir, target);
    }
    catch (error) {
        if (!(error instanceof Error && error.message.startsWith('injected fault'))) {
            fs_1.default.rmSync(staged.stagingDir, { recursive: true, force: true });
        }
        throw error;
    }
    injectTestFault('before-latest');
    writeLatestPointer(rootDir, staged.runId);
    return target;
}
function writeRunArtifact(rootDir, run) {
    return publishRunArtifact(rootDir, stageRunArtifact(rootDir, run));
}
function readLatestRun(rootDir) {
    const latestPointerPath = path_1.default.join(rootDir, '.ts-quality', 'latest.json');
    if (!fs_1.default.existsSync(latestPointerPath)) {
        throw new Error(`No latest run pointer found at ${latestPointerPath}`);
    }
    const pointer = (0, text_io_1.readJson)(latestPointerPath);
    return loadRun(rootDir, pointer.latestRunId);
}
/** Published run ids; hidden staging directories left by an interrupted check are never listed. */
function listRunIds(rootDir) {
    const runsDir = path_1.default.join(rootDir, '.ts-quality', 'runs');
    if (!fs_1.default.existsSync(runsDir)) {
        return [];
    }
    return fs_1.default.readdirSync(runsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name).sort();
}
/**
 * Loads a run packet. A packet with a publication record must still contain every listed file; packets from
 * versions before publication records (run.json only) stay readable for compatibility.
 */
function loadRun(rootDir, runId) {
    const safeRunId = (0, text_io_1.assertSafeRunId)(runId);
    const runDir = path_1.default.join(rootDir, '.ts-quality', 'runs', safeRunId);
    const publicationPath = path_1.default.join(runDir, RUN_PUBLICATION_FILE);
    if (fs_1.default.existsSync(publicationPath)) {
        const publication = (0, text_io_1.readJson)(publicationPath);
        if (publication.version !== '1' || publication.kind !== 'run-packet-publication' || publication.runId !== safeRunId || !Array.isArray(publication.files) || !publication.files.every((file) => typeof file === 'string' && file.length > 0 && !file.includes('..'))) {
            throw new IncompleteRunPacketError(`Run ${safeRunId} has a malformed or mismatched publication record; it cannot be projected. Re-check with a new run id.`);
        }
        const missing = publication.files.filter((file) => !fs_1.default.existsSync(path_1.default.join(runDir, file)));
        if (missing.length > 0) {
            throw new IncompleteRunPacketError(`Run ${safeRunId} packet is incomplete: missing ${missing.join(', ')}; it cannot be projected. Re-check with a new run id.`);
        }
    }
    return (0, text_io_1.readJson)(path_1.default.join(runDir, 'run.json'));
}
//# sourceMappingURL=run-store.js.map