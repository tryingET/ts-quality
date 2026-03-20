---
summary: "Session capture for AK #195, making attestation verification outputs keep the signed subject path and run-bound artifact context visible."
read_when:
  - "When resuming after AK #195"
  - "When reviewing how attestation verification outputs stayed downstream of the signed payload"
type: "diary"
---

# 2026-03-20 — attestation verify subject context

## What I Did
- Claimed AK `#195` after the planning refresh promoted attestation review into the next SG2 slice.
- Updated `packages/ts-quality/src/index.ts` so `attest verify` now prints the signed subject path alongside verification status/reason, and also prints `Run` / `Artifact` when the signed subject is a run-scoped artifact.
- Kept the projection downstream of the attestation payload by deriving the extra context from the signed `subjectFile` path rather than inventing a new evidence authority.
- Updated `scripts/generate-samples.mjs` so the reviewed attestation sample carries run-bound payload fields and the generated `attestation.verify.txt` sample is produced through the product verification path.
- Added regression coverage for both success and failure cases, plus golden coverage for the reviewed attestation verification sample.
- Refreshed `docs/attestation-format.md`, the project direction/handoff docs, `next_session_prompt.md`, and the `governance/work-items.json` projection.

## Why This Slice
Authorization outputs were already carrying additive run-bound evidence after AK `#192`, but attestation review still collapsed trust down to issuer + status.
The missing piece was keeping the exact signed subject visible during verification, especially when the subject already identified a specific run artifact.

## Verification
- `npm run build`
- `node --test test/authorization-integration.test.mjs test/cli-integration.test.mjs test/golden-output.test.mjs`
- `npm run sample-artifacts`
- `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`
- `npm run verify`

## Follow-on
- No follow-on repo-local SG2 task is materialized yet.
- Amendment-facing outputs remain the leading candidate for the next audit/decomposition pass.
