---
summary: "Concurrent Wave 2 hardening results with corrected intercom supervision for runtime-trace-insights, dep-viz, and dep-diet Gardener adapter."
read_when:
  - "Reviewing Wave 2 candidate hardening after the public ts-quality@0.5.0 boundary dogfoods."
  - "Planning merge/cherry-pick decisions for runtime-trace-insights, dep-viz, or dep-diet Gardener adapter candidates."
type: "evidence"
---

# Concurrent Wave 2 results — 2026-04-30

## Supervision protocol

Wave 2 used the corrected visible-peer launch pattern:

- `reportBack: "intercom"`
- exact `parentPeerTarget`: `session-f8fe0f11-bbac-4d31-b95c-52830da52f7f`
- controller watched `PEER_ACK` and `PEER_FINAL`
- controller verified diffs, tests, and public-package dogfood outputs before accepting peer reports as evidence

All three candidate peers emitted one ACK and one FINAL with no duplicate/violation in the intercom protocol ledger.

## Candidate worktrees

| Lane | Peer run id | Worktree | Branch | Final status |
|---|---|---|---|---|
| runtime-trace-insights | `candidatepeer-molqkz4p-480f5299` | `/home/tryinget/.local/state/pi-quests/worktrees/runtime-trace-insights-c607a9a0/runtime-trace-tsq-survivors-20260430` | `candidate/runtime-trace-tsq-survivors-20260430` | focused tests pass; public ts-quality still fails at 61/100 |
| dep-viz | `candidatepeer-molqkz54-bbf34d1e` | `/home/tryinget/.local/state/pi-quests/worktrees/dep-viz-e4e94a9b/depviz-sbom-overview-contract-20260430` | `candidate/depviz-sbom-overview-contract-20260430` | focused tests pass; public ts-quality mutation clear but CRAP policy fail at 93/100 |
| dep-diet Gardener | `candidatepeer-molqkz5e-f6547f36` | `/home/tryinget/.local/state/pi-quests/worktrees/dep-diet-2e5d5e0c/depdiet-gardener-static-adapter-20260430` | `candidate/depdiet-gardener-static-adapter-20260430` | focused tests pass; public ts-quality passes at 100/100 |

No target parent checkout was intentionally mutated by the controller. No push or merge was performed.

## Lane A: runtime-trace-insights hardening

### Candidate diff

Changed file:

- `tests/runtime_record_flow.test.mjs`

Diff size after Wave 2:

```text
1 file changed, 346 insertions(+), 2 deletions(-)
```

The candidate is test-only and adds observable assertions for:

- trace/result/manifest/guidance shape
- AppMap forced-available/forced-unavailable paths
- AppMap dependency detection without override
- command-string normalization
- env AppMap override
- existing manifest normalization/deduplication/runtimeTracePath alias handling
- validation failures
- non-zero observed command exits
- run-id sanitization and bounded manifest retention

### Controller verification

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/runtime-trace-insights-c607a9a0/runtime-trace-tsq-survivors-20260430
node --test tests/runtime_record_flow.test.mjs
npm test
git diff --check
```

Results:

```text
node --test tests/runtime_record_flow.test.mjs => 9 pass / 0 fail
npm test => runtime-record-tests: ok (3 files)
git diff --check => pass
```

### Public ts-quality@0.5.0 controller rerun

The peer could not run public ts-quality because its `npx -y ts-quality@0.5.0` invocation hit the npm minimum-release-age/version resolver. The controller reran with the required invocation pattern.

Temp root:

```text
/tmp/tsq-candidate-runtime-trace-final-nwa7nY
```

Run id:

```text
runtime-trace-flow-dogfood-050-controller-final
```

Summary:

```json
{
  "outcome": "fail",
  "mergeConfidence": 61,
  "mutation": {
    "killed": 16,
    "survived": 9,
    "errors": 0,
    "sites": 25
  },
  "coverage": {
    "files": 3,
    "changedFunctionMin": 42.86,
    "changedFunctionsUnder80": 5,
    "minFileCoverage": 56.25
  },
  "nextEvidenceAction": {
    "kind": "mutation-survivors",
    "title": "Tighten focused assertions for 9 surviving mutant(s) across 8 mutation group(s).",
    "sidecarSufficiency": "actionable"
  }
}
```

Interpretation: large improvement from the original 25/100 and Wave 1's 28/100, but still below the 65 merge-confidence gate because 9 mutants survive.

## Lane B: dep-viz report-model hardening

### Candidate diff

Changed files:

- `docs/depmodel-contract.md`
- `tests/report-model-loader.test.mjs`
- `tests/report-vulnerabilities.test.mjs`
- `web/report/src/model-loader.js`

Diff size after Wave 2:

```text
4 files changed, 251 insertions(+), 2 deletions(-)
```

The candidate preserves `module.status`, documents `sbom_failed`, and adds targeted report-model/app-shell/vulnerability-filter assertions for:

- module status validation
- script-tag bootstrap
- module route rendering
- graph and why-here selection
- navigation fallback behavior
- scoped module filter options
- severity/ecosystem/directness alias normalization
- invalid selector fallback
- copied filter arrays
- empty-state rendering
- reset defaults

### Controller verification

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/dep-viz-e4e94a9b/depviz-sbom-overview-contract-20260430
node --test tests/report-model-loader.test.mjs tests/report-vulnerabilities.test.mjs
git diff --check
```

Results:

```text
node --test tests/report-model-loader.test.mjs tests/report-vulnerabilities.test.mjs => 19 pass / 0 fail
git diff --check => pass
```

### Public ts-quality@0.5.0 peer rerun verified by controller

Temp root:

```text
/tmp/tsq-candidate-depviz-peer-kuFYy7
```

Run id:

```text
depviz-report-model-dogfood-050-candidate-peer-websrc3
```

Summary:

```json
{
  "outcome": "fail",
  "mergeConfidence": 93,
  "mutation": {
    "killed": 25,
    "survived": 0,
    "errors": 0,
    "sites": 25
  },
  "coverage": {
    "files": 12,
    "changedFunctionsUnder80": 0,
    "minFileCoverage": 10
  },
  "nextEvidenceAction": {
    "kind": "none",
    "title": "No blocking evidence action remains for this run.",
    "sidecarSufficiency": "turnkey"
  },
  "remainingReason": "CRAP hotspot function:createAppShell is 35.46 in changed code."
}
```

Interpretation: mutation/coverage evidence is strong and turnkey, but the run still fails a CRAP budget policy. This is likely acceptable only if maintainers explicitly accept the existing `createAppShell` complexity debt or split a separate refactor.

## Lane C: dep-diet Gardener static adapter hardening

### Candidate files

New/untracked candidate files:

- `docs/project/gardener-integration-spike.md`
- `fixtures/gardener/depdiet-minimal-gardener-output.json`
- `src/adapters_gardener/gardener_static_contract.mjs`
- `src/adapters_gardener/gardener_static_mapper.mjs`
- `src/adapters_gardener/index.mjs`
- `tests/gardener_static_adapter.test.mjs`

The adapter remains mapper/fixture only. It does not execute Gardener as a subprocess. Wave 2 added targeted assertions and mapper hardening for:

- invalid output shapes and diagnostic details
- missing output path and read failures
- in-memory output
- duplicate `top_dependencies` first-wins behavior
- stable digest determinism
- blank source path handling
- warning-only diagnostics
- non-finite centrality
- non-npm ecosystems
- Node builtin alias normalization
- Gardener-listed external builtins
- actionability invariants

### Controller verification

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/dep-diet-2e5d5e0c/depdiet-gardener-static-adapter-20260430
node --test tests/gardener_static_adapter.test.mjs
git diff --check
```

Results:

```text
node --test tests/gardener_static_adapter.test.mjs => 14 pass / 0 fail
git diff --check => pass
```

### Public ts-quality@0.5.0 peer rerun verified by controller

Temp root:

```text
/tmp/tsq-candidate-depdiet-gardener-static-peer-focused-final-gEvLRs
```

Run id:

```text
depdiet-gardener-static-peer-final-050-candidate
```

Summary:

```json
{
  "outcome": "pass",
  "mergeConfidence": 100,
  "mutation": {
    "killed": 25,
    "survived": 0,
    "errors": 0,
    "sites": 25
  },
  "coverage": {
    "files": 5,
    "changedFunctionsUnder80": 0,
    "minFileCoverage": 58.22
  },
  "nextEvidenceAction": {
    "kind": "none",
    "title": "No blocking evidence action remains for this run.",
    "sidecarSufficiency": "turnkey"
  }
}
```

Interpretation: this is the strongest candidate from Wave 2 and is ready for maintainer/controller review for cherry-pick or merge, with the caveat that all files are currently untracked in the candidate worktree.

## Overall recommendation

1. **Promote dep-diet Gardener adapter first** after controller code review. It has focused tests, public ts-quality pass, 100/100 confidence, 25/25 mutants killed, and clean separation of static centrality from removal authority.
2. **Promote dep-viz contract fix conditionally** if maintainers accept the remaining `createAppShell` CRAP policy failure or agree to track a separate refactor. Evidence is otherwise strong: 25/25 mutants killed and no next evidence action.
3. **Do not promote runtime-trace-insights yet** if the 65 confidence gate is strict. It improved substantially to 61/100 but still has 9 surviving mutants. It may be reasonable to keep as a candidate branch and run one more hardening pass.
4. **Do not mutate upstream Gardener yet.** Current Gardener JSON is sufficient for the dep-diet adapter; upstream machine-consumer improvements should wait until the downstream adapter contract stabilizes.
