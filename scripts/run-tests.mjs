import fs from 'fs';
import os from 'os';
import { spawnSync } from 'child_process';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const testDir = path.join(root, 'test');
const cacheRoot = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
const testTempRoot = path.join(cacheRoot, 'ts-quality', 'test-runner');

fs.mkdirSync(testTempRoot, { recursive: true });

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    ...options
  });
}

const build = run('tsc', ['-p', 'tsconfig.json'], { stdio: 'inherit' });
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const testFiles = fs.readdirSync(testDir)
  .filter((fileName) => fileName.endsWith('.test.mjs'))
  .sort((left, right) => left.localeCompare(right))
  .map((fileName) => path.posix.join('test', fileName));

for (const testFile of testFiles) {
  const result = run('node', ['--test', testFile], {
    env: {
      ...process.env,
      TMPDIR: testTempRoot,
      TMP: testTempRoot,
      TEMP: testTempRoot
    }
  });
  if (result.status === 0) {
    continue;
  }

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.stderr.write(`\nFail-fast: stopping after first failing test file (${testFile}, exit=${result.status ?? 1}).\n`);
  process.exit(result.status ?? 1);
}
