import { type InvariantEvidenceMode, type InvariantScenarioResult } from '../../evidence-model/src/index';
import { FocusedTestSelection, ScenarioLexicalSupport } from './test-documents';

/** Scenario support summaries, evidence-gap reasons and the explicit, inferred or missing support mode. */

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
export function describeChangedFunction(item: { filePath: string; symbol: string; coveragePct: number; crap: number }): string {
  return `${item.symbol} (${item.filePath}, coverage ${item.coveragePct}%, CRAP ${item.crap})`;
}
export function summarizeScenarioSupport(result: InvariantScenarioResult): string {
  if (result.supported && result.supportKind === 'execution-witness') {
    return `${result.scenarioId}: execution-backed witness matched`;
  }
  if (result.supported) {
    return `${result.scenarioId}: deterministic lexical witness matched in one assertion-bearing focused test case`;
  }
  if (result.supportGap === 'missing-assertion') {
    return `${result.scenarioId}: matching keywords were present in one focused test case but no assertion-like check anchored them`;
  }
  if (result.supportGap === 'split-focused-test-cases') {
    return `${result.scenarioId}: happy-path and failure-path evidence was split across focused test cases`;
  }
  const missing: string[] = [];
  if (!result.keywordsMatched) {
    missing.push('keywords');
  }
  if (!result.failurePathKeywordsMatched) {
    missing.push('failure-path');
  }
  return `${result.scenarioId}: missing ${missing.join(' + ')} evidence`;
}
export function withModeReason(modeReason: string, facts: string[]): string[] {
  return [`mode reason: ${modeReason}`, ...facts];
}
function scenarioSupportGapReason(scenarioResults: InvariantScenarioResult[]): string | undefined {
  if (scenarioResults.some((item) => item.supportGap === 'missing-assertion')) {
    return 'matching keywords appeared in one focused test case, but no assertion-like check anchored them';
  }
  if (scenarioResults.some((item) => item.supportGap === 'split-focused-test-cases')) {
    return 'matching keywords were split across focused test cases instead of one focused test-case witness';
  }
  return undefined;
}
export function scenarioEvidenceGapMessage(scenarioDescription: string, lexicalSupport: ScenarioLexicalSupport, executionWitnessConfigured: boolean): string {
  const prefix = executionWitnessConfigured
    ? `Missing execution-backed or deterministic lexical test evidence for scenario '${scenarioDescription}'`
    : `Missing deterministic lexical test evidence for scenario '${scenarioDescription}'`;
  if (lexicalSupport.supportGap === 'missing-assertion') {
    return `${prefix}; matching keywords were present in one focused test case but no assertion-like check anchored them`;
  }
  if (lexicalSupport.supportGap === 'split-focused-test-cases') {
    return `${prefix}; happy-path and failure-path keywords were split across focused test cases`;
  }
  return prefix;
}
export function explicitArtifactMode(hasEvidence: boolean, options: { explicitReason: string; missingReason: string }): { mode: InvariantEvidenceMode; modeReason: string } {
  return hasEvidence
    ? { mode: 'explicit', modeReason: options.explicitReason }
    : { mode: 'missing', modeReason: options.missingReason };
}
export function scenarioSupportMode(scenarioResults: InvariantScenarioResult[], focusedTestSelection: FocusedTestSelection): InvariantEvidenceMode {
  if (scenarioResults.length === 0) {
    return 'missing';
  }

  const supportedCount = scenarioResults.filter((item) => item.supported).length;
  if (supportedCount === 0) {
    return 'missing';
  }

  if (scenarioResults.every((item) => item.supported && item.supportKind === 'execution-witness')) {
    return 'explicit';
  }

  return focusedTestSelection.mode === 'explicit' ? 'explicit' : 'inferred';
}
export function scenarioSupportModeReason(scenarioResults: InvariantScenarioResult[], focusedTestSelection: FocusedTestSelection): string {
  if (scenarioResults.length === 0) {
    return 'invariant declares no scenarios';
  }

  const supportedCount = scenarioResults.filter((item) => item.supported).length;
  const gapReason = scenarioSupportGapReason(scenarioResults);
  if (supportedCount === 0) {
    if (focusedTestSelection.mode === 'explicit') {
      if (focusedTestSelection.documents.length === 0) {
        return 'requiredTestPatterns matched no test files for deterministic lexical scenario evaluation';
      }
      return gapReason
        ? `requiredTestPatterns selected tests, but ${gapReason}`
        : 'requiredTestPatterns selected tests, but no scenario has full deterministic lexical support';
    }
    if (focusedTestSelection.mode === 'inferred') {
      return gapReason
        ? `heuristically aligned focused tests were evaluated, but ${gapReason}`
        : 'heuristically aligned focused tests were evaluated, but no scenario has full deterministic lexical support';
    }
    return 'no focused tests were available for deterministic lexical scenario evaluation';
  }

  if (scenarioResults.every((item) => item.supported && item.supportKind === 'execution-witness')) {
    return 'scenario support came from explicit execution witness artifacts';
  }
  if (focusedTestSelection.mode === 'explicit') {
    return 'deterministic lexical scenario support came from assertion-bearing tests matched by explicit requiredTestPatterns';
  }
  if (focusedTestSelection.mode === 'inferred') {
    return 'deterministic lexical scenario support came from assertion-bearing heuristically aligned focused tests';
  }
  return 'no focused tests were available for deterministic lexical scenario evaluation';
}
