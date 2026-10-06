import fs from 'fs';
import test from 'node:test';
import assert from 'assert/strict';
import { dirtyPathsFromPorcelain, markdownSection, releaseStagingPlan } from '../scripts/release-orchestrator.mjs';

const changelogSection = [
  '### Breaking Changes',
  '',
  'Migration map: [`docs/releases/migrations/v9.9.9.md`](docs/releases/migrations/v9.9.9.md).',
  '',
  '- First breaking change.',
  '- Second breaking change.',
  '',
  '### Added',
  '',
  '- First addition.',
  '- Second addition.',
  '',
  '### Agent migration notes',
  '',
  '- Last section runs to the end.',
  '- Including this line.'
].join('\n');

test('markdownSection returns every line of a section, not only the first', () => {
  assert.equal(markdownSection(changelogSection, 'Breaking Changes'), [
    'Migration map: [`docs/releases/migrations/v9.9.9.md`](docs/releases/migrations/v9.9.9.md).',
    '',
    '- First breaking change.',
    '- Second breaking change.'
  ].join('\n'));
  assert.equal(markdownSection(changelogSection, 'Added'), '- First addition.\n- Second addition.');
});

test('markdownSection runs the last section to the end and returns empty for missing headings', () => {
  assert.equal(markdownSection(changelogSection, 'Agent migration notes'), '- Last section runs to the end.\n- Including this line.');
  assert.equal(markdownSection(changelogSection, 'Fixed'), '');
});

test('verify-public feeds the public CLI contract raw, untrimmed stdout', () => {
  // The contract validates exact bytes such as a bare `x.y.z\n` version line; trimmed stdout can never pass it.
  const source = fs.readFileSync(new URL('../scripts/release-orchestrator.mjs', import.meta.url), 'utf8');
  const contractCall = source.slice(source.indexOf('const publicCliContract = verifyPublicCliContract('));
  assert.match(contractCall.slice(0, contractCall.indexOf('));') + 3), /did not pass`,\s*true\s*\)\);$/);
  assert.match(source, /stdout: rawStdout \? result\.stdout : result\.stdout\.trim\(\)/);
});

test('prepare staging plan stages the versioned migration map and reports other dirty paths instead of dropping them', () => {
  // Given prepare wrote the manifests, changelog and notes, and the version has a migration map
  // And the operator hand-edited README.md while unrelated .ontology/ work is also present
  const plan = releaseStagingPlan({
    preparedFiles: ['package.json', 'CHANGELOG.md', 'package.json', 'docs/releases/2026-10-03-v9.9.9-github-release.md'],
    migrationMap: 'docs/releases/migrations/v9.9.9.md',
    dirtyPaths: ['README.md', 'CHANGELOG.md', '.ontology/', 'docs/releases/migrations/v9.9.9.md']
  });
  // Then the migration map is staged with the prepared files, sorted and unique
  assert.deepEqual(plan.stage, [
    'CHANGELOG.md',
    'docs/releases/2026-10-03-v9.9.9-github-release.md',
    'docs/releases/migrations/v9.9.9.md',
    'package.json'
  ]);
  // And every other dirty path is reported for explicit review rather than silently omitted or staged
  assert.deepEqual(plan.reviewDirty, ['.ontology/', 'README.md']);
});

test('prepare staging plan without a migration map stages only prepared files', () => {
  const plan = releaseStagingPlan({ preparedFiles: ['package.json'], migrationMap: null, dirtyPaths: [] });
  assert.deepEqual(plan, { stage: ['package.json'], reviewDirty: [] });
});

test('dirtyPathsFromPorcelain reads modified, untracked and renamed paths', () => {
  assert.deepEqual(dirtyPathsFromPorcelain(' M README.md\n?? .ontology/\nR  old.md -> docs/new.md\nA  CHANGELOG.md'), [
    'README.md',
    '.ontology/',
    'docs/new.md',
    'CHANGELOG.md'
  ]);
  assert.deepEqual(dirtyPathsFromPorcelain(''), []);
});
