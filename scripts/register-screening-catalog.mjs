// @ts-check

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/** @typedef {{ id: string, screenedPaths: string[], witnessTests: string[], status: string, facadeAliases?: string[], notes?: string }} RepoScreeningCurrentSlice */
/** @typedef {{ id: string, candidatePaths: string[], witnessTests: string[], why: string }} RepoScreeningReadyNextSlice */
/** @typedef {{ area: string, candidatePaths: string[], witnessTests: string[], whyLater: string }} RepoScreeningLaterSlice */
/** @typedef {{ repoId: string, repoPath: string, sourceOfTruth: string, adoptionStage: string, currentSlices: RepoScreeningCurrentSlice[], readyNextSlices: RepoScreeningReadyNextSlice[], candidateLaterSlices: RepoScreeningLaterSlice[], targetState: string[] }} RepoScreeningEntry */
/** @typedef {{ version: 1, repos: RepoScreeningEntry[] }} RepoScreeningCatalog */
/** @typedef {{ catalogPath: string, markdownPath: string, entryPath?: string, templatePath?: string, check?: boolean, help?: boolean }} ScriptArgs */

const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(scriptPath), '..')
const defaultCatalogPath = path.join(repoRoot, 'docs', 'adoption', 'repo-screening-catalog.json')
const defaultMarkdownPath = path.join(repoRoot, 'docs', 'adoption', 'repo-screening-catalog.md')

export const repoScreeningEntryTemplate = {
  repoId: 'softwareco/owned/example-repo',
  repoPath: '/home/tryinget/ai-society/softwareco/owned/example-repo',
  sourceOfTruth: 'docs/dev/ts-quality-current-vs-target.md',
  adoptionStage: 'planning',
  currentSlices: [
    {
      id: 'example.boundary.contract',
      screenedPaths: ['src/example/example-core.ts'],
      facadeAliases: ['src/example.ts', 'dist/example.js'],
      witnessTests: ['tests/example_contract.test.mjs'],
      status: 'planned',
      notes: 'Replace this example entry with repo-local truth before registration.'
    }
  ],
  readyNextSlices: [],
  candidateLaterSlices: [
    {
      area: 'example later area',
      candidatePaths: ['src/example/later-core.ts'],
      witnessTests: ['tests/example_later_contract.test.mjs'],
      whyLater: 'Describe what keeps this later for now. If no single slice is clearly next, leave readyNextSlices empty until one candidate has a behavior-bearing target, a focused witness, and clear boundaries.'
    }
  ],
  targetState: [
    'Describe the target screening shape for this repo in concise, reviewable bullets.'
  ]
}

/** @returns {void} */
function usage() {
  console.log([
    'Usage:',
    '  node scripts/register-screening-catalog.mjs --entry <entry.json> [--catalog <catalog.json>] [--markdown <catalog.md>]',
    '  node scripts/register-screening-catalog.mjs --check [--catalog <catalog.json>] [--markdown <catalog.md>]',
    '  node scripts/register-screening-catalog.mjs --write-template <output.json>'
  ].join('\n'))
}

/**
 * @param {string[]} argv
 * @returns {ScriptArgs}
 */
function parseArgs(argv) {
  /** @type {ScriptArgs} */
  const args = {
    catalogPath: defaultCatalogPath,
    markdownPath: defaultMarkdownPath
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]
    switch (arg) {
      case '--entry':
        if (!next) {
          throw new Error('--entry requires a path')
        }
        args.entryPath = next
        index += 1
        break
      case '--catalog':
        if (!next) {
          throw new Error('--catalog requires a path')
        }
        args.catalogPath = next
        index += 1
        break
      case '--markdown':
        if (!next) {
          throw new Error('--markdown requires a path')
        }
        args.markdownPath = next
        index += 1
        break
      case '--write-template':
        if (!next) {
          throw new Error('--write-template requires a path')
        }
        args.templatePath = next
        index += 1
        break
      case '--check':
        args.check = true
        break
      case '--help':
      case '-h':
        args.help = true
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return args
}

/** @param {string} filePath */
function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

/**
 * @param {string} filePath
 * @returns {any}
 */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

/**
 * @param {string} filePath
 * @param {unknown} value
 */
function writeJson(filePath, value) {
  ensureParentDir(filePath)
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {string[]}
 */
function normalizeStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new Error(`${label} must be a non-empty string array when provided`)
  }
  return [...new Set(value)].sort((left, right) => left.localeCompare(right))
}

/**
 * @param {any} slice
 * @param {number} index
 * @returns {RepoScreeningCurrentSlice}
 */
function normalizeCurrentSlice(slice, index) {
  if (!slice || typeof slice !== 'object') {
    throw new Error(`currentSlices[${index}] must be an object`)
  }
  if (typeof slice.id !== 'string' || slice.id.length === 0) {
    throw new Error(`currentSlices[${index}].id must be a non-empty string`)
  }
  /** @type {RepoScreeningCurrentSlice} */
  const normalized = {
    id: slice.id,
    screenedPaths: normalizeStringArray(slice.screenedPaths, `currentSlices[${index}].screenedPaths`),
    witnessTests: normalizeStringArray(slice.witnessTests, `currentSlices[${index}].witnessTests`),
    status: typeof slice.status === 'string' && slice.status.length > 0 ? slice.status : 'unknown'
  }
  if (Array.isArray(slice.facadeAliases) && slice.facadeAliases.length > 0) {
    normalized.facadeAliases = normalizeStringArray(slice.facadeAliases, `currentSlices[${index}].facadeAliases`)
  }
  if (typeof slice.notes === 'string' && slice.notes.length > 0) {
    normalized.notes = slice.notes
  }
  return normalized
}

/**
 * @param {any} slice
 * @param {number} index
 * @returns {RepoScreeningReadyNextSlice}
 */
function normalizeReadyNextSlice(slice, index) {
  if (!slice || typeof slice !== 'object') {
    throw new Error(`readyNextSlices[${index}] must be an object`)
  }
  if (typeof slice.id !== 'string' || slice.id.length === 0) {
    throw new Error(`readyNextSlices[${index}].id must be a non-empty string`)
  }
  return {
    id: slice.id,
    candidatePaths: normalizeStringArray(slice.candidatePaths, `readyNextSlices[${index}].candidatePaths`),
    witnessTests: normalizeStringArray(slice.witnessTests, `readyNextSlices[${index}].witnessTests`),
    why: typeof slice.why === 'string' && slice.why.length > 0
      ? slice.why
      : 'Explain why this is the next truthful slice for the repo.'
  }
}

/**
 * @param {any} slice
 * @param {number} index
 * @returns {RepoScreeningLaterSlice}
 */
function normalizeLaterSlice(slice, index) {
  if (!slice || typeof slice !== 'object') {
    throw new Error(`candidateLaterSlices[${index}] must be an object`)
  }
  if (typeof slice.area !== 'string' || slice.area.length === 0) {
    throw new Error(`candidateLaterSlices[${index}].area must be a non-empty string`)
  }
  return {
    area: slice.area,
    candidatePaths: normalizeStringArray(slice.candidatePaths, `candidateLaterSlices[${index}].candidatePaths`),
    witnessTests: normalizeStringArray(slice.witnessTests, `candidateLaterSlices[${index}].witnessTests`),
    whyLater: typeof slice.whyLater === 'string' && slice.whyLater.length > 0
      ? slice.whyLater
      : 'Explain why this remains a later candidate.'
  }
}

/**
 * @param {any} entry
 * @returns {RepoScreeningEntry}
 */
export function normalizeRepoEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('repo screening entry must be an object')
  }
  if (typeof entry.repoId !== 'string' || entry.repoId.length === 0) {
    throw new Error('repoId must be a non-empty string')
  }
  if (typeof entry.repoPath !== 'string' || entry.repoPath.length === 0) {
    throw new Error('repoPath must be a non-empty string')
  }
  if (typeof entry.sourceOfTruth !== 'string' || entry.sourceOfTruth.length === 0) {
    throw new Error('sourceOfTruth must be a non-empty string')
  }
  if (typeof entry.adoptionStage !== 'string' || entry.adoptionStage.length === 0) {
    throw new Error('adoptionStage must be a non-empty string')
  }
  /** @type {RepoScreeningCurrentSlice[]} */
  const currentSlices = []
  if (Array.isArray(entry.currentSlices)) {
    for (let index = 0; index < entry.currentSlices.length; index += 1) {
      currentSlices.push(normalizeCurrentSlice(entry.currentSlices[index], index))
    }
  }
  /** @type {RepoScreeningReadyNextSlice[]} */
  const readyNextSlices = []
  if (Array.isArray(entry.readyNextSlices)) {
    for (let index = 0; index < entry.readyNextSlices.length; index += 1) {
      readyNextSlices.push(normalizeReadyNextSlice(entry.readyNextSlices[index], index))
    }
  }
  /** @type {RepoScreeningLaterSlice[]} */
  const candidateLaterSlices = []
  if (Array.isArray(entry.candidateLaterSlices)) {
    for (let index = 0; index < entry.candidateLaterSlices.length; index += 1) {
      candidateLaterSlices.push(normalizeLaterSlice(entry.candidateLaterSlices[index], index))
    }
  }
  const targetState = Array.isArray(entry.targetState) ? normalizeStringArray(entry.targetState, 'targetState') : []

  return {
    repoId: entry.repoId,
    repoPath: entry.repoPath,
    sourceOfTruth: entry.sourceOfTruth,
    adoptionStage: entry.adoptionStage,
    currentSlices: currentSlices.sort((left, right) => left.id.localeCompare(right.id)),
    readyNextSlices: readyNextSlices.sort((left, right) => left.id.localeCompare(right.id)),
    candidateLaterSlices: candidateLaterSlices.sort((left, right) => left.area.localeCompare(right.area)),
    targetState
  }
}

/**
 * @param {any} catalog
 * @returns {RepoScreeningCatalog}
 */
export function normalizeCatalog(catalog) {
  if (!catalog || typeof catalog !== 'object') {
    throw new Error('catalog must be an object')
  }
  /** @type {RepoScreeningEntry[]} */
  const repos = []
  if (Array.isArray(catalog.repos)) {
    for (const repoEntry of catalog.repos) {
      repos.push(normalizeRepoEntry(repoEntry))
    }
  }
  return {
    version: 1,
    repos: repos.sort((left, right) => left.repoId.localeCompare(right.repoId))
  }
}

/**
 * @param {any} catalog
 * @param {any} entry
 * @returns {RepoScreeningCatalog}
 */
export function upsertRepoEntry(catalog, entry) {
  const normalizedCatalog = normalizeCatalog(catalog)
  const normalizedEntry = normalizeRepoEntry(entry)
  const repos = normalizedCatalog.repos.filter((item) => item.repoId !== normalizedEntry.repoId)
  repos.push(normalizedEntry)
  return normalizeCatalog({ version: 1, repos })
}

/**
 * @param {string[]} items
 * @returns {string}
 */
function markdownList(items) {
  return items.map((item) => `\`${item}\``).join(', ')
}

/**
 * @param {any} catalog
 * @returns {string}
 */
export function renderCatalogMarkdown(catalog) {
  const normalizedCatalog = normalizeCatalog(catalog)
  const lines = [
    '---',
    'summary: "Cross-repo overview of repo-local ts-quality screening rollout status."',
    'read_when:',
    '  - "You need a central view of repo-local ts-quality screening adoption."',
    '  - "You want to compare current live slices vs next-target slices across repos."',
    'type: "reference"',
    '---',
    '',
    '# Repo screening catalog',
    '',
    '_Generated from `docs/adoption/repo-screening-catalog.json` via `node scripts/register-screening-catalog.mjs --check`._',
    '',
    'This is a downstream cross-repo overview.',
    'Repo-local truth still lives in each registered repo\'s own current-vs-target file.',
    '',
    'Template for new registrations:',
    '- `docs/adoption/repo-screening-entry.template.json`',
    '',
    'Registration command:',
    '',
    '```bash',
    'node scripts/register-screening-catalog.mjs --entry docs/adoption/entries/<repo>.json',
    '```',
    ''
  ]

  for (const repo of normalizedCatalog.repos) {
    lines.push(`## ${repo.repoId}`)
    lines.push('')
    lines.push(`- repo path: \`${repo.repoPath}\``)
    lines.push(`- source of truth: \`${repo.sourceOfTruth}\``)
    lines.push(`- adoption stage: \`${repo.adoptionStage}\``)
    lines.push(`- live slices: ${repo.currentSlices.length}`)
    lines.push(`- ready-next slices: ${repo.readyNextSlices.length}`)
    lines.push('')

    lines.push('### Current live slices')
    lines.push('')
    if (repo.currentSlices.length === 0) {
      lines.push('- none registered yet')
    } else {
      for (const slice of repo.currentSlices) {
        lines.push(`- \`${slice.id}\``)
        lines.push(`  - screened paths: ${markdownList(slice.screenedPaths)}`)
        if (slice.facadeAliases && slice.facadeAliases.length > 0) {
          lines.push(`  - facade/runtime aliases: ${markdownList(slice.facadeAliases)}`)
        }
        lines.push(`  - witness tests: ${markdownList(slice.witnessTests)}`)
        lines.push(`  - status: \`${slice.status}\``)
        if (slice.notes) {
          lines.push(`  - notes: ${slice.notes}`)
        }
      }
    }
    lines.push('')

    lines.push('### Ready-next slices')
    lines.push('')
    if (repo.readyNextSlices.length === 0) {
      lines.push('- none registered yet')
    } else {
      for (const slice of repo.readyNextSlices) {
        lines.push(`- \`${slice.id}\``)
        lines.push(`  - candidate paths: ${markdownList(slice.candidatePaths)}`)
        lines.push(`  - witness tests: ${markdownList(slice.witnessTests)}`)
        lines.push(`  - why next: ${slice.why}`)
      }
    }
    lines.push('')

    lines.push('### Candidate later slices')
    lines.push('')
    if (repo.candidateLaterSlices.length === 0) {
      lines.push('- none registered yet')
    } else {
      for (const slice of repo.candidateLaterSlices) {
        lines.push(`- ${slice.area}`)
        lines.push(`  - candidate paths: ${markdownList(slice.candidatePaths)}`)
        lines.push(`  - witness tests: ${markdownList(slice.witnessTests)}`)
        lines.push(`  - why later: ${slice.whyLater}`)
      }
    }
    lines.push('')

    lines.push('### Target state')
    lines.push('')
    if (repo.targetState.length === 0) {
      lines.push('- no target state recorded yet')
    } else {
      for (const item of repo.targetState) {
        lines.push(`- ${item}`)
      }
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

/**
 * @param {string} catalogPath
 * @returns {RepoScreeningCatalog}
 */
function loadCatalog(catalogPath) {
  if (!fs.existsSync(catalogPath)) {
    return { version: 1, repos: [] }
  }
  return normalizeCatalog(readJson(catalogPath))
}

/**
 * @param {string} catalogPath
 * @param {string} markdownPath
 * @param {any} catalog
 */
function writeCatalogOutputs(catalogPath, markdownPath, catalog) {
  const normalizedCatalog = normalizeCatalog(catalog)
  writeJson(catalogPath, normalizedCatalog)
  ensureParentDir(markdownPath)
  fs.writeFileSync(markdownPath, renderCatalogMarkdown(normalizedCatalog), 'utf8')
}

/**
 * @param {{ entryPath: string, catalogPath?: string, markdownPath?: string }} params
 * @returns {RepoScreeningCatalog}
 */
export function registerRepoEntry({ entryPath, catalogPath = defaultCatalogPath, markdownPath = defaultMarkdownPath }) {
  if (!entryPath) {
    throw new Error('--entry requires a path')
  }
  const catalog = loadCatalog(catalogPath)
  const entry = normalizeRepoEntry(readJson(path.resolve(entryPath)))
  const updated = upsertRepoEntry(catalog, entry)
  writeCatalogOutputs(catalogPath, markdownPath, updated)
  return updated
}

/**
 * @param {{ catalogPath?: string, markdownPath?: string }} [params={}]
 * @returns {void}
 */
export function checkCatalogOutputs({ catalogPath = defaultCatalogPath, markdownPath = defaultMarkdownPath } = {}) {
  if (!fs.existsSync(catalogPath)) {
    throw new Error(`catalog file not found: ${catalogPath}`)
  }
  if (!fs.existsSync(markdownPath)) {
    throw new Error(`markdown file not found: ${markdownPath}`)
  }
  const catalog = normalizeCatalog(readJson(catalogPath))
  const expected = renderCatalogMarkdown(catalog)
  const actual = fs.readFileSync(markdownPath, 'utf8')
  if (actual !== expected) {
    throw new Error('repo screening catalog markdown is out of date; run the registration command again')
  }
}

/**
 * @param {string} templatePath
 * @returns {void}
 */
function writeTemplate(templatePath) {
  if (!templatePath) {
    throw new Error('--write-template requires a path')
  }
  writeJson(path.resolve(templatePath), repoScreeningEntryTemplate)
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    const args = parseArgs(process.argv.slice(2))
    if (args.help) {
      usage()
      process.exit(0)
    }
    if (args.templatePath) {
      writeTemplate(args.templatePath)
      console.log(`wrote template: ${args.templatePath}`)
      process.exit(0)
    }
    if (args.entryPath) {
      const updated = registerRepoEntry({
        entryPath: args.entryPath,
        catalogPath: args.catalogPath,
        markdownPath: args.markdownPath
      })
      console.log(`registered ${updated.repos.length} repo entr${updated.repos.length === 1 ? 'y' : 'ies'}`)
      process.exit(0)
    }
    if (args.check) {
      checkCatalogOutputs(args)
      console.log('repo screening catalog: ok')
      process.exit(0)
    }
    usage()
    process.exit(1)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
