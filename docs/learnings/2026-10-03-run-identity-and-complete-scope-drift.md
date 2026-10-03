---
summary: "Run-targeted decisions need immutable identity and complete scope binding; green regressions do not prove current witness freshness or accepted adoption."
read_when:
  - "When implementing evidence persistence, authorization drift checks, or witness schema changes"
  - "When interpreting package/pilot proof against product-readiness claims"
type: "learning"
---

# Exact-run trust requires more than a run-id string

The reality-to-vision assessment reproduced two independent false-trust paths:

- Rechecking an existing id replaced the packet but preserved old approvals. Exact string matching did not guarantee exact reviewed evidence.
- Changed paths outside source discovery had no expected digest, so downstream drift checking skipped them while authorization used current bytes.

The repair preserves separate scopes: analysis stays source-only, but decision freshness binds every declared changed path. Missing files require an explicit sentinel; missing *evidence* requires fail-closed behavior, not a skip.

## Regression principles

- Assert packet/decision/latest-pointer byte preservation and no command execution on duplicate ids.
- Test concurrent producers, not just sequential repetition.
- Exercise tests/config/excluded paths and missing-to-created transitions, not only ordinary source edits.
- Validate malformed new snapshots and under-evidenced historical packets.
- After signing, inspect projected attestation/authorization state without regenerating the check-time run.
- Execute documented CI decision assertions: command exit zero is not an approving verdict.

These principles are now in `../../test/run-trust-boundaries.test.mjs`, `../../test/ci-decision-recipe.test.mjs`, and signing/packaging regressions. The implementation decision and migration limits live in `../decisions/2026-10-03-immutable-run-identity-and-complete-scope-drift.md`.

## Remaining limit

A matching witness pass is not necessarily current-content evidence. The same assessment reproduced an old pass still selected after source regression and a fresh failure. Content-bound source/test/execution snapshots and contradictory-record handling require a separate witness migration (AK #6547). Overall merge approval was not established by that reproduction; mutation and governance remain separate layers.

Likewise, local source, installed tarball, recorded public release, scratch pilot, and accepted normal-checkout adoption are different evidence stages. Neither more pilots nor a passing root suite closes missing acceptance or public availability. Keep those distinctions visible in `../project/product-posture.md`.
