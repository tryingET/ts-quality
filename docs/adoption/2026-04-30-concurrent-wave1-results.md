---
summary: "Concurrent Wave 1 candidate results for runtime-trace-insights, dep-viz, dep-diet Gardener adapter, and Gardener scout."
read_when:
  - "Reviewing concurrent candidate work after the public ts-quality@0.5.0 boundary dogfoods."
  - "Planning next steps for runtime-trace-insights, dep-viz, dep-diet Gardener integration, or Gardener upstream contributions."
type: "evidence"
---

# Concurrent Wave 1 results — 2026-04-30

## Supervision note

Four visible peer lanes were launched, but no `PEER_ACK` or `PEER_FINAL` intercom messages were received by the controller. The controller therefore verified the candidate worktrees and public-package dogfood outputs directly before recording this evidence.

## Candidate worktrees

| Lane | Worktree | Branch | Controller verification |
|---|---|---|---|
| runtime-trace-insights | `/home/tryinget/.local/state/pi-quests/worktrees/runtime-trace-insights-c607a9a0/runtime-trace-tsq-survivors-20260430` | `candidate/runtime-trace-tsq-survivors-20260430` | focused tests pass; ts-quality rerun still fails but improves slightly |
| dep-viz | `/home/tryinget/.local/state/pi-quests/worktrees/dep-viz-e4e94a9b/depviz-sbom-overview-contract-20260430` | `candidate/depviz-sbom-overview-contract-20260430` | focused tests pass; ts-quality rerun now reaches a run bundle but fails mutation/coverage |
| dep-diet | `/home/tryinget/.local/state/pi-quests/worktrees/dep-diet-2e5d5e0c/depdiet-gardener-static-adapter-20260430` | `candidate/depdiet-gardener-static-adapter-20260430` | focused tests pass; first Gardener adapter slice exists; ts-quality rerun fails mutation/coverage |
| Gardener scout | `/home/tryinget/ai-society/softwareco/contrib/gardener` | `main` at `origin/main` | read-only conclusion from controller inspection: dep-diet can proceed without upstream Gardener changes |

No target repo parent checkout was intentionally mutated by the controller, and no push or merge was performed.

## Lane A: runtime-trace-insights

### Candidate diff

Changed file:

- `tests/runtime_record_flow.test.mjs`

Diff size:

```text
1 file changed, 229 insertions(+), 2 deletions(-)
```

The candidate adds observable assertions for:

- runtime trace result shape
- AppMap forced-available and forced-unavailable behavior
- setup guidance content
- validation failure results
- non-zero observed command exits
- run-id sanitization and manifest retention bounds

### Focused verification

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/runtime-trace-insights-c607a9a0/runtime-trace-tsq-survivors-20260430
node --test tests/runtime_record_flow.test.mjs
```

Result:

```text
7 pass / 0 fail
```

### Public ts-quality@0.5.0 rerun

Temp root:

```text
/tmp/tsq-candidate-runtime-trace-lzURAV
```

Run id:

```text
runtime-trace-flow-dogfood-050-candidate
```

Summary:

```json
{
  "outcome": "fail",
  "mergeConfidence": 28,
  "mutation": {
    "killed": 4,
    "survived": 8,
    "errors": 0,
    "sites": 12
  },
  "coverage": {
    "files": 3,
    "changedFunctionMin": 0,
    "changedFunctionsUnder80": 13,
    "minFileCoverage": 56.25
  },
  "nextEvidenceAction": {
    "kind": "mutation-survivors",
    "title": "Tighten focused assertions for 8 surviving mutant(s) across 7 mutation group(s).",
    "expectedConfidenceLift": 51,
    "sidecarSufficiency": "actionable"
  }
}
```

Interpretation: useful incremental improvement over the earlier 25/100, 3 killed / 9 survived baseline, but not merge-ready.

## Lane B: dep-viz

### Candidate diff

Changed files:

- `docs/depmodel-contract.md`
- `tests/report-model-loader.test.mjs`
- `web/report/src/model-loader.js`

Diff size:

```text
3 files changed, 39 insertions(+), 1 deletion(-)
```

The candidate makes `module.status` an accepted module field, documents `sbom_failed`, and updates report-model tests so `sbomFailedModules: []` is an explicit stable overview primitive.

### Focused verification

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/dep-viz-e4e94a9b/depviz-sbom-overview-contract-20260430
node --test tests/report-model-loader.test.mjs tests/report-vulnerabilities.test.mjs
```

Result:

```text
13 pass / 0 fail
```

### Public ts-quality@0.5.0 rerun

Temp root:

```text
/tmp/tsq-candidate-depviz-oYYiBE
```

Run id:

```text
depviz-report-model-dogfood-050-candidate
```

Summary:

```json
{
  "outcome": "fail",
  "mergeConfidence": 11,
  "mutation": {
    "killed": 0,
    "survived": 12,
    "errors": 0,
    "sites": 12
  },
  "coverage": {
    "files": 8,
    "changedFunctionMin": 0,
    "changedFunctionsUnder80": 39,
    "minFileCoverage": 51.68
  },
  "nextEvidenceAction": {
    "kind": "mutation-survivors",
    "title": "Tighten focused assertions for 12 surviving mutant(s) across 8 mutation group(s).",
    "expectedConfidenceLift": 64,
    "sidecarSufficiency": "actionable"
  }
}
```

Interpretation: the original focused-test blocker is fixed and a real run bundle is now produced, but the evidence slice is too broad and mutation/coverage evidence is not merge-ready.

## Lane C: dep-diet Gardener static adapter

### Candidate files

New files:

- `docs/project/gardener-integration-spike.md`
- `fixtures/gardener/depdiet-minimal-gardener-output.json`
- `src/adapters_gardener/gardener_static_contract.mjs`
- `src/adapters_gardener/gardener_static_mapper.mjs`
- `src/adapters_gardener/index.mjs`
- `tests/gardener_static_adapter.test.mjs`

Approximate size:

```text
1057 total lines
```

The candidate adds a mapper-only first slice. It does not execute Gardener as a subprocess. It maps Gardener JSON into dep-diet static evidence and separates package-manager dependencies from Node builtins. It explicitly sets centrality/actionability to non-authoritative for removals.

### Focused verification

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/dep-diet-2e5d5e0c/depdiet-gardener-static-adapter-20260430
node --test tests/gardener_static_adapter.test.mjs
```

Result:

```text
3 pass / 0 fail
```

### Public ts-quality@0.5.0 rerun

Temp root:

```text
/tmp/tsq-candidate-depdiet-gardener-QNOyUy
```

Run id:

```text
depdiet-gardener-static-dogfood-050-candidate
```

Summary:

```json
{
  "outcome": "fail",
  "mergeConfidence": 31,
  "mutation": {
    "killed": 6,
    "survived": 6,
    "errors": 0,
    "sites": 12
  },
  "coverage": {
    "files": 5,
    "changedFunctionMin": 5.88,
    "changedFunctionsUnder80": 8,
    "minFileCoverage": 44.8
  },
  "nextEvidenceAction": {
    "kind": "mutation-survivors",
    "title": "Tighten focused assertions for 6 surviving mutant(s) across 5 mutation group(s).",
    "expectedConfidenceLift": 44,
    "sidecarSufficiency": "actionable"
  }
}
```

Interpretation: conceptually strong first adapter slice, focused tests pass, but it needs more assertion hardening before adoption as a quality-gated slice.

## Lane D: Gardener scout conclusion

Controller read-only scout conclusion:

- Dep-diet can proceed with a downstream adapter using current Gardener JSON.
- Upstream Gardener changes are not required for the first adapter slice.
- Potential upstream Gardener contribution candidates remain useful but non-blocking:
  1. machine-consumer summary/profile alongside full graph JSON,
  2. explicit builtin-vs-package classification in `top_dependencies`,
  3. scope filters for test/fixture/example directories,
  4. URL-resolution receipt/cache metadata,
  5. concise command/version metadata in output.

Likely code locations for future upstream work:

- `gardener/main_cli.py`
- `gardener/analysis/main.py`
- `gardener/analysis/graph.py`
- `gardener/package_metadata/url_resolver.py`
- `gardener/persistence/file.py`

## Overall recommendation

Proceed in this order:

1. Promote the dep-viz candidate after another targeted assertion pass, because it fixes the immediate blocker and clarifies a real report-model contract.
2. Continue the dep-diet Gardener adapter lane with mutation-hardening; it is the highest strategic value.
3. Continue runtime-trace-insights hardening, but expect more than one pass because the source file has broad untested branches and CRAP pressure.
4. Do not start upstream Gardener mutation yet. Let dep-diet adapter needs harden first, then upstream only the minimum machine-consumer improvements that remain clearly reusable.
