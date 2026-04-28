// @ts-check

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '..');
const packageName = 'ts-quality';
const repoSlug = 'tryingET/ts-quality';

/** @typedef {{ status: number | null, stdout: string, stderr: string }} CommandResult */
/** @typedef {Record<string, string | boolean>} CliOptions */

/** @param {string} filePath */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * @param {string} filePath
 * @param {unknown} value
 */
function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {Record<string, string>} [env]
 * @returns {CommandResult}
 */
function run(command, args, env = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });
  return {
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {Record<string, string>} [env]
 * @returns {string}
 */
function runRequired(command, args, env = {}) {
  const result = run(command, args, env);
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`.trim());
  }
  return result.stdout;
}

/** @param {number} milliseconds */
function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

/**
 * @param {string} label
 * @param {string} command
 * @param {string[]} args
 * @param {Record<string, string>} [env]
 * @param {number} [attempts]
 * @param {string} [retryReason]
 * @param {string} [exhaustedReason]
 * @returns {string}
 */
function runRequiredWithRetry(label, command, args, env = {}, attempts = 8, retryReason = 'transient failure may still be resolving', exhaustedReason = 'command failed after bounded retries') {
  /** @type {CommandResult | null} */
  let lastResult = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = run(command, args, env);
    if (result.status === 0) {
      return result.stdout;
    }
    lastResult = result;
    if (attempt < attempts) {
      console.error(`${label} attempt ${attempt}/${attempts} failed; ${retryReason}.`);
      sleep(attempt * 15_000);
    }
  }
  const stdout = lastResult?.stdout ?? '';
  const stderr = lastResult?.stderr ?? '';
  throw new Error(`${label} failed after ${attempts} attempts: ${exhaustedReason}\nCommand: ${command} ${args.join(' ')}\n${stdout}\n${stderr}`.trim());
}

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const parsed = {};
  /** @type {string[]} */
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const withoutPrefix = arg.slice(2);
    const equalsIndex = withoutPrefix.indexOf('=');
    if (equalsIndex >= 0) {
      parsed[withoutPrefix.slice(0, equalsIndex)] = withoutPrefix.slice(equalsIndex + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      parsed[withoutPrefix] = next;
      index += 1;
      continue;
    }
    parsed[withoutPrefix] = true;
  }
  return { positional, options: parsed };
}

/** @param {unknown} value */
function stringOption(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** @param {string} version */
function assertVersion(version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version)) {
    throw new Error(`Invalid SemVer-ish release version: ${version}`);
  }
}

/** @param {string} version */
function nextPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/u.exec(version);
  if (!match) {
    throw new Error(`Cannot derive next patch version from: ${version}`);
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function packageState() {
  const workspacePath = path.join(root, 'package.json');
  const publicPath = path.join(root, 'packages', packageName, 'package.json');
  const lockPath = path.join(root, 'package-lock.json');
  const workspacePackage = readJson(workspacePath);
  const publicPackage = readJson(publicPath);
  const lockPackage = fs.existsSync(lockPath) ? readJson(lockPath) : null;
  return { workspacePath, publicPath, lockPath, workspacePackage, publicPackage, lockPackage };
}

/** @param {string} version */
function releaseNotesPath(version) {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(root, 'docs', 'releases', `${date}-v${version}-github-release.md`);
}

/** @param {string} version */
function existingReleaseNotesPath(version) {
  const releaseDir = path.join(root, 'docs', 'releases');
  if (!fs.existsSync(releaseDir)) {
    return releaseNotesPath(version);
  }
  const suffix = `-v${version}-github-release.md`;
  const existing = fs.readdirSync(releaseDir).find((entry) => entry.endsWith(suffix));
  return existing ? path.join(releaseDir, existing) : releaseNotesPath(version);
}

/** @param {string} markdown */
function stripFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) {
    return markdown;
  }
  const end = markdown.indexOf('\n---\n', 4);
  return end >= 0 ? markdown.slice(end + '\n---\n'.length).trimStart() : markdown;
}

/**
 * @param {string} version
 * @param {string} notesPath
 */
function releaseTitleFromNotes(version, notesPath) {
  const markdown = stripFrontmatter(fs.readFileSync(notesPath, 'utf8'));
  const titleSection = /^## Title\s+([\s\S]*?)(?:\n## |$)/mu.exec(markdown);
  const rawTitle = titleSection?.[1]?.trim() ?? '';
  const title = rawTitle.replace(/^`([^`]+)`$/u, '$1').trim();
  if (!title) {
    throw new Error(`Release notes for v${version} must include a non-empty ## Title section.`);
  }
  if (!title.startsWith(`ts-quality v${version} `)) {
    throw new Error(`Release notes title must start with "ts-quality v${version} ", got: ${title}`);
  }
  if (title === `ts-quality v${version} — deterministic trust for TypeScript changes`) {
    throw new Error('Release notes title is still the generic fallback; curate a release-specific title before publishing.');
  }
  return title;
}

/** @param {string} markdown */
function releaseBodyFromNotes(markdown) {
  const stripped = stripFrontmatter(markdown).trimStart();
  const bodySection = /^## Release body\s+([\s\S]*)$/mu.exec(stripped);
  return `${(bodySection?.[1] ?? stripped).trim()}\n`;
}

/**
 * @param {string} markdown
 * @param {string} heading
 */
function markdownSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = new RegExp(`^### ${escaped}\\s+([\\s\\S]*?)(?:\\n### |$)`, 'mu').exec(markdown);
  return match?.[1]?.trim() ?? '';
}

/** @param {string} section */
function sectionHasMeaningfulContent(section) {
  const normalized = section.replace(/<!--([\s\S]*?)-->/gu, '').trim();
  return normalized.length > 0 && !/^(?:[-*]\s*)?(?:none|n\/a|not applicable)\.?$/iu.test(normalized);
}

/**
 * @param {string} version
 * @param {string} notesPath
 */
function assertReleaseNotesContract(version, notesPath) {
  const markdown = stripFrontmatter(fs.readFileSync(notesPath, 'utf8'));
  const body = releaseBodyFromNotes(markdown);
  releaseTitleFromNotes(version, notesPath);
  const requiredSections = ['Breaking Changes'];
  const changeSections = ['Added', 'Changed', 'Fixed'];
  const missingRequired = requiredSections.filter((heading) => !new RegExp(`^### ${heading}\\b`, 'mu').test(body));
  if (missingRequired.length > 0) {
    throw new Error(`Release notes for v${version} must include release-please-style section(s): ${missingRequired.join(', ')}.`);
  }
  if (!changeSections.some((heading) => new RegExp(`^### ${heading}\\b`, 'mu').test(body))) {
    throw new Error(`Release notes for v${version} must include at least one release-please-style change section: ${changeSections.join(', ')}.`);
  }
  if (/^### Highlights\b/mu.test(body) && !changeSections.some((heading) => sectionHasMeaningfulContent(markdownSection(body, heading)))) {
    throw new Error(`Release notes for v${version} use Highlights without categorized Added/Changed/Fixed content.`);
  }
  const breaking = markdownSection(body, 'Breaking Changes');
  if (sectionHasMeaningfulContent(breaking)) {
    const agentNotes = markdownSection(body, 'Agent migration notes');
    if (!sectionHasMeaningfulContent(agentNotes)) {
      throw new Error(`Release notes for v${version} include Breaking Changes and must include non-empty Agent migration notes for downstream agents/operators.`);
    }
  }
}

/**
 * @param {string} version
 * @param {string} notesPath
 */
function materializeGithubReleaseNotesBody(version, notesPath) {
  const outputDir = path.join(root, '.ts-quality', 'release-notes');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `v${version}.md`);
  fs.writeFileSync(outputPath, releaseBodyFromNotes(fs.readFileSync(notesPath, 'utf8')), 'utf8');
  return outputPath;
}

/**
 * @param {string} version
 * @returns {string}
 */
function changelogSectionForVersion(version) {
  const changelogPath = path.join(root, 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    return '';
  }
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const match = new RegExp(`^## \\[?${version.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\]?.*?\\n([\\s\\S]*?)(?=^## )`, 'mu').exec(changelog);
  return match?.[1]?.trim() ?? '';
}

/**
 * @param {string} version
 * @returns {string}
 */
function generatedReleaseBodyFromChangelog(version) {
  const section = changelogSectionForVersion(version);
  const breaking = markdownSection(section, 'Breaking Changes');
  const added = markdownSection(section, 'Added');
  const changed = markdownSection(section, 'Changed');
  const fixed = markdownSection(section, 'Fixed');
  const lines = [
    `This release is prepared through the repo's GitHub Release authority path. Publishing the GitHub Release for tag \`v${version}\` triggers \`.github/workflows/publish.yml\` in the \`npm-publish\` environment, which validates the tag/version contract, re-runs deterministic package proof, publishes the staged package to npm through Trusted Publishing/OIDC, verifies public installability, and attaches the proven tarball to the GitHub Release.`,
    '',
    '### Breaking Changes',
    breaking || '- None.',
    '',
    '### Added',
    added || '- None.',
    '',
    '### Changed',
    changed || '- None.',
    '',
    '### Fixed',
    fixed || '- None.',
    '',
    '### Agent migration notes',
    breaking ? '- Review each breaking-change bullet above and update any agent prompts, parsers, fixtures, or consumers that depend on the changed public artifact/CLI contract before relying on this release.' : '- No breaking-change migration is required for agents beyond ordinary release-note review.',
    '',
    '### Verification before release',
    '',
    '```bash',
    'npm run verify --silent',
    `RELEASE_TAG=v${version} GITHUB_REF_TYPE=tag npm run release:intent:check --silent`,
    '```',
    '',
    '### Install',
    '',
    '```bash',
    `npx -p ts-quality@${version} ts-quality --help`,
    '```'
  ];
  return lines.join('\n');
}

/** @param {string} version */
function inspectExternalVersion(version) {
  const tag = `v${version}`;
  const gitTag = run('git', ['tag', '--list', tag]).stdout === tag;
  const githubReleaseResult = run('gh', ['release', 'view', tag, '--repo', repoSlug, '--json', 'tagName,publishedAt,url,isDraft,isPrerelease']);
  const npmResult = run('npm', ['view', `${packageName}@${version}`, 'version', '--json']);
  return {
    tag,
    gitTag,
    githubRelease: githubReleaseResult.status === 0 ? JSON.parse(githubReleaseResult.stdout) : null,
    githubReleaseError: githubReleaseResult.status === 0 ? null : (githubReleaseResult.stderr || githubReleaseResult.stdout),
    npmPublished: npmResult.status === 0,
    npmVersion: npmResult.status === 0 ? JSON.parse(npmResult.stdout) : null,
    npmError: npmResult.status === 0 ? null : (npmResult.stderr || npmResult.stdout)
  };
}

/**
 * @param {string} version
 * @param {ReturnType<typeof inspectExternalVersion>} external
 */
function releaseBlockers(version, external) {
  /** @type {string[]} */
  const blockers = [];
  if (external.npmPublished) {
    blockers.push(`npm already has ${packageName}@${version}; npm versions are immutable.`);
  }
  if (external.githubRelease) {
    blockers.push(`GitHub Release ${external.tag} already exists; create a new version instead of reusing it.`);
  }
  return blockers;
}

/**
 * @param {string} version
 * @param {boolean} apply
 */
function updateVersions(version, apply) {
  const state = packageState();
  const files = [state.workspacePath, state.publicPath];
  if (apply) {
    state.workspacePackage.version = version;
    state.publicPackage.version = version;
    writeJson(state.workspacePath, state.workspacePackage);
    writeJson(state.publicPath, state.publicPackage);
    if (state.lockPackage) {
      state.lockPackage.version = version;
      if (state.lockPackage.packages?.['']) {
        state.lockPackage.packages[''].version = version;
      }
      writeJson(state.lockPath, state.lockPackage);
      files.push(state.lockPath);
    }
  } else if (state.lockPackage) {
    files.push(state.lockPath);
  }
  return files.map((file) => path.relative(root, file));
}

/**
 * @param {string} version
 * @param {boolean} apply
 */
function writeReleaseNotes(version, apply) {
  const notesPath = existingReleaseNotesPath(version);
  const relativeNotesPath = path.relative(root, notesPath);
  if (fs.existsSync(notesPath)) {
    assertReleaseNotesContract(version, notesPath);
    return relativeNotesPath;
  }
  const content = `---\nsummary: "GitHub release notes for ts-quality v${version}."\nread_when:\n  - "When creating the public GitHub Release for ts-quality v${version}"\ntype: "draft"\n---\n\n# GitHub release draft — ts-quality v${version}\n\n## Title\n\n\`ts-quality v${version} — release-ready evidence updates\`\n\n## Release body\n\n${generatedReleaseBodyFromChangelog(version)}\n`;
  if (apply) {
    fs.writeFileSync(notesPath, content, 'utf8');
    assertReleaseNotesContract(version, notesPath);
  }
  return relativeNotesPath;
}

/**
 * @param {string} version
 * @param {boolean} apply
 */
function updateChangelog(version, apply) {
  const changelogPath = path.join(root, 'CHANGELOG.md');
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  if (changelog.includes(`## ${version}`)) {
    return path.relative(root, changelogPath);
  }
  const date = new Date().toISOString().slice(0, 10);
  const updated = changelog.replace(/^## \[?Unreleased\]?\n/mu, (heading) => `${heading}\n## [${version}] - ${date}\n`);
  if (updated === changelog) {
    throw new Error('CHANGELOG.md is missing an `## [Unreleased]` or `## Unreleased` heading.');
  }
  if (apply) {
    fs.writeFileSync(changelogPath, updated, 'utf8');
  }
  return path.relative(root, changelogPath);
}

/** @param {CliOptions} options */
function commandPlan(options) {
  const state = packageState();
  const currentVersion = String(state.publicPackage.version ?? '').trim();
  assertVersion(currentVersion);
  const requested = stringOption(options['version']);
  const targetVersion = requested || nextPatch(currentVersion);
  assertVersion(targetVersion);
  const currentExternal = inspectExternalVersion(currentVersion);
  const targetExternal = inspectExternalVersion(targetVersion);
  const status = run('git', ['status', '--short']).stdout;
  const plan = {
    releaseAuthority: 'github-release',
    npmPublishing: 'trusted-publishing-oidc',
    currentVersion,
    recommendedTargetVersion: targetVersion,
    dirtyWorktree: status.length > 0,
    currentVersionState: currentExternal,
    targetVersionState: targetExternal,
    blockers: releaseBlockers(targetVersion, targetExternal),
    warnings: [
      ...(currentExternal.githubRelease && !currentExternal.npmPublished ? [`Current version ${currentVersion} has a GitHub Release but is not published to npm; do not reuse it from current main.`] : []),
      ...(status.length > 0 ? ['Working tree is dirty; prepare/apply should start from a clean release-prep branch or include only intentional release changes.'] : [])
    ],
    nextActions: [
      `npm run release:prepare -- --version ${targetVersion} --apply`,
      `git push origin main && git push origin v${targetVersion}`,
      `npm run release:github -- --version ${targetVersion} --apply`,
      `npm run release:verify-public -- --version ${targetVersion}`
    ]
  };
  console.log(JSON.stringify(plan, null, 2));
}

/** @param {CliOptions} options */
function commandPrepare(options) {
  const version = stringOption(options['version']);
  if (!version) {
    throw new Error('release:prepare requires --version <x.y.z>.');
  }
  assertVersion(version);
  const apply = options['apply'] === true;
  const external = inspectExternalVersion(version);
  const blockers = releaseBlockers(version, external);
  if (blockers.length > 0) {
    throw new Error(`Release ${version} is blocked:\n- ${blockers.join('\n- ')}`);
  }
  const changedFiles = [
    ...updateVersions(version, apply),
    updateChangelog(version, apply),
    writeReleaseNotes(version, apply)
  ];
  if (apply) {
    runRequired('npm', ['run', 'build', '--silent']);
    runRequired('npm', ['run', 'smoke:packaging', '--silent']);
    runRequired('npm', ['run', 'release:intent:check', '--silent'], { RELEASE_TAG: `v${version}`, GITHUB_REF_TYPE: 'tag' });
  }
  console.log(JSON.stringify({
    action: 'prepare',
    applied: apply,
    version,
    tag: `v${version}`,
    changedFiles: [...new Set(changedFiles)].sort((left, right) => left.localeCompare(right)),
    followUp: apply ? [
      `git add ${[...new Set(changedFiles)].join(' ')}`,
      `git commit -m "chore(release): v${version}"`,
      `git tag -a v${version} -m "ts-quality v${version}"`,
      `npm run release:github -- --version ${version} --apply`
    ] : [`rerun with --apply to write release prep for v${version}`]
  }, null, 2));
}

/** @param {CliOptions} options */
function commandGithub(options) {
  const version = stringOption(options['version']);
  if (!version) {
    throw new Error('release:github requires --version <x.y.z>.');
  }
  assertVersion(version);
  const apply = options['apply'] === true;
  const tag = `v${version}`;
  const notesPath = existingReleaseNotesPath(version);
  const notesRelative = path.relative(root, notesPath);
  if (!fs.existsSync(notesPath)) {
    throw new Error(`Missing release notes file: ${notesRelative}`);
  }
  const external = inspectExternalVersion(version);
  if (!external.gitTag) {
    throw new Error(`Missing local git tag ${tag}. Run release:prepare follow-up tag step first.`);
  }
  if (external.githubRelease) {
    throw new Error(`GitHub Release ${tag} already exists: ${external.githubRelease.url}`);
  }
  assertReleaseNotesContract(version, notesPath);
  const releaseTitle = releaseTitleFromNotes(version, notesPath);
  const notesFileForGithub = apply ? path.relative(root, materializeGithubReleaseNotesBody(version, notesPath)) : notesRelative;
  const command = ['release', 'create', tag, '--repo', repoSlug, '--title', releaseTitle, '--notes-file', notesFileForGithub, '--latest'];
  if (apply) {
    runRequired('gh', command);
  }
  console.log(JSON.stringify({
    action: 'github',
    applied: apply,
    tag,
    title: releaseTitle,
    command: `gh ${command.join(' ')}`,
    consequence: 'GitHub Release publication triggers .github/workflows/publish.yml in the npm-publish environment, which publishes npm through Trusted Publishing/OIDC.'
  }, null, 2));
}

/** @param {CliOptions} options */
function commandVerifyPublic(options) {
  const version = stringOption(options['version']);
  if (!version) {
    throw new Error('release:verify-public requires --version <x.y.z>.');
  }
  assertVersion(version);
  const freshSelfPublishEnv = { NPM_CONFIG_MIN_RELEASE_AGE: '0' };
  const packageSpec = `${packageName}@${version}`;
  const npmVersion = runRequiredWithRetry(
    'npm registry exact-version lookup',
    'npm',
    ['view', packageSpec, 'version'],
    freshSelfPublishEnv,
    8,
    'npm registry propagation may still be pending',
    `npm publish may have succeeded, but npm view ${packageSpec} did not resolve the exact version yet`
  );
  if (npmVersion.trim() !== version) {
    throw new Error(`npm registry returned an unexpected version for ${packageSpec}: ${npmVersion}`);
  }
  const help = runRequiredWithRetry(
    'public npx CLI smoke',
    'npx',
    ['-y', '-p', packageSpec, 'ts-quality', '--help'],
    freshSelfPublishEnv,
    8,
    'npm registry sees the exact version, but npx install resolution or CLI startup may still be transient',
    `npm registry resolves ${packageSpec}, but npx -p ${packageSpec} ts-quality --help did not pass`
  );
  const release = runRequired('gh', ['release', 'view', `v${version}`, '--repo', repoSlug, '--json', 'tagName,url,publishedAt,isPrerelease']);
  console.log(JSON.stringify({
    action: 'verify-public',
    version,
    npmVersion,
    cliHelpIncludesCommands: help.includes('ts-quality commands:'),
    githubRelease: JSON.parse(release)
  }, null, 2));
}

const { positional, options } = parseArgs(process.argv.slice(2));
const command = positional[0] ?? 'plan';

try {
  if (command === 'plan') {
    commandPlan(options);
  } else if (command === 'prepare') {
    commandPrepare(options);
  } else if (command === 'github') {
    commandGithub(options);
  } else if (command === 'verify-public') {
    commandVerifyPublic(options);
  } else {
    throw new Error(`Unknown release orchestrator command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
