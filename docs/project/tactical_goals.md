---
summary: "Tactical handoff with SG5 still active: TG15 operator-surface follow-through is now live, TG16 is the closure/promotion sibling behind it, and TG14 is complete history."
read_when:
  - "When planning the next sprint/week for ts-quality"
  - "When turning the current strategic state into bounded delivery waves"
type: "reference"
---

# Tactical Goals

Active strategic goal: **SG5 — Implement the settled projection and verification artifact contracts**

The repo already landed the first SG5 implementation pass. The next unfinished SG5 concern is narrower: carrying that new helper/guard truth into operator-facing docs and durable handoff surfaces, then deciding explicitly whether SG5 is done or still has one final concrete follow-on.

## Active tactical goals

### TG15 — Align operator-facing docs and handoff surfaces with the settled SG5 automation/guard contract
- **Why this is active:** `task:190-191` landed the first-pass implementation, but `README.md` and the active direction/handoff surfaces still lag that truth: the helper/guard story is not fully carried into the repo's durable operator surfaces, and `ak direction` still points at the finished TG14 tasks.
- **Completion target:** README plus the active direction/handoff surfaces truthfully reflect the settled SG5 automation/guard contract, and the repo no longer depends on hidden session memory to know how those surfaces are supposed to work.
- **Materialized through:** repo-local AK tasks `task:1763-1764`.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `2`

### TG16 — Close SG5 or materialize one last concrete SG5 follow-through
- **Why this is next:** once TG15 lands, the repo should make SG5 closure explicit instead of leaving the strategic ladder hanging on a finished implementation pass. If TG15 reveals one concrete remaining follow-through, materialize it; otherwise retire SG5 cleanly and promote SG6.
- **Completion target:** SG5 is either explicitly closed in favor of SG6 or given one exact remaining follow-on with authoritative AK coverage.
- **Promotion trigger:** promote after TG15 completes through `task:1763-1764`.
- **Eisenhower-3D:** importance `2`, urgency `1`, difficulty `2`

## Recently completed tactical history

### TG14 — Implement the settled projection and verification artifact contracts
- **Completed by:** repo-local AK tasks `task:190-191`.
- **What landed:** the repo now has a local `handoff:sync` / `handoff:check` automation surface, `verify:ci` enforces the stabilized verification-artifact contract, and the tracked verification log stays canonical across full and skip-install verification paths.

### TG13 — Record explicit authority contracts for repo-local projections and verification artifacts
- **Completed by:** repo-local AK tasks `task:1760-1761`.
- **What landed:** the repo now has ADRs for the hybrid projection-authority contract and for keeping verification artifacts as checked-in generated reference surfaces.

### TG11 — Rehearse the first public staged-package operator path from the aligned surfaces
- **Completed by:** repo-local AK tasks `task:1755-1758`.
- **What landed:** the repo rehearsed the staged-package publish path, recorded a first-release go decision from that evidence, and updated the public release draft so it reflects the explicit decision instead of an implied posture.

Earlier SG2 siblings also remain complete:
- **TG5** through `task:192`
- **TG6** through `task:195-197`
- **TG7** through `task:1711-1713`

## Tactical guardrails
- keep AK authoritative for live queue truth even when checked-in projections remain useful for review
- close the remaining SG5 follow-through instead of letting completed TG14 tasks keep occupying the active ladder
- keep `docs/project/*` and `next_session_prompt.md` downstream of AK rather than turning them into generated runtime authority
- keep `VERIFICATION.md` and `verification/verification.log` generator-owned, checked-in reference artifacts rather than treating them as hand-authored or live-status files
