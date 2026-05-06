---
summary: "Accepted repo-local ts-quality adoption proof for softwareco/owned/test-capabilities."
read_when:
  - "You need the evidence behind the test-capabilities entry in the ts-quality repo screening catalog."
  - "You are deciding whether a target repo proof is accepted repo-local adoption or only temp-copy/candidate evidence."
type: "evidence"
---

# test-capabilities accepted repo-local adoption proof

## Status

- targetRepo: `softwareco/owned/test-capabilities`
- targetPath: `/home/tryinget/ai-society/softwareco/owned/test-capabilities`
- adoptionStatus: `accepted-repo-local`
- acceptedAt: recorded in repo-local live rollout state as of 2026-05-06
- sourceOfTruth: `/home/tryinget/ai-society/softwareco/owned/test-capabilities/docs/dev/ts-quality-current-vs-target.md`
- centralCatalogEntry: `docs/adoption/entries/test-capabilities.json`
- centralCatalogStatus: registered and regenerated into `docs/adoption/repo-screening-catalog.json` / `.md`

This proof records existing accepted repo-local state. It is not a temp-copy pilot and not a candidate worktree claim: the target repo already contains repo-local `ts-quality` setup and a current-vs-target rollout note.

## Evidence inspected

The target repo-local source-of-truth declares five current live slices:

| Slice | Screened path(s) | Witness test | Status |
|---|---|---|---|
| `operation.kernel.fail-closed` | `src/core/operations/dispatch-execution.ts` | `tests/operation_kernel_contract.test.mjs` | live / supported |
| `operation.command-runner.error-surface` | `src/core/operations/command-runner-core.ts` | `tests/command_runner_contract.test.mjs` | live / supported |
| `healing.collect-files.boundary` | `src/healing/collect-files-core.ts` | `tests/collect_files_contract.test.mjs` | live / supported |
| `operation.quantum.input-envelope.contract` | `src/core/operations/quantum-operation.ts` | `tests/quantum_operation_contract.test.mjs` | live / supported |
| `operation.test.config-override.contract` | `src/core/operations/config-targets-core.ts`, `src/core/operations/config-quick-mode-core.ts`, `src/core/operations/config-load-core.ts` | `tests/config_overrides_contract.test.mjs` | live / supported |

Repo-local reusable setup observed in the target repo includes:

- `ts-quality.config.json`
- `.ts-quality/invariants.ts`
- `.ts-quality/constitution.ts`
- `.ts-quality/agents.ts`
- `.ts-quality/approvals.json`
- `.ts-quality/waivers.json`
- `.ts-quality/overrides.json`
- `.ts-quality/witnesses/README.md`
- `scripts/screening/ts-quality-common.sh`
- `scripts/screening/ts-quality-witness-refresh.sh`
- `scripts/screening/ts-quality-check.sh`

Existing target run artifacts were also present under `.ts-quality/runs/` for recent screening runs such as `tc-config-overrides-screen` and `tc-quantum-operation-screen`. Generated artifacts remain target-repo local and are not copied into this central catalog.

## Boundary note

The target repo worktree had unrelated dirty changes when this central catalog proof was recorded. Therefore this task did not mutate or rerun the target repo. The accepted-adoption claim rests on the target repo's existing live rollout source-of-truth plus central catalog synchronization, not on a fresh temp-copy proof.

## Central catalog validation

From the `ts-quality` repo root:

```bash
node scripts/register-screening-catalog.mjs --entry docs/adoption/entries/test-capabilities.json
node scripts/register-screening-catalog.mjs --check
```

Observed validation:

```text
repo screening catalog: ok
```

## Rollback / pause

Rollback authority remains in the target repo. To pause adoption there, update the target repo's `docs/dev/ts-quality-current-vs-target.md`, remove or ignore repo-local screening wrappers/config as the owner process allows, and then rerun the central catalog registration from this repo so the downstream overview reflects the target repo truth.
