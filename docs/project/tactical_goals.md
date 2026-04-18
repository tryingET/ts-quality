---
summary: "Tactical handoff with SG3 active: staged tarball proof is the live wave, while package-contract hardening and public release-surface alignment stay sequenced behind it."
read_when:
  - "When planning the next sprint/week for ts-quality"
  - "When turning the current strategic state into bounded delivery waves"
type: "reference"
---

# Tactical Goals

Active strategic goal: **SG3 — Prove first outside-repo adoption through deterministic packaging and release ergonomics**

The repo already has the right SG3 raw ingredients: a staged packaging helper, a publish-intent package manifest, and release/checklist docs. What is still missing is deterministic repo-local proof that the staged tarball really behaves like an installable outside-repo package instead of only looking publishable on paper.

## Active tactical goals

### TG8 — Prove staged tarball install/load behavior from a fresh temp project
- **Why this is active:** `npm run pack:ts-quality` already stages a tarball, but the repo still lacks a task-backed proof path that installs that tarball into a fresh temp project and exercises the packaged CLI/API instead of relying on workspace-relative assumptions.
- **Completion target:** repo-local validation can stage the tarball, install it into a temp project, run `ts-quality --help`, and load the public module entrypoint without repo-relative breakage.
- **Materialized through:** repo-local AK tasks `task:1722-1724`.
- **Eisenhower-3D:** importance `5`, urgency `3`, difficulty `3`

### TG9 — Lock publish-correct staged package metadata and file boundaries
- **Why this is next:** once the install/load path is proven, the staged package manifest fields and tarball contents still need explicit contract checks so publish readiness cannot drift silently.
- **Completion target:** staged package metadata/files are validated against an intentional public-package contract and helper changes fail closed when they broaden or break it.
- **Promotion trigger:** promote after TG8's packaged proof path is passing under repo-local validation.
- **Eisenhower-3D:** importance `4`, urgency `2`, difficulty `3`

### TG10 — Align public install and release surfaces with the proven staged-package path
- **Why this is next:** README, the npm publishing checklist, and the release draft should only promise the packaged flow the repo can already prove end to end.
- **Completion target:** public docs and release surfaces point at the proven staged-package operator path and stop depending on remembered manual sequencing.
- **Promotion trigger:** promote after TG8 proves the path and TG9 locks the public package contract.
- **Eisenhower-3D:** importance `4`, urgency `2`, difficulty `2`

## Recently completed tactical history

### TG7 — Make amendment decisions carry additive proposal/rule context
- **Completed by:** repo-local AK tasks `task:1711-1713`.
- **What landed:** `ts-quality amend` now carries additive `proposalContext`, the reviewed sample/docs match that contract, and parity coverage locks the emitted result shape.

Earlier SG2 siblings also remain complete:
- **TG5** through `task:192`
- **TG6** through `task:195-197`

## Tactical guardrails
- keep the staged package downstream of the repo-root build instead of inventing a second hidden build topology
- prove packaged behavior from a temp project, not from workspace-relative imports that would be unavailable to consumers
- keep release/docs promises downstream of packaged proof rather than ahead of it
- leave deferred tasks `task:190-191` as contract-first work until an explicit repo-level decision promotes them
