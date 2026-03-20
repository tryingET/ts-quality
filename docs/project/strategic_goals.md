---
summary: "Strategic handoff for ts-quality with SG2 active, its authorization and attestation-review slices complete through AK #197, and no follow-on repo-local SG2 task materialized yet."
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

## Repo-wide hardening completed alongside SG2 intake
AK `#193` and `#194` are now complete outside the SG2 tactical line.
Together they replaced executable config/support-module evaluation with a data-only parser and added a materialized runtime JSON lane, which means config/runtime hardening is materially stronger even though SG2 still governs the active strategic direction.

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

### Current SG2 decomposition state
- authorization review surfaces **(landed via AK `#192`)**
- attestation review surfaces **(landed via AK `#195`, hardened via AK `#196` and AK `#197`)**
- amendment-facing outputs **(next candidate; not yet materialized into AK)**
- governance and legitimacy docs where authority boundaries could drift from emitted artifacts
- any remaining decision-facing summaries that still hide too much evidence provenance or run-boundary context

AK `#195` made attestation review keep signed subject context visible, AK `#196` hardened that slice by canonicalizing attestation verification records, aligning CLI/sample/runtime rendering, enforcing `artifactName` parity against the signed subject path, and extending run-scoped handling to nested artifacts, and AK `#197` closed the remaining operator-facing gaps by adding machine-readable `attest verify --json` output plus malformed-input parity under the same canonical record. That keeps attestation review downstream of one structured verification truth instead of letting adjacent surfaces drift.

### Success signals
- governance and legitimacy actions stay visibly tied to exact evidence artifacts and run boundaries
- authorization decisions now project exact run-bound artifact paths, blocking governance findings, and first risky-invariant provenance without competing with `run.json`
- attestation verification now projects signed subject path and exact run/artifact identity when available without competing with the signed payload itself
- attestation verification records now stay canonical across CLI review, persisted run artifacts, and reviewed sample artifacts
- payload/path parity for run-scoped attestation fields fails closed instead of being silently healed in presentation
- `attest verify --json` now gives automation a stable machine-readable escape hatch without forcing shell consumers to scrape human text
- reviewer-facing decision outputs remain explainable without competing with `run.json`
- exact approval / attestation / override semantics stay clearer in concise outputs and docs

## Non-goals for this strategic window
- semantic proof or non-deterministic scoring theater
- repo-global keyword matching as fake understanding
- another top-level evidence authority outside the additive artifact contract
- cross-repo program work not owned by this repo

## Relationship to downstream docs
- `tactical_goals.md` should either decompose SG2 or state explicitly that no SG2 tactical wave is materialized yet
- `operating_plan.md` should point at the next real SG2 slice once it exists, or say clearly that none is materialized yet
- `next_session_prompt.md` should name the next ready AK task, or say clearly that none is materialized yet
