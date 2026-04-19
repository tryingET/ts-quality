---
summary: "Tactical handoff with SG4 active: the authority-decision wave is live, implementation is next, and the SG3 release-story wave is complete."
read_when:
  - "When planning the next sprint/week for ts-quality"
  - "When turning the current strategic state into bounded delivery waves"
type: "reference"
---

# Tactical Goals

Active strategic goal: **SG4 — Settle repo-local projection and verification artifact authority without drifting from AK**

The repo has already finished the first-release story for the staged-package path. The next unfinished repo-local concern is not more release wording; it is making the deferred authority contracts explicit before anyone automates handoff projections or changes whether verification artifacts stay checked in.

## Active tactical goals

### TG13 — Record explicit authority contracts for repo-local projections and verification artifacts
- **Why this is active:** deferred tasks `task:190-191` are blocked on exact repo-level decisions, so the smallest truthful next wave is recording those decisions rather than implementing automation or cleanup against an implied contract.
- **Completion target:** the repo has durable decision records for handoff/projection authority and verification-artifact ownership, and the deferred follow-on tasks have an explicit contract to implement against.
- **Materialized through:** repo-local AK tasks `task:1760-1761`.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `2`

### TG14 — Implement the settled projection and verification artifact contracts
- **Why this is next:** once TG13 lands, the repo can resume or re-scope `task:190-191` without guessing whether those surfaces should be generated, checked in, or manually maintained.
- **Completion target:** repo-local handoff and verification surfaces follow the chosen contracts deterministically while staying downstream of AK truth.
- **Promotion trigger:** promote after TG13's decision records land.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `3`

## Recently completed tactical history

### TG11 — Rehearse the first public staged-package operator path from the aligned surfaces
- **Completed by:** repo-local AK tasks `task:1755-1758`.
- **What landed:** the repo rehearsed the staged-package publish path, recorded a first-release go decision from that evidence, and updated the public release draft so it reflects the explicit decision instead of an implied posture.

### TG10 — Align public install and release surfaces with the proven staged-package path
- **Completed by:** repo-local AK tasks `task:1751-1753`.
- **What landed:** the npm publishing checklist, release draft, and README quickstart now point at the same proven staged-package operator path instead of mixing package guidance with repo-only assumptions.

### TG9 — Lock publish-correct staged package metadata and file boundaries
- **Completed by:** repo-local AK tasks `task:1731-1733`.
- **What landed:** staged package manifest metadata, staged file boundaries, and packed tarball contents now fail closed against an intentional public-package contract.

### TG8 — Prove staged tarball install/load behavior from a fresh temp project
- **Completed by:** repo-local AK tasks `task:1722-1724`.
- **What landed:** the repo can now stage the package, install the tarball in a fresh temp project, exercise the shipped CLI/API, and run that packaged proof path under repo verification instead of manual rehearsal.

Earlier SG2 siblings also remain complete:
- **TG5** through `task:192`
- **TG6** through `task:195-197`
- **TG7** through `task:1711-1713`

## Tactical guardrails
- keep AK authoritative for live queue truth even when checked-in projections are useful for review
- make authority contracts explicit before automating or untracking projection surfaces
- keep `docs/project/*` and `next_session_prompt.md` as downstream handoff surfaces, not a second runtime queue
- leave `task:190-191` deferred until the matching decision records exist
