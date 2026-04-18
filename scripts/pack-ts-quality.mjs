import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '..');
const workspacePackagePath = path.join(root, 'package.json');
const publicPackagePath = path.join(root, 'packages', 'ts-quality', 'package.json');
const builtDistDir = path.join(root, 'dist');
const builtPackageDir = path.join(builtDistDir, 'packages', 'ts-quality');
const builtIndex = path.join(builtPackageDir, 'src', 'index.js');
const builtTypes = path.join(builtPackageDir, 'src', 'index.d.ts');
const builtCli = path.join(builtPackageDir, 'src', 'cli.js');
const stagingRoot = path.join(root, '.ts-quality', 'npm', 'ts-quality');
const stageDir = path.join(stagingRoot, 'package');
const tarballDir = path.join(stagingRoot, 'tarballs');

export const stagedEntrypoints = Object.freeze({
  main: 'dist/packages/ts-quality/src/index.js',
  types: 'dist/packages/ts-quality/src/index.d.ts',
  bin: 'dist/packages/ts-quality/src/cli.js'
});

export const stagedExports = Object.freeze({
  '.': Object.freeze({
    types: `./${stagedEntrypoints.types}`,
    default: `./${stagedEntrypoints.main}`
  }),
  './package.json': './package.json'
});

export const stagedFiles = Object.freeze([
  'dist/**/*',
  'README.md',
  'LICENSE'
]);

export const stagedPublishConfig = Object.freeze({
  access: 'public'
});

export const stagedManifestKeys = Object.freeze([
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
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireManifestField(source, key, sourceLabel) {
  const value = source[key];
  if (value === undefined || value === null) {
    throw new Error(`Missing required ${sourceLabel} manifest field: ${key}`);
  }
  if (typeof value === 'string' && value.trim() === '') {
    throw new Error(`Blank required ${sourceLabel} manifest field: ${key}`);
  }
  if (Array.isArray(value) && value.length === 0) {
    throw new Error(`Empty required ${sourceLabel} manifest field: ${key}`);
  }
  return cloneJson(value);
}

function ensureFile(filePath, message) {
  if (!fs.existsSync(filePath)) {
    throw new Error(message);
  }
}

function copyFileIntoStage(sourcePath, destinationPath) {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

function copyDirectory(sourceDir, destinationDir) {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  fs.mkdirSync(destinationDir, { recursive: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      copyFileIntoStage(sourcePath, destinationPath);
    }
  }
}

export function buildStagedPackageManifest(publicPackage, workspacePackage) {
  return {
    name: requireManifestField(publicPackage, 'name', 'public package'),
    version: requireManifestField(publicPackage, 'version', 'public package'),
    description: requireManifestField(publicPackage, 'description', 'public package'),
    license: requireManifestField(publicPackage, 'license', 'public package'),
    repository: requireManifestField(publicPackage, 'repository', 'public package'),
    homepage: requireManifestField(publicPackage, 'homepage', 'public package'),
    bugs: requireManifestField(publicPackage, 'bugs', 'public package'),
    keywords: requireManifestField(publicPackage, 'keywords', 'public package'),
    dependencies: requireManifestField(publicPackage, 'dependencies', 'public package'),
    engines: requireManifestField(workspacePackage, 'engines', 'workspace package'),
    main: stagedEntrypoints.main,
    types: stagedEntrypoints.types,
    exports: cloneJson(stagedExports),
    bin: {
      'ts-quality': stagedEntrypoints.bin
    },
    files: [...stagedFiles],
    publishConfig: cloneJson(stagedPublishConfig)
  };
}

export function assertStagedPackageManifestContract(stagedPackage, publicPackage, workspacePackage) {
  const expectedKeys = [...stagedManifestKeys].sort();
  const actualKeys = Object.keys(stagedPackage).sort();
  assert.deepEqual(actualKeys, expectedKeys, `Staged package manifest keys drifted: expected ${expectedKeys.join(', ')}, got ${actualKeys.join(', ')}`);

  assert.equal(stagedPackage.name, requireManifestField(publicPackage, 'name', 'public package'));
  assert.equal(stagedPackage.version, requireManifestField(publicPackage, 'version', 'public package'));
  assert.equal(stagedPackage.description, requireManifestField(publicPackage, 'description', 'public package'));
  assert.equal(stagedPackage.license, requireManifestField(publicPackage, 'license', 'public package'));
  assert.deepEqual(stagedPackage.repository, requireManifestField(publicPackage, 'repository', 'public package'));
  assert.equal(stagedPackage.homepage, requireManifestField(publicPackage, 'homepage', 'public package'));
  assert.deepEqual(stagedPackage.bugs, requireManifestField(publicPackage, 'bugs', 'public package'));
  assert.deepEqual(stagedPackage.keywords, requireManifestField(publicPackage, 'keywords', 'public package'));
  assert.deepEqual(stagedPackage.dependencies, requireManifestField(publicPackage, 'dependencies', 'public package'));
  assert.deepEqual(stagedPackage.engines, requireManifestField(workspacePackage, 'engines', 'workspace package'));
  assert.equal(stagedPackage.main, stagedEntrypoints.main);
  assert.equal(stagedPackage.types, stagedEntrypoints.types);
  assert.deepEqual(stagedPackage.exports, stagedExports);
  assert.deepEqual(stagedPackage.bin, { 'ts-quality': stagedEntrypoints.bin });
  assert.deepEqual(stagedPackage.files, stagedFiles);
  assert.deepEqual(stagedPackage.publishConfig, stagedPublishConfig);
}

export function packTsQuality() {
  const workspacePackage = readJson(workspacePackagePath);
  const publicPackage = readJson(publicPackagePath);

  ensureFile(builtIndex, 'Missing built ts-quality entrypoint. Run `npm run build` first.');
  ensureFile(builtTypes, 'Missing built ts-quality type declarations. Run `npm run build` first.');
  ensureFile(builtCli, 'Missing built ts-quality CLI. Run `npm run build` first.');
  ensureFile(path.join(root, 'README.md'), 'Missing root README.md.');
  ensureFile(path.join(root, 'LICENSE'), 'Missing root LICENSE.');

  fs.rmSync(stagingRoot, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });
  fs.mkdirSync(tarballDir, { recursive: true });

  copyDirectory(builtDistDir, path.join(stageDir, 'dist'));
  copyFileIntoStage(path.join(root, 'README.md'), path.join(stageDir, 'README.md'));
  copyFileIntoStage(path.join(root, 'LICENSE'), path.join(stageDir, 'LICENSE'));

  const stagedPackage = buildStagedPackageManifest(publicPackage, workspacePackage);
  assertStagedPackageManifestContract(stagedPackage, publicPackage, workspacePackage);
  fs.writeFileSync(path.join(stageDir, 'package.json'), `${JSON.stringify(stagedPackage, null, 2)}\n`, 'utf8');

  const stagedEntrypointFiles = {
    main: stagedPackage.main,
    types: stagedPackage.types,
    bin: stagedPackage.bin['ts-quality'],
    exportDefault: stagedPackage.exports['.'].default,
    exportTypes: stagedPackage.exports['.'].types
  };

  for (const [label, relativePath] of Object.entries(stagedEntrypointFiles)) {
    const normalizedRelativePath = relativePath.replace(/^\.\//u, '');
    ensureFile(path.join(stageDir, normalizedRelativePath), `Missing staged ${label} entrypoint: ${relativePath}`);
  }

  const tarballStdout = execFileSync('npm', ['pack', '--pack-destination', tarballDir], {
    cwd: stageDir,
    encoding: 'utf8'
  }).trim();
  const tarballName = tarballStdout.split(/\r?\n/u).filter(Boolean).at(-1);
  if (!tarballName) {
    throw new Error('npm pack did not report a tarball name.');
  }

  const summary = {
    packageName: stagedPackage.name,
    version: stagedPackage.version,
    stageDir: path.relative(root, stageDir),
    packageJson: path.relative(root, path.join(stageDir, 'package.json')),
    tarball: path.relative(root, path.join(tarballDir, tarballName)),
    entrypoints: stagedEntrypointFiles,
    manifest: stagedPackage
  };

  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  console.log(JSON.stringify(packTsQuality(), null, 2));
}
