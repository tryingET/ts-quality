import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

const stagedPackage = {
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

fs.writeFileSync(path.join(stageDir, 'package.json'), `${JSON.stringify(stagedPackage, null, 2)}\n`, 'utf8');

const stagedEntrypoints = {
  main: stagedPackage.main,
  types: stagedPackage.types,
  bin: stagedPackage.bin['ts-quality'],
  exportDefault: stagedPackage.exports['.'].default,
  exportTypes: stagedPackage.exports['.'].types
};

for (const [label, relativePath] of Object.entries(stagedEntrypoints)) {
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
  entrypoints: stagedEntrypoints
};

console.log(JSON.stringify(summary, null, 2));
