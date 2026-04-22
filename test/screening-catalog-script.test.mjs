import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import test from 'node:test'
import assert from 'assert/strict'
import { repoRoot } from './helpers.mjs'

const scriptPath = path.join(repoRoot, 'scripts', 'register-screening-catalog.mjs')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

test('register-screening-catalog writes a template, upserts one repo entry, and keeps markdown in sync', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-screening-catalog-'))
  const catalogPath = path.join(tempDir, 'repo-screening-catalog.json')
  const markdownPath = path.join(tempDir, 'repo-screening-catalog.md')
  const templatePath = path.join(tempDir, 'repo-screening-entry.template.json')
  const entryPath = path.join(tempDir, 'repo-entry.json')

  try {
    const writeTemplate = spawnSync('node', [scriptPath, '--write-template', templatePath], {
      cwd: repoRoot,
      encoding: 'utf8'
    })
    assert.equal(writeTemplate.status, 0, writeTemplate.stderr)
    const template = readJson(templatePath)
    assert.equal(template.repoId, 'softwareco/owned/example-repo')

    fs.writeFileSync(catalogPath, JSON.stringify({ version: 1, repos: [] }, null, 2))
    fs.writeFileSync(entryPath, JSON.stringify({
      ...template,
      repoId: 'softwareco/owned/test-fixture',
      repoPath: '/tmp/test-fixture',
      sourceOfTruth: 'docs/dev/ts-quality-current-vs-target.md',
      adoptionStage: 'live-first-slice',
      currentSlices: [
        {
          id: 'fixture.boundary.contract',
          screenedPaths: ['src/fixture/core.ts'],
          facadeAliases: ['src/fixture.ts'],
          witnessTests: ['tests/fixture_contract.test.mjs'],
          status: 'supported',
          notes: 'Registered from the script regression test.'
        }
      ],
      readyNextSlices: [
        {
          id: 'fixture.next.contract',
          candidatePaths: ['src/fixture/next-core.ts'],
          witnessTests: ['tests/fixture_next_contract.test.mjs'],
          why: 'Narrow next slice.'
        }
      ],
      candidateLaterSlices: [
        {
          area: 'fixture later area',
          candidatePaths: ['src/fixture/later-core.ts'],
          witnessTests: ['tests/fixture_later_contract.test.mjs'],
          whyLater: 'Broader than the next slice.'
        }
      ],
      targetState: ['Cover the high-risk fixture boundary.']
    }, null, 2))

    const register = spawnSync('node', [
      scriptPath,
      '--catalog', catalogPath,
      '--markdown', markdownPath,
      '--entry', entryPath
    ], {
      cwd: repoRoot,
      encoding: 'utf8'
    })
    assert.equal(register.status, 0, register.stderr)

    const catalog = readJson(catalogPath)
    const markdown = fs.readFileSync(markdownPath, 'utf8')
    assert.equal(catalog.repos.length, 1)
    assert.equal(catalog.repos[0].repoId, 'softwareco/owned/test-fixture')
    assert.match(markdown, /## softwareco\/owned\/test-fixture/)
    assert.match(markdown, /fixture\.boundary\.contract/)
    assert.match(markdown, /fixture\.next\.contract/)

    fs.writeFileSync(entryPath, JSON.stringify({
      ...readJson(entryPath),
      adoptionStage: 'two-live-slices'
    }, null, 2))

    const update = spawnSync('node', [
      scriptPath,
      '--catalog', catalogPath,
      '--markdown', markdownPath,
      '--entry', entryPath
    ], {
      cwd: repoRoot,
      encoding: 'utf8'
    })
    assert.equal(update.status, 0, update.stderr)
    const updatedCatalog = readJson(catalogPath)
    assert.equal(updatedCatalog.repos.length, 1)
    assert.equal(updatedCatalog.repos[0].adoptionStage, 'two-live-slices')

    const check = spawnSync('node', [
      scriptPath,
      '--catalog', catalogPath,
      '--markdown', markdownPath,
      '--check'
    ], {
      cwd: repoRoot,
      encoding: 'utf8'
    })
    assert.equal(check.status, 0, check.stderr)
    assert.match(check.stdout, /repo screening catalog: ok/)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})
