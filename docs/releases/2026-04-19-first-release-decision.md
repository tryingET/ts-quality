---
summary: "Explicit go decision for the first public ts-quality release after the staged-package rehearsal."
read_when:
  - "When deciding whether ts-quality should publish its first public npm package"
  - "When checking whether the staged-package rehearsal ended in go, no-go, or defer"
type: "record"
---

# First-release decision — 2026-04-19

## Status
- accepted
- decision_date: 2026-04-19
- decision: go
- target_release: `ts-quality@0.1.0`
- owner: ts-quality maintainers
- reviewers: operator, pi
- based_on:
  - `docs/releases/2026-04-19-staged-package-release-rehearsal.md`
  - `docs/npm-publishing-checklist.md`
  - `docs/releases/2026-03-20-v0.1.0-github-release-draft.md`

## Executive summary

`ts-quality` should proceed with its first public npm release.
The staged-package operator path was rehearsed successfully through `npm publish --dry-run --access public`, no publish-blocking defect surfaced during the rehearsal, and the final npm publication step is now delegated to GitHub Actions through npm Trusted Publishing/OIDC.
This is therefore a **go** decision, not a defer, with GitHub Release as the single release intent.

## Context

The repo had already completed the staged-package proof work before this decision:

- README quickstart points at the staged-package artifact path
- `docs/npm-publishing-checklist.md` describes the staged-package-first package contract
- the public release draft describes the first-publish story
- `task:1755` captured a full rehearsal of that path, including a real npm publish dry-run from the staged package root

This rebuild updates the final authority boundary: local Pi/orchestrator sessions prepare proof and release notes, while a published GitHub Release triggers `.github/workflows/release.yml` to perform npm publication through Trusted Publishing/OIDC.

That means the remaining gap was no longer packaging correctness itself.
The missing piece was an explicit release disposition so the repo did not leave the first public publish posture implicit.

## Decision drivers

- keep release posture explicit and evidence-bound
- rely on the proven staged-package path rather than human release memory
- accept the first public publish only if the dry-run path succeeded from the actual staged package root
- avoid implying a blocker-free release without a durable written decision

## Decision

The repo adopts a **go** decision for the first public `ts-quality@0.1.0` release.

The intended release path is now exactly:

```bash
npm run build
npm run smoke:packaging
# then create the GitHub Release for tag v0.1.0
```

The GitHub Release is the single release intent. `.github/workflows/release.yml` validates that the release tag matches the package version, re-runs the packaging proof through `npm run verify:ci`, uploads the proven tarball, and publishes from `.ts-quality/npm/ts-quality/package` to npm through Trusted Publishing/OIDC.

This updates the operator contract:

- create the GitHub Release; do not run local `npm publish`
- publish from the staged package in CI, not from `packages/ts-quality/`
- rerun the local build and packaging proof immediately before creating the release if any package-affecting input changed after the rehearsal
- treat the staged package, packed tarball, install/load proof, and release workflow result as the canonical release gate

## Evidence supporting the go decision

- `task:1755` recorded a successful `npm run build`
- `npm run smoke:packaging --silent` succeeded and re-proved:
  - staged manifest correctness
  - staged file-boundary correctness
  - packed tarball file-set correctness
  - fresh temp-project install/load behavior
  - shipped CLI, API, and consumer type-resolution behavior
- `npm publish --dry-run --access public` succeeded from `.ts-quality/npm/ts-quality/package`
- the rehearsal found no hidden extra release step beyond the currently documented staged-package flow
- public operator docs now align around GitHub Release intent, the staged-package artifact path, and Trusted Publishing/OIDC npm publication

## Blockers

No publish-blocking defect was identified by the rehearsal evidence.

The remaining follow-through items are operational, not blockers:

- rerun the standard publish-time proof from a clean repo state when the operator is ready to create the GitHub Release
- configure npm Trusted Publishing for this repository/workflow before the release if it is not already configured
- cut the public GitHub Release using the updated draft + decision record and let CI publish to npm

## Consequences

### Positive

- the repo now has an explicit first-release posture instead of an implied one
- the first public publish decision is anchored to recorded rehearsal evidence
- downstream release copy can now reference a canonical repo-local decision record
- public release surfaces can now point at exact SG6 legitimacy artifacts instead of relying on generic legitimacy wording

### Risks / constraints that still matter

- the truthful publish root is still the staged package, not `packages/ts-quality/`
- any late change to package metadata, built outputs, `README.md`, `LICENSE`, or shipped runtime files requires rerunning the packaging proof before publish
- this record authorizes the first release posture, but it does not replace the normal publish-time preflight

## Post-decision release-copy alignment

The public release docs now explicitly point at the shipped SG6 legitimacy outputs:

- run-bound authorization decisions: `.ts-quality/runs/<run-id>/authorize.<agent>.<action>.json`
- paired authorization bundles: `.ts-quality/runs/<run-id>/bundle.<agent>.<action>.json`
- human-readable attestation verification attached to the evaluated run: `.ts-quality/runs/<run-id>/attestation-verify.txt`
- amendment results in authoritative JSON plus concise reviewed text: `.ts-quality/amendments/<proposal-id>.result.json` and `.ts-quality/amendments/<proposal-id>.result.txt`
- reviewed sample anchors under `examples/artifacts/governed-app/`

Those additions do not change release authority.
`run.json`, the authorization decision + bundle artifacts, and amendment JSON remain authoritative; release-facing sample outputs are there to make the shipped operator path inspectable.

## Next steps

1. When ready to publish for real, rerun:
   - `npm run build`
   - `npm run smoke:packaging`
   - `RELEASE_TAG=v0.1.0 GITHUB_REF_TYPE=tag npm run release:intent:check`
2. Confirm npm Trusted Publishing is configured for `.github/workflows/release.yml`.
3. Cut the public GitHub Release for tag `v0.1.0`; the release workflow publishes the staged package to npm. Prerelease GitHub Releases use npm dist-tag `next`; other releases use `latest`.
