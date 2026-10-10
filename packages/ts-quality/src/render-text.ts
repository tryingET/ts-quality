import {
  type AnalysisWarning,
  type CoverageGenerationRecord,
  type NextEvidenceAction,
  type RunArtifact,
  stableStringify
} from '../../evidence-model/src/index';
import { findFirstRiskyInvariantClaim, renderConciseInvariantProvenance } from '../../policy-engine/src/index';
import { generateGovernancePlan } from '../../governance/src/index';
import { renderExecutionWitnessSummaryText } from './witness-commands';

/** Text and Markdown renderers for check summaries, evidence-closure prompts, plans and governance artifacts. */

export function renderInvariantProvenanceBlock(
  run: Pick<RunArtifact, 'behaviorClaims'>,
  options?: { linePrefix?: string; includeObligation?: boolean }
): string[] {
  const riskyInvariant = findFirstRiskyInvariantClaim(run);
  if (!riskyInvariant) {
    return [];
  }
  const linePrefix = options?.linePrefix ?? '';
  const witnessPressureNote = renderExecutionWitnessPressureNote(riskyInvariant, linePrefix);
  const lines = [
    `${linePrefix}Invariant evidence at risk: ${riskyInvariant.invariantId}`,
    ...renderConciseInvariantProvenance(riskyInvariant, { linePrefix }),
    ...(witnessPressureNote ? [witnessPressureNote] : [])
  ];
  if (options?.includeObligation !== false && riskyInvariant.obligations.length > 0) {
    lines.push(`${linePrefix}Obligation: ${riskyInvariant.obligations[0]?.description}`);
  }
  return lines;
}
function renderExecutionWitnessPressureNote(claim: RunArtifact['behaviorClaims'][number], linePrefix = ''): string | undefined {
  const summary = claim.evidenceSummary;
  if (!summary || summary.evidenceSemantics !== 'execution-backed') {
    return undefined;
  }
  const remainingPressure = summary.subSignals
    .filter((item) => !['focused-test-alignment', 'execution-witness', 'scenario-support'].includes(item.signalId))
    .filter((item) => item.level === 'warning' || item.level === 'missing' || item.mode === 'missing')
    .map((item) => item.signalId);
  if (remainingPressure.length === 0) {
    return undefined;
  }
  return `${linePrefix}Execution witness is present; remaining risk comes from ${remainingPressure.join(', ')}.`;
}
function renderAnalysisWarningsText(warnings: AnalysisWarning[] | undefined): string[] {
  if (!warnings || warnings.length === 0) {
    return [];
  }
  return warnings.flatMap((warning) => [
    `Analysis warning: ${warning.message}`,
    ...(warning.hint ? [`Hint: ${warning.hint}`] : []),
    ...warning.evidence.map((item) => `Evidence: ${item}`)
  ]);
}
export function renderCheckSummaryText(run: Pick<RunArtifact, 'behaviorClaims' | 'verdict' | 'executionWitnesses' | 'coverageGeneration' | 'analysisWarnings' | 'nextEvidenceAction'>): string {
  const lines = [
    `Merge confidence: ${run.verdict.mergeConfidence}/100`,
    `Outcome: ${run.verdict.outcome}`,
    `Best next action: ${run.verdict.bestNextAction ?? 'none'}`
  ];
  if (run.nextEvidenceAction) {
    lines.push(`Evidence closure: ${run.nextEvidenceAction.primaryAction.title}`);
    lines.push(`Evidence closure kind: ${run.nextEvidenceAction.primaryAction.kind}`);
    if (typeof run.nextEvidenceAction.primaryAction.expectedConfidenceLift === 'number') {
      lines.push(`Expected confidence lift: +${run.nextEvidenceAction.primaryAction.expectedConfidenceLift}`);
    }
    if (run.nextEvidenceAction.primaryAction.suggestedEditFiles.length > 0) {
      lines.push(`Suggested edit files: ${run.nextEvidenceAction.primaryAction.suggestedEditFiles.join(', ')}`);
    }
    const basis = run.nextEvidenceAction.evidenceBasis;
    lines.push(`Coverage basis: ${basis.coverage.fileCount} file(s)${typeof basis.coverage.changedFunctionMinPct === 'number' ? `, changed-function min ${basis.coverage.changedFunctionMinPct}%` : typeof basis.coverage.minPct === 'number' ? `, min ${basis.coverage.minPct}%` : ''}, changed functions under80 ${basis.coverage.changedFunctionsUnder80}`);
    lines.push(`Mutation basis: ${basis.mutation.killed} killed / ${basis.mutation.sites} site(s), ${basis.mutation.survived} survived, ${basis.mutation.errors} error(s)`);
  }
  if (run.verdict.confidenceBreakdown) {
    lines.push('', `Confidence breakdown: base ${run.verdict.confidenceBreakdown.base}`);
    lines.push(...run.verdict.confidenceBreakdown.penalties.map((item) => `-${item.amount} ${item.label}`));
    lines.push(...run.verdict.confidenceBreakdown.credits.map((item) => `+${item.amount} ${item.label}`));
    lines.push(`final ${run.verdict.confidenceBreakdown.final}`);
  }
  if (run.coverageGeneration) {
    lines.push('', `Coverage generation: ${run.coverageGeneration.receipt.status} -> ${run.coverageGeneration.lcovPath}`);
  }
  const analysisWarnings = renderAnalysisWarningsText(run.analysisWarnings);
  if (analysisWarnings.length > 0) {
    lines.push('', ...analysisWarnings);
  }
  if (run.executionWitnesses) {
    lines.push('', ...renderExecutionWitnessSummaryText(run.executionWitnesses).trimEnd().split('\n'));
  }
  const provenance = renderInvariantProvenanceBlock(run, { includeObligation: false });
  if (provenance.length > 0) {
    lines.push('', ...provenance);
  }
  return `${lines.join('\n')}\n`;
}
export function renderCoverageGenerationText(record: CoverageGenerationRecord): string {
  return [
    `command: ${record.command.join(' ')}`,
    `lcovPath: ${record.lcovPath}`,
    `status: ${record.receipt.status}`,
    `durationMs: ${record.receipt.durationMs}`,
    `exitCode: ${record.receipt.exitCode ?? 'none'}`,
    `details: ${record.receipt.details ?? 'none'}`
  ].join('\n') + '\n';
}
export function renderNextEvidenceActionText(action: NextEvidenceAction): string {
  const lines = [
    `primaryAction: ${action.primaryAction.id}`,
    `primaryActionKind: ${action.primaryAction.kind}`,
    `primaryActionTitle: ${action.primaryAction.title}`,
    ...(action.primaryAction.sidecarSufficiency ? [`sidecarSufficiency: ${action.primaryAction.sidecarSufficiency.level}`, ...action.primaryAction.sidecarSufficiency.reasons.map((reason) => `sidecarSufficiencyReason: ${reason}`)] : []),
    `primaryActionRationale: ${action.primaryAction.rationale}`,
    ...(typeof action.primaryAction.expectedConfidenceLift === 'number' ? [`expectedConfidenceLift: ${action.primaryAction.expectedConfidenceLift}`] : []),
    `coverageBasis: status=${action.evidenceBasis.coverage.status} files=${action.evidenceBasis.coverage.fileCount}${typeof action.evidenceBasis.coverage.changedFunctionMinPct === 'number' ? ` changedFunctionMinPct=${action.evidenceBasis.coverage.changedFunctionMinPct}` : typeof action.evidenceBasis.coverage.minPct === 'number' ? ` minPct=${action.evidenceBasis.coverage.minPct}` : ''} changedFunctionsUnder80=${action.evidenceBasis.coverage.changedFunctionsUnder80}`,
    `witnessBasis: status=${action.evidenceBasis.witness.status} files=${action.evidenceBasis.witness.executionWitnessFiles.length}`,
    `mutationBasis: status=${action.evidenceBasis.mutation.status} killed=${action.evidenceBasis.mutation.killed} sites=${action.evidenceBasis.mutation.sites} survived=${action.evidenceBasis.mutation.survived} errors=${action.evidenceBasis.mutation.errors}`,
    `governanceBasis: status=${action.evidenceBasis.governance.status} errors=${action.evidenceBasis.governance.errors} warnings=${action.evidenceBasis.governance.warnings}`,
    `confidenceBasis: final=${action.evidenceBasis.confidence.final} penalties=${action.evidenceBasis.confidence.penalties.length} credits=${action.evidenceBasis.confidence.credits.length}`
  ];
  if (action.primaryAction.targetFiles.length > 0) {
    lines.push('targetFiles:', ...action.primaryAction.targetFiles.map((filePath) => `- ${filePath}`));
  }
  if (action.primaryAction.suggestedEditFiles.length > 0) {
    lines.push('suggestedEditFiles:', ...action.primaryAction.suggestedEditFiles.map((filePath) => `- ${filePath}`));
  }
  if (action.primaryAction.commands.length > 0) {
    lines.push('commands:', ...action.primaryAction.commands.map((item) => `- ${item.command.join(' ')} # ${item.reason}`));
  }
  if (action.primaryAction.groups.length > 0) {
    lines.push('groups:', ...action.primaryAction.groups.map((group) => `- ${group.id}: ${group.title}${typeof group.survivorCount === 'number' ? ` (${group.survivorCount} survivor(s))` : ''}`));
  }
  if (action.primaryAction.steps.length > 0) {
    lines.push('steps:');
    for (const step of action.primaryAction.steps) {
      lines.push(`- ${step.id}: ${step.title}`);
      lines.push(`  rationale: ${step.rationale}`);
      if (step.enclosingSymbol) {
        lines.push(`  enclosingSymbol: ${step.enclosingSymbol}`);
      }
      if (step.observableBehavior) {
        lines.push(`  observableBehavior: ${step.observableBehavior}`);
      }
      if (step.assertionStrategy) {
        lines.push(`  assertionStrategy: ${step.assertionStrategy}`);
      }
      if (step.maskingRisk) {
        lines.push(`  maskingRisk: ${step.maskingRisk}`);
      }
      if (step.suggestedEditFiles.length > 0) {
        lines.push(`  suggestedEditFiles: ${step.suggestedEditFiles.join(', ')}`);
      }
      if (step.commands.length > 0) {
        lines.push(...step.commands.map((item) => `  command: ${item.command.join(' ')} # ${item.reason}`));
      }
    }
  }
  lines.push('completionCriteria:', ...action.primaryAction.completionCriteria.map((item) => `- ${item}`));
  if (action.evidenceBasis.nonBlockingSignals.length > 0) {
    lines.push('notTheProblem:', ...action.evidenceBasis.nonBlockingSignals.map((item) => `- ${item}`));
  }
  lines.push('artifacts:', ...Object.entries(action.primaryAction.artifactPaths).map(([key, value]) => `- ${key}: ${value}`));
  return `${lines.join('\n')}\n`;
}
export function renderEvidenceClosurePromptMarkdown(action: NextEvidenceAction): string {
  const lines = [
    '---',
    'summary: "LLM-facing next evidence closure prompt for one ts-quality run."',
    'read_when:',
    '  - "When an agent needs to close the next evidence gap for this run"',
    '  - "When turning ts-quality evidence into a bounded repair task"',
    'type: "handoff"',
    '---',
    '',
    '# Next Evidence Closure',
    '',
    `Primary action: ${action.primaryAction.title}`,
    `Kind: ${action.primaryAction.kind}`,
    ...(action.primaryAction.sidecarSufficiency ? [
      `Sidecar sufficiency: ${action.primaryAction.sidecarSufficiency.level}`,
      ...action.primaryAction.sidecarSufficiency.reasons.map((reason) => `- sufficiency reason: ${reason}`)
    ] : []),
    `Why: ${action.primaryAction.rationale}`,
    ...(typeof action.primaryAction.expectedConfidenceLift === 'number' ? [`Expected confidence lift if closed: +${action.primaryAction.expectedConfidenceLift}`] : []),
    '',
    '## Evidence basis',
    `- Coverage: ${action.evidenceBasis.coverage.status}; files ${action.evidenceBasis.coverage.fileCount}${typeof action.evidenceBasis.coverage.changedFunctionMinPct === 'number' ? `; changed-function min ${action.evidenceBasis.coverage.changedFunctionMinPct}%` : ''}; changed functions under80 ${action.evidenceBasis.coverage.changedFunctionsUnder80}`,
    `- Mutation: ${action.evidenceBasis.mutation.killed}/${action.evidenceBasis.mutation.sites} killed; ${action.evidenceBasis.mutation.survived} survived; ${action.evidenceBasis.mutation.errors} errors`,
    `- Witness: ${action.evidenceBasis.witness.status}`,
    `- Governance: ${action.evidenceBasis.governance.status}; errors ${action.evidenceBasis.governance.errors}; warnings ${action.evidenceBasis.governance.warnings}`,
    `- Confidence: ${action.evidenceBasis.confidence.final}/100`,
    '',
    '## Edit targets',
    ...(action.primaryAction.suggestedEditFiles.length > 0 ? action.primaryAction.suggestedEditFiles.map((item) => `- ${item}`) : ['- none inferred; inspect target files below']),
    '',
    '## Evidence targets',
    ...(action.primaryAction.evidenceTargets.length > 0 ? action.primaryAction.evidenceTargets.map((item) => `- ${item}`) : ['- none']),
    '',
    '## Steps',
    ...(action.primaryAction.steps.length > 0
      ? action.primaryAction.steps.flatMap((step, index) => [
          `${index + 1}. ${step.title}`,
          `   - rationale: ${step.rationale}`,
          ...(step.enclosingSymbol ? [`   - affected symbol: ${step.enclosingSymbol}`] : []),
          ...(step.observableBehavior ? [`   - observable behavior delta: ${step.observableBehavior}`] : []),
          ...(step.assertionStrategy ? [`   - assertion strategy: ${step.assertionStrategy}`] : []),
          ...(step.maskingRisk ? [`   - masking / observability note: ${step.maskingRisk}`] : []),
          ...(step.suggestedEditFiles.length > 0 ? [`   - edit: ${step.suggestedEditFiles.join(', ')}`] : []),
          ...(step.commands.length > 0 ? step.commands.map((item) => `   - run: ${item.command.join(' ')}`) : [])
        ])
      : ['1. No required closure step remains.']),
    '',
    '## Completion criteria',
    ...action.primaryAction.completionCriteria.map((item) => `- ${item}`)
  ];
  if (action.evidenceBasis.nonBlockingSignals.length > 0) {
    lines.push('', '## Not the problem', ...action.evidenceBasis.nonBlockingSignals.map((item) => `- ${item}`));
  }
  return `${lines.join('\n')}\n`;
}
export function renderEvidenceClosureTaskManifest(action: NextEvidenceAction): string {
  return `${stableStringify(action.primaryAction.taskManifest)}\n`;
}
export function renderPlanText(run: RunArtifact, plan: ReturnType<typeof generateGovernancePlan>): string {
  const lines = [plan.summary];
  const provenance = renderInvariantProvenanceBlock(run);
  if (provenance.length > 0) {
    lines.push('', ...provenance);
  }
  if (plan.steps.length > 0) {
    lines.push('', ...plan.steps.map((step, index) => `${index + 1}. ${step.title}\n   ${step.rationale}\n   evidence: ${step.evidence.join('; ')}\n   tradeoffs: ${step.tradeoffs.join('; ')}`));
  }
  return `${lines.join('\n')}\n`;
}
export function renderPlanArtifactText(run: RunArtifact, plan: ReturnType<typeof generateGovernancePlan>): string {
  const lines = [plan.summary];
  const provenance = renderInvariantProvenanceBlock(run, { linePrefix: '- ' });
  if (provenance.length > 0) {
    lines.push('', ...provenance);
  }
  if (plan.steps.length > 0) {
    lines.push('', ...plan.steps.map((step, index) => `${index + 1}. [${step.type}] ${step.title}\n   rationale: ${step.rationale}\n   evidence: ${step.evidence.join('; ')}\n   tradeoffs: ${step.tradeoffs.join('; ')}`));
  }
  return `${lines.join('\n')}\n`;
}
export function renderGovernanceText(run: RunArtifact, plan: ReturnType<typeof generateGovernancePlan>): string {
  const lines = run.governance.map((item) => `${item.ruleId}: ${item.message}`);
  const provenance = renderInvariantProvenanceBlock(run, { linePrefix: '- ' });
  if (provenance.length > 0) {
    lines.push('', ...provenance);
  }
  lines.push('', plan.summary);
  return `${lines.join('\n')}\n`;
}
export function renderGovernanceArtifactText(run: RunArtifact, _plan: ReturnType<typeof generateGovernancePlan>): string {
  const lines = run.governance.flatMap((item) => [`${item.ruleId}: ${item.message}`, ...item.evidence.map((evidence) => `- ${evidence}`)]);
  const provenance = renderInvariantProvenanceBlock(run, { linePrefix: '- ' });
  if (provenance.length > 0) {
    lines.push('', ...provenance);
  }
  return `${lines.join('\n')}\n`;
}
