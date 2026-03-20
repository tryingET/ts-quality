---
summary: "Session capture for AK #196, canonicalizing attestation verification records so CLI, runtime artifacts, and reviewed samples share one trust-rendering path."
read_when:
  - "When resuming after AK #196"
  - "When reviewing why attestation verification parity now holds across CLI/runtime/sample surfaces"
type: "diary"
---

# 2026-03-20 — attestation verification record parity

## What I Did
- Claimed AK `#196` to implement the nexus follow-up from the adversarial review.
- Added a shared `AttestationVerificationRecord` shape in `packages/evidence-model/src/index.ts`.
- Refactored `packages/ts-quality/src/index.ts` so attestation verification now produces one canonical structured record, then renders both CLI `attest verify` output and persisted `attestation-verify.txt` from that same record path.
- Hardened signed-subject parity by failing closed when `payload.artifactName` disagrees with the signed `subjectFile` path.
- Expanded run-scoped parsing so nested artifacts under `.ts-quality/runs/<run-id>/...` still preserve run/artifact context.
- Added regression coverage for runtime/CLI parity, signed `artifactName` drift, and nested run-scoped artifacts.
- Regenerated reviewed sample artifacts and refreshed docs/handoff/projection files.

## Why This Slice
The previous attestation-review slice improved the CLI surface, but left a hidden split:
- `attest verify` rendered rich subject context
- `check` still persisted a compressed issuer-only report

That made the trust surface drift even while tests passed.
The fix was to make both paths render from one structured verification record rather than duplicating presentation logic.

## Verification
- `npm run build`
- `node --test test/cli-integration.test.mjs test/golden-output.test.mjs test/authorization-integration.test.mjs`
- `npm run sample-artifacts`
- `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`
- `npm run verify`

## Follow-on
- No follow-on repo-local SG2 task is materialized yet.
- Amendment-facing outputs remain the leading candidate for the next audit/decomposition pass.
