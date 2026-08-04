---
summary: "Read-only dogfood of structured and compact retention projections derived from one ts-quality owner plan."
read_when:
  - "When evaluating the experimental agent-interaction projection pattern"
  - "When checking why ts-quality retired core.AgentExperience and bare AX terminology"
type: "dogfood"
---

# Agent-interaction retention projection pilot

- AK task: `4655`
- Surface: `scripts/pilots/retention-projection-pilot.mjs`
- Fixture: `fixtures/minimal-external-adoption`
- Status: experimental, read-only, no compatibility promise

## Purpose

This pilot tests one narrow architecture claim without adding a public CLI mode: one owner-produced `ArtifactRetentionPlan` can feed both a structured projection and the existing compact retention protocol while preserving owner truth, explicit omissions, and an expansion path.

It does not test or accept an Agent Experience ontology concept. Active product guidance now uses explicit terms—structured JSON, compact output, and command-specific machine protocols—and no longer claims `core.AgentExperience` authority or bare `AX` terminology.

## Command

```bash
npm run build
node scripts/pilots/retention-projection-pilot.mjs \
  --root fixtures/minimal-external-adoption \
  --config ts-quality.config.json \
  > "$TMPDIR/tsq-agent-interaction-retention-pilot-4655.json"
```

The sidecar builds exactly one in-process `ArtifactRetentionPlan`. It emits that plan as `structured_owner_plan`, renders the compact `TSQ_RETENTION_PLAN_V1` view from the same object, independently parses the compact records back into a claim model, compares that model with source values, derives exhaustive leaf-field omissions and fallback derivations, and checks that the experimental renderer still matches the existing owner renderer while the fixture remains stable.

## Observed result

- source plan SHA-256: `40ad922baa4bf9376face56fefa85fa1529d4c5f7563b162a6abe38b0617e223`;
- fixture tree digest before and after: `b338b43c0a571f0ce27c7abbc6789b2c7b0a6f39cb7a25e62446fdd5a4e271a8`;
- structured bytes: `1894`;
- compact bytes: `1492`;
- reduction: `402` bytes (`compact_to_structured_ratio=0.7878`);
- plan entries: 9 keep, 6 ignore;
- explicit compact omissions: `/schemaVersion`, `/surface`;
- explicit fallback derivations: none for this fixture;
- expansion path: `/structured_owner_plan`;
- same-generation, parsed-subset, omission, derivation, expansion, owner-renderer-match, and read-only checks: passed.

The local receipt was written to `$TMPDIR/tsq-agent-interaction-retention-pilot-4655.json` with SHA-256 `f2b58a9594035c02606de67bdaa557f706ebf6e75ecb40bb0ea394f81070bc51`. The path is local execution evidence, not a durable repo artifact.

## Wrong-answer and rollback assessment

The compact view did not contradict the owner plan in this fixture. Its two omitted metadata fields were explicit and expandable. A consumer must still treat the retention plan as advisory: repository policy and run artifacts remain authoritative.

Rollback is removal of the sidecar, test, and this dogfood note. Existing `retention --machine` behavior and all public CLI contracts remain unchanged.

## Nonclaims

This pilot does not:

- accept a shared interaction schema or Agent Experience vocabulary;
- make passive CI/dashboard consumption agent-facing by definition;
- prove cross-owner conformance;
- authorize write/mutation pilots;
- publish a new package version or compatibility promise.
