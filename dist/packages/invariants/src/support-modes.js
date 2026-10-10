"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pluralize = pluralize;
exports.describeChangedFunction = describeChangedFunction;
exports.summarizeScenarioSupport = summarizeScenarioSupport;
exports.withModeReason = withModeReason;
exports.scenarioEvidenceGapMessage = scenarioEvidenceGapMessage;
exports.explicitArtifactMode = explicitArtifactMode;
exports.scenarioSupportMode = scenarioSupportMode;
exports.scenarioSupportModeReason = scenarioSupportModeReason;
/** Scenario support summaries, evidence-gap reasons and the explicit, inferred or missing support mode. */
function pluralize(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}
function describeChangedFunction(item) {
    return `${item.symbol} (${item.filePath}, coverage ${item.coveragePct}%, CRAP ${item.crap})`;
}
function summarizeScenarioSupport(result) {
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
    const missing = [];
    if (!result.keywordsMatched) {
        missing.push('keywords');
    }
    if (!result.failurePathKeywordsMatched) {
        missing.push('failure-path');
    }
    return `${result.scenarioId}: missing ${missing.join(' + ')} evidence`;
}
function withModeReason(modeReason, facts) {
    return [`mode reason: ${modeReason}`, ...facts];
}
function scenarioSupportGapReason(scenarioResults) {
    if (scenarioResults.some((item) => item.supportGap === 'missing-assertion')) {
        return 'matching keywords appeared in one focused test case, but no assertion-like check anchored them';
    }
    if (scenarioResults.some((item) => item.supportGap === 'split-focused-test-cases')) {
        return 'matching keywords were split across focused test cases instead of one focused test-case witness';
    }
    return undefined;
}
function scenarioEvidenceGapMessage(scenarioDescription, lexicalSupport, executionWitnessConfigured) {
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
function explicitArtifactMode(hasEvidence, options) {
    return hasEvidence
        ? { mode: 'explicit', modeReason: options.explicitReason }
        : { mode: 'missing', modeReason: options.missingReason };
}
function scenarioSupportMode(scenarioResults, focusedTestSelection) {
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
function scenarioSupportModeReason(scenarioResults, focusedTestSelection) {
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
//# sourceMappingURL=support-modes.js.map