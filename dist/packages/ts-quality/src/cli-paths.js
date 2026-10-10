"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCliPath = resolveCliPath;
exports.lexicalRelativePathInsideRoot = lexicalRelativePathInsideRoot;
exports.resolveCliRepoLocalPath = resolveCliRepoLocalPath;
exports.resolveCliAttestationSubject = resolveCliAttestationSubject;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../../evidence-model/src/index");
/** Repository-local path resolution for CLI arguments, with containment errors phrased for operators. */
function portablePath(value) {
    return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}
function resolveCliPath(rootDir, candidate, options) {
    if (path_1.default.isAbsolute(candidate)) {
        return candidate;
    }
    const cwdResolved = path_1.default.resolve(process.cwd(), candidate);
    const rootResolved = path_1.default.resolve(rootDir, candidate);
    const rootRelativeFromCwd = portablePath(path_1.default.relative(process.cwd(), rootDir));
    const normalizedCandidate = portablePath(candidate);
    if (fs_1.default.existsSync(rootResolved)) {
        return rootResolved;
    }
    if (fs_1.default.existsSync(cwdResolved)) {
        return cwdResolved;
    }
    if (rootRelativeFromCwd && (normalizedCandidate === rootRelativeFromCwd || normalizedCandidate.startsWith(`${rootRelativeFromCwd}/`))) {
        return cwdResolved;
    }
    return options?.preferRoot === false ? cwdResolved : rootResolved;
}
function lexicalRelativePathInsideRoot(rootDir, absolutePath) {
    const relative = portablePath(path_1.default.relative(rootDir, absolutePath));
    if (!relative || relative === '..' || relative.startsWith('../') || path_1.default.isAbsolute(relative)) {
        return undefined;
    }
    return (0, index_1.normalizePath)(relative);
}
function remapCliRepoLocalError(error, kind, candidate) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith(`${kind} must stay inside repository root:`)) {
        throw new Error(`${kind} must be inside --root: ${candidate}`);
    }
    if (message.startsWith(`${kind} not found:`)) {
        throw new Error(`${kind} not found: ${candidate}`);
    }
    throw error instanceof Error ? error : new Error(message);
}
function resolveCliRepoLocalPath(rootDir, candidate, options) {
    const pathOptions = options?.preferRoot !== undefined ? { preferRoot: options.preferRoot } : undefined;
    const resolvedCandidate = resolveCliPath(rootDir, candidate, pathOptions);
    const resolutionOptions = {};
    if (options?.allowMissing !== undefined) {
        resolutionOptions.allowMissing = options.allowMissing;
    }
    if (options?.kind !== undefined) {
        resolutionOptions.kind = options.kind;
    }
    try {
        return (0, index_1.resolveRepoLocalPath)(rootDir, resolvedCandidate, resolutionOptions);
    }
    catch (error) {
        remapCliRepoLocalError(error, options?.kind ?? 'path', candidate);
    }
}
function resolveCliAttestationSubject(rootDir, candidate, options) {
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
//# sourceMappingURL=cli-paths.js.map