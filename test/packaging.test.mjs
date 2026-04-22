import fs from 'fs';
import path from 'path';
import test from 'node:test';
import assert from 'assert/strict';
import { spawnSync } from 'child_process';
import { repoRoot } from './helpers.mjs';

const expectedEntrypoints = {
  main: 'dist/packages/ts-quality/src/index.js',
  types: 'dist/packages/ts-quality/src/index.d.ts',
  bin: 'dist/packages/ts-quality/src/cli.js',
  exportDefault: './dist/packages/ts-quality/src/index.js',
  exportTypes: './dist/packages/ts-quality/src/index.d.ts'
};

const expectedManifestKeys = [
  'name',
  'version',
  'description',
  'license',
  'repository',
  'homepage',
  'bugs',
  'keywords',
  'dependencies',
  'engines',
  'main',
  'types',
  'exports',
  'bin',
  'files',
  'publishConfig'
];

const expectedTopLevelEntries = [
  'LICENSE',
  'README.md',
  'dist',
  'package.json'
].sort((left, right) => left.localeCompare(right));

const expectedStageRuntimeFilesByPackage = {
  crap4ts: [
    'src/cli.d.ts',
    'src/cli.js',
    'src/cli.js.map',
    'src/index.d.ts',
    'src/index.js',
    'src/index.js.map'
  ],
  'evidence-model': [
    'src/index.d.ts',
    'src/index.js',
    'src/index.js.map'
  ],
  governance: [
    'src/import-collector.d.ts',
    'src/import-collector.js',
    'src/import-collector.js.map',
    'src/import-provenance.d.ts',
    'src/import-provenance.js',
    'src/import-provenance.js.map',
    'src/index.d.ts',
    'src/index.js',
    'src/index.js.map'
  ],
  invariants: [
    'src/index.d.ts',
    'src/index.js',
    'src/index.js.map'
  ],
  legitimacy: [
    'src/index.d.ts',
    'src/index.js',
    'src/index.js.map'
  ],
  'policy-engine': [
    'src/index.d.ts',
    'src/index.js',
    'src/index.js.map'
  ],
  'ts-mutate': [
    'src/cli.d.ts',
    'src/cli.js',
    'src/cli.js.map',
    'src/index.d.ts',
    'src/index.js',
    'src/index.js.map'
  ],
  'ts-quality': [
    'src/cli.d.ts',
    'src/cli.js',
    'src/cli.js.map',
    'src/config.d.ts',
    'src/config.js',
    'src/config.js.map',
    'src/index.d.ts',
    'src/index.js',
    'src/index.js.map'
  ]
};

const expectedStagePackageNames = Object.keys(expectedStageRuntimeFilesByPackage).sort();

const expectedStageDirectories = [
  'dist',
  'dist/packages',
  ...expectedStagePackageNames.flatMap((packageName) => [
    `dist/packages/${packageName}`,
    `dist/packages/${packageName}/src`
  ])
].sort((left, right) => left.localeCompare(right));

const expectedStageFiles = [
  'LICENSE',
  'README.md',
  'package.json',
  ...expectedStagePackageNames.flatMap((packageName) => expectedStageRuntimeFilesByPackage[packageName].map((relativePath) => `dist/packages/${packageName}/${relativePath}`))
].sort((left, right) => left.localeCompare(right));

const expectedTarballFiles = expectedStageFiles.map((relativePath) => `package/${relativePath}`).sort((left, right) => left.localeCompare(right));

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

const expectedInstalledReviewRunArtifacts = [
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

const expectedInstalledCliProofs = {
  checkRequiresScope: {
    outcome: 'fail',
    stderrIncludes: 'Changed scope is required.'
  },
  keygen: {
    runId: 'packaging-installed-keygen-run',
    outDir: '.ts-quality/generated-keys',
    keyId: 'packaging-generated',
    stdoutMatchesAbsolutePaths: true,
    created: [
      '.ts-quality/generated-keys/packaging-generated.pem',
      '.ts-quality/generated-keys/packaging-generated.pub.pem'
    ],
    attestationPath: '.ts-quality/attestations/generated-key.json',
    verifiedIssuer: 'ci.generated'
  }
};

const expectedInstalledFixtureBreadth = {
  monorepoBoundary: {
    fixture: 'mini-monorepo',
    runId: 'packaging-installed-mini-monorepo-run',
    changedFiles: ['packages/api/src/consumer.js'],
    outcome: 'fail',
    packageName: 'api-pkg',
    governanceRuleId: 'api-cannot-import-identity',
    governIncludes: [
      'api-cannot-import-identity',
      'API code may not import identity state directly.'
    ]
  }
};

const expectedInstalledReviewSurfaceProofs = {
  report: {
    artifact: '.ts-quality/runs/packaging-installed-review-run/report.md',
    stdoutMatchesArtifact: true,
    stdoutIncludes: ['# ts-quality report']
  },
  explain: {
    artifact: '.ts-quality/runs/packaging-installed-review-run/explain.txt',
    stdoutMatchesArtifact: true,
    stdoutIncludes: ['Reasons:']
  },
  plan: {
    artifact: '.ts-quality/runs/packaging-installed-review-run/plan.txt',
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
    currentRun: 'packaging-installed-review-trend-run',
    previousRun: 'packaging-installed-review-run',
    stdoutIncludes: [
      'Current run: packaging-installed-review-trend-run',
      'Previous run: packaging-installed-review-run',
      'Invariant evidence at risk: auth.refresh.validity',
      'Evidence semantics: deterministic lexical alignment over focused tests; not execution-backed behavioral proof',
      'Evidence provenance: explicit 3, inferred 1, missing 1',
      'scenario-support [missing; mode=missing]: 0/1 scenario(s) have deterministic lexical support'
    ],
    omitsObligation: true
  },
  runSelection: {
    latestReportRunId: 'packaging-installed-review-trend-run',
    selectedReportRunId: 'packaging-installed-review-run',
    latestAuthorizeOutcome: 'deny',
    latestAuthorizeRunId: 'packaging-installed-review-trend-run',
    selectedAuthorizeOutcome: 'approve',
    selectedAuthorizeRunId: 'packaging-installed-review-run',
    selectedAuthorizeOverride: 'maintainer'
  },
  materializedConfig: {
    configPath: '.ts-quality/materialized/ts-quality.config.json',
    sourceRunId: 'packaging-installed-materialized-source-run',
    runId: 'packaging-installed-materialized-config-run',
    analysisConfigPath: '.ts-quality/materialized/ts-quality.config.json',
    controlPlaneConfigPath: '.ts-quality/materialized/ts-quality.config.json',
    matchesSourceVerdict: true,
    matchesSourceChangedFiles: true,
    matchesSourceGovernance: true,
    governIncludes: [
      'auth-risk-budget',
      'Invariant evidence at risk: auth.refresh.validity'
    ]
  },
  driftDetection: {
    runId: 'packaging-installed-drift-run',
    mutatedFile: 'src/auth/token.js',
    planIncludes: [
      'Run drift detected for packaging-installed-drift-run.',
      'changed file src/auth/token.js:'
    ],
    governIncludes: [
      'Run drift detected for packaging-installed-drift-run.',
      'changed file src/auth/token.js:'
    ],
    authorize: {
      agent: 'maintainer',
      outcome: 'deny',
      runId: 'packaging-installed-drift-run',
      reasonIncludes: 'Repository changed since run',
      bundlePath: '.ts-quality/runs/packaging-installed-drift-run/bundle.maintainer.merge.json',
      decisionPath: '.ts-quality/runs/packaging-installed-drift-run/authorize.maintainer.merge.json'
    }
  },
  releaseBotAuthorize: {
    deniedWithoutOverride: {
      outcome: 'deny',
      missingProof: [],
      verifiedAttestations: 1,
      governIncludes: 'auth-risk-budget'
    },
    approved: {
      agent: 'release-bot',
      outcome: 'approve',
      overrideUsed: 'maintainer',
      runId: 'packaging-installed-review-run',
      bundlePath: '.ts-quality/runs/packaging-installed-review-run/bundle.release-bot.merge.json',
      verifiedAttestations: 1
    }
  }
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function expectedManifestContract() {
  const workspacePackage = readJson('package.json');
  const publicPackage = readJson('packages/ts-quality/package.json');
  return {
    name: publicPackage.name,
    version: publicPackage.version,
    description: publicPackage.description,
    license: publicPackage.license,
    repository: publicPackage.repository,
    homepage: publicPackage.homepage,
    bugs: publicPackage.bugs,
    keywords: publicPackage.keywords,
    dependencies: publicPackage.dependencies,
    engines: workspacePackage.engines,
    main: 'dist/packages/ts-quality/src/index.js',
    types: 'dist/packages/ts-quality/src/index.d.ts',
    exports: {
      '.': {
        types: './dist/packages/ts-quality/src/index.d.ts',
        default: './dist/packages/ts-quality/src/index.js'
      },
      './package.json': './package.json'
    },
    bin: {
      'ts-quality': 'dist/packages/ts-quality/src/cli.js'
    },
    files: [
      'dist/**/*',
      'README.md',
      'LICENSE'
    ],
    publishConfig: {
      access: 'public'
    }
  };
}

test('staged tarball smoke hardens staged manifest and file-boundary contract plus packaged CLI/API proof points from a fresh temp project', () => {
  const result = spawnSync('npm', ['run', 'smoke:packaging', '--silent'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const summary = JSON.parse(result.stdout);
  assert.equal(summary.packageName, 'ts-quality');
  assert.equal(summary.version, '0.1.0');
  assert.equal(summary.stageDir, '.ts-quality/npm/ts-quality/package');
  assert.match(summary.tarball, /^\.ts-quality\/npm\/ts-quality\/tarballs\/ts-quality-.*\.tgz$/);
  assert.deepEqual(summary.entrypoints, expectedEntrypoints);
  const manifestContract = expectedManifestContract();
  assert.deepEqual(Object.keys(summary.manifest).sort(), [...expectedManifestKeys].sort());
  assert.deepEqual(summary.manifest, manifestContract);
  assert.deepEqual(readJson(`${summary.stageDir}/package.json`), manifestContract);
  assert.deepEqual(summary.topLevelEntries, expectedTopLevelEntries);
  assert.deepEqual(summary.directories, expectedStageDirectories);
  assert.deepEqual(summary.stagedFiles, expectedStageFiles);
  assert.deepEqual(summary.tarballFiles, expectedTarballFiles);
  assert.equal(summary.cli.helpIncludes, 'ts-quality commands:');
  assert.deepEqual(summary.cli.initCreated, expectedInitFiles);
  assert.equal(summary.cli.materializedConfig, '.ts-quality/materialized/ts-quality.config.json');
  assert.deepEqual(summary.cli.checkRequiresScope, expectedInstalledCliProofs.checkRequiresScope);
  assert.deepEqual(summary.cli.keygen, expectedInstalledCliProofs.keygen);
  assert.deepEqual(summary.api.exportTypes, {
    initProject: 'function',
    materializeProject: 'function'
  });
  assert.equal(summary.api.materializeConfig, '.ts-quality/materialized/ts-quality.config.json');
  assert.equal(summary.api.materializeOutDir, '.ts-quality/materialized');
  assert.deepEqual(summary.api.materializedFiles, expectedMaterializedFiles);
  assert.deepEqual(summary.typesCheck, {
    compiler: 'tsc',
    passed: true,
    importStatement: "import { initProject, materializeProject } from 'ts-quality';"
  });
  assert.deepEqual(summary.fixtureBreadth, expectedInstalledFixtureBreadth);
  assert.equal(summary.reviewFlow.fixture, 'governed-app');
  assert.equal(summary.reviewFlow.runId, 'packaging-installed-review-run');
  assert.deepEqual(summary.reviewFlow.runArtifacts, expectedInstalledReviewRunArtifacts);
  assert.deepEqual(summary.reviewFlow.report, expectedInstalledReviewSurfaceProofs.report);
  assert.deepEqual(summary.reviewFlow.explain, expectedInstalledReviewSurfaceProofs.explain);
  assert.deepEqual(summary.reviewFlow.plan, expectedInstalledReviewSurfaceProofs.plan);
  assert.deepEqual(summary.reviewFlow.trend, expectedInstalledReviewSurfaceProofs.trend);
  assert.deepEqual(summary.reviewFlow.runSelection, expectedInstalledReviewSurfaceProofs.runSelection);
  assert.deepEqual(summary.reviewFlow.materializedConfig, expectedInstalledReviewSurfaceProofs.materializedConfig);
  assert.deepEqual(summary.reviewFlow.driftDetection, expectedInstalledReviewSurfaceProofs.driftDetection);
  assert.equal(summary.reviewFlow.governIncludes, 'auth-risk-budget');
  assert.deepEqual(summary.reviewFlow.attestation, {
    subject: '.ts-quality/runs/packaging-installed-review-run/verdict.json',
    runId: 'packaging-installed-review-run',
    artifact: 'verdict.json',
    verified: true
  });
  assert.deepEqual(summary.reviewFlow.authorize, {
    agent: 'maintainer',
    outcome: 'approve',
    overrideUsed: 'maintainer',
    runId: 'packaging-installed-review-run',
    bundlePath: '.ts-quality/runs/packaging-installed-review-run/bundle.maintainer.merge.json',
    verifiedAttestations: 1
  });
  assert.deepEqual(summary.reviewFlow.releaseBotAuthorize, expectedInstalledReviewSurfaceProofs.releaseBotAuthorize);
  assert.deepEqual(summary.reviewFlow.amend, {
    proposalId: 'packaging-installed-amendment',
    outcome: 'needs-approvals',
    textArtifact: '.ts-quality/amendments/packaging-installed-amendment.result.txt'
  });
});
