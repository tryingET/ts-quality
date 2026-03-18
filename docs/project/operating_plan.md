---
summary: "Operating plan for the active tactical goal (TG3) in ts-quality, with exact AK task IDs for the current concise-output regression-hardening wave."
read_when:
  - "When deciding the next bounded implementation slice in ts-quality"
  - "When translating the active tactical goal into the current repo-local queue"
type: "reference"
---

# Operating plan

## Active decomposition target
This file decomposes **TG3 — lock concise output parity with targeted regression coverage**.
It does **not** queue TG4 yet.

## Why TG3 is the active tactical goal
Repo truth now shows the concise operator contract aligned end to end:
- `check-summary.txt` projects risky-invariant provenance
- `trend` projects the latest run's first at-risk invariant provenance while keeping numeric deltas
- generated sample artifacts now include `check-summary.txt`
- `README.md` now describes the same concise artifact contract the code emits

The remaining gap is regression hardening so future concise-output/report tweaks do not silently drift that contract.

## Ordered operating slices (authoritative AK references)

### O1 — **AK `#186`** — add regression coverage for `check-summary` provenance output
State:
- ready now

Deliverable:
- targeted regression coverage proves `check-summary.txt` keeps the intended provenance projection
- concise-output parity is harder to regress silently
- no second evidence/report authority is introduced

Primary files likely involved:
- `test/cli-integration.test.mjs`
- `test/golden-output.test.mjs`
- `examples/artifacts/governed-app/check-summary.txt`

## Completed prerequisite slices

### P1 — **AK `#184`** — project risky invariant provenance into `check-summary.txt`
State:
- completed 2026-03-18

### P2 — **AK `#187`** — surface risky invariant context in `trend` output
State:
- completed 2026-03-18

### P3 — **AK `#185`** — include `check-summary.txt` in generated sample artifacts and README
State:
- completed 2026-03-18

## Current ready queue
Ready now:
- `#186` — add regression coverage for `check-summary` provenance output

Completed this session:
- `#185` — include `check-summary.txt` in generated sample artifacts and README

## HTN

```text
G0: Make concise operator surfaces stay honest about invariant evidence provenance
  SG1: Close the remaining concise operator-surface gaps under behaviorClaims[].evidenceSummary
    TG1: Finish concise run-status outputs so they still show risky-invariant context [done]
      P1: AK #184 -> project provenance into check-summary.txt [done]
      P2: AK #187 -> surface risky invariant context in trend output [done]
    TG2: Align generated sample artifacts and README with the concise output contract [done]
      P3: AK #185 -> add check-summary.txt to sample artifacts and README [done]
    TG3: Lock concise output parity with targeted regression coverage [active]
      O1: AK #186 -> add regression coverage for check-summary provenance output
```

## Queue discipline
- start with `#186` unless the operator explicitly reprioritizes
- do not decompose TG4 into active operating slices yet
- after TG3 is materially complete, refresh `tactical_goals.md`, decide whether TG4 or SG2 is next, and point `next_session_prompt.md` at that real next slice
