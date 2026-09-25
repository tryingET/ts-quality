import test from 'node:test';
import assert from 'assert/strict';
import { markdownSection } from '../scripts/release-orchestrator.mjs';

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
