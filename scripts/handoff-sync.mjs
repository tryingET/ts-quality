// @ts-check

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '..');
const args = new Set(process.argv.slice(2));

if (args.has('--help') || args.has('-h')) {
  process.stdout.write([
    'Usage: node scripts/handoff-sync.mjs [--check]',
    '',
    'Modes:',
    '  default  Export repo-local AK projections and reconcile direction state.',
    '  --check  Fail closed when governance/work-items.json or direction state drift.',
    ''
  ].join('\n'));
  process.exit(0);
}

if (args.size > 1 || (args.size === 1 && !args.has('--check'))) {
  process.stderr.write('handoff-sync: unknown arguments\n');
  process.exit(1);
}

/**
 * @param {string} command
 * @param {string[]} commandArgs
 */
function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (args.has('--check')) {
  run('ak', ['work-items', 'check']);
  run('ak', ['direction', 'check']);
  process.exit(0);
}

run('ak', ['work-items', 'export']);
run('ak', ['direction', 'import']);
run('ak', ['direction', 'check']);
run('ak', ['direction', 'export']);
