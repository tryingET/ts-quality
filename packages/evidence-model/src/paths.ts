import fs from 'fs';
import path from 'path';
import ts from 'typescript';

/** Repository containment and import resolution for paths, including runtime mirror candidates. */

function repoRelativePath(rootDir: string, absolutePath: string): string | undefined {
  const relative = normalizePath(path.relative(rootDir, absolutePath));
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    return undefined;
  }
  return relative;
}
function resolvedPathForContainment(candidatePath: string): string {
  const absoluteCandidate = path.resolve(candidatePath);
  if (fs.existsSync(absoluteCandidate)) {
    return fs.realpathSync(absoluteCandidate);
  }

  const tail: string[] = [];
  let currentPath = absoluteCandidate;
  while (!fs.existsSync(currentPath)) {
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    tail.unshift(path.basename(currentPath));
    currentPath = parentPath;
  }

  const resolvedExistingPath = fs.existsSync(currentPath)
    ? fs.realpathSync(currentPath)
    : path.resolve(currentPath);
  return tail.reduce((resolvedPath, segment) => path.join(resolvedPath, segment), resolvedExistingPath);
}
export function resolveRepoLocalPath(rootDir: string, candidate: string, options?: { allowMissing?: boolean; kind?: string }): { absolutePath: string; relativePath: string; canonicalPath: string } {
  const absoluteRoot = path.resolve(rootDir);
  const resolvedRoot = fs.realpathSync(absoluteRoot);
  const absolutePath = path.isAbsolute(candidate) ? path.resolve(candidate) : path.resolve(absoluteRoot, candidate);
  const resolvedCandidatePath = resolvedPathForContainment(absolutePath);
  const relativePath = repoRelativePath(resolvedRoot, resolvedCandidatePath);
  const kind = options?.kind ?? 'path';
  if (!relativePath) {
    throw new Error(`${kind} must stay inside repository root: ${candidate}`);
  }
  if (!options?.allowMissing && !fs.existsSync(absolutePath)) {
    throw new Error(`${kind} not found: ${candidate}`);
  }
  return { absolutePath, relativePath, canonicalPath: resolvedCandidatePath };
}
function importResolutionCandidates(basePath: string): string[] {
  return [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.js'),
    path.join(basePath, 'index.jsx'),
    path.join(basePath, 'index.mjs'),
    path.join(basePath, 'index.cjs')
  ];
}
function resolveRelativeImportToRepoPath(rootDir: string, importerPath: string, specifier: string): string | undefined {
  const importerDir = path.dirname(importerPath);
  const basePath = path.resolve(rootDir, importerDir, specifier);
  for (const candidate of importResolutionCandidates(basePath)) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
      continue;
    }
    return repoRelativePath(rootDir, candidate);
  }
  return repoRelativePath(rootDir, basePath);
}
const compilerOptionsCache = new Map<string, ReturnType<typeof ts.parseJsonConfigFileContent>['options'] | undefined>();
function compilerOptionsForTsConfig(configPath: string): ReturnType<typeof ts.parseJsonConfigFileContent>['options'] | undefined {
  const cached = compilerOptionsCache.get(configPath);
  if (cached !== undefined || compilerOptionsCache.has(configPath)) {
    return cached;
  }
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  if (loaded.error) {
    compilerOptionsCache.set(configPath, undefined);
    return undefined;
  }
  const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, path.dirname(configPath));
  compilerOptionsCache.set(configPath, parsed.options);
  return parsed.options;
}
function compilerOptionsForImporter(rootDir: string, importerPath: string): ReturnType<typeof ts.parseJsonConfigFileContent>['options'] | undefined {
  const importerAbsolute = path.join(rootDir, importerPath);
  let currentDir = path.dirname(importerAbsolute);
  const normalizedRoot = path.resolve(rootDir);
  while (currentDir.startsWith(normalizedRoot)) {
    const candidate = path.join(currentDir, 'tsconfig.json');
    if (fs.existsSync(candidate)) {
      return compilerOptionsForTsConfig(candidate);
    }
    if (currentDir === normalizedRoot) {
      break;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  const rootConfigPath = ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.json');
  return rootConfigPath ? compilerOptionsForTsConfig(rootConfigPath) : undefined;
}
export function compilerOptionsForRepoFile(rootDir: string, filePath: string): ReturnType<typeof ts.parseJsonConfigFileContent>['options'] | undefined {
  return compilerOptionsForImporter(rootDir, normalizePath(filePath));
}
export function resolveRepoImport(rootDir: string, importerPath: string, specifier: string): string | undefined {
  if (specifier.startsWith('.')) {
    return resolveRelativeImportToRepoPath(rootDir, importerPath, specifier);
  }
  const compilerOptions = compilerOptionsForImporter(rootDir, importerPath);
  if (!compilerOptions) {
    return undefined;
  }
  const resolved = ts.resolveModuleName(specifier, path.join(rootDir, importerPath), compilerOptions, ts.sys).resolvedModule?.resolvedFileName;
  if (!resolved) {
    return undefined;
  }
  return repoRelativePath(rootDir, resolved);
}
function withCompiledExtension(filePath: string, extension: string, compiledExtension: string): string {
  return extension.length > 0 && filePath.endsWith(extension)
    ? `${filePath.slice(0, -extension.length)}${compiledExtension}`
    : filePath;
}
export function runtimeMirrorCandidates(sourcePath: string, mirrorRoots: string[] = ['dist']): string[] {
  const normalized = normalizePath(sourcePath);
  const extension = path.extname(normalized);
  const compiledExtension = extension === '.ts' || extension === '.tsx' || extension === '.jsx' ? '.js' : extension;
  const candidates = new Set<string>();
  const sourceSegments = normalized.split('/').filter(Boolean);
  const srcIndex = sourceSegments.indexOf('src');
  const sourceDir = path.posix.dirname(normalized);
  const sourceBase = path.posix.basename(normalized);

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
        const rootCandidate = withCompiledExtension(path.posix.join(mirrorRoot, normalized.slice(4)), extension, compiledExtension);
        if (rootCandidate !== normalized) {
          candidates.add(normalizePath(rootCandidate));
        }
      }
      continue;
    }

    const siblingCandidate = withCompiledExtension(path.posix.join(sourceDir === '.' ? '' : sourceDir, mirrorRoot, sourceBase), extension, compiledExtension);
    const rootCandidate = withCompiledExtension(path.posix.join(mirrorRoot, normalized), extension, compiledExtension);
    for (const candidate of [siblingCandidate, rootCandidate]) {
      if (candidate !== normalized) {
        candidates.add(normalizePath(candidate));
      }
    }
  }

  return [...candidates];
}
export function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/\/+/g, '/');
  return normalized.replace(/^\.\//, '').replace(/^\//, '').replace(/\/$/, '');
}
