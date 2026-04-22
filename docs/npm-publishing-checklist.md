---
summary: "Checklist for publishing ts-quality through the repo's proven staged-package path."
read_when:
  - "When preparing the first public npm release for ts-quality"
  - "When deciding whether the current package layout is publish-ready"
type: "how-to"
---

# npm publishing checklist

This repo now has a deterministic staged-package publish path.
Use this checklist to publish `ts-quality` through that proven path instead of relying on repo-memory or a naive `npm publish` from `packages/ts-quality/`.

## Current state snapshot

Good:

- `packages/ts-quality/package.json` exists with the intended public package name: `ts-quality`
- `npm run pack:ts-quality` creates a clean staged package under `.ts-quality/npm/ts-quality/package`
- the staged helper writes a publish-ready `package.json`, asserts the staged manifest contract, asserts the staged file-boundary contract, and runs `npm pack`
- `npm run smoke:packaging` asserts the packed tarball file set, installs the tarball into a fresh temp project, and exercises the shipped CLI/API/types surface
- `npm run verify` gates the packaging proof path from repo root
- `npm view ts-quality` currently returns no published package for this name from this environment

Important current constraint:

- the monorepo build still writes compiled files to the **repo-root** `dist/` tree
- the publishable package is therefore a **staged package**, not the raw `packages/ts-quality/` directory
- a naive `npm publish` from `packages/ts-quality/` is still **not** the truthful operator path

## Release decision checklist

### 1) Confirm the current package strategy

Current repo truth is:

- **Staged package publish** — build at repo root, create the publishable staged package, prove the tarball from that staged package, and only then publish from the staged directory

This is the current operator path:

```bash
npm run build
npm run pack:ts-quality
npm run smoke:packaging
```

Keep these guardrails in mind:

- do **not** publish directly from `packages/ts-quality/`
- do **not** assume the repo-root `dist/` layout is itself the published package root
- treat package-local dist as a possible future architecture change, not the current release path

### 2) Confirm package metadata

Before publish, ensure the staged public manifest still carries the intended package contract.
The current staged helper already validates this contract, but release prep should still treat these fields as intentional:

- `name`
- `version`
- `description`
- `license`
- `repository`
- `homepage`
- `bugs`
- `keywords`
- `dependencies`
- `engines`
- correct `main`
- correct `types`
- correct `bin`
- `exports`
- `files`
- `publishConfig`

### 3) Confirm staged and packed file boundaries

The repo now proves **two separate file-boundary layers**:

1. the staged package directory contains only the intended publish surface
2. the final `.tgz` contains only the intended packed file set

That means release prep should fail closed if the package accidentally:

- drops required runtime assets
- broadens into tests, fixtures, workspace-only scripts, or `node_modules`
- relinks manifest entrypoints away from the actual shipped files

Expected packaged content remains intentionally narrow:

- built JS under `dist/`
- `.d.ts` files
- source maps for the shipped runtime files
- `README.md`
- `LICENSE`
- the publish-ready `package.json`

### 4) Run the deterministic packaging proof path

Use the proven helper and smoke path instead of a hand-assembled shell sequence.

Recommended release-prep commands:

```bash
npm run build
npm run pack:ts-quality
npm run smoke:packaging
```

What they prove:

- `npm run pack:ts-quality`
  - creates the staged package
  - writes the publish-ready manifest
  - checks staged manifest + staged file boundaries
  - produces the `.tgz`
- `npm run smoke:packaging`
  - re-runs the staged packaging path
  - checks the packed tarball file set
  - installs the tarball into a fresh temp project
  - proves `ts-quality --help`
  - proves the shipped API exports
  - proves consumer type resolution with `tsc`

Optional manual inspection after packing:

```bash
cat .ts-quality/npm/ts-quality/package/package.json
tar -tzf .ts-quality/npm/ts-quality/tarballs/ts-quality-<version>.tgz
```

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

`npm run verify` is the repo-root gate and already includes the packaging smoke path, but the explicit command list above is still useful when you want stepwise release confidence.

If docs changed during release prep, also run:

```bash
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
```

### 6) Confirm legitimacy/operator surfaces

Before publishing, re-check the reviewed legitimacy outputs that README and release notes point at:

- `examples/artifacts/governed-app/authorize.release-bot.json`
- `examples/artifacts/governed-app/authorize.maintainer-approved.json`
- `examples/artifacts/governed-app/attestation.verify.txt`
- `examples/artifacts/governed-app/amend.txt`

These are the current sample anchors for the shipped SG6 legitimacy surface: run-bound authorization evidence, human-readable attestation verification, and the additive amendment summary.
Keep `run.json`, the authorization decision + bundle artifacts, and the amendment JSON result authoritative; the reviewed sample outputs are operator-facing projections, not a second legitimacy authority. If the release also changes invariant witness generation or execution-backed support semantics, re-check the live contracts in `docs/invariant-dsl.md`, `docs/config-reference.md`, and `docs/ci-integration.md` instead of duplicating witness-specific release prose here.

### 7) Confirm public repo metadata

Before publishing, make sure the public surfaces are coherent:

- GitHub description matches the npm description closely
- README quickstart and package-operator guidance match the staged-package path
- README/operator docs point at the same legitimacy outputs the repo actually ships (`authorize.*.json`, `attestation-verify.txt`, and amendment JSON/text)
- if witness generation/operator flow changed, README and docs should defer to `docs/invariant-dsl.md`, `docs/config-reference.md`, and `docs/ci-integration.md` as the canonical witness/operator docs instead of restating those details ad hoc
- GitHub topics are set
- social preview image is uploaded in repo settings
- CHANGELOG documents anything alpha-breaking or release-relevant

### 8) Dry-run the release notes

Prepare a short release note answering:

- what problem `ts-quality` solves
- who it is for
- what a first-time user should run
- what is still alpha / intentionally unstable before 1.0
- how the staged-package path relates to the first public publish
- how run-bound authorization evidence, attestation verification, and amendment outputs stay downstream of exact run/proposal truth

When possible, anchor those notes to the reviewed sample artifacts above instead of describing the legitimacy surface abstractly.

### 9) Publish only after staged-package proof

For the first release, prefer this exact sequence:

```bash
npm run build
npm run smoke:packaging
cd .ts-quality/npm/ts-quality/package
npm publish --access public
```

If anything that affects the package changes after the smoke pass — version, manifest inputs, built output, README, LICENSE, or shipped runtime files — rerun the build and packaging proof before publishing.

## Deterministic packaging helpers

This repo now includes two packaging operators:

- `npm run pack:ts-quality`
- `npm run smoke:packaging`

`npm run pack:ts-quality` performs the staged-package build/publish preparation by:

1. creating a clean staging directory under `.ts-quality/npm/ts-quality/package`
2. copying built files into publish-correct relative paths
3. writing a publish-ready `package.json`
4. asserting the staged manifest contract
5. asserting the staged file-boundary contract
6. copying `README.md` and `LICENSE`
7. running `npm pack`
8. writing the tarball to `.ts-quality/npm/ts-quality/tarballs/`

`npm run smoke:packaging` is the stronger end-to-end proof step layered on top of that helper.
It additionally validates the packed tarball file set and proves install/load behavior from a fresh temp project.

Use `npm run smoke:packaging` as the default release-proof step before any public publish.

## Definition of done for “npm-publishable”

`ts-quality` is ready for npm when all of the following are true:

- the staged-package helper produces a publish-ready package deterministically
- staged manifest metadata, staged file boundaries, and packed tarball contents all fail closed against the intended package contract
- a fresh machine can install the packed tarball without repo-relative path breakage
- `./node_modules/.bin/ts-quality --help` works from the installed tarball
- shipped API exports and type declarations resolve for consumers
- public metadata and release surfaces look intentional
- release validation passes from repo root
- public operator docs point at the same staged-package path and legitimacy outputs the repo actually proves
