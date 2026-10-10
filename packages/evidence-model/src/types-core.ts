

/** Core evidence types: repository entities, coverage, complexity, mutation sites, targets, selection and results, invariants and witnesses. */

export type Severity = 'info' | 'warn' | 'error';
export type Outcome = 'pass' | 'warn' | 'fail';
export interface LineSpan {
  startLine: number;
  endLine: number;
}
export interface RepositoryEntity {
  rootDir: string;
  name: string;
  packages: PackageEntity[];
  digest: string;
}
export interface PackageEntity {
  name: string;
  dir: string;
}
export interface FileEntity {
  filePath: string;
  digest: string;
  packageName?: string | undefined;
}
export interface SymbolEntity {
  filePath: string;
  symbol: string;
  kind: string;
  span: LineSpan;
}
export interface ChangedRegion {
  filePath: string;
  hunkId: string;
  span: LineSpan;
}
export interface CoverageEvidence {
  kind: 'coverage';
  filePath: string;
  lines: Record<string, number>;
  coveredLines: number;
  totalLines: number;
  pct: number;
  source?: string | undefined;
  /** DA records that could not be read; any malformed record makes the file's evidence unusable and its pct 0. */
  malformedLines?: number | undefined;
  /** FN/FNDA function-entry hits keyed by the FN start line; used only for functions without instrumented DA lines. */
  functionHits?: Record<string, number> | undefined;
}
/**
 * Why a function's coverage is or is not measured. Anything other than `measured` is unknown coverage:
 * `coveragePct` is then 0 and CRAP is scored as fully uncovered, never as covered.
 */
export type FunctionCoverageStatus = 'measured' | 'missing' | 'ambiguous' | 'malformed' | 'mismatched' | 'not-instrumented';
export interface ComplexityEvidence {
  kind: 'complexity';
  filePath: string;
  symbol: string;
  span: LineSpan;
  complexity: number;
  /** Percent (0-100) of the function's LCOV-instrumented lines that executed. */
  coveragePct: number;
  crap: number;
  changed: boolean;
  coverageStatus?: FunctionCoverageStatus | undefined;
}
export interface MutationSite {
  id: string;
  filePath: string;
  span: LineSpan;
  startOffset: number;
  endOffset: number;
  operator: string;
  original: string;
  replacement: string;
  description: string;
}
export type MutationTarget =
  | { kind: 'file'; filePath: string }
  | { kind: 'span'; filePath: string; startLine: number; endLine: number }
  | { kind: 'symbol'; filePath: string; symbol: string; startLine?: number; endLine?: number }
  | { kind: 'site'; siteId: string };
/** Current function identities (for example CRAP complexity entries) used to resolve symbol targets. */
export interface FunctionSpan {
  filePath: string;
  symbol: string;
  span: LineSpan;
}
export type MutationExclusionReason = 'outside-changed-hunks' | 'uncovered' | 'not-targeted' | 'nested-function' | 'budget-sites';
export interface MutationTargetResolution {
  target: MutationTarget;
  status: 'resolved' | 'unresolved';
  reason?: 'not-found' | 'ambiguous' | 'stale-span' | 'stale-site' | 'not-a-source-file' | 'outside-changed-scope' | 'no-eligible-sites';
  /** Eligible sites the target matched, before the site budget. */
  matchedSites: number;
  /** Matched sites that survived the site budget and were selected. */
  selectedSites: number;
}
export interface MutationSelectionLedger {
  version: '1';
  policy: { coveredOnly: boolean; maxSites: number | null; maxDurationMs: number | null; targets: MutationTarget[] };
  counts: { discovered: number; eligible: number; selected: number; excluded: number; executed: number; cached: number; unobserved: number };
  targets: MutationTargetResolution[];
  excluded: Array<{ siteId: string; filePath: string; line: number; reason: MutationExclusionReason }>;
  /** True only when every selected site has an observed outcome (executed or cached) behind a passing baseline. */
  complete: boolean;
}
export type MutationStatus = 'killed' | 'survived' | 'skipped' | 'invalid' | 'error';
export interface MutationResult {
  kind: 'mutation-result';
  siteId: string;
  filePath: string;
  status: MutationStatus;
  durationMs: number;
  details?: string | undefined;
  span?: LineSpan | undefined;
  startOffset?: number | undefined;
  endOffset?: number | undefined;
  operator?: string | undefined;
  original?: string | undefined;
  replacement?: string | undefined;
  mutated?: string | undefined;
  testCommand?: string[] | undefined;
  assertionHint?: string | undefined;
  /** `executed` this run, reused from the fingerprinted `cached` manifest, or `not-executed` (no outcome observed). */
  origin?: 'executed' | 'cached' | 'not-executed' | undefined;
  /** Why an `error` result has no assertion verdict. */
  errorKind?: 'timeout' | 'command-missing' | 'signal' | 'spawn' | 'baseline' | 'budget' | undefined;
}
export interface InvariantSpec {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  selectors: string[];
  domains?: string[] | undefined;
  scenarios: InvariantScenario[];
  requiredTestPatterns?: string[] | undefined;
}
export interface InvariantScenario {
  id: string;
  description: string;
  keywords: string[];
  failurePathKeywords?: string[] | undefined;
  executionWitnessPatterns?: string[] | undefined;
  executionWitnessCommand?: string[] | undefined;
  executionWitnessOutput?: string | undefined;
  executionWitnessTestFiles?: string[] | undefined;
  executionWitnessTimeoutMs?: number | undefined;
  expected: string;
}
export interface ExecutionWitnessBinding {
  version: '1';
  sourceDigests: Record<string, string>;
  testDigests: Record<string, string>;
  contextDigests: Record<string, string>;
  command: string[];
  timeoutMs: number | null;
  environmentDigest: string;
  runtime: { node: string; platform: string; arch: string };
  fingerprint: string;
}
export interface ExecutionWitnessRecord {
  binding?: ExecutionWitnessBinding | undefined;
  version: '1';
  kind: 'execution-witness';
  invariantId: string;
  scenarioId: string;
  status: 'pass' | 'fail';
  sourceFiles: string[];
  testFiles?: string[] | undefined;
  observedAt?: string | undefined;
}
export interface InvariantChangedFunctionSummary {
  filePath: string;
  symbol: string;
  coveragePct: number;
  crap: number;
}
export interface InvariantScenarioResult {
  scenarioId: string;
  description: string;
  expected: string;
  keywordsMatched: boolean;
  failurePathKeywordsMatched: boolean;
  assertionMatched?: boolean | undefined;
  supported: boolean;
  supportGap?: 'split-focused-test-cases' | 'missing-assertion' | undefined;
  supportKind?: 'execution-witness' | 'deterministic-lexical' | 'missing' | undefined;
}
export type InvariantEvidenceSemantics = 'deterministic-lexical' | 'execution-backed';
export type InvariantEvidenceSignalId =
  | 'focused-test-alignment'
  | 'scenario-support'
  | 'execution-witness'
  | 'coverage-pressure'
  | 'mutation-pressure'
  | 'changed-function-pressure';
export type InvariantEvidenceSignalLevel = 'clear' | 'warning' | 'missing' | 'info';
export type InvariantEvidenceMode = 'explicit' | 'inferred' | 'missing';
export interface InvariantEvidenceSubSignal {
  signalId: InvariantEvidenceSignalId;
  label: string;
  level: InvariantEvidenceSignalLevel;
  mode: InvariantEvidenceMode;
  modeReason: string;
  summary: string;
  facts: string[];
}
export interface InvariantEvidenceSummary {
  invariantId: string;
  evidenceSemantics?: InvariantEvidenceSemantics | undefined;
  evidenceSemanticsSummary?: string | undefined;
  impactedFiles: string[];
  focusedTests: string[];
  executionWitnessFiles?: string[] | undefined;
  changedFunctions: InvariantChangedFunctionSummary[];
  changedFunctionsUnder80Coverage: number;
  maxChangedCrap: number;
  mutationSitesInScope: number;
  killedMutantsInScope: number;
  survivingMutantsInScope: number;
  scenarioResults: InvariantScenarioResult[];
  subSignals: InvariantEvidenceSubSignal[];
}
export interface BehaviorClaim {
  id: string;
  invariantId: string;
  description: string;
  status: 'supported' | 'lexically-supported' | 'unsupported' | 'at-risk';
  evidence: string[];
  obligations: TestObligation[];
  evidenceSummary?: InvariantEvidenceSummary | undefined;
}
export interface TestObligation {
  id: string;
  invariantId: string;
  priority: 'low' | 'medium' | 'high';
  description: string;
  scenarioId: string;
  fileHints: string[];
}
