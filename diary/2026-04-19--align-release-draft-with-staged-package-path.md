---
summary: "Updated the GitHub release draft so the first public release story matches the repo's proven staged-package publish path."
read_when:
  - "When resuming after task 1752"
  - "When checking why the release draft now distinguishes the public package operator path from repo-local evaluation"
type: "diary"
---

# 2026-04-19 — Align release draft with staged-package publish path

## What I Did

- Re-read the release draft against the now-proven packaging helper and tarball smoke path.
- Added release highlights for staged-package helpers, package-contract checks, and fresh-temp-project tarball proof.
- Replaced the old single quickstart framing with two truthful surfaces:
  - the first public package operator path
  - repo-local evaluation from source
- Added explicit release-note text that the public package story is intentionally a staged-package story while the workspace build still targets repo-root `dist/`.

## Candidates Considered

- **Chosen framing:** separate public-package operator guidance from repo-local source evaluation, because release notes should not blur package-install truth with contributor-from-source truth.
- **Rejected framing:** keep the old quickstart as the only path, because it made the public release story look like `node dist/...` from a source checkout rather than the proven staged-package publish path.

## Patterns

- Release notes become materially more truthful when they name the package root that can actually be published.
- Once packaging smoke proves tarball install/load from a fresh temp project, release copy should speak about that proof directly instead of implying the package story is still hypothetical.

## Validation

- `npm run smoke:packaging --silent`
- `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`

## Crystallization Candidates

- → docs/learnings/ if the repo wants a durable note on separating public-package operator guidance from repo-local source-evaluation guidance in early release notes.
