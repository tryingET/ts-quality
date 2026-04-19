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
The staged-package operator path was rehearsed successfully through `npm publish --dry-run --access public`, the repo's public operator surfaces already describe that same path consistently, and no publish-blocking defect surfaced during the rehearsal.
This is therefore a **go** decision, not a defer.

## Context

The repo had already completed the release-surface alignment work before this decision:

- README quickstart points at the staged-package path
- `docs/npm-publishing-checklist.md` describes the staged-package-first operator contract
- the public release draft already describes the same first-publish story
- `task:1755` captured a full rehearsal of that path, including a real npm publish dry-run from the staged package root

That means the remaining gap was no longer packaging correctness itself.
The missing piece was an explicit release disposition so the repo did not leave the first public publish posture implicit.

## Decision drivers

- keep release posture explicit and evidence-bound
- rely on the proven staged-package path rather than human release memory
- accept the first public publish only if the dry-run path succeeded from the actual staged package root
- avoid implying a blocker-free release without a durable written decision

## Decision

The repo adopts a **go** decision for the first public `ts-quality@0.1.0` release.

The intended publish path remains exactly:

```bash
npm run build
npm run smoke:packaging
cd .ts-quality/npm/ts-quality/package
npm publish --access public
```

This go decision does **not** change the operator contract:

- publish from `.ts-quality/npm/ts-quality/package`, not from `packages/ts-quality/`
- rerun the build and packaging proof immediately before the real publish if any package-affecting input changed after the rehearsal
- treat the staged package, packed tarball, and install/load proof as the canonical release gate

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
- public operator docs were already aligned around that same path before this decision was recorded

## Blockers

No publish-blocking defect was identified by the rehearsal evidence.

The following remain follow-through items, not blockers:

- reflect this decision into the public release draft (`task:1758`)
- rerun the standard publish-time proof from a clean repo state when the operator is ready to perform the real publish

## Consequences

### Positive

- the repo now has an explicit first-release posture instead of an implied one
- the first public publish decision is anchored to recorded rehearsal evidence
- downstream release copy can now reference a canonical repo-local decision record

### Risks / constraints that still matter

- the truthful publish root is still the staged package, not `packages/ts-quality/`
- any late change to package metadata, built outputs, `README.md`, `LICENSE`, or shipped runtime files requires rerunning the packaging proof before publish
- this record authorizes the first release posture, but it does not replace the normal publish-time preflight

## Next steps

1. Update the public release draft so it reflects this go decision (`task:1758`).
2. When ready to publish for real, rerun:
   - `npm run build`
   - `npm run smoke:packaging`
3. Publish from `.ts-quality/npm/ts-quality/package` with `npm publish --access public`.
4. Cut the public release using the updated draft and the proven staged-package path.
