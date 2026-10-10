import { type InvariantEvidenceMode, type InvariantScenarioResult } from '../../evidence-model/src/index';
import { FocusedTestSelection, ScenarioLexicalSupport } from './test-documents';
/** Scenario support summaries, evidence-gap reasons and the explicit, inferred or missing support mode. */
export declare function pluralize(count: number, singular: string, plural?: string): string;
export declare function describeChangedFunction(item: {
    filePath: string;
    symbol: string;
    coveragePct: number;
    crap: number;
}): string;
export declare function summarizeScenarioSupport(result: InvariantScenarioResult): string;
export declare function withModeReason(modeReason: string, facts: string[]): string[];
export declare function scenarioEvidenceGapMessage(scenarioDescription: string, lexicalSupport: ScenarioLexicalSupport, executionWitnessConfigured: boolean): string;
export declare function explicitArtifactMode(hasEvidence: boolean, options: {
    explicitReason: string;
    missingReason: string;
}): {
    mode: InvariantEvidenceMode;
    modeReason: string;
};
export declare function scenarioSupportMode(scenarioResults: InvariantScenarioResult[], focusedTestSelection: FocusedTestSelection): InvariantEvidenceMode;
export declare function scenarioSupportModeReason(scenarioResults: InvariantScenarioResult[], focusedTestSelection: FocusedTestSelection): string;
