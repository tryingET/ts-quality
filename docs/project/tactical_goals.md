---
summary: "Tactical goals for the active strategic goal (SG1) in ts-quality, with TG3 now active after sample-artifact / README alignment landed."
read_when:
  - "When planning the next sprint/week for ts-quality"
  - "When turning the active strategic goal into bounded delivery waves"
type: "reference"
---

# Tactical goals

## Active strategic goal being decomposed
This file decomposes **SG1 — close the remaining concise operator-surface gaps under `behaviorClaims[].evidenceSummary`**.
It does **not** yet decompose SG2.

## Tactical goals for SG1 (Eisenhower-3D)

| Rank | Tactical goal | Importance | Urgency | Difficulty | Status |
|---|---|---:|---:|---:|---|
| 1 | **TG1 — Finish concise run-status outputs so they still show risky-invariant context** | 5 | 5 | 2 | **completed 2026-03-18** |
| 2 | **TG2 — Align generated sample artifacts and README with the concise output contract** | 4 | 4 | 2 | **completed 2026-03-18** |
| 3 | **TG3 — Lock concise output parity with targeted regression coverage** | 4 | 4 | 3 | **active now** |
| 4 | **TG4 — Re-audit remaining decision-side outputs after run-status parity lands** | 3 | 3 | 3 | later under SG1 |

## TG1 — Finish concise run-status outputs so they still show risky-invariant context

### Why TG1 is now complete
The remaining concise run-status gap was `trend`.
That gap is now closed:
- `check-summary.txt` projects the first at-risk invariant plus concise provenance from `behaviorClaims[].evidenceSummary`
- `trend` now keeps its delta role while also surfacing the latest run's first at-risk invariant and concise provenance when relevant

### Completion signals now true
- terse run-status outputs stay readable while exposing the first at-risk invariant when present
- provenance remains a projection from `behaviorClaims[].evidenceSummary`, not a parallel reasoning tree
- `trend` output no longer compresses the evidence basis into deltas alone

### Operating-plan handoff
`operating_plan.md` now decomposes **TG2 only**.

## TG2 — Align generated sample artifacts and README with the concise output contract

### Why TG2 is now complete
The reviewed example bundle and README now show the same concise surfaces operators are expected to trust:
- `scripts/generate-samples.mjs` exports `check-summary.txt`
- `examples/artifacts/governed-app/` now includes `check-summary.txt`
- `README.md` lists `check-summary.txt` as part of the concise run-status artifact contract

### Completion signals now true
- `scripts/generate-samples.mjs` exports the concise surfaces the repo intends reviewers to trust
- `README.md` lists and describes those concise artifacts truthfully
- example artifacts remain reviewable and intentional

### Operating-plan handoff
`operating_plan.md` now decomposes **TG3 only**.

## TG3 — Lock concise output parity with targeted regression coverage

### Why this is active now
The runtime surfaces and reviewed sample/documentation contract are aligned.
The remaining SG1 risk is drift: concise outputs look secondary, so they need explicit regression coverage before future report tweaks can silently break the contract.

### Success signals
- targeted tests fail if concise provenance disappears from the intended surfaces
- golden-output coverage includes the concise run-status surfaces the repo treats as contract-bearing
- future report tweaks are less likely to silently create divergence

## TG4 — Re-audit remaining decision-side outputs after run-status parity lands

### Why this stays later
This tactical goal belongs to the same strategic theme, but it should wait until TG3 is complete.
After parity hardening lands, the repo can re-check whether any remaining decision-side outputs still summarize evidence too aggressively.

### Likely evidence to inspect when promoted
- authorization / attestation review text
- amendment-facing outputs
- any concise decision summaries downstream of governance or legitimacy flows

## Tactical guardrails
- keep `behaviorClaims[].evidenceSummary` as the additive root
- do not let concise outputs outrank `run.json`
- prefer small end-to-end slices over broad redesign
- do not decompose TG4 into active operating slices until TG3 is materially complete
