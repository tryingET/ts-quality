import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import {
  compilerOptionsForRepoFile,
  ensureDir,
  fileDigest,
  type MutationSite,
  normalizePath,
  runtimeMirrorCandidates
} from '../../evidence-model/src/index';
import { MUTATION_WORKSPACE_EXCLUDE_SET, RepoFileDigest } from './execution';

/** The isolated mutation workspace: copy, node_modules mirroring, pristine reset and runtime mirrors. */

export interface MutationWorkspace {
  tempDir: string;
  snapshot: Map<string, string>;
}
function copyRecursive(sourceDir: string, destinationDir: string, exclude: Set<string>): void {
  ensureDir(destinationDir);
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (exclude.has(entry.name)) {
      continue;
    }
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(sourcePath, destinationPath, exclude);
    } else {
      ensureDir(path.dirname(destinationPath));
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}
function linkSharedPath(sourcePath: string, destinationPath: string): void {
  if (!fs.existsSync(sourcePath) || fs.existsSync(destinationPath)) {
    return;
  }
  const type = fs.statSync(sourcePath).isDirectory() ? 'junction' : 'file';
  fs.symlinkSync(sourcePath, destinationPath, type);
}
/** Repo-relative node_modules directories, including nested workspace-package ones, without descending into any node_modules. */
function nodeModulesRoots(repoRoot: string, currentDir = repoRoot): string[] {
  const roots: string[] = [];
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name);
    // A node_modules that is itself a symlink (shared install dirs, container volumes) is still the install root.
    const symlinkedNodeModules = entry.name === 'node_modules' && entry.isSymbolicLink() && fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory();
    if (!entry.isDirectory() && !symlinkedNodeModules) {
      continue;
    }
    if (entry.name === 'node_modules') {
      roots.push(normalizePath(path.relative(repoRoot, absolutePath)));
      continue;
    }
    if (MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name)) {
      continue;
    }
    roots.push(...nodeModulesRoots(repoRoot, absolutePath));
  }
  return roots;
}
/** Repo-relative path of a workspace package a node_modules link resolves to, or undefined for third-party targets. */
function workspaceLinkTarget(realRepoRoot: string, linkPath: string): string | undefined {
  let realTarget: string;
  try {
    realTarget = fs.realpathSync(linkPath);
  } catch {
    return undefined;
  }
  const relativeTarget = path.relative(realRepoRoot, realTarget);
  if (relativeTarget === '' || relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
    return undefined;
  }
  return relativeTarget.split(path.sep).includes('node_modules') ? undefined : relativeTarget;
}
/**
 * Mirrors one node_modules directory entry by entry. Third-party entries link to the real repo, but workspace-package
 * links (pnpm `packages/b/node_modules/@scope/a -> ../../../a`, npm `node_modules/@scope/a -> ../packages/a`) are
 * re-pointed at the mutant workspace so tests that import a sibling package by name exercise the mutated copy.
 */
function mirrorNodeModules(repoRoot: string, realRepoRoot: string, tempDir: string, relativeDir: string): void {
  const sourceDir = path.join(repoRoot, relativeDir);
  const destinationDir = path.join(tempDir, relativeDir);
  fs.mkdirSync(destinationDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const entryRelative = path.join(relativeDir, entry.name);
    if (entry.name.startsWith('@') && entry.isDirectory()) {
      mirrorNodeModules(repoRoot, realRepoRoot, tempDir, entryRelative);
      continue;
    }
    const workspaceTarget = entry.isSymbolicLink() ? workspaceLinkTarget(realRepoRoot, path.join(repoRoot, entryRelative)) : undefined;
    if (workspaceTarget !== undefined) {
      fs.symlinkSync(path.join(tempDir, workspaceTarget), path.join(tempDir, entryRelative), 'junction');
      continue;
    }
    linkSharedPath(path.join(repoRoot, entryRelative), path.join(tempDir, entryRelative));
  }
}
// Workspace managers such as pnpm keep package-only dependencies in each package's own node_modules,
// so linking only the root one would make mutants fail on module resolution and count as killed.
function hydrateTempRuntime(repoRoot: string, tempDir: string): void {
  const realRepoRoot = fs.realpathSync(repoRoot);
  for (const relativePath of nodeModulesRoots(repoRoot)) {
    if (fs.existsSync(path.dirname(path.join(tempDir, relativePath)))) {
      mirrorNodeModules(repoRoot, realRepoRoot, tempDir, relativePath);
    }
  }
}
function clearExcludedWorkspaceEntries(rootDir: string, currentDir: string): void {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = normalizePath(path.relative(rootDir, absolutePath));
    const excluded = MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name) || MUTATION_WORKSPACE_EXCLUDE_SET.has(relativePath);
    if (excluded) {
      if (entry.name === 'node_modules' || relativePath === 'node_modules') {
        continue;
      }
      fs.rmSync(absolutePath, { recursive: true, force: true });
      continue;
    }
    if (entry.isDirectory()) {
      clearExcludedWorkspaceEntries(rootDir, absolutePath);
    }
  }
}
function walkMutationWorkspace(rootDir: string, currentDir: string, visit: (absolutePath: string, relativePath: string, kind: 'file' | 'symlink') => void): void {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = normalizePath(path.relative(rootDir, absolutePath));
    if (entry.isDirectory()) {
      if (MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name) || MUTATION_WORKSPACE_EXCLUDE_SET.has(relativePath)) {
        continue;
      }
      walkMutationWorkspace(rootDir, absolutePath, visit);
      continue;
    }
    if (entry.isSymbolicLink() && (MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name) || MUTATION_WORKSPACE_EXCLUDE_SET.has(relativePath))) {
      continue;
    }
    visit(absolutePath, relativePath, entry.isSymbolicLink() ? 'symlink' : 'file');
  }
}
function restoreWorkspaceFile(repoRoot: string, tempDir: string, relativePath: string): void {
  const sourcePath = path.join(repoRoot, relativePath);
  const destinationPath = path.join(tempDir, relativePath);
  ensureDir(path.dirname(destinationPath));
  fs.rmSync(destinationPath, { recursive: true, force: true });
  fs.copyFileSync(sourcePath, destinationPath);
}
function pruneEmptyDirectories(rootDir: string, currentDir: string): boolean {
  let empty = true;
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = normalizePath(path.relative(rootDir, absolutePath));
    if (entry.isDirectory()) {
      if (MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name) || MUTATION_WORKSPACE_EXCLUDE_SET.has(relativePath)) {
        empty = false;
        continue;
      }
      if (pruneEmptyDirectories(rootDir, absolutePath)) {
        fs.rmdirSync(absolutePath);
        continue;
      }
      empty = false;
      continue;
    }
    empty = false;
  }
  return currentDir !== rootDir && empty;
}
export function prepareMutationWorkspace(repoRoot: string, repoFiles: RepoFileDigest[]): MutationWorkspace {
  const tempRoot = path.join(repoRoot, '.ts-quality', 'tmp-mutants');
  ensureDir(tempRoot);
  const tempDir = fs.mkdtempSync(path.join(tempRoot, 'mutant-'));
  copyRecursive(repoRoot, tempDir, MUTATION_WORKSPACE_EXCLUDE_SET);
  hydrateTempRuntime(repoRoot, tempDir);
  return {
    tempDir,
    snapshot: new Map(repoFiles.map(({ filePath, digest }) => [normalizePath(filePath), digest]))
  };
}
export function resetMutationWorkspace(repoRoot: string, workspace: MutationWorkspace): void {
  clearExcludedWorkspaceEntries(workspace.tempDir, workspace.tempDir);
  const seen = new Set<string>();
  walkMutationWorkspace(workspace.tempDir, workspace.tempDir, (absolutePath, relativePath, kind) => {
    const normalizedPath = normalizePath(relativePath);
    seen.add(normalizedPath);
    const expectedDigest = workspace.snapshot.get(normalizedPath);
    if (!expectedDigest) {
      fs.rmSync(absolutePath, { recursive: true, force: true });
      return;
    }
    if (kind === 'symlink' || fileDigest(absolutePath) !== expectedDigest) {
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
export function disposeMutationWorkspace(workspace: MutationWorkspace | undefined): void {
  if (!workspace) {
    return;
  }
  fs.rmSync(workspace.tempDir, { recursive: true, force: true });
}
function transpileRuntimeMirrorSource(repoRoot: string, site: MutationSite, mutatedSource: string): string {
  const compilerOptions = compilerOptionsForRepoFile(repoRoot, site.filePath) ?? {};
  const transpiled = ts.transpileModule(mutatedSource, {
    fileName: site.filePath,
    compilerOptions: {
      ...compilerOptions,
      target: compilerOptions.target ?? ts.ScriptTarget.ES2020,
      module: compilerOptions.module ?? ts.ModuleKind.CommonJS,
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
export function writeRuntimeMirrors(repoRoot: string, tempDir: string, site: MutationSite, mutatedSource: string, runtimeMirrorRoots: string[]): void {
  const extension = path.extname(site.filePath);
  const runtimeSource = extension === '.ts' || extension === '.tsx'
    ? transpileRuntimeMirrorSource(repoRoot, site, mutatedSource)
    : mutatedSource;
  for (const candidate of runtimeMirrorCandidates(site.filePath, runtimeMirrorRoots)) {
    const mirrorPath = path.join(tempDir, candidate);
    if (!fs.existsSync(mirrorPath) || !fs.statSync(mirrorPath).isFile()) {
      continue;
    }
    fs.writeFileSync(mirrorPath, runtimeSource, 'utf8');
  }
}
