import {
  type BehaviorClaim,
  type ComplexityEvidence,
  type ExecutionReceipt,
  type GovernanceFinding,
  type MutationResult,
  type PolicyFinding,
  type TrendDelta,
  type RunArtifact,
  type Verdict,
  type Waiver,
  clamp,
  isFindingWaived,
  summarizeMutationScore
} from '../../evidence-model/src/index';

export interface PolicyConfig {
  maxChangedCrap: number;
  minMutationScore: number;
  minMergeConfidence: number;
}

export interface PolicyInput {
  nowIso: string;
  policy: PolicyConfig;
  changedComplexity: ComplexityEvidence[];
  mutations: MutationResult[];
  mutationBaseline?: ExecutionReceipt;
  behaviorClaims: BehaviorClaim[];
  governance: GovernanceFinding[];
  waivers: Waiver[];
  previousRun?: Pick<RunArtifact, 'runId' | 'verdict' | 'mutations' | 'complexity'>;
}

export function defaultPolicy(): PolicyConfig {
  return {
    maxChangedCrap: 30,
    minMutationScore: 0.8,
    minMergeConfidence: 70
  };
}

function finding(id: string, code: string, level: PolicyFinding['level'], message: string, scope: string[], evidence: string[], ruleId?: string): PolicyFinding {
  const result: PolicyFinding = { id, code, level, message, scope, evidence };
  if (ruleId) {
    result.ruleId = ruleId;
  }
  return result;
}

function isRiskyInvariantClaim(claim: BehaviorClaim): boolean {
  return claim.status === 'unsupported' || claim.status === 'at-risk';
}

function isLexicallySupportedInvariantClaim(claim: BehaviorClaim): boolean {
  return claim.status === 'lexically-supported';
}

export function evaluatePolicy(input: PolicyInput): { verdict: Verdict; trend?: TrendDelta } {
  let mergeConfidence = 100;
  const findings: PolicyFinding[] = [];
  const reasons: string[] = [];
  const warnings: string[] = [];
  const blockedBy: string[] = [];

  const maxChangedCrap = input.changedComplexity.reduce((max, item) => Math.max(max, item.crap), 0);
  const hotspot = input.changedComplexity.sort((left, right) => right.crap - left.crap)[0];
  if (maxChangedCrap > input.policy.maxChangedCrap) {
    const delta = Math.ceil((maxChangedCrap - input.policy.maxChangedCrap) * 1.2);
    mergeConfidence -= Math.min(delta, 25);
    findings.push(finding('policy:crap', 'changed-crap-budget', 'error', `Changed code exceeds CRAP budget ${input.policy.maxChangedCrap}`, hotspot ? [hotspot.filePath] : [], hotspot ? [`${hotspot.symbol} CRAP=${hotspot.crap}`] : []));
    reasons.push(`CRAP hotspot ${hotspot?.symbol ?? 'unknown'} is ${maxChangedCrap.toFixed(2)} in changed code.`);
  }

  const mutationSummary = summarizeMutationScore(input.mutations);
  if (!mutationSummary.measured) {
    mergeConfidence -= 25;
    findings.push(finding(
      'policy:mutation-missing',
      'mutation-evidence-missing',
      'error',
      'Mutation pressure is missing for the evaluated scope',
      input.changedComplexity.map((item) => item.filePath),
      ['No killed or surviving mutants were measured for the evaluated scope.']
    ));
    reasons.push('Mutation pressure is missing for the evaluated scope, so merge confidence cannot be trusted yet.');
  } else if (mutationSummary.score < input.policy.minMutationScore) {
    const penalty = Math.ceil((input.policy.minMutationScore - mutationSummary.score) * 40);
    mergeConfidence -= penalty;
    findings.push(finding('policy:mutation-score', 'mutation-score-budget', 'error', `Mutation score ${mutationSummary.score.toFixed(2)} is below budget ${input.policy.minMutationScore.toFixed(2)}`, input.mutations.map((item) => item.filePath), [`Killed ${mutationSummary.killed}, survived ${mutationSummary.survived}`]));
    reasons.push(`Mutation score is ${Math.round(mutationSummary.score * 100)}/100 with ${mutationSummary.survived} surviving mutants.`);
  }

  if (input.mutationBaseline && input.mutationBaseline.status !== 'pass') {
    mergeConfidence -= 30;
    findings.push(finding(
      'policy:mutation-baseline',
      'mutation-baseline',
      'error',
      'Mutation baseline test command did not pass',
      input.changedComplexity.map((item) => item.filePath),
      [
        `status=${input.mutationBaseline.status}`,
        `exitCode=${input.mutationBaseline.exitCode ?? 'none'}`,
        input.mutationBaseline.details || 'no output'
      ]
    ));
    reasons.push('Mutation baseline test command failed before mutant execution, so mutation evidence is not trustworthy yet.');
  }

  const erroredMutations = input.mutations.filter((result) => result.status === 'error' || result.status === 'invalid');
  if (erroredMutations.length > 0) {
    mergeConfidence -= Math.min(8 * erroredMutations.length, 20);
    for (const mutation of erroredMutations) {
      findings.push(finding(`policy:mutation-error:${mutation.siteId}`, 'mutation-execution', 'error', `Mutation execution failed for ${mutation.filePath}`, [mutation.filePath], [mutation.details ?? mutation.siteId]));
    }
    reasons.push(`${erroredMutations.length} mutation site(s) could not be trusted due to invalid or errored execution.`);
  }

  const survivingMutants = input.mutations.filter((result) => result.status === 'survived');
  if (survivingMutants.length > 0) {
    mergeConfidence -= Math.min(12 * survivingMutants.length, 24);
    for (const mutant of survivingMutants) {
      findings.push(finding(`policy:surviving:${mutant.siteId}`, 'surviving-mutant', 'error', `Surviving mutant in ${mutant.filePath}`, [mutant.filePath], [mutant.details ?? mutant.siteId]));
    }
    reasons.push(`${survivingMutants.length} surviving mutant(s) remain in changed or covered logic.`);
  }

  const lexicallySupportedClaims = input.behaviorClaims.filter(isLexicallySupportedInvariantClaim);
  if (lexicallySupportedClaims.length > 0) {
    mergeConfidence -= Math.min(3 * lexicallySupportedClaims.length, 9);
    for (const claim of lexicallySupportedClaims) {
      const modeSummary = invariantModeSummary(claim);
      findings.push(finding(
        `policy:invariant:lexical:${claim.invariantId}`,
        'invariant-lexical-support',
        'warn',
        `Invariant ${claim.invariantId} is lexically-supported`,
        [claim.invariantId],
        [
          ...claim.evidence,
          ...(modeSummary ? [modeSummary] : [])
        ]
      ));
    }
    warnings.push(`${lexicallySupportedClaims.length} invariant(s) are only lexically-supported and do not yet carry execution-backed witnesses.`);
  }

  const riskyClaims = input.behaviorClaims.filter(isRiskyInvariantClaim);
  if (riskyClaims.length > 0) {
    mergeConfidence -= Math.min(10 * riskyClaims.length, 20);
    for (const claim of riskyClaims) {
      const modeSummary = invariantModeSummary(claim);
      findings.push(finding(
        `policy:invariant:${claim.invariantId}`,
        'invariant-risk',
        claim.status === 'at-risk' ? 'error' : 'warn',
        `Invariant ${claim.invariantId} is ${claim.status}`,
        [claim.invariantId],
        [
          ...claim.evidence,
          ...(modeSummary ? [modeSummary] : []),
          ...claim.obligations.map((item) => item.description)
        ]
      ));
    }
    reasons.push(...riskyInvariantReasonLines(riskyClaims));
  }

  for (const governanceFinding of input.governance) {
    mergeConfidence -= governanceFinding.level === 'error' ? 20 : 8;
    findings.push(finding(`policy:governance:${governanceFinding.id}`, 'governance', governanceFinding.level, governanceFinding.message, governanceFinding.scope, governanceFinding.evidence, governanceFinding.ruleId));
    reasons.push(governanceFinding.message);
  }

  for (const item of findings) {
    const waiver = isFindingWaived(item, input.waivers, input.nowIso);
    if (waiver) {
      item.waived = true;
      item.waiverId = waiver.id;
      warnings.push(`Applied waiver ${waiver.id} to ${item.code}`);
      mergeConfidence += item.level === 'error' ? 10 : 4;
    }
  }

  mergeConfidence = clamp(Math.round(mergeConfidence), 0, 100);
  if (mergeConfidence < input.policy.minMergeConfidence) {
    blockedBy.push(`Merge confidence ${mergeConfidence} below minimum ${input.policy.minMergeConfidence}`);
  }
  for (const item of findings.filter((entry) => entry.level === 'error' && !entry.waived)) {
    blockedBy.push(item.message);
  }

  const bestNextAction = input.mutationBaseline && input.mutationBaseline.status !== 'pass'
    ? 'Fix the baseline test command so it passes before trusting mutation evidence.'
    : !mutationSummary.measured
      ? 'Add executable tests or broaden measurable mutation scope so changed code produces explicit mutation pressure.'
      : survivingMutants.length > 0
        ? `Add or tighten an assertion covering ${survivingMutants[0]?.filePath} around the surviving mutant.`
        : riskyClaims[0]?.obligations[0]?.description
          ?? (lexicallySupportedClaims[0]
            ? `Add execution-backed invariant witnesses or explicit runtime mapping for ${lexicallySupportedClaims[0].invariantId} so support can graduate beyond deterministic lexical alignment.`
            : (hotspot ? `Refactor or cover ${hotspot.symbol} in ${hotspot.filePath}.` : undefined));

  const outcome: Verdict['outcome'] = blockedBy.length > 0 ? 'fail' : warnings.length > 0 || mergeConfidence < 85 ? 'warn' : 'pass';
  const verdict: Verdict = {
    mergeConfidence,
    outcome,
    reasons,
    warnings,
    blockedBy,
    findings
  };
  if (bestNextAction) {
    verdict.bestNextAction = bestNextAction;
  }

  const result: { verdict: Verdict; trend?: TrendDelta } = { verdict };
  if (input.previousRun) {
    result.trend = {
      previousRunId: input.previousRun.runId,
      mergeConfidenceDelta: verdict.mergeConfidence - input.previousRun.verdict.mergeConfidence,
      survivingMutantDelta: survivingMutants.length - input.previousRun.mutations.filter((item) => item.status === 'survived').length,
      hotspotDelta: maxChangedCrap - input.previousRun.complexity.reduce((max, item) => Math.max(max, item.crap), 0)
    };
  }

  return result;
}

function scenarioSummaryLabel(result: NonNullable<BehaviorClaim['evidenceSummary']>['scenarioResults'][number]): string {
  if (result.supported && result.supportKind === 'execution-witness') {
    return 'execution-backed witness matched';
  }
  if (result.supported) {
    return 'deterministic lexical witness matched';
  }
  if (result.supportGap === 'missing-assertion') {
    return 'matching keywords were present in one focused test case but no assertion-like check anchored them';
  }
  if (result.supportGap === 'split-focused-test-cases') {
    return 'happy-path and failure-path evidence was split across focused test cases';
  }
  const missing: string[] = [];
  if (!result.keywordsMatched) {
    missing.push('keywords');
  }
  if (!result.failurePathKeywordsMatched) {
    missing.push('failure-path');
  }
  return `missing ${missing.join(' + ')} evidence`;
}

type BehaviorClaimEvidenceSummary = NonNullable<BehaviorClaim['evidenceSummary']>;

function invariantModeSummary(claim: BehaviorClaim): string | undefined {
  const summary = claim.evidenceSummary;
  if (!summary || summary.subSignals.length === 0) {
    return undefined;
  }
  const parts = [
    summary.evidenceSemanticsSummary ? `Invariant evidence semantics: ${summary.evidenceSemanticsSummary}` : undefined,
    `Invariant evidence modes: ${summary.subSignals.map((item) => `${item.signalId}=${item.mode}`).join('; ')}`
  ].filter((item): item is string => Boolean(item));
  return parts.join('; ');
}

const INVARIANT_SUPPORT_SIGNAL_IDS = new Set(['focused-test-alignment', 'execution-witness', 'scenario-support']);

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function residualPressureSignalIds(claim: BehaviorClaim): string[] {
  const summary = claim.evidenceSummary;
  if (!summary || summary.evidenceSemantics !== 'execution-backed') {
    return [];
  }
  const supportSignalsClear = summary.subSignals
    .filter((item) => item.signalId === 'execution-witness' || item.signalId === 'scenario-support')
    .every((item) => item.level === 'clear' && item.mode !== 'missing');
  if (!supportSignalsClear) {
    return [];
  }
  return uniqueSorted(summary.subSignals
    .filter((item) => !INVARIANT_SUPPORT_SIGNAL_IDS.has(item.signalId))
    .filter((item) => item.level === 'warning' || item.level === 'missing' || item.mode === 'missing')
    .map((item) => item.signalId));
}

function riskyInvariantReasonLines(claims: BehaviorClaim[]): string[] {
  const residualPressure = claims
    .map((claim) => ({ claim, signals: residualPressureSignalIds(claim) }))
    .filter((item) => item.signals.length > 0);
  const residualClaimIds = new Set(residualPressure.map((item) => item.claim.id));
  const lines: string[] = [];
  const evidenceGapCount = claims.filter((claim) => !residualClaimIds.has(claim.id)).length;
  if (evidenceGapCount > 0) {
    lines.push(`${evidenceGapCount} invariant(s) need stronger test evidence or failure-path coverage.`);
  }
  if (residualPressure.length > 0) {
    const signals = uniqueSorted(residualPressure.flatMap((item) => item.signals));
    lines.push(`${residualPressure.length} execution-backed invariant(s) still carry residual evidence pressure: ${signals.join(', ')}.`);
  }
  return lines;
}

function formatInvariantSubSignal(subSignal: BehaviorClaimEvidenceSummary['subSignals'][number]): string {
  return `${subSignal.signalId} [${subSignal.level}; mode=${subSignal.mode}]: ${subSignal.summary}`;
}

export function findFirstRiskyInvariantClaim(run: Pick<RunArtifact, 'behaviorClaims'>): BehaviorClaim | undefined {
  return run.behaviorClaims.find((claim) => isRiskyInvariantClaim(claim));
}

export function renderConciseInvariantProvenance(
  claim: BehaviorClaim,
  options?: { linePrefix?: string; maxSignals?: number }
): string[] {
  const summary = claim.evidenceSummary;
  if (!summary || summary.subSignals.length === 0) {
    return [];
  }
  const linePrefix = options?.linePrefix ?? '';
  const maxSignals = options?.maxSignals ?? 3;
  const modeCounts = summary.subSignals.reduce(
    (counts, item) => {
      counts[item.mode] += 1;
      return counts;
    },
    { explicit: 0, inferred: 0, missing: 0 }
  );
  const projectedSignals = summary.subSignals
    .filter((item) => item.mode !== 'explicit' || item.level !== 'clear')
    .slice(0, maxSignals);
  const signalsToRender = projectedSignals.length > 0 ? projectedSignals : summary.subSignals.slice(0, Math.min(2, maxSignals));
  return [
    ...(summary.evidenceSemanticsSummary ? [`${linePrefix}Evidence semantics: ${summary.evidenceSemanticsSummary}`] : []),
    `${linePrefix}Evidence provenance: explicit ${modeCounts.explicit}, inferred ${modeCounts.inferred}, missing ${modeCounts.missing}`,
    ...signalsToRender.map((item) => `${linePrefix}${formatInvariantSubSignal(item)}`)
  ];
}

function renderInvariantSubSignals(claim: BehaviorClaim): string[] {
  const summary = claim.evidenceSummary;
  if (!summary || summary.subSignals.length === 0) {
    return [];
  }
  const lines = ['  - sub-signals:'];
  for (const subSignal of summary.subSignals) {
    lines.push(`    - ${formatInvariantSubSignal(subSignal)}`);
    for (const fact of subSignal.facts) {
      lines.push(`      - ${fact}`);
    }
  }
  return lines;
}

function renderInvariantEvidenceSummary(claim: BehaviorClaim, indent = '  - '): string[] {
  const summary = claim.evidenceSummary;
  if (!summary) {
    return [];
  }
  const changedFunctions = summary.changedFunctions.length > 0
    ? summary.changedFunctions.map((item) => `${item.symbol} (${item.filePath}, coverage ${item.coveragePct}%, CRAP ${item.crap})`).join('; ')
    : 'none';
  const scenarioResults = summary.scenarioResults.length > 0
    ? summary.scenarioResults.map((item) => `${item.scenarioId}=${scenarioSummaryLabel(item)}`).join('; ')
    : 'none';
  return [
    ...(summary.evidenceSemanticsSummary ? [`${indent}evidence semantics: ${summary.evidenceSemanticsSummary}`] : []),
    `${indent}impacted files: ${summary.impactedFiles.join(', ') || 'none'}`,
    `${indent}focused tests: ${summary.focusedTests.join(', ') || 'none'}`,
    `${indent}changed functions: ${changedFunctions}`,
    `${indent}changed functions under 80% coverage: ${summary.changedFunctionsUnder80Coverage}; max changed CRAP: ${summary.maxChangedCrap}`,
    `${indent}mutation scope: ${summary.mutationSitesInScope} site(s), ${summary.killedMutantsInScope} killed, ${summary.survivingMutantsInScope} survived`,
    `${indent}scenario results: ${scenarioResults}`,
    ...renderInvariantSubSignals(claim)
  ];
}

function yamlDoubleQuoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function withMarkdownMetadata(lines: string[], options: { summary: string; readWhen: string[]; type?: string }): string {
  return [
    '---',
    `summary: ${yamlDoubleQuoted(options.summary)}`,
    'read_when:',
    ...options.readWhen.map((item) => `  - ${yamlDoubleQuoted(item)}`),
    `type: ${yamlDoubleQuoted(options.type ?? 'reference')}`,
    '---',
    '',
    ...lines
  ].join('\n');
}

export function renderPrSummary(run: Pick<RunArtifact, 'changedFiles' | 'behaviorClaims' | 'mutations' | 'complexity' | 'verdict'>): string {
  const lines: string[] = [];
  const survivingMutants = run.mutations.filter((result) => result.status === 'survived').length;
  const changedHotspot = run.complexity.filter((item) => item.changed).sort((left, right) => right.crap - left.crap)[0];
  lines.push(`# ts-quality summary`);
  lines.push('');
  lines.push(`- Merge confidence: **${run.verdict.mergeConfidence}/100**`);
  lines.push(`- Outcome: **${run.verdict.outcome}**`);
  if (changedHotspot) {
    lines.push(`- Highest-risk changed hotspot: \
\`${changedHotspot.filePath}\` ${changedHotspot.symbol} with CRAP ${changedHotspot.crap}`);
  }
  lines.push(`- Surviving mutants: **${survivingMutants}**`);
  const riskyInvariant = findFirstRiskyInvariantClaim(run);
  if (riskyInvariant) {
    lines.push(`- Invariant at risk: **${riskyInvariant.invariantId}**`);
    lines.push(...renderConciseInvariantProvenance(riskyInvariant, { linePrefix: '  - ' }));
  }
  if (run.verdict.bestNextAction) {
    lines.push(`- Best next action: ${run.verdict.bestNextAction}`);
  }
  if (run.verdict.blockedBy.length > 0) {
    lines.push('');
    lines.push('## Blocking findings');
    for (const reason of run.verdict.blockedBy) {
      lines.push(`- ${reason}`);
    }
  }
  return withMarkdownMetadata(lines, {
    summary: 'PR-facing summary for a ts-quality run with concise invariant evidence provenance.',
    readWhen: [
      'When pasting a concise ts-quality result into a PR or review surface',
      'When inspecting the generated summary artifact format'
    ]
  });
}

function renderExecutionWitnessLines(summary: NonNullable<RunArtifact['executionWitnesses']>, options?: { bulletPrefix?: string }): string[] {
  const bulletPrefix = options?.bulletPrefix ?? '- ';
  const lines = [`Execution witnesses: auto-ran ${summary.autoRan.length}, skipped ${summary.skipped.length}`];
  if (summary.autoRan.length > 0) {
    lines.push('Auto-ran:');
    lines.push(...summary.autoRan.map((item) => `${bulletPrefix}${item.invariantId}:${item.scenarioId} -> ${item.outputPath} (${item.receipt.status}; receipt=${item.receiptPath})`));
  }
  if (summary.skipped.length > 0) {
    lines.push('Skipped:');
    lines.push(...summary.skipped.map((item) => `${bulletPrefix}${item.invariantId}:${item.scenarioId} -> ${item.outputPath} (${item.reason.replace(/-/g, ' ')})`));
  }
  return lines;
}

export function renderExplainText(run: Pick<RunArtifact, 'runId' | 'changedFiles' | 'behaviorClaims' | 'governance' | 'verdict' | 'executionWitnesses'>): string {
  const lines: string[] = [];
  lines.push(`Run ${run.runId}`);
  lines.push(`Changed files: ${run.changedFiles.join(', ') || 'none detected'}`);
  lines.push(`Merge confidence: ${run.verdict.mergeConfidence}/100 (${run.verdict.outcome})`);
  lines.push('');
  lines.push('Reasons:');
  for (const reason of run.verdict.reasons) {
    lines.push(`- ${reason}`);
  }
  if (run.behaviorClaims.length > 0) {
    lines.push('');
    lines.push('Invariant impact:');
    for (const claim of run.behaviorClaims) {
      lines.push(`- ${claim.invariantId}: ${claim.status}`);
      lines.push(...renderInvariantEvidenceSummary(claim));
      for (const evidence of claim.evidence) {
        lines.push(`  - ${evidence}`);
      }
      for (const obligation of claim.obligations) {
        lines.push(`  - obligation: ${obligation.description}`);
      }
    }
  }
  if (run.governance.length > 0) {
    lines.push('');
    lines.push('Governance findings:');
    for (const finding of run.governance) {
      lines.push(`- ${finding.ruleId}: ${finding.message}`);
      for (const evidence of finding.evidence) {
        lines.push(`  - ${evidence}`);
      }
    }
  }
  if (run.executionWitnesses) {
    lines.push('');
    lines.push(...renderExecutionWitnessLines(run.executionWitnesses));
  }
  return lines.join('\n');
}

export function renderMarkdownReport(run: RunArtifact): string {
  const lines: string[] = [];
  lines.push('# ts-quality report');
  lines.push('');
  lines.push(`- Run: \`${run.runId}\``);
  lines.push(`- Merge confidence: **${run.verdict.mergeConfidence}/100**`);
  lines.push(`- Outcome: **${run.verdict.outcome}**`);
  lines.push(`- Changed files: ${run.changedFiles.join(', ') || 'none'}`);
  lines.push('');
  lines.push('## Findings');
  for (const item of run.verdict.findings) {
    lines.push(`- [${item.level}] ${item.message}`);
    for (const evidence of item.evidence) {
      lines.push(`  - ${evidence}`);
    }
    if (item.waived && item.waiverId) {
      lines.push(`  - waived by ${item.waiverId}`);
    }
  }
  lines.push('');
  lines.push('## Invariants');
  for (const claim of run.behaviorClaims) {
    lines.push(`- ${claim.invariantId}: ${claim.status}`);
    lines.push(...renderInvariantEvidenceSummary(claim));
    for (const obligation of claim.obligations) {
      lines.push(`  - obligation: ${obligation.description}`);
    }
  }
  lines.push('');
  lines.push('## Governance');
  for (const item of run.governance) {
    lines.push(`- [${item.level}] ${item.ruleId}: ${item.message}`);
  }
  if (run.executionWitnesses) {
    lines.push('');
    lines.push('## Execution witnesses');
    lines.push(...renderExecutionWitnessLines(run.executionWitnesses, { bulletPrefix: '- ' }));
  }
  return withMarkdownMetadata(lines, {
    summary: 'Generated ts-quality report artifact with findings, invariants, and governance outcomes.',
    readWhen: [
      'When reviewing the full markdown report emitted by ts-quality',
      'When checking the generated report artifact contract'
    ]
  });
}
