---
summary: "Read-only dogfood of owner-authorized, redacted structured and compact retention projections derived from one ts-quality owner plan."
read_when:
  - "When evaluating the experimental agent-interaction projection pattern"
  - "When checking why ts-quality retired core.AgentExperience and bare AX terminology"
type: "dogfood"
---

# Agent-interaction retention projection pilot

- AK tasks: `4655` (initial pilot), `4664` (G3 evidence and policy hardening)
- Surface: `scripts/pilots/retention-projection-pilot.mjs`
- Production fixture coordinate: `fixtures/minimal-external-adoption`
- Status: experimental, read-only, no compatibility promise

## Purpose and authority

This sidecar tests one narrow architecture claim without adding a public CLI mode: one owner-produced `ArtifactRetentionPlan` can feed an owner-authorized structured expansion and the existing compact retention protocol while preserving owner truth, recoverable omissions, monotonic redaction, and an authorized-view plan-generation coordinate.

The ts-quality plan, repository policy, and run artifacts retain their existing authority. The sidecar does not change owner runtime, rendering, retention semantics, or public `ts-quality` CLI behavior. Active product terms remain structured JSON, compact output, and command-specific machine protocols; this pilot does not accept an Agent Experience ontology concept.

## Immutable production policy

The embedded owner policy is `ts-quality.agent-interaction.retention-projection-canary` version `1`, SHA-256 `d7ec868f732e0e361c2c1b6290ec4f9e4d3b505050dc36c51cb40d8e2ef41e00`. Startup recomputes the policy digest and fails closed on drift.

It binds:

- owner surface `ts-quality.artifact-retention` and schema version `1`;
- declared policy target `pi-agent-interaction-canary`;
- exact source pointers `/surface`, `/schemaVersion`, `/rootDir`, `/config`, `/keep`, `/ignore`, and `/warnings`;
- compact omissions `/schemaVersion` and `/surface`;
- control-character, authorized-root-path, and secret-token-pattern redactions;
- config `ts-quality.config.json` and the exact canonical owner fixture coordinate `fixtures/minimal-external-adoption`.

`--policy-target` is a declaration selecting the policy target. It is **not caller authentication**. Authentication is explicitly deferred to the enclosing registered Pi tool receipt. The production command rejects arbitrary roots, alternate configs, legacy `--identity`, and caller-selected grants/redactions. Focused tests use only the exported internal injected test-policy function for temporary/adversarial fixture copies; that injection is unavailable through the production CLI.

## Production command

```bash
npm run build
node scripts/pilots/retention-projection-pilot.mjs \
  --root fixtures/minimal-external-adoption \
  --policy-target pi-agent-interaction-canary \
  > "$TMPDIR/tsq-agent-interaction-retention-pilot-4664-v4.json"
```

The root argument may be omitted because the production policy defaults to that exact canonical fixture. A different path is rejected even when it contains an identical copy.

## Evidence and checks

- **No pre-redaction digest side channel:** the raw owner plan remains internal. No digest derived from its pre-redaction values is emitted. `generation.plan_generation_digest_sha256` and the compact generation coordinate both equal SHA-256 of the authorized structured view after redaction. A focused test independently computes the raw-plan digest and proves it does not occur in serialized output.
- **Authorized expansion:** `structured_owner_plan` includes authorized `surface` and `schemaVersion`. Every compact omission is enumerated and recovered through its exact `/structured_owner_plan/...` pointer.
- **Owner redaction:** an internal adversarial fixture includes `sk_live_DO_NOT_DISCLOSE`, an absolute temporary root, and an embedded newline. Both views contain only policy-redacted values.
- **Read effects:** observation wraps initial owner-plan production and the owner machine renderer. Technically observable outside-root reads fail closed, including exposed `realpathSync` results. Stable config reads and witness enumeration each occur twice.
- **Determinism and rollback:** unchanged authorized view and policy produce byte-identical receipts; an authorized-view change changes the visible generation coordinate. Before/after fixture tree digests prove no pilot mutation.

## Observed production result

- owner policy SHA-256: `d7ec868f732e0e361c2c1b6290ec4f9e4d3b505050dc36c51cb40d8e2ef41e00`;
- authorized-view plan-generation SHA-256: `b90fcf4f79bb0b3d9992ab5daa0033e9da5cb108c976e6f784f1d56840550495`;
- compact projection SHA-256: `a9d5354650f265140d92f5997568792050180c85ec4b9912c93ef81f389b2295`;
- structured bytes: `1823`; compact bytes: `1421`; reduction: `402` (`compact_to_structured_ratio=0.7795`);
- observed reads: `43` aggregated records across `344` calls, all within the fixture boundary;
- compact omissions `/schemaVersion` and `/surface`: both recoverable from the authorized view.

The local receipt `$TMPDIR/tsq-agent-interaction-retention-pilot-4664-v4.json` had SHA-256 `aa895b4161777740f94694000922bbc41458fa14c15cae87efc642df40728d47`. It is local execution evidence, not a durable repository artifact.

## G3 classification and evidence ceiling

**Classification: `G3-read-effect-observed`.** Owner-plan production and parity rendering empirically read policy-bound fixture state.

Observation covers listed in-process synchronous `node:fs` methods during those calls. It is not OS syscall tracing, excludes module-loading reads before the boundary, and catches outside-root access only when a wrapped method exposes a path argument or `realpathSync` result. `writes_requested_by_pilot=false` is not syscall-level proof; independent tree digests provide mutation evidence. No caller authentication, write authorization, cross-owner conformance, package release, or compatibility promise follows from this pilot receipt.

## Rollback

Delete only the pilot sidecar, focused test, and this note. No owner runtime or public CLI source changed, so no owner-source restoration or data migration is required.
