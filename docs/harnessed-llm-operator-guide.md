---
summary: "Agent-facing guide for using, changing, and evaluating ts-quality without drifting from deterministic evidence contracts."
read_when:
  - "You are an AI agent or harnessed LLM trying to use this repo productively."
  - "You need the shortest safe path from orientation to a verified ts-quality change or adoption run."
  - "You are reviewing what should be improved, changed, or removed for better agent operability."
type: "how-to"
---

# How to best utilize this repo as a harnessed LLM

Audience: AI agents, coding harnesses, review bots, and LLM operators working in or with this repository.

## Which agent guide should I read?

Use this guide when you are operating **inside the `ts-quality` repo itself**: maintaining source, reviewing architecture, choosing validation commands, or deciding what generated artifacts to update.

Use `docs/adoption/agent-integration-how-to.md` when you are wiring `ts-quality` **into another target repo**. That adoption guide is the canonical brownfield rollout recipe; this repo-operator guide should only summarize it enough to route you there.

Use `docs/adoption/greenfield-bootstrap-how-to.md` when the target repo is new enough that its quality control plane can be shaped from the beginning.

## The repo in one sentence

`ts-quality` is a deterministic TypeScript quality platform that turns explicit change evidence into inspectable trust artifacts: structural risk, mutation pressure, invariant evidence, governance checks, legitimacy/authorization, and run-bound reports.

Use it when an agent needs to answer:

- What changed?
- Which evidence supports or fails to support the change?
- Did tests actually constrain meaningful behavior?
- Did the change violate declared architectural/governance boundaries?
- Which human or agent had standing to approve, override, attest, or amend the result?

Do **not** use it to pretend natural-language intent has been semantically proven. Its strength is deterministic, repo-local, artifact-backed evidence.

## First 10 minutes: orient safely

Read in this order:

1. `README.md` — product promise, CLI surface, artifact contract.
2. `ARCHITECTURE.md` — package layers and end-to-end data flow.
3. `docs/config-reference.md` — config keys, defaults, path containment, changed-scope rules.
4. `docs/invariant-dsl.md` — invariant, lexical evidence, and execution-witness semantics.
5. `docs/ci-integration.md` — CI/operator sequence.
6. `docs/adoption/agent-integration-how-to.md` — only when your task touches target-repo adoption guidance or an external integration.
7. `VERIFICATION.md` — latest full verification recipe and generated verification log pointer.

Then inspect only the source package relevant to your task. Avoid roaming through every file just because the repo is small enough to grep.

## Mental model of the codebase

The packages are intentionally layered:

| Layer | Path | What it owns |
|---|---|---|
| Shared model | `packages/evidence-model/src/index.ts` | Canonical artifact types, path safety, digests, stable JSON, run storage, diff parsing, source discovery. |
| Structural evidence | `packages/crap4ts/src/index.ts` | LCOV parsing, AST function discovery, complexity/CRAP, changed-function marking. |
| Mutation pressure | `packages/ts-mutate/src/index.ts` | Mutation-site discovery, isolated mutant execution, runtime mirrors, cache/fingerprint behavior. |
| Intent/evidence alignment | `packages/invariants/src/index.ts` | Invariant impact, focused test selection, lexical support, execution witness matching, evidence sub-signals. |
| Verdicts/reports | `packages/policy-engine/src/index.ts` | Merge confidence, findings, explanation/report/pr-summary rendering. |
| Governance | `packages/governance/src/index.ts`, `import-collector.ts`, `import-provenance.ts` | Constitution rules, architectural boundary checks, import-flow provenance, approvals/risk/rollback checks. |
| Legitimacy | `packages/legitimacy/src/index.ts` | Agents, grants, attestations, authorization, override validation, amendments. |
| Product config | `packages/ts-quality/src/config.ts` | Data-only config loading, validation, defaults, repo-local path canonicalization. |
| Product orchestration | `packages/ts-quality/src/index.ts` | `check`, report/explain/plan/govern projections, witnesses, attestations, authorization, amendments, artifacts. |
| CLI | `packages/ts-quality/src/cli.ts` | Strict argument parser and command dispatcher over the product orchestration layer. |

If you are changing behavior, start at the narrow layer that owns the behavior and then follow call sites upward to `packages/ts-quality/src/index.ts` and `packages/ts-quality/src/cli.ts` only as needed.

## Main use modes

### 1. Evaluate this repo from source

Use this when validating a local change to `ts-quality` itself.

```bash
npm install
npm run build
npm run typecheck
npm run lint
npm test
npm run sample-artifacts
npm run smoke
```

Use `npm run verify` when you need the full repo gate, including packaging smoke and verification artifact refresh.

### 2. Prove the packaged operator path

Use this when validating what the public package will actually ship.

```bash
npm install
npm run build
npm run smoke:packaging
```

This stages and packs the package, installs it into a fresh temp project, and proves the shipped CLI/API/types surfaces. Do not replace this with only `npm test` when packaging behavior is in scope.

### 3. Exercise the included governed fixture

Use this when learning the CLI or checking end-to-end artifacts without inventing a new target repo.

```bash
npm run build
node dist/packages/ts-quality/src/cli.js check --root fixtures/governed-app --run-id fixture-review
node dist/packages/ts-quality/src/cli.js explain --root fixtures/governed-app --run-id fixture-review
node dist/packages/ts-quality/src/cli.js report --root fixtures/governed-app --run-id fixture-review
node dist/packages/ts-quality/src/cli.js govern --root fixtures/governed-app --run-id fixture-review
node dist/packages/ts-quality/src/cli.js authorize --root fixtures/governed-app --agent release-bot --run-id fixture-review
```

Prefer explicit `--run-id` in agent automation. The latest pointer is convenient for humans but too ambient for multi-run harnesses.

### 4. Route external integration work

Do not use this document as the adoption recipe. If the work is to install or roll out `ts-quality` in another repo, switch to `docs/adoption/agent-integration-how-to.md` for brownfield targets or `docs/adoption/greenfield-bootstrap-how-to.md` for new repos. Return here only when changing this repo's source, docs, examples, or release surfaces.

## Command matrix for agents

Harnesses that need command metadata without scraping help text can read `docs/cli-command-manifest.json`. It is an authored projection of `packages/ts-quality/src/cli.ts`; keep it aligned with CLI option contracts and dispatch behavior when commands change.

| Task | Start with | Escalate to |
|---|---|---|
| Validate TypeScript compile behavior | `npm run build` | `npm run typecheck` |
| Validate script typing | `npm run typecheck:scripts` | `npm run verify` |
| Validate style/static repo rules | `npm run lint` | `npm run verify` |
| Validate package logic | Targeted `node --test test/<file>.mjs` | `npm test` |
| Validate generated sample outputs | `npm run sample-artifacts` | `npm run verify:artifacts:check` |
| Validate smoke/operator path | `npm run smoke` | `npm run smoke:packaging` |
| Validate release packaging | `npm run smoke:packaging` | `npm run release:plan -- --version <x.y.z>` |
| Validate everything | smallest relevant command first | `npm run verify` |

Do not run the full gate reflexively for every small read-only review. Do run it before claiming broad correctness, packaging readiness, or release readiness.

## Artifact and source-of-truth discipline

### Authored source

Treat these as primary editable source:

- `packages/**/src/*.ts`
- `test/*.mjs`
- `scripts/*.mjs`
- `README.md`, `ARCHITECTURE.md`, and `docs/**`
- `fixtures/**` and `examples/**` when the task explicitly targets examples or golden behavior

### Generated or derived surfaces

These are useful, but do not hand-edit them casually:

- `dist/**` — compiled output. Rebuild with `npm run build` after runtime/source changes when repo policy requires committed `dist` alignment.
- `examples/artifacts/governed-app/**` — reviewed sample artifact bundle. Regenerate with `npm run sample-artifacts` after behavior/report changes.
- `VERIFICATION.md` and `verification/verification.log` — generated verification record. Refresh with `npm run verify` when verification artifacts are in scope.
- `.ts-quality/runs/**`, `.ts-quality/materialized/**`, `.ts-quality/witnesses/**`, `.ts-quality/attestations/**`, `.ts-quality/keys/**` in target repos — runtime artifacts, not source contracts, unless a fixture/example deliberately checks them in.

### Run-bound truth

For a `check` run:

- `.ts-quality/runs/<run-id>/run.json` is the immutable check-time bundle.
- `.ts-quality/runs/<run-id>/report.json` is the check-time report view with decision context.
- `report --json`, `explain`, `plan`, `govern`, and `authorize` are projections over a persisted run.
- `authorize` writes authorization decision and bundle artifacts under the selected run directory.

Always bind downstream review to the exact `--run-id` when automation may see more than one run.

## Editing workflow for harnessed LLMs

1. State the task slice in one sentence.
2. Read the owning docs and the smallest owning package.
3. Add or adjust a focused regression test before broad rewrites when practical.
4. Make the narrow code/doc change.
5. Run the smallest truthful verification first.
6. Regenerate derived artifacts only if their source contract changed.
7. Escalate to `npm run verify` only when broad repo confidence is needed.
8. Report exactly which commands passed, failed, or were skipped.

When in doubt, preserve deterministic evidence boundaries over convenience. A failing `ts-quality` result with explicit evidence is better than a fake-green result produced by widening scope or weakening config.

## Common implementation paths

### CLI behavior change

Read:

- `packages/ts-quality/src/cli.ts`
- `packages/ts-quality/src/index.ts`
- relevant tests in `test/cli-integration.test.mjs`

Verify:

```bash
npm run build
node --test test/cli-integration.test.mjs
```

Escalate if command help, packaging, or sample artifacts change.

### Config/path-safety change

Read:

- `packages/ts-quality/src/config.ts`
- `packages/evidence-model/src/index.ts`
- `docs/config-reference.md`
- `test/config-loading.test.mjs`

Verify:

```bash
npm run build
node --test test/config-loading.test.mjs test/evidence-model.test.mjs
```

### Invariant/witness semantics change

Read:

- `packages/invariants/src/index.ts`
- `packages/ts-quality/src/index.ts`
- `docs/invariant-dsl.md`
- `docs/config-reference.md`
- `test/invariants.test.mjs`
- `test/cli-integration.test.mjs`

Verify:

```bash
npm run build
node --test test/invariants.test.mjs test/cli-integration.test.mjs
npm run sample-artifacts
```

### Governance import-boundary change

Read:

- `packages/governance/src/index.ts`
- `packages/governance/src/import-collector.ts`
- `packages/governance/src/import-provenance.ts`
- `test/governance.test.mjs`

Verify:

```bash
npm run build
node --test test/governance.test.mjs
```

### Legitimacy/authorization/attestation change

Read:

- `packages/legitimacy/src/index.ts`
- `packages/ts-quality/src/index.ts`
- `docs/attestation-format.md`
- `docs/legitimacy-agent-licensing.md`
- `test/legitimacy.test.mjs`
- `test/authorization-integration.test.mjs`
- `test/amend-integration.test.mjs`

Verify:

```bash
npm run build
node --test test/legitimacy.test.mjs test/authorization-integration.test.mjs test/amend-integration.test.mjs
```

### Packaging/release change

Read:

- `scripts/pack-ts-quality.mjs`
- `scripts/packaging-smoke.mjs`
- `scripts/release-orchestrator.mjs`
- `docs/npm-publishing-checklist.md`
- `docs/releases/release-workflow.md`
- `test/packaging.test.mjs`

Verify:

```bash
npm run build
node --test test/packaging.test.mjs
npm run smoke:packaging
```

## What this repo is already good at for agents

- It has explicit layer boundaries and a readable architecture doc.
- The CLI fails closed on unknown, duplicate, missing-value, and subcommand-irrelevant options.
- Config modules are data-only, so target repos do not execute arbitrary config code just to load evidence rules.
- Path-bearing inputs are canonicalized to repo-local paths, including symlink escape handling.
- `check` requires explicit changed scope rather than silently widening to the whole repo.
- Reports preserve the distinction between lexical evidence and execution-backed support.
- Downstream decision commands can target exact persisted runs.
- Packaging smoke tests prove the staged package rather than only the source tree.
- The repo keeps deterministic sample artifacts for review and regression pressure.

## What should be improved, changed, or removed

These are review findings, not a mandate to do them all at once.

### High leverage improvements

1. **Split `packages/ts-quality/src/index.ts` into smaller runtime modules.**  
   It currently owns run construction, projections, drift checks, witness execution, attestation flows, authorization, amendments, and artifact rendering. Suggested split:
   - `run-check.ts`
   - `run-projection.ts`
   - `witness-runtime.ts`
   - `attestation-runtime.ts`
   - `authorization-runtime.ts`
   - `amend-runtime.ts`
   - `artifact-rendering.ts`

   This would reduce accidental cross-layer edits by agents and make targeted tests easier to map to source.

2. **Add richer CLI help.**  
   `packages/ts-quality/src/cli.ts` validates options strictly, which is good, but command help is terse. Add command-specific examples, generated artifact lists, preconditions, `--run-id` guidance, and `--version`. This is the top remaining agent-operability debt after the guide split because it moves guidance from prose into the executable surface.

3. **Create a stable public API boundary.**  
   If external agents will import library functions rather than only execute the CLI, document which exports are public and which are internal. Today the practical public seam is the CLI plus generated artifacts.

4. **Add narrowly scoped test helpers for large integration tests.**  
   `test/cli-integration.test.mjs` is valuable but large. Extracting reusable fixture/run helpers would make new behavior tests less likely to copy brittle setup.

### Changes worth considering

1. **Generate or lint the command manifest from CLI contracts.**  
   `docs/cli-command-manifest.json` now gives harnesses a machine-readable command surface, but it is still an authored projection. A future improvement could generate or lint it directly from `packages/ts-quality/src/cli.ts`.

2. **Promote the minimal external walkthrough into an executable fixture if adoption demand grows.**  
   `docs/adoption/minimal-external-walkthrough.md` now shows one changed file, one invariant, one witness, and one report path. It remains documentation-only so it does not add fixture maintenance until needed.

3. **Surface changed-scope mistakes earlier in docs and help.**  
   The fail-closed changed-scope contract is central. Repeat it in CLI help and adoption checklists so agents do not assume whole-repo fallback.

4. **Keep direction/project docs secondary to runtime contracts.**  
   The durable direction docs are useful for roadmap context, but harnessed LLMs should treat README, architecture, runtime docs, source, tests, and current artifacts as stronger authority for shipped behavior.

### Candidates to remove or explain

1. **Template placeholder directories.**  
   These tracked placeholders can confuse agents because source/tests actually live elsewhere:
   - `src/.gitkeep`
   - `tests/.gitkeep`
   - `policy/.gitkeep`
   - `scripts/.gitkeep`

   If they are required by the repo template contract, add a short comment in a nearby doc. Otherwise remove them.

2. **Redundant long-form README content.**  
   `README.md` is high signal but long. Consider moving some deep command/artifact detail into docs and keeping README as the product entrypoint with links. Do this only if it improves discoverability; do not split merely for tidiness.

3. **Unreviewed local harness state.**  
   Keep session/runtime directories such as `.pi-subagent-sessions/**` out of product authority unless intentionally curated. They should not become part of how downstream users understand `ts-quality`.

## Agent anti-patterns

Avoid:

- Running `check` without explicit changed scope and then treating failure as a tool bug.
- Using `.ts-quality/latest.json` in automation when exact `--run-id` is available.
- Broadening invariant test evidence to unrelated files just to make a report greener.
- Treating lexical invariant support as execution-backed proof.
- Hand-editing generated artifacts instead of regenerating them.
- Updating docs but not source/tests, or source/tests but not docs, when public behavior changed.
- Importing workflow doctrine from this workspace as product semantics unless `ts-quality` explicitly adopts it.
- Claiming release readiness without packaging smoke.

## Exit checklist for an agent session

Before you hand back:

- Identify the owning layer and files touched.
- State whether `dist/**`, sample artifacts, or verification artifacts were intentionally regenerated or intentionally left unchanged.
- State the exact verification commands run.
- If a command failed or was skipped, state why and what evidence remains missing.
- If the change affects user-facing behavior, update `README.md`, relevant `docs/**`, and `CHANGELOG.md` as appropriate.
- If the change affects deterministic artifacts, prefer regeneration over manual edits.

The goal is not to make every run green. The goal is to make every claim traceable to deterministic, inspectable evidence.
