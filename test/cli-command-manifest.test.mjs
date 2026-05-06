import fs from 'fs';
import path from 'path';
import test from 'node:test';
import assert from 'assert/strict';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function parseStringArray(source) {
  if (source.trim() === '') {
    return [];
  }
  return source.split(',').map((item) => item.trim().replace(/^['"]|['"]$/gu, ''));
}

function parseCliCommandContracts() {
  const cliSource = readRepoFile('packages/ts-quality/src/cli.ts');
  const contracts = new Map();
  const contractPattern = /\['([^']+)', \{ allowedValues: \[([^\]]*)\], allowedFlags: \[([^\]]*)\], maxPositionals: (\d+) \}\]/gu;
  for (const match of cliSource.matchAll(contractPattern)) {
    contracts.set(match[1], {
      allowedValueOptions: parseStringArray(match[2]),
      allowedFlagOptions: parseStringArray(match[3]),
      maxPositionals: Number(match[4])
    });
  }
  assert.equal(contracts.size > 0, true, 'failed to parse CLI command contracts');
  return contracts;
}

test('CLI command manifest stays aligned with strict CLI option contracts', () => {
  const manifest = JSON.parse(readRepoFile('docs/cli-command-manifest.json'));
  const contracts = parseCliCommandContracts();
  const manifestCommands = new Map(manifest.commands.map((command) => [command.name, command]));

  assert.equal(manifest.kind, 'ts-quality-cli-command-manifest');
  assert.equal(manifest.globalRules.strictOptionValidation, true);
  assert.equal(manifest.globalRules.duplicateValueOptionsRejected, true);
  assert.match(manifest.globalRules.changedScopeCommaList, /comma-separated/u);

  for (const [name, contract] of contracts) {
    const command = manifestCommands.get(name);
    assert.ok(command, `manifest missing command ${name}`);
    assert.deepEqual(command.allowedValueOptions, contract.allowedValueOptions, `${name} allowed value options drifted from cli.ts`);
    assert.deepEqual(command.allowedFlagOptions, contract.allowedFlagOptions, `${name} allowed flag options drifted from cli.ts`);
  }

  for (const name of manifestCommands.keys()) {
    assert.ok(contracts.has(name), `manifest documents command not present in cli.ts: ${name}`);
  }
});

test('CLI command manifest exposes the protected agent machine-readable surfaces', () => {
  const manifest = JSON.parse(readRepoFile('docs/cli-command-manifest.json'));
  const surfaces = manifest.agentConsumption.machineReadableOutput.map((surface) => `${surface.command} ${surface.mode}`);

  assert.deepEqual(surfaces, [
    'doctor --machine',
    'retention --machine',
    'report --json',
    'attest verify --json'
  ]);
  assert.equal(manifest.agentConsumption.runSelection.automationRule.includes('explicit --run-id'), true);
  assert.equal(manifest.agentConsumption.changedScope.acceptedCliShape, '--changed "src/a.ts,src/b.ts"');
  assert.equal(manifest.agentConsumption.evidenceClosure.sourceField, 'run.nextEvidenceAction');
});
