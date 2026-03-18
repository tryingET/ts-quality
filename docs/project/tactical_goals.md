---
summary: "Tactical handoff with the opening SG2 authorization slice complete and no follow-on repo-local slice materialized yet."
read_when:
  - "When planning the next sprint/week for ts-quality"
  - "When turning the current strategic state into bounded delivery waves"
type: "reference"
---

# Tactical goals

## Current decomposition state
SG1 is materially complete as of 2026-03-18.
SG2 is now the active strategic goal, and its opening repo-local tactical slice landed via AK `#192`.
There is no follow-on repo-local SG2 tactical slice materialized into AK yet.

## Tactical record

| Rank | Tactical goal | Importance | Urgency | Difficulty | Status |
|---|---|---:|---:|---:|---|
| 1 | **TG1 — Finish concise run-status outputs so they still show risky-invariant context** | 5 | 5 | 2 | **completed 2026-03-18** |
| 2 | **TG2 — Align generated sample artifacts and README with the concise output contract** | 4 | 4 | 2 | **completed 2026-03-18** |
| 3 | **TG3 — Lock concise output parity with targeted regression coverage** | 4 | 4 | 3 | **completed 2026-03-18** |
| 4 | **TG4 — Re-audit remaining decision-side outputs after run-status parity lands** | 3 | 3 | 3 | **not promoted; folded into SG2 intake** |
| 5 | **TG5 — Make authorization decisions cite exact run-bound evidence** | 4 | 3 | 2 | **completed 2026-03-18** |

## TG5 — Make authorization decisions cite exact run-bound evidence

### Why TG5 is now complete
`ts-quality authorize` no longer collapses legitimacy judgment down to outcome + reasons alone.
The decision artifact now carries a concise additive projection of the exact run it evaluated, while still treating `run.json` as the authority.

### Completion signals now true
- `authorize.<agent>.<action>.json` now includes `evidenceContext` with the evaluated `runId`, exact artifact paths, merge confidence, current blocking governance findings, and the first at-risk invariant provenance summary
- the same `evidenceContext` is returned on CLI stdout for `ts-quality authorize`
- `examples/artifacts/governed-app/authorize*.json` shows the reviewed authorization contract with run-bound evidence context
- integration coverage now checks that authorization decisions carry the expected run-bound governance and invariant evidence
- golden-output coverage now locks the reviewed `authorize.release-bot.json` sample against exact deterministic parity

## Next tactical handoff
- **Active strategic goal:** SG2
- **Active tactical goal:** none materialized yet
- **Next required action:** audit amendment-facing and attestation-review outputs, then materialize the next repo-local SG2 slice before coding

## Tactical guardrails
- keep `behaviorClaims[].evidenceSummary` as the additive root
- do not let concise or decision-side outputs outrank `run.json`
- prefer small end-to-end slices over broad redesign
- when no tactical slice is materialized yet, say so explicitly instead of pretending there is active queue truth
