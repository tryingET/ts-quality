---
summary: "AK6585: eight prospective task contracts match canonical readback; all held, decision180 pending, schema47 authorization unavailable."
read_when:
  - "Checking which exact native-wave tasks were authored and whether they can execute."
type: "evidence"
---

# Prospective task transcription proof — 2026-10-04

**Eight task contracts were authored; no follow-up was claimed or executed.**
Independent read-only tester `dispatch-1791139279303` compared task-plan data
against canonical installed AK reads and passed 316 comparison assertions with
no mismatches. This is task/scope/contract verification, not runtime proof,
canonical authorization acceptance or product-wave completion.

## Canonical task mapping and dependencies

| Slice | AK task | Owning repo | Depends on | Hold |
|---|---|---|---|---|
| S1 correctness/catalog | 6700 | `owned/ts-quality` | 6585 | decision180 |
| S2 bound execution | 6701 | `owned/ts-quality` | 6700 | decision180 |
| S3 navigation/lineage | 6702 | `owned/ts-quality` | 6557,6701 | decision180 |
| S4 package/CI/diagnostics | 6703 | `owned/ts-quality` | 6553,6702 | decision180 |
| S5 local receiver evidence | 6704 | `owned/test-capabilities` | 6703 | receiver-owner permission |
| S6 preservation admission only | 6705 | `infra/ts-quality-tools` | none | custody/admission permission |
| S7 settlement admission only | 6706 | `owned/ts-quality` | 6703,6704,6705 | accepted effect proof + owner permission |
| S8 removal admission checklist only | 6707 | `infra/ts-quality-tools` | 6706 | fresh standalone admission request |

At inspection all eight were pending/unclaimed, no claim/lease/completion/result/
evidence, with unresolved active deferrals606-613. S1-S4 are `until_decision`;
S5-S8 `until_event`, exact plan triggers/reasons preserved. No hold was resumed.
Existing6550 still depends on6548;6551 is done and not reopened.

Compared for each id:

- `ak task show <id> -F json`: exact repo/title/priority/state/dependencies/deferral.
- `ak task scope show <id> -F json`: exact sorted allowed/required/forbidden paths.
- `ak task contract show <id> -F json`: completion kind, every required outcome
  and check, every own guard, six common native guards for S1-S4.

Canonical extra guards reinforce the plan; none weaken it. All expected fields
matched `follow-up-contract-plan.json`. That file is a contract projection, not a
replacement for AK task readback. The graph is acyclic.

## Membranes exercised during authoring

Two explicit authoring refusals were respected:

1. Setting receiver6704's done contract from the native parent refused the
   owning-repo membrane. The existing task was immediately held, then its same
   contract/guardrail writes were completed from the receiver root after its
   applicable instructions were read. It was not duplicated or claimed.
2. Linking receiver6704 to native repo-scoped decision180 refused. No broader
   decision or scope override was created to bypass it. Native direct links are
   exactly6585,6700-6703,6706; foreign-owner6704/6705/6707 instead have explicit
   event holds/upstream dependencies and require their own admission authority.

No receiver or legacy source was edited by task authoring. Legacy HEAD remains
`c5c726e61f0783c473650dbfd25a59bced7d9c7f`; its original modified AGENTS/handoff
and three deleted wrappers remain. Native `.ontology/` was preserved.

## Unresolved canonical authorization

AK decision180 readbacks remain `decision_pending`, outcome null, native repo
scope. Authorization records report live schema46, `records_available:false`,
`authorizations:[]`. Owner selections in the questionnaire are evidence input,
not a recorded grant. The attempted typed grant refused:

```text
AK_DECISION_RECORDS_NEED_SCHEMA_47
```

No accepted-outcome fallback was attempted, no ADR was canonically recorded and
no DB migration occurred. Existing AK6367 owns the operator-run amended-schema47
apply, with AK6471/owner-word/pin prerequisites. Do not reopen completed5991 or
invent a duplicate migration task. AK6585 is not fully adjudicated/closed.

## Admission-only proof limits

S6/S8 scopes allow one exact admission document each; S7 allows its settlement
ledger and retirement RFC documents. Canonical guards prohibit archive writes,
freeze effects, secrets copying, GC, retirement, quarantine/deletion, remote or
AK lifecycle changes. Completion of planning/checklists cannot satisfy those
later effects; each needs new exact owner permission and effect proof.

Sequential readbacks are not an atomic DB snapshot or exhaustive execution-history
audit. Foreign-link rejection and hold-release enforcement were not exercised by
the tester. Legacy checks do not prove every ignored/unreferenced object preserved
or any archive/restore integrity. No tests/product commands/builds/installs/network/
source/Git/AK mutations occurred in the tester.

Parent docs checks passed: `npm run lint`, canonical docs-list strict, JSON parse
and plan cardinality checks, `git diff --check`. No root runtime verification or
product check is claimed by these docs/contract checks. The earlier pinned parity
probe still reports16 differences/3 bounded equivalents, not supersession proof.
