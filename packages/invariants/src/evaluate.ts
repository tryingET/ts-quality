import {
  type BehaviorClaim,
  type ChangedRegion,
  type ComplexityEvidence,
  type InvariantEvidenceSemantics,
  type InvariantEvidenceSubSignal,
  type InvariantEvidenceSummary,
  type InvariantScenarioResult,
  type InvariantSpec,
  type MutationResult,
  type MutationSite,
  normalizePath,
  spanOverlaps,
  type TestObligation
} from '../../evidence-model/src/index';
import {
  describeChangedFunction,
  explicitArtifactMode,
  pluralize,
  scenarioEvidenceGapMessage,
  scenarioSupportMode,
  scenarioSupportModeReason,
  summarizeScenarioSupport,
  withModeReason
} from './support-modes';
import { FocusedTestSelection, focusedTestDocuments, loadTestDocuments, scenarioSupportAcrossDocuments } from './test-documents';
import { executionWitnessSelection, impactedFiles } from './witness-plans';

/** evaluateInvariants: per-scenario evidence sub-signals and the invariant evidence summary. */

export interface InvariantEvaluationOptions {
  rootDir: string;
  invariants: InvariantSpec[];
  changedFiles: string[];
  changedRegions: ChangedRegion[];
  complexity: ComplexityEvidence[];
  mutationSites: MutationSite[];
  mutations: MutationResult[];
  testPatterns?: string[];
}
const INVARIANT_EVIDENCE_SEMANTICS: InvariantEvidenceSemantics = 'deterministic-lexical';
const INVARIANT_EVIDENCE_SEMANTICS_SUMMARY = 'deterministic lexical alignment over focused tests; not execution-backed behavioral proof';
const EXECUTION_BACKED_EVIDENCE_SEMANTICS_SUMMARY = 'execution-backed witness artifacts matched the invariant scenario scope';
function baselineInvariantStatus(evidenceSemantics: InvariantEvidenceSemantics): BehaviorClaim['status'] {
  return evidenceSemantics === 'execution-backed' ? 'supported' : 'lexically-supported';
}
function buildSubSignals(options: {
  files: string[];
  focusedTestSelection: FocusedTestSelection;
  executionWitnessConfigured: boolean;
  executionWitnessMatched: boolean;
  executionWitnessFiles: string[];
  changedFunctions: Array<{ filePath: string; symbol: string; coveragePct: number; crap: number }>;
  lowCoverageChanged: Array<{ filePath: string; symbol: string; coveragePct: number; crap: number }>;
  mutationSitesInScope: number;
  killedMutantsInScope: number;
  survivingMutantsInScope: number;
  scenarioResults: InvariantScenarioResult[];
}): InvariantEvidenceSubSignal[] {
  const focusedTestFiles = options.focusedTestSelection.documents.map((document) => document.filePath);
  const scenarioSupportedCount = options.scenarioResults.filter((item) => item.supported).length;
  const allScenarioSupportExecutionBacked = options.scenarioResults.length > 0 && options.scenarioResults.every((item) => item.supported && item.supportKind === 'execution-witness');
  const scenarioMode = scenarioSupportMode(options.scenarioResults, options.focusedTestSelection);
  const scenarioModeReason = scenarioSupportModeReason(options.scenarioResults, options.focusedTestSelection);
  const coverageMode = explicitArtifactMode(options.changedFunctions.length > 0, {
    explicitReason: 'coverage evidence came from LCOV for changed functions in invariant scope',
    missingReason: 'no changed functions were mapped into invariant scope for coverage evaluation'
  });
  const mutationMode = explicitArtifactMode(options.mutationSitesInScope > 0, {
    explicitReason: 'mutation evidence came from selected mutation sites in invariant scope',
    missingReason: 'no mutation sites were selected in invariant scope'
  });
  const changedFunctionMode = explicitArtifactMode(options.changedFunctions.length > 0, {
    explicitReason: 'changed-function evidence came from CRAP/changed-function mapping in invariant scope',
    missingReason: 'no changed functions were mapped into invariant scope'
  });
  const changedFunctionsSummary = options.changedFunctions.length > 0
    ? options.changedFunctions.map((item) => describeChangedFunction(item))
    : ['none'];

  const signals: InvariantEvidenceSubSignal[] = [{
    signalId: 'focused-test-alignment',
    label: 'Focused test alignment',
    level: focusedTestFiles.length > 0 ? 'clear' : 'missing',
    mode: options.focusedTestSelection.mode,
    modeReason: options.focusedTestSelection.modeReason,
    summary: focusedTestFiles.length > 0
      ? `${pluralize(focusedTestFiles.length, 'focused test file')} aligned to invariant scope`
      : 'No focused test files aligned to invariant scope',
    facts: withModeReason(options.focusedTestSelection.modeReason, [
      `impacted files: ${options.files.join(', ') || 'none'}`,
      `focused tests: ${focusedTestFiles.join(', ') || 'none'}`
    ])
  }];

  if (options.executionWitnessConfigured) {
    signals.push({
      signalId: 'execution-witness',
      label: 'Execution witness',
      level: options.executionWitnessMatched ? 'clear' : 'missing',
      mode: options.executionWitnessMatched ? 'explicit' : 'missing',
      modeReason: options.executionWitnessMatched
        ? 'execution witness artifacts matched invariant id, scenario id, pass status, and impacted source scope'
        : 'execution witness artifacts did not match invariant id, scenario id, pass status, and impacted source scope',
      summary: options.executionWitnessMatched
        ? `${pluralize(options.executionWitnessFiles.length, 'execution witness file')} matched invariant scenario scope`
        : 'No execution witness artifacts matched invariant scenario scope',
      facts: withModeReason(options.executionWitnessMatched
        ? 'execution witness artifacts matched invariant id, scenario id, pass status, and impacted source scope'
        : 'execution witness artifacts did not match invariant id, scenario id, pass status, and impacted source scope', [
        `impacted files: ${options.files.join(', ') || 'none'}`,
        `execution witness files: ${options.executionWitnessFiles.join(', ') || 'none'}`
      ])
    });
  }

  signals.push({
    signalId: 'scenario-support',
    label: 'Scenario support',
    level: options.scenarioResults.length === 0
      ? 'info'
      : scenarioSupportedCount === options.scenarioResults.length
        ? 'clear'
        : scenarioSupportedCount === 0
          ? 'missing'
          : 'warning',
    mode: scenarioMode,
    modeReason: scenarioModeReason,
    summary: options.scenarioResults.length === 0
      ? 'Invariant declares no scenarios'
      : allScenarioSupportExecutionBacked
        ? `${scenarioSupportedCount}/${options.scenarioResults.length} scenario(s) have execution-backed support`
        : `${scenarioSupportedCount}/${options.scenarioResults.length} scenario(s) have deterministic lexical support`,
    facts: withModeReason(scenarioModeReason, options.scenarioResults.length > 0
      ? options.scenarioResults.map((item) => summarizeScenarioSupport(item))
      : ['none'])
  });

  signals.push({
    signalId: 'coverage-pressure',
    label: 'Coverage pressure',
    level: options.changedFunctions.length === 0
      ? 'missing'
      : options.lowCoverageChanged.length > 0
        ? 'warning'
        : 'clear',
    mode: coverageMode.mode,
    modeReason: coverageMode.modeReason,
    summary: options.changedFunctions.length === 0
      ? 'No changed functions were available for coverage evaluation in invariant scope'
      : options.lowCoverageChanged.length > 0
        ? `${pluralize(options.lowCoverageChanged.length, 'changed function')} under 80% coverage`
        : 'All changed functions in invariant scope are at or above 80% coverage',
    facts: withModeReason(coverageMode.modeReason, options.changedFunctions.length === 0
      ? ['changed functions in scope: 0']
      : options.lowCoverageChanged.length > 0
        ? options.lowCoverageChanged.map((item) => describeChangedFunction(item))
        : ['changed functions under 80% coverage: 0'])
  });

  signals.push({
    signalId: 'mutation-pressure',
    label: 'Mutation pressure',
    level: options.mutationSitesInScope === 0
      ? 'info'
      : options.survivingMutantsInScope > 0
        ? 'warning'
        : 'clear',
    mode: mutationMode.mode,
    modeReason: mutationMode.modeReason,
    summary: options.mutationSitesInScope === 0
      ? 'No mutation sites were selected in invariant scope'
      : options.survivingMutantsInScope > 0
        ? `${pluralize(options.survivingMutantsInScope, 'surviving mutant')} across ${pluralize(options.mutationSitesInScope, 'mutation site')}`
        : `${pluralize(options.killedMutantsInScope, 'killed mutant')} across ${pluralize(options.mutationSitesInScope, 'mutation site')} with no survivors`,
    facts: withModeReason(mutationMode.modeReason, [
      `mutation sites in scope: ${options.mutationSitesInScope}`,
      `killed mutants in scope: ${options.killedMutantsInScope}`,
      `surviving mutants in scope: ${options.survivingMutantsInScope}`
    ])
  });

  signals.push({
    signalId: 'changed-function-pressure',
    label: 'Changed function pressure',
    level: options.changedFunctions.length > 0 ? 'info' : 'missing',
    mode: changedFunctionMode.mode,
    modeReason: changedFunctionMode.modeReason,
    summary: options.changedFunctions.length > 0
      ? `${pluralize(options.changedFunctions.length, 'changed function')} in invariant scope; max changed CRAP ${options.changedFunctions.reduce((max, item) => Math.max(max, item.crap), 0)}`
      : 'No changed functions were mapped into invariant scope',
    facts: withModeReason(changedFunctionMode.modeReason, changedFunctionsSummary)
  });

  return signals;
}
export function evaluateInvariants(options: InvariantEvaluationOptions): BehaviorClaim[] {
  const testDocuments = loadTestDocuments(options.rootDir, options.testPatterns ?? ['test/**/*.js', 'test/**/*.mjs', 'test/**/*.cjs', 'test/**/*.ts', '**/*.test.js', '**/*.test.mjs', '**/*.test.cjs', '**/*.spec.ts']);
  const results: BehaviorClaim[] = [];
  const changedByFile = new Set(options.changedFiles.map((item) => normalizePath(item)));

  for (const invariant of options.invariants) {
    const files = impactedFiles(invariant, options.changedFiles, options.changedRegions, options.complexity);
    if (files.length === 0) {
      continue;
    }

    const obligations: TestObligation[] = [];
    const evidence: string[] = [];
    let status: BehaviorClaim['status'] = baselineInvariantStatus(INVARIANT_EVIDENCE_SEMANTICS);

    const fileMutations = options.mutationSites.filter((site) => files.includes(site.filePath));
    const mutationResults = options.mutations.filter((result) => files.includes(result.filePath));
    const survivingMutants = mutationResults.filter((result) => result.status === 'survived');
    const killedMutants = mutationResults.filter((result) => result.status === 'killed');
    const changedFunctions = options.complexity
      .filter((item) => files.includes(item.filePath) && item.changed)
      .map((item) => ({
        filePath: item.filePath,
        symbol: item.symbol,
        coveragePct: item.coveragePct,
        crap: item.crap
      }))
      .sort((left, right) => left.filePath.localeCompare(right.filePath) || left.symbol.localeCompare(right.symbol));
    const lowCoverageChanged = changedFunctions.filter((item) => item.coveragePct < 80);
    const maxChangedCrap = changedFunctions.reduce((max, item) => Math.max(max, item.crap), 0);
    const focusedTestSelection = focusedTestDocuments(options.rootDir, testDocuments, invariant, files);
    const focusedTests = focusedTestSelection.documents;
    const scenarioResults: InvariantScenarioResult[] = [];
    const executionWitnessFiles = new Set<string>();
    let executionWitnessConfigured = false;
    let executionWitnessSupportedScenarioCount = 0;

    if (survivingMutants.length > 0) {
      status = 'at-risk';
      evidence.push(`${survivingMutants.length} surviving mutants in impacted invariant scope`);
    }
    if (lowCoverageChanged.length > 0) {
      status = status === 'at-risk' ? 'at-risk' : 'unsupported';
      evidence.push(`${lowCoverageChanged.length} changed functions under 80% coverage in invariant scope`);
    }

    for (const scenario of invariant.scenarios) {
      const lexicalSupport = focusedTests.length > 0
        ? scenarioSupportAcrossDocuments(focusedTests, scenario)
        : { keywordsMatched: false, failurePathKeywordsMatched: scenario.failurePathKeywords ? false : true, assertionMatched: false, supported: false };
      const executionWitness = executionWitnessSelection(options.rootDir, invariant, scenario, files);
      if (executionWitness.configured && !executionWitness.matched) {
        evidence.push(`Execution witness ${scenario.id}: ${executionWitness.modeReason}`);
      }
      if (executionWitness.configured) {
        executionWitnessConfigured = true;
      }
      for (const witnessFile of executionWitness.witnessFiles) {
        executionWitnessFiles.add(witnessFile);
      }
      const supported = executionWitness.matched || lexicalSupport.supported;
      const supportKind: InvariantScenarioResult['supportKind'] = executionWitness.matched
        ? 'execution-witness'
        : lexicalSupport.supported
          ? 'deterministic-lexical'
          : 'missing';
      if (executionWitness.matched) {
        executionWitnessSupportedScenarioCount += 1;
      }
      scenarioResults.push({
        scenarioId: scenario.id,
        description: scenario.description,
        expected: scenario.expected,
        keywordsMatched: lexicalSupport.keywordsMatched,
        failurePathKeywordsMatched: lexicalSupport.failurePathKeywordsMatched,
        assertionMatched: lexicalSupport.assertionMatched,
        supported,
        ...(lexicalSupport.supportGap ? { supportGap: lexicalSupport.supportGap } : {}),
        supportKind
      });
      if (!supported) {
        obligations.push({
          id: `${invariant.id}:${scenario.id}`,
          invariantId: invariant.id,
          priority: invariant.severity === 'critical' || invariant.severity === 'high' ? 'high' : 'medium',
          description: `Add execution-backed witness artifacts or tighten an assertion-bearing focused test case for scenario '${scenario.description}' to preserve invariant '${invariant.title}'.`,
          scenarioId: scenario.id,
          fileHints: files
        });
        evidence.push(scenarioEvidenceGapMessage(scenario.description, lexicalSupport, executionWitness.configured));
        status = status === 'at-risk' ? 'at-risk' : 'unsupported';
      }
    }

    if (focusedTests.length === 0 && executionWitnessSupportedScenarioCount === 0) {
      status = status === 'at-risk' ? 'at-risk' : 'unsupported';
      evidence.push(invariant.requiredTestPatterns && invariant.requiredTestPatterns.length > 0
        ? `requiredTestPatterns matched no focused test files for ${files.join(', ')}; review the configured patterns.`
        : `No focused test files matched invariant scope for ${files.join(', ')}; align test names/imports or set requiredTestPatterns.`);
    }

    for (const region of options.changedRegions.filter((region) => files.includes(normalizePath(region.filePath)))) {
      const regionMutations = fileMutations.filter((site) => {
        if (site.filePath !== normalizePath(region.filePath)) {
          return false;
        }
        for (let line = region.span.startLine; line <= region.span.endLine; line += 1) {
          if (spanOverlaps(line, site.span)) {
            return true;
          }
        }
        return false;
      });
      if (regionMutations.length === 0 && changedByFile.has(normalizePath(region.filePath))) {
        evidence.push(`Changed region ${region.hunkId} in ${region.filePath} has no selected mutation sites; review test specificity manually.`);
      }
    }

    const evidenceSemantics: InvariantEvidenceSemantics = scenarioResults.length > 0 && scenarioResults.every((item) => item.supported && item.supportKind === 'execution-witness')
      ? 'execution-backed'
      : INVARIANT_EVIDENCE_SEMANTICS;
    const evidenceSemanticsSummary = evidenceSemantics === 'execution-backed'
      ? EXECUTION_BACKED_EVIDENCE_SEMANTICS_SUMMARY
      : INVARIANT_EVIDENCE_SEMANTICS_SUMMARY;
    if (status === 'lexically-supported' && evidenceSemantics === 'execution-backed') {
      status = 'supported';
    }

    const evidenceSummary: InvariantEvidenceSummary = {
      invariantId: invariant.id,
      evidenceSemantics,
      evidenceSemanticsSummary,
      impactedFiles: files,
      focusedTests: focusedTests.map((document) => document.filePath),
      ...(executionWitnessFiles.size > 0 ? { executionWitnessFiles: [...executionWitnessFiles].sort() } : {}),
      changedFunctions,
      changedFunctionsUnder80Coverage: lowCoverageChanged.length,
      maxChangedCrap,
      mutationSitesInScope: fileMutations.length,
      killedMutantsInScope: killedMutants.length,
      survivingMutantsInScope: survivingMutants.length,
      scenarioResults,
      subSignals: buildSubSignals({
        files,
        focusedTestSelection,
        executionWitnessConfigured,
        executionWitnessMatched: executionWitnessSupportedScenarioCount === invariant.scenarios.length && executionWitnessSupportedScenarioCount > 0,
        executionWitnessFiles: [...executionWitnessFiles].sort(),
        changedFunctions,
        lowCoverageChanged,
        mutationSitesInScope: fileMutations.length,
        killedMutantsInScope: killedMutants.length,
        survivingMutantsInScope: survivingMutants.length,
        scenarioResults
      })
    };

    results.push({
      id: `${invariant.id}:claim`,
      invariantId: invariant.id,
      description: `${invariant.title} applies to ${files.join(', ')}`,
      status,
      evidence: evidence.length > 0
        ? evidence
        : executionWitnessFiles.size > 0
          ? [`Execution witness artifacts: ${([...executionWitnessFiles].sort()).join(', ')}`]
          : [`Focused tests with deterministic lexical alignment: ${focusedTests.map((document) => document.filePath).join(', ')}`],
      obligations,
      evidenceSummary
    });
  }

  return results;
}
