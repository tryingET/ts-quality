import path from 'path';
import { executionWitnessBindingIssue } from '../../evidence-model/src/witness';
import {
  type ChangedRegion,
  type ComplexityEvidence,
  type ExecutionWitnessBinding,
  type ExecutionWitnessRecord,
  type InvariantEvidenceMode,
  type InvariantSpec,
  listFiles,
  matchPattern,
  normalizePath,
  readJson
} from '../../evidence-model/src/index';
import type { InvariantEvaluationOptions } from './evaluate';
import { unique } from './test-documents';

/** Execution witness records and plans: which configured witness commands an invariant's changed scope impacts. */

export interface ExecutionWitnessGenerationPlan {
  invariantId: string;
  scenarioId: string;
  sourceFiles: string[];
  testFiles: string[];
  outputPath: string;
  command: string[];
  timeoutMs?: number;
}
export interface ExecutionWitnessSkippedPlan {
  invariantId: string;
  scenarioId: string;
  outputPath: string;
  command: string[];
  testFiles: string[];
  reason: 'invariant-not-impacted';
}
export interface ExecutionWitnessPlanSummary {
  autoRun: ExecutionWitnessGenerationPlan[];
  skipped: ExecutionWitnessSkippedPlan[];
}
const DEFAULT_EXECUTION_WITNESS_PATTERNS = ['.ts-quality/witnesses/**/*.json'];
function parseExecutionWitnessRecord(rootDir: string, filePath: string): ExecutionWitnessRecord {
  const absolutePath = path.join(rootDir, filePath);
  const raw = readJson<Record<string, unknown>>(absolutePath);
  const version = raw['version'];
  const kind = raw['kind'];
  const invariantId = raw['invariantId'];
  const scenarioId = raw['scenarioId'];
  const status = raw['status'];
  const sourceFiles = raw['sourceFiles'];
  const testFiles = raw['testFiles'];
  const observedAt = raw['observedAt'];
  if (version !== '1') {
    throw new Error(`Execution witness ${filePath} must declare version '1'`);
  }
  if (kind !== 'execution-witness') {
    throw new Error(`Execution witness ${filePath} must declare kind 'execution-witness'`);
  }
  if (typeof invariantId !== 'string' || invariantId.length === 0) {
    throw new Error(`Execution witness ${filePath} must declare a non-empty invariantId`);
  }
  if (typeof scenarioId !== 'string' || scenarioId.length === 0) {
    throw new Error(`Execution witness ${filePath} must declare a non-empty scenarioId`);
  }
  if (status !== 'pass' && status !== 'fail') {
    throw new Error(`Execution witness ${filePath} must declare status 'pass' or 'fail'`);
  }
  if (!Array.isArray(sourceFiles) || sourceFiles.some((item) => typeof item !== 'string')) {
    throw new Error(`Execution witness ${filePath} must declare sourceFiles as an array of strings`);
  }
  if (testFiles !== undefined && (!Array.isArray(testFiles) || testFiles.some((item) => typeof item !== 'string'))) {
    throw new Error(`Execution witness ${filePath} must declare testFiles as an array of strings when present`);
  }
  // Observation metadata has no bearing on safety/selection. Malformed metadata
  // cannot hide a current failure in default discovery.
  return {
    version: '1',
    kind: 'execution-witness',
    ...(raw['binding'] !== undefined ? { binding: raw['binding'] as ExecutionWitnessBinding } : {}),
    invariantId,
    scenarioId,
    status,
    sourceFiles: sourceFiles.map((item) => normalizePath(item)),
    ...(testFiles ? { testFiles: testFiles.map((item) => normalizePath(item)) } : {}),
    ...(typeof observedAt === 'string' ? { observedAt } : {})
  };
}
export function executionWitnessSelection(
  rootDir: string,
  invariant: InvariantSpec,
  scenario: InvariantSpec['scenarios'][number],
  files: string[]
): { configured: boolean; matched: boolean; witnessFiles: string[]; mode: InvariantEvidenceMode; modeReason: string } {
  const configuredPatterns = unique(scenario.executionWitnessPatterns ?? []);
  const patterns = configuredPatterns.length > 0 ? configuredPatterns : DEFAULT_EXECUTION_WITNESS_PATTERNS;
  const usingDefaultDiscovery = configuredPatterns.length === 0;
  const candidateFiles = listFiles(rootDir, { include: /\.json$/, excludeDirs: ['node_modules', 'dist', '.git'] })
    .filter((filePath) => !filePath.endsWith('.receipt.json'))
    .filter((filePath) => patterns.some((pattern) => matchPattern(pattern, filePath)));

  if (candidateFiles.length === 0) {
    return {
      configured: !usingDefaultDiscovery,
      matched: false,
      witnessFiles: [],
      mode: 'missing',
      modeReason: usingDefaultDiscovery
        ? `no default execution witness artifacts discovered (${DEFAULT_EXECUTION_WITNESS_PATTERNS.join(', ')})`
        : `executionWitnessPatterns matched no witness files (${patterns.join(', ')})`
    };
  }

  const candidateRecords = candidateFiles.flatMap((filePath) => {
    try {
      return [{ filePath, record: parseExecutionWitnessRecord(rootDir, filePath) }];
    } catch (error) {
      if (usingDefaultDiscovery) {
        return [];
      }
      throw error;
    }
  });
  const relevantRecords = candidateRecords.filter(({ record }) => record.invariantId === invariant.id && record.scenarioId === scenario.id);
  if (usingDefaultDiscovery && relevantRecords.length === 0) {
    return {
      configured: false,
      matched: false,
      witnessFiles: [],
      mode: 'missing',
      modeReason: `no default execution witness artifacts discovered for ${invariant.id}:${scenario.id}`
    };
  }

  const rejected: string[] = [];
  const currentRecords = relevantRecords.filter(({ filePath, record }) => {
    const scopeMatches = record.status === 'fail'
      ? files.some(file => record.sourceFiles.includes(file))
      : files.every(file => record.sourceFiles.includes(file));
    if (!scopeMatches) {
      rejected.push(`${filePath}: source scope mismatch`);
      return false;
    }
    const issue = executionWitnessBindingIssue(rootDir, record);
    if (issue) {
      rejected.push(`${filePath}: ${issue}`);
      return false;
    }
    return true;
  });
  // A current failure for this invariant/scenario/scope vetoes all current passes,
  // including those produced by different commands. Time never selects a winner.
  const contradicted = currentRecords.some(({ record }) => record.status === 'fail');
  const witnessFiles = contradicted ? [] : currentRecords
    .filter(({ record }) => record.status === 'pass')
    .filter(({ filePath, record }) => {
      const binding = record.binding;
      if (scenario.executionWitnessCommand && JSON.stringify(binding?.command) !== JSON.stringify(scenario.executionWitnessCommand)
        || scenario.executionWitnessTestFiles?.some(file => !record.testFiles?.includes(normalizePath(file)))
        || scenario.executionWitnessTimeoutMs !== undefined && binding?.timeoutMs !== scenario.executionWitnessTimeoutMs) {
        rejected.push(`${filePath}: configured execution context mismatch`);
        return false;
      }
      return true;
    })
    .map(({ filePath }) => filePath)
    .sort();

  return {
    configured: true,
    matched: witnessFiles.length > 0,
    witnessFiles,
    mode: witnessFiles.length > 0 ? 'explicit' : 'missing',
    modeReason: witnessFiles.length > 0
      ? 'content-bound execution witness artifacts matched invariant/scenario, current digests, execution context and impacted source scope'
      : contradicted
        ? 'current failing execution witness contradicts passing support; rerun after repairing the failure and retire obsolete contradictory records explicitly'
        : `no current bound passing execution witness: ${rejected.sort().join('; ') || 'no matching pass'}`
  };
}
function selectorMatchesInvariant(selector: string, filePath: string, symbols: ComplexityEvidence[]): boolean {
  if (selector.startsWith('path:')) {
    return matchPattern(selector.slice(5), filePath);
  }
  if (selector.startsWith('symbol:')) {
    const symbolFragment = selector.slice(7);
    return symbols.some((symbol) => symbol.filePath === filePath && symbol.symbol.includes(symbolFragment));
  }
  if (selector.startsWith('domain:')) {
    const fragment = selector.slice(7);
    return filePath.includes(`/${fragment}/`) || filePath.startsWith(`${fragment}/`) || filePath.includes(fragment);
  }
  return matchPattern(selector, filePath);
}
export function impactedFiles(invariant: InvariantSpec, changedFiles: string[], changedRegions: ChangedRegion[], complexity: ComplexityEvidence[]): string[] {
  const output = new Set<string>();
  for (const filePath of changedFiles.map((item) => normalizePath(item))) {
    if (invariant.selectors.some((selector) => selectorMatchesInvariant(selector, filePath, complexity))) {
      output.add(filePath);
    }
  }
  for (const region of changedRegions) {
    const filePath = normalizePath(region.filePath);
    if (invariant.selectors.some((selector) => selectorMatchesInvariant(selector, filePath, complexity))) {
      output.add(filePath);
    }
  }
  return [...output].sort();
}
export function collectExecutionWitnessPlanSummary(options: Pick<InvariantEvaluationOptions, 'invariants' | 'changedFiles' | 'changedRegions' | 'complexity'>): ExecutionWitnessPlanSummary {
  const autoRun: ExecutionWitnessGenerationPlan[] = [];
  const skipped: ExecutionWitnessSkippedPlan[] = [];
  for (const invariant of options.invariants) {
    const files = impactedFiles(invariant, options.changedFiles, options.changedRegions, options.complexity);
    for (const scenario of invariant.scenarios) {
      if (!scenario.executionWitnessCommand || scenario.executionWitnessCommand.length === 0 || !scenario.executionWitnessOutput) {
        continue;
      }
      if (files.length === 0) {
        skipped.push({
          invariantId: invariant.id,
          scenarioId: scenario.id,
          outputPath: scenario.executionWitnessOutput,
          command: [...scenario.executionWitnessCommand],
          testFiles: [...(scenario.executionWitnessTestFiles ?? [])],
          reason: 'invariant-not-impacted'
        });
        continue;
      }
      autoRun.push({
        invariantId: invariant.id,
        scenarioId: scenario.id,
        sourceFiles: [...files],
        testFiles: [...(scenario.executionWitnessTestFiles ?? [])],
        outputPath: scenario.executionWitnessOutput,
        command: [...scenario.executionWitnessCommand],
        ...(typeof scenario.executionWitnessTimeoutMs === 'number' ? { timeoutMs: scenario.executionWitnessTimeoutMs } : {})
      });
    }
  }
  return { autoRun, skipped };
}
export function collectExecutionWitnessPlans(options: Pick<InvariantEvaluationOptions, 'invariants' | 'changedFiles' | 'changedRegions' | 'complexity'>): ExecutionWitnessGenerationPlan[] {
  return collectExecutionWitnessPlanSummary(options).autoRun;
}
