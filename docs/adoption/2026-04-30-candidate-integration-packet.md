---
summary: "Integration packet for the three evidence-backed candidate branches from the 2026-04-30 cross-repo boundary/Gardener wave."
read_when:
  - "Deciding whether to integrate dep-diet, dep-viz, or runtime-trace-insights candidate branches."
  - "Preparing local main integration or external branch push after the public ts-quality@0.5.0 dogfoods."
type: "handoff"
---

# Candidate integration packet — 2026-04-30

## Executive summary

Three local candidate branches are ready for review. Each candidate branch is clean, locally committed, focused-test verified, repo-gate checked, and public `ts-quality@0.5.0` dogfooded from a temp copy with 90/100 merge confidence.

No candidate has been merged into the parent repo `main` checkout, and no candidate branch has been pushed externally.

## Policy clarification

Earlier notes treated `runtime-trace-insights` and `dep-viz` as "MR only" because their repo-local `AGENTS.md` files contain template-like lines saying `Never push to main; MRs only.` The operator flagged this as likely legacy/stale. The company-level SoftwareCo AGENTS policy says normal owned-repo work is main-first and GitHub PR/MR is used for releases or explicit review gates.

Current operational interpretation for this packet:

- local main integration is allowed after review when the parent checkout is safe;
- external pushes still require explicit operator approval;
- the stale repo-local AGENTS lines should be cleaned up in a separate small follow-up because they created process confusion.

## Parent checkout posture

The parent `main` checkouts for all three target repos are currently dirty with pre-existing unrelated work, mostly ontology/ROCS/tooling/projection files. Therefore this packet does **not** recommend blind cherry-pick into those parent checkouts.

Safe next integration options:

1. keep the candidate branches as review branches until parent checkouts are cleaned/rebaselined;
2. create clean integration worktrees/branches from each repo's intended base and cherry-pick the candidate commits there;
3. after explicit approval, push candidate branches for external review;
4. only merge into local `main` once unrelated parent dirtiness is resolved or intentionally carried.

## Candidate 1: dep-diet Gardener static-evidence adapter

### Branch and commit

- Repo: `/home/tryinget/ai-society/softwareco/owned/dep-diet`
- Worktree: `/home/tryinget/.local/state/pi-quests/worktrees/dep-diet-2e5d5e0c/depdiet-gardener-static-adapter-20260430`
- Branch: `candidate/depdiet-gardener-static-adapter-20260430`
- Commit: `9a83032 feat: add gardener static evidence adapter`

### Purpose

Add the first mapper-only Gardener adapter slice for dep-diet:

```text
Gardener JSON
  -> dep-diet staticGraphEvidence
  -> dependencyImportance
  -> no removal authority by itself
```

This keeps Gardener as the static dependency-importance provider and dep-diet as the actionability owner.

### Files changed

- `docs/project/gardener-integration-spike.md`
- `fixtures/gardener/depdiet-minimal-gardener-output.json`
- `src/adapters_gardener/gardener_static_contract.mjs`
- `src/adapters_gardener/gardener_static_mapper.mjs`
- `src/adapters_gardener/index.mjs`
- `tests/gardener_static_adapter.test.mjs`

### Evidence

Focused test:

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/dep-diet-2e5d5e0c/depdiet-gardener-static-adapter-20260430
node --test tests/gardener_static_adapter.test.mjs
```

Result:

```text
14 pass / 0 fail
```

Repo broader gate:

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/dep-diet-2e5d5e0c/depdiet-gardener-static-adapter-20260430
npm ci
npm test
```

Result:

```text
ci-targeted: ok (27 files)
```

Note: the first `npm test` attempt failed because this isolated worktree had no `node_modules` and the repo CLI tests could not import `zod`. After `npm ci`, the repo gate passed. `node_modules` is ignored and the candidate worktree remains git-clean.

Public `ts-quality@0.5.0` dogfood:

- Temp root: `/tmp/tsq-wave2-depdiet-gardener-TkyfB9`
- Run id: `depdiet-gardener-static-dogfood-050-candidate-wave2`

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

### Merge risk

Low-to-medium. The slice is new and isolated, but it adds a new adapter surface and a fixture. Main risk is naming/schema shape hardening as dep-diet starts consuming this evidence in a production path.

### Recommended decision

Integrate first once parent checkout dirtiness is resolved. This is the highest strategic value candidate.

## Candidate 2: dep-viz SBOM failed module report contract

### Branch and commit

- Repo: `/home/tryinget/ai-society/softwareco/owned/dep-viz`
- Worktree: `/home/tryinget/.local/state/pi-quests/worktrees/dep-viz-e4e94a9b/depviz-sbom-overview-contract-20260430`
- Branch: `candidate/depviz-sbom-overview-contract-20260430`
- Commit: `8d5a6d2 feat: document sbom failed module report contract`

### Purpose

Make `sbomFailedModules` an explicit stable overview primitive and document module `status: "sbom_failed"` as optional depmodel module metadata.

### Files changed

- `docs/depmodel-contract.md`
- `tests/report-model-loader.test.mjs`
- `tests/report-vulnerabilities.test.mjs`
- `web/report/src/model-loader.js`

### Evidence

Focused test:

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/dep-viz-e4e94a9b/depviz-sbom-overview-contract-20260430
node --test tests/report-model-loader.test.mjs tests/report-vulnerabilities.test.mjs
```

Result:

```text
25 pass / 0 fail
```

Repo broader gate:

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/dep-viz-e4e94a9b/depviz-sbom-overview-contract-20260430
npm test
```

Result:

```text
83 pass / 0 fail
```

Public `ts-quality@0.5.0` dogfood:

- Temp root: `/tmp/tsq-wave2c-depviz-2q1QkL`
- Run id: `depviz-report-model-dogfood-050-candidate-wave2c`

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

### Merge risk

Low. The source change is narrow (`module.status` preservation in the model loader) and the rest is tests/docs. The initial dogfood blocker is resolved.

### Recommended decision

Integrate after dep-diet or in parallel once parent checkout dirtiness is resolved.

## Candidate 3: runtime-trace-insights runtime-record flow evidence hardening

### Branch and commit

- Repo: `/home/tryinget/ai-society/softwareco/owned/runtime-trace-insights`
- Worktree: `/home/tryinget/.local/state/pi-quests/worktrees/runtime-trace-insights-c607a9a0/runtime-trace-tsq-survivors-20260430`
- Branch: `candidate/runtime-trace-tsq-survivors-20260430`
- Commit: `bafbb3a test: harden runtime record flow evidence`

### Purpose

Harden the runtime-record flow tests to prove runtime artifacts, AppMap setup guidance, AppMap detection/override, validation failures, command normalization, artifact directory fallback, non-zero command exits, and manifest retention.

### Files changed

- `tests/runtime_record_flow.test.mjs`

### Evidence

Focused test:

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/runtime-trace-insights-c607a9a0/runtime-trace-tsq-survivors-20260430
node --test tests/runtime_record_flow.test.mjs
```

Result:

```text
12 pass / 0 fail
```

Repo broader gate:

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/runtime-trace-insights-c607a9a0/runtime-trace-tsq-survivors-20260430
npm test
```

Result:

```text
runtime-record-tests: ok (3 files)
```

Public `ts-quality@0.5.0` dogfood:

- Temp root: `/tmp/tsq-wave2b-runtime-trace-G2IlBs`
- Run id: `runtime-trace-flow-dogfood-050-candidate-wave2b`

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

### Merge risk

Low-to-medium. It is test-only but adds a large focused test expansion. Review for maintainability and over-specific assertions before merge.

### Recommended decision

Integrate after review once parent checkout dirtiness is resolved.

## Integration sequence recommendation

1. Resolve or isolate the pre-existing dirty parent checkouts.
2. Integrate `dep-diet` candidate first because it unlocks the Gardener static-evidence lane.
3. Integrate `dep-viz` candidate next to stabilize report consumption of additive module status/SBOM warning fields.
4. Integrate `runtime-trace-insights` candidate to harden runtime evidence proof.
5. Follow up with stale AGENTS cleanup in `runtime-trace-insights`, `dep-viz`, and `dep-diet` so repo-local instructions align with SoftwareCo main-first policy and current repo identity.

## Commands for safe local integration after parent checkout cleanup

From each clean parent repo checkout, use either merge or cherry-pick:

```bash
# dep-diet
cd /home/tryinget/ai-society/softwareco/owned/dep-diet
git cherry-pick 9a83032

# dep-viz
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
git cherry-pick 8d5a6d2

# runtime-trace-insights
cd /home/tryinget/ai-society/softwareco/owned/runtime-trace-insights
git cherry-pick bafbb3a
```

Do not run these while the parent checkouts contain unrelated uncommitted changes unless those changes are intentionally part of the same integration context.
