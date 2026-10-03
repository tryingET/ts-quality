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
    '  default  Check and export AK-native direction state (read-only).',
    '  --check  Fail closed when direction state drifts.',
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
  run('ak', ['direction', 'check']);
  process.exit(0);
}

// Import is legacy migration, not routine sync: AK owns live direction state.
run('ak', ['direction', 'check']);
run('ak', ['direction', 'export']);
