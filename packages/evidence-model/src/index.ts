import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import ts from 'typescript';

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
}

export interface ComplexityEvidence {
  kind: 'complexity';
  filePath: string;
  symbol: string;
  span: LineSpan;
  complexity: number;
  coveragePct: number;
  crap: number;
  changed: boolean;
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

export type MutationStatus = 'killed' | 'survived' | 'skipped' | 'invalid' | 'error';

export interface MutationResult {
  kind: 'mutation-result';
  siteId: string;
  filePath: string;
  status: MutationStatus;
  durationMs: number;
  details?: string | undefined;
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
  expected: string;
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
  supported: boolean;
}

export type InvariantEvidenceSignalId =
  | 'focused-test-alignment'
  | 'scenario-support'
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
  impactedFiles: string[];
  focusedTests: string[];
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
  status: 'supported' | 'unsupported' | 'at-risk';
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

export interface PolicyFinding {
  id: string;
  code: string;
  level: Severity;
  message: string;
  scope: string[];
  evidence: string[];
  ruleId?: string | undefined;
  waived?: boolean | undefined;
  waiverId?: string | undefined;
}

export interface Waiver {
  id: string;
  ruleId: string;
  scope: string[];
  owner: string;
  reason: string;
  createdAt: string;
  expiresAt?: string | undefined;
}

export type ConstitutionRule =
  | BoundaryRule
  | OwnershipRule
  | RiskBudgetRule
  | ApprovalRule
  | RollbackRule;

export interface BoundaryRule {
  kind: 'boundary';
  id: string;
  from: string[];
  to: string[];
  mode: 'forbid';
  severity?: Severity | undefined;
  message: string;
}

export interface OwnershipRule {
  kind: 'ownership';
  id: string;
  owner: string;
  paths: string[];
  severity?: Severity | undefined;
  message: string;
  allowedAgents?: string[] | undefined;
}

export interface RiskBudgetRule {
  kind: 'risk';
  id: string;
  paths: string[];
  severity?: Severity | undefined;
  message: string;
  maxCrap?: number | undefined;
  minMutationScore?: number | undefined;
  minMergeConfidence?: number | undefined;
}

export interface ApprovalRule {
  kind: 'approval';
  id: string;
  paths: string[];
  severity?: Severity | undefined;
  message: string;
  minApprovals: number;
  roles: string[];
}

export interface RollbackRule {
  kind: 'rollback';
  id: string;
  paths: string[];
  severity?: Severity | undefined;
  message: string;
  requireEvidence: string[];
}

export interface GovernanceFinding {
  id: string;
  ruleId: string;
  level: Severity;
  message: string;
  evidence: string[];
  scope: string[];
}

export interface OwnershipBoundary {
  owner: string;
  paths: string[];
}

export interface AuthorityGrant {
  id: string;
  actions: string[];
  paths: string[];
  denyPaths?: string[] | undefined;
  minMergeConfidence?: number | undefined;
  requireAttestations?: string[];
  requireHumanReview?: boolean;
}

export interface Agent {
  id: string;
  kind: 'human' | 'automation' | 'service';
  roles: string[];
  standing?: string[] | undefined;
  grants: AuthorityGrant[];
  publicKeys?: string[] | undefined;
}

export interface LicenseGrant {
  agentId: string;
  grantId: string;
  actions: string[];
  paths: string[];
}

export interface Attestation {
  version: '1';
  kind: 'attestation';
  issuer: string;
  subjectType: string;
  subjectDigest: string;
  claims: string[];
  issuedAt: string;
  payload?: Record<string, unknown> | undefined;
  signature: {
    algorithm: 'ed25519';
    keyId: string;
    value: string;
  };
}

export interface AttestationVerificationRecord {
  version: '1';
  source: string;
  issuer?: string | undefined;
  ok: boolean;
  reason: string;
  subjectFile?: string | undefined;
  runId?: string | undefined;
  artifactName?: string | undefined;
}

export interface Approval {
  by: string;
  role?: string | undefined;
  standing?: string | undefined;
  rationale: string;
  createdAt: string;
  targetId: string;
}

export interface OverrideRecord extends Approval {
  kind: 'override';
}

export interface AuthorizationEvidenceArtifactPaths {
  run: string;
  verdict: string;
  governance: string;
  bundle: string;
}

export interface AuthorizationRiskyInvariantSummary {
  invariantId: string;
  description: string;
  evidenceProvenance: {
    explicit: number;
    inferred: number;
    missing: number;
  };
  signals: Array<Pick<InvariantEvidenceSubSignal, 'signalId' | 'label' | 'level' | 'mode' | 'summary'>>;
  obligation?: string | undefined;
}

export interface AuthorizationEvidenceContext {
  runId: string;
  runOutcome: Outcome;
  mergeConfidence: number;
  bestNextAction?: string | undefined;
  artifactPaths: AuthorizationEvidenceArtifactPaths;
  governanceErrors: Array<Pick<GovernanceFinding, 'ruleId' | 'message' | 'evidence' | 'scope'>>;
  riskyInvariant?: AuthorizationRiskyInvariantSummary | undefined;
}

export interface AuthorizationDecision {
  id: string;
  agentId: string;
  action: string;
  outcome: 'approve' | 'deny' | 'narrow-scope' | 'request-more-proof' | 'require-human-approver';
  reasons: string[];
  scope: string[];
  missingProof: string[];
  requiredApprovers: string[];
  consideredAttestations: string[];
  overrideUsed?: string | undefined;
  evidenceContext?: AuthorizationEvidenceContext | undefined;
}

export interface AmendmentProposal {
  id: string;
  title: string;
  rationale: string;
  evidence: string[];
  changes: Array<{
    action: 'add' | 'remove' | 'replace';
    ruleId: string;
    rule?: ConstitutionRule;
  }>;
  approvals: Approval[];
}

export interface AmendmentDecision {
  proposalId: string;
  outcome: 'approved' | 'denied' | 'needs-approvals';
  reasons: string[];
  approvalsAccepted: string[];
  requiredApprovals: number;
}

export interface TrendDelta {
  previousRunId?: string | undefined;
  mergeConfidenceDelta: number;
  survivingMutantDelta: number;
  hotspotDelta: number;
}

export interface ExecutionReceipt {
  status: 'pass' | 'fail' | 'error' | 'timeout';
  exitCode?: number | undefined;
  durationMs: number;
  details: string;
}

export interface AnalysisContext {
  runId: string;
  createdAt: string;
  configPath?: string | undefined;
  coverageLcovPath?: string | undefined;
  runtimeMirrorRoots?: string[] | undefined;
  sourceFiles: string[];
  changedFiles: string[];
  changedRegions: ChangedRegion[];
  executionFingerprint: string;
}

export interface Verdict {
  mergeConfidence: number;
  outcome: Outcome;
  reasons: string[];
  warnings: string[];
  blockedBy: string[];
  bestNextAction?: string | undefined;
  findings: PolicyFinding[];
}

export interface RunArtifact {
  version: '5.0.0';
  runId: string;
  createdAt: string;
  repo: RepositoryEntity;
  changedFiles: string[];
  changedRegions: ChangedRegion[];
  analysis?: AnalysisContext | undefined;
  files: FileEntity[];
  symbols: SymbolEntity[];
  coverage: CoverageEvidence[];
  complexity: ComplexityEvidence[];
  mutationSites: MutationSite[];
  mutations: MutationResult[];
  mutationBaseline?: ExecutionReceipt | undefined;
  invariants: InvariantSpec[];
  behaviorClaims: BehaviorClaim[];
  governance: GovernanceFinding[];
  attestations: Attestation[];
  approvals: Approval[];
  overrides: OverrideRecord[];
  verdict: Verdict;
  trend?: TrendDelta | undefined;
}

export interface LatestPointer {
  latestRunId: string;
}

export const DEFAULT_SOURCE_PATTERNS = ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx', 'src/**/*.mjs', 'src/**/*.cjs'];

export const DEFAULT_TEST_PATTERNS = [
  'test/**/*.js',
  'test/**/*.mjs',
  'test/**/*.cjs',
  'test/**/*.ts',
  'test/**/*.tsx',
  'tests/**/*.js',
  'tests/**/*.mjs',
  'tests/**/*.cjs',
  'tests/**/*.ts',
  'tests/**/*.tsx',
  '**/*.test.js',
  '**/*.test.mjs',
  '**/*.test.cjs',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.js',
  '**/*.spec.mjs',
  '**/*.spec.cjs',
  '**/*.spec.ts',
  '**/*.spec.tsx'
] as const;

function repoRelativePath(rootDir: string, absolutePath: string): string | undefined {
  const relative = normalizePath(path.relative(rootDir, absolutePath));
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    return undefined;
  }
  return relative;
}

function resolvedPathForContainment(candidatePath: string): string {
  const absoluteCandidate = path.resolve(candidatePath);
  if (fs.existsSync(absoluteCandidate)) {
    return fs.realpathSync(absoluteCandidate);
  }

  const tail: string[] = [];
  let currentPath = absoluteCandidate;
  while (!fs.existsSync(currentPath)) {
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    tail.unshift(path.basename(currentPath));
    currentPath = parentPath;
  }

  const resolvedExistingPath = fs.existsSync(currentPath)
    ? fs.realpathSync(currentPath)
    : path.resolve(currentPath);
  return tail.reduce((resolvedPath, segment) => path.join(resolvedPath, segment), resolvedExistingPath);
}

export function resolveRepoLocalPath(rootDir: string, candidate: string, options?: { allowMissing?: boolean; kind?: string }): { absolutePath: string; relativePath: string } {
  const absoluteRoot = path.resolve(rootDir);
  const resolvedRoot = fs.realpathSync(absoluteRoot);
  const absolutePath = path.isAbsolute(candidate) ? path.resolve(candidate) : path.resolve(absoluteRoot, candidate);
  const resolvedCandidatePath = resolvedPathForContainment(absolutePath);
  const relativePath = repoRelativePath(resolvedRoot, resolvedCandidatePath);
  const kind = options?.kind ?? 'path';
  if (!relativePath) {
    throw new Error(`${kind} must stay inside repository root: ${candidate}`);
  }
  if (!options?.allowMissing && !fs.existsSync(absolutePath)) {
    throw new Error(`${kind} not found: ${candidate}`);
  }
  return { absolutePath, relativePath };
}

function importResolutionCandidates(basePath: string): string[] {
  return [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.js'),
    path.join(basePath, 'index.jsx'),
    path.join(basePath, 'index.mjs'),
    path.join(basePath, 'index.cjs')
  ];
}

function resolveRelativeImportToRepoPath(rootDir: string, importerPath: string, specifier: string): string | undefined {
  const importerDir = path.dirname(importerPath);
  const basePath = path.resolve(rootDir, importerDir, specifier);
  for (const candidate of importResolutionCandidates(basePath)) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
      continue;
    }
    return repoRelativePath(rootDir, candidate);
  }
  return repoRelativePath(rootDir, basePath);
}

const compilerOptionsCache = new Map<string, ReturnType<typeof ts.parseJsonConfigFileContent>['options'] | undefined>();

function compilerOptionsForTsConfig(configPath: string): ReturnType<typeof ts.parseJsonConfigFileContent>['options'] | undefined {
  const cached = compilerOptionsCache.get(configPath);
  if (cached !== undefined || compilerOptionsCache.has(configPath)) {
    return cached;
  }
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  if (loaded.error) {
    compilerOptionsCache.set(configPath, undefined);
    return undefined;
  }
  const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, path.dirname(configPath));
  compilerOptionsCache.set(configPath, parsed.options);
  return parsed.options;
}

function compilerOptionsForImporter(rootDir: string, importerPath: string): ReturnType<typeof ts.parseJsonConfigFileContent>['options'] | undefined {
  const importerAbsolute = path.join(rootDir, importerPath);
  let currentDir = path.dirname(importerAbsolute);
  const normalizedRoot = path.resolve(rootDir);
  while (currentDir.startsWith(normalizedRoot)) {
    const candidate = path.join(currentDir, 'tsconfig.json');
    if (fs.existsSync(candidate)) {
      return compilerOptionsForTsConfig(candidate);
    }
    if (currentDir === normalizedRoot) {
      break;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  const rootConfigPath = ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.json');
  return rootConfigPath ? compilerOptionsForTsConfig(rootConfigPath) : undefined;
}

export function compilerOptionsForRepoFile(rootDir: string, filePath: string): ReturnType<typeof ts.parseJsonConfigFileContent>['options'] | undefined {
  return compilerOptionsForImporter(rootDir, normalizePath(filePath));
}

export function resolveRepoImport(rootDir: string, importerPath: string, specifier: string): string | undefined {
  if (specifier.startsWith('.')) {
    return resolveRelativeImportToRepoPath(rootDir, importerPath, specifier);
  }
  const compilerOptions = compilerOptionsForImporter(rootDir, importerPath);
  if (!compilerOptions) {
    return undefined;
  }
  const resolved = ts.resolveModuleName(specifier, path.join(rootDir, importerPath), compilerOptions, ts.sys).resolvedModule?.resolvedFileName;
  if (!resolved) {
    return undefined;
  }
  return repoRelativePath(rootDir, resolved);
}

function withCompiledExtension(filePath: string, extension: string, compiledExtension: string): string {
  return extension.length > 0 && filePath.endsWith(extension)
    ? `${filePath.slice(0, -extension.length)}${compiledExtension}`
    : filePath;
}

export function runtimeMirrorCandidates(sourcePath: string, mirrorRoots: string[] = ['dist']): string[] {
  const normalized = normalizePath(sourcePath);
  const extension = path.extname(normalized);
  const compiledExtension = extension === '.ts' || extension === '.tsx' || extension === '.jsx' ? '.js' : extension;
  const candidates = new Set<string>();
  const sourceSegments = normalized.split('/').filter(Boolean);
  const srcIndex = sourceSegments.indexOf('src');
  const sourceDir = path.posix.dirname(normalized);
  const sourceBase = path.posix.basename(normalized);

  for (const mirrorRoot of mirrorRoots.map((item) => normalizePath(item)).filter(Boolean)) {
    const rootSegments = mirrorRoot.split('/').filter(Boolean);
    if (srcIndex >= 0) {
      const mirroredSegments = [...sourceSegments];
      mirroredSegments.splice(srcIndex, 1, ...rootSegments);
      const candidate = withCompiledExtension(mirroredSegments.join('/'), extension, compiledExtension);
      if (candidate !== normalized) {
        candidates.add(normalizePath(candidate));
      }
      if (srcIndex === 0) {
        const rootCandidate = withCompiledExtension(path.posix.join(mirrorRoot, normalized.slice(4)), extension, compiledExtension);
        if (rootCandidate !== normalized) {
          candidates.add(normalizePath(rootCandidate));
        }
      }
      continue;
    }

    const siblingCandidate = withCompiledExtension(path.posix.join(sourceDir === '.' ? '' : sourceDir, mirrorRoot, sourceBase), extension, compiledExtension);
    const rootCandidate = withCompiledExtension(path.posix.join(mirrorRoot, normalized), extension, compiledExtension);
    for (const candidate of [siblingCandidate, rootCandidate]) {
      if (candidate !== normalized) {
        candidates.add(normalizePath(candidate));
      }
    }
  }

  return [...candidates];
}

export function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/\/+/g, '/');
  return normalized.replace(/^\.\//, '').replace(/^\//, '').replace(/\/$/, '');
}

export function createRunId(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function assertSafeRunId(runId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) {
    throw new Error(`runId must use only letters, numbers, dot, underscore, and hyphen: ${runId}`);
  }
  return runId;
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function stableSortKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortKeys(item)) as T;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, inner]) => [key, stableSortKeys(inner)]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableSortKeys(value), null, 2);
}

export function sha256Hex(input: string | Uint8Array): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function digestObject(value: unknown): string {
  return `sha256:${sha256Hex(stableStringify(value))}`;
}

export function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

export function writeText(filePath: string, contents: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents, 'utf8');
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(readText(filePath)) as T;
}

export function writeJson(filePath: string, value: unknown): void {
  writeText(filePath, `${stableStringify(value)}\n`);
}

export function fileDigest(filePath: string): string {
  return `sha256:${sha256Hex(fs.readFileSync(filePath))}`;
}

export function listFiles(rootDir: string, options?: { include?: RegExp; excludeDirs?: string[] }): string[] {
  const include = options?.include ?? /./;
  const excludeDirs = new Set((options?.excludeDirs ?? ['node_modules', 'dist', '.git', '.ts-quality']).map((item) => normalizePath(item)));
  const output: string[] = [];

  function visit(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentDir, entry.name);
      const relative = normalizePath(path.relative(rootDir, absolute));
      if (entry.isDirectory()) {
        if (excludeDirs.has(entry.name) || excludeDirs.has(relative)) {
          continue;
        }
        visit(absolute);
        continue;
      }
      if (include.test(relative)) {
        output.push(relative);
      }
    }
  }

  if (fs.existsSync(rootDir)) {
    visit(rootDir);
  }
  return output.sort();
}

export function collectSourceFiles(rootDir: string, patterns: string[] = [...DEFAULT_SOURCE_PATTERNS]): string[] {
  const files = listFiles(rootDir, { include: /\.(ts|tsx|js|jsx|mjs|cjs)$/ });
  return files.filter((filePath) => patterns.some((pattern) => matchPattern(pattern, filePath)));
}

export function globToRegExp(pattern: string): RegExp {
  const normalized = normalizePath(pattern);
  let output = '^';

  for (let index = 0; index < normalized.length; ) {
    if (normalized.slice(index, index + 3) === '**/') {
      output += '(?:.*/)?';
      index += 3;
      continue;
    }
    if (normalized.slice(index, index + 2) === '**') {
      output += '.*';
      index += 2;
      continue;
    }

    const current = normalized[index] ?? '';
    if (current === '*') {
      output += '[^/]*';
      index += 1;
      continue;
    }

    output += current.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    index += 1;
  }

  output += '$';
  return new RegExp(output);
}

export function matchPattern(pattern: string, value: string): boolean {
  const normalizedPattern = normalizePath(pattern);
  const normalizedValue = normalizePath(value);
  if (normalizedPattern.startsWith('path:')) {
    return matchPattern(normalizedPattern.slice(5), normalizedValue);
  }
  if (!normalizedPattern.includes('*')) {
    return normalizedPattern === normalizedValue;
  }
  return globToRegExp(normalizedPattern).test(normalizedValue);
}

export function matchesAny(patterns: string[], value: string): boolean {
  return patterns.some((pattern) => matchPattern(pattern, value));
}

export function findCoverageEvidence(filePath: string, coverage: CoverageEvidence[]): CoverageEvidence | undefined {
  const normalized = normalizePath(filePath);
  const exact = coverage.find((item) => normalizePath(item.filePath) === normalized);
  if (exact) {
    return exact;
  }
  const suffixMatches = coverage.filter((item) => normalizePath(item.filePath).endsWith(`/${normalized}`));
  return suffixMatches.length === 1 ? suffixMatches[0] : undefined;
}

export function repoDigest(rootDir: string, filePaths: string[]): string {
  const entries = filePaths.map((filePath) => ({ filePath, digest: fileDigest(path.join(rootDir, filePath)) }));
  return digestObject(entries);
}

export function inferPackages(rootDir: string): PackageEntity[] {
  const packageJsonFiles = listFiles(rootDir, { include: /package\.json$/ });
  return packageJsonFiles.map((filePath) => {
    const packageDir = normalizePath(path.dirname(filePath));
    const packageJson = readJson<{ name?: string }>(path.join(rootDir, filePath));
    return {
      name: packageJson.name ?? packageDir,
      dir: packageDir === '.' ? '' : packageDir
    };
  });
}

export function resolvePackageName(filePath: string, packages: PackageEntity[]): string | undefined {
  const normalized = normalizePath(filePath);
  const match = packages
    .filter((entry) => normalized === entry.dir || normalized.startsWith(`${entry.dir}/`) || entry.dir === '')
    .sort((left, right) => right.dir.length - left.dir.length)[0];
  return match?.name;
}

export function buildRepositoryEntity(rootDir: string, filePaths: string[]): RepositoryEntity {
  const packages = inferPackages(rootDir);
  return {
    rootDir: normalizePath(rootDir),
    name: path.basename(rootDir),
    packages,
    digest: repoDigest(rootDir, filePaths)
  };
}

export function loadOptionalJsonArray<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return readJson<T[]>(filePath);
}

export function isWaiverActive(waiver: Waiver, nowIso: string): boolean {
  if (!waiver.expiresAt) {
    return true;
  }
  return new Date(nowIso).getTime() <= new Date(waiver.expiresAt).getTime();
}

export function isFindingWaived(finding: PolicyFinding, waivers: Waiver[], nowIso: string): Waiver | undefined {
  return waivers.find((waiver) => waiver.ruleId === (finding.ruleId ?? finding.code) && isWaiverActive(waiver, nowIso) && finding.scope.every((scope) => waiver.scope.some((item) => matchPattern(item, scope) || item === scope)));
}

export function parseUnifiedDiff(diffText: string): ChangedRegion[] {
  const regions: ChangedRegion[] = [];
  let currentFile: string | undefined;
  let counter = 0;
  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      currentFile = normalizePath(line.slice(6));
      continue;
    }
    const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (match && currentFile) {
      const startLine = Number(match[1]);
      const lineCount = Number(match[2] ?? '1');
      regions.push({
        filePath: currentFile,
        hunkId: `hunk-${counter++}`,
        span: {
          startLine,
          endLine: startLine + Math.max(lineCount - 1, 0)
        }
      });
    }
  }
  return regions;
}

export function writeRunArtifact(rootDir: string, run: RunArtifact): string {
  const safeRunId = assertSafeRunId(run.runId);
  const artifactRoot = path.join(rootDir, '.ts-quality', 'runs', safeRunId);
  ensureDir(artifactRoot);
  writeJson(path.join(artifactRoot, 'run.json'), run);
  writeJson(path.join(artifactRoot, 'verdict.json'), run.verdict);
  writeJson(path.join(rootDir, '.ts-quality', 'latest.json'), { latestRunId: safeRunId } satisfies LatestPointer);
  return artifactRoot;
}

export function readLatestRun(rootDir: string): RunArtifact {
  const latestPointerPath = path.join(rootDir, '.ts-quality', 'latest.json');
  if (!fs.existsSync(latestPointerPath)) {
    throw new Error(`No latest run pointer found at ${latestPointerPath}`);
  }
  const pointer = readJson<LatestPointer>(latestPointerPath);
  return loadRun(rootDir, pointer.latestRunId);
}

export function listRunIds(rootDir: string): string[] {
  const runsDir = path.join(rootDir, '.ts-quality', 'runs');
  if (!fs.existsSync(runsDir)) {
    return [];
  }
  return fs.readdirSync(runsDir, { withFileTypes: true }).filter((entry: any) => entry.isDirectory()).map((entry: any) => entry.name).sort();
}

export function loadRun(rootDir: string, runId: string): RunArtifact {
  const safeRunId = assertSafeRunId(runId);
  return readJson<RunArtifact>(path.join(rootDir, '.ts-quality', 'runs', safeRunId, 'run.json'));
}

export function readMaybe<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  return readJson<T>(filePath);
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function summarizeMutationScore(results: MutationResult[]): { killed: number; survived: number; score: number } {
  const killed = results.filter((result) => result.status === 'killed').length;
  const survived = results.filter((result) => result.status === 'survived').length;
  const total = killed + survived;
  return {
    killed,
    survived,
    score: total === 0 ? 1 : killed / total
  };
}

export function changedFileSet(changedFiles: string[], changedRegions: ChangedRegion[]): Set<string> {
  return new Set([...changedFiles.map((item) => normalizePath(item)), ...changedRegions.map((item) => normalizePath(item.filePath))]);
}

export function spanOverlaps(line: number, span: LineSpan): boolean {
  return line >= span.startLine && line <= span.endLine;
}
