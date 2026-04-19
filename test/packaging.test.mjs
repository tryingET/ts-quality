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
});
