---
summary: "Release workflow contract for local preparation, GitHub Release intent, and npm Trusted Publishing/OIDC."
read_when:
  - "When preparing a ts-quality release"
  - "When configuring npm Trusted Publishing for ts-quality"
  - "When reconciling GitHub Release, npm, tag, and staged package authority"
type: "how-to"
---

# Release workflow

`ts-quality` uses **GitHub Release as the single public release intent**.
Local Pi/orchestrator work prepares the release; npm publication is performed by GitHub Actions through npm Trusted Publishing/OIDC.

## Authority chain

```text
local release prep
  -> version/changelog/release notes
  -> package proof
  -> commit + tag
  -> GitHub Release published
  -> .github/workflows/publish.yml
  -> npm Trusted Publishing/OIDC
  -> public npm verification
  -> proven tarball attached to GitHub Release
```

Do **not** run local `npm publish` for normal releases.
The staged package remains the package artifact, but GitHub Actions owns the final publish mutation.

## One-time external setup

Before the first workflow-driven npm publish, configure npm Trusted Publishing for:

- package: `ts-quality`
- GitHub owner / organization: `tryingET`
- repository: `ts-quality`
- workflow filename: `publish.yml` — enter only the filename in npm, not `.github/workflows/publish.yml`
- environment name: `npm-publish`

The workflow uses GitHub-hosted runners, the GitHub Actions environment `npm-publish`, `id-token: write`, Node `24`, npm `>=11.5.1`, and `npm publish --provenance`; it must not require `NPM_TOKEN` or `NODE_AUTH_TOKEN`. It also avoids configuring `actions/setup-node` with `registry-url` in the release job so npm does not prefer a registry auth-token config over Trusted Publishing/OIDC.

If the publish step fails with `ENEEDAUTH` after the workflow's Trusted Publishing runtime-prerequisite step passes, treat that as external npm Trusted Publisher configuration debt: the package is not configured on npmjs.com, the owner/repository/workflow filename/environment tuple does not exactly match, or npm requires a bootstrap publication before the package settings can be edited. If npm does not allow Trusted Publishing setup before the first package publication, perform the smallest possible bootstrap publish from the proven staged package, then configure Trusted Publishing immediately for subsequent releases. Prefer avoiding that fallback if npm supports pre-publication trusted-publisher setup for the package name.

## Local planning

Use:

```bash
npm run release:plan -- --version <next-version>
```

The plan checks the current package version, local tag state, GitHub release state, npm publication state, and warns when a version has a GitHub Release but is not published to npm.

Current historical warning: `v0.1.0` exists on GitHub while npm currently has no `ts-quality@0.1.0`; do not reuse that version from current `main` unless you intentionally want to reconcile the historical release from the exact historical tag.

## Local preparation

Use:

```bash
npm run release:prepare -- --version <next-version> --apply
```

This prepares local release files and proves the staged package. Then commit and tag the prepared state:

```bash
git add package.json packages/ts-quality/package.json package-lock.json CHANGELOG.md docs/releases/
git commit -m "chore(release): v<next-version>"
git tag -a v<next-version> -m "ts-quality v<next-version>"
```

The tag must exactly match `packages/ts-quality/package.json` as `v<version>`.

## Create the GitHub Release

After pushing the release commit and tag:

```bash
git push origin main
git push origin v<next-version>
npm run release:github -- --version <next-version> --apply
```

That creates the GitHub Release with the curated release notes. The release orchestrator reads `## Title` from the notes file for the GitHub Release title and uses only the `## Release body` section as the public release body, so draft scaffolding such as `# GitHub release draft` does not appear on the release page.

Prefer release bodies shaped like the upstream Pi release style: concise categorized sections such as `### New Features`, `### Breaking Changes`, `### Added`, `### Changed`, and `### Fixed`, with bullets that mention the user-visible effect first and link supporting docs or issues when available.

Publishing the GitHub Release triggers `.github/workflows/publish.yml`.

## Workflow publication

The release workflow:

1. checks out the exact release tag
2. installs Node `24` and a current npm CLI with Trusted Publishing support
3. verifies local Trusted Publishing runtime prerequisites: Node `>=22.14.0`, npm `>=11.5.1`, GitHub OIDC request variables, and the expected npm trusted-publisher tuple (`publish.yml` + `npm-publish`)
4. validates tag/version/package intent with `npm run release:intent:check`
5. runs `npm run verify:ci --silent`
6. uploads the staged npm tarball as a workflow artifact
7. publishes from `.ts-quality/npm/ts-quality/package` through Trusted Publishing/OIDC
8. verifies `npm view ts-quality@<version>` and `npx -p ts-quality@<version> ts-quality --help`
9. attaches the proven tarball to the GitHub Release

Prerelease GitHub Releases publish to npm dist-tag `next`; normal releases publish to `latest`.

## Public verification

After the workflow succeeds, local verification is:

```bash
npm run release:verify-public -- --version <released-version>
```

This checks npm package visibility, CLI installability, and GitHub Release visibility. The verifier intentionally sets `NPM_CONFIG_MIN_RELEASE_AGE=0` only for its own `npm view` / `npx -p ts-quality@<version>` subprocesses so maintainers can immediately verify a freshly published `ts-quality` release without weakening their global npm `min-release-age` policy for unrelated installs.
