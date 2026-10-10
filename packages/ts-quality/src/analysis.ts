import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import {
  type AnalysisContext,
  type AnalysisWarning,
  buildRepositoryEntity,
  collectSourceFiles,
  type CoverageGenerationRecord,
  DEFAULT_TEST_PATTERNS,
  ensureDir,
  type ExecutionReceipt,
  fileDigest,
  type FileEntity,
  matchPattern,
  normalizePath,
  nowIso,
  resolvePackageName,
  resolveRepoLocalPath,
  type RunArtifact,
  runtimeMirrorCandidates,
  type SymbolEntity
} from '../../evidence-model/src/index';
import { analyzeCrap, parseLcov } from '../../crap4ts/src/index';
import { collectExecutionWitnessPlanSummary } from '../../invariants/src/index';
import { loadChangedRegions, loadContext, loadInvariants } from './config';
import {
  ExecutionWitnessRefreshResult,
  ExecutionWitnessRefreshSkipped,
  ExecutionWitnessRefreshSummary,
  executionWitnessCommandDetails,
  executionWitnessCommandEnv,
  runExecutionWitnessCommand
} from './witness-commands';

/** Check-time analysis: changed scope, coverage generation and reading, witness plans and the analysis context. */

export function fileEntities(rootDir: string, filePaths: string[]): FileEntity[] {
  const repo = buildRepositoryEntity(rootDir, filePaths);
  return filePaths.map((filePath) => {
    const normalizedFilePath = normalizePath(filePath);
    const result: FileEntity = {
      filePath: normalizedFilePath,
      digest: fileDigest(path.join(rootDir, filePath))
    };
    const packageName = resolvePackageName(normalizedFilePath, repo.packages);
    if (packageName) {
      result.packageName = packageName;
    }
    return result;
  });
}
export function symbolEntities(complexity: RunArtifact['complexity']): SymbolEntity[] {
  return complexity.map((item) => ({
    filePath: item.filePath,
    symbol: item.symbol,
    kind: item.symbol.split(':')[0] ?? 'function',
    span: item.span
  }));
}
export interface AnalysisManifest {
  loaded: ReturnType<typeof loadContext>;
  sourceFiles: string[];
  changedFiles: string[];
  changedRegions: RunArtifact['changedRegions'];
  coveragePath: string;
  coverage: RunArtifact['coverage'];
  coverageGeneration?: CoverageGenerationRecord | undefined;
  runtimeMirrorRoots: string[];
}
function resolveChangedFileOverride(rootDir: string, filePath: string): string {
  return resolveRepoLocalPath(rootDir, filePath, { allowMissing: true, kind: 'changed file override' }).relativePath;
}
export function uniquePaths(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values.map((item) => normalizePath(item)).filter(Boolean)) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}
function missingChangeScopeError(diffFile?: string): Error {
  const detail = diffFile
    ? ` Configured diff file ${diffFile} did not contribute any changed hunks.`
    : '';
  return new Error(`Changed scope is required.${detail} Provide --changed <a,b,c> or configure changeSet.files / changeSet.diffFile with at least one changed file or hunk before running ts-quality check.`);
}
function runCoverageGenerationCommand(rootDir: string, input: { lcovPath: string; command: string[]; timeoutMs: number; attemptedAt: string }): CoverageGenerationRecord {
  const command = input.command.filter((item) => item.length > 0);
  if (command.length === 0) {
    throw new Error('coverage.generateCommand must contain at least one executable argument');
  }
  const executable = command[0];
  if (!executable) {
    throw new Error('coverage.generateCommand must contain an executable argument');
  }
  const started = Date.now();
  const result = spawnSync(executable, command.slice(1), {
    cwd: rootDir,
    encoding: 'utf8',
    timeout: input.timeoutMs,
    shell: process.platform === 'win32',
    env: executionWitnessCommandEnv()
  });
  const durationMs = Date.now() - started;
  const receipt: ExecutionReceipt = result.error
    ? {
        status: (result.error as { code?: string }).code === 'ETIMEDOUT' ? 'timeout' : 'error',
        exitCode: typeof result.status === 'number' ? result.status : undefined,
        durationMs,
        details: (result.error as { message?: string }).message ?? 'unknown coverage generation command error'
      }
    : {
        status: result.status === 0 ? 'pass' : 'fail',
        exitCode: typeof result.status === 'number' ? result.status : undefined,
        durationMs,
        details: executionWitnessCommandDetails(result)
      };
  return {
    lcovPath: input.lcovPath,
    command,
    attemptedAt: input.attemptedAt,
    receipt
  };
}
function readCoverageWithOptionalGeneration(rootDir: string, input: { coveragePath: string; generateCommand: string[]; generateWhenMissing: boolean; generateTimeoutMs: number; generateCoverage: boolean; attemptedAt: string }): { coverage: RunArtifact['coverage']; coverageGeneration?: CoverageGenerationRecord | undefined } {
  const coverageAbsolutePath = path.join(rootDir, input.coveragePath);
  if (fs.existsSync(coverageAbsolutePath)) {
    return { coverage: parseLcov(fs.readFileSync(coverageAbsolutePath, 'utf8')) };
  }
  if (!input.generateCoverage || !input.generateWhenMissing || input.generateCommand.length === 0) {
    return { coverage: [] };
  }
  ensureDir(path.dirname(coverageAbsolutePath));
  const coverageGeneration = runCoverageGenerationCommand(rootDir, {
    lcovPath: input.coveragePath,
    command: input.generateCommand,
    timeoutMs: input.generateTimeoutMs,
    attemptedAt: input.attemptedAt
  });
  if (coverageGeneration.receipt.status !== 'pass') {
    // Raw text: the CLI error boundary escapes control characters once; pre-escaping here double-escaped them.
    throw new Error(`coverage generation command ${coverageGeneration.receipt.status}; expected LCOV at ${input.coveragePath}${coverageGeneration.receipt.details ? `\n${coverageGeneration.receipt.details}` : ''}`);
  }
  if (!fs.existsSync(coverageAbsolutePath)) {
    throw new Error(`coverage generation command passed but did not create expected LCOV at ${input.coveragePath}`);
  }
  return {
    coverage: parseLcov(fs.readFileSync(coverageAbsolutePath, 'utf8')),
    coverageGeneration
  };
}
export function buildAnalysisManifest(rootDir: string, options?: { changedFiles?: string[]; configPath?: string; generateCoverage?: boolean; observedAt?: string }): AnalysisManifest {
  const loaded = loadContext(rootDir, options?.configPath);
  const sourceFiles = sourceFilesExcludingTests(rootDir, loaded.config.sourcePatterns, loaded.config.testPatterns ?? [...DEFAULT_TEST_PATTERNS]);
  const changedRegions = loaded.config.changeSet.diffFile ? loadChangedRegions(rootDir, loaded.config.changeSet.diffFile) : [];
  const configuredChangedFiles = loaded.config.changeSet.files ?? [];
  const baseChangedFiles = options?.changedFiles
    ? options.changedFiles.map((item) => resolveChangedFileOverride(rootDir, item))
    : [...configuredChangedFiles];
  const changedFiles = uniquePaths([...baseChangedFiles, ...changedRegions.map((item) => item.filePath)]);
  if (changedFiles.length === 0) {
    throw missingChangeScopeError(loaded.config.changeSet.diffFile || undefined);
  }
  const coveragePath = loaded.config.coverage.lcovPath ?? 'coverage/lcov.info';
  const coverageResult = readCoverageWithOptionalGeneration(rootDir, {
    coveragePath,
    generateCommand: loaded.config.coverage.generateCommand ?? [],
    generateWhenMissing: loaded.config.coverage.generateWhenMissing ?? true,
    generateTimeoutMs: loaded.config.coverage.generateTimeoutMs ?? 60_000,
    generateCoverage: options?.generateCoverage ?? false,
    attemptedAt: options?.observedAt ?? nowIso()
  });
  return {
    loaded,
    sourceFiles,
    changedFiles,
    changedRegions,
    coveragePath,
    coverage: coverageResult.coverage,
    ...(coverageResult.coverageGeneration ? { coverageGeneration: coverageResult.coverageGeneration } : {}),
    runtimeMirrorRoots: [...(loaded.config.mutations.runtimeMirrorRoots ?? ['dist'])]
  };
}
export function refreshExecutionWitnessPlans(rootDir: string, input: {
  sourceFiles: string[];
  changedFiles: string[];
  changedRegions: RunArtifact['changedRegions'];
  coverage: RunArtifact['coverage'];
  invariants: ReturnType<typeof loadInvariants>;
  observedAt: string;
}): ExecutionWitnessRefreshSummary {
  const crapReport = analyzeCrap({
    rootDir,
    sourceFiles: input.sourceFiles,
    coverage: input.coverage,
    changedFiles: input.changedFiles,
    changedRegions: input.changedRegions
  });
  const planSummary = collectExecutionWitnessPlanSummary({
    invariants: input.invariants,
    changedFiles: input.changedFiles,
    changedRegions: input.changedRegions,
    complexity: crapReport.hotspots
  });
  const autoRan: ExecutionWitnessRefreshResult[] = [];
  for (const witnessPlan of planSummary.autoRun) {
    const witnessResult = runExecutionWitnessCommand(rootDir, {
      invariantId: witnessPlan.invariantId,
      scenarioId: witnessPlan.scenarioId,
      sourceFiles: witnessPlan.sourceFiles,
      ...(witnessPlan.testFiles.length > 0 ? { testFiles: witnessPlan.testFiles } : {}),
      outputPath: witnessPlan.outputPath,
      command: witnessPlan.command,
      ...(witnessPlan.timeoutMs !== undefined ? { timeoutMs: witnessPlan.timeoutMs } : {}),
      observedAt: input.observedAt
    });
    autoRan.push({
      invariantId: witnessPlan.invariantId,
      scenarioId: witnessPlan.scenarioId,
      outputPath: witnessResult.recordedOutputPath,
      receiptPath: witnessResult.recordedReceiptPath,
      command: [...witnessPlan.command],
      sourceFiles: [...witnessPlan.sourceFiles],
      ...(witnessPlan.testFiles.length > 0 ? { testFiles: [...witnessPlan.testFiles] } : {}),
      observedAt: input.observedAt,
      receipt: witnessResult.receipt
    });
  }
  const skipped: ExecutionWitnessRefreshSkipped[] = planSummary.skipped.map((item) => ({
    invariantId: item.invariantId,
    scenarioId: item.scenarioId,
    outputPath: item.outputPath,
    command: [...item.command],
    ...(item.testFiles.length > 0 ? { testFiles: [...item.testFiles] } : {}),
    reason: item.reason
  }));
  return { autoRan, skipped };
}
export function buildAnalysisContext(input: {
  runId: string;
  createdAt: string;
  configPath: string;
  coverageLcovPath: string;
  runtimeMirrorRoots: string[];
  sourceFiles: string[];
  changedFiles: string[];
  changedRegions: RunArtifact['changedRegions'];
  executionFingerprint: string;
}): AnalysisContext {
  return {
    runId: input.runId,
    createdAt: input.createdAt,
    configPath: input.configPath,
    coverageLcovPath: input.coverageLcovPath,
    runtimeMirrorRoots: [...input.runtimeMirrorRoots],
    sourceFiles: [...input.sourceFiles],
    changedFiles: [...input.changedFiles],
    changedRegions: [...input.changedRegions],
    executionFingerprint: input.executionFingerprint
  };
}
export function isSourceTsFile(filePath: string): boolean {
  return /(?:^|\/)src\/.*\.tsx?$/.test(normalizePath(filePath));
}
export function builtOutputRoots(runtimeMirrorRoots: string[]): string[] {
  return uniquePaths(['dist', 'lib', 'build', ...runtimeMirrorRoots]);
}
function coverageHasFile(coverage: RunArtifact['coverage'], filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return coverage.some((item) => normalizePath(item.filePath) === normalized);
}
export function detectBuiltOutputCoverageWarnings(input: { changedFiles: string[]; coverage: RunArtifact['coverage']; runtimeMirrorRoots: string[] }): AnalysisWarning[] {
  const roots = builtOutputRoots(input.runtimeMirrorRoots);
  const warnings: AnalysisWarning[] = [];
  const coveredFiles = input.coverage.map((item) => normalizePath(item.filePath));
  for (const changedFile of input.changedFiles.map((item) => normalizePath(item)).filter(isSourceTsFile)) {
    if (coverageHasFile(input.coverage, changedFile)) {
      continue;
    }
    const mirrorCandidates = runtimeMirrorCandidates(changedFile, roots);
    const matchingBuilt = coveredFiles.filter((filePath) => mirrorCandidates.includes(filePath));
    if (matchingBuilt.length === 0) {
      continue;
    }
    warnings.push({
      code: 'coverage-built-output-without-source-map',
      message: 'Coverage exists for built output but not changed source.',
      changedFile,
      evidence: [`changed source ${changedFile} has no LCOV entry`, `built LCOV entries: ${matchingBuilt.slice(0, 5).join(', ')}`],
      hint: 'Coverage exists for built output but not changed source. Enable source-map coverage mapping, for example NODE_OPTIONS=--enable-source-maps, or configure coverage to map back to src/**.'
    });
  }
  return warnings;
}
export function refreshExecutionWitnesses(rootDir: string, options?: { changedFiles?: string[]; configPath?: string; observedAt?: string }): ExecutionWitnessRefreshSummary {
  const manifest = buildAnalysisManifest(rootDir, options);
  const invariants = loadInvariants(rootDir, manifest.loaded.config.invariantsPath);
  return refreshExecutionWitnessPlans(rootDir, {
    sourceFiles: manifest.sourceFiles,
    changedFiles: manifest.changedFiles.map((item) => normalizePath(item)),
    changedRegions: manifest.changedRegions,
    coverage: manifest.coverage,
    invariants,
    observedAt: options?.observedAt ?? nowIso()
  });
}
/** Source files are never test files, even when tests are colocated under a source root such as src/__tests__. */
export function sourceFilesExcludingTests(rootDir: string, sourcePatterns: string[], testPatterns: string[]): string[] {
  return collectSourceFiles(rootDir, sourcePatterns).filter((filePath) => !testPatterns.some((pattern) => matchPattern(pattern, filePath)));
}
