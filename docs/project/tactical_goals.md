---
summary: "Tactical handoff with SG5 active: implementation of the settled projection/verification contracts is live, and the authority-decision wave is complete history."
read_when:
  - "When planning the next sprint/week for ts-quality"
  - "When turning the current strategic state into bounded delivery waves"
type: "reference"
---

# Tactical Goals

Active strategic goal: **SG5 — Implement the settled projection and verification artifact contracts**

The repo has already recorded the authority decisions that had blocked this area. The next unfinished repo-local concern is implementing those contracts in the handoff and verification surfaces themselves, starting with projection-sync automation and then tightening the checked-in verification artifact path.

## Active tactical goals

### TG14 — Implement the settled projection and verification artifact contracts
- **Why this is active:** SG4's decision records landed through `task:1760-1761`, so deferred tasks `task:190-191` can now run against explicit contracts instead of implied authority assumptions.
- **Completion target:** repo-local handoff projections and verification artifacts follow the chosen contracts deterministically, with generator-owned surfaces staying generated and manually curated handoff docs staying downstream of AK.
- **Materialized through:** repo-local AK tasks `task:190-191`.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `3`

### TG15 — Capture any remaining generator-ownership or drift follow-through after the first SG5 pass
- **Why this is next:** once `task:190-191` land, the repo may still expose narrower follow-on gaps around drift guards, generator ownership, or operator ergonomics; those should become an explicit bounded wave instead of staying implicit cleanup.
- **Completion target:** any remaining projection/verification follow-through after the first SG5 pass is either materialized as bounded tasks or explicitly shown not to exist.
- **Promotion trigger:** promote after TG14 lands or reveals a concrete follow-on.
- **Eisenhower-3D:** importance `2`, urgency `1`, difficulty `2`

## Recently completed tactical history

### TG13 — Record explicit authority contracts for repo-local projections and verification artifacts
- **Completed by:** repo-local AK tasks `task:1760-1761`.
- **What landed:** the repo now has ADRs for the hybrid projection-authority contract and for keeping verification artifacts as checked-in generated reference surfaces.

### TG11 — Rehearse the first public staged-package operator path from the aligned surfaces
- **Completed by:** repo-local AK tasks `task:1755-1758`.
- **What landed:** the repo rehearsed the staged-package publish path, recorded a first-release go decision from that evidence, and updated the public release draft so it reflects the explicit decision instead of an implied posture.

### TG10 — Align public install and release surfaces with the proven staged-package path
- **Completed by:** repo-local AK tasks `task:1751-1753`.
- **What landed:** the npm publishing checklist, release draft, and README quickstart now point at the same proven staged-package operator path instead of mixing package guidance with repo-only assumptions.

### TG9 — Lock publish-correct staged package metadata and file boundaries
- **Completed by:** repo-local AK tasks `task:1731-1733`.
- **What landed:** staged package manifest metadata, staged file boundaries, and packed tarball contents now fail closed against an intentional public-package contract.

Earlier SG2 siblings also remain complete:
- **TG5** through `task:192`
- **TG6** through `task:195-197`
- **TG7** through `task:1711-1713`

## Tactical guardrails
- keep AK authoritative for live queue truth even when checked-in projections remain useful for review
- implement the SG4 decisions instead of reopening them implicitly through ad hoc tooling changes
- keep `docs/project/*` and `next_session_prompt.md` downstream of AK rather than turning them into generated runtime authority
- keep `VERIFICATION.md` and `verification/verification.log` generator-owned, checked-in reference artifacts rather than treating them as hand-authored or live-status files
