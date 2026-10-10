import { type InvariantEvidenceMode, type InvariantScenarioResult, type InvariantSpec } from '../../evidence-model/src/index';
/** Lexical test analysis: focused test documents, assertion aliases, test-case scopes and scenario support across documents. */
interface TestWitnessScope {
    label: string;
    lowered: string;
    hasAssertion: boolean;
}
interface TestDocument {
    filePath: string;
    /** Raw module specifiers, lowercased; package matching must not use lexical variants. */
    importSpecifiers: string[];
    importHints: string[];
    witnessScopes: TestWitnessScope[];
}
export interface FocusedTestSelection {
    documents: TestDocument[];
    mode: InvariantEvidenceMode;
    modeReason: string;
}
export interface ScenarioLexicalSupport {
    keywordsMatched: boolean;
    failurePathKeywordsMatched: boolean;
    assertionMatched: boolean;
    supported: boolean;
    supportGap?: InvariantScenarioResult['supportGap'];
}
export declare function loadTestDocuments(rootDir: string, patterns: string[]): TestDocument[];
export declare function unique(values: string[]): string[];
export declare function focusedTestDocuments(rootDir: string, testDocuments: TestDocument[], invariant: InvariantSpec, files: string[]): FocusedTestSelection;
export declare function scenarioSupportAcrossDocuments(documents: TestDocument[], scenario: InvariantSpec['scenarios'][number]): ScenarioLexicalSupport;
export {};
