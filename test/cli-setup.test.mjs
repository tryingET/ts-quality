import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import test from 'node:test';
import assert from 'assert/strict';
import { repoRoot, tempCopyOfFixture, readRun } from './helpers.mjs';

// CLI integration: version and help, init, doctor, adopt and materialize.

const cli = path.join(repoRoot, 'dist', 'packages', 'ts-quality', 'src', 'cli.js');

// Feature: doctor derives runner and coverage advice from what commands do, not from script names

function doctorTarget(files) {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-doctor-evidence-'));
  for (const [relativePath, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(target, relativePath)), { recursive: true });
    fs.writeFileSync(path.join(target, relativePath), contents, 'utf8');
  }
  fs.mkdirSync(path.join(target, 'src'), { recursive: true });
  fs.writeFileSync(path.join(target, 'src', 'a.ts'), 'export const a = 1;\n', 'utf8');
  return target;
}

function doctorMachine(target) {
  const result = spawnSync('node', [cli, 'doctor', '--root', target, '--changed', 'src/a.ts', '--machine'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('top-level version flag prints the public package version only', () => {
  const publicPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'packages', 'ts-quality', 'package.json'), 'utf8'));
  const result = spawnSync('node', [cli, '--version'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${publicPackage.version}\n`);
  assert.equal(result.stderr, '');

  const misplaced = spawnSync('node', [cli, 'check', '--version'], { encoding: 'utf8' });
  assert.equal(misplaced.status, 1);
  assert.match(misplaced.stderr, /--version is a top-level flag/);

  const combined = spawnSync('node', [cli, '--version', '--root', repoRoot], { encoding: 'utf8' });
  assert.equal(combined.status, 1);
  assert.match(combined.stderr, /run exactly ts-quality --version/);
});

test('command help surfaces render without executing workflows', () => {
  const cases = [
    { args: ['init', '--help'], expected: 'Usage: ts-quality init ' },
    { args: ['doctor', '--help'], expected: 'Usage: ts-quality doctor ' },
    { args: ['materialize', '--help'], expected: 'Usage: ts-quality materialize ' },
    { args: ['adopt', '--help'], expected: 'Usage: ts-quality adopt ' },
    { args: ['retention', '--help'], expected: 'Usage: ts-quality retention ' },
    { args: ['check', '--help'], expected: 'Usage: ts-quality check ' },
    { args: ['explain', '--help'], expected: 'Usage: ts-quality explain ' },
    { args: ['report', '--help'], expected: 'Usage: ts-quality report ' },
    { args: ['trend', '--help'], expected: 'Usage: ts-quality trend ' },
    { args: ['plan', '--help'], expected: 'Usage: ts-quality plan ' },
    { args: ['govern', '--help'], expected: 'Usage: ts-quality govern ' },
    { args: ['authorize', '--help'], expected: 'Usage: ts-quality authorize ' },
    { args: ['attest', 'sign', '--help'], expected: 'Usage: ts-quality attest sign ' },
    { args: ['attest', 'verify', '--help'], expected: 'Usage: ts-quality attest verify ' },
    { args: ['attest', 'keygen', '--help'], expected: 'Usage: ts-quality attest keygen ' },
    { args: ['witness', 'test', '--help'], expected: 'Usage: ts-quality witness test ' },
    { args: ['witness', 'refresh', '--help'], expected: 'Usage: ts-quality witness refresh ' },
    { args: ['amend', '--help'], expected: 'Usage: ts-quality amend ' }
  ];

  for (const helpCase of cases) {
    const result = spawnSync('node', [cli, ...helpCase.args], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${helpCase.args.join(' ')}\n${result.stderr}`);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout.startsWith(helpCase.expected), true, helpCase.args.join(' '));
  }
});

test('init creates starter files in an empty repo', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.rmSync(path.join(target, 'ts-quality.config.ts'), { force: true });
  fs.rmSync(path.join(target, '.ts-quality'), { recursive: true, force: true });
  const result = spawnSync('node', [cli, 'init', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(path.join(target, 'ts-quality.config.ts')), true);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'invariants.ts')), true);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'witnesses', 'README.md')), true);
  const invariantsText = fs.readFileSync(path.join(target, '.ts-quality', 'invariants.ts'), 'utf8');
  assert.match(invariantsText, /First-invariant habit/);
  assert.match(invariantsText, /requiredTestPatterns: \['test\/auth\/token\.test\.ts'\]/);
  assert.match(invariantsText, /executionWitnessOutput: '\.ts-quality\/witnesses\/auth-refresh-expired-boundary\.json'/);
  const witnessReadme = fs.readFileSync(path.join(target, '.ts-quality', 'witnesses', 'README.md'), 'utf8');
  assert.match(witnessReadme, /one invariant, one scenario/);
  assert.match(witnessReadme, /Do not use repo-global tests as focused witness proof/);
});

test('init presets and doctor expose adoption diagnostics without running tests', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-doctor-'));
  fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ scripts: { 'build:js': 'esbuild src/test-helper.ts --outdir=dist', test: 'node --test', coverage: 'node --test --experimental-test-coverage' } }, null, 2), 'utf8');
  fs.mkdirSync(path.join(target, 'src'), { recursive: true });
  fs.mkdirSync(path.join(target, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(target, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');
  let result = spawnSync('node', [cli, 'init', '--root', target, '--preset', 'node-test-ts-dist'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const configText = fs.readFileSync(path.join(target, 'ts-quality.config.ts'), 'utf8');
  assert.match(configText, /--enable-source-maps/);
  assert.match(configText, /runtimeMirrorRoots: \['dist', 'lib', 'build'\]/);

  result = spawnSync('node', [cli, 'doctor', '--root', target, '--changed', 'src/index.ts'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ts-quality doctor/);
  assert.match(result.stdout, /changed scope: src\/index\.ts/);
  assert.match(result.stdout, /Changed TypeScript source and built runtime roots are present/);
  assert.match(result.stdout, /NODE_OPTIONS=--enable-source-maps/);
  assert.match(result.stdout, /Candidate focused test command: npm run test \(adjust to the smallest trustworthy slice\)\./);
  assert.match(result.stdout, /Commit reusable ts-quality config\/control-plane\/witness files/);
  assert.doesNotMatch(result.stdout, /--runInBand/);

  result = spawnSync('node', [cli, 'doctor', '--root', target, '--changed', 'src/index.ts', '--machine'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^TSQ_DOCTOR_MACHINE_V1\n/);
  assert.match(result.stdout, /\nconfig\tok\tpath=ts-quality\.config\.ts\n/);
  assert.match(result.stdout, /\nchanged\tok\tfiles=src\/index\.ts\n/);
  assert.match(result.stdout, /\nrisk\twarn\tsource-dist-coverage-risk\t/);
  assert.match(result.stdout, /\nrecommend\tsource-map\tsource-map-coverage\t.*NODE_OPTIONS=--enable-source-maps/);
  assert.match(result.stdout, /\nrecommend\tfocused-test\tfocused-test-command\tCandidate focused test command: npm run test \(adjust to the smallest trustworthy slice\)\.\tcommand_arg=npm\tcommand_arg=run\tcommand_arg=test/);
  assert.match(result.stdout, /\nrecommend\twitness\twitness-command-shape\t.*\tcommand_arg=ts-quality\tcommand_arg=witness\tcommand_arg=test/);
  assert.match(result.stdout, /\nrecommend\tartifact-retention\tartifact-retention-policy\tCommit reusable ts-quality config\/control-plane\/witness files/);
  assert.doesNotMatch(result.stdout, /--runInBand/);
  assert.doesNotMatch(result.stdout, /^[{[]/);

  result = spawnSync('node', [cli, 'retention', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ts-quality artifact retention plan/);
  assert.match(result.stdout, /Commit\/review reusable artifacts:/);
  assert.match(result.stdout, /ts-quality\.config\.ts/);
  assert.match(result.stdout, /\.ts-quality\/keys\/sample\.pub\.pem/);
  assert.doesNotMatch(result.stdout, /- \[present\] \.ts-quality\/keys\/sample\.pem — trusted public verification key/);
  assert.match(result.stdout, /- \[present\] \.ts-quality\/keys\/sample\.pem — private signing key material/);
  assert.match(result.stdout, /\.ts-quality\/runs\//);
  assert.match(result.stdout, /private key material should not be committed: \.ts-quality\/keys\/sample\.pem/);

  result = spawnSync('node', [cli, 'retention', '--root', target, '--machine'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^TSQ_RETENTION_PLAN_V1\n/);
  assert.match(result.stdout, /\nkeep\tpresent\tts-quality\.config\.ts\treason=ts-quality configuration/);
  assert.match(result.stdout, /\nkeep\tpresent\t\.ts-quality\/keys\/sample\.pub\.pem\treason=trusted public verification key/);
  assert.doesNotMatch(result.stdout, /\nkeep\tpresent\t\.ts-quality\/keys\/sample\.pem/);
  assert.match(result.stdout, /\nignore\tpresent\t\.ts-quality\/keys\/sample\.pem\treason=private signing key material/);
  assert.match(result.stdout, /\nignore\tpattern\t\.ts-quality\/runs\//);
  assert.match(result.stdout, /\nwarning\tprivate key material should not be committed: \.ts-quality\/keys\/sample\.pem/);
});

test('Scenario: a Bun runner hidden behind a repo-local shell wrapper is still detected', () => {
  // Given a test script that delegates to scripts/run-tests.sh, which runs bun test
  const target = doctorTarget({
    'package.json': JSON.stringify({ scripts: { test: 'scripts/run-tests.sh' } }),
    'bun.lock': '',
    'scripts/run-tests.sh': '#!/usr/bin/env bash\nset -euo pipefail\nbun test --timeout 5000 "$@"\n'
  });
  assert.equal(spawnSync('node', [cli, 'init', '--root', target], { encoding: 'utf8' }).status, 0);
  // When doctor inspects the repository
  const stdout = doctorMachine(target);
  // Then the default node:test mutation command is flagged against the real Bun runner
  assert.match(stdout, /\nrisk\twarn\tmutation-test-runner-mismatch\tmutations\.testCommand runs node:test but the repository test script runs bun\.\t/);
  // And the coverage advice is a Bun command that writes LCOV
  assert.match(stdout, /\nrecommend\tcoverage\tcoverage-generate-command\t[^\n]*\tcommand_arg=bun\tcommand_arg=test\tcommand_arg=--coverage\tcommand_arg=--coverage-reporter=lcov\tcommand_arg=--coverage-dir=coverage\n/);
});

test('Scenario: a coverage-named script that writes no LCOV is not recommended as the coverage command', () => {
  // Given a test:coverage script whose wrapper runs bun test --coverage without an LCOV reporter
  const target = doctorTarget({
    'package.json': JSON.stringify({ scripts: { test: 'bun test', 'test:coverage': 'scripts/run-coverage-tests.sh' } }),
    'bun.lock': '',
    'scripts/run-coverage-tests.sh': '#!/usr/bin/env bash\nbun test --coverage $TARGETS\n'
  });
  // When doctor inspects the repository
  const stdout = doctorMachine(target);
  // Then the script is not a coverage candidate and the operator is told why
  assert.match(stdout, /\nscripts\tnames=test,test:coverage\tcoverage=\t/);
  assert.match(stdout, /\nrisk\twarn\tcoverage-script-without-lcov\tScript test:coverage runs coverage but writes no LCOV\.\t/);
  // And the recommendation is the LCOV-writing Bun command instead
  assert.match(stdout, /\tcommand_arg=bun\tcommand_arg=test\tcommand_arg=--coverage\tcommand_arg=--coverage-reporter=lcov\t/);
});

test('Scenario: coverage scripts that do or may write LCOV stay candidates', () => {
  // Given Jest coverage (LCOV is a default Jest reporter) and an opaque make target
  const target = doctorTarget({
    'package.json': JSON.stringify({ scripts: { test: 'jest', coverage: 'jest --coverage', 'coverage:ci': 'make coverage' } })
  });
  // When doctor inspects the repository
  const stdout = doctorMachine(target);
  // Then both remain candidates and nothing is flagged as LCOV-less
  assert.match(stdout, /\nscripts\tnames=coverage,coverage:ci,test\tcoverage=coverage,coverage:ci\t/);
  assert.doesNotMatch(stdout, /coverage-script-without-lcov/);
});

test('Scenario: doctor never reads wrapper scripts outside the repository', () => {
  // Given a test script that points outside the root and a symlinked wrapper that escapes it
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-outside-'));
  fs.writeFileSync(path.join(outside, 'run.sh'), 'bun test\n', 'utf8');
  const target = doctorTarget({
    'package.json': JSON.stringify({ scripts: { test: 'bash ../' + path.basename(outside) + '/run.sh', 'test:link': 'scripts/link.sh' } })
  });
  fs.mkdirSync(path.join(target, 'scripts'), { recursive: true });
  fs.symlinkSync(path.join(outside, 'run.sh'), path.join(target, 'scripts', 'link.sh'));
  assert.equal(spawnSync('node', [cli, 'init', '--root', target], { encoding: 'utf8' }).status, 0);
  // When doctor inspects the repository
  const stdout = doctorMachine(target);
  // Then no runner is inferred from outside content
  assert.doesNotMatch(stdout, /runs bun/);
});

test('Scenario: init --preset jest writes package-manager-aware Jest commands that doctor accepts', () => {
  // Given a Yarn repository whose tests run with Jest
  const target = doctorTarget({
    'package.json': JSON.stringify({ scripts: { test: 'jest' } }),
    'yarn.lock': ''
  });
  // When the operator initializes with the Jest preset
  const init = spawnSync('node', [cli, 'init', '--root', target, '--preset', 'jest'], { encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr);
  const configText = fs.readFileSync(path.join(target, 'ts-quality.config.ts'), 'utf8');
  // Then coverage and mutation commands run Jest through Yarn, with LCOV output
  assert.match(configText, /generateCommand: \['yarn', 'run', 'jest', '--coverage', '--coverageReporters=lcov', '--coverageDirectory=coverage'\]/);
  assert.match(configText, /testCommand: \['yarn', 'run', 'jest', '--runInBand'\]/);
  // And doctor sees no runner mismatch
  assert.doesNotMatch(doctorMachine(target), /mutation-test-runner-mismatch/);
  // And the preset is discoverable from help
  const help = spawnSync('node', [cli, 'init', '--help'], { encoding: 'utf8' });
  assert.match(help.stdout, /--preset default\|node-test\|node-test-ts-dist\|vitest\|jest/);
});

test('doctor and check treat colocated tests as tests and give Jest-aware coverage and runner advice', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-doctor-jest-'));
  fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }, null, 2), 'utf8');
  fs.mkdirSync(path.join(target, 'src', '__tests__'), { recursive: true });
  fs.writeFileSync(path.join(target, 'src', 'a.ts'), 'export function a(value: number) { return value > 0; }\n', 'utf8');
  fs.writeFileSync(path.join(target, 'src', '__tests__', 'a.test.ts'), "import { a } from '../a';\ntest('a', () => { expect(a(1)).toBe(true); });\n", 'utf8');
  let result = spawnSync('node', [cli, 'init', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  result = spawnSync('node', [cli, 'doctor', '--root', target, '--changed', 'src/a.ts', '--machine'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  // Colocated tests under src/ are tests, not source.
  assert.match(result.stdout, /\nfiles\tsources=1\ttests=1\n/);
  assert.match(result.stdout, /\nrecommend\tcoverage\tcoverage-generate-command\t[^\n]*\tcommand_arg=npm\tcommand_arg=run\tcommand_arg=test\tcommand_arg=--\tcommand_arg=--coverage\tcommand_arg=--coverageReporters=lcov\tcommand_arg=--coverageDirectory=coverage\n/);
  assert.match(result.stdout, /\nrisk\twarn\tmutation-test-runner-mismatch\tmutations\.testCommand runs node:test but the repository test script runs jest\.\t/);

  const configPath = path.join(target, 'ts-quality.config.ts');
  fs.writeFileSync(configPath, fs.readFileSync(configPath, 'utf8').replace("testCommand: ['node', '--test']", "testCommand: ['node', '-e', '0']"), 'utf8');
  result = spawnSync('node', [cli, 'check', '--root', target, '--changed', 'src/a.ts', '--run-id', 'colocated'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const run = JSON.parse(fs.readFileSync(path.join(target, '.ts-quality', 'runs', 'colocated', 'run.json'), 'utf8'));
  assert.deepEqual(run.files.map((item) => item.filePath), ['src/a.ts']);
});

test('doctor never recommends lifecycle or destructive scripts and flags only source code outside sourcePatterns', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-doctor-lifecycle-'));
  fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({
    scripts: { pretest: 'rimraf dist', test: 'vitest run', 'test:clean': 'rm -rf coverage' }
  }, null, 2), 'utf8');
  fs.mkdirSync(path.join(target, 'src'), { recursive: true });
  fs.mkdirSync(path.join(target, 'test'), { recursive: true });
  fs.writeFileSync(path.join(target, 'src', 'a.ts'), 'export const a = 1;\n', 'utf8');
  fs.writeFileSync(path.join(target, 'test', 'a.test.ts'), 'test("a", () => {});\n', 'utf8');
  fs.writeFileSync(path.join(target, 'README.md'), '# a\n', 'utf8');
  let result = spawnSync('node', [cli, 'init', '--root', target, '--preset', 'vitest'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  result = spawnSync('node', [cli, 'doctor', '--root', target, '--changed', 'src/a.ts,test/a.test.ts,README.md', '--machine'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\nscripts\tnames=pretest,test,test:clean\tcoverage=\ttests=test\n/);
  assert.match(result.stdout, /\nrecommend\tfocused-test\tfocused-test-command\tCandidate focused test command: npm run test /);
  assert.doesNotMatch(result.stdout, /changed-outside-source-patterns/);

  result = spawnSync('node', [cli, 'doctor', '--root', target, '--changed', 'lib/b.ts,README.md', '--machine'], { encoding: 'utf8' });
  assert.match(result.stdout, /\nrisk\twarn\tchanged-outside-source-patterns\tChanged files are outside sourcePatterns: lib\/b\.ts\.\t/);
});

test('doctor gives pnpm workspaces safe coverage, package-manager, and source-pattern guidance', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-doctor-pnpm-'));
  fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({
    packageManager: 'pnpm@10.30.3',
    scripts: { clean: 'rimraf coverage .turbo packages/*/dist', test: 'vitest --config vitest.config.ts run' }
  }, null, 2), 'utf8');
  fs.mkdirSync(path.join(target, 'packages', 'react', 'src'), { recursive: true });
  fs.writeFileSync(path.join(target, 'packages', 'react', 'src', 'index.tsx'), 'export const View = () => <div />;\n', 'utf8');
  let result = spawnSync('node', [cli, 'init', '--root', target, '--preset', 'vitest'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  result = spawnSync('node', [cli, 'doctor', '--root', target, '--changed', 'packages/react/src/index.tsx', '--machine'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\nscripts\tnames=clean,test\tcoverage=\ttests=test\n/);
  assert.doesNotMatch(result.stdout, /command_arg=clean/);
  assert.match(result.stdout, /\nrisk\twarn\tchanged-outside-source-patterns\tChanged files are outside sourcePatterns: packages\/react\/src\/index\.tsx\.\thint=.*packages\/\*\/src/);
  assert.match(result.stdout, /\nrecommend\tfocused-test\tfocused-test-command\tCandidate focused test command: pnpm run test \(adjust to the smallest trustworthy slice\)\.\tcommand_arg=pnpm\tcommand_arg=run\tcommand_arg=test/);
});

test('adopt copies reusable pilot assets from a run without ephemeral artifacts', () => {
  const source = tempCopyOfFixture('governed-app');
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-adopt-target-'));
  const customInvariants = path.join(source, 'quality', 'custom-invariants.ts');
  fs.mkdirSync(path.dirname(customInvariants), { recursive: true });
  fs.copyFileSync(path.join(source, '.ts-quality', 'invariants.ts'), customInvariants);
  fs.rmSync(path.join(source, '.ts-quality', 'invariants.ts'));
  fs.writeFileSync(
    path.join(source, 'ts-quality.config.ts'),
    fs.readFileSync(path.join(source, 'ts-quality.config.ts'), 'utf8').replace("invariantsPath: '.ts-quality/invariants.ts'", "invariantsPath: 'quality/custom-invariants.ts'"),
    'utf8'
  );
  const out = '.ts-quality/witnesses/auth-refresh-expired-boundary.json';
  const witness = spawnSync('node', [
    cli,
    'witness',
    'test',
    '--root', source,
    '--invariant', 'auth.refresh.validity',
    '--scenario', 'expired-boundary',
    '--source-files', 'src/auth/token.js',
    '--test-files', 'test/token.test.js',
    '--out', out,
    '--',
    'node', '--test', 'test/token.test.js'
  ], { encoding: 'utf8' });
  assert.equal(witness.status, 0, witness.stderr);
  const check = spawnSync('node', [cli, 'check', '--root', source, '--run-id', 'adopt-source-run'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const runJsonPath = path.join(source, '.ts-quality', 'runs', 'adopt-source-run', 'run.json');
  const unsafeWitness = path.join(source, '.ts-quality', 'witnesses', 'unsafe-outside-root.json');
  fs.symlinkSync('/etc/hosts', unsafeWitness);
  const runJson = JSON.parse(fs.readFileSync(runJsonPath, 'utf8'));
  runJson.behaviorClaims[0].evidenceSummary.executionWitnessFiles.push('.ts-quality/witnesses/unsafe-outside-root.json');
  fs.writeFileSync(runJsonPath, `${JSON.stringify(runJson, null, 2)}\n`, 'utf8');

  fs.mkdirSync(path.join(target, '.ts-quality'), { recursive: true });
  fs.copyFileSync(path.join(source, '.ts-quality', 'agents.ts'), path.join(target, '.ts-quality', 'agents.ts'));
  fs.writeFileSync(path.join(target, '.ts-quality', 'waivers.json'), '{"kept":true}\n', 'utf8');

  const adopt = spawnSync('node', [cli, 'adopt', '--root', target, '--from-run', path.join(source, '.ts-quality', 'runs', 'adopt-source-run')], { encoding: 'utf8' });
  assert.equal(adopt.status, 0, adopt.stderr);
  assert.match(adopt.stdout, /Adopted ts-quality pilot run: adopt-source-run/);
  assert.match(adopt.stdout, /copied ts-quality\.config\.ts/);
  assert.match(adopt.stdout, /copied quality\/custom-invariants\.ts/);
  assert.match(adopt.stdout, /copied \.ts-quality\/witnesses\/auth-refresh-expired-boundary\.json/);
  assert.match(adopt.stdout, /copied \.ts-quality\/keys\/sample\.pub\.pem/);
  assert.match(adopt.stdout, /skipped \.ts-quality\/agents\.ts \(already-exists-identical\)/);
  assert.match(adopt.stdout, /skipped \.ts-quality\/waivers\.json \(already-exists-different\)/);
  assert.match(adopt.stdout, /Omitted ephemeral artifacts:/);
  assert.match(adopt.stdout, /\.ts-quality\/runs\//);
  assert.match(adopt.stdout, /\.ts-quality\/mutation-manifest\.json/);

  assert.equal(fs.existsSync(path.join(target, 'ts-quality.config.ts')), true);
  assert.equal(fs.existsSync(path.join(target, 'quality', 'custom-invariants.ts')), true);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'invariants.ts')), false);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'agents.ts')), true);
  assert.equal(fs.readFileSync(path.join(target, '.ts-quality', 'waivers.json'), 'utf8'), '{"kept":true}\n');
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'keys', 'sample.pub.pem')), true);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'keys', 'sample.pem')), false);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'witnesses', 'auth-refresh-expired-boundary.json')), true);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'witnesses', 'auth-refresh-expired-boundary.receipt.json')), false);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'witnesses', 'unsafe-outside-root.json')), false);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'runs')), false);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'latest.json')), false);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'mutation-manifest.json')), false);
  assert.equal(fs.existsSync(path.join(target, 'coverage')), false);

  const jsonTarget = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-adopt-json-target-'));
  const adoptFromJson = spawnSync('node', [cli, 'adopt', '--root', jsonTarget, '--from-run', runJsonPath], { encoding: 'utf8' });
  assert.equal(adoptFromJson.status, 0, adoptFromJson.stderr);
  assert.equal(fs.existsSync(path.join(jsonTarget, 'quality', 'custom-invariants.ts')), true);
});

test('materialize exports runtime JSON artifacts and check can run from them with matching verdicts', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'materialize', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Materialized runtime config: \.ts-quality\/materialized\/ts-quality\.config\.json/);
  for (const relativePath of [
    '.ts-quality/materialized/ts-quality.config.json',
    '.ts-quality/materialized/invariants.json',
    '.ts-quality/materialized/constitution.json',
    '.ts-quality/materialized/agents.json',
    '.ts-quality/materialized/approvals.json',
    '.ts-quality/materialized/waivers.json',
    '.ts-quality/materialized/overrides.json'
  ]) {
    assert.equal(fs.existsSync(path.join(target, relativePath)), true, relativePath);
  }

  result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'source-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const sourceRun = readRun(target);

  result = spawnSync('node', [cli, 'check', '--root', target, '--config', '.ts-quality/materialized/ts-quality.config.json', '--run-id', 'materialized-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const materializedRun = JSON.parse(fs.readFileSync(path.join(target, '.ts-quality', 'runs', 'materialized-run', 'run.json'), 'utf8'));

  assert.equal(materializedRun.verdict.mergeConfidence, sourceRun.verdict.mergeConfidence);
  assert.equal(materializedRun.verdict.outcome, sourceRun.verdict.outcome);
  assert.deepEqual(materializedRun.changedFiles, sourceRun.changedFiles);
  assert.deepEqual(materializedRun.behaviorClaims.map((claim) => claim.invariantId), sourceRun.behaviorClaims.map((claim) => claim.invariantId));
  assert.equal(materializedRun.governance.length, sourceRun.governance.length);
});

test('materialized config keeps authorize output parity with source config', () => {
  const sourceTarget = tempCopyOfFixture('governed-app');
  const materializedTarget = tempCopyOfFixture('governed-app');
  const runId = 'materialized-authorize-parity-run';
  const overrideRecord = [
    {
      kind: 'override',
      by: 'maintainer',
      role: 'maintainer',
      rationale: 'Parity override after human review.',
      createdAt: '2026-01-01T00:10:00.000Z',
      targetId: `${runId}:release-bot:merge`
    }
  ];
  for (const target of [sourceTarget, materializedTarget]) {
    fs.writeFileSync(path.join(target, '.ts-quality', 'overrides.json'), `${JSON.stringify(overrideRecord, null, 2)}\n`, 'utf8');
  }

  let result = spawnSync('node', [cli, 'materialize', '--root', materializedTarget], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  result = spawnSync('node', [cli, 'check', '--root', sourceTarget, '--run-id', runId], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'check', '--root', materializedTarget, '--config', '.ts-quality/materialized/ts-quality.config.json', '--run-id', runId], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  for (const target of [sourceTarget, materializedTarget]) {
    result = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', `.ts-quality/runs/${runId}/verdict.json`, '--claims', 'ci.tests.passed', '--out', '.ts-quality/attestations/ci.tests.passed.json'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }

  const sourceAuthorize = spawnSync('node', [cli, 'authorize', '--root', sourceTarget, '--agent', 'release-bot'], { encoding: 'utf8' });
  const materializedAuthorize = spawnSync('node', [cli, 'authorize', '--root', materializedTarget, '--config', '.ts-quality/materialized/ts-quality.config.json', '--agent', 'release-bot'], { encoding: 'utf8' });
  assert.equal(sourceAuthorize.status, 0, sourceAuthorize.stderr);
  assert.equal(materializedAuthorize.status, 0, materializedAuthorize.stderr);

  const sourceDecision = JSON.parse(sourceAuthorize.stdout);
  const materializedDecision = JSON.parse(materializedAuthorize.stdout);
  assert.equal(sourceDecision.outcome, 'approve');
  assert.equal(sourceDecision.overrideUsed, 'maintainer');
  assert.deepEqual(materializedDecision, sourceDecision);
});

test('materialized config keeps amend output parity with source config', () => {
  const sourceTarget = tempCopyOfFixture('governed-app');
  const materializedTarget = tempCopyOfFixture('governed-app');
  const proposal = {
    id: 'materialized-amend-parity',
    title: 'Clarify payment approval wording',
    rationale: 'Non-sensitive wording update.',
    evidence: ['docs updated'],
    changes: [{
      action: 'replace',
      ruleId: 'payments-maintainer-approval',
      rule: {
        kind: 'approval',
        id: 'payments-maintainer-approval',
        paths: ['src/payments/**'],
        message: 'Payment changes require explicit maintainer review.',
        minApprovals: 1,
        roles: ['maintainer']
      }
    }],
    approvals: [
      { by: 'maintainer', role: 'maintainer', rationale: 'wording ok', createdAt: '2026-01-01T00:15:00.000Z', targetId: 'materialized-amend-parity' }
    ]
  };
  for (const target of [sourceTarget, materializedTarget]) {
    fs.writeFileSync(path.join(target, 'proposal.json'), `${JSON.stringify(proposal, null, 2)}\n`, 'utf8');
  }

  let result = spawnSync('node', [cli, 'materialize', '--root', materializedTarget], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const sourceAmend = spawnSync('node', [cli, 'amend', '--root', sourceTarget, '--proposal', 'proposal.json'], { encoding: 'utf8' });
  const materializedAmend = spawnSync('node', [cli, 'amend', '--root', materializedTarget, '--config', '.ts-quality/materialized/ts-quality.config.json', '--proposal', 'proposal.json'], { encoding: 'utf8' });
  assert.equal(sourceAmend.status, 0, sourceAmend.stderr);
  assert.equal(materializedAmend.status, 0, materializedAmend.stderr);

  const sourceDecision = JSON.parse(sourceAmend.stdout);
  const materializedDecision = JSON.parse(materializedAmend.stdout);
  assert.equal(sourceDecision.outcome, 'approved');
  assert.deepEqual(materializedDecision, sourceDecision);
  assert.equal(
    fs.readFileSync(path.join(materializedTarget, '.ts-quality', 'amendments', 'materialized-amend-parity.result.json'), 'utf8'),
    fs.readFileSync(path.join(sourceTarget, '.ts-quality', 'amendments', 'materialized-amend-parity.result.json'), 'utf8')
  );
  assert.equal(
    fs.readFileSync(path.join(materializedTarget, '.ts-quality', 'amendments', 'materialized-amend-parity.result.txt'), 'utf8'),
    fs.readFileSync(path.join(sourceTarget, '.ts-quality', 'amendments', 'materialized-amend-parity.result.txt'), 'utf8')
  );
});

test('materialize keeps copied diff inputs in a reserved subdirectory so they cannot overwrite canonical artifacts', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.mkdirSync(path.join(target, 'diffs'), { recursive: true });
  fs.writeFileSync(path.join(target, 'diffs', 'agents.json'), '@@ -1 +1 @@\n-bad\n+good\n', 'utf8');
  fs.writeFileSync(path.join(target, 'ts-quality.config.ts'), `export default {
  sourcePatterns: ['src/**/*.js'],
  testPatterns: ['test/**/*.js'],
  coverage: { lcovPath: 'coverage/lcov.info' },
  mutations: { testCommand: ['node', '--test'], coveredOnly: true, timeoutMs: 10000, maxSites: 4 },
  policy: { maxChangedCrap: 30, minMutationScore: 0.5, minMergeConfidence: 50 },
  changeSet: { files: ['src/auth/token.js'], diffFile: 'diffs/agents.json' },
  invariantsPath: '.ts-quality/invariants.ts',
  constitutionPath: '.ts-quality/constitution.ts',
  agentsPath: '.ts-quality/agents.ts',
  approvalsPath: '.ts-quality/approvals.json',
  waiversPath: '.ts-quality/waivers.json',
  overridesPath: '.ts-quality/overrides.json',
  attestationsDir: '.ts-quality/attestations',
  trustedKeysDir: '.ts-quality/keys'
};
`, 'utf8');

  const result = spawnSync('node', [cli, 'materialize', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'materialized', 'agents.json')), true);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'materialized', 'inputs', 'diffs', 'agents.json')), true);
  assert.doesNotMatch(fs.readFileSync(path.join(target, '.ts-quality', 'materialized', 'agents.json'), 'utf8'), /^@@/);
  const check = spawnSync('node', [cli, 'check', '--root', target, '--config', '.ts-quality/materialized/ts-quality.config.json'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
});

test('top-level help teaches the first bounded review trust contract', () => {
  const result = spawnSync('node', [cli, '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /First bounded review:/);
  assert.match(result.stdout, /ts-quality check --changed src\/file\.ts --run-id review-001/);
  assert.match(result.stdout, /First focused witness:/);
  assert.match(result.stdout, /Pick a target-repo proof command before writing the witness/);
  assert.match(result.stdout, /ts-quality witness test --invariant auth\.refresh\.validity/);
  assert.match(result.stdout, /npm run test:auth-refresh --silent/);
  assert.match(result.stdout, /check requires explicit changed scope/);
  assert.match(result.stdout, /Machine truth is under \.ts-quality\/runs\/<run-id>\//);
  assert.match(result.stdout, /retention \[--machine\]/);
  assert.equal(result.stderr, '');
});

test('retention --help renders artifact retention projection guidance', () => {
  const result = spawnSync('node', [cli, 'retention', '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: ts-quality retention/);
  assert.match(result.stdout, /TSQ_RETENTION_PLAN_V1/);
  assert.match(result.stdout, /private keys/);
  assert.equal(result.stderr, '');
});

test('check --help renders usage instead of executing analysis', () => {
  const result = spawnSync('node', [cli, 'check', '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: ts-quality check/);
  assert.match(result.stdout, /Required trust precondition: explicit changed scope/);
  assert.match(result.stdout, /configure coverage\.generateCommand so check can create missing LCOV/);
  assert.match(result.stdout, /Writes: \.ts-quality\/runs\/<run-id>/);
  assert.match(result.stdout, /pass --run-id/i);
  assert.equal(result.stderr, '');
});
