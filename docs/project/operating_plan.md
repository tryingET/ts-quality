---
summary: "Operating plan with SG4/TG13 active: the projection-authority decision is live, the verification-artifact contract is sequenced behind it, and the SG3 release-story wave is complete."
read_when:
  - "When deciding the next bounded implementation slice in ts-quality"
  - "When translating the current tactical state into the repo-local queue"
type: "reference"
---

# Operating Plan

Active strategic goal: **SG4 — Settle repo-local projection and verification artifact authority without drifting from AK**

Active tactical goal: **TG13 — Record explicit authority contracts for repo-local projections and verification artifacts**

## Current state

The first-release staged-package wave is complete through `task:1755-1758`, but the repo handoff still points at done SG3 tasks. The next truthful step is to record the explicit authority decisions that were previously deferred before resuming automation/cleanup work for repo-local projection files and verification artifacts.

## Active operating slices

### OP1 — Record the repo-local projection authority contract
- **AK task:** `task:1760`
- **State:** active
- **Deliverable:** `docs/decisions/2026-04-19-projection-authority-contract.md` records which repo-local handoff/projection surfaces are generated, which stay manual, and how they remain downstream of AK.
- **Guardrails:** do not silently turn narrative handoff docs into generated runtime authority; keep the contract explicit about AK, `docs/project/*`, `next_session_prompt.md`, and `governance/work-items.json`.

### OP2 — Record the verification artifact contract
- **AK task:** `task:1761`
- **State:** staged behind OP1
- **Deliverable:** `docs/decisions/2026-04-19-verification-artifact-contract.md` records whether `VERIFICATION.md` and `verification/verification.log` stay checked-in reference artifacts or move to an ephemeral output contract.
- **Guardrails:** decide from deterministic reviewability and operator truth, not from convenience or churn-fatigue alone.

## Recently completed operating history

- **Release-draft reflection (`task:1758`):** `docs/releases/2026-03-20-v0.1.0-github-release-draft.md` now reflects the explicit post-rehearsal go decision instead of staying at rehearsal-only language.
- **First-release decision record (`task:1756`):** `docs/releases/2026-04-19-first-release-decision.md` records the explicit first public release go decision from the staged-package rehearsal evidence.

## Queue discipline
- `task:1760` is the live ready slice for TG13
- `task:1761` depends on `task:1760`
- deferred implementation tasks `task:190-191` stay deferred until the corresponding SG4 decision records exist
- completed SG3 release-story tasks `task:1755-1758` stay closed unless the staged-package story drifts again
