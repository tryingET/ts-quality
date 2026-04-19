import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { gunzipSync } from 'node:zlib';

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

export const stagedTopLevelEntries = Object.freeze([
  'LICENSE',
  'README.md',
  'dist',
  'package.json'
].sort((left, right) => left.localeCompare(right)));

export const stagedRuntimeFilesByPackage = Object.freeze({
  crap4ts: Object.freeze([
    'src/cli.d.ts',
    'src/cli.js',
    'src/cli.js.map',
    'src/index.d.ts',
    'src/index.js',
    'src/index.js.map'
  ]),
  'evidence-model': Object.freeze([
    'src/index.d.ts',
    'src/index.js',
    'src/index.js.map'
  ]),
  governance: Object.freeze([
    'src/index.d.ts',
    'src/index.js',
    'src/index.js.map'
  ]),
  invariants: Object.freeze([
    'src/index.d.ts',
    'src/index.js',
    'src/index.js.map'
  ]),
  legitimacy: Object.freeze([
    'src/index.d.ts',
    'src/index.js',
    'src/index.js.map'
  ]),
  'policy-engine': Object.freeze([
    'src/index.d.ts',
    'src/index.js',
    'src/index.js.map'
  ]),
  'ts-mutate': Object.freeze([
    'src/cli.d.ts',
    'src/cli.js',
    'src/cli.js.map',
    'src/index.d.ts',
    'src/index.js',
    'src/index.js.map'
  ]),
  'ts-quality': Object.freeze([
    'src/cli.d.ts',
    'src/cli.js',
    'src/cli.js.map',
    'src/config.d.ts',
    'src/config.js',
    'src/config.js.map',
    'src/index.d.ts',
    'src/index.js',
    'src/index.js.map'
  ])
});

export const stagedRuntimePackageNames = Object.freeze(Object.keys(stagedRuntimeFilesByPackage).sort((left, right) => left.localeCompare(right)));

export const stagedPackageDirectories = Object.freeze([
  'dist',
  'dist/packages',
  ...stagedRuntimePackageNames.flatMap((packageName) => [
    `dist/packages/${packageName}`,
    `dist/packages/${packageName}/src`
  ])
].sort((left, right) => left.localeCompare(right)));

export const stagedPackageFiles = Object.freeze([
  'LICENSE',
  'README.md',
  'package.json',
  ...stagedRuntimePackageNames.flatMap((packageName) => stagedRuntimeFilesByPackage[packageName].map((relativePath) => `dist/packages/${packageName}/${relativePath}`))
].sort((left, right) => left.localeCompare(right)));

export const packedTarballFiles = Object.freeze(stagedPackageFiles.map((relativePath) => `package/${relativePath}`).sort((left, right) => left.localeCompare(right)));

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

function formatPathContractMessage(label, expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((value) => !actualSet.has(value));
  const extra = actual.filter((value) => !expectedSet.has(value));
  return [
    `${label} drifted.`,
    missing.length > 0 ? `missing: ${missing.join(', ')}` : null,
    extra.length > 0 ? `extra: ${extra.join(', ')}` : null,
    `expected (${expected.length}): ${expected.join(', ')}`,
    `actual (${actual.length}): ${actual.join(', ')}`
  ].filter(Boolean).join('\n');
}

function collectStagePaths(rootDir) {
  const directories = [];
  const files = [];

  function walk(currentDir, relativeDir = '') {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        directories.push(relativePath);
        walk(absolutePath, relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  walk(rootDir);

  return {
    topLevelEntries: fs.readdirSync(rootDir).sort((left, right) => left.localeCompare(right)),
    directories: directories.sort((left, right) => left.localeCompare(right)),
    files: files.sort((left, right) => left.localeCompare(right))
  };
}

function isZeroBlock(block) {
  for (const byte of block) {
    if (byte !== 0) {
      return false;
    }
  }
  return true;
}

function readTarHeaderString(header, start, length) {
  return header.toString('utf8', start, start + length).replace(/\0.*$/su, '').trim();
}

function readTarTypeFlag(header) {
  const value = header.toString('utf8', 156, 157);
  if (!value || value === '\0') {
    return '0';
  }
  return value.trim() || '0';
}

function parseTarOctal(header, start, length) {
  const value = header.toString('utf8', start, start + length).replace(/\0.*$/su, '').trim();
  return value === '' ? 0 : Number.parseInt(value, 8);
}

function collectTarballPaths(tarballPath) {
  const archive = gunzipSync(fs.readFileSync(tarballPath));
  const files = [];
  const nonRegularEntries = [];
  let offset = 0;

  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (isZeroBlock(header)) {
      break;
    }

    const name = readTarHeaderString(header, 0, 100);
    const prefix = readTarHeaderString(header, 345, 155);
    const typeFlag = readTarTypeFlag(header);
    const size = parseTarOctal(header, 124, 12);
    const relativePath = prefix ? `${prefix}/${name}` : name;
    const normalizedPath = relativePath.replace(/\/$/u, '');

    if (normalizedPath) {
      if (typeFlag === '0') {
        files.push(normalizedPath);
      } else if (typeFlag !== '5' && typeFlag !== 'x' && typeFlag !== 'g') {
        nonRegularEntries.push({
          path: normalizedPath,
          typeFlag
        });
      }
    }

    offset += 512 + Math.ceil(size / 512) * 512;
  }

  return {
    files: files.sort((left, right) => left.localeCompare(right)),
    nonRegularEntries: nonRegularEntries.sort((left, right) => left.path.localeCompare(right.path) || left.typeFlag.localeCompare(right.typeFlag))
  };
}

export function assertPackedTarballFileSetContract(tarballPath) {
  ensureFile(tarballPath, `Missing packed tarball: ${tarballPath}`);
  const actual = collectTarballPaths(tarballPath);

  assert.deepEqual(
    actual.nonRegularEntries,
    [],
    [
      'Packed tarball contains non-regular entries.',
      ...actual.nonRegularEntries.map(({ path: entryPath, typeFlag }) => `${entryPath} (${typeFlag})`)
    ].join('\n')
  );
  assert.deepEqual(
    actual.files,
    [...packedTarballFiles],
    formatPathContractMessage('Packed tarball file set', [...packedTarballFiles], actual.files)
  );

  return actual;
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
  const expectedKeys = [...stagedManifestKeys].sort((left, right) => left.localeCompare(right));
  const actualKeys = Object.keys(stagedPackage).sort((left, right) => left.localeCompare(right));
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

export function assertStagedPackageFileBoundaryContract(stageRootDir) {
  ensureFile(stageRootDir, `Missing staged package directory: ${stageRootDir}`);
  const actual = collectStagePaths(stageRootDir);

  assert.deepEqual(
    actual.topLevelEntries,
    [...stagedTopLevelEntries],
    formatPathContractMessage('Staged package top-level entries', [...stagedTopLevelEntries], actual.topLevelEntries)
  );
  assert.deepEqual(
    actual.directories,
    [...stagedPackageDirectories],
    formatPathContractMessage('Staged package directory set', [...stagedPackageDirectories], actual.directories)
  );
  assert.deepEqual(
    actual.files,
    [...stagedPackageFiles],
    formatPathContractMessage('Staged package file set', [...stagedPackageFiles], actual.files)
  );

  return actual;
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

  const stagedBoundary = assertStagedPackageFileBoundaryContract(stageDir);

  const tarballStdout = execFileSync('npm', ['pack', '--pack-destination', tarballDir], {
    cwd: stageDir,
    encoding: 'utf8'
  }).trim();
  const tarballName = tarballStdout.split(/\r?\n/u).filter(Boolean).at(-1);
  if (!tarballName) {
    throw new Error('npm pack did not report a tarball name.');
  }
  const tarballPath = path.join(tarballDir, tarballName);
  const tarballBoundary = assertPackedTarballFileSetContract(tarballPath);

  const summary = {
    packageName: stagedPackage.name,
    version: stagedPackage.version,
    stageDir: path.relative(root, stageDir),
    packageJson: path.relative(root, path.join(stageDir, 'package.json')),
    tarball: path.relative(root, tarballPath),
    entrypoints: stagedEntrypointFiles,
    manifest: stagedPackage,
    topLevelEntries: stagedBoundary.topLevelEntries,
    directories: stagedBoundary.directories,
    stagedFiles: stagedBoundary.files,
    tarballFiles: tarballBoundary.files
  };

  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  console.log(JSON.stringify(packTsQuality(), null, 2));
}
