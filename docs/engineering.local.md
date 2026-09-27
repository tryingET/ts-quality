---
summary: "Repo-local engineering-core adoption for ts-quality."
read_when:
  - "You start work that touches TypeScript tooling, validation evidence, reports, or repo control-plane files."
  - "You need repo-local deviations from shared engineering-core guidance."
type: "reference"
---

# ts-quality engineering guidance

## Upstream owner

Shared engineering lane and discipline guidance comes from `https://github.com/tryingET/core_engineering-core`.
This file records repo-local overrides for ts-quality. The repo `AGENTS.md` remains the operating authority for deterministic evidence, task workflow, product/runtime truth, and validation commands.

- Release pin: `v0.12.2` (`27ff32a529b6da6b27051e97fdb1d95a0a9be4ae`)
- Machine-readable selection lives in `policy/engineering-lane.json`.

## Selected lane

- `ts` — TypeScript CLI/platform package with npm scripts and generated report/artifact surfaces.

```bash
uv tool -n run --from 'git+https://github.com/tryingET/core_engineering-core.git@27ff32a529b6da6b27051e97fdb1d95a0a9be4ae' engineering-core show ts
```

## Selected disciplines

- `validation`
- `testing`
- `security-privacy`
- `documentation`
- `dependency-governance`
- `local-first-data`
- `observability`
- `specification-and-dsls`
- `engineering-reasoning`

Catalog/list commands:

```bash
uv tool -n run --from 'git+https://github.com/tryingET/core_engineering-core.git@27ff32a529b6da6b27051e97fdb1d95a0a9be4ae' engineering-core catalog --pretty
uv tool -n run --from 'git+https://github.com/tryingET/core_engineering-core.git@27ff32a529b6da6b27051e97fdb1d95a0a9be4ae' engineering-core list-disciplines
uv tool -n run --from 'git+https://github.com/tryingET/core_engineering-core.git@27ff32a529b6da6b27051e97fdb1d95a0a9be4ae' engineering-core list-templates
```

## Repo-local deviations and emphasis

- Deterministic evidence and explainability are product semantics, not optional process guidance.
- Runtime behavior and CLI/report contracts must stay aligned with `README.md`, `ARCHITECTURE.md`, `docs/config-reference.md`, `docs/invariant-dsl.md`, `docs/ci-integration.md`, relevant package source, and regression tests.
- Artifact/report evolution should be additive-first whenever possible.
- Keep generated sample artifacts under `examples/artifacts/` intentional and reviewable when runtime behavior changes.
- Do not broaden evidence search just to improve scores; support invariants with aligned or explicitly scoped tests.
- **TypeScript 7 toolchain deferred:** this repo's own runtime imports the classic `typescript` compiler API (`ts.createSourceFile`, `ts.transpileModule` in `packages/ts-quality`, `packages/ts-mutate`, `packages/invariants`, `packages/crap4ts`, and `packages/governance`). Its root `typescript` dependency and `tsc` build/typecheck remain on the current TypeScript 5 line. Changing that product dependency and all API consumers requires a separate design/validation decision; this rollout moves only the engineering-core guidance pin. Do not claim that the TypeScript 7 lane gate is adopted.

## Canonical local commands

- Root gate: `npm run verify`
- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Tests: `npm test`
- Smoke: `npm run smoke`
- Sample artifacts: `npm run sample-artifacts`
- Docs strictness when docs/handoff change: `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`

## Repo loop validation

ts-quality adopts `repo-loop-validation-v1` for deterministic TypeScript quality, artifact, and report loop work. The machine-readable declaration lives in `policy/engineering-lane.json`.

All six phases are implemented by `scripts/loop-phase.mjs` (tests: `test/loop-phase.test.mjs`) and print `key=value` evidence lines: `phase`, `scope`, `result` (`passed`, `failed`, `blocked`, `diagnostic`), plus phase-specific fields and an `authority` boundary line. Exit codes: `0` passed/diagnostic, `1` a check failed, `2` blocked/refused.

- `loop-doctor`: `npm run loop-doctor` (always exits 0; reports Node version, dirty files, and blockers such as missing `node_modules`; `result=diagnostic`, never a validation pass)
- `loop-verify-fast`: `npm run loop-verify-fast` (runs `npm test`; names the covered slice: the full node:test suite)
- `loop-impact-plan`: `npm run loop-impact-plan` (classifies changed files from `git status` as `bounded`, `expanded`, or `wide`, names the checks and the `next` command; runs nothing)
  - `wide`: `package.json`, `package-lock.json`, `tsconfig*.json`, `scripts/`, `packages/`, `fixtures/`, `examples/` → `npm run verify`
  - `bounded`: prose only (`docs/`, `diary/`, `*.md`) → `npm run lint`
  - `expanded`: everything else (tests, policy, unclassified files) → typecheck, lint, tests
- `loop-impact-run`: `npm run loop-impact-run` (re-plans and runs the bounded/expanded checks; refuses a wide plan with `result=blocked`, exit 2, and names the `loop-impact-wide` escalation)
- `loop-impact-wide`: `LOOP_WIDE_REASON="<why>" npm run loop-impact-wide` (refuses with exit 2 unless a non-empty acceptance reason is given; then runs the root `npm run verify` gate and echoes `accepted=<reason>`)
- `loop-landing-check`: `npm run loop-landing-check` (runs the repo-declared `npm run verify` gate, names it as `gate=`, lists `VERIFICATION.md` and `verification/verification.log` as artifacts, and names the remaining AK/CI/merge/release handoff)

These commands produce repo-local evidence for loop orchestration. They do not replace AK task/evidence/decision authority, release approval, package publication authority, merge approval, or downstream production activation authority.

## Validation evidence expectations

For engineering-core adoption metadata changes:

```bash
python -m json.tool policy/engineering-lane.json >/tmp/ts-quality-engineering-lane.json
node /home/tryinget/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
```

For code/runtime changes, follow `AGENTS.md` and run the smallest truthful npm/Justfile evidence for the touched surface.
