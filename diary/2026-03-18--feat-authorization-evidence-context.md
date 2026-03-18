---
summary: "Session capture for adding run-bound evidence context to authorization decisions via AK task #192."
read_when:
  - "When resuming after task #192"
  - "When reviewing how authorization outputs were tied back to exact run artifacts without creating a second authority"
type: "diary"
---

# 2026-03-18 — authorization evidence context

## What I Did
- Confirmed repo-local AK readiness was still empty, then materialized and claimed AK task `#192` (`ts-quality: surface run-boundary evidence in authorization decisions`) as the opening SG2 slice.
- Audited the existing authorization sample artifacts and found that they compressed legitimacy review down to outcome + reasons, even when the blocking evidence already existed in `run.json` and `govern.txt`.
- Added additive `evidenceContext` to authorization decisions so `ts-quality authorize` now cites the exact evaluated run id, run-relative artifact paths, current blocking governance findings, and the first at-risk invariant provenance summary.
- Refreshed the reviewed authorization samples and added targeted regression coverage in both integration and golden-output tests so the new decision contract stays stable.
- Updated README / legitimacy docs plus the project handoff docs to reflect that SG2 has now landed its first repo-local slice.

## What Surprised Me
- The simplest useful legitimacy improvement was not another prose renderer; it was giving the existing JSON decision artifact enough run-bound context that a reviewer can jump back to the authoritative evidence bundle immediately.
- Golden-output parity for authorization artifacts became straightforward once the test pinned the run id to the reviewed sample id.

## Patterns
- When a decision surface feels too compressed, first project exact artifact references and the smallest relevant evidence summary instead of inventing a second explanation layer.
- `behaviorClaims[].evidenceSummary` remains the safest root for downstream decision provenance because it already carries the additive sub-signal contract.
- For reviewed JSON artifacts, exact-sample regression coverage is practical when the task fixes run ids and avoids embedding volatile timestamps.

## Candidates Deliberately Excluded
- Amendment-result projections; those still need a separate SG2 slice rather than being bundled into the authorization pass.
- Attestation-review output changes; they remain candidate follow-on work once amendment/attestation audit is complete.
