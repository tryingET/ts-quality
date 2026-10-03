---
summary: "AK6539 reality-to-vision assessment: reproduced trust gaps, bounded repairs, evidence stages, and larger AK obligations."
read_when:
  - "When tracing the 2026-10-03 product-posture assessment, fixes, and deferred obligations"
type: "diary"
---

# Reality → vision assessment (AK #6539)

## Scope and observed starting state

Operator requested a reality/vision/horizon/product-posture assessment, bounded remediation, and AK tasks for larger gaps. Current repo only; reviewers did not inspect or mutate external target repos. Existing untracked `.ontology/` state was left untouched. No publication, live adoption, or direction-state acceptance was authorized by this work.

At entry the repo had no open tasks. `ak direction check -F json` failed with nine execution-state mismatches (OP1–3 and SF1–6). Product posture repeatedly described `0.5.0` / `0.5.x`, while manifests/changelog identify `0.6.0` and Unreleased additions. Baseline `npm run verify` passed.

## Evidence-ranked findings and dispositions

| Finding | Observed consequence | Disposition |
|---|---|---|
| Run-id reuse | Rechecking changed source/tests under an approved id replaced source digests, returned no drift and retained approval. | Fixed: pre-command atomic reservation, exclusive `run.json`, new-id retries; concurrency and byte-preservation regressions. |
| Missing changed-path snapshots | Changed JSON/config outside source inventory was bundled from live bytes with no drift and approval. | Fixed: additive independent changed-path digests, explicit absence sentinel, legacy unrecorded drift and malformed-map refusal. |
| Stale witnesses | A genuine old pass remained supported/execution-backed after source regression and a fresh failing witness. | AK #6547; content/schema/execution binding and migration required. Overall green verdict was not demonstrated. |
| CI recipe | `set -e` plus check/govern/authorize did not enforce artifact verdict/approval. | Fixed guidance: executable exact-run, projected, drift-free verdict/governance and authorization assertions; negative recipe tests. |
| Routine handoff import | `handoff:sync` invoked legacy markdown migration despite AK-native authority and retired files. | Fixed: read-only check/export; regression uses fake AK, never canonical mutation. |
| Lint false positive | The unfinished-work marker regex also rejected ordinary words such as “denying,” blocking truthful contract prose. | Fixed that marker's word boundaries with red→green regression; standalone unfinished markers remain rejected. |
| Direction health | Nine stale execution-state links plus old public-0.2.0 active wave; acceptance cannot be inferred from done tasks. | AK #6549 for owner-authorized reconciliation. Still fails; not silently archived. |
| Release boundary | Public records stop at npm 0.6.0 while current workspace-baseline and other safety fixes remain Unreleased. | AK #6548, owner-authorized follow-up release/public verification. No publication performed. |
| Accepted adoption | test-capabilities central proof records live slices but acceptance fields pending/no fresh rerun; recent Jest/Bun/TSX work is scratch. | AK #6550, target-owner accepted normal-checkout evidence. |
| Compatibility / scale | Real captures exercised via repo dist; Jest missing-source packet is drift proof; Bun scale reduced to one-source compatibility capture. | AK #6551, installed-tarball corpus and reproducible separate scale proof. |
| Oversized modules/tests | Runtime index ~3493 lines/168 KB, invariants ~1062 lines, CLI ~784 lines, CLI tests ~2492 lines/151 KB at inspection. | AK #6552, behavior-preserving modularization, not hidden inside semantic fixes. |
| Missing standardized Justfile | Root has npm owner commands but no lane-standard Justfile. | AK #6553, prescribed canonical establishment workflow. |

All follow-ups have bounded scopes and done contracts in AK. This table is the historical assessment record, not their live status.

## Product conclusion / horizons

Core scoped/structural/mutation/invariant/governance/legitimacy layers exist. The next priority is truthful trust boundaries and public availability, **before more feature breadth**. Then accepted outside-operator adoption; then broader installed compatibility, repeatable scale and maintainable seams. Updated `../docs/project/product-posture.md` separates those horizons and evidence stages without copying an AK queue.

Recorded public captures are evidence of historical npm use; registry/provenance was not freshly queried. No percentage-of-vision score or production-readiness claim is justified.

## Verification record

- Baseline root `npm run verify`: passed.
- Initial new trust-boundary tests: all nine failed against original dist; after build all nine passed, plus four golden/signing tests. Added two more regressions for interrupted/failed reservations and deletion drift.
- Intermediate full verification exposed the lint word false positive and two additional signing tests that reused run ids. Fixed the linter, changed those tests to a new follow-up run, and asserted older-run attestations do not gain standing there.
- Final `npm run verify`: passed, including all 30 test files, build/typechecks/lint, sample regeneration/idempotence, smoke and installed packaging. The package smoke retains verified post-check attestation authorization without replacing check-time evidence.
- CI decision recipe (16 cases), handoff mock and trust-boundary regressions passed; strict docs and `git diff --check` passed.
- Independent work-product inspection initially requested changes for the old signing-test reuse; that blocker was corrected before the successful root verification. Follow-up inspection approved the correction within scope and independently passed five focused boundary/signing cases. Root verification and inspection are attached to AK #6539 as evidence #12802 and #12804; direction failure is attached to AK #6549 as #12803. No witness freshness, canonical direction repair, public publication or target acceptance is claimed.

Raw scratch reproduction: `/home/tryinget/.local/state/pi-quests/tmp/ts-quality-trust-audit-thKc4P/reproduce.cjs` and `results.jsonl` (ephemeral, not a durable proof dependency). Witness failure is attached to AK #6547 as evidence #12786. Portable fixed-defect regressions are committed in `test/run-trust-boundaries.test.mjs`; durable learning is `../docs/learnings/2026-10-03-run-identity-and-complete-scope-drift.md`.
