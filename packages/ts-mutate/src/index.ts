import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import ts from 'typescript';
import {
  type ChangedRegion,
  type CoverageEvidence,
  type ExecutionReceipt,
  type MutationResult,
  type MutationSite,
  changedFileSet,
  collectSourceFiles,
  compilerOptionsForRepoFile,
  digestObject,
  ensureDir,
  fileDigest,
  findCoverageEvidence,
  listFiles,
  matchPattern,
  normalizePath,
  readJson,
  runtimeMirrorCandidates,
  spanOverlaps,
  writeJson
} from '../../evidence-model/src/index';

export interface MutationManifest {
  version: '2';
  entries: Record<string, MutationResult>;
}

export interface MutationOptions {
  repoRoot: string;
  testCommand: string[];
  sourceFiles?: string[];
  changedFiles?: string[];
  changedRegions?: ChangedRegion[];
  coverage?: CoverageEvidence[];
  coveredOnly?: boolean;
  runtimeMirrorRoots?: string[];
  manifestPath?: string;
  timeoutMs?: number;
  maxSites?: number;
}

export interface MutationRun {
  sites: MutationSite[];
  results: MutationResult[];
  score: number;
  killed: number;
  survived: number;
  baseline: ExecutionReceipt;
  executionFingerprint: string;
}

interface RepoFileDigest {
  filePath: string;
  digest: string;
}

interface MutationWorkspace {
  tempDir: string;
  snapshot: Map<string, string>;
}

interface MutationSourceSpan {
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
}

const MUTATION_RUNTIME_VERSION = '5';
const SANITIZED_MUTATION_ENV_KEYS = ['NODE_TEST_CONTEXT'];
const MUTATION_WORKSPACE_EXCLUDES = ['.git', 'node_modules', '.ts-quality'];
const MUTATION_WORKSPACE_EXCLUDE_SET = new Set(MUTATION_WORKSPACE_EXCLUDES);

function mutationCommandEnv(baseEnv: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  const env = { ...baseEnv };
  for (const key of SANITIZED_MUTATION_ENV_KEYS) {
    delete env[key];
  }
  return env;
}

function mutationEnvFingerprint(env: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([, value]) => typeof value === 'string' && value.length > 0)
      .sort(([left], [right]) => left.localeCompare(right))
  ) as Record<string, string>;
}

function lineOf(node: ts.Node, sourceFile: ts.SourceFile): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function spanFor(node: ts.Node, sourceFile: ts.SourceFile): MutationSourceSpan {
  const startLine = lineOf(node, sourceFile);
  const endLine = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
  return { startLine, endLine, startOffset: node.getStart(sourceFile), endOffset: node.end };
}

function coverageForLine(filePath: string, line: number, coverage: CoverageEvidence[]): boolean {
  const entry = findCoverageEvidence(filePath, coverage);
  if (!entry) {
    return false;
  }
  return (entry.lines[String(line)] ?? 0) > 0;
}

function mutationId(filePath: string, span: { startLine: number; endLine: number; startOffset: number; endOffset: number }, original: string, replacement: string): string {
  return digestObject({ filePath: normalizePath(filePath), span, original, replacement });
}

export function discoverMutationSites(sourceText: string, filePath: string, coverage: CoverageEvidence[] = [], changedFiles: string[] = [], changedRegions: ChangedRegion[] = [], coveredOnly = false): MutationSite[] {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const sites: MutationSite[] = [];
  const changed = changedFileSet(changedFiles, changedRegions);
  const fileRegions = changedRegions.filter((item) => normalizePath(item.filePath) === normalizePath(filePath));

  function consider(node: ts.Node, replacement: string, operator: string, description: string): void {
    const span = spanFor(node, sourceFile);
    const line = span.startLine;
    const inChangedRegion = fileRegions.some((region) => spanOverlaps(line, region.span));
    if (changed.size > 0) {
      const inChangeScope = fileRegions.length > 0 ? inChangedRegion : changed.has(normalizePath(filePath));
      if (!inChangeScope) {
        return;
      }
    }
    if (coveredOnly && !coverageForLine(filePath, line, coverage)) {
      return;
    }
    const original = node.getText(sourceFile);
    sites.push({
      id: mutationId(filePath, span, original, replacement),
      filePath: normalizePath(filePath),
      span: { startLine: span.startLine, endLine: span.endLine },
      startOffset: span.startOffset,
      endOffset: span.endOffset,
      operator,
      original,
      replacement,
      description
    });
  }

  function visit(node: ts.Node): void {
    if (ts.isBinaryExpression(node)) {
      const token = node.operatorToken.kind;
      const text = node.operatorToken.getText(sourceFile);
      if (token === ts.SyntaxKind.EqualsEqualsEqualsToken) {
        consider(node.operatorToken, '!==', text, 'strict equality inversion');
      } else if (token === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
        consider(node.operatorToken, '===', text, 'strict inequality inversion');
      } else if (token === ts.SyntaxKind.GreaterThanToken) {
        consider(node.operatorToken, '>=', text, 'greater-than relaxation');
      } else if (token === ts.SyntaxKind.GreaterThanEqualsToken) {
        consider(node.operatorToken, '>', text, 'greater-than tightening');
      } else if (token === ts.SyntaxKind.LessThanToken) {
        consider(node.operatorToken, '<=', text, 'less-than relaxation');
      } else if (token === ts.SyntaxKind.LessThanEqualsToken) {
        consider(node.operatorToken, '<', text, 'less-than tightening');
      } else if (token === ts.SyntaxKind.PlusToken) {
        consider(node.operatorToken, '-', text, 'addition to subtraction');
      } else if (token === ts.SyntaxKind.MinusToken) {
        consider(node.operatorToken, '+', text, 'subtraction to addition');
      } else if (token === ts.SyntaxKind.AmpersandAmpersandToken) {
        consider(node.operatorToken, '||', text, 'and to or');
      } else if (token === ts.SyntaxKind.BarBarToken) {
        consider(node.operatorToken, '&&', text, 'or to and');
      }
    }
    if (node.kind === ts.SyntaxKind.TrueKeyword) {
      consider(node, 'false', 'true', 'boolean flip true->false');
    }
    if (node.kind === ts.SyntaxKind.FalseKeyword) {
      consider(node, 'true', 'false', 'boolean flip false->true');
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return sites;
}

export function applyMutation(sourceText: string, site: MutationSite): string {
  return `${sourceText.slice(0, site.startOffset)}${site.replacement}${sourceText.slice(site.endOffset)}`;
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

function hasSyntaxErrors(filePath: string, sourceText: string): boolean {
  const transpileResult = ts.transpileModule(sourceText, {
    fileName: filePath,
    compilerOptions: {
      allowJs: true,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS
    },
    reportDiagnostics: true
  });
  return (transpileResult.diagnostics ?? []).some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
}

function stdioText(value: string | Buffer | undefined): string {
  return typeof value === 'string' ? value : value ? value.toString('utf8') : '';
}

function commandDetails(result: ReturnType<typeof spawnSync>): string {
  return `${stdioText(result.stdout).trim()}\n${stdioText(result.stderr).trim()}`.trim().slice(0, 280);
}

function requiredExecutable(command: string[]): string {
  const executable = command[0];
  if (!executable) {
    throw new Error('Mutation test command must contain an executable argument.');
  }
  return executable;
}

function runCommandReceipt(cwd: string, testCommand: string[], timeoutMs: number): ExecutionReceipt {
  const started = Date.now();
  const result = spawnSync(requiredExecutable(testCommand), testCommand.slice(1), {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    shell: process.platform === 'win32',
    env: mutationCommandEnv()
  });
  const durationMs = Date.now() - started;
  if (result.error) {
    const error = result.error as { code?: string; message?: string };
    const status = error.code === 'ETIMEDOUT' ? 'timeout' : 'error';
    return {
      status,
      exitCode: typeof result.status === 'number' ? result.status : undefined,
      durationMs,
      details: error.message ?? 'unknown test command error'
    };
  }
  return {
    status: result.status === 0 ? 'pass' : 'fail',
    exitCode: typeof result.status === 'number' ? result.status : undefined,
    durationMs,
    details: commandDetails(result)
  };
}

function canonicalRuntimeMirrorRoots(runtimeMirrorRoots: string[] | undefined): string[] {
  const seen = new Set<string>();
  const roots: string[] = [];
  for (const candidate of runtimeMirrorRoots ?? ['dist']) {
    const normalized = normalizePath(candidate);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    roots.push(normalized);
  }
  return roots.length > 0 ? roots : ['dist'];
}

function repoFileDigests(repoRoot: string): RepoFileDigest[] {
  return listFiles(repoRoot, { excludeDirs: MUTATION_WORKSPACE_EXCLUDES })
    .map((filePath) => ({ filePath, digest: fileDigest(path.join(repoRoot, filePath)) }));
}

function buildExecutionFingerprint(testCommand: string[], runtimeMirrorRoots: string[], repoFiles: RepoFileDigest[]): string {
  const effectiveEnv = mutationCommandEnv();
  return digestObject({
    mutationRuntimeVersion: MUTATION_RUNTIME_VERSION,
    testCommand,
    runtimeMirrorRoots,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    env: mutationEnvFingerprint(effectiveEnv),
    repoFiles
  });
}

function manifestKey(repoRoot: string, site: MutationSite, executionFingerprint: string): string {
  const absolutePath = path.join(repoRoot, site.filePath);
  const fileText = fs.readFileSync(absolutePath, 'utf8');
  return digestObject({ site, sourceDigest: digestObject(fileText), executionFingerprint });
}

function loadManifest(filePath: string | undefined): MutationManifest {
  if (!filePath || !fs.existsSync(filePath)) {
    return { version: '2', entries: {} };
  }
  const manifest = readJson<MutationManifest>(filePath);
  return manifest.version === '2' ? manifest : { version: '2', entries: {} };
}

function saveManifest(filePath: string | undefined, manifest: MutationManifest): void {
  if (!filePath) {
    return;
  }
  writeJson(filePath, manifest);
}

function linkSharedPath(sourcePath: string, destinationPath: string): void {
  if (!fs.existsSync(sourcePath) || fs.existsSync(destinationPath)) {
    return;
  }
  const type = fs.statSync(sourcePath).isDirectory() ? 'junction' : 'file';
  fs.symlinkSync(sourcePath, destinationPath, type);
}

function hydrateTempRuntime(repoRoot: string, tempDir: string): void {
  linkSharedPath(path.join(repoRoot, 'node_modules'), path.join(tempDir, 'node_modules'));
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

function prepareMutationWorkspace(repoRoot: string, repoFiles: RepoFileDigest[]): MutationWorkspace {
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

function resetMutationWorkspace(repoRoot: string, workspace: MutationWorkspace): void {
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

function disposeMutationWorkspace(workspace: MutationWorkspace | undefined): void {
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

function writeRuntimeMirrors(repoRoot: string, tempDir: string, site: MutationSite, mutatedSource: string, runtimeMirrorRoots: string[]): void {
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

function runSingleMutation(repoRoot: string, workspace: MutationWorkspace, site: MutationSite, mutatedSource: string, testCommand: string[], timeoutMs: number, runtimeMirrorRoots: string[]): MutationResult {
  if (hasSyntaxErrors(site.filePath, mutatedSource)) {
    return {
      kind: 'mutation-result',
      siteId: site.id,
      filePath: site.filePath,
      status: 'invalid',
      durationMs: 0,
      details: 'Mutation produced syntax errors'
    };
  }

  try {
    const targetPath = path.join(workspace.tempDir, site.filePath);
    ensureDir(path.dirname(targetPath));
    fs.writeFileSync(targetPath, mutatedSource, 'utf8');
    writeRuntimeMirrors(repoRoot, workspace.tempDir, site, mutatedSource, runtimeMirrorRoots);
    const receipt = runCommandReceipt(workspace.tempDir, testCommand, timeoutMs);
    return {
      kind: 'mutation-result',
      siteId: site.id,
      filePath: site.filePath,
      status: receipt.status === 'pass' ? 'survived' : receipt.status === 'fail' ? 'killed' : 'error',
      durationMs: receipt.durationMs,
      details: receipt.status === 'timeout' ? `test command timed out: ${receipt.details}` : receipt.details
    };
  } finally {
    resetMutationWorkspace(repoRoot, workspace);
  }
}

export function runMutations(options: MutationOptions): MutationRun {
  const sourceFiles = (options.sourceFiles ?? collectSourceFiles(options.repoRoot, ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx', 'src/**/*.mjs', 'src/**/*.cjs']))
    .filter((filePath) => !matchPattern('**/*.d.ts', filePath));
  const coverage = options.coverage ?? [];
  const changedFiles = options.changedFiles ?? [];
  const changedRegions = options.changedRegions ?? [];
  const sites = sourceFiles.flatMap((relativePath) => {
    const sourceText = fs.readFileSync(path.join(options.repoRoot, relativePath), 'utf8');
    return discoverMutationSites(sourceText, relativePath, coverage, changedFiles, changedRegions, options.coveredOnly ?? false);
  });
  const limitedSites = typeof options.maxSites === 'number' ? sites.slice(0, options.maxSites) : sites;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const runtimeMirrorRoots = canonicalRuntimeMirrorRoots(options.runtimeMirrorRoots);
  const baseline = runCommandReceipt(options.repoRoot, options.testCommand, timeoutMs);
  const repoFiles = repoFileDigests(options.repoRoot);
  const executionFingerprint = buildExecutionFingerprint(options.testCommand, runtimeMirrorRoots, repoFiles);
  if (baseline.status !== 'pass') {
    const results = limitedSites.map((site) => ({
      kind: 'mutation-result' as const,
      siteId: site.id,
      filePath: site.filePath,
      status: 'error' as const,
      durationMs: baseline.durationMs,
      details: `Baseline test command must pass before mutation scoring is trusted. ${baseline.details}`.trim().slice(0, 280)
    }));
    return {
      sites: limitedSites,
      results,
      score: 0,
      killed: 0,
      survived: 0,
      baseline,
      executionFingerprint
    };
  }

  const manifest = loadManifest(options.manifestPath);
  const results: MutationResult[] = [];
  let workspace: MutationWorkspace | undefined;

  try {
    for (const site of limitedSites) {
      const key = manifestKey(options.repoRoot, site, executionFingerprint);
      const cached = manifest.entries[key];
      if (cached) {
        results.push(cached);
        continue;
      }
      workspace ??= prepareMutationWorkspace(options.repoRoot, repoFiles);
      const sourceText = fs.readFileSync(path.join(options.repoRoot, site.filePath), 'utf8');
      const mutatedSource = applyMutation(sourceText, site);
      const result = runSingleMutation(options.repoRoot, workspace, site, mutatedSource, options.testCommand, timeoutMs, runtimeMirrorRoots);
      results.push(result);
      manifest.entries[key] = result;
    }
  } finally {
    disposeMutationWorkspace(workspace);
  }

  saveManifest(options.manifestPath, manifest);
  const killed = results.filter((result) => result.status === 'killed').length;
  const survived = results.filter((result) => result.status === 'survived').length;
  const total = killed + survived;
  return {
    sites: limitedSites,
    results,
    score: total === 0 ? 1 : killed / total,
    killed,
    survived,
    baseline,
    executionFingerprint
  };
}
