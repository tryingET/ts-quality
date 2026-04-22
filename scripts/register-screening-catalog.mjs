import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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
  readyNextSlices: [
    {
      id: 'example.next.contract',
      candidatePaths: ['src/example/next-core.ts'],
      witnessTests: ['tests/example_next_contract.test.mjs'],
      why: 'Describe why this is the next truthful screening slice.'
    }
  ],
  candidateLaterSlices: [
    {
      area: 'example later area',
      candidatePaths: ['src/example/later-core.ts'],
      witnessTests: ['tests/example_later_contract.test.mjs'],
      whyLater: 'Describe what makes this a later candidate instead of the next slice.'
    }
  ],
  targetState: [
    'Describe the target screening shape for this repo in concise, reviewable bullets.'
  ]
}

function usage() {
  console.log([
    'Usage:',
    '  node scripts/register-screening-catalog.mjs --entry <entry.json> [--catalog <catalog.json>] [--markdown <catalog.md>]',
    '  node scripts/register-screening-catalog.mjs --check [--catalog <catalog.json>] [--markdown <catalog.md>]',
    '  node scripts/register-screening-catalog.mjs --write-template <output.json>'
  ].join('\n'))
}

function parseArgs(argv) {
  const args = {
    catalogPath: defaultCatalogPath,
    markdownPath: defaultMarkdownPath
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]
    switch (arg) {
      case '--entry':
        args.entryPath = next
        index += 1
        break
      case '--catalog':
        args.catalogPath = next
        index += 1
        break
      case '--markdown':
        args.markdownPath = next
        index += 1
        break
      case '--write-template':
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

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  ensureParentDir(filePath)
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function normalizeStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new Error(`${label} must be a non-empty string array when provided`)
  }
  return [...new Set(value)].sort((left, right) => left.localeCompare(right))
}

function normalizeCurrentSlice(slice, index) {
  if (!slice || typeof slice !== 'object') {
    throw new Error(`currentSlices[${index}] must be an object`)
  }
  if (typeof slice.id !== 'string' || slice.id.length === 0) {
    throw new Error(`currentSlices[${index}].id must be a non-empty string`)
  }
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
  const currentSlices = Array.isArray(entry.currentSlices) ? entry.currentSlices.map(normalizeCurrentSlice) : []
  const readyNextSlices = Array.isArray(entry.readyNextSlices) ? entry.readyNextSlices.map(normalizeReadyNextSlice) : []
  const candidateLaterSlices = Array.isArray(entry.candidateLaterSlices) ? entry.candidateLaterSlices.map(normalizeLaterSlice) : []
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

export function normalizeCatalog(catalog) {
  if (!catalog || typeof catalog !== 'object') {
    throw new Error('catalog must be an object')
  }
  const repos = Array.isArray(catalog.repos) ? catalog.repos.map(normalizeRepoEntry) : []
  return {
    version: 1,
    repos: repos.sort((left, right) => left.repoId.localeCompare(right.repoId))
  }
}

export function upsertRepoEntry(catalog, entry) {
  const normalizedCatalog = normalizeCatalog(catalog)
  const normalizedEntry = normalizeRepoEntry(entry)
  const repos = normalizedCatalog.repos.filter((item) => item.repoId !== normalizedEntry.repoId)
  repos.push(normalizedEntry)
  return normalizeCatalog({ version: 1, repos })
}

function markdownList(items) {
  return items.map((item) => `\`${item}\``).join(', ')
}

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

function loadCatalog(catalogPath) {
  if (!fs.existsSync(catalogPath)) {
    return { version: 1, repos: [] }
  }
  return normalizeCatalog(readJson(catalogPath))
}

function writeCatalogOutputs(catalogPath, markdownPath, catalog) {
  const normalizedCatalog = normalizeCatalog(catalog)
  writeJson(catalogPath, normalizedCatalog)
  ensureParentDir(markdownPath)
  fs.writeFileSync(markdownPath, renderCatalogMarkdown(normalizedCatalog), 'utf8')
}

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

export function checkCatalogOutputs({ catalogPath = defaultCatalogPath, markdownPath = defaultMarkdownPath }) {
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
      const updated = registerRepoEntry(args)
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
    console.error((error && error.message) || String(error))
    process.exit(1)
  }
}
