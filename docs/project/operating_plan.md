---
summary: "Operating plan with TG11 active: release-surface alignment is complete, and staged-package rehearsal now runs through tasks 1755-1756."
read_when:
  - "When deciding the next bounded implementation slice in ts-quality"
  - "When translating the current tactical state into the repo-local queue"
type: "reference"
---

# Operating Plan

Active strategic goal: **SG3 — Prove first outside-repo adoption through deterministic packaging and release ergonomics**

Active tactical goal: **TG11 — Rehearse the first public staged-package operator path from the aligned surfaces**

## Current state

The repo now has the packaging pieces it was missing: the staged package is proven, the public package contract fails closed, and the checklist/release draft/README now point at that staged-package path instead of older repo-only assumptions. What is still missing is one truthful operator rehearsal from those aligned public surfaces, followed by an explicit first-release decision that records whether the repo is actually ready to publish or still intentionally waiting.

## Active operating slices

### OP1 — Capture the first staged-package release rehearsal
- **AK task:** `task:1755`
- **State:** active
- **Deliverable:** `docs/releases/2026-04-19-staged-package-release-rehearsal.md` captures the commands, observed outcomes, and any remaining operator friction when the aligned staged-package path is rehearsed end to end.
- **Guardrails:** rehearse the path the docs now describe; do not sneak in undocumented operator memory or unrelated build-topology changes.

### OP2 — Record the first-release decision after the rehearsal
- **AK task:** `task:1756`
- **State:** staged behind OP1
- **Deliverable:** `docs/releases/2026-04-19-first-release-decision.md` records a clear go / no-go / defer decision after the rehearsal, with explicit blockers if publish still should not happen.
- **Guardrails:** keep the decision evidence-bound and explicit; do not substitute vague optimism for a real release disposition.

## Queue discipline
- `task:1755` is the live ready slice for TG11
- `task:1756` depends on `task:1755`
- completed release-surface-alignment tasks `task:1751-1753` stay closed unless the public operator surfaces drift again
- deferred contract-first tasks `task:190-191` remain out of the active SG3 execution wave
