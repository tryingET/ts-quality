"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRepoLocalPath = resolveRepoLocalPath;
exports.compilerOptionsForRepoFile = compilerOptionsForRepoFile;
exports.resolveRepoImport = resolveRepoImport;
exports.runtimeMirrorCandidates = runtimeMirrorCandidates;
exports.normalizePath = normalizePath;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const typescript_1 = __importDefault(require("typescript"));
/** Repository containment and import resolution for paths, including runtime mirror candidates. */
function repoRelativePath(rootDir, absolutePath) {
    const relative = normalizePath(path_1.default.relative(rootDir, absolutePath));
    if (!relative || relative === '..' || relative.startsWith('../') || path_1.default.isAbsolute(relative)) {
        return undefined;
    }
    return relative;
}
function resolvedPathForContainment(candidatePath) {
    const absoluteCandidate = path_1.default.resolve(candidatePath);
    if (fs_1.default.existsSync(absoluteCandidate)) {
        return fs_1.default.realpathSync(absoluteCandidate);
    }
    const tail = [];
    let currentPath = absoluteCandidate;
    while (!fs_1.default.existsSync(currentPath)) {
        const parentPath = path_1.default.dirname(currentPath);
        if (parentPath === currentPath) {
            break;
        }
        tail.unshift(path_1.default.basename(currentPath));
        currentPath = parentPath;
    }
    const resolvedExistingPath = fs_1.default.existsSync(currentPath)
        ? fs_1.default.realpathSync(currentPath)
        : path_1.default.resolve(currentPath);
    return tail.reduce((resolvedPath, segment) => path_1.default.join(resolvedPath, segment), resolvedExistingPath);
}
function resolveRepoLocalPath(rootDir, candidate, options) {
    const absoluteRoot = path_1.default.resolve(rootDir);
    const resolvedRoot = fs_1.default.realpathSync(absoluteRoot);
    const absolutePath = path_1.default.isAbsolute(candidate) ? path_1.default.resolve(candidate) : path_1.default.resolve(absoluteRoot, candidate);
    const resolvedCandidatePath = resolvedPathForContainment(absolutePath);
    const relativePath = repoRelativePath(resolvedRoot, resolvedCandidatePath);
    const kind = options?.kind ?? 'path';
    if (!relativePath) {
        throw new Error(`${kind} must stay inside repository root: ${candidate}`);
    }
    if (!options?.allowMissing && !fs_1.default.existsSync(absolutePath)) {
        throw new Error(`${kind} not found: ${candidate}`);
    }
    return { absolutePath, relativePath, canonicalPath: resolvedCandidatePath };
}
function importResolutionCandidates(basePath) {
    return [
        basePath,
        `${basePath}.ts`,
        `${basePath}.tsx`,
        `${basePath}.js`,
        `${basePath}.jsx`,
        `${basePath}.mjs`,
        `${basePath}.cjs`,
        path_1.default.join(basePath, 'index.ts'),
        path_1.default.join(basePath, 'index.tsx'),
        path_1.default.join(basePath, 'index.js'),
        path_1.default.join(basePath, 'index.jsx'),
        path_1.default.join(basePath, 'index.mjs'),
        path_1.default.join(basePath, 'index.cjs')
    ];
}
function resolveRelativeImportToRepoPath(rootDir, importerPath, specifier) {
    const importerDir = path_1.default.dirname(importerPath);
    const basePath = path_1.default.resolve(rootDir, importerDir, specifier);
    for (const candidate of importResolutionCandidates(basePath)) {
        if (!fs_1.default.existsSync(candidate) || !fs_1.default.statSync(candidate).isFile()) {
            continue;
        }
        return repoRelativePath(rootDir, candidate);
    }
    return repoRelativePath(rootDir, basePath);
}
const compilerOptionsCache = new Map();
function compilerOptionsForTsConfig(configPath) {
    const cached = compilerOptionsCache.get(configPath);
    if (cached !== undefined || compilerOptionsCache.has(configPath)) {
        return cached;
    }
    const loaded = typescript_1.default.readConfigFile(configPath, typescript_1.default.sys.readFile);
    if (loaded.error) {
        compilerOptionsCache.set(configPath, undefined);
        return undefined;
    }
    const parsed = typescript_1.default.parseJsonConfigFileContent(loaded.config, typescript_1.default.sys, path_1.default.dirname(configPath));
    compilerOptionsCache.set(configPath, parsed.options);
    return parsed.options;
}
function compilerOptionsForImporter(rootDir, importerPath) {
    const importerAbsolute = path_1.default.join(rootDir, importerPath);
    let currentDir = path_1.default.dirname(importerAbsolute);
    const normalizedRoot = path_1.default.resolve(rootDir);
    while (currentDir.startsWith(normalizedRoot)) {
        const candidate = path_1.default.join(currentDir, 'tsconfig.json');
        if (fs_1.default.existsSync(candidate)) {
            return compilerOptionsForTsConfig(candidate);
        }
        if (currentDir === normalizedRoot) {
            break;
        }
        const parentDir = path_1.default.dirname(currentDir);
        if (parentDir === currentDir) {
            break;
        }
        currentDir = parentDir;
    }
    const rootConfigPath = typescript_1.default.findConfigFile(rootDir, typescript_1.default.sys.fileExists, 'tsconfig.json');
    return rootConfigPath ? compilerOptionsForTsConfig(rootConfigPath) : undefined;
}
function compilerOptionsForRepoFile(rootDir, filePath) {
    return compilerOptionsForImporter(rootDir, normalizePath(filePath));
}
function resolveRepoImport(rootDir, importerPath, specifier) {
    if (specifier.startsWith('.')) {
        return resolveRelativeImportToRepoPath(rootDir, importerPath, specifier);
    }
    const compilerOptions = compilerOptionsForImporter(rootDir, importerPath);
    if (!compilerOptions) {
        return undefined;
    }
    const resolved = typescript_1.default.resolveModuleName(specifier, path_1.default.join(rootDir, importerPath), compilerOptions, typescript_1.default.sys).resolvedModule?.resolvedFileName;
    if (!resolved) {
        return undefined;
    }
    return repoRelativePath(rootDir, resolved);
}
function withCompiledExtension(filePath, extension, compiledExtension) {
    return extension.length > 0 && filePath.endsWith(extension)
        ? `${filePath.slice(0, -extension.length)}${compiledExtension}`
        : filePath;
}
function runtimeMirrorCandidates(sourcePath, mirrorRoots = ['dist']) {
    const normalized = normalizePath(sourcePath);
    const extension = path_1.default.extname(normalized);
    const compiledExtension = extension === '.ts' || extension === '.tsx' || extension === '.jsx' ? '.js' : extension;
    const candidates = new Set();
    const sourceSegments = normalized.split('/').filter(Boolean);
    const srcIndex = sourceSegments.indexOf('src');
    const sourceDir = path_1.default.posix.dirname(normalized);
    const sourceBase = path_1.default.posix.basename(normalized);
    for (const mirrorRoot of mirrorRoots.map((item) => normalizePath(item)).filter(Boolean)) {
        const rootSegments = mirrorRoot.split('/').filter(Boolean);
        if (srcIndex >= 0) {
            const mirroredSegments = [...sourceSegments];
            mirroredSegments.splice(srcIndex, 1, ...rootSegments);
            const candidate = withCompiledExtension(mirroredSegments.join('/'), extension, compiledExtension);
            if (candidate !== normalized) {
                candidates.add(normalizePath(candidate));
            }
            if (srcIndex === 0) {
                const rootCandidate = withCompiledExtension(path_1.default.posix.join(mirrorRoot, normalized.slice(4)), extension, compiledExtension);
                if (rootCandidate !== normalized) {
                    candidates.add(normalizePath(rootCandidate));
                }
            }
            continue;
        }
        const siblingCandidate = withCompiledExtension(path_1.default.posix.join(sourceDir === '.' ? '' : sourceDir, mirrorRoot, sourceBase), extension, compiledExtension);
        const rootCandidate = withCompiledExtension(path_1.default.posix.join(mirrorRoot, normalized), extension, compiledExtension);
        for (const candidate of [siblingCandidate, rootCandidate]) {
            if (candidate !== normalized) {
                candidates.add(normalizePath(candidate));
            }
        }
    }
    return [...candidates];
}
function normalizePath(value) {
    const normalized = value.replace(/\\/g, '/').replace(/\/+/g, '/');
    return normalized.replace(/^\.\//, '').replace(/^\//, '').replace(/\/$/, '');
}
//# sourceMappingURL=paths.js.map