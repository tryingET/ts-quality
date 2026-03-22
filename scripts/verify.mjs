import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const skipInstall = process.argv.includes('--skip-install');
const skipSampleIdempotence = process.env.TSQ_SKIP_SAMPLE_IDEMPOTENCE === '1';
const verificationDir = path.join(root, 'verification');
fs.mkdirSync(verificationDir, { recursive: true });
const logPath = path.join(verificationDir, 'verification.log');
const lines = [];

function sanitizeLogLine(line) {
  return line
    .replace(/(\baudited \d+ packages in )\d+(?:\.\d+)?ms\b/, '$1<duration-ms>')
    .replace(/(\badded \d+ packages in )\d+(?:\.\d+)?ms\b/, '$1<duration-ms>')
    .replace(/(\bremoved \d+ packages in )\d+(?:\.\d+)?ms\b/, '$1<duration-ms>')
    .replace(/(\bchanged \d+ packages in )\d+(?:\.\d+)?ms\b/, '$1<duration-ms>')
    .replace(/\(\d+(?:\.\d+)?ms\)$/u, '(<duration-ms>)')
    .replace(/(ℹ duration_ms )\d+(?:\.\d+)?$/u, '$1<duration-ms>');
}

function sanitizeLogFragment(value) {
  return value
    .split('\n')
    .map((line) => sanitizeLogLine(line))
    .join('\n');
}

function run(command, args) {
  lines.push(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  lines.push(sanitizeLogFragment(result.stdout || ''));
  lines.push(sanitizeLogFragment(result.stderr || ''));
  lines.push(`exit=${result.status}`);
  fs.writeFileSync(logPath, lines.join('\n'), 'utf8');
  if (result.status !== 0) {
    throw new Error(`Verification step failed: ${command} ${args.join(' ')}`);
  }
}

function snapshotDirectory(dir) {
  const entries = new Map();
  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      const relative = path.relative(dir, absolute).replace(/\\/g, '/');
      const digest = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
      entries.set(relative, digest);
    }
  }
  walk(dir);
  return entries;
}

function formatSnapshot(snapshot) {
  return [...snapshot.entries()].map(([relative, digest]) => `${relative}:${digest}`).join('\n');
}

function diffSnapshots(left, right) {
  const files = [...new Set([...left.keys(), ...right.keys()])].sort((a, b) => a.localeCompare(b));
  const changes = [];
  for (const file of files) {
    const before = left.get(file);
    const after = right.get(file);
    if (before === after) {
      continue;
    }
    changes.push(`${file}: ${before ?? '<missing>'} -> ${after ?? '<missing>'}`);
  }
  return changes;
}

function assertVerifiedSampleAttestation(sampleArtifactsDir) {
  const verifyPath = path.join(sampleArtifactsDir, 'attestation.verify.txt');
  const verifyText = fs.readFileSync(verifyPath, 'utf8');
  if (!/^ci\.verify: verified \(verified\)$/m.test(verifyText)) {
    throw new Error(`Verification step failed: sample attestation verification drifted: ${verifyPath}`);
  }
}

if (!skipInstall) {
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
}
run('npm', ['run', 'build', '--silent']);
run('npm', ['run', 'typecheck', '--silent']);
run('npm', ['run', 'lint', '--silent']);
run('npm', ['test', '--silent']);
run('npm', ['run', 'sample-artifacts', '--silent']);
const sampleArtifactsDir = path.join(root, 'examples', 'artifacts', 'governed-app');
assertVerifiedSampleAttestation(sampleArtifactsDir);
if (!skipSampleIdempotence) {
  const firstSampleSnapshot = snapshotDirectory(sampleArtifactsDir);
  run('npm', ['run', 'sample-artifacts', '--silent']);
  assertVerifiedSampleAttestation(sampleArtifactsDir);
  const secondSampleSnapshot = snapshotDirectory(sampleArtifactsDir);
  if (formatSnapshot(firstSampleSnapshot) !== formatSnapshot(secondSampleSnapshot)) {
    const changes = diffSnapshots(firstSampleSnapshot, secondSampleSnapshot);
    throw new Error(`Verification step failed: sample artifacts drifted across consecutive generation passes\n${changes.join('\n')}`);
  }
}
run('npm', ['run', 'smoke', '--silent']);

const verificationMd = [
  '---',
  'summary: "Latest repo verification record produced by scripts/verify.mjs."',
  'read_when:',
  '  - "When checking which repo validation commands most recently passed"',
  '  - "When reviewing the generated verification artifact format"',
  'type: "reference"',
  '---',
  '',
  '# Verification',
  '',
  'The following commands were executed successfully:',
  '',
  ...(skipInstall ? [] : ['- `npm ci --ignore-scripts --no-audit --no-fund`']),
  '- `npm run build --silent`',
  '- `npm run typecheck --silent`',
  '- `npm run lint --silent`',
  '- `npm test --silent`',
  '- `npm run sample-artifacts --silent`',
  ...(skipSampleIdempotence ? [] : ['- second `npm run sample-artifacts --silent` idempotence check over `examples/artifacts/governed-app`']),
  '- `npm run smoke --silent`',
  '',
  `Log: \`${path.relative(root, logPath).replace(/\\/g, '/')}\``
].join('\n');
fs.writeFileSync(path.join(root, 'VERIFICATION.md'), `${verificationMd}\n`, 'utf8');
console.log('verify: ok');
