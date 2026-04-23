---
summary: "Cross-repo overview of repo-local ts-quality screening rollout status."
read_when:
  - "You need a central view of repo-local ts-quality screening adoption."
  - "You want to compare current live slices vs next-target slices across repos."
type: "reference"
---

# Repo screening catalog

_Generated from `docs/adoption/repo-screening-catalog.json` via `node scripts/register-screening-catalog.mjs --check`._

This is a downstream cross-repo overview.
Repo-local truth still lives in each registered repo's own current-vs-target file.

Template for new registrations:
- `docs/adoption/repo-screening-entry.template.json`

Registration command:

```bash
node scripts/register-screening-catalog.mjs --entry docs/adoption/entries/<repo>.json
```

## softwareco/owned/test-capabilities

- repo path: `/home/tryinget/ai-society/softwareco/owned/test-capabilities`
- source of truth: `docs/dev/ts-quality-current-vs-target.md`
- adoption stage: `five-live-slices`
- live slices: 5
- ready-next slices: 0

### Current live slices

- `healing.collect-files.boundary`
  - screened paths: `src/healing/collect-files-core.ts`
  - facade/runtime aliases: `dist/healing/collect-files.js`, `src/healing/collect-files.ts`
  - witness tests: `tests/collect_files_contract.test.mjs`
  - status: `supported`
  - notes: Facade and runtime aliases normalize onto the behavior-bearing collect-files implementation file so mutation pressure lands on real logic instead of a re-export barrel.
- `operation.command-runner.error-surface`
  - screened paths: `src/core/operations/command-runner-core.ts`
  - facade/runtime aliases: `dist/core/operations/command-runner.js`, `src/core/operations/command-runner.ts`
  - witness tests: `tests/command_runner_contract.test.mjs`
  - status: `supported`
  - notes: Facade and runtime aliases normalize onto the behavior-bearing command-runner implementation file so mutation pressure lands on real logic instead of a re-export barrel.
- `operation.kernel.fail-closed`
  - screened paths: `src/core/operations/dispatch-execution.ts`
  - facade/runtime aliases: `dist/core/operations.js`, `src/core/operations.ts`
  - witness tests: `tests/operation_kernel_contract.test.mjs`
  - status: `supported`
  - notes: Facade and runtime aliases normalize onto the behavior-bearing dispatch implementation file so mutation pressure lands on real logic instead of a re-export barrel.
- `operation.quantum.input-envelope.contract`
  - screened paths: `src/core/operations/quantum-operation.ts`
  - witness tests: `tests/quantum_operation_contract.test.mjs`
  - status: `supported`
  - notes: The slice screens the behavior-bearing quantum operation implementation directly and keeps witness pressure on input validation plus result-envelope shaping rather than the broader simulator layer.
- `operation.test.config-override.contract`
  - screened paths: `src/core/operations/config-load-core.ts`, `src/core/operations/config-quick-mode-core.ts`, `src/core/operations/config-targets-core.ts`
  - facade/runtime aliases: `dist/core/operations/config-overrides.js`, `src/core/operations/config-overrides.ts`
  - witness tests: `tests/config_overrides_contract.test.mjs`
  - status: `supported`
  - notes: The facade alias normalizes onto a three-file implementation cluster because the override contract is split across load, target routing, and quick-mode shaping.

### Ready-next slices

- none registered yet

### Candidate later slices

- config schema fail-closed
  - candidate paths: `src/core/operations/config-load-core.ts`
  - witness tests: `tests/config_contract.test.mjs`
  - why later: Overlaps with the now-live config-override cluster until responsibilities are split more sharply.
- heal operation
  - candidate paths: `src/core/operations/heal-operation.ts`
  - witness tests: `tests/healing_contract.test.mjs`
  - why later: Useful, but broader than the first rollout slices.
- orchestrator fail-closed
  - candidate paths: `src/core/orchestrator.ts`
  - witness tests: `tests/orchestrator_fail_closed_contract.test.mjs`
  - why later: Valuable, but broader and noisier than the current operation-kernel rollout pattern.
- surf explore operation
  - candidate paths: `src/core/operations/surf-explore-operation.ts`
  - witness tests: `tests/operation_kernel_contract.test.mjs`, `tests/surf_client_contract.test.mjs`
  - why later: Intentionally paused while the surf implementation/runtime choice may still change; do not start this slice until the runtime boundary stabilizes and the witness can stay focused.

### Target state

- Cover selected bounded helper boundaries under src/healing/**.
- Cover the highest-risk behavior-bearing paths under src/core/operations/** rather than facade barrels.
- Keep witness commands focused and deterministic rather than repo-global.
- Widen the net one reviewable slice at a time instead of flipping the whole repo at once.

