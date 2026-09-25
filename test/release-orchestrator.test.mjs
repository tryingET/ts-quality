import fs from 'fs';
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

test('verify-public feeds the public CLI contract raw, untrimmed stdout', () => {
  // The contract validates exact bytes such as a bare `x.y.z\n` version line; trimmed stdout can never pass it.
  const source = fs.readFileSync(new URL('../scripts/release-orchestrator.mjs', import.meta.url), 'utf8');
  const contractCall = source.slice(source.indexOf('const publicCliContract = verifyPublicCliContract('));
  assert.match(contractCall.slice(0, contractCall.indexOf('));') + 3), /did not pass`,\s*true\s*\)\);$/);
  assert.match(source, /stdout: rawStdout \? result\.stdout : result\.stdout\.trim\(\)/);
});
