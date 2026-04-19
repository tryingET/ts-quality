import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '..');
const verificationDir = path.join(root, 'verification');
const logPath = path.join(verificationDir, 'verification.log');

const installStep = {
  command: 'npm',
  args: ['ci', '--ignore-scripts', '--no-audit', '--no-fund'],
  markdown: '- `npm ci --ignore-scripts --no-audit --no-fund`'
};
const buildStep = {
  command: 'npm',
  args: ['run', 'build', '--silent'],
  markdown: '- `npm run build --silent`'
};
const typecheckStep = {
  command: 'npm',
  args: ['run', 'typecheck', '--silent'],
  markdown: '- `npm run typecheck --silent`'
};
const lintStep = {
  command: 'npm',
  args: ['run', 'lint', '--silent'],
  markdown: '- `npm run lint --silent`'
};
const testStep = {
  command: 'npm',
  args: ['test', '--silent'],
  markdown: '- `npm test --silent`'
};
const sampleArtifactsStep = {
  command: 'npm',
  args: ['run', 'sample-artifacts', '--silent'],
  markdown: '- `npm run sample-artifacts --silent`'
};
const sampleArtifactsIdempotenceMarkdown = '- second `npm run sample-artifacts --silent` idempotence check over `examples/artifacts/governed-app`';
const smokeStep = {
  command: 'npm',
  args: ['run', 'smoke', '--silent'],
  markdown: '- `npm run smoke --silent`'
};
const packagingSmokeStep = {
  command: 'npm',
  args: ['run', 'smoke:packaging', '--silent'],
  markdown: '- `npm run smoke:packaging --silent`'
};

export function verificationCommands(skipInstall = false) {
  return [
    ...(skipInstall ? [] : [installStep]),
    buildStep,
    typecheckStep,
    lintStep,
    testStep,
    sampleArtifactsStep,
    smokeStep,
    packagingSmokeStep
  ].map((step) => ({
    command: step.command,
    args: [...step.args],
    markdown: step.markdown
  }));
}

export function verificationMarkdownLines(skipInstall = false) {
  return [
    ...(skipInstall ? [] : [installStep.markdown]),
    buildStep.markdown,
    typecheckStep.markdown,
    lintStep.markdown,
    testStep.markdown,
    sampleArtifactsStep.markdown,
    sampleArtifactsIdempotenceMarkdown,
    smokeStep.markdown,
    packagingSmokeStep.markdown
  ];
}

export function verificationArtifactMarkdownLines() {
  return [
    installStep.markdown,
    buildStep.markdown,
    typecheckStep.markdown,
    lintStep.markdown,
    testStep.markdown,
    sampleArtifactsStep.markdown,
    sampleArtifactsIdempotenceMarkdown,
    smokeStep.markdown,
    packagingSmokeStep.markdown
  ];
}

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

function canonicalInstallLogLines() {
  return [
    `$ ${installStep.command} ${installStep.args.join(' ')}`,
    '',
    '',
    'exit=0'
  ];
}

function assertVerificationArtifactsInSync(pathsToCheck) {
  const relativePaths = pathsToCheck.map((artifactPath) => path.relative(root, artifactPath).replace(/\\/g, '/'));
  const result = spawnSync('git', ['diff', '--exit-code', '--', ...relativePaths], {
    cwd: root,
    encoding: 'utf8'
  });
  if (result.status === 0) {
    return;
  }
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  throw new Error(`Verification step failed: tracked verification artifacts drifted (${relativePaths.join(', ')})`);
}

export function runVerification(options = {}) {
  const skipInstall = options.skipInstall === true;
  const checkArtifacts = options.checkArtifacts === true;
  fs.mkdirSync(verificationDir, { recursive: true });
  const lines = [];

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

  function runInstall() {
    const result = spawnSync(installStep.command, installStep.args, { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) {
      lines.push(`$ ${installStep.command} ${installStep.args.join(' ')}`);
      lines.push(sanitizeLogFragment(result.stdout || ''));
      lines.push(sanitizeLogFragment(result.stderr || ''));
      lines.push(`exit=${result.status}`);
      fs.writeFileSync(logPath, lines.join('\n'), 'utf8');
      throw new Error(`Verification step failed: ${installStep.command} ${installStep.args.join(' ')}`);
    }
    lines.push(...canonicalInstallLogLines());
    fs.writeFileSync(logPath, lines.join('\n'), 'utf8');
  }

  if (skipInstall) {
    lines.push(...canonicalInstallLogLines());
    fs.writeFileSync(logPath, lines.join('\n'), 'utf8');
  } else {
    runInstall();
  }
  run(buildStep.command, buildStep.args);
  run(typecheckStep.command, typecheckStep.args);
  run(lintStep.command, lintStep.args);
  run(testStep.command, testStep.args);
  run(sampleArtifactsStep.command, sampleArtifactsStep.args);
  const sampleArtifactsDir = path.join(root, 'examples', 'artifacts', 'governed-app');
  assertVerifiedSampleAttestation(sampleArtifactsDir);
  const firstSampleSnapshot = snapshotDirectory(sampleArtifactsDir);
  run(sampleArtifactsStep.command, sampleArtifactsStep.args);
  assertVerifiedSampleAttestation(sampleArtifactsDir);
  const secondSampleSnapshot = snapshotDirectory(sampleArtifactsDir);
  if (formatSnapshot(firstSampleSnapshot) !== formatSnapshot(secondSampleSnapshot)) {
    const changes = diffSnapshots(firstSampleSnapshot, secondSampleSnapshot);
    throw new Error(`Verification step failed: sample artifacts drifted across consecutive generation passes\n${changes.join('\n')}`);
  }
  run(smokeStep.command, smokeStep.args);
  run(packagingSmokeStep.command, packagingSmokeStep.args);

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
    ...verificationArtifactMarkdownLines(),
    '',
    `Log: \`${path.relative(root, logPath).replace(/\\/g, '/')}\``
  ].join('\n');
  const verificationMdPath = path.join(root, 'VERIFICATION.md');
  fs.writeFileSync(verificationMdPath, `${verificationMd}\n`, 'utf8');

  if (checkArtifacts) {
    assertVerificationArtifactsInSync([verificationMdPath, logPath]);
  }

  return {
    skipInstall,
    checkArtifacts,
    logPath,
    verificationMdPath
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  runVerification({
    skipInstall: process.argv.includes('--skip-install'),
    checkArtifacts: process.argv.includes('--check-artifacts')
  });
  console.log('verify: ok');
}
