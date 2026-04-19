---
summary: "Strategic handoff with SG4 active: SG3's release-story wave is complete, authority-contract decisions are now live, and implementation is the next repo-local horizon."
read_when:
  - "When deciding the next major bets for ts-quality"
  - "When reconciling vision.md with the current repo-local direction posture"
type: "reference"
---

# Strategic Goals

## Active strategic goal

### SG4 — Settle repo-local projection and verification artifact authority without drifting from AK
- **Why now:** SG3's first-release wave completed through `task:1755-1758`, so the repo is no longer blocked on the staged-package publish story itself. The next unfinished repo-local concern is the contract-first work deferred in `task:190-191`: whether `docs/project/*`, `next_session_prompt.md`, and `governance/work-items.json` are generated or manually synchronized projections, and whether `VERIFICATION.md` / `verification/verification.log` remain checked-in reference artifacts or become ephemeral outputs.
- **Success signal:** the repo records explicit ownership and generation contracts for those projection and verification surfaces, so later automation or cleanup work can proceed without silently changing authority boundaries or review expectations.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `3`

## Next strategic goal

### SG5 — Implement the settled projection and verification artifact contracts
- **Why next:** once SG4 records the authority decisions, the repo can resume or re-scope deferred implementation work such as `task:190-191` against a known contract instead of guessing what should be generated, checked in, or manually maintained.
- **Success signal:** the chosen projection and verification surfaces follow deterministic repo-local operators, checked-in artifacts stay truthful, and no projection surface outranks AK's live queue/runtime truth.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `3`

## Recently completed strategic history

### SG3 — Prove first outside-repo adoption through deterministic packaging and release ergonomics
- **Completed by:** repo-local AK tasks `task:1751-1758`.
- **What landed:** the repo aligned its staged-package operator surfaces, rehearsed the first public staged-package publish path through a real npm dry-run, recorded an explicit first-release go decision, and reflected that decision back into the release draft.

### SG2 — Carry ts-quality's evidence-native trust model into governance and legitimacy decision surfaces that still compress authority too far
- **Completed by:** repo-local AK tasks `task:192`, `task:195-197`, and `task:1711-1713`.
- **What landed:** authorization, attestation verification, and amendment outputs now keep exact run/proposal context visible through additive decision projections instead of collapsing to verdict-only shorthand.

The earlier SG1 concise operator-surface parity wave remains complete through repo-local AK tasks `task:184-187`.

## Not current strategic goals

These matter, but they are not the top repo-level bets right now:
- another packaging/release-story pass unless the staged-package operator surfaces drift again
- workflow/control-plane expansion that does not settle an authority contract or strengthen deterministic evidence
- making checked-in projection files look live/authoritative when AK is the runtime source of truth
- cleanup that changes whether artifacts are generated, checked in, or reviewed without first recording that contract explicitly
