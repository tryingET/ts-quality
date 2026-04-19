---
summary: "Tactical handoff with SG3 active: TG9 package-contract hardening is complete, TG10 release-surface alignment is now live, and TG11 staged-release rehearsal is sequenced behind it."
read_when:
  - "When planning the next sprint/week for ts-quality"
  - "When turning the current strategic state into bounded delivery waves"
type: "reference"
---

# Tactical Goals

Active strategic goal: **SG3 — Prove first outside-repo adoption through deterministic packaging and release ergonomics**

The repo now has explicit package-contract proof in place: staged manifest metadata, staged file boundaries, and packed tarball contents are all checked under `npm run smoke:packaging`, and repo verification gates that path. The next unfinished repo-local SG3 bet is no longer package-contract hardening itself; it is making the public install and release surfaces describe that proven staged-package path truthfully.

## Active tactical goals

### TG10 — Align public install and release surfaces with the proven staged-package path
- **Why this is active:** TG9 is now complete, so SG3's next truthful slice is the downstream operator surface: the npm publishing checklist, release draft, and README should all describe the staged-package path the repo can actually prove end to end.
- **Completion target:** public install/release surfaces point at the proven staged-package operator path, package-contract expectations stay explicit, and public guidance no longer depends on remembered manual sequencing.
- **Materialized through:** repo-local AK tasks `task:1751-1753`.
- **Eisenhower-3D:** importance `4`, urgency `2`, difficulty `2`

### TG11 — Rehearse the first public staged-package operator path from the aligned surfaces
- **Why this is next:** once TG10 lands, the repo should prove that the newly aligned checklist, release copy, and README guidance can actually be followed as a coherent first-public-package operator path instead of remaining only documentation-level alignment.
- **Completion target:** the first-release operator sequence is rehearsed from the aligned public surfaces without ad-hoc repo-memory steps, and any remaining ergonomic gaps are made explicit before SG3 is considered materially complete.
- **Promotion trigger:** promote after TG10's docs-alignment slices pass repo-local validation.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `2`

## Recently completed tactical history

### TG9 — Lock publish-correct staged package metadata and file boundaries
- **Completed by:** repo-local AK tasks `task:1731-1733`.
- **What landed:** staged package manifest metadata, staged file boundaries, and packed tarball contents now fail closed against an intentional public-package contract.

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
- keep public docs and release promises downstream of the proven staged-package path
- preserve explicit package-contract expectations instead of falling back to accidental workspace layout assumptions
- leave deferred tasks `task:190-191` as contract-first work until an explicit repo-level decision promotes them
