import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { assertStagedPackageManifestContract } from './pack-ts-quality.mjs';

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

function ensureRelativeFiles(baseDir, relativePaths, label) {
  for (const relativePath of relativePaths) {
    ensureFile(path.join(baseDir, relativePath), `${label} file`);
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

  for (const [label, relativePath] of Object.entries(packSummary.entrypoints)) {
    ensureFile(path.join(stageDirPath, normalizePackageRelative(relativePath)), `Staged ${label} entrypoint`);
  }

  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-packaging-smoke-'));
  try {
    fs.writeFileSync(path.join(installRoot, 'package.json'), `${JSON.stringify({ name: 'ts-quality-packaging-smoke', private: true }, null, 2)}\n`, 'utf8');
    run('npm', ['install', tarballPath, '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'], installRoot);

    const installedPackageDir = path.join(installRoot, 'node_modules', packSummary.packageName);
    const installedPackageJsonPath = path.join(installedPackageDir, 'package.json');
    ensureFile(installedPackageJsonPath, 'Installed package manifest');
    const installedPackage = JSON.parse(fs.readFileSync(installedPackageJsonPath, 'utf8'));

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

    const cliHelp = run('npx', ['--no-install', 'ts-quality', '--help'], installRoot);
    if (!cliHelp.includes('ts-quality commands:')) {
      throw new Error(`Unexpected ts-quality --help output:\n${cliHelp}`);
    }

    const cliProjectRoot = path.join(installRoot, 'cli-project');
    fs.mkdirSync(cliProjectRoot, { recursive: true });
    const cliInit = run('npx', ['--no-install', 'ts-quality', 'init', '--root', cliProjectRoot], installRoot);
    if (!cliInit.includes(`Initialized ts-quality in ${cliProjectRoot}`)) {
      throw new Error(`Unexpected ts-quality init output:\n${cliInit}`);
    }
    ensureRelativeFiles(cliProjectRoot, expectedInitFiles, 'CLI init');

    const cliMaterialize = run('npx', ['--no-install', 'ts-quality', 'materialize', '--root', cliProjectRoot], installRoot);
    if (!cliMaterialize.includes('Materialized runtime config: .ts-quality/materialized/ts-quality.config.json')) {
      throw new Error(`Unexpected ts-quality materialize output:\n${cliMaterialize}`);
    }
    ensureRelativeFiles(cliProjectRoot, expectedMaterializedFiles, 'CLI materialize');

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
    run('npx', ['--no-install', 'tsc', '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'ES2022', '--esModuleInterop', '--noEmit', path.basename(typeSmokePath)], installRoot);

    return {
      packageName: packSummary.packageName,
      version: packSummary.version,
      stageDir: packSummary.stageDir,
      tarball: packSummary.tarball,
      entrypoints: packSummary.entrypoints,
      manifest: stagedPackage,
      cli: {
        helpIncludes: 'ts-quality commands:',
        initCreated: [...expectedInitFiles],
        materializedConfig: '.ts-quality/materialized/ts-quality.config.json'
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
      }
    };
  } finally {
    fs.rmSync(installRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  console.log(JSON.stringify(runPackagingSmoke(), null, 2));
}
