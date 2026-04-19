---
summary: "Strategic handoff with SG5 active: SG4's authority decisions are complete, the implementation wave is now live, and earlier release-story work remains complete history."
read_when:
  - "When deciding the next major bets for ts-quality"
  - "When reconciling vision.md with the current repo-local direction posture"
type: "reference"
---

# Strategic Goals

## Active strategic goal

### SG5 — Implement the settled projection and verification artifact contracts
- **Why now:** SG4's contract decisions landed through `task:1760-1761`, which means the earlier deferrals on `task:190-191` are no longer blocked on missing repo-level decisions. The next unfinished repo-local concern is implementing those chosen contracts so the handoff and verification surfaces follow them in practice rather than only in ADR text.
- **Success signal:** repo-local handoff projections and verification artifacts follow the chosen contracts deterministically, generated surfaces stay generator-owned, manually curated surfaces stay downstream of AK, and no checked-in artifact is mistaken for live runtime authority.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `3`

## Recently completed strategic history

### SG4 — Settle repo-local projection and verification artifact authority without drifting from AK
- **Completed by:** repo-local AK tasks `task:1760-1761`.
- **What landed:** the repo now has explicit ADRs for the hybrid projection-authority contract and the checked-in verification-artifact contract, which resolved the authority questions that had kept `task:190-191` deferred.

### SG3 — Prove first outside-repo adoption through deterministic packaging and release ergonomics
- **Completed by:** repo-local AK tasks `task:1751-1758`.
- **What landed:** the repo aligned its staged-package operator surfaces, rehearsed the first public staged-package publish path through a real npm dry-run, recorded an explicit first-release go decision, and reflected that decision back into the release draft.

### SG2 — Carry ts-quality's evidence-native trust model into governance and legitimacy decision surfaces that still compress authority too far
- **Completed by:** repo-local AK tasks `task:192`, `task:195-197`, and `task:1711-1713`.
- **What landed:** authorization, attestation verification, and amendment outputs now keep exact run/proposal context visible through additive decision projections instead of collapsing to verdict-only shorthand.

The earlier SG1 concise operator-surface parity wave remains complete through repo-local AK tasks `task:184-187`.

## Not current strategic goals

These matter, but they are not the top repo-level bets right now:
- revisiting the SG4 authority decision itself without a concrete supersession need
- another packaging/release-story pass unless the staged-package operator surfaces drift again
- treating checked-in projection or verification artifacts as if they outrank AK or live verification commands
- cleanup that changes generated/manual boundaries without a new explicit decision
