---
summary: "Strategic handoff with SG6 active: SG5 is complete, the next live wave returns to native legitimacy/evidence surfaces, and SG7 keeps adoption-facing validation on the horizon."
read_when:
  - "When deciding the next major bets for ts-quality"
  - "When reconciling vision.md with the current repo-local direction posture"
type: "reference"
---

# Strategic Goals

## Active strategic goal

### SG6 — Return the active wave to core product/runtime evidence surfaces after SG5 closure
- **Why now:** SG5 closed cleanly through `task:1763-1765`: the projection/verification contracts are implemented, the README plus handoff surfaces now carry that truth, and the repo no longer needs another control-plane-only wave to stay coherent. The next unfinished repo-local concern is back on the shipped product surface: `authorize` already projects additive run-bound evidence context and legitimacy flows already depend on exact attestations, but the authorization artifacts still do not project attestation verification outcomes with the same explicit run/subject continuity that `attest verify` already exposes.
- **Success signal:** the next active wave lands shipped runtime/docs/tests that deepen legitimacy/evidence continuity on exact run-bound artifacts instead of reopening queue/control-plane cleanup.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `2`

## Next strategic goal

### SG7 — Re-test adoption-facing operator paths after the next SG6 native-surface wave lands
- **Why next:** once SG6 improves a native product/runtime surface again, the repo should re-check outside-repo operator and release guidance against that richer surface rather than assuming the earlier SG3 rehearsal stays current forever.
- **Success signal:** adoption-facing docs, examples, and release guidance are revalidated against the richer SG6 product surface without turning that validation into another authority/control-plane detour.
- **Eisenhower-3D:** importance `2`, urgency `1`, difficulty `2`

## Recently completed strategic history

### SG5 — Implement the settled projection and verification artifact contracts
- **Completed by:** repo-local AK tasks `task:1763-1765`.
- **What landed:** the repo refreshed the active ladder after the first SG5 implementation pass, aligned README operator guidance with the settled handoff-sync / verification-artifact guard contract, then retired SG5 cleanly while promoting the next native product wave into AK-backed SG6 follow-through tasks `task:1766-1767`.

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
- reopening SG5 unless the settled projection/verification contracts prove insufficient in live use
- another control-plane/handoff cleanup wave when the remaining visible gap is now on shipped runtime legitimacy surfaces
- treating checked-in projection or verification artifacts as if they outrank AK or live verification commands
- generic cleanup that does not materially advance SG6 or the repo's native evidence surface
