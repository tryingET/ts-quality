import fs from 'fs';
import path from 'path';
import {
  ensureDir,
  normalizePath,
  readJson,
  resolveRepoLocalPath,
  type RunArtifact,
  stableStringify,
  writeJson
} from '../../evidence-model/src/index';
import {
  loadAgents,
  loadApprovals,
  loadConstitution,
  loadContext,
  loadInvariants,
  loadOverrides,
  loadWaivers
} from './config';
import { uniqueStrings } from './mutation-remediation';

/** Materializing authored config into runtime JSON and adopting reusable control-plane files from a pilot run. */

export interface MaterializeResult {
  configPath: string;
  outDir: string;
  files: string[];
}
export interface AdoptFromRunResult {
  sourceRunId: string;
  sourceRoot: string;
  copied: string[];
  skipped: Array<{ path: string; reason: string }>;
  omittedEphemeral: string[];
}
export function writeModuleExport(filePath: string, value: unknown): void {
  if (filePath.endsWith('.json')) {
    writeJson(filePath, value);
    return;
  }
  ensureDir(path.dirname(filePath));
  const existingText = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const useCommonJs = filePath.endsWith('.cjs') || /\bmodule\.exports\b|\bexports\.default\b/.test(existingText);
  const moduleText = useCommonJs
    ? `module.exports = ${stableStringify(value)};\n`
    : `export default ${stableStringify(value)};\n`;
  fs.writeFileSync(filePath, moduleText, 'utf8');
}
export function relativeToRoot(rootDir: string, targetPath: string): string {
  return normalizePath(path.relative(rootDir, targetPath));
}
function materializedOutputDir(rootDir: string, outDir?: string): string {
  const target = outDir ?? '.ts-quality/materialized';
  return resolveRepoLocalPath(rootDir, target, { allowMissing: true, kind: 'materialized output dir' }).absolutePath;
}
function materializedFilePath(outDir: string, fileName: string): string {
  return path.join(outDir, fileName);
}
function materializedInputRelativePath(sourceRelativePath: string): string {
  return path.posix.join('inputs', normalizePath(sourceRelativePath));
}
export function materializeProject(rootDir: string, options?: { configPath?: string; outDir?: string }): MaterializeResult {
  const loaded = loadContext(rootDir, options?.configPath);
  const outputDir = materializedOutputDir(rootDir, options?.outDir);
  ensureDir(outputDir);

  const invariants = loadInvariants(rootDir, loaded.config.invariantsPath);
  const constitution = loadConstitution(rootDir, loaded.config.constitutionPath);
  const agents = loadAgents(rootDir, loaded.config.agentsPath);
  const approvals = loadApprovals(rootDir, loaded.config.approvalsPath);
  const waivers = loadWaivers(rootDir, loaded.config.waiversPath);
  const overrides = loadOverrides(rootDir, loaded.config.overridesPath);

  const files: string[] = [];
  const writeMaterializedJson = (fileName: string, value: unknown): string => {
    const absolutePath = materializedFilePath(outputDir, fileName);
    writeJson(absolutePath, value);
    const relativePath = relativeToRoot(rootDir, absolutePath);
    files.push(relativePath);
    return relativePath;
  };

  const materializedConfig = {
    ...loaded.config,
    invariantsPath: writeMaterializedJson('invariants.json', invariants),
    constitutionPath: writeMaterializedJson('constitution.json', constitution),
    agentsPath: writeMaterializedJson('agents.json', agents),
    approvalsPath: writeMaterializedJson('approvals.json', approvals),
    waiversPath: writeMaterializedJson('waivers.json', waivers),
    overridesPath: writeMaterializedJson('overrides.json', overrides)
  };

  if (loaded.config.changeSet.diffFile) {
    const diffSourceResolution = resolveRepoLocalPath(rootDir, loaded.config.changeSet.diffFile, { allowMissing: true, kind: 'diff file' });
    if (fs.existsSync(diffSourceResolution.absolutePath)) {
      const diffTarget = materializedFilePath(outputDir, materializedInputRelativePath(diffSourceResolution.relativePath));
      ensureDir(path.dirname(diffTarget));
      fs.copyFileSync(diffSourceResolution.absolutePath, diffTarget);
      materializedConfig.changeSet = {
        ...materializedConfig.changeSet,
        diffFile: relativeToRoot(rootDir, diffTarget)
      };
      files.push(relativeToRoot(rootDir, diffTarget));
    }
  }

  const configTarget = materializedFilePath(outputDir, 'ts-quality.config.json');
  writeJson(configTarget, materializedConfig);
  const configPath = relativeToRoot(rootDir, configTarget);
  files.push(configPath);

  return {
    configPath,
    outDir: relativeToRoot(rootDir, outputDir),
    files
  };
}
function sourceRunPath(inputPath: string): string {
  const absoluteInput = path.resolve(inputPath);
  if (fs.existsSync(absoluteInput) && fs.statSync(absoluteInput).isFile()) {
    if (path.basename(absoluteInput) !== 'run.json') {
      throw new Error(`adoption source must be a run.json file or run directory: ${inputPath}`);
    }
    return absoluteInput;
  }
  const candidate = path.join(absoluteInput, 'run.json');
  if (!fs.existsSync(candidate)) {
    throw new Error(`adoption source run.json not found: ${inputPath}`);
  }
  return candidate;
}
function sourceRootForRunPath(runJsonPath: string): string {
  const runDir = path.dirname(runJsonPath);
  const runsDir = path.dirname(runDir);
  const tsQualityDir = path.dirname(runsDir);
  if (path.basename(runsDir) !== 'runs' || path.basename(tsQualityDir) !== '.ts-quality') {
    throw new Error(`adoption source must be under .ts-quality/runs/<run-id>/run.json: ${runJsonPath}`);
  }
  return path.dirname(tsQualityDir);
}
function sourceFileExistsInside(sourceRoot: string, relativePath: string): boolean {
  if (relativePath.endsWith('.receipt.json')) {
    return false;
  }
  try {
    const source = resolveRepoLocalPath(sourceRoot, relativePath, { kind: 'adoption source' });
    return fs.existsSync(source.absolutePath) && fs.statSync(source.absolutePath).isFile();
  } catch {
    return false;
  }
}
function sourceConfigAdoptionPaths(sourceRoot: string, run: RunArtifact): string[] {
  const explicitConfigPath = run.controlPlane?.configPath ?? run.analysis?.configPath;
  try {
    const loaded = loadContext(sourceRoot, explicitConfigPath);
    return [
      relativeToRoot(sourceRoot, loaded.configPath),
      loaded.config.invariantsPath,
      loaded.config.constitutionPath,
      loaded.config.agentsPath,
      loaded.config.approvalsPath,
      loaded.config.waiversPath,
      loaded.config.overridesPath,
      ...trustedPublicKeyFiles(sourceRoot, loaded.config.trustedKeysDir)
    ];
  } catch {
    return [
      run.controlPlane?.configPath,
      run.analysis?.configPath,
      '.ts-quality/invariants.ts',
      '.ts-quality/invariants.js',
      '.ts-quality/invariants.json',
      run.controlPlane?.constitutionPath,
      run.controlPlane?.agentsPath,
      run.controlPlane?.approvalsPath,
      run.controlPlane?.waiversPath,
      run.controlPlane?.overridesPath
    ].filter((item): item is string => typeof item === 'string' && item.length > 0);
  }
}
function trustedPublicKeyFiles(sourceRoot: string, trustedKeysDir: string): string[] {
  try {
    const directory = resolveRepoLocalPath(sourceRoot, trustedKeysDir, { allowMissing: true, kind: 'trusted keys dir' });
    if (!fs.existsSync(directory.absolutePath) || !fs.statSync(directory.absolutePath).isDirectory()) {
      return [];
    }
    return fs.readdirSync(directory.absolutePath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.pub.pem'))
      .map((entry) => normalizePath(path.join(directory.relativePath, entry.name)))
      .filter((relativePath) => sourceFileExistsInside(sourceRoot, relativePath));
  } catch {
    return [];
  }
}
function existingAdoptionSourceFiles(sourceRoot: string, run: RunArtifact): string[] {
  const candidates = uniqueStrings([
    ...sourceConfigAdoptionPaths(sourceRoot, run),
    ...run.behaviorClaims.flatMap((claim) => claim.evidenceSummary?.executionWitnessFiles ?? [])
  ].filter((item): item is string => typeof item === 'string' && item.length > 0));
  return candidates.filter((relativePath) => sourceFileExistsInside(sourceRoot, relativePath));
}
function copyAdoptionFile(sourceRoot: string, targetRoot: string, relativePath: string, result: AdoptFromRunResult): void {
  const source = resolveRepoLocalPath(sourceRoot, relativePath, { kind: 'adoption source' });
  const target = resolveRepoLocalPath(targetRoot, relativePath, { allowMissing: true, kind: 'adoption target' });
  if (fs.existsSync(target.absolutePath)) {
    if (!fs.statSync(target.absolutePath).isFile()) {
      result.skipped.push({ path: relativePath, reason: 'already-exists-non-file' });
      return;
    }
    const existing = fs.readFileSync(target.absolutePath);
    const incoming = fs.readFileSync(source.absolutePath);
    result.skipped.push({ path: relativePath, reason: existing.equals(incoming) ? 'already-exists-identical' : 'already-exists-different' });
    return;
  }
  ensureDir(path.dirname(target.absolutePath));
  fs.copyFileSync(source.absolutePath, target.absolutePath);
  result.copied.push(relativePath);
}
export function adoptFromRun(rootDir: string, options: { fromRun: string }): AdoptFromRunResult {
  const runJsonPath = sourceRunPath(options.fromRun);
  const sourceRoot = sourceRootForRunPath(runJsonPath);
  const run = readJson<RunArtifact>(runJsonPath);
  const runDirectoryId = path.basename(path.dirname(runJsonPath));
  if (run.runId !== runDirectoryId) {
    throw new Error(`adoption source run id mismatch: run.json says ${run.runId} but directory is ${runDirectoryId}`);
  }
  const result: AdoptFromRunResult = {
    sourceRunId: run.runId,
    sourceRoot,
    copied: [],
    skipped: [],
    omittedEphemeral: uniqueStrings([
      '.ts-quality/runs/',
      '.ts-quality/latest.json',
      '.ts-quality/mutation-manifest.json',
      run.analysis?.coverageLcovPath,
      ...run.behaviorClaims.flatMap((claim) => (claim.evidenceSummary?.executionWitnessFiles ?? []).map((filePath) => filePath.replace(/\.json$/u, '.receipt.json')))
    ].filter((item): item is string => typeof item === 'string' && item.length > 0))
  };
  for (const relativePath of existingAdoptionSourceFiles(sourceRoot, run)) {
    copyAdoptionFile(sourceRoot, rootDir, relativePath, result);
  }
  result.copied.sort();
  result.skipped.sort((left, right) => left.path.localeCompare(right.path));
  return result;
}
