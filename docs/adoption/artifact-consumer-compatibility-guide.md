---
summary: "Adoption-facing parser guidance for ts-quality run/report/authorization/next-evidence artifacts across legacy and additive packet shapes."
read_when:
  - "You are writing a parser, dashboard, CI gate, or agent harness that consumes ts-quality artifacts."
  - "You need compatibility habits for legacy 0.1/0.2 run packets, missing additive fields, future fields, or malformed control-plane snapshots."
type: "guide"
---

# Artifact consumer compatibility guide

This guide is for downstream parsers, dashboards, CI gates, and agent harnesses that consume generated `ts-quality` artifacts from a target repository.

Canonical public contract details live in `docs/public-contract.md`. This guide turns that contract into adoption-facing parser habits. It does not introduce a new artifact schema or make Markdown/stdout authoritative over persisted JSON.

## Consumer stance

Treat `ts-quality` artifacts as evidence packets with one source-of-truth boundary:

- `run.json` is the immutable `check`-time audit packet.
- `report.json` and `report --json` are derived report projections. They may include additive `decisionContext` metadata.
- `authorize.<agent>.<action>.json` and `bundle.<agent>.<action>.json` are run-bound legitimacy records/projections, not ambient approval.
- `next-evidence-action.json` and `run.nextEvidenceAction` are the canonical next-obligation surface for repair work.
- Markdown, text, and compact stdout are operator projections. Parse them only when the public contract says a compact protocol exists, such as `doctor --machine` or `retention --machine`.

A safe consumer is strict about authority boundaries and loose about additive fields.

## Version and shape rules

Package versions and artifact schema versions are related but independent. A package may be `0.5.x` while persisted run artifacts still declare a run-artifact `version` such as `0.2.0`.

When parsing:

1. Branch on artifact fields and artifact schema versions, not npm package version alone.
2. Accept legacy run packets that lack newer additive fields.
3. Ignore unknown optional fields unless release notes explicitly identify a breaking change.
4. Treat absent additive fields as `unknown` / `not-provided`, not as success.
5. Fail closed when the field required for the decision you are making is absent, malformed, unsupported, or not bound to the reviewed run.

In practical terms: consumers can display older packets generously, but they should not authorize, merge, waive, or claim evidence closure from missing or malformed evidence.

## Compatibility matrix

| Packet shape | Expected consumer behavior |
|---|---|
| Legacy `0.1.0`-style `run.json` without additive `0.2.x` fields | Project/read the run where possible; treat missing `coverageGeneration`, `analysisWarnings`, `mutationRemediation`, `verdict.confidenceBreakdown`, and `nextEvidenceAction` as unknown/not-provided. Do not infer success from absence. |
| `0.2.0` `run.json` with additive fields | Prefer the additive evidence fields when present, while keeping `run.json` as the source of truth for changed scope, verdict, evidence, and control-plane snapshot. |
| Current `0.2.0` packet with unknown future optional fields | Preserve/ignore unknown fields; do not reject the packet solely because extra keys exist. |
| Current packet whose `nextEvidenceAction` lacks newer optional sidecar fields | Read the available `primaryAction` / evidence fields; treat missing `sidecarSufficiency`, `taskManifest.guidance`, per-step behavior guidance, or similar later fields as not-provided. |
| Unsupported or malformed control-plane snapshot | Fail closed for governance, authorization, or run-bound legitimacy decisions; instruct the operator to rerun `check` to create a fresh valid snapshot. |
| Markdown/text-only evidence surface | Treat as human-readable projection unless it is a documented machine protocol. Prefer generated JSON fields for automation. |

## `run.json` parser habits

Use `run.json` when your consumer needs reviewed-run truth:

- run id and artifact version;
- changed scope and analysis context;
- evidence and invariant summaries;
- verdict and confidence facts;
- run-bound `controlPlane` snapshot;
- `nextEvidenceAction` when present.

Recommended guard pattern:

```text
load JSON
verify top-level object
record artifact version if present
require run id / selected-run identity for run-bound decisions
read known fields defensively
preserve or ignore unknown optional fields
convert absent additive fields to unknown/not-provided
fail closed for unsupported controlPlane when projecting governance or authorization
```

Do not hard-code `run.version === "0.1.0"`. Current compatibility proofs require projections to tolerate older packets and current packets with future additive fields.

## `report.json` and `report --json` parser habits

Use report JSON when you need a machine report projection rather than the raw check-time audit packet.

Safe habits:

- Keep a link back to the selected `run.json` / run id.
- Distinguish persisted check-time `report.json` from later `report --json` projections.
- Treat `decisionContext` as additive projection metadata, especially for projection mode and drift information.
- Do not treat report JSON as broader authority than the selected run.
- If the consumer will authorize or block a change, re-check the selected run id and relevant run-bound decision artifact instead of relying on a report view alone.

## Authorization and bundle parser habits

Authorization artifacts are legitimacy decisions for one selected run.

Safe habits:

- Require the artifact's run binding to match the reviewed run id.
- Treat `authorize.<agent>.<action>.json` and `bundle.<agent>.<action>.json` as paired records when both are available.
- Check `evidenceContext` / run metadata before interpreting an approval-like outcome.
- Reject wrong-run, stale, malformed, or unbound approval/attestation/override evidence for automation decisions.
- If the artifact reports drift or an unsupported/malformed control-plane snapshot, fail closed and ask the operator to rerun `check` and then rerun authorization.

A prior approval, waiver, attestation, override, or bundle is not ambient trust for a different run.

## `nextEvidenceAction` parser habits

`nextEvidenceAction` is the public next-step surface for evidence closure. Prefer it over scraping verdict prose.

Current healthy consumers should:

- look for `run.nextEvidenceAction` first, then the sidecar `.ts-quality/runs/<run-id>/next-evidence-action.json`;
- require a `primaryAction.kind` before opening automated follow-up work;
- handle protected kinds such as `mutation-survivors`, `mutation-baseline`, `mutation-missing`, `governance`, `coverage`, `witness`, `analysis-warning`, and `none`;
- keep follow-up work inside `targetFiles`, `suggestedEditFiles`, `evidenceTargets`, `artifactPaths`, and named commands when present;
- treat missing optional fields such as `expectedConfidenceLift`, `sidecarSufficiency`, `taskManifest.guidance`, groups, or per-step behavior guidance as not-provided;
- avoid widening changed scope or lowering thresholds just to make a failing run green.

Compatibility note: older `0.2.x` packets may contain earlier next-action summary shapes, and `0.4.0` intentionally replaced those older summary fields with the current `primaryAction` / `evidenceBasis` closure contract. If you still consume the old summary fields, keep that path legacy-only and follow the `0.4.0` migration notes before making current automation decisions.

## Missing, malformed, and unknown data policy

Use this policy in CI/agent harnesses:

| Case | Display/reporting | Merge, governance, authorization, or evidence-closure automation |
|---|---|---|
| Known field present and valid | Use it. | Use it if it is bound to the selected run. |
| Optional additive field absent | Show unknown/not-provided. | Do not count it as passing evidence. |
| Unknown future field present | Preserve/ignore. | Do not require it unless a documented migration says to. |
| Required decision field absent | Show incomplete packet. | Fail closed. |
| Malformed JSON or wrong top-level type | Show unreadable artifact. | Fail closed. |
| Unsupported/malformed control-plane snapshot | Show rerun instruction. | Fail closed and rerun `check` before projecting decisions. |
| Wrong run id or ambient latest pointer ambiguity | Show selected-vs-found mismatch. | Fail closed; rerun with explicit `--run-id`. |

## Minimal parser checklist

For every artifact consumer:

- [ ] Pass explicit `--run-id` through `check`, `report`, `explain`, `plan`, `govern`, and `authorize` automation.
- [ ] Parse JSON artifacts, not Markdown prose, for machine decisions.
- [ ] Treat `run.json` as the check-time source of truth.
- [ ] Use `report --json` only as a projected machine view.
- [ ] Require authorization artifacts to match the selected run.
- [ ] Prefer `nextEvidenceAction` over verdict prose for follow-up work.
- [ ] Tolerate legacy packets and future additive fields.
- [ ] Represent missing optional fields as unknown/not-provided.
- [ ] Fail closed on malformed JSON, unsupported control-plane snapshots, or wrong-run evidence.

## Rollback and migration habit

When a parser breaks after a `ts-quality` upgrade:

1. Check `CHANGELOG.md` and release notes for artifact, parser, fixture, machine-protocol, or agent migration notes.
2. Confirm whether the break is a documented breaking change or an additive field your parser should ignore.
3. Re-run the selected target repo with an explicit run id if the issue is a malformed/unsupported control-plane snapshot or stale projection.
4. Keep the old parser branch only for legacy artifacts; do not let old summary fields override current `primaryAction` / `evidenceBasis` semantics.
