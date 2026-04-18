---
summary: "Strategic handoff with SG3 active: packaging proof is now the live outside-repo adoption wave, while projection/verification authority decisions remain the next contract-first follow-on."
read_when:
  - "When deciding the next major bets for ts-quality"
  - "When reconciling vision.md with the current repo-local direction posture"
type: "reference"
---

# Strategic Goals

## Active strategic goal

### SG3 — Prove first outside-repo adoption through deterministic packaging and release ergonomics
- **Why now:** SG2's amendment-output wave is materially complete through `task:1711-1713`, so the next unfinished repo-local bet is no longer another legitimacy surface. The repo already ships a staged packaging helper (`npm run pack:ts-quality`), public README/release surfaces, and an npm publishing checklist, and the staged tarball path now deserves active task coverage instead of staying a manual release-memory exercise.
- **Success signal:** `ts-quality` can be staged, installed into a fresh temp project, and exercised through automated repo-local proof that the CLI and public module entrypoint load without repo-relative breakage; release/operator docs stay downstream of that proof instead of hand-wavy manual sequencing.
- **Eisenhower-3D:** importance `4`, urgency `3`, difficulty `3`

## Next strategic goal

### SG4 — Settle repo-local projection and verification artifact authority without drifting from AK
- **Why next:** deferred tasks `task:190-191` show real unfinished repo-local process work around whether `next_session_prompt.md`, `docs/project/*`, `governance/work-items.json`, `VERIFICATION.md`, and `verification/verification.log` are manually synchronized projections or generated artifacts. That work is real, but it is still contract-first and should not displace the newly active SG3 execution wave.
- **Success signal:** repo-local handoff and verification artifacts have explicit ownership/generation contracts, so deferred automation or cleanup can be promoted later without accidentally changing authority boundaries or live source-of-truth rules.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `3`

## Recently completed strategic history

### SG2 — Carry ts-quality's evidence-native trust model into governance and legitimacy decision surfaces that still compress authority too far
- **Completed by:** repo-local AK tasks `task:192`, `task:195-197`, and `task:1711-1713`.
- **What landed:** authorization, attestation verification, and amendment outputs now keep exact run/proposal context visible through additive decision projections instead of collapsing to verdict-only shorthand.

The earlier SG1 concise operator-surface parity wave remains complete through repo-local AK tasks `task:184-187`.

## Not current strategic goals

These matter, but they are not the top repo-level bets right now:
- another headline scoring or semantic layer that outranks explicit evidence
- repo-global keyword coincidence dressed up as behavioral understanding
- workflow/control-plane expansion that does not strengthen ts-quality's native evidence model
- direction prose that tries to replace live AK execution truth
