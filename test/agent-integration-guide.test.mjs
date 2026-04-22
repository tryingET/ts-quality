import fs from 'fs'
import path from 'path'
import test from 'node:test'
import assert from 'assert/strict'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

test('integration guides and README point operators at brownfield and greenfield adoption paths', () => {
  const brownfieldGuide = readRepoFile('docs/adoption/agent-integration-how-to.md')
  const greenfieldGuide = readRepoFile('docs/adoption/greenfield-bootstrap-how-to.md')
  const readme = readRepoFile('README.md')

  for (const expected of [
    'docs/dev/ts-quality-current-vs-target.md',
    'docs/adoption/repo-screening-entry.template.json',
    'node scripts/register-screening-catalog.mjs --entry docs/adoption/entries/<repo>.json',
    'Screen the implementation file, not the facade barrel',
    'Use real source-map line remapping',
    'widen the net one reviewable slice at a time'
  ]) {
    assert.equal(brownfieldGuide.includes(expected), true, `brownfield guide missing expected text: ${expected}`)
  }

  for (const expected of [
    'For brownfield integrations, use `docs/adoption/agent-integration-how-to.md` instead.',
    'Separate facade surfaces from implementation surfaces early',
    'Screen `src/**` from day one',
    'docs/dev/ts-quality-current-vs-target.md',
    'node scripts/register-screening-catalog.mjs --entry docs/adoption/entries/<repo>.json'
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
    readme.includes('node scripts/register-screening-catalog.mjs --entry ...'),
    true,
    'README should point adopters at central catalog registration',
  )
})
