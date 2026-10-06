import { type ChangedRegion, type ComplexityEvidence, type CoverageEvidence, type FunctionCoverageStatus, type LineSpan } from '../../evidence-model/src/index';
export interface CrapOptions {
    rootDir: string;
    sourceFiles?: string[];
    coverage?: CoverageEvidence[];
    changedFiles?: string[];
    changedRegions?: ChangedRegion[];
}
export interface CrapAnalysis {
    files: Array<{
        filePath: string;
        functions: ComplexityEvidence[];
        averageCrap: number;
        maxCrap: number;
    }>;
    hotspots: ComplexityEvidence[];
    summary: {
        fileCount: number;
        functionCount: number;
        averageCrap: number;
        maxCrap: number;
    };
}
export interface FunctionCoverage {
    status: FunctionCoverageStatus;
    /** Percent (0-100) of instrumented lines that executed; 0 whenever status is not `measured`. */
    pct: number;
    instrumentedLines: number;
    coveredLines: number;
}
/** Parses LCOV DA records. Repeated records for one file merge (hits add up); unreadable DA records are counted, not guessed. */
export declare function parseLcov(lcovText: string): CoverageEvidence[];
/** Percent of the span's LCOV-instrumented lines that executed; 0 when the span has no instrumented line. */
export declare function lineCoverage(lineMap: Record<string, number>, span: LineSpan): number;
/**
 * Coverage of one function from LCOV evidence. Missing, ambiguous, malformed, mismatched (lines past the end of
 * the source, as from compiled or stale output) and uninstrumented evidence is reported as unknown, never as covered.
 */
export declare function functionCoverage(filePath: string, span: LineSpan, coverage: CoverageEvidence[], sourceLineCount: number): FunctionCoverage;
/** CRAP = complexity^2 * (1 - coverage)^3 + complexity, with coverage in percent (clamped to 0-100), rounded to two decimals. */
export declare function crapScore(complexity: number, coveragePct: number): number;
export declare function analyzeSource(filePath: string, sourceText: string, coverage: CoverageEvidence[], changed: Set<string>, changedRegions: ChangedRegion[]): ComplexityEvidence[];
export declare function analyzeCrap(options: CrapOptions): CrapAnalysis;
export declare function formatCrapText(report: CrapAnalysis): string;
