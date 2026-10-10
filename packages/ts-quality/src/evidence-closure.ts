import { findCoverageEvidence, type NextEvidenceAction, normalizePath, type RunArtifact } from '../../evidence-model/src/index';
import {
  assertionStrategyForMutation,
  enclosingSymbolForMutation,
  expectedConfidenceLiftFor,
  focusedTestsForFile,
  maskingRiskForMutation,
  mutationCommandFor,
  observableBehaviorForMutation,
  survivorGroupKey,
  uniqueStrings
} from './mutation-remediation';

/** The next evidence action: evidence basis, the protected primary action and its task manifest. */

function buildEvidenceClosureTaskManifest(input: {
  title: string;
  targetFiles: string[];
  suggestedEditFiles: string[];
  commands: NextEvidenceAction['primaryAction']['commands'];
  completionCriteria: string[];
  guidance?: string[] | undefined;
}): NextEvidenceAction['primaryAction']['taskManifest'] {
  const requiredPaths = uniqueStrings(input.suggestedEditFiles.length > 0 ? input.suggestedEditFiles : input.targetFiles);
  return {
    title: input.title,
    allowedPaths: uniqueStrings([...input.targetFiles, ...input.suggestedEditFiles]),
    requiredPaths,
    commands: input.commands,
    completionCriteria: input.completionCriteria,
    ...(input.guidance && input.guidance.length > 0 ? { guidance: uniqueStrings(input.guidance) } : {})
  };
}
function classifyEvidenceClosureSufficiency(action: NextEvidenceAction['primaryAction']): NonNullable<NextEvidenceAction['primaryAction']['sidecarSufficiency']> {
  if (action.kind === 'none') {
    return { level: 'turnkey', reasons: ['No blocking closure action remains.'] };
  }
  if (action.targetFiles.length === 0 && action.suggestedEditFiles.length === 0 && action.steps.length === 0 && action.kind !== 'mutation-baseline' && action.kind !== 'mutation-missing') {
    return { level: 'misleading', reasons: ['The sidecar selected a blocking action but did not identify target files, edit files, or steps.'] };
  }
  if (action.kind === 'mutation-survivors') {
    const hasFocusedEdit = action.suggestedEditFiles.length > 0;
    const hasRerunCommand = action.commands.length > 0 || action.steps.some((step) => step.commands.length > 0);
    const hasBehaviorGuidance = action.steps.length > 0 && action.steps.every((step) => Boolean(step.observableBehavior && step.assertionStrategy && step.maskingRisk));
    const reasons = [
      ...(hasFocusedEdit ? ['Likely focused test edit files are identified.'] : ['Focused test edit files are not inferred.']),
      ...(hasRerunCommand ? ['A focused rerun command is present.'] : ['No focused rerun command is present.']),
      ...(hasBehaviorGuidance ? ['Each survivor group includes observable-behavior, assertion-strategy, and masking-risk guidance.'] : ['At least one survivor group lacks full observable-behavior guidance.'])
    ];
    return { level: hasFocusedEdit && hasRerunCommand && hasBehaviorGuidance ? 'actionable' : 'bounded', reasons };
  }
  if (action.commands.length > 0 && action.completionCriteria.length > 0) {
    return { level: 'actionable', reasons: ['The sidecar includes a command and completion criteria for the selected closure action.'] };
  }
  return { level: 'bounded', reasons: ['The sidecar identifies the closure class and completion criteria, but still requires operator interpretation before execution.'] };
}
function attachEvidenceClosureSufficiency(action: NextEvidenceAction['primaryAction']): NextEvidenceAction['primaryAction'] {
  const sidecarSufficiency = classifyEvidenceClosureSufficiency(action);
  return {
    ...action,
    sidecarSufficiency,
    taskManifest: {
      ...action.taskManifest,
      sidecarSufficiency
    }
  };
}
/**
 * LCOV records for files inside the run's source scope. Some runners also report test files
 * (Node 20's built-in coverage does; Node 22+ excludes them by default), which are not coverage evidence.
 */
function sourceScopedCoverage(run: Pick<RunArtifact, 'coverage' | 'files'>): RunArtifact['coverage'] {
  if (run.files.length === 0) {
    return run.coverage;
  }
  // Same exact-or-unique-suffix matching coverage analysis uses, so absolute or prefixed SF paths still count.
  const matched = new Set(run.files.map((item) => findCoverageEvidence(item.filePath, run.coverage)).filter((item) => item !== undefined));
  return run.coverage.filter((item) => matched.has(item));
}
function buildEvidenceBasis(run: Pick<RunArtifact, 'coverage' | 'coverageGeneration' | 'files' | 'mutations' | 'governance' | 'verdict' | 'behaviorClaims'>): NextEvidenceAction['evidenceBasis'] {
  const scopedCoverage = sourceScopedCoverage(run);
  const coveragePct = scopedCoverage.map((item) => item.pct).filter((value) => Number.isFinite(value));
  const changedFunctionCoveragePct = run.behaviorClaims.flatMap((claim) => claim.evidenceSummary?.changedFunctions ?? []).map((item) => item.coveragePct).filter((value) => Number.isFinite(value));
  const changedFunctionsUnder80 = run.behaviorClaims.reduce((total, claim) => total + (claim.evidenceSummary?.changedFunctionsUnder80Coverage ?? 0), 0);
  const survived = run.mutations.filter((item) => item.status === 'survived').length;
  const killed = run.mutations.filter((item) => item.status === 'killed').length;
  const errors = run.mutations.filter((item) => item.status === 'error' || item.status === 'invalid').length;
  const executionWitnessFiles = uniqueStrings(run.behaviorClaims.flatMap((claim) => claim.evidenceSummary?.executionWitnessFiles ?? []));
  const governanceErrors = run.governance.filter((item) => item.level === 'error').length;
  const governanceWarnings = run.governance.filter((item) => item.level === 'warn').length;
  const nonBlockingSignals = [
    ...(scopedCoverage.length > 0 && changedFunctionsUnder80 === 0 ? [`coverage is present; changed functions under 80% coverage: ${changedFunctionsUnder80}`] : []),
    ...(executionWitnessFiles.length > 0 ? [`execution witness evidence is present (${executionWitnessFiles.length} file(s))`] : []),
    ...(governanceErrors === 0 ? ['governance has no blocking errors'] : []),
    ...(survived === 0 && errors === 0 && run.mutations.length > 0 ? ['mutation pressure has no survivors or execution errors'] : [])
  ];
  return {
    coverage: {
      status: scopedCoverage.length > 0 ? 'present' : (run.coverageGeneration ? `generation-${run.coverageGeneration.receipt.status}` : 'missing'),
      fileCount: scopedCoverage.length,
      ...(coveragePct.length > 0 ? { minPct: Math.min(...coveragePct) } : {}),
      ...(changedFunctionCoveragePct.length > 0 ? { changedFunctionMinPct: Math.min(...changedFunctionCoveragePct) } : {}),
      changedFunctionsUnder80,
      ...(run.coverageGeneration ? { lcovPath: run.coverageGeneration.lcovPath } : {})
    },
    mutation: {
      status: survived > 0 ? 'survivors' : errors > 0 ? 'errors' : run.mutations.length > 0 ? 'clear' : 'missing',
      sites: run.mutations.length,
      killed,
      survived,
      errors
    },
    witness: {
      status: executionWitnessFiles.length > 0 ? 'execution-backed' : 'missing-or-not-required',
      executionWitnessFiles
    },
    governance: {
      status: governanceErrors > 0 ? 'errors' : governanceWarnings > 0 ? 'warnings' : 'clear',
      errors: governanceErrors,
      warnings: governanceWarnings
    },
    confidence: {
      base: run.verdict.confidenceBreakdown?.base,
      penalties: run.verdict.confidenceBreakdown?.penalties ?? [],
      credits: run.verdict.confidenceBreakdown?.credits ?? [],
      final: run.verdict.mergeConfidence
    },
    nonBlockingSignals
  };
}
interface RunArtifactPaths {
  run: string;
  report: string;
  explain: string;
  govern: string;
  checkSummary: string;
  mutationRemediation: string;
  coverageGeneration: string;
  nextEvidenceActionPrompt: string;
  nextEvidenceActionTask: string;
}
function buildPrimaryEvidenceClosureAction(
  run: Pick<RunArtifact, 'runId' | 'coverage' | 'coverageGeneration' | 'files' | 'mutations' | 'governance' | 'verdict' | 'behaviorClaims' | 'symbols'>,
  remainingBlocker: string,
  artifactPaths: RunArtifactPaths
): NextEvidenceAction['primaryAction'] {
  const surviving = run.mutations.filter((item) => item.status === 'survived');
  if (surviving.length > 0) {
    const targetFiles = uniqueStrings(surviving.map((item) => normalizePath(item.filePath)));
    const suggestedEditFiles = uniqueStrings(targetFiles.flatMap((filePath) => focusedTestsForFile(run, filePath)));
    const commands = uniqueStrings(surviving.map((item) => JSON.stringify(mutationCommandFor(item))).filter((item) => item !== '[]'))
      .map((item) => JSON.parse(item) as string[])
      .map((command) => ({ command, reason: 'Rerun the focused test command after adding the missing assertion.' }));
    const completionCriteria = [
      'Add assertions that fail for each listed surviving mutation group.',
      'Rerun the focused test command and then ts-quality check for the same changed scope.',
      'The next run reports zero surviving mutants for this scope.'
    ];
    const grouped = new Map<string, RunArtifact['mutations']>();
    for (const survivor of surviving) {
      const key = survivorGroupKey(survivor);
      grouped.set(key, [...(grouped.get(key) ?? []), survivor]);
    }
    const groupEntries = [...grouped.entries()].slice(0, 8);
    const steps = groupEntries.map(([, group], index) => {
      const survivor = group[0];
      const survivorTargetFiles = uniqueStrings(group.map((item) => normalizePath(item.filePath)));
      const survivorEditFiles = uniqueStrings(survivorTargetFiles.flatMap((filePath) => focusedTestsForFile(run, filePath)));
      const title = `${survivor?.assertionHint ?? `Add an assertion around ${survivor?.filePath ?? 'unknown'}:${survivor?.span?.startLine ?? 'unknown'}.`}${group.length > 1 ? ` (covers ${group.length} equivalent survivors)` : ''}`;
      const enclosingSymbol = survivor ? enclosingSymbolForMutation(run.symbols, survivor) : undefined;
      const observableBehavior = survivor ? observableBehaviorForMutation(survivor) : undefined;
      const assertionStrategy = survivor ? assertionStrategyForMutation(survivor) : undefined;
      const maskingRisk = survivor ? maskingRiskForMutation(survivor) : undefined;
      return {
        id: `survivor-group-${index + 1}`,
        title,
        rationale: survivor?.original && survivor.replacement
          ? `This mutation group changed ${survivor.original} to ${survivor.replacement}; the focused test command still passed.`
          : 'The focused test command still passed after this mutation group.',
        targetFiles: survivorTargetFiles,
        suggestedEditFiles: survivorEditFiles,
        evidenceTargets: survivorTargetFiles,
        commands: survivor && mutationCommandFor(survivor).length > 0 ? [{ command: mutationCommandFor(survivor), reason: 'Verify the added assertion kills this survivor group.' }] : [],
        artifactPaths: { mutationRemediation: artifactPaths.mutationRemediation },
        ...(enclosingSymbol ? { enclosingSymbol } : {}),
        ...(observableBehavior ? { observableBehavior } : {}),
        ...(assertionStrategy ? { assertionStrategy } : {}),
        ...(maskingRisk ? { maskingRisk } : {})
      };
    });
    const groups = steps.map((step, index) => ({
      id: `mutation-group-${index + 1}`,
      title: step.title,
      survivorCount: groupEntries[index]?.[1].length ?? 1,
      targetFiles: step.targetFiles,
      suggestedEditFiles: step.suggestedEditFiles,
      evidenceTargets: step.evidenceTargets,
      stepIds: [step.id]
    }));
    const title = `Tighten focused assertions for ${surviving.length} surviving mutant(s) across ${groupEntries.length} mutation group(s).`;
    const taskGuidance = uniqueStrings(steps.flatMap((step) => [
      ...(step.enclosingSymbol ? [`Affected symbol: ${step.enclosingSymbol}`] : []),
      ...(step.observableBehavior ? [step.observableBehavior] : []),
      ...(step.assertionStrategy ? [step.assertionStrategy] : []),
      ...(step.maskingRisk ? [step.maskingRisk] : [])
    ]));
    return {
      id: 'close-mutation-survivors',
      kind: 'mutation-survivors',
      title,
      rationale: 'Surviving mutants mean existing tests executed but did not distinguish changed behavior from a mutated implementation.',
      expectedConfidenceLift: expectedConfidenceLiftFor(run, 'mutation-survivors'),
      targetFiles,
      suggestedEditFiles,
      evidenceTargets: targetFiles,
      commands,
      artifactPaths: {
        mutationRemediation: artifactPaths.mutationRemediation,
        prompt: artifactPaths.nextEvidenceActionPrompt,
        taskManifest: artifactPaths.nextEvidenceActionTask,
        report: artifactPaths.report,
        explain: artifactPaths.explain
      },
      completionCriteria,
      steps,
      groups,
      taskManifest: buildEvidenceClosureTaskManifest({ title, targetFiles, suggestedEditFiles, commands, completionCriteria, guidance: taskGuidance })
    };
  }

  if (remainingBlocker === 'mutation-baseline') {
    const title = 'Fix the baseline test command before trusting mutation evidence.';
    const completionCriteria = ['Make the configured mutation test command pass without mutations.', 'Rerun ts-quality check.'];
    return {
      id: 'fix-mutation-baseline',
      kind: 'mutation-baseline',
      title,
      rationale: 'The configured test command did not pass before mutation execution, so mutation results are not trustworthy.',
      expectedConfidenceLift: expectedConfidenceLiftFor(run, 'mutation-baseline'),
      targetFiles: [],
      suggestedEditFiles: [],
      evidenceTargets: [],
      commands: [],
      artifactPaths: { prompt: artifactPaths.nextEvidenceActionPrompt, taskManifest: artifactPaths.nextEvidenceActionTask, run: artifactPaths.run, explain: artifactPaths.explain },
      completionCriteria,
      steps: [],
      groups: [],
      taskManifest: buildEvidenceClosureTaskManifest({ title, targetFiles: [], suggestedEditFiles: [], commands: [], completionCriteria })
    };
  }

  if (remainingBlocker === 'mutation-evidence-missing') {
    const title = 'Add executable tests or broaden measurable mutation scope.';
    const completionCriteria = ['Configure a focused test command that exercises changed code.', 'Rerun ts-quality check until killed or surviving mutants are measured.'];
    return {
      id: 'add-mutation-evidence',
      kind: 'mutation-missing',
      title,
      rationale: 'No killed or surviving mutants were measured, so the changed code lacks explicit mutation pressure.',
      expectedConfidenceLift: expectedConfidenceLiftFor(run, 'mutation-missing'),
      targetFiles: [],
      suggestedEditFiles: [],
      evidenceTargets: [],
      commands: [],
      artifactPaths: { prompt: artifactPaths.nextEvidenceActionPrompt, taskManifest: artifactPaths.nextEvidenceActionTask, run: artifactPaths.run, explain: artifactPaths.explain },
      completionCriteria,
      steps: [],
      groups: [],
      taskManifest: buildEvidenceClosureTaskManifest({ title, targetFiles: [], suggestedEditFiles: [], commands: [], completionCriteria })
    };
  }

  if (remainingBlocker === 'governance') {
    const governanceErrors = run.governance.filter((item) => item.level === 'error');
    const targetFiles = uniqueStrings(governanceErrors.flatMap((item) => item.scope));
    const title = `Resolve ${governanceErrors.length} governance error(s).`;
    const completionCriteria = ['Satisfy or explicitly waive the blocking governance finding.', 'Rerun ts-quality check and govern for the same run scope.'];
    const steps = governanceErrors.slice(0, 8).map((finding, index) => ({
      id: `governance-${index + 1}`,
      title: finding.message,
      rationale: finding.evidence.join('; ') || 'Governance rule emitted an error.',
      targetFiles: finding.scope,
      suggestedEditFiles: finding.scope,
      evidenceTargets: finding.scope,
      commands: [],
      artifactPaths: { govern: artifactPaths.govern }
    }));
    return {
      id: 'resolve-governance-errors',
      kind: 'governance',
      title,
      rationale: 'Governance controls blocked the run even if code evidence may be otherwise available.',
      expectedConfidenceLift: expectedConfidenceLiftFor(run, 'governance'),
      targetFiles,
      suggestedEditFiles: targetFiles,
      evidenceTargets: targetFiles,
      commands: [],
      artifactPaths: { prompt: artifactPaths.nextEvidenceActionPrompt, taskManifest: artifactPaths.nextEvidenceActionTask, govern: artifactPaths.govern, run: artifactPaths.run },
      completionCriteria,
      steps,
      groups: [],
      taskManifest: buildEvidenceClosureTaskManifest({ title, targetFiles, suggestedEditFiles: targetFiles, commands: [], completionCriteria })
    };
  }

  if (sourceScopedCoverage(run).length === 0 && (!run.coverageGeneration || run.coverageGeneration.receipt.status !== 'pass')) {
    const title = 'Create LCOV coverage evidence for the changed scope.';
    const commands = run.coverageGeneration?.command && run.coverageGeneration.command.length > 0 ? [{ command: run.coverageGeneration.command, reason: 'Generate the configured LCOV artifact.' }] : [];
    const completionCriteria = ['Create the configured LCOV file.', 'Rerun ts-quality check and confirm coverage evidence is present.'];
    return {
      id: 'create-coverage-evidence',
      kind: 'coverage',
      title,
      rationale: 'Coverage is missing, so changed-function pressure cannot be grounded in executed code.',
      expectedConfidenceLift: expectedConfidenceLiftFor(run, 'coverage'),
      targetFiles: [],
      suggestedEditFiles: [],
      evidenceTargets: [],
      commands,
      artifactPaths: { prompt: artifactPaths.nextEvidenceActionPrompt, taskManifest: artifactPaths.nextEvidenceActionTask, coverageGeneration: artifactPaths.coverageGeneration, run: artifactPaths.run },
      completionCriteria,
      steps: [],
      groups: [],
      taskManifest: buildEvidenceClosureTaskManifest({ title, targetFiles: [], suggestedEditFiles: [], commands, completionCriteria })
    };
  }

  const missingWitnessClaim = run.behaviorClaims.find((claim) => (claim.evidenceSummary?.executionWitnessFiles ?? []).length === 0 && claim.status !== 'supported');
  if (missingWitnessClaim) {
    const targetFiles = missingWitnessClaim.evidenceSummary?.impactedFiles ?? [];
    const suggestedEditFiles = missingWitnessClaim.evidenceSummary?.focusedTests ?? [];
    const title = `Add execution-backed witness evidence for ${missingWitnessClaim.invariantId}.`;
    const completionCriteria = ['Run ts-quality witness test for the missing scenario.', 'Rerun ts-quality check and confirm the witness file is consumed.'];
    return {
      id: 'add-execution-witness',
      kind: 'witness',
      title,
      rationale: 'The invariant still depends on weaker support than an execution witness for its scenario scope.',
      expectedConfidenceLift: expectedConfidenceLiftFor(run, 'witness'),
      targetFiles,
      suggestedEditFiles,
      evidenceTargets: targetFiles,
      commands: [],
      artifactPaths: { prompt: artifactPaths.nextEvidenceActionPrompt, taskManifest: artifactPaths.nextEvidenceActionTask, run: artifactPaths.run, explain: artifactPaths.explain },
      completionCriteria,
      steps: [],
      groups: [],
      taskManifest: buildEvidenceClosureTaskManifest({ title, targetFiles, suggestedEditFiles, commands: [], completionCriteria })
    };
  }

  const title = 'No blocking evidence action remains for this run.';
  const completionCriteria = ['No required closure action remains.'];
  return {
    id: 'no-blocking-evidence-action',
    kind: 'none',
    title,
    rationale: `The run outcome is ${run.verdict.outcome}; inspect artifacts for optional hardening only.`,
    targetFiles: [],
    suggestedEditFiles: [],
    evidenceTargets: [],
    commands: [],
    artifactPaths: { prompt: artifactPaths.nextEvidenceActionPrompt, taskManifest: artifactPaths.nextEvidenceActionTask, run: artifactPaths.run, report: artifactPaths.report, explain: artifactPaths.explain },
    completionCriteria,
    steps: [],
    groups: [],
    taskManifest: buildEvidenceClosureTaskManifest({ title, targetFiles: [], suggestedEditFiles: [], commands: [], completionCriteria })
  };
}
export function buildNextEvidenceAction(run: Pick<RunArtifact, 'runId' | 'coverage' | 'coverageGeneration' | 'executionWitnesses' | 'files' | 'mutations' | 'governance' | 'verdict' | 'behaviorClaims' | 'symbols'>): NextEvidenceAction {
  const remainingBlocker = run.verdict.findings.find((item) => item.code === 'surviving-mutant' || item.code === 'mutation-score-budget')
    ? 'mutation-pressure'
    : run.verdict.findings.find((item) => item.code === 'mutation-baseline')
      ? 'mutation-baseline'
      : run.verdict.findings.find((item) => item.code === 'mutation-evidence-missing')
        ? 'mutation-evidence-missing'
        : run.governance.some((item) => item.level === 'error')
          ? 'governance'
          : run.verdict.outcome;
  const artifactPaths: RunArtifactPaths = {
    run: `.ts-quality/runs/${run.runId}/run.json`,
    report: `.ts-quality/runs/${run.runId}/report.md`,
    explain: `.ts-quality/runs/${run.runId}/explain.txt`,
    govern: `.ts-quality/runs/${run.runId}/govern.txt`,
    checkSummary: `.ts-quality/runs/${run.runId}/check-summary.txt`,
    mutationRemediation: `.ts-quality/runs/${run.runId}/mutation-remediation.json`,
    coverageGeneration: `.ts-quality/runs/${run.runId}/coverage-generation.json`,
    nextEvidenceActionPrompt: `.ts-quality/runs/${run.runId}/next-evidence-action.prompt.md`,
    nextEvidenceActionTask: `.ts-quality/runs/${run.runId}/next-evidence-action.ak-task.json`
  };
  return {
    primaryAction: attachEvidenceClosureSufficiency(buildPrimaryEvidenceClosureAction(run, remainingBlocker, artifactPaths)),
    evidenceBasis: buildEvidenceBasis(run)
  };
}
