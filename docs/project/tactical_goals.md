---
summary: "Tactical handoff with SG3 active: TG10 release-surface alignment is complete, TG11 staged-release rehearsal is now live, and TG12 first-release disposition is sequenced behind it."
read_when:
  - "When planning the next sprint/week for ts-quality"
  - "When turning the current strategic state into bounded delivery waves"
type: "reference"
---

# Tactical Goals

Active strategic goal: **SG3 — Prove first outside-repo adoption through deterministic packaging and release ergonomics**

The repo now has explicit package-contract proof and aligned public operator surfaces in place: staged manifest metadata, staged file boundaries, packed tarball contents, the npm publishing checklist, the release draft, and the README quickstart all point at the same staged-package path. The next unfinished repo-local SG3 bet is proving that aligned path as one coherent operator rehearsal instead of leaving it as documentation-only alignment.

## Active tactical goals

### TG11 — Rehearse the first public staged-package operator path from the aligned surfaces
- **Why this is active:** TG10 is now complete, so SG3's next truthful slice is running the newly aligned public operator path end to end and capturing whether it actually behaves like the repo now claims it does.
- **Completion target:** the staged-package operator path is rehearsed from the aligned public surfaces, remaining ergonomic gaps are explicit, and the repo no longer depends on undocumented release-memory to describe its first publish path.
- **Materialized through:** repo-local AK tasks `task:1755-1756`.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `2`

### TG12 — Decide the first public release disposition after the rehearsal
- **Why this is next:** once TG11 captures the rehearsal truth, the repo needs an explicit publish / defer decision instead of leaving the first release implied.
- **Completion target:** the first public release posture is explicit, with either a go decision or concrete blockers that explain why publish remains deferred.
- **Promotion trigger:** promote after TG11's rehearsal and decision capture are complete.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `2`

## Recently completed tactical history

### TG10 — Align public install and release surfaces with the proven staged-package path
- **Completed by:** repo-local AK tasks `task:1751-1753`.
- **What landed:** the npm publishing checklist, release draft, and README quickstart now point at the same proven staged-package operator path instead of mixing package guidance with repo-only assumptions.

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
- rehearse the public operator path the docs now describe instead of relying on extra human memory
- keep release decisions explicit and evidence-bound rather than implied by updated prose alone
- leave deferred tasks `task:190-191` as contract-first work until an explicit repo-level decision promotes them
