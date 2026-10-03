---
summary: "Implementation decision: immutable run identity and complete changed-path drift binding, with explicit alpha migration."
read_when:
  - "When changing run persistence, downstream authorization freshness, or historical artifact compatibility"
type: "decision"
---

# Immutable run identity and complete changed-scope drift

Date: 2026-10-03. Implementation scope: AK #6539, under the operator's reality-to-vision assessment and bounded defect-remediation request. This records the native code change, not a publication or external acceptance decision.

## Problem

An exact run-id string was not immutable: `check` could overwrite its evidence while retaining run-targeted approvals and authorization artifacts. A reviewer of the old packet could thereby appear to approve replacement evidence.

Separately, drift checking skipped declared changed paths absent from `files`, the source-analysis inventory. Explicitly changed tests, configuration, excluded files and missing paths could evade freshness checks while authorization bundled current bytes.

## Decision

1. Reserve an unused safe run id atomically before check commands execute. Refuse any occupied/reserved id. Retain reservations after failure/interruption: retry with a new id, never remove historical identity merely to make a retry work.
2. Persist `run.json` with exclusive creation, preventing storage callers from replacing an existing packet. Keep downstream post-check approval/attestation projection separate from check-time evidence.
3. Add `changedFileDigests` independently of `files`. Snapshot every declared changed path with a content digest or `sha256:missing`. A missing-to-created transition is drift, as is modification/deletion.
4. Validate present digest maps strictly. Legacy packets retain their existing source-file digests, but a changed path with no recorded digest produces `sha256:unrecorded` drift and cannot silently authorize.

Scope analysis stays narrow; this does not widen source discovery, coverage or mutation to non-source paths. It only binds the declared decision scope.

## Compatibility and migration

This is an intentional alpha breaking safety correction, recorded under **Unreleased** in `../../CHANGELOG.md`. Existing readers can ignore the additive map, but old readers do not enforce its complete-scope safety. Regenerate under-evidenced historical runs with new ids. Bind fresh approvals/attestations to the new packet rather than copying old decisions.

CI retry ids should include the job/run attempt; downstream commands keep the same id for that packet. After signing a run, use `report`/`authorize` projections to consume new evidence—do not recheck the same id. Packaging/signing tests previously depended on overwrite and now exercise projection instead.

Reservations are tool-state files in `.ts-quality/runs/`; do not adopt or commit them as reusable control-plane inputs. A failed reservation carries no successful run packet and does not update the latest pointer.

## Alternatives and limits

Binding every approval to a packet digest would be useful additional defense, but changes multiple approval/waiver/override contracts. Immutable producer identity repairs the present bypass without importing new authority semantics.

Exclusive creation prevents replacement, not crash-safe all-artifact transactionality or authenticity against a user manually editing local files. Full transactional packet publication is separate work if required; no such guarantee is claimed here.

Witness freshness is a distinct schema/consumer issue (AK #6547), not solved by run identity or source scope. A passing historical witness can still be stale.

## Verification

`test/run-trust-boundaries.test.mjs` covers approval-transfer denial, no-command duplicate refusal, concurrent producers, storage overwrite refusal, changed non-source/test paths, missing-to-created transitions, legacy unrecorded drift and malformed maps. CI decision snippets are executed by `test/ci-decision-recipe.test.mjs`. The root verification/installed-packaging contract remains `npm run verify`.

## Rollback

Reverting this implementation restores the known approval-transfer and skipped-digest gaps. It is not a safe downgrade for decisions depending on the new protections. Do not delete historical packets/reservations or reinterpret old approvals to enable reuse. Publication/versioning and downstream migration require the normal release owner path.
