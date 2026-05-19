---
summary: "Durable adoption proof for test-capabilities dependency-intelligence review-program dogfood."
read_when:
  - "Reviewing ts-quality adoption evidence for dependency-intelligence review-program work."
  - "Checking durable proof that dep-diet, dep-viz, and DSPx review-program handoffs ran on test-capabilities."
type: "evidence"
---

# Test-capabilities dependency-intelligence review-program proof

Date: 2026-05-19

Source-owner evidence:

- `test-capabilities` commit `589b3ca` — `docs/project/dependency-intelligence-review-program-dogfood.md`
- artifact root: `/tmp/test-capabilities-depintel-review-program-20260519123902`

## What was proven

The dependency-intelligence review-program loop ran against `test-capabilities`:

```text
runtime-trace-insights bundles + Gardener/static evidence
-> dep-diet dependency-review-program.v1 packet + depmodel.v1
-> dep-viz render
-> DSPx-generated DSPy review program
-> review-only findings + next evidence actions + authority boundary
```

Observed result:

- dep-diet emitted schema-valid `dependency.review.program.v1` output;
- dep-viz rendered the depmodel report;
- DSPx direct generated-program run succeeded;
- DSPx `program-run --skip-oracle-index` succeeded;
- generated review output preserved non-authority boundaries.

## Evidence summary

Depmodel classification summary:

```json
{
  "packages": 281,
  "observed": 27,
  "classifications": {
    "declared-unobserved": 253,
    "static-central-unobserved": 1,
    "runtime-only": 21,
    "static-runtime-confirmed": 6
  }
}
```

DSPx generated authority boundary included:

```json
{
  "decision": "withheld_pending_source_owner_review",
  "dependencyMutationAllowed": false,
  "mutationAuthority": false,
  "removalAuthority": false,
  "replacementAuthority": false,
  "mergeAuthority": false,
  "releaseAuthority": false,
  "exploitabilityAuthority": false,
  "disclosureAuthority": false,
  "trustCertificationAuthority": false
}
```

## ts-quality interpretation

This is durable adoption proof that a cross-repo review-program evidence loop can produce explainable, bounded quality evidence for a TypeScript target repo.

It is not proof that any dependency is unused, removable, replaceable, safe, exploitable, disclosed, merge-ready, or release-ready.

The next quality-relevant step is source-owner role/scenario annotation for direct declared-unobserved packages and the `npm:@cucumber/cucumber@12.8.1` static-central-unobserved path.
