// @ts-check

import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const targets = [
  path.join(root, 'dist'),
  path.join(root, 'examples', 'artifacts'),
  path.join(root, 'verification')
];
for (const target of targets) {
  fs.rmSync(target, { recursive: true, force: true });
}
for (const fixture of ['governed-app', 'mini-monorepo']) {
  fs.rmSync(path.join(root, 'fixtures', fixture, '.ts-quality', 'runs'), { recursive: true, force: true });
  fs.rmSync(path.join(root, 'fixtures', fixture, '.ts-quality', 'latest.json'), { force: true });
  fs.rmSync(path.join(root, 'fixtures', fixture, '.ts-quality', 'mutation-manifest.json'), { force: true });
}
