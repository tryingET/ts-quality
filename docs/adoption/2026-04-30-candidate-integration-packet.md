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

After operator approval to proceed, three clean local integration branches/worktrees were created from the target repos' `main` HEADs. The candidate commits were cherry-picked there, stale repo-local `AGENTS.md` workflow text was corrected in separate commits, and the repo gates passed again from the integration branches.

The verified changes are now integrated into the parent repo `main` checkouts. No branch has been pushed externally.

## Policy clarification

Earlier notes treated `runtime-trace-insights` and `dep-viz` as "MR only" because their repo-local `AGENTS.md` files contain template-like lines saying `Never push to main; MRs only.` The operator flagged this as likely legacy/stale. The company-level SoftwareCo AGENTS policy says normal owned-repo work is main-first and GitHub PR/MR is used for releases or explicit review gates.

Current operational interpretation for this packet:

- local main integration is allowed for this normal owned-repo work;
- external pushes still require explicit operator approval;
- stale repo-local AGENTS workflow text is now corrected on local `main` through the integration commits.

## Parent checkout posture

The parent `main` checkouts for all three target repos had pre-existing unrelated dirty work, mostly ontology/ROCS/tooling/projection files. To avoid losing that work, the dirty state was preserved with a local stash in each repo, the verified integration branch was fast-forward merged into `main`, and the preserved dirty state was re-applied.

Preservation stashes intentionally remain available as backup:

- dep-diet: `stash@{0}: On main: pre-integration-preserve-dirty-state-dep-diet-20260430`
- dep-viz: `stash@{0}: On main: pre-integration-preserve-dirty-state-dep-viz-20260430`
- runtime-trace-insights: `stash@{0}: On main: pre-integration-preserve-dirty-state-runtime-trace-insights-20260430`

The dirty pre-existing files are still present in the parent checkouts after integration. No push was performed.

## Local integration branches created after operator approval

### dep-diet

- Integration worktree: `/home/tryinget/.local/state/pi-quests/worktrees/dep-diet-integration-gardener-20260430`
- Integration branch: `integration/depdiet-gardener-static-adapter-20260430`
- Candidate cherry-pick commit: `bda59b2 feat: add gardener static evidence adapter`
- Policy cleanup commit: `2ebf67c docs: align agent policy with main-first workflow`
- Validation after integration:

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/dep-diet-integration-gardener-20260430
npm ci
npm test
```

Result:

```text
ci-targeted: ok (27 files)
```

Note: `npm ci` reported existing dependency audit findings (`54 vulnerabilities`) but no audit remediation was attempted because that is outside this integration slice.

### dep-viz

- Integration worktree: `/home/tryinget/.local/state/pi-quests/worktrees/dep-viz-integration-sbom-20260430`
- Integration branch: `integration/depviz-sbom-overview-contract-20260430`
- Candidate cherry-pick commit: `c456620 feat: document sbom failed module report contract`
- Policy cleanup commit: `59fd294 docs: align agent policy with main-first workflow`
- Validation after integration:

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/dep-viz-integration-sbom-20260430
npm test
```

Result:

```text
83 pass / 0 fail
```

### runtime-trace-insights

- Integration worktree: `/home/tryinget/.local/state/pi-quests/worktrees/runtime-trace-integration-survivors-20260430`
- Integration branch: `integration/runtime-trace-tsq-survivors-20260430`
- Candidate cherry-pick commit: `4b4c19d test: harden runtime record flow evidence`
- Policy cleanup commit: `7355129 docs: align agent policy with main-first workflow`
- Validation after integration:

```bash
cd /home/tryinget/.local/state/pi-quests/worktrees/runtime-trace-integration-survivors-20260430
npm test
```

Result:

```text
runtime-record-tests: ok (3 files)
```

## Local main integration and cleanup

After review and verification, the integration branches were fast-forward merged into the parent `main` branches:

- dep-diet `main`: `2ebf67c docs: align agent policy with main-first workflow`
- dep-viz `main`: `59fd294 docs: align agent policy with main-first workflow`
- runtime-trace-insights `main`: `7355129 docs: align agent policy with main-first workflow`

The original candidate worktrees and temporary integration worktrees were removed after verification. The candidate and integration branch refs remain as local backup refs, but no extra worktree directories remain:

```text
dep-diet worktrees:
/home/tryinget/ai-society/softwareco/owned/dep-diet 2ebf67c [main]

dep-viz worktrees:
/home/tryinget/ai-society/softwareco/owned/dep-viz 59fd294 [main]

runtime-trace-insights worktrees:
/home/tryinget/ai-society/softwareco/owned/runtime-trace-insights 7355129 [main]
```

Post-main verification with the preserved dirty state re-applied:

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-diet && git diff --check && npm test
cd /home/tryinget/ai-society/softwareco/owned/dep-viz && git diff --check && npm test
cd /home/tryinget/ai-society/softwareco/owned/runtime-trace-insights && git diff --check && npm test
```

Results:

```text
dep-diet: ci-targeted: ok (27 files)
dep-viz: 83 pass / 0 fail
runtime-trace-insights: runtime-record-tests: ok (3 files)
```

Review pass:

- no conflict markers found in the three repos;
- `git diff --check` passed in all three repos;
- reviewer found no blocking issues in the integrated commits;
- known remaining caveat: broad pre-existing dirty ROCS/ontology/tooling state remains outside this integration slice.

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
