---
summary: "Tactical handoff with SG3 active: TG8 packaged proof is complete, TG9 package-contract hardening is the live wave, and TG10 release-surface alignment stays sequenced behind it."
read_when:
  - "When planning the next sprint/week for ts-quality"
  - "When turning the current strategic state into bounded delivery waves"
type: "reference"
---

# Tactical Goals

Active strategic goal: **SG3 — Prove first outside-repo adoption through deterministic packaging and release ergonomics**

The repo already has the hard part of TG8 in place: staged tarball install/load proof now lands under `npm run smoke:packaging` and repo verification. What is still missing is an intentional public-package contract. The repo can prove that the package works, but it still needs fail-closed checks for which manifest fields and files are actually part of that public package before release-surface alignment can be trusted.

## Active tactical goals

### TG9 — Lock publish-correct staged package metadata and file boundaries
- **Why this is active:** TG8 proved the staged tarball path works from a fresh temp project, but the staged manifest fields, staged file set, and packed tarball contents still do not have an explicit contract surface. That leaves publish readiness vulnerable to silent drift even though install/load proof now exists.
- **Completion target:** staged manifest metadata, staged file boundaries, and packed tarball contents are validated against an intentional public-package contract and helper/test changes fail closed when they broaden, drop, or relink that contract accidentally.
- **Materialized through:** repo-local AK tasks `task:1731-1733`.
- **Eisenhower-3D:** importance `5`, urgency `3`, difficulty `3`

### TG10 — Align public install and release surfaces with the proven staged-package path
- **Why this is next:** README, the npm publishing checklist, and the release draft should only promise the packaged flow the repo can already prove end to end. That public alignment becomes much safer once TG9 locks the package contract instead of leaving release surfaces to describe an implicit package boundary.
- **Completion target:** public docs and release surfaces point at the proven staged-package operator path, package-contract expectations stay explicit, and public install guidance stops depending on remembered manual sequencing.
- **Promotion trigger:** promote after TG9's package-contract checks are passing under repo-local validation.
- **Eisenhower-3D:** importance `4`, urgency `2`, difficulty `2`

## Recently completed tactical history

### TG8 — Prove staged tarball install/load behavior from a fresh temp project
- **Completed by:** repo-local AK tasks `task:1722-1724`.
- **What landed:** the repo can now stage the package, install the tarball in a fresh temp project, exercise the shipped CLI/API, and run that packaged proof path under repo verification instead of manual rehearsal.

### TG7 — Make amendment decisions carry additive proposal/rule context
- **Completed by:** repo-local AK tasks `task:1711-1713`.
- **What landed:** `ts-quality amend` now carries additive `proposalContext`, the reviewed sample/docs match that contract, and parity coverage locks the emitted result shape.

Earlier SG2 siblings also remain complete:
- **TG5** through `task:192`
- **TG6** through `task:195-197`

## Tactical guardrails
- keep the staged package downstream of the repo-root build instead of inventing a second hidden build topology
- prove package-contract truth from the staged directory and the final `.tgz`, not from assumptions about workspace layout
- keep release/docs promises downstream of the proven package contract rather than ahead of it
- leave deferred tasks `task:190-191` as contract-first work until an explicit repo-level decision promotes them
