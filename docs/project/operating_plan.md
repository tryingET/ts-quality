---
summary: "Operating plan with TG11 active: release-surface alignment and rehearsal capture are complete, and the first-release decision now runs through tasks 1756 and 1758."
read_when:
  - "When deciding the next bounded implementation slice in ts-quality"
  - "When translating the current tactical state into the repo-local queue"
type: "reference"
---

# Operating Plan

Active strategic goal: **SG3 — Prove first outside-repo adoption through deterministic packaging and release ergonomics**

Active tactical goal: **TG11 — Rehearse the first public staged-package operator path from the aligned surfaces**

## Current state

The repo has now aligned its public operator surfaces and captured a successful staged-package release rehearsal through `npm publish --dry-run --access public` from the staged package root. What remains in TG11 is making the first-release disposition explicit, then reflecting that decision back into the public release draft instead of leaving the publish posture implicit.

## Active operating slices

### OP2 — Record the first-release decision after the rehearsal
- **AK task:** `task:1756`
- **State:** active
- **Deliverable:** `docs/releases/2026-04-19-first-release-decision.md` records a clear go / no-go / defer decision after the rehearsal, with explicit blockers if publish still should not happen.
- **Guardrails:** keep the decision evidence-bound and explicit; do not substitute vague optimism for a real release disposition.

### OP3 — Reflect the first-release decision in the public release draft
- **AK task:** `task:1758`
- **State:** staged behind OP2
- **Deliverable:** the public release draft records the chosen first-release disposition instead of staying at rehearsal-only language.
- **Guardrails:** keep public release copy downstream of the explicit decision record; do not front-run the decision itself.

## Recently completed operating history

### OP1 — Capture the first staged-package release rehearsal
- **Completed by:** repo-local AK task `task:1755`.
- **What landed:** `docs/releases/2026-04-19-staged-package-release-rehearsal.md` captures the commands, observed outcomes, and remaining caveats from rehearsing the aligned staged-package path end to end.

## Queue discipline
- `task:1756` is the live ready slice for TG11
- `task:1758` depends on `task:1756`
- completed rehearsal task `task:1755` stays closed unless the staged-package operator path changes again
- completed release-surface-alignment tasks `task:1751-1753` stay closed unless the public operator surfaces drift again
- deferred contract-first tasks `task:190-191` remain out of the active SG3 execution wave
