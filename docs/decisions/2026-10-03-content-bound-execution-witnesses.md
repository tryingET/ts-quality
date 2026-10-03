---
summary: "AK6547: require current content/execution bindings and deterministic failure precedence for witness support."
read_when:
  - "When changing witness schema, selection or migration behavior"
type: "decision"
---

# Content-bound execution witnesses

## Basis

AK #6547 requires a runtime-safety repair. Evidence #12828 reproduced an old passing witness remaining `supported` / `execution-backed` after source regression plus a fresh failing witness. This was a scenario-support defect, not proof of a passing overall verdict. Git implementation and AK execution evidence remain separate from this design record.

## Design

- Retain witness/receipt outer version `1`; add `binding.version: '1'` with exact declared source/test digests, ancestor package/lock/tsconfig digests including missing sentinels, command/timeout, selected environment hash, runtime and stable fingerprint.
- Recompute bindings on consumption. Legacy unbound records downgrade explicitly with rerun guidance; malformed, missing, unsafe or stale inputs cannot grant execution support.
- Passing records must cover the full impacted scope. Any current failure for the same invariant/scenario overlapping an impacted path vetoes passes, regardless of command differences. Disjoint and stale failures cannot veto. Timestamps/durations never choose winners.
- Configured scenarios additionally constrain the command, test declarations and timeout. Manual default discovery remains first-class.
- During generation, compare bytes and execution-local inode/ctime/mtime state to detect rewrite-and-restore. Do not persist that metadata or make it part of deterministic selection. Non-regular files and bound-input/output aliases are rejected; output containment is renewed after the command.
- Preserve lexical-only labels and explicit/inferred/missing provenance. Execution-backed support remains independent of mutation/coverage/governance/authorization.

## Alternatives and limits

Newest-timestamp-wins was rejected: observation time neither proves current bytes nor supplies deterministic conflict resolution. Sidecar-only bindings were rejected because adoption deliberately omits receipt sidecars; the reusable witness must carry its own binding. A schema-breaking outer-version bump was unnecessary: old records remain parseable with safely downgraded semantics.

Bindings are scoped evidence, not exhaustive dependency discovery or authentication. Undeclared dependencies, application-specific environment/external state, executable replacement and privileged filesystem tampering are not certified. An empty test list binds no undeclared test corpus. Input metadata checks are conservative on filesystems with unusual metadata behavior; focused commands should not rewrite bound inputs or create/delete context files during proof.

## Verification and migration

Regressions cover real old-pass/current-fail source regression, test/context/environment drift, malformed/legacy bindings, configured context mismatch, subset and disjoint failures, irrelevant observation metadata, rewrite-and-restore, input/output aliases, symlink retargeting and special files. Installed packaging exercises generated bindings and stale-source rejection through the packaged CLI; auto/refresh tests remain distinct.

See `docs/releases/migrations/content-bound-witnesses.md` and `docs/invariant-dsl.md`. Full verification and independent inspection results belong in AK evidence; this record alone does not establish completion, public release or accepted adoption.
