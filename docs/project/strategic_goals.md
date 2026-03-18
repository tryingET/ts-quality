---
summary: "Strategic handoff for ts-quality with SG2 active and its first authorization-facing slice now landed."
read_when:
  - "When deciding the next quarter-scale direction for ts-quality"
  - "When translating the current repo truth into the next strategic wave"
type: "reference"
---

# Strategic goals

## Strategic state
SG1 is now materially complete.
SG2 is now the active strategic goal.

## Current strategic stack

| Rank | Goal | Importance | Urgency | Difficulty | Status | Why it made the cut |
|---|---|---:|---:|---:|---|---|
| 1 | **SG1 — Close the remaining concise operator-surface gaps under `behaviorClaims[].evidenceSummary`** | 5 | 5 | 3 | **completed 2026-03-18** | The repo now ships the concise run-status surfaces, reviewed sample bundle / README contract, and regression hardening needed to keep that evidence projection honest. |
| 2 | **SG2 — Carry the same evidence truth into governance/legitimacy decision surfaces that still compress authority too far** | 4 | 3 | 4 | **active now** | After SG1 landed, the remaining meaningful gap is downstream decision surfaces that still need the same additive evidence discipline. |

## Active now vs completed
- **Active now:** SG2
- **Just completed:** SG1

## SG1 — Close the remaining concise operator-surface gaps under `behaviorClaims[].evidenceSummary`

### Why SG1 is now materially complete
The repo now keeps every currently intended concise operator surface visibly downstream of the additive invariant-evidence authority.
The work closed the runtime, reviewed-artifact, and regression-hardening gaps without introducing a second evidence/report authority.

### Completion signals now true
- `packages/ts-quality/src/index.ts` writes `check-summary.txt` with merge confidence, outcome, best-next-action, and the first at-risk invariant provenance when present
- `packages/ts-quality/src/index.ts` renders `trend` with deltas plus the latest run's first at-risk invariant provenance when relevant
- `scripts/generate-samples.mjs` exports `check-summary.txt` alongside the other concise operator-facing artifacts
- `examples/artifacts/governed-app/` includes `check-summary.txt`
- `README.md` describes the same concise artifact contract the code emits
- `packages/ts-mutate/src/index.ts` now runs mutation subprocesses in a hermetic context and fingerprints the effective execution environment so parent test-runner leakage does not silently corrupt results or reuse stale cached outcomes
- `scripts/generate-samples.mjs` now produces an idempotent reviewed sample bundle for `examples/artifacts/governed-app/`, with fixed sample run ids/timestamps where needed and normalized volatile mutation timing text
- `test/golden-output.test.mjs` now hardens `check-summary.txt` provenance framing against the checked-in reviewed sample with exact deterministic parity restored

## SG2 — Carry the same evidence truth into governance/legitimacy decision surfaces that still compress authority too far

### Why this is now the active strategic goal
The current operator-surface wave is materially complete.
The next meaningful risk is later decision surfaces where authority can still compress evidence too aggressively even though the additive artifact truth already exists.

### Likely scope when decomposed
- authorization review surfaces **(opening slice landed via AK `#192`)**
- attestation review surfaces
- amendment-facing outputs
- governance and legitimacy docs where authority boundaries could drift from emitted artifacts
- any remaining decision-facing summaries that still hide too much evidence provenance or run-boundary context

### Success signals
- governance and legitimacy actions stay visibly tied to exact evidence artifacts and run boundaries
- authorization decisions now project exact run-bound artifact paths, blocking governance findings, and first risky-invariant provenance without competing with `run.json`
- reviewer-facing decision outputs remain explainable without competing with `run.json`
- exact approval / attestation / override semantics stay clearer in concise outputs and docs

## Non-goals for this strategic window
- semantic proof or non-deterministic scoring theater
- repo-global keyword matching as fake understanding
- another top-level evidence authority outside the additive artifact contract
- cross-repo program work not owned by this repo

## Relationship to downstream docs
- `tactical_goals.md` should either decompose SG2 or state explicitly that no SG2 tactical wave is materialized yet
- `operating_plan.md` should point at the first real SG2 slice once it exists
- `next_session_prompt.md` should name the next ready AK task, or say clearly that none is materialized yet
