---
summary: "Strategic handoff with SG5 still active: first-pass SG5 implementation landed, remaining operator-surface follow-through is now the live concern, and SG6 waits behind it."
read_when:
  - "When deciding the next major bets for ts-quality"
  - "When reconciling vision.md with the current repo-local direction posture"
type: "reference"
---

# Strategic Goals

## Active strategic goal

### SG5 — Implement the settled projection and verification artifact contracts
- **Why now:** the first SG5 implementation pass landed through `task:190-191`, but the repo still has unfinished SG5 follow-through: `ak direction` now fails because the active operating nodes point at completed tasks, and the operator-facing docs still do not fully carry the new handoff-sync / verification-guard truth. The next unfinished repo-local concern is closing that last follow-through so the settled contracts are reflected in durable operator surfaces instead of session memory.
- **Success signal:** the repo's direction/handoff surfaces and operator docs truthfully reflect the settled SG5 automation/guard contract, and SG5 can then either retire cleanly or materialize one exact remaining follow-on instead of staying active by inertia.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `2`

## Next strategic goal

### SG6 — Return the active wave to core product/runtime evidence surfaces after SG5 closes
- **Why next:** SG3 through SG5 concentrated on release posture plus repo-local control-plane authority. Once SG5's remaining follow-through is closed, the next truthful major bet is to move active execution back toward the repo's native product surface — deterministic evidence, operator-facing artifacts, governance, and legitimacy semantics — rather than spending another wave on control-plane cleanup.
- **Success signal:** the next active repo-local wave changes shipped `ts-quality` runtime/docs/tests/contracts in service of the evidence-native trust model rather than only release/process/bootstrap plumbing.
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
- reopening the SG4 authority decisions without a concrete supersession trigger
- another packaging/release-story pass unless the staged-package operator surfaces drift again
- treating checked-in projection or verification artifacts as if they outrank AK or live verification commands
- generic cleanup that does not materially close SG5 or advance the repo's native evidence surface
