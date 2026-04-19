---
summary: "Operating plan with SG5/TG14 active: projection-sync implementation is the preferred next slice, verification-artifact stabilization is the sibling follow-on, and the authority-decision wave is complete."
read_when:
  - "When deciding the next bounded implementation slice in ts-quality"
  - "When translating the current tactical state into the repo-local queue"
type: "reference"
---

# Operating Plan

Active strategic goal: **SG5 — Implement the settled projection and verification artifact contracts**

Active tactical goal: **TG14 — Implement the settled projection and verification artifact contracts**

## Current state

The SG4 authority decisions landed through `task:1760-1761`, and the earlier deferrals on `task:190-191` have now been released. The next truthful step is implementing those chosen contracts in repo-local automation and artifact handling rather than leaving the decisions purely declarative.

## Active operating slices

### OP1 — Implement projection sync under the hybrid authority contract
- **AK task:** `task:190`
- **State:** active
- **Deliverable:** repo-local projection automation/export workflow respects the hybrid contract: AK stays authoritative, `governance/work-items.json` stays exported, and handoff docs stay manually curated but reconciled.
- **Guardrails:** automate export/check/scaffolding without turning `docs/project/*` or `next_session_prompt.md` into generated runtime authority.

### OP2 — Stabilize checked-in verification artifacts under the chosen contract
- **AK task:** `task:191`
- **State:** next handoff slice (AK also shows it as ready)
- **Deliverable:** verification artifact handling is tightened under the checked-in reference-artifact contract without collapsing those files into ephemeral-only output.
- **Guardrails:** keep `VERIFICATION.md` and `verification/verification.log` generator-owned, sanitized, and reviewable; do not treat them as live CI/runtime authority.

## Recently completed operating history

- **Projection-authority decision (`task:1760`):** `docs/decisions/2026-04-19-projection-authority-contract.md` records the hybrid contract for AK, handoff docs, and `governance/work-items.json`.
- **Verification-artifact decision (`task:1761`):** `docs/decisions/2026-04-19-verification-artifact-contract.md` keeps `VERIFICATION.md` and `verification/verification.log` as checked-in generated reference artifacts.

## Queue discipline
- `task:190` is the preferred starting slice for TG14
- `task:191` is also ready in AK after its deferral release, but the handoff keeps it as the sibling follow-on behind `task:190`
- completed SG4 decision tasks `task:1760-1761` stay closed unless the contracts need explicit supersession
- completed SG3 release-story tasks `task:1755-1758` stay closed unless the staged-package story drifts again
