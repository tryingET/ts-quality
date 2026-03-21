---
summary: "Checklist for publishing the ts-quality package to npm without breaking the repo's current monorepo build assumptions."
read_when:
  - "When preparing the first public npm release for ts-quality"
  - "When deciding whether the current package layout is publish-ready"
type: "how-to"
---

# npm publishing checklist

This repo already has a public GitHub repository and a public package name candidate (`ts-quality`), but **the package is not publish-ready by accident**.
Use this checklist before the first npm release.

## Current state snapshot

Good:

- `packages/ts-quality/package.json` exists with the intended public package name: `ts-quality`
- the CLI entrypoint exists in built output: `dist/packages/ts-quality/src/cli.js`
- the repo ships a public README, MIT license, examples, and verification workflow
- `npm view ts-quality` currently returns no published package for this name from this environment

Important current constraint:

- the monorepo build writes compiled files to the **repo-root** `dist/` tree
- `packages/ts-quality/package.json` currently points at repo-root-style paths such as `dist/packages/ts-quality/src/index.js`
- that means a naive `npm publish` from `packages/ts-quality/` is **not** correct yet, because npm packages cannot rely on files outside the published package root

## Release decision checklist

### 1) Confirm package strategy

Choose one explicit strategy before publishing:

- **A. Staged package publish** — build at repo root, then copy the public package into a temporary/staged directory with publish-correct relative paths
- **B. Package-local dist** — change the build/output layout so `packages/ts-quality/` contains its own publishable `dist/`

Until one of those strategies exists, do **not** run `npm publish`.

### 2) Confirm package metadata

Before publish, ensure the public package manifest includes at least:

- `name`
- `version`
- `description`
- `license`
- `repository`
- `homepage`
- `bugs`
- `keywords`
- correct `main`
- correct `types`
- correct `bin`

Optional but recommended:

- `exports`
- `files`
- `engines`
- `publishConfig`

### 3) Confirm packaged file set

The published tarball should contain only what users need:

- built JS
- `.d.ts` files
- source maps if you want debuggability
- README
- LICENSE
- any runtime assets required by the CLI

It should **not** accidentally include:

- tests
- fixtures used only for repo validation
- large reviewed sample artifacts unless they are intentionally part of the package
- workspace-only scripts
- `node_modules`

### 4) Verify install experience from a tarball

Before any public publish, test with `npm pack` and install the tarball into a fresh temp project.

Minimum checks:

```bash
npm run build
npm pack <staged-package-dir>
mkdir -p /tmp/ts-quality-pack-test
cd /tmp/ts-quality-pack-test
npm init -y
npm install /path/to/ts-quality-<version>.tgz
npx ts-quality --help
```

The tarball test should prove that:

- the CLI resolves correctly
- Node can load the published `main`
- type declarations resolve correctly for consumers
- no file path points outside the installed package

### 5) Verify repo truth before release

From repo root, run:

```bash
npm run build
npm run typecheck
npm run lint
npm test
npm run sample-artifacts
npm run smoke
npm run verify
```

If docs changed during release prep, also run:

```bash
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
```

### 6) Confirm public repo metadata

Before publishing, make sure the public surfaces are coherent:

- GitHub description matches the npm description closely
- README quickstart works from a fresh clone
- GitHub topics are set
- social preview image is uploaded in repo settings
- CHANGELOG documents anything alpha-breaking or release-relevant

### 7) Dry-run the release notes

Prepare a short release note answering:

- what problem `ts-quality` solves
- who it is for
- what a first-time user should run
- what is still alpha / intentionally unstable before 1.0

### 8) Publish only after tarball proof

For the first release, prefer this sequence:

```bash
npm run build
# create staged package dir with publish-correct paths
# run npm pack against staged dir
# install tarball in a fresh temp project
# only then publish
```

If using a staged directory:

```bash
cd <staged-package-dir>
npm publish --access public
```

## Deterministic packaging helper

This repo now includes a deterministic helper:

- `npm run pack:ts-quality`

It performs the current staged-package strategy by:

1. creating a clean staging directory under `.ts-quality/npm/ts-quality/package`
2. copying built files into publish-correct relative paths
3. writing a publish-ready `package.json`
4. copying `README.md` and `LICENSE`
5. running `npm pack`
6. writing the tarball to `.ts-quality/npm/ts-quality/tarballs/`

Use that helper as the default local proof step before any public publish.

## Definition of done for “npm-publishable”

`ts-quality` is ready for npm when all of the following are true:

- a fresh machine can install the packed tarball without repo-relative path breakage
- `./node_modules/.bin/ts-quality --help` works from the installed tarball
- published metadata is complete and public-facing surfaces look intentional
- release validation passes from repo root
- the packaging path is deterministic and documented, not a one-off manual shell ritual
