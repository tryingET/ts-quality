import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '..');

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

export function runPackagingSmoke() {
  const packSummary = JSON.parse(run('node', ['scripts/pack-ts-quality.mjs'], root));
  const tarballPath = path.join(root, packSummary.tarball);
  const stageDirPath = path.join(root, packSummary.stageDir);
  if (!fs.existsSync(stageDirPath)) {
    throw new Error(`Staged package directory is missing: ${stageDirPath}`);
  }
  if (!fs.existsSync(tarballPath)) {
    throw new Error(`Packed tarball is missing: ${tarballPath}`);
  }

  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-packaging-smoke-'));
  try {
    fs.writeFileSync(path.join(installRoot, 'package.json'), `${JSON.stringify({ name: 'ts-quality-packaging-smoke', private: true }, null, 2)}\n`, 'utf8');
    run('npm', ['install', tarballPath, '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'], installRoot);

    const cliHelp = run('npx', ['--no-install', 'ts-quality', '--help'], installRoot);
    if (!cliHelp.includes('ts-quality commands:')) {
      throw new Error(`Unexpected ts-quality --help output:\n${cliHelp}`);
    }

    const materializeProjectType = run('node', ['-e', "const mod = require('ts-quality'); process.stdout.write(typeof mod.materializeProject);"], installRoot);
    if (materializeProjectType !== 'function') {
      throw new Error(`Expected ts-quality.materializeProject to be a function, got: ${materializeProjectType}`);
    }

    return {
      stageDir: packSummary.stageDir,
      tarball: packSummary.tarball,
      cliHelpIncludes: 'ts-quality commands:',
      moduleExport: {
        name: 'materializeProject',
        type: materializeProjectType
      }
    };
  } finally {
    fs.rmSync(installRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  console.log(JSON.stringify(runPackagingSmoke(), null, 2));
}
