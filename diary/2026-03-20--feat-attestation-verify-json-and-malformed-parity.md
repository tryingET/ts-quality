---
summary: "Session capture for AK #197, adding machine-readable attestation verification output and making malformed-input handling follow the same canonical record path."
read_when:
  - "When resuming after AK #197"
  - "When reviewing why attestation verification now has a machine-readable escape hatch"
type: "diary"
---

# 2026-03-20 — attestation verify json and malformed parity

## What I Did
- Claimed AK `#197` to close the remaining operator/automation gap left after the attestation verification parity pass.
- Extended `attest verify` so it now supports `--json`, returning the same canonical attestation verification record used by text output and persisted run artifacts.
- Hardened malformed-input behavior so invalid attestation JSON is reported through that same canonical record instead of surfacing a raw parser error.
- Updated CLI usage text, README, attestation docs, and regression tests to cover both machine-readable output and malformed-input handling.
- Refreshed direction/handoff docs plus the AK projection so repo truth records the slice as complete.

## Why This Slice
The attestation verification logic was already canonical internally after AK `#196`, but automation still had to scrape human-readable text, and malformed CLI inputs still bypassed the canonical reporting path.
Adding a JSON escape hatch and keeping malformed-input reporting on the same record path closes the last surfaced trust-surface gap from the adversarial review without widening scope into amendment work yet.

## Verification
- `npm run build`
- `node --test test/cli-integration.test.mjs test/golden-output.test.mjs test/authorization-integration.test.mjs`
- `npm run sample-artifacts`
- `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`
- `npm run verify`

## Follow-on
- No follow-on repo-local SG2 task is materialized yet.
- Amendment-facing outputs remain the leading candidate for the next audit/decomposition pass.
