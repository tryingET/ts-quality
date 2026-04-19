---
summary: "Operating plan with SG5/TG15 active: direction/handoff refresh is the live slice, README operator guidance alignment is next, and explicit SG5 closure/promotion is staged behind it."
read_when:
  - "When deciding the next bounded implementation slice in ts-quality"
  - "When translating the current tactical state into the repo-local queue"
type: "reference"
---

# Operating Plan

Active strategic goal: **SG5 — Implement the settled projection and verification artifact contracts**

Active tactical goal: **TG15 — Align operator-facing docs and handoff surfaces with the settled SG5 automation/guard contract**

## Current state

The first SG5 implementation pass landed through `task:190-191`, but the repo's active direction/handoff surfaces still point at those finished tasks and the operator docs have not yet fully absorbed the new helper/guard truth. The next truthful step is a narrow SG5 follow-through wave: refresh the active ladder, align the README operator guidance, then close SG5 explicitly or materialize one last exact follow-on if the docs pass reveals it.

## Active operating slices

### OP1 — Promote TG15 after TG14 completion and refresh direction/handoff truth
- **AK task:** `task:1763`
- **State:** active
- **Deliverable:** `docs/project/*`, `next_session_prompt.md`, `governance/work-items.json`, and the diary are refreshed so the active ladder points at TG15 and its live follow-on tasks instead of the completed TG14 implementation tasks.
- **Guardrails:** keep the handoff surfaces downstream of AK and avoid front-running SG6 before TG15 actually lands.

### OP2 — Align README operator guidance with handoff sync and verification guard surfaces
- **AK task:** `task:1764`
- **State:** next handoff slice
- **Deliverable:** `README.md` truthfully describes the settled SG5 operator surfaces — including the local handoff-sync workflow and the verification-artifact guard — without implying those surfaces are the live authority.
- **Guardrails:** do not claim `handoff:check` is a CI/runtime authority surface; keep the README aligned to the actual local-vs-live contract.

### OP3 — Close SG5 or materialize the last SG5 follow-through after README alignment
- **AK task:** `task:1765`
- **State:** staged behind OP2
- **Deliverable:** once README alignment lands, the repo refreshes the ladder again so SG5 either retires cleanly in favor of SG6 or names one exact remaining SG5 follow-on with authoritative AK coverage.
- **Guardrails:** fail closed on empty queue vs actual completion; do not leave the active ladder pointing at finished SG5 slices by inertia.

## Recently completed operating history

- **Projection sync helper (`task:190`):** `scripts/handoff-sync.mjs` plus `handoff:sync` / `handoff:check` now provide the narrow SG5 automation surface allowed by the projection-authority ADR.
- **Verification artifact stabilization (`task:191`):** `verify:ci` now enforces the tracked verification-artifact contract, and `scripts/verify.mjs` keeps `verification/verification.log` canonical across full and skip-install verification runs.

## Queue discipline
- `task:1763` is the live ready slice for TG15
- `task:1764` is the next TG15 execution slice once `task:1763` lands
- `task:1765` depends on `task:1764`
- completed TG14 implementation tasks `task:190-191` stay closed unless the settled SG5 contracts prove insufficient in practice
- SG6 stays horizon-only until TG15/TG16 finish and SG5 is explicitly retired or extended
