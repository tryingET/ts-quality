"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareMutationWorkspace = prepareMutationWorkspace;
exports.resetMutationWorkspace = resetMutationWorkspace;
exports.disposeMutationWorkspace = disposeMutationWorkspace;
exports.writeRuntimeMirrors = writeRuntimeMirrors;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const typescript_1 = __importDefault(require("typescript"));
const index_1 = require("../../evidence-model/src/index");
const execution_1 = require("./execution");
function copyRecursive(sourceDir, destinationDir, exclude) {
    (0, index_1.ensureDir)(destinationDir);
    for (const entry of fs_1.default.readdirSync(sourceDir, { withFileTypes: true })) {
        if (exclude.has(entry.name)) {
            continue;
        }
        const sourcePath = path_1.default.join(sourceDir, entry.name);
        const destinationPath = path_1.default.join(destinationDir, entry.name);
        if (entry.isDirectory()) {
            copyRecursive(sourcePath, destinationPath, exclude);
        }
        else {
            (0, index_1.ensureDir)(path_1.default.dirname(destinationPath));
            fs_1.default.copyFileSync(sourcePath, destinationPath);
        }
    }
}
function linkSharedPath(sourcePath, destinationPath) {
    if (!fs_1.default.existsSync(sourcePath) || fs_1.default.existsSync(destinationPath)) {
        return;
    }
    const type = fs_1.default.statSync(sourcePath).isDirectory() ? 'junction' : 'file';
    fs_1.default.symlinkSync(sourcePath, destinationPath, type);
}
/** Repo-relative node_modules directories, including nested workspace-package ones, without descending into any node_modules. */
function nodeModulesRoots(repoRoot, currentDir = repoRoot) {
    const roots = [];
    for (const entry of fs_1.default.readdirSync(currentDir, { withFileTypes: true })) {
        const absolutePath = path_1.default.join(currentDir, entry.name);
        // A node_modules that is itself a symlink (shared install dirs, container volumes) is still the install root.
        const symlinkedNodeModules = entry.name === 'node_modules' && entry.isSymbolicLink() && fs_1.default.existsSync(absolutePath) && fs_1.default.statSync(absolutePath).isDirectory();
        if (!entry.isDirectory() && !symlinkedNodeModules) {
            continue;
        }
        if (entry.name === 'node_modules') {
            roots.push((0, index_1.normalizePath)(path_1.default.relative(repoRoot, absolutePath)));
            continue;
        }
        if (execution_1.MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name)) {
            continue;
        }
        roots.push(...nodeModulesRoots(repoRoot, absolutePath));
    }
    return roots;
}
/** Repo-relative path of a workspace package a node_modules link resolves to, or undefined for third-party targets. */
function workspaceLinkTarget(realRepoRoot, linkPath) {
    let realTarget;
    try {
        realTarget = fs_1.default.realpathSync(linkPath);
    }
    catch {
        return undefined;
    }
    const relativeTarget = path_1.default.relative(realRepoRoot, realTarget);
    if (relativeTarget === '' || relativeTarget.startsWith('..') || path_1.default.isAbsolute(relativeTarget)) {
        return undefined;
    }
    return relativeTarget.split(path_1.default.sep).includes('node_modules') ? undefined : relativeTarget;
}
/**
 * Mirrors one node_modules directory entry by entry. Third-party entries link to the real repo, but workspace-package
 * links (pnpm `packages/b/node_modules/@scope/a -> ../../../a`, npm `node_modules/@scope/a -> ../packages/a`) are
 * re-pointed at the mutant workspace so tests that import a sibling package by name exercise the mutated copy.
 */
function mirrorNodeModules(repoRoot, realRepoRoot, tempDir, relativeDir) {
    const sourceDir = path_1.default.join(repoRoot, relativeDir);
    const destinationDir = path_1.default.join(tempDir, relativeDir);
    fs_1.default.mkdirSync(destinationDir, { recursive: true });
    for (const entry of fs_1.default.readdirSync(sourceDir, { withFileTypes: true })) {
        const entryRelative = path_1.default.join(relativeDir, entry.name);
        if (entry.name.startsWith('@') && entry.isDirectory()) {
            mirrorNodeModules(repoRoot, realRepoRoot, tempDir, entryRelative);
            continue;
        }
        const workspaceTarget = entry.isSymbolicLink() ? workspaceLinkTarget(realRepoRoot, path_1.default.join(repoRoot, entryRelative)) : undefined;
        if (workspaceTarget !== undefined) {
            fs_1.default.symlinkSync(path_1.default.join(tempDir, workspaceTarget), path_1.default.join(tempDir, entryRelative), 'junction');
            continue;
        }
        linkSharedPath(path_1.default.join(repoRoot, entryRelative), path_1.default.join(tempDir, entryRelative));
    }
}
// Workspace managers such as pnpm keep package-only dependencies in each package's own node_modules,
// so linking only the root one would make mutants fail on module resolution and count as killed.
function hydrateTempRuntime(repoRoot, tempDir) {
    const realRepoRoot = fs_1.default.realpathSync(repoRoot);
    for (const relativePath of nodeModulesRoots(repoRoot)) {
        if (fs_1.default.existsSync(path_1.default.dirname(path_1.default.join(tempDir, relativePath)))) {
            mirrorNodeModules(repoRoot, realRepoRoot, tempDir, relativePath);
        }
    }
}
function clearExcludedWorkspaceEntries(rootDir, currentDir) {
    for (const entry of fs_1.default.readdirSync(currentDir, { withFileTypes: true })) {
        const absolutePath = path_1.default.join(currentDir, entry.name);
        const relativePath = (0, index_1.normalizePath)(path_1.default.relative(rootDir, absolutePath));
        const excluded = execution_1.MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name) || execution_1.MUTATION_WORKSPACE_EXCLUDE_SET.has(relativePath);
        if (excluded) {
            if (entry.name === 'node_modules' || relativePath === 'node_modules') {
                continue;
            }
            fs_1.default.rmSync(absolutePath, { recursive: true, force: true });
            continue;
        }
        if (entry.isDirectory()) {
            clearExcludedWorkspaceEntries(rootDir, absolutePath);
        }
    }
}
function walkMutationWorkspace(rootDir, currentDir, visit) {
    for (const entry of fs_1.default.readdirSync(currentDir, { withFileTypes: true })) {
        const absolutePath = path_1.default.join(currentDir, entry.name);
        const relativePath = (0, index_1.normalizePath)(path_1.default.relative(rootDir, absolutePath));
        if (entry.isDirectory()) {
            if (execution_1.MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name) || execution_1.MUTATION_WORKSPACE_EXCLUDE_SET.has(relativePath)) {
                continue;
            }
            walkMutationWorkspace(rootDir, absolutePath, visit);
            continue;
        }
        if (entry.isSymbolicLink() && (execution_1.MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name) || execution_1.MUTATION_WORKSPACE_EXCLUDE_SET.has(relativePath))) {
            continue;
        }
        visit(absolutePath, relativePath, entry.isSymbolicLink() ? 'symlink' : 'file');
    }
}
function restoreWorkspaceFile(repoRoot, tempDir, relativePath) {
    const sourcePath = path_1.default.join(repoRoot, relativePath);
    const destinationPath = path_1.default.join(tempDir, relativePath);
    (0, index_1.ensureDir)(path_1.default.dirname(destinationPath));
    fs_1.default.rmSync(destinationPath, { recursive: true, force: true });
    fs_1.default.copyFileSync(sourcePath, destinationPath);
}
function pruneEmptyDirectories(rootDir, currentDir) {
    let empty = true;
    for (const entry of fs_1.default.readdirSync(currentDir, { withFileTypes: true })) {
        const absolutePath = path_1.default.join(currentDir, entry.name);
        const relativePath = (0, index_1.normalizePath)(path_1.default.relative(rootDir, absolutePath));
        if (entry.isDirectory()) {
            if (execution_1.MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name) || execution_1.MUTATION_WORKSPACE_EXCLUDE_SET.has(relativePath)) {
                empty = false;
                continue;
            }
            if (pruneEmptyDirectories(rootDir, absolutePath)) {
                fs_1.default.rmdirSync(absolutePath);
                continue;
            }
            empty = false;
            continue;
        }
        empty = false;
    }
    return currentDir !== rootDir && empty;
}
function prepareMutationWorkspace(repoRoot, repoFiles) {
    const tempRoot = path_1.default.join(repoRoot, '.ts-quality', 'tmp-mutants');
    (0, index_1.ensureDir)(tempRoot);
    const tempDir = fs_1.default.mkdtempSync(path_1.default.join(tempRoot, 'mutant-'));
    copyRecursive(repoRoot, tempDir, execution_1.MUTATION_WORKSPACE_EXCLUDE_SET);
    hydrateTempRuntime(repoRoot, tempDir);
    return {
        tempDir,
        snapshot: new Map(repoFiles.map(({ filePath, digest }) => [(0, index_1.normalizePath)(filePath), digest]))
    };
}
function resetMutationWorkspace(repoRoot, workspace) {
    clearExcludedWorkspaceEntries(workspace.tempDir, workspace.tempDir);
    const seen = new Set();
    walkMutationWorkspace(workspace.tempDir, workspace.tempDir, (absolutePath, relativePath, kind) => {
        const normalizedPath = (0, index_1.normalizePath)(relativePath);
        seen.add(normalizedPath);
        const expectedDigest = workspace.snapshot.get(normalizedPath);
        if (!expectedDigest) {
            fs_1.default.rmSync(absolutePath, { recursive: true, force: true });
            return;
        }
        if (kind === 'symlink' || (0, index_1.fileDigest)(absolutePath) !== expectedDigest) {
            restoreWorkspaceFile(repoRoot, workspace.tempDir, normalizedPath);
        }
    });
    for (const relativePath of workspace.snapshot.keys()) {
        if (!seen.has(relativePath)) {
            restoreWorkspaceFile(repoRoot, workspace.tempDir, relativePath);
        }
    }
    pruneEmptyDirectories(workspace.tempDir, workspace.tempDir);
}
function disposeMutationWorkspace(workspace) {
    if (!workspace) {
        return;
    }
    fs_1.default.rmSync(workspace.tempDir, { recursive: true, force: true });
}
function transpileRuntimeMirrorSource(repoRoot, site, mutatedSource) {
    const compilerOptions = (0, index_1.compilerOptionsForRepoFile)(repoRoot, site.filePath) ?? {};
    const transpiled = typescript_1.default.transpileModule(mutatedSource, {
        fileName: site.filePath,
        compilerOptions: {
            ...compilerOptions,
            target: compilerOptions.target ?? typescript_1.default.ScriptTarget.ES2020,
            module: compilerOptions.module ?? typescript_1.default.ModuleKind.CommonJS,
            sourceMap: false,
            inlineSourceMap: false,
            inlineSources: false,
            declaration: false,
            declarationMap: false,
            emitDeclarationOnly: false
        },
        reportDiagnostics: false
    });
    return transpiled.outputText;
}
function writeRuntimeMirrors(repoRoot, tempDir, site, mutatedSource, runtimeMirrorRoots) {
    const extension = path_1.default.extname(site.filePath);
    const runtimeSource = extension === '.ts' || extension === '.tsx'
        ? transpileRuntimeMirrorSource(repoRoot, site, mutatedSource)
        : mutatedSource;
    for (const candidate of (0, index_1.runtimeMirrorCandidates)(site.filePath, runtimeMirrorRoots)) {
        const mirrorPath = path_1.default.join(tempDir, candidate);
        if (!fs_1.default.existsSync(mirrorPath) || !fs_1.default.statSync(mirrorPath).isFile()) {
            continue;
        }
        fs_1.default.writeFileSync(mirrorPath, runtimeSource, 'utf8');
    }
}
//# sourceMappingURL=workspace.js.map