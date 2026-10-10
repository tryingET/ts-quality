"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initProject = initProject;
exports.buildArtifactRetentionPlan = buildArtifactRetentionPlan;
exports.renderArtifactRetentionPlan = renderArtifactRetentionPlan;
exports.renderArtifactRetentionPlanMachine = renderArtifactRetentionPlanMachine;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../../evidence-model/src/index");
const index_2 = require("../../legitimacy/src/index");
const config_1 = require("./config");
const doctor_1 = require("./doctor");
const materialize_adopt_1 = require("./materialize-adopt");
function configArrayText(values) {
    return `[${values.map((value) => `'${value}'`).join(', ')}]`;
}
function initConfigText(preset, packageManager) {
    const jest = (0, doctor_1.packageManagerExec)(packageManager, 'jest');
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
    return `// ts-quality init preset: ${preset}\n// ${presetComment}\nexport default {\n  sourcePatterns: ${(0, index_1.stableStringify)([...index_1.DEFAULT_SOURCE_PATTERNS])},\n  testPatterns: ${(0, index_1.stableStringify)([...index_1.DEFAULT_TEST_PATTERNS])},\n  coverage: {\n    lcovPath: 'coverage/lcov.info',\n    // When lcovPath is missing, check can run this command after creating the parent directory.\n    ${coverageCommand}\n    generateTimeoutMs: 60000\n  },\n  mutations: { testCommand: ${mutationCommand}, coveredOnly: true, timeoutMs: 15000, maxSites: 25, runtimeMirrorRoots: ${runtimeMirrorRoots} },\n  policy: { maxChangedCrap: 30, minMutationScore: 0.8, minMergeConfidence: 70 },\n  // Provide --changed <a,b,c> or set changeSet.files / changeSet.diffFile before running check.\n  changeSet: { files: [] },\n  invariantsPath: '.ts-quality/invariants.ts',\n  constitutionPath: '.ts-quality/constitution.ts',\n  agentsPath: '.ts-quality/agents.ts'\n};\n`;
}
function initProject(rootDir, options) {
    (0, index_1.ensureDir)(path_1.default.join(rootDir, '.ts-quality', 'attestations'));
    (0, index_1.ensureDir)(path_1.default.join(rootDir, '.ts-quality', 'keys'));
    (0, index_1.ensureDir)(path_1.default.join(rootDir, '.ts-quality', 'witnesses'));
    const preset = options?.preset ?? 'default';
    const configPath = path_1.default.join(rootDir, 'ts-quality.config.ts');
    if (!fs_1.default.existsSync(configPath)) {
        fs_1.default.writeFileSync(configPath, initConfigText(preset, (0, doctor_1.readPackageManager)(rootDir)), 'utf8');
    }
    const invariantsPath = path_1.default.join(rootDir, '.ts-quality', 'invariants.ts');
    if (!fs_1.default.existsSync(invariantsPath)) {
        fs_1.default.writeFileSync(invariantsPath, `// First-invariant habit: replace this sample with one behavior-bearing source path,
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
    const witnessReadmePath = path_1.default.join(rootDir, '.ts-quality', 'witnesses', 'README.md');
    if (!fs_1.default.existsSync(witnessReadmePath)) {
        fs_1.default.writeFileSync(witnessReadmePath, `# ts-quality witnesses

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
    const constitutionPath = path_1.default.join(rootDir, '.ts-quality', 'constitution.ts');
    if (!fs_1.default.existsSync(constitutionPath)) {
        fs_1.default.writeFileSync(constitutionPath, `export default [\n  { kind: 'risk', id: 'default-risk', paths: ['src/**'], message: 'Changed source must stay within risk budgets.', maxCrap: 30, minMutationScore: 0.8, minMergeConfidence: 70 },\n  { kind: 'approval', id: 'payments-review', paths: ['src/payments/**'], message: 'Payments changes require a maintainer approval.', minApprovals: 1, roles: ['maintainer'] }\n];\n`, 'utf8');
    }
    const agentsPath = path_1.default.join(rootDir, '.ts-quality', 'agents.ts');
    if (!fs_1.default.existsSync(agentsPath)) {
        fs_1.default.writeFileSync(agentsPath, `export default [\n  { id: 'maintainer', kind: 'human', roles: ['maintainer'], grants: [{ id: 'maintainer-merge', actions: ['merge', 'override', 'amend'], paths: ['src/**'], minMergeConfidence: 60 }] },\n  { id: 'release-bot', kind: 'automation', roles: ['ci'], grants: [{ id: 'release-bot-merge', actions: ['merge'], paths: ['src/**'], minMergeConfidence: 80, requireAttestations: ['ci.tests.passed'], requireHumanReview: true }] }\n];\n`, 'utf8');
    }
    for (const fileName of ['waivers.json', 'approvals.json', 'overrides.json']) {
        const filePath = path_1.default.join(rootDir, '.ts-quality', fileName);
        if (!fs_1.default.existsSync(filePath)) {
            fs_1.default.writeFileSync(filePath, '[]\n', 'utf8');
        }
    }
    const keyBase = path_1.default.join(rootDir, '.ts-quality', 'keys', 'sample');
    if (!fs_1.default.existsSync(`${keyBase}.pem`) || !fs_1.default.existsSync(`${keyBase}.pub.pem`)) {
        const pair = (0, index_2.generateKeyPair)();
        fs_1.default.writeFileSync(`${keyBase}.pem`, pair.privateKeyPem, 'utf8');
        fs_1.default.writeFileSync(`${keyBase}.pub.pem`, pair.publicKeyPem, 'utf8');
    }
}
function repoFileStatus(rootDir, relativePath) {
    try {
        const resolved = (0, index_1.resolveRepoLocalPath)(rootDir, relativePath, { allowMissing: true, kind: 'retention path' });
        return fs_1.default.existsSync(resolved.absolutePath) ? 'present' : 'missing';
    }
    catch {
        return 'missing';
    }
}
function retentionEntry(rootDir, relativePath, reason) {
    return { path: (0, index_1.normalizePath)(relativePath), reason, status: repoFileStatus(rootDir, relativePath) };
}
function listRetentionFiles(rootDir, relativeDir, predicate) {
    const directory = (0, index_1.resolveRepoLocalPath)(rootDir, relativeDir, { allowMissing: true, kind: 'retention directory' }).absolutePath;
    const output = [];
    function visit(currentDir) {
        for (const entry of fs_1.default.readdirSync(currentDir, { withFileTypes: true })) {
            const absolutePath = path_1.default.join(currentDir, entry.name);
            const relativePath = (0, index_1.normalizePath)(path_1.default.relative(rootDir, absolutePath));
            if (entry.isDirectory()) {
                visit(absolutePath);
                continue;
            }
            if (entry.isFile() && predicate(relativePath)) {
                output.push(relativePath);
            }
        }
    }
    if (fs_1.default.existsSync(directory) && fs_1.default.statSync(directory).isDirectory()) {
        visit(directory);
    }
    return output.sort();
}
function buildArtifactRetentionPlan(rootDir, options) {
    let loaded;
    let configError;
    try {
        loaded = (0, config_1.loadContext)(rootDir, options?.configPath);
    }
    catch (error) {
        configError = error instanceof Error ? error.message : String(error);
    }
    const keep = [];
    if (loaded) {
        keep.push(retentionEntry(rootDir, (0, materialize_adopt_1.relativeToRoot)(rootDir, loaded.configPath), 'ts-quality configuration'));
        keep.push(retentionEntry(rootDir, loaded.config.invariantsPath, 'invariant definitions'));
        keep.push(retentionEntry(rootDir, loaded.config.constitutionPath, 'constitution rules'));
        keep.push(retentionEntry(rootDir, loaded.config.agentsPath, 'agent policy'));
        keep.push(retentionEntry(rootDir, loaded.config.approvalsPath, 'repo-local approvals'));
        keep.push(retentionEntry(rootDir, loaded.config.waiversPath, 'repo-local waivers'));
        keep.push(retentionEntry(rootDir, loaded.config.overridesPath, 'repo-local overrides'));
    }
    else {
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
    const ignore = [
        { path: '.ts-quality/runs/', reason: 'generated immutable run bundles; snapshot deliberately only for reviewed examples', status: 'pattern' },
        { path: '.ts-quality/latest.json', reason: 'ambient pointer to latest run, not durable authority', status: repoFileStatus(rootDir, '.ts-quality/latest.json') },
        { path: '.ts-quality/mutation-manifest.json', reason: 'generated mutation execution scratch artifact', status: repoFileStatus(rootDir, '.ts-quality/mutation-manifest.json') },
        { path: '.ts-quality/package-index.json', reason: 'generated package artifact-reference index; regenerate it, or upload it with its upload.paths, instead of committing it', status: repoFileStatus(rootDir, '.ts-quality/package-index.json') },
        { path: coveragePath, reason: 'generated LCOV output', status: repoFileStatus(rootDir, coveragePath) },
        { path: '.ts-quality/witnesses/**/*.receipt.json', reason: 'execution receipt sidecars; witness JSON is the reusable evidence record', status: 'pattern' },
        ...(privateKeys.length > 0
            ? privateKeys.map((relativePath) => retentionEntry(rootDir, relativePath, 'private signing key material; commit only matching *.pub.pem public keys'))
            : [{ path: `${publicKeyDir}/<key-id>.pem`, reason: 'private signing key material; commit only matching *.pub.pem public keys', status: 'pattern' }])
    ];
    const warnings = [
        ...(configError ? [`config not loaded: ${configError}`] : []),
        ...privateKeys.map((relativePath) => `private key material should not be committed: ${relativePath}`)
    ];
    return {
        surface: 'ts-quality.artifact-retention',
        schemaVersion: 1,
        rootDir,
        config: loaded ? { loaded: true, path: (0, materialize_adopt_1.relativeToRoot)(rootDir, loaded.configPath) } : { loaded: false, ...(configError ? { error: configError } : {}) },
        keep,
        ignore,
        warnings
    };
}
function renderArtifactRetentionPlan(rootDir, options) {
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
function renderArtifactRetentionPlanMachine(rootDir, options) {
    const plan = buildArtifactRetentionPlan(rootDir, options);
    const lines = [
        'TSQ_RETENTION_PLAN_V1',
        `root\t${(0, doctor_1.machineValue)(plan.rootDir)}`,
        plan.config.loaded
            ? `config\tok\tpath=${(0, doctor_1.machineValue)(plan.config.path ?? '')}`
            : `config\terror\tmessage=${(0, doctor_1.machineValue)(plan.config.error ?? 'missing')}`,
        ...plan.keep.map((entry) => `keep\t${(0, doctor_1.machineValue)(entry.status ?? 'pattern')}\t${(0, doctor_1.machineValue)(entry.path)}\treason=${(0, doctor_1.machineValue)(entry.reason)}`),
        ...plan.ignore.map((entry) => `ignore\t${(0, doctor_1.machineValue)(entry.status ?? 'pattern')}\t${(0, doctor_1.machineValue)(entry.path)}\treason=${(0, doctor_1.machineValue)(entry.reason)}`),
        ...plan.warnings.map((warning) => `warning\t${(0, doctor_1.machineValue)(warning)}`)
    ];
    return `${lines.join('\n')}\n`;
}
//# sourceMappingURL=init-retention.js.map