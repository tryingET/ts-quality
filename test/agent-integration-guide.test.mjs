import fs from 'fs'
import path from 'path'
import test from 'node:test'
import assert from 'assert/strict'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

test('integration guides and README point operators at brownfield, greenfield, and minimal adoption paths', () => {
  const brownfieldGuide = readRepoFile('docs/adoption/agent-integration-how-to.md')
  const greenfieldGuide = readRepoFile('docs/adoption/greenfield-bootstrap-how-to.md')
  const minimalWalkthrough = readRepoFile('docs/adoption/minimal-external-walkthrough.md')
  const commandManifest = JSON.parse(readRepoFile('docs/cli-command-manifest.json'))
  const readme = readRepoFile('README.md')

  for (const expected of [
    'docs/dev/ts-quality-current-vs-target.md',
    'docs/adoption/repo-screening-entry.template.json',
    'node scripts/register-screening-catalog.mjs --entry docs/adoption/entries/<repo>.json',
    'Screen the implementation file, not the facade barrel',
    'Use real source-map line remapping',
    'widen the net one reviewable slice at a time',
    'One-slice rollout loop',
    'docs/adoption/minimal-external-walkthrough.md'
  ]) {
    assert.equal(brownfieldGuide.includes(expected), true, `brownfield guide missing expected text: ${expected}`)
  }

  for (const expected of [
    'Use `docs/adoption/agent-integration-how-to.md` instead when the target repo already has meaningful structure',
    'Separate facade surfaces from implementation surfaces early',
    'Screen `src/**` from day one',
    'docs/dev/ts-quality-current-vs-target.md',
    'node scripts/register-screening-catalog.mjs --entry docs/adoption/entries/<repo>.json',
    'One-slice bootstrap loop',
    'docs/adoption/minimal-external-walkthrough.md'
  ]) {
    assert.equal(greenfieldGuide.includes(expected), true, `greenfield guide missing expected text: ${expected}`)
  }

  assert.equal(
    readme.includes('docs/adoption/agent-integration-how-to.md'),
    true,
    'README should point brownfield adopters at the brownfield guide',
  )
  assert.equal(
    readme.includes('docs/adoption/greenfield-bootstrap-how-to.md'),
    true,
    'README should point greenfield adopters at the greenfield guide',
  )
  assert.equal(
    readme.includes('docs/adoption/minimal-external-walkthrough.md'),
    true,
    'README should point adopters at the minimal walkthrough',
  )
  assert.equal(
    readme.includes('docs/cli-command-manifest.json'),
    true,
    'README should point harnesses at the command manifest',
  )
  assert.equal(
    readme.includes('node scripts/register-screening-catalog.mjs --entry ...'),
    true,
    'README should point adopters at central catalog registration',
  )

  for (const expected of [
    'one implementation file, one invariant, one focused witness command, and one run id',
    'ts-quality.config.json',
    '.ts-quality/invariants.ts',
    'npm run screening:check -- --changed src/auth/token.js --run-id auth-token-first-slice',
    'any blocking evidence debt is resolved or routed before widening'
  ]) {
    assert.equal(minimalWalkthrough.includes(expected), true, `minimal walkthrough missing expected text: ${expected}`)
  }

  assert.equal(commandManifest.kind, 'ts-quality-cli-command-manifest')
  for (const commandName of ['check', 'report', 'authorize', 'witness test', 'witness refresh', 'attest sign', 'amend']) {
    assert.equal(
      commandManifest.commands.some((command) => command.name === commandName),
      true,
      `command manifest missing ${commandName}`,
    )
  }
})
