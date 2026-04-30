---
summary: "Concurrent Wave 2 hardening results: dep-diet Gardener adapter, dep-viz SBOM overview contract, and runtime-trace-insights runtime-record flow all reach public ts-quality@0.5.0 pass."
read_when:
  - "Reviewing final candidate branch evidence for the 2026-04-30 cross-repo boundary work."
  - "Planning merge/MR steps for dep-diet, dep-viz, or runtime-trace-insights candidate branches."
type: "evidence"
---

# Concurrent Wave 2 results — 2026-04-30

## Summary

Wave 2 continued the existing candidate worktrees from Wave 1. The work was **not merged into target repo `main`** and was **not pushed**. After hardening, all three candidate lanes reached passing focused tests and passing public `ts-quality@0.5.0` dogfood runs from temp copies.

Each candidate branch was committed locally to preserve the work:

| Repo | Candidate branch | Commit | Status |
|---|---|---:|---|
| dep-diet | `candidate/depdiet-gardener-static-adapter-20260430` | `9a83032` | local branch commit only; no push/merge |
| dep-viz | `candidate/depviz-sbom-overview-contract-20260430` | `8d5a6d2` | local branch commit only; no push/merge |
| runtime-trace-insights | `candidate/runtime-trace-tsq-survivors-20260430` | `bafbb3a` | local branch commit only; no push/merge |

## Worktree posture

| Repo | Worktree |
|---|---|
| dep-diet | `/home/tryinget/.local/state/pi-quests/worktrees/dep-diet-2e5d5e0c/depdiet-gardener-static-adapter-20260430` |
| dep-viz | `/home/tryinget/.local/state/pi-quests/worktrees/dep-viz-e4e94a9b/depviz-sbom-overview-contract-20260430` |
| runtime-trace-insights | `/home/tryinget/.local/state/pi-quests/worktrees/runtime-trace-insights-c607a9a0/runtime-trace-tsq-survivors-20260430` |

All three candidate worktrees were clean after their local commits.

## Lane 1: dep-diet Gardener static-evidence adapter

### Candidate commit

```text
9a83032 feat: add gardener static evidence adapter
```

Files:

- `docs/project/gardener-integration-spike.md`
- `fixtures/gardener/depdiet-minimal-gardener-output.json`
- `src/adapters_gardener/gardener_static_contract.mjs`
- `src/adapters_gardener/gardener_static_mapper.mjs`
- `src/adapters_gardener/index.mjs`
- `tests/gardener_static_adapter.test.mjs`

### Focused test

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/dep-diet-2e5d5e0c/depdiet-gardener-static-adapter-20260430
node --test tests/gardener_static_adapter.test.mjs
```

Result:

```text
14 pass / 0 fail
```

### Public ts-quality@0.5.0 dogfood

Temp root:

```text
/tmp/tsq-wave2-depdiet-gardener-TkyfB9
```

Run id:

```text
depdiet-gardener-static-dogfood-050-candidate-wave2
```

Result:

```json
{
  "outcome": "pass",
  "mergeConfidence": 90,
  "mutation": {
    "killed": 12,
    "survived": 0,
    "errors": 0,
    "sites": 12
  },
  "coverage": {
    "files": 5,
    "changedFunctionMin": 57.14,
    "changedFunctionsUnder80": 1,
    "minFileCoverage": 58.22
  },
  "nextEvidenceAction": "none",
  "sidecarSufficiency": "turnkey"
}
```

### Interpretation

The dep-diet Gardener adapter is now the strongest candidate. It proves the intended source-owner boundary:

```text
Gardener static centrality -> dep-diet static evidence
not -> removal authority
```

It also separates Node builtins from package-manager dependencies and keeps subprocess execution out of the first slice.

## Lane 2: dep-viz SBOM failed module report contract

### Candidate commit

```text
8d5a6d2 feat: document sbom failed module report contract
```

Files:

- `docs/depmodel-contract.md`
- `tests/report-model-loader.test.mjs`
- `tests/report-vulnerabilities.test.mjs`
- `web/report/src/model-loader.js`

### Focused test

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/dep-viz-e4e94a9b/depviz-sbom-overview-contract-20260430
node --test tests/report-model-loader.test.mjs tests/report-vulnerabilities.test.mjs
```

Result:

```text
25 pass / 0 fail
```

### Public ts-quality@0.5.0 dogfood

The first Wave 2 dep-viz dogfood used the originally suggested broad changed scope including `web/report/src/app-shell.js`; it cleared mutation but failed on pre-existing `createAppShell` CRAP pressure. Since the candidate source diff only changed `web/report/src/model-loader.js` plus tests/docs, the final dogfood used the truthful source changed scope `web/report/src/model-loader.js`.

Temp root:

```text
/tmp/tsq-wave2c-depviz-2q1QkL
```

Run id:

```text
depviz-report-model-dogfood-050-candidate-wave2c
```

Result:

```json
{
  "outcome": "pass",
  "mergeConfidence": 90,
  "mutation": {
    "killed": 12,
    "survived": 0,
    "errors": 0,
    "sites": 12
  },
  "coverage": {
    "files": 8,
    "changedFunctionMin": 0,
    "changedFunctionsUnder80": 9
  },
  "nextEvidenceAction": "none",
  "sidecarSufficiency": "turnkey"
}
```

### Interpretation

The original dep-viz blocker is resolved. `sbomFailedModules` is now treated as an explicit stable overview primitive, module `status: "sbom_failed"` is documented as optional depmodel module metadata, and focused tests now cover malformed inputs plus report navigation/filter behavior.

## Lane 3: runtime-trace-insights runtime-record flow hardening

### Candidate commit

```text
bafbb3a test: harden runtime record flow evidence
```

Files:

- `tests/runtime_record_flow.test.mjs`

### Focused test

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/runtime-trace-insights-c607a9a0/runtime-trace-tsq-survivors-20260430
node --test tests/runtime_record_flow.test.mjs
```

Result:

```text
12 pass / 0 fail
```

### Public ts-quality@0.5.0 dogfood

Temp root:

```text
/tmp/tsq-wave2b-runtime-trace-G2IlBs
```

Run id:

```text
runtime-trace-flow-dogfood-050-candidate-wave2b
```

Result:

```json
{
  "outcome": "pass",
  "mergeConfidence": 90,
  "mutation": {
    "killed": 12,
    "survived": 0,
    "errors": 0,
    "sites": 12
  },
  "coverage": {
    "files": 3,
    "changedFunctionMin": 42.86,
    "changedFunctionsUnder80": 4
  },
  "nextEvidenceAction": "none",
  "sidecarSufficiency": "turnkey"
}
```

### Interpretation

The runtime-record flow slice now passes the same public-package dogfood shape that initially failed at 25/100. The candidate remains test-only and improves evidence around AppMap detection/override, validation failures, command normalization, artifact directory fallback, non-zero command exits, and manifest retention.

## Retention observations

All three final temp-copy runs emitted `TSQ_RETENTION_PLAN_V1` and kept the expected split:

Reusable if adopted:

- `ts-quality.config.json`
- `.ts-quality/invariants.ts`
- `.ts-quality/constitution.ts`
- `.ts-quality/agents.ts`
- approvals/waivers/overrides JSON
- witness JSON

Ephemeral/not for normal commit:

- `.ts-quality/runs/`
- `.ts-quality/latest.json`
- `.ts-quality/mutation-manifest.json`
- `coverage/lcov.info`
- witness receipt sidecars
- private keys

No generated ts-quality artifacts were committed to target candidate branches.

## Recommended merge/MR posture

- Do not push directly to `runtime-trace-insights` or `dep-viz` `main`; their repo instructions require MRs only.
- The local candidate branches are ready for human review / MR preparation:
  - `candidate/depdiet-gardener-static-adapter-20260430`
  - `candidate/depviz-sbom-overview-contract-20260430`
  - `candidate/runtime-trace-tsq-survivors-20260430`
- If local main integration is desired for `dep-diet`, review parent repo dirtiness first; the candidate branch itself is clean and evidence-backed.
- For runtime-trace-insights and dep-viz, prefer opening MRs from the candidate branches rather than merging locally into `main`.
