---
summary: "Tactical handoff with the SG2 authorization and attestation-review slices complete through AK #197, no follow-on repo-local SG2 tactical slice materialized yet, and amendment-facing results still the leading candidate."
read_when:
  - "When planning the next sprint/week for ts-quality"
  - "When turning the current strategic state into bounded delivery waves"
type: "reference"
---

# Tactical goals

## Current decomposition state
SG1 is materially complete as of 2026-03-18.
SG2 is now the active strategic goal, and its two repo-local tactical slices so far landed via AK `#192` plus the attestation-review refinement passes in AK `#195`, `#196`, and `#197`.
There is no follow-on repo-local SG2 tactical slice materialized into AK yet; amendment-facing results remain the leading candidate for the next audit/decomposition pass.

## Tactical record

| Rank | Tactical goal | Importance | Urgency | Difficulty | Status |
|---|---|---:|---:|---:|---|
| 1 | **TG1 — Finish concise run-status outputs so they still show risky-invariant context** | 5 | 5 | 2 | **completed 2026-03-18** |
| 2 | **TG2 — Align generated sample artifacts and README with the concise output contract** | 4 | 4 | 2 | **completed 2026-03-18** |
| 3 | **TG3 — Lock concise output parity with targeted regression coverage** | 4 | 4 | 3 | **completed 2026-03-18** |
| 4 | **TG4 — Re-audit remaining decision-side outputs after run-status parity lands** | 3 | 3 | 3 | **not promoted; folded into SG2 intake** |
| 5 | **TG5 — Make authorization decisions cite exact run-bound evidence** | 4 | 3 | 2 | **completed 2026-03-18** |
| 6 | **TG6 — Make attestation verification outputs cite exact signed subject context** | 4 | 3 | 2 | **completed 2026-03-20** |

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

## TG6 — Make attestation verification outputs cite exact signed subject context

### Why TG6 is now complete
Attestation review no longer collapses trust down to issuer + verification status alone.
`attest verify` and the reviewed `attestation.verify.txt` sample now keep the signed subject path visible, and when the subject is run-scoped they also surface the exact `runId` and artifact name.
That closes the narrow attestation-review SG2 gap without inventing a second authority beyond the attestation payload.

### Completion signals now true
- `attest verify` projects the signed subject path alongside verification status/reason
- when the attestation binds to `.ts-quality/runs/<run-id>/<artifact>`, the output also surfaces `runId` and artifact identity, including nested run-scoped artifacts
- the same structured verification record now drives CLI review, persisted `attestation-verify.txt`, and the reviewed `attestation.verify.txt` sample
- `attest verify --json` now exposes that same record for machine consumers
- verification fails closed when signed `payload.runId` or `payload.artifactName` drift from the signed `subjectFile` path
- malformed attestation files now report through the canonical verification record instead of bubbling raw parser errors
- targeted regression coverage now locks the attestation-review contract without inventing a second authority beyond the attestation payload itself

## Next tactical handoff
- **Active strategic goal:** SG2
- **Active tactical goal:** none materialized yet
- **Next required action:** audit amendment-facing results, then materialize the next repo-local SG2 slice before coding
- **Recent completion:** AK `#195`, `#196`, and `#197` landed run-bound subject context, canonical verification-record parity across CLI/runtime/sample surfaces, and a machine-readable escape hatch for automation
- **Recent repo-wide hardening:** AK `#193` and `#194` are complete; config/support modules now use a data-only contract and can be materialized into canonical runtime JSON artifacts for later runs

## Tactical guardrails
- keep `behaviorClaims[].evidenceSummary` as the additive root
- do not let concise or decision-side outputs outrank `run.json`
- prefer small end-to-end slices over broad redesign
- when no tactical slice is materialized yet, say so explicitly instead of pretending there is active queue truth
