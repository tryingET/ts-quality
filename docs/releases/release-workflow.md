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

This prepares local release files, refreshes `VERIFICATION.md` plus `verification/verification.log`, proves the same verification artifact gate that publish CI will run, and prints the exact `git add` follow-up for the release-ready commit set. Then commit and tag the prepared state using the printed file list. At minimum, version releases normally include:

```bash
git add package.json packages/ts-quality/package.json package-lock.json CHANGELOG.md docs/releases/ VERIFICATION.md verification/verification.log
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

Release bodies are validated as local release-please-style notes, not freeform highlights. Normal releases must include `### Breaking Changes` plus at least one categorized change section such as `### Added`, `### Changed`, or `### Fixed`; `### Highlights` is not a substitute for those categories. If `### Breaking Changes` contains anything other than `None`, the notes must also include non-empty `### Agent migration notes` explaining what downstream agents, parsers, prompts, fixtures, or operators need to update before relying on the release.

## Versioned migration maps for breaking changes

When a release introduces a breaking change, keep the breaking-change statement in `CHANGELOG.md` under that version's `### Breaking Changes` section. Then create a version-specific AI-agent migration map before cutting the release:

```text
docs/releases/migrations/v<version>.md
```

The migration map is not the authoritative release-history record of the break; it is the resolution playbook for agents and operators. It should describe:

- which earlier versions the instructions apply to
- which consumers must be updated, including agents, parsers, prompts, dashboards, fixtures, and operator scripts
- how to find affected reads or commands
- the field-by-field or command-by-command replacement steps when applicable
- validation commands or artifact checks that prove the consumer has migrated
- any explicit instruction not to copy version-specific upgrade ballast into evergreen first-contact docs

The corresponding `CHANGELOG.md` breaking-change entry must link to the migration map for resolution guidance. The GitHub Release notes should link to the same migration map from `### Agent migration notes` when the release has downstream agent/operator impact.

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
8. after `npm publish` succeeds, starts a bounded public-propagation timer by retrying `npm view ts-quality@<version> version` until the exact version is visible, then runs the shared public CLI contract verifier (`scripts/public-cli-contract.mjs`) for public `npx` checks including `ts-quality --help`, `ts-quality doctor --help`, `ts-quality doctor --machine --changed src/index.ts`, and a minimal manual `witness test` -> `check` project that must produce execution-backed scenario support without scenario auto-run config, because npm packument visibility and `npx` install resolution can converge at different times immediately after publish and public CLI/evidence-contract drift must fail closed
9. attaches the proven tarball to the GitHub Release once npm publish succeeds, even if a later propagation or public-install verification retry exhausts and the job fails for operator attention

Prerelease GitHub Releases publish to npm dist-tag `next`; normal releases publish to `latest`.

## Public verification

After the workflow succeeds, local verification is:

```bash
npm run release:verify-public -- --version <released-version>
```

This checks npm package visibility, GitHub Release visibility, and the shared public CLI/evidence contract: CLI installability, exact top-level help header, `doctor --help` exposure of `--machine`, the compact `doctor --machine` protocol header plus exact command fields, and the manual witness consumption path (`witness test --out .ts-quality/witnesses/...` followed by `check` yielding execution-backed scenario support without duplicated scenario config). The verifier intentionally sets `NPM_CONFIG_MIN_RELEASE_AGE=0` only for its own `npm view` / `npx -p ts-quality@<version>` subprocesses, retries the exact-version registry lookup separately from the public `npx` smoke, and reports which stage exhausted so maintainers can immediately verify a freshly published `ts-quality` release without weakening their global npm `min-release-age` policy for unrelated installs.
