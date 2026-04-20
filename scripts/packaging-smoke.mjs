import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { assertPackedTarballFileSetContract, assertStagedPackageFileBoundaryContract, assertStagedPackageManifestContract } from './pack-ts-quality.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '..');

const expectedInitFiles = [
  'ts-quality.config.ts',
  '.ts-quality/invariants.ts',
  '.ts-quality/constitution.ts',
  '.ts-quality/agents.ts',
  '.ts-quality/approvals.json',
  '.ts-quality/waivers.json',
  '.ts-quality/overrides.json',
  '.ts-quality/keys/sample.pem',
  '.ts-quality/keys/sample.pub.pem'
];

const expectedMaterializedFiles = [
  '.ts-quality/materialized/invariants.json',
  '.ts-quality/materialized/constitution.json',
  '.ts-quality/materialized/agents.json',
  '.ts-quality/materialized/approvals.json',
  '.ts-quality/materialized/waivers.json',
  '.ts-quality/materialized/overrides.json',
  '.ts-quality/materialized/ts-quality.config.json'
];

const reviewFixtureName = 'governed-app';
const reviewRunId = 'packaging-installed-review-run';
const reviewTrendRunId = 'packaging-installed-review-trend-run';
const reviewMaterializedSourceRunId = 'packaging-installed-materialized-source-run';
const reviewMaterializedRunId = 'packaging-installed-materialized-config-run';
const keygenRunId = 'packaging-installed-keygen-run';
const keygenOutDir = '.ts-quality/generated-keys';
const keygenKeyId = 'packaging-generated';
const keygenAttestationPath = '.ts-quality/attestations/generated-key.json';
const reviewProposalId = 'packaging-installed-amendment';
const expectedReviewRunArtifacts = [
  '.ts-quality/runs/packaging-installed-review-run/run.json',
  '.ts-quality/runs/packaging-installed-review-run/verdict.json',
  '.ts-quality/runs/packaging-installed-review-run/report.md',
  '.ts-quality/runs/packaging-installed-review-run/pr-summary.md',
  '.ts-quality/runs/packaging-installed-review-run/check-summary.txt',
  '.ts-quality/runs/packaging-installed-review-run/explain.txt',
  '.ts-quality/runs/packaging-installed-review-run/plan.txt',
  '.ts-quality/runs/packaging-installed-review-run/govern.txt',
  '.ts-quality/runs/packaging-installed-review-run/attestation-verify.txt'
];

function resetRuntimeState(rootDir) {
  for (const runtimeRoot of [
    path.join(rootDir, '.ts-quality', 'attestations'),
    path.join(rootDir, '.ts-quality', 'materialized'),
    path.join(rootDir, '.ts-quality', 'runs'),
    path.join(rootDir, '.ts-quality', 'tmp-mutants')
  ]) {
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
  }
  for (const runtimeFile of [
    path.join(rootDir, '.ts-quality', 'latest.json'),
    path.join(rootDir, '.ts-quality', 'mutation-manifest.json')
  ]) {
    fs.rmSync(runtimeFile, { force: true });
  }
}

function prepareInstalledReviewProject(baseDir, projectDirName = 'review-project') {
  const source = path.join(root, 'fixtures', reviewFixtureName);
  const target = path.join(baseDir, projectDirName);
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
  resetRuntimeState(target);
  return target;
}

function writeInstalledReviewProposal(rootDir) {
  const proposalPath = path.join(rootDir, 'proposal.json');
  fs.writeFileSync(proposalPath, `${JSON.stringify({
    id: reviewProposalId,
    title: 'Installed package amendment smoke',
    rationale: 'Exercise the shipped amendment surface from an installed package.',
    evidence: ['packaged amendment path exercised'],
    changes: [{
      action: 'replace',
      ruleId: 'auth-risk-budget',
      rule: {
        kind: 'risk',
        id: 'auth-risk-budget',
        paths: ['src/auth/**'],
        message: 'Adjusted during packaging smoke.',
        maxCrap: 20,
        minMutationScore: 0.7,
        minMergeConfidence: 60
      }
    }],
    approvals: [
      {
        by: 'maintainer',
        role: 'maintainer',
        rationale: 'packaging smoke approval',
        createdAt: '2026-01-01T00:15:00.000Z',
        targetId: reviewProposalId
      },
      {
        by: 'maintainer',
        role: 'maintainer',
        rationale: 'duplicate packaging smoke approval',
        createdAt: '2026-01-01T00:15:00.000Z',
        targetId: reviewProposalId
      }
    ]
  }, null, 2)}
`, 'utf8');
  return proposalPath;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} is missing: ${filePath}`);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizePackageRelative(relativePath) {
  return relativePath.replace(/^\.\//u, '');
}

function installedBinPath(baseDir, binName) {
  return path.join(baseDir, 'node_modules', '.bin', process.platform === 'win32' ? `${binName}.cmd` : binName);
}

function ensureRelativeFiles(baseDir, relativePaths, label) {
  for (const relativePath of relativePaths) {
    ensureFile(path.join(baseDir, relativePath), `${label} file`);
  }
}

function normalizeText(text) {
  return text.replace(/\r\n/g, '\n').trim();
}

function assertOutputMatchesArtifact(commandOutput, artifactPath, label) {
  const normalizedOutput = normalizeText(commandOutput);
  const normalizedArtifact = normalizeText(fs.readFileSync(artifactPath, 'utf8'));
  if (normalizedOutput !== normalizedArtifact) {
    throw new Error(`Installed ${label} output drifted from persisted artifact.\nexpected:\n${normalizedArtifact}\nactual:\n${normalizedOutput}`);
  }
}

function assertTextIncludes(text, label, fragments) {
  for (const fragment of fragments) {
    if (!text.includes(fragment)) {
      throw new Error(`Installed ${label} text is missing expected fragment '${fragment}':\n${text}`);
    }
  }
}

export function runPackagingSmoke() {
  const packSummary = JSON.parse(run('node', ['scripts/pack-ts-quality.mjs'], root));
  const tarballPath = path.join(root, packSummary.tarball);
  const stageDirPath = path.join(root, packSummary.stageDir);
  const packageJsonPath = path.join(root, packSummary.packageJson);

  ensureFile(stageDirPath, 'Staged package directory');
  ensureFile(packageJsonPath, 'Staged package manifest');
  ensureFile(tarballPath, 'Packed tarball');

  const stagedPackage = readJson(packageJsonPath);
  const workspacePackage = readJson(path.join(root, 'package.json'));
  const publicPackage = readJson(path.join(root, 'packages', 'ts-quality', 'package.json'));
  if (stagedPackage.name !== packSummary.packageName) {
    throw new Error(`Staged package name drifted: expected ${packSummary.packageName}, got ${stagedPackage.name}`);
  }
  if (stagedPackage.version !== packSummary.version) {
    throw new Error(`Staged package version drifted: expected ${packSummary.version}, got ${stagedPackage.version}`);
  }
  assertStagedPackageManifestContract(stagedPackage, publicPackage, workspacePackage);
  const stagedBoundary = assertStagedPackageFileBoundaryContract(stageDirPath);
  const tarballBoundary = assertPackedTarballFileSetContract(tarballPath);

  for (const [label, relativePath] of Object.entries(packSummary.entrypoints)) {
    ensureFile(path.join(stageDirPath, normalizePackageRelative(relativePath)), `Staged ${label} entrypoint`);
  }

  const scratchRoot = path.join(root, '.ts-quality', 'tmp');
  fs.mkdirSync(scratchRoot, { recursive: true });
  const installRoot = fs.mkdtempSync(path.join(scratchRoot, 'tsq-packaging-smoke-'));
  try {
    fs.writeFileSync(path.join(installRoot, 'package.json'), `${JSON.stringify({ name: 'ts-quality-packaging-smoke', private: true }, null, 2)}\n`, 'utf8');
    run('npm', ['install', tarballPath, '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'], installRoot);

    const installedPackageDir = path.join(installRoot, 'node_modules', packSummary.packageName);
    const installedPackageJsonPath = path.join(installedPackageDir, 'package.json');
    const installedCliBinPath = installedBinPath(installRoot, 'ts-quality');
    const installedTscBinPath = installedBinPath(installRoot, 'tsc');
    ensureFile(installedPackageJsonPath, 'Installed package manifest');
    const installedPackage = JSON.parse(fs.readFileSync(installedPackageJsonPath, 'utf8'));
    ensureFile(installedCliBinPath, 'Installed ts-quality bin');
    ensureFile(installedTscBinPath, 'Installed tsc bin');

    if (installedPackage.main !== packSummary.entrypoints.main) {
      throw new Error(`Installed main entrypoint drifted: expected ${packSummary.entrypoints.main}, got ${installedPackage.main}`);
    }
    if (installedPackage.types !== packSummary.entrypoints.types) {
      throw new Error(`Installed types entrypoint drifted: expected ${packSummary.entrypoints.types}, got ${installedPackage.types}`);
    }
    if (installedPackage.bin?.['ts-quality'] !== packSummary.entrypoints.bin) {
      throw new Error(`Installed CLI entrypoint drifted: expected ${packSummary.entrypoints.bin}, got ${installedPackage.bin?.['ts-quality']}`);
    }
    if (installedPackage.exports?.['.']?.default !== packSummary.entrypoints.exportDefault) {
      throw new Error(`Installed default export entrypoint drifted: expected ${packSummary.entrypoints.exportDefault}, got ${installedPackage.exports?.['.']?.default}`);
    }
    if (installedPackage.exports?.['.']?.types !== packSummary.entrypoints.exportTypes) {
      throw new Error(`Installed export types entrypoint drifted: expected ${packSummary.entrypoints.exportTypes}, got ${installedPackage.exports?.['.']?.types}`);
    }

    for (const [label, relativePath] of Object.entries(packSummary.entrypoints)) {
      ensureFile(path.join(installedPackageDir, normalizePackageRelative(relativePath)), `Installed ${label} entrypoint`);
    }

    const cliHelp = run(installedCliBinPath, ['--help'], installRoot);
    if (!cliHelp.includes('ts-quality commands:')) {
      throw new Error(`Unexpected ts-quality --help output:\n${cliHelp}`);
    }

    const cliProjectRoot = path.join(installRoot, 'cli-project');
    fs.mkdirSync(cliProjectRoot, { recursive: true });
    const cliInit = run(installedCliBinPath, ['init', '--root', cliProjectRoot], installRoot);
    if (!cliInit.includes(`Initialized ts-quality in ${cliProjectRoot}`)) {
      throw new Error(`Unexpected ts-quality init output:\n${cliInit}`);
    }
    ensureRelativeFiles(cliProjectRoot, expectedInitFiles, 'CLI init');

    const cliMaterialize = run(installedCliBinPath, ['materialize', '--root', cliProjectRoot], installRoot);
    if (!cliMaterialize.includes('Materialized runtime config: .ts-quality/materialized/ts-quality.config.json')) {
      throw new Error(`Unexpected ts-quality materialize output:\n${cliMaterialize}`);
    }
    ensureRelativeFiles(cliProjectRoot, expectedMaterializedFiles, 'CLI materialize');

    const keygenProjectRoot = prepareInstalledReviewProject(installRoot, 'keygen-project');
    run(installedCliBinPath, ['check', '--root', keygenProjectRoot, '--run-id', keygenRunId], installRoot);
    const keygenPrivateKeyPath = path.join(keygenProjectRoot, keygenOutDir, `${keygenKeyId}.pem`);
    const keygenPublicKeyPath = path.join(keygenProjectRoot, keygenOutDir, `${keygenKeyId}.pub.pem`);
    const keygenText = run(installedCliBinPath, ['attest', 'keygen', '--root', keygenProjectRoot, '--out-dir', keygenOutDir, '--key-id', keygenKeyId], installRoot);
    if (normalizeText(keygenText) !== normalizeText(`${keygenPrivateKeyPath}\n${keygenPublicKeyPath}`)) {
      throw new Error(`Unexpected ts-quality attest keygen output from installed package:\n${keygenText}`);
    }
    ensureFile(keygenPrivateKeyPath, 'Installed generated private key');
    ensureFile(keygenPublicKeyPath, 'Installed generated public key');
    run(installedCliBinPath, [
      'attest',
      'sign',
      '--root', keygenProjectRoot,
      '--issuer', 'ci.generated',
      '--key-id', keygenKeyId,
      '--private-key', `${keygenOutDir}/${keygenKeyId}.pem`,
      '--subject', `.ts-quality/runs/${keygenRunId}/verdict.json`,
      '--claims', 'ci.tests.passed',
      '--out', keygenAttestationPath
    ], installRoot);
    const keygenVerifyText = run(installedCliBinPath, [
      'attest',
      'verify',
      '--root', keygenProjectRoot,
      '--attestation', keygenAttestationPath,
      '--trusted-keys', keygenOutDir
    ], installRoot);
    if (!keygenVerifyText.includes('ci.generated: verified (verified)')) {
      throw new Error(`Unexpected ts-quality attest verify output for installed generated keys:\n${keygenVerifyText}`);
    }

    const apiProjectRoot = path.join(installRoot, 'api-project');
    fs.mkdirSync(apiProjectRoot, { recursive: true });
    const apiScript = [
      "const { initProject, materializeProject } = require('ts-quality');",
      'const root = process.argv[1];',
      'initProject(root);',
      'const result = materializeProject(root);',
      'process.stdout.write(JSON.stringify({ exportTypes: { initProject: typeof initProject, materializeProject: typeof materializeProject }, result }, null, 2));'
    ].join('\n');
    const apiSummary = JSON.parse(run('node', ['-e', apiScript, apiProjectRoot], installRoot));
    if (apiSummary.exportTypes?.initProject !== 'function') {
      throw new Error(`Expected initProject export to be a function, got: ${apiSummary.exportTypes?.initProject}`);
    }
    if (apiSummary.exportTypes?.materializeProject !== 'function') {
      throw new Error(`Expected materializeProject export to be a function, got: ${apiSummary.exportTypes?.materializeProject}`);
    }
    ensureRelativeFiles(apiProjectRoot, expectedInitFiles, 'API init');
    ensureRelativeFiles(apiProjectRoot, expectedMaterializedFiles, 'API materialize');

    const typeSmokePath = path.join(installRoot, 'api-smoke.ts');
    fs.writeFileSync(typeSmokePath, [
      "import { initProject, materializeProject } from 'ts-quality';",
      'const initCheck: typeof initProject = initProject;',
      'const materializeCheck: typeof materializeProject = materializeProject;',
      'console.log(typeof initCheck, typeof materializeCheck);'
    ].join('\n'), 'utf8');
    run(installedTscBinPath, ['--module', 'commonjs', '--moduleResolution', 'node', '--target', 'ES2022', '--esModuleInterop', '--noEmit', path.basename(typeSmokePath)], installRoot);

    const reviewProjectRoot = prepareInstalledReviewProject(installRoot);
    run(installedCliBinPath, ['check', '--root', reviewProjectRoot, '--run-id', reviewRunId], installRoot);
    ensureRelativeFiles(reviewProjectRoot, expectedReviewRunArtifacts, 'Installed review flow');

    const reportArtifactPath = path.join(reviewProjectRoot, '.ts-quality', 'runs', reviewRunId, 'report.md');
    const explainArtifactPath = path.join(reviewProjectRoot, '.ts-quality', 'runs', reviewRunId, 'explain.txt');
    const planArtifactPath = path.join(reviewProjectRoot, '.ts-quality', 'runs', reviewRunId, 'plan.txt');

    const reportText = run(installedCliBinPath, ['report', '--root', reviewProjectRoot], installRoot);
    assertOutputMatchesArtifact(reportText, reportArtifactPath, 'report');
    assertTextIncludes(reportText, 'report', ['# ts-quality report']);

    const explainText = run(installedCliBinPath, ['explain', '--root', reviewProjectRoot], installRoot);
    assertOutputMatchesArtifact(explainText, explainArtifactPath, 'explain');
    assertTextIncludes(explainText, 'explain', ['Reasons:']);

    const planText = run(installedCliBinPath, ['plan', '--root', reviewProjectRoot], installRoot);
    assertTextIncludes(planText, 'plan', [
      'Invariant evidence at risk: auth.refresh.validity',
      '1. Tighten tests around surviving mutants'
    ]);
    assertTextIncludes(fs.readFileSync(planArtifactPath, 'utf8'), 'plan artifact', [
      'Invariant evidence at risk: auth.refresh.validity',
      '1. [test] Tighten tests around surviving mutants'
    ]);

    const governText = run(installedCliBinPath, ['govern', '--root', reviewProjectRoot], installRoot);
    if (!governText.includes('auth-risk-budget')) {
      throw new Error(`Unexpected ts-quality govern output from installed package:\n${governText}`);
    }

    run(installedCliBinPath, [
      'attest',
      'sign',
      '--root', reviewProjectRoot,
      '--issuer', 'ci.verify',
      '--key-id', 'sample',
      '--private-key', '.ts-quality/keys/sample.pem',
      '--subject', `.ts-quality/runs/${reviewRunId}/verdict.json`,
      '--claims', 'ci.tests.passed',
      '--out', '.ts-quality/attestations/ci.tests.passed.json'
    ], installRoot);
    const verifyText = run(installedCliBinPath, [
      'attest',
      'verify',
      '--root', reviewProjectRoot,
      '--attestation', '.ts-quality/attestations/ci.tests.passed.json',
      '--trusted-keys', '.ts-quality/keys'
    ], installRoot);
    if (!verifyText.includes('ci.verify: verified (verified)')) {
      throw new Error(`Unexpected ts-quality attest verify output from installed package:\n${verifyText}`);
    }

    run(installedCliBinPath, ['check', '--root', reviewProjectRoot, '--run-id', reviewRunId], installRoot);
    const runtimeAttestationVerify = fs.readFileSync(path.join(reviewProjectRoot, '.ts-quality', 'runs', reviewRunId, 'attestation-verify.txt'), 'utf8').trim();
    if (runtimeAttestationVerify !== verifyText) {
      throw new Error(`Run-bound attestation verification drifted from CLI verify output.\nexpected:\n${verifyText}\nactual:\n${runtimeAttestationVerify}`);
    }

    const releaseBotDeniedDecision = JSON.parse(run(installedCliBinPath, ['authorize', '--root', reviewProjectRoot, '--agent', 'release-bot'], installRoot));
    if (releaseBotDeniedDecision.outcome !== 'deny') {
      throw new Error(`Expected release-bot authorization without override to deny, got:\n${JSON.stringify(releaseBotDeniedDecision, null, 2)}`);
    }
    if ((releaseBotDeniedDecision.evidenceContext?.attestationVerification?.verifiedCount ?? 0) !== 1) {
      throw new Error(`Expected release-bot denial to keep one verified attestation, got:\n${JSON.stringify(releaseBotDeniedDecision, null, 2)}`);
    }
    if ((releaseBotDeniedDecision.missingProof ?? []).length !== 0) {
      throw new Error(`Expected release-bot denial to have no missing proof after attestation, got:\n${JSON.stringify(releaseBotDeniedDecision, null, 2)}`);
    }

    const overridesPath = path.join(reviewProjectRoot, '.ts-quality', 'overrides.json');
    fs.writeFileSync(overridesPath, `${JSON.stringify([
      {
        kind: 'override',
        by: 'maintainer',
        role: 'maintainer',
        rationale: 'Installed packaging smoke override.',
        createdAt: '2026-01-01T00:10:00.000Z',
        targetId: `${reviewRunId}:maintainer:merge`
      },
      {
        kind: 'override',
        by: 'maintainer',
        role: 'maintainer',
        rationale: 'Installed packaging smoke release-bot override.',
        createdAt: '2026-01-01T00:11:00.000Z',
        targetId: `${reviewRunId}:release-bot:merge`
      }
    ], null, 2)}
`, 'utf8');
    const authorizeDecision = JSON.parse(run(installedCliBinPath, ['authorize', '--root', reviewProjectRoot, '--agent', 'maintainer'], installRoot));
    if (authorizeDecision.outcome !== 'approve') {
      throw new Error(`Unexpected ts-quality authorize output from installed package:\n${JSON.stringify(authorizeDecision, null, 2)}`);
    }
    const releaseBotAuthorizeDecision = JSON.parse(run(installedCliBinPath, ['authorize', '--root', reviewProjectRoot, '--agent', 'release-bot'], installRoot));
    if (releaseBotAuthorizeDecision.outcome !== 'approve') {
      throw new Error(`Unexpected ts-quality release-bot authorize output from installed package:\n${JSON.stringify(releaseBotAuthorizeDecision, null, 2)}`);
    }
    if (releaseBotAuthorizeDecision.overrideUsed !== 'maintainer') {
      throw new Error(`Expected release-bot authorization to use maintainer override, got:\n${JSON.stringify(releaseBotAuthorizeDecision, null, 2)}`);
    }
    ensureFile(path.join(reviewProjectRoot, '.ts-quality', 'runs', reviewRunId, 'bundle.release-bot.merge.json'), 'Installed release-bot bundle');

    writeInstalledReviewProposal(reviewProjectRoot);
    const amendDecision = JSON.parse(run(installedCliBinPath, ['amend', '--root', reviewProjectRoot, '--proposal', 'proposal.json'], installRoot));
    const amendTextPath = path.join(reviewProjectRoot, '.ts-quality', 'amendments', `${reviewProposalId}.result.txt`);
    ensureFile(path.join(reviewProjectRoot, '.ts-quality', 'amendments', `${reviewProposalId}.result.json`), 'Installed amendment decision');
    ensureFile(amendTextPath, 'Installed amendment text summary');

    run(installedCliBinPath, ['check', '--root', reviewProjectRoot, '--run-id', reviewTrendRunId], installRoot);
    const trendText = run(installedCliBinPath, ['trend', '--root', reviewProjectRoot], installRoot);
    assertTextIncludes(trendText, 'trend', [
      `Current run: ${reviewTrendRunId}`,
      `Previous run: ${reviewRunId}`,
      'Invariant evidence at risk: auth.refresh.validity',
      'Evidence provenance: explicit 3, inferred 1, missing 1',
      'scenario-support [missing; mode=missing]: 0/1 scenario(s) have deterministic support'
    ]);
    if (!/Merge confidence delta: -?\d+/u.test(trendText)) {
      throw new Error(`Installed trend output is missing a merge confidence delta:\n${trendText}`);
    }
    if (/^Obligation:/mu.test(trendText)) {
      throw new Error(`Installed trend output should not include obligations:\n${trendText}`);
    }

    const materializedReviewProjectRoot = prepareInstalledReviewProject(installRoot, 'materialized-review-project');
    const materializedConfigPath = '.ts-quality/materialized/ts-quality.config.json';
    const materializedReviewMaterialize = run(installedCliBinPath, ['materialize', '--root', materializedReviewProjectRoot], installRoot);
    if (!materializedReviewMaterialize.includes(`Materialized runtime config: ${materializedConfigPath}`)) {
      throw new Error(`Unexpected installed review materialize output:\n${materializedReviewMaterialize}`);
    }
    ensureRelativeFiles(materializedReviewProjectRoot, expectedMaterializedFiles, 'Installed review materialize');

    run(installedCliBinPath, ['check', '--root', materializedReviewProjectRoot, '--run-id', reviewMaterializedSourceRunId], installRoot);
    run(installedCliBinPath, ['check', '--root', materializedReviewProjectRoot, '--config', materializedConfigPath, '--run-id', reviewMaterializedRunId], installRoot);

    const materializedRunPath = path.join(materializedReviewProjectRoot, '.ts-quality', 'runs', reviewMaterializedRunId, 'run.json');
    const materializedGovernArtifactPath = path.join(materializedReviewProjectRoot, '.ts-quality', 'runs', reviewMaterializedRunId, 'govern.txt');
    ensureFile(materializedRunPath, 'Installed materialized-config run');
    ensureFile(materializedGovernArtifactPath, 'Installed materialized-config govern artifact');

    const materializedSourceRun = readJson(path.join(materializedReviewProjectRoot, '.ts-quality', 'runs', reviewMaterializedSourceRunId, 'run.json'));
    const materializedRun = readJson(materializedRunPath);
    if (materializedRun.verdict?.mergeConfidence !== materializedSourceRun.verdict?.mergeConfidence) {
      throw new Error(`Installed materialized-config merge confidence drifted from source config. expected ${materializedSourceRun.verdict?.mergeConfidence}, got ${materializedRun.verdict?.mergeConfidence}`);
    }
    if (materializedRun.verdict?.outcome !== materializedSourceRun.verdict?.outcome) {
      throw new Error(`Installed materialized-config outcome drifted from source config. expected ${materializedSourceRun.verdict?.outcome}, got ${materializedRun.verdict?.outcome}`);
    }
    if (JSON.stringify(materializedRun.changedFiles) !== JSON.stringify(materializedSourceRun.changedFiles)) {
      throw new Error(`Installed materialized-config changed files drifted from source config.\nexpected: ${JSON.stringify(materializedSourceRun.changedFiles)}\nactual: ${JSON.stringify(materializedRun.changedFiles)}`);
    }
    const materializedGovernanceSummary = materializedRun.governance.map(({ ruleId, message }) => ({ ruleId, message }));
    const materializedSourceGovernanceSummary = materializedSourceRun.governance.map(({ ruleId, message }) => ({ ruleId, message }));
    if (JSON.stringify(materializedGovernanceSummary) !== JSON.stringify(materializedSourceGovernanceSummary)) {
      throw new Error(`Installed materialized-config governance drifted from source config.\nexpected: ${JSON.stringify(materializedSourceGovernanceSummary)}\nactual: ${JSON.stringify(materializedGovernanceSummary)}`);
    }
    if (materializedRun.analysis?.configPath !== materializedConfigPath) {
      throw new Error(`Installed materialized-config analysis path drifted. expected ${materializedConfigPath}, got ${materializedRun.analysis?.configPath}`);
    }
    if (materializedRun.controlPlane?.configPath !== materializedConfigPath) {
      throw new Error(`Installed materialized-config control-plane path drifted. expected ${materializedConfigPath}, got ${materializedRun.controlPlane?.configPath}`);
    }

    const materializedGovernText = run(installedCliBinPath, ['govern', '--root', materializedReviewProjectRoot, '--config', materializedConfigPath], installRoot);
    assertTextIncludes(materializedGovernText, 'materialized-config govern', [
      'auth-risk-budget',
      'Invariant evidence at risk: auth.refresh.validity'
    ]);

    return {
      packageName: packSummary.packageName,
      version: packSummary.version,
      stageDir: packSummary.stageDir,
      tarball: packSummary.tarball,
      entrypoints: packSummary.entrypoints,
      manifest: stagedPackage,
      topLevelEntries: stagedBoundary.topLevelEntries,
      directories: stagedBoundary.directories,
      stagedFiles: stagedBoundary.files,
      tarballFiles: tarballBoundary.files,
      cli: {
        helpIncludes: 'ts-quality commands:',
        initCreated: [...expectedInitFiles],
        materializedConfig: '.ts-quality/materialized/ts-quality.config.json',
        keygen: {
          runId: keygenRunId,
          outDir: keygenOutDir,
          keyId: keygenKeyId,
          stdoutMatchesAbsolutePaths: true,
          created: [
            `${keygenOutDir}/${keygenKeyId}.pem`,
            `${keygenOutDir}/${keygenKeyId}.pub.pem`
          ],
          attestationPath: keygenAttestationPath,
          verifiedIssuer: 'ci.generated'
        }
      },
      api: {
        exportTypes: apiSummary.exportTypes,
        materializeConfig: apiSummary.result?.configPath,
        materializeOutDir: apiSummary.result?.outDir,
        materializedFiles: apiSummary.result?.files
      },
      typesCheck: {
        compiler: 'tsc',
        passed: true,
        importStatement: "import { initProject, materializeProject } from 'ts-quality';"
      },
      reviewFlow: {
        fixture: reviewFixtureName,
        runId: reviewRunId,
        runArtifacts: [...expectedReviewRunArtifacts],
        report: {
          artifact: `.ts-quality/runs/${reviewRunId}/report.md`,
          stdoutMatchesArtifact: true,
          stdoutIncludes: ['# ts-quality report']
        },
        explain: {
          artifact: `.ts-quality/runs/${reviewRunId}/explain.txt`,
          stdoutMatchesArtifact: true,
          stdoutIncludes: ['Reasons:']
        },
        plan: {
          artifact: `.ts-quality/runs/${reviewRunId}/plan.txt`,
          stdoutIncludes: [
            'Invariant evidence at risk: auth.refresh.validity',
            '1. Tighten tests around surviving mutants'
          ],
          artifactIncludes: [
            'Invariant evidence at risk: auth.refresh.validity',
            '1. [test] Tighten tests around surviving mutants'
          ]
        },
        trend: {
          currentRun: reviewTrendRunId,
          previousRun: reviewRunId,
          stdoutIncludes: [
            `Current run: ${reviewTrendRunId}`,
            `Previous run: ${reviewRunId}`,
            'Invariant evidence at risk: auth.refresh.validity',
            'Evidence provenance: explicit 3, inferred 1, missing 1',
            'scenario-support [missing; mode=missing]: 0/1 scenario(s) have deterministic support'
          ],
          omitsObligation: true
        },
        materializedConfig: {
          configPath: materializedConfigPath,
          sourceRunId: reviewMaterializedSourceRunId,
          runId: reviewMaterializedRunId,
          analysisConfigPath: materializedRun.analysis?.configPath,
          controlPlaneConfigPath: materializedRun.controlPlane?.configPath,
          matchesSourceVerdict: true,
          matchesSourceChangedFiles: true,
          matchesSourceGovernance: true,
          governIncludes: [
            'auth-risk-budget',
            'Invariant evidence at risk: auth.refresh.validity'
          ]
        },
        governIncludes: 'auth-risk-budget',
        attestation: {
          subject: `.ts-quality/runs/${reviewRunId}/verdict.json`,
          runId: reviewRunId,
          artifact: 'verdict.json',
          verified: true
        },
        authorize: {
          agent: 'maintainer',
          outcome: authorizeDecision.outcome,
          overrideUsed: authorizeDecision.overrideUsed,
          runId: authorizeDecision.evidenceContext?.runId,
          bundlePath: authorizeDecision.evidenceContext?.artifactPaths?.bundle,
          verifiedAttestations: authorizeDecision.evidenceContext?.attestationVerification?.verifiedCount
        },
        releaseBotAuthorize: {
          deniedWithoutOverride: {
            outcome: releaseBotDeniedDecision.outcome,
            missingProof: releaseBotDeniedDecision.missingProof,
            verifiedAttestations: releaseBotDeniedDecision.evidenceContext?.attestationVerification?.verifiedCount,
            governIncludes: 'auth-risk-budget'
          },
          approved: {
            agent: 'release-bot',
            outcome: releaseBotAuthorizeDecision.outcome,
            overrideUsed: releaseBotAuthorizeDecision.overrideUsed,
            runId: releaseBotAuthorizeDecision.evidenceContext?.runId,
            bundlePath: releaseBotAuthorizeDecision.evidenceContext?.artifactPaths?.bundle,
            verifiedAttestations: releaseBotAuthorizeDecision.evidenceContext?.attestationVerification?.verifiedCount
          }
        },
        amend: {
          proposalId: amendDecision.proposalId,
          outcome: amendDecision.outcome,
          textArtifact: `.ts-quality/amendments/${reviewProposalId}.result.txt`
        }
      }
    };
  } finally {
    fs.rmSync(installRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  console.log(JSON.stringify(runPackagingSmoke(), null, 2));
}
