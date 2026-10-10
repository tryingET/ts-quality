import fs from 'fs';
import path from 'path';
import {
  DEFAULT_SOURCE_PATTERNS,
  DEFAULT_TEST_PATTERNS,
  ensureDir,
  normalizePath,
  resolveRepoLocalPath,
  stableStringify
} from '../../evidence-model/src/index';
import { generateKeyPair } from '../../legitimacy/src/index';
import { loadContext } from './config';
import { PackageManagerName, machineValue, packageManagerExec, readPackageManager } from './doctor';
import { relativeToRoot } from './materialize-adopt';

/** Starter control-plane generation (init) and the read-only artifact retention projection. */

export type InitPreset = 'default' | 'node-test' | 'node-test-ts-dist' | 'vitest' | 'jest';
function configArrayText(values: string[]): string {
  return `[${values.map((value) => `'${value}'`).join(', ')}]`;
}
function initConfigText(preset: InitPreset, packageManager: PackageManagerName): string {
  const jest = packageManagerExec(packageManager, 'jest');
  const coverageCommand = preset === 'jest'
    ? `generateCommand: ${configArrayText([...jest, '--coverage', '--coverageReporters=lcov', '--coverageDirectory=coverage'])},`
    : preset === 'node-test-ts-dist'
    ? "generateCommand: ['node', '--enable-source-maps', '--test', '--experimental-test-coverage', '--test-reporter=lcov', '--test-reporter-destination=coverage/lcov.info'],"
    : preset === 'node-test'
      ? "generateCommand: ['node', '--test', '--experimental-test-coverage', '--test-reporter=lcov', '--test-reporter-destination=coverage/lcov.info'],"
      : preset === 'vitest'
        ? "generateCommand: ['npm', 'run', 'coverage'],"
        : "// generateCommand: ['node', '--test', '--experimental-test-coverage', '--test-reporter=lcov', '--test-reporter-destination=coverage/lcov.info'],";
  const mutationCommand = preset === 'jest'
    ? configArrayText([...jest, '--runInBand'])
    : preset === 'vitest' ? "['npm', 'test', '--', '--run']" : "['node', '--test']";
  const runtimeMirrorRoots = preset === 'node-test-ts-dist' ? "['dist', 'lib', 'build']" : "['dist']";
  const presetComment = preset === 'node-test-ts-dist'
    ? 'TypeScript projects that execute built output should keep source-map coverage enabled so LCOV maps back to src/**.'
    : preset === 'jest'
      ? `Jest projects run through ${packageManager}; narrow these commands to the changed slice's tests.`
    : preset === 'vitest'
      ? 'Vitest projects should make npm run coverage write coverage/lcov.info deterministically.'
      : 'Node test projects can let check create coverage/lcov.info when it is missing.';
  return `// ts-quality init preset: ${preset}\n// ${presetComment}\nexport default {\n  sourcePatterns: ${stableStringify([...DEFAULT_SOURCE_PATTERNS])},\n  testPatterns: ${stableStringify([...DEFAULT_TEST_PATTERNS])},\n  coverage: {\n    lcovPath: 'coverage/lcov.info',\n    // When lcovPath is missing, check can run this command after creating the parent directory.\n    ${coverageCommand}\n    generateTimeoutMs: 60000\n  },\n  mutations: { testCommand: ${mutationCommand}, coveredOnly: true, timeoutMs: 15000, maxSites: 25, runtimeMirrorRoots: ${runtimeMirrorRoots} },\n  policy: { maxChangedCrap: 30, minMutationScore: 0.8, minMergeConfidence: 70 },\n  // Provide --changed <a,b,c> or set changeSet.files / changeSet.diffFile before running check.\n  changeSet: { files: [] },\n  invariantsPath: '.ts-quality/invariants.ts',\n  constitutionPath: '.ts-quality/constitution.ts',\n  agentsPath: '.ts-quality/agents.ts'\n};\n`;
}
export function initProject(rootDir: string, options?: { preset?: InitPreset }): void {
  ensureDir(path.join(rootDir, '.ts-quality', 'attestations'));
  ensureDir(path.join(rootDir, '.ts-quality', 'keys'));
  ensureDir(path.join(rootDir, '.ts-quality', 'witnesses'));
  const preset = options?.preset ?? 'default';
  const configPath = path.join(rootDir, 'ts-quality.config.ts');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, initConfigText(preset, readPackageManager(rootDir)), 'utf8');
  }
  const invariantsPath = path.join(rootDir, '.ts-quality', 'invariants.ts');
  if (!fs.existsSync(invariantsPath)) {
    fs.writeFileSync(invariantsPath, `// First-invariant habit: replace this sample with one behavior-bearing source path,
// one assertion-bearing focused test file, and one scenario you would cite in review.
// See docs/adoption/first-invariant-witness-authoring.md in the ts-quality package.
export default [
  {
    id: 'auth.refresh.validity',
    title: 'Refresh token validity',
    description: 'Expired refresh tokens must never authorize access.',
    severity: 'high',
    selectors: ['path:src/auth/token.ts', 'symbol:isRefreshExpired'],
    requiredTestPatterns: ['test/auth/token.test.ts'],
    scenarios: [
      {
        id: 'expired-boundary',
        description: 'exact expiry boundary denies access',
        keywords: ['active token before expiry allows access'],
        failurePathKeywords: ['exact expiry boundary denies access'],
        // Optional execution-backed witness generation during \`ts-quality check\`:
        // executionWitnessCommand: ['npm', 'run', 'test:auth-token', '--silent'],
        // executionWitnessOutput: '.ts-quality/witnesses/auth-refresh-expired-boundary.json',
        // executionWitnessTestFiles: ['test/auth/token.test.ts'],
        // executionWitnessTimeoutMs: 5000,
        expected: 'deny'
      }
    ]
  }
];
`, 'utf8');
  }
  const witnessReadmePath = path.join(rootDir, '.ts-quality', 'witnesses', 'README.md');
  if (!fs.existsSync(witnessReadmePath)) {
    fs.writeFileSync(witnessReadmePath, `# ts-quality witnesses

Write the first execution witness only after choosing one invariant, one scenario,
one behavior-bearing source path, and one focused test command.

Recommended shape:

\`\`\`bash
npx ts-quality witness test \\
  --invariant auth.refresh.validity \\
  --scenario expired-boundary \\
  --source-files src/auth/token.ts \\
  --test-files test/auth/token.test.ts \\
  --out .ts-quality/witnesses/auth-refresh-expired-boundary.json \\
  -- npm run test:auth-token --silent
\`\`\`

Commit reusable witness JSON only when the target repo deliberately treats it as
review evidence. Keep generated \`*.receipt.json\` sidecars and run artifacts
out of commits unless the repo intentionally snapshots reviewed examples.

Do not use repo-global tests as focused witness proof when a module-level or
contract-level command exists.
`, 'utf8');
  }
  const constitutionPath = path.join(rootDir, '.ts-quality', 'constitution.ts');
  if (!fs.existsSync(constitutionPath)) {
    fs.writeFileSync(constitutionPath, `export default [\n  { kind: 'risk', id: 'default-risk', paths: ['src/**'], message: 'Changed source must stay within risk budgets.', maxCrap: 30, minMutationScore: 0.8, minMergeConfidence: 70 },\n  { kind: 'approval', id: 'payments-review', paths: ['src/payments/**'], message: 'Payments changes require a maintainer approval.', minApprovals: 1, roles: ['maintainer'] }\n];\n`, 'utf8');
  }
  const agentsPath = path.join(rootDir, '.ts-quality', 'agents.ts');
  if (!fs.existsSync(agentsPath)) {
    fs.writeFileSync(agentsPath, `export default [\n  { id: 'maintainer', kind: 'human', roles: ['maintainer'], grants: [{ id: 'maintainer-merge', actions: ['merge', 'override', 'amend'], paths: ['src/**'], minMergeConfidence: 60 }] },\n  { id: 'release-bot', kind: 'automation', roles: ['ci'], grants: [{ id: 'release-bot-merge', actions: ['merge'], paths: ['src/**'], minMergeConfidence: 80, requireAttestations: ['ci.tests.passed'], requireHumanReview: true }] }\n];\n`, 'utf8');
  }
  for (const fileName of ['waivers.json', 'approvals.json', 'overrides.json']) {
    const filePath = path.join(rootDir, '.ts-quality', fileName);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]\n', 'utf8');
    }
  }
  const keyBase = path.join(rootDir, '.ts-quality', 'keys', 'sample');
  if (!fs.existsSync(`${keyBase}.pem`) || !fs.existsSync(`${keyBase}.pub.pem`)) {
    const pair = generateKeyPair();
    fs.writeFileSync(`${keyBase}.pem`, pair.privateKeyPem, 'utf8');
    fs.writeFileSync(`${keyBase}.pub.pem`, pair.publicKeyPem, 'utf8');
  }
}
interface ArtifactRetentionPlanEntry {
  path: string;
  reason: string;
  status?: 'present' | 'missing' | 'pattern';
}
export interface ArtifactRetentionPlan {
  surface: 'ts-quality.artifact-retention';
  schemaVersion: 1;
  rootDir: string;
  config: {
    loaded: boolean;
    path?: string | undefined;
    error?: string | undefined;
  };
  keep: ArtifactRetentionPlanEntry[];
  ignore: ArtifactRetentionPlanEntry[];
  warnings: string[];
}
function repoFileStatus(rootDir: string, relativePath: string): 'present' | 'missing' {
  try {
    const resolved = resolveRepoLocalPath(rootDir, relativePath, { allowMissing: true, kind: 'retention path' });
    return fs.existsSync(resolved.absolutePath) ? 'present' : 'missing';
  } catch {
    return 'missing';
  }
}
function retentionEntry(rootDir: string, relativePath: string, reason: string): ArtifactRetentionPlanEntry {
  return { path: normalizePath(relativePath), reason, status: repoFileStatus(rootDir, relativePath) };
}
function listRetentionFiles(rootDir: string, relativeDir: string, predicate: (relativePath: string) => boolean): string[] {
  const directory = resolveRepoLocalPath(rootDir, relativeDir, { allowMissing: true, kind: 'retention directory' }).absolutePath;
  const output: string[] = [];
  function visit(currentDir: string): void {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = normalizePath(path.relative(rootDir, absolutePath));
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (entry.isFile() && predicate(relativePath)) {
        output.push(relativePath);
      }
    }
  }
  if (fs.existsSync(directory) && fs.statSync(directory).isDirectory()) {
    visit(directory);
  }
  return output.sort();
}
export function buildArtifactRetentionPlan(rootDir: string, options?: { configPath?: string }): ArtifactRetentionPlan {
  let loaded: ReturnType<typeof loadContext> | undefined;
  let configError: string | undefined;
  try {
    loaded = loadContext(rootDir, options?.configPath);
  } catch (error) {
    configError = error instanceof Error ? error.message : String(error);
  }
  const keep: ArtifactRetentionPlanEntry[] = [];
  if (loaded) {
    keep.push(retentionEntry(rootDir, relativeToRoot(rootDir, loaded.configPath), 'ts-quality configuration'));
    keep.push(retentionEntry(rootDir, loaded.config.invariantsPath, 'invariant definitions'));
    keep.push(retentionEntry(rootDir, loaded.config.constitutionPath, 'constitution rules'));
    keep.push(retentionEntry(rootDir, loaded.config.agentsPath, 'agent policy'));
    keep.push(retentionEntry(rootDir, loaded.config.approvalsPath, 'repo-local approvals'));
    keep.push(retentionEntry(rootDir, loaded.config.waiversPath, 'repo-local waivers'));
    keep.push(retentionEntry(rootDir, loaded.config.overridesPath, 'repo-local overrides'));
  } else {
    keep.push({ path: 'ts-quality.config.*', reason: 'ts-quality configuration once initialized', status: 'pattern' });
    keep.push({ path: '.ts-quality/{invariants,constitution,agents}.*', reason: 'control-plane source files once initialized', status: 'pattern' });
    keep.push({ path: '.ts-quality/{approvals,waivers,overrides}.json', reason: 'governance control-plane data once initialized', status: 'pattern' });
  }
  const witnessFiles = listRetentionFiles(rootDir, '.ts-quality/witnesses', (relativePath) => relativePath.endsWith('.json') && !relativePath.endsWith('.receipt.json'));
  keep.push(...witnessFiles.map((relativePath) => retentionEntry(rootDir, relativePath, 'execution witness record')));
  if (witnessFiles.length === 0) {
    keep.push({ path: '.ts-quality/witnesses/<witness>.json', reason: 'execution witness records after they exist; exclude *.receipt.json sidecars', status: 'pattern' });
  }
  const publicKeyDir = loaded?.config.trustedKeysDir ?? '.ts-quality/keys';
  const publicKeys = listRetentionFiles(rootDir, publicKeyDir, (relativePath) => relativePath.endsWith('.pub.pem'));
  keep.push(...publicKeys.map((relativePath) => retentionEntry(rootDir, relativePath, 'trusted public verification key')));
  if (publicKeys.length === 0) {
    keep.push({ path: `${publicKeyDir}/**/*.pub.pem`, reason: 'trusted public verification keys after they exist', status: 'pattern' });
  }
  const coveragePath = loaded?.config.coverage.lcovPath ?? 'coverage/lcov.info';
  const privateKeys = listRetentionFiles(rootDir, publicKeyDir, (relativePath) => relativePath.endsWith('.pem') && !relativePath.endsWith('.pub.pem'));
  const ignore: ArtifactRetentionPlanEntry[] = [
    { path: '.ts-quality/runs/', reason: 'generated immutable run bundles; snapshot deliberately only for reviewed examples', status: 'pattern' },
    { path: '.ts-quality/latest.json', reason: 'ambient pointer to latest run, not durable authority', status: repoFileStatus(rootDir, '.ts-quality/latest.json') },
    { path: '.ts-quality/mutation-manifest.json', reason: 'generated mutation execution scratch artifact', status: repoFileStatus(rootDir, '.ts-quality/mutation-manifest.json') },
    { path: '.ts-quality/package-index.json', reason: 'generated package artifact-reference index; regenerate it, or upload it with its upload.paths, instead of committing it', status: repoFileStatus(rootDir, '.ts-quality/package-index.json') },
    { path: coveragePath, reason: 'generated LCOV output', status: repoFileStatus(rootDir, coveragePath) },
    { path: '.ts-quality/witnesses/**/*.receipt.json', reason: 'execution receipt sidecars; witness JSON is the reusable evidence record', status: 'pattern' },
    ...(privateKeys.length > 0
      ? privateKeys.map((relativePath) => retentionEntry(rootDir, relativePath, 'private signing key material; commit only matching *.pub.pem public keys'))
      : [{ path: `${publicKeyDir}/<key-id>.pem`, reason: 'private signing key material; commit only matching *.pub.pem public keys', status: 'pattern' as const }])
  ];
  const warnings = [
    ...(configError ? [`config not loaded: ${configError}`] : []),
    ...privateKeys.map((relativePath) => `private key material should not be committed: ${relativePath}`)
  ];
  return {
    surface: 'ts-quality.artifact-retention',
    schemaVersion: 1,
    rootDir,
    config: loaded ? { loaded: true, path: relativeToRoot(rootDir, loaded.configPath) } : { loaded: false, ...(configError ? { error: configError } : {}) },
    keep,
    ignore,
    warnings
  };
}
export function renderArtifactRetentionPlan(rootDir: string, options?: { configPath?: string }): string {
  const plan = buildArtifactRetentionPlan(rootDir, options);
  const lines = [
    'ts-quality artifact retention plan',
    `root: ${plan.rootDir}`,
    `config: ${plan.config.loaded ? plan.config.path : `not loaded (${plan.config.error ?? 'missing'})`}`,
    '',
    'Commit/review reusable artifacts:',
    ...plan.keep.map((entry) => `- [${entry.status ?? 'pattern'}] ${entry.path} — ${entry.reason}`),
    '',
    'Keep ephemeral/generated artifacts out of commits unless deliberately snapshotting reviewed examples:',
    ...plan.ignore.map((entry) => `- [${entry.status ?? 'pattern'}] ${entry.path} — ${entry.reason}`),
    ...(plan.warnings.length > 0 ? ['', 'Warnings:', ...plan.warnings.map((warning) => `- ${warning}`)] : [])
  ];
  return `${lines.join('\n')}\n`;
}
export function renderArtifactRetentionPlanMachine(rootDir: string, options?: { configPath?: string }): string {
  const plan = buildArtifactRetentionPlan(rootDir, options);
  const lines = [
    'TSQ_RETENTION_PLAN_V1',
    `root\t${machineValue(plan.rootDir)}`,
    plan.config.loaded
      ? `config\tok\tpath=${machineValue(plan.config.path ?? '')}`
      : `config\terror\tmessage=${machineValue(plan.config.error ?? 'missing')}`,
    ...plan.keep.map((entry) => `keep\t${machineValue(entry.status ?? 'pattern')}\t${machineValue(entry.path)}\treason=${machineValue(entry.reason)}`),
    ...plan.ignore.map((entry) => `ignore\t${machineValue(entry.status ?? 'pattern')}\t${machineValue(entry.path)}\treason=${machineValue(entry.reason)}`),
    ...plan.warnings.map((warning) => `warning\t${machineValue(warning)}`)
  ];
  return `${lines.join('\n')}\n`;
}
