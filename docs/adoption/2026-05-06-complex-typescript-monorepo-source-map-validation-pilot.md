---
summary: "Candidate runbook for validating ts-quality against a complex TypeScript workspace with dist runtime, source-map LCOV, runtime mirrors, and diff-hunk scope."
read_when:
  - "When planning the remaining complex TypeScript monorepo/source-map validation item."
  - "When validating ts-quality in a workspace that uses custom test runners, loaders, built runtime output, or hunk-scoped review."
type: "how-to"
---

# Complex TypeScript monorepo source-map validation pilot

## Status

This is a **docs-only candidate runbook**. It does not claim that the pilot has been executed. Use it to run the next adoption validation in a real complex TypeScript monorepo after selecting a target repo and a bounded changed slice.

The runbook combines the proven pieces from the earlier TypeScript dist, synthetic monorepo, and real monorepo pilots, then adds the remaining high-friction shape:

- npm/pnpm/yarn workspaces with nested `packages/*/package.json` files;
- authored TypeScript under package-local `src/**`;
- tests that execute built runtime output such as `dist/**`, `lib/**`, or `build/**`;
- custom runner/loader wrappers such as `tsx`, `ts-node`, `vitest`, `jest`, Node loader hooks, or package-manager workspace filters;
- LCOV that must map back to authored `.ts`/`.tsx` files through source maps;
- `mutations.runtimeMirrorRoots` so mutated source is mirrored into runtime output before the target tests execute;
- `changeSet.diffFile` so changed-function, mutation, invariant, and governance evidence can stay hunk-scoped rather than widening to the whole file;
- package attribution checks for the nested workspace package that owns the changed source.

## Pilot success question

Can `ts-quality` screen authored TypeScript source in a real workspace package while the target repo's tests run through its normal built-runtime and loader path, and can the run artifact prove all of the following without widening scope?

1. Changed scope is anchored to an explicit file list and/or diff hunks.
2. LCOV coverage entries map to authored package source files, not only built runtime files.
3. Mutants are executed through the package's real test command while runtime mirrors keep built output aligned with mutated source.
4. The changed file is attributed to the expected workspace package.
5. Invariant witness evidence, if used, binds to the same source slice and focused test files.
6. Downstream `report`, `explain`, `govern`, and optional `authorize` projections read the selected `--run-id`.

## Target selection checklist

Choose one real repo/package slice that has all of these properties:

- A root workspace manifest, for example `package.json` with `workspaces`, `pnpm-workspace.yaml`, or an equivalent package-manager workspace surface.
- A nested package with a stable package name, for example `packages/api/package.json`.
- Authored source under a path like `packages/api/src/**/*.ts` or `packages/api/src/**/*.tsx`.
- Runtime tests that normally import compiled files under `packages/api/dist/**`, `packages/api/lib/**`, `packages/api/build/**`, or a root-level built output tree.
- A repo-native build command for the target package.
- A focused package test command or package-manager filter command.
- A coverage command that can emit LCOV while preserving source-map remapping to the authored source path.
- A small review slice with a real or synthetic diff patch touching one behavior-bearing hunk.

Avoid a target that only proves JavaScript source, only proves root-package tests, or requires repo-global tests as the only available signal unless the goal is explicitly to document that limitation.

## Suggested target-repo scripts

Prefer repo-local scripts so CI, witness refresh, coverage generation, and mutation baselines all exercise the same wrapper path an operator would use manually.

Example root `package.json` shape for a pnpm/npm workspace:

```json
{
  "scripts": {
    "build:api": "pnpm --filter @acme/api build",
    "test:api:slice": "pnpm --filter @acme/api test -- token",
    "coverage:api:slice": "mkdir -p coverage && pnpm run build:api --silent && NODE_OPTIONS=--enable-source-maps pnpm --filter @acme/api exec node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=../../coverage/api-token.lcov.info dist/test/token.test.js",
    "screening:api:witness-refresh": "ts-quality witness refresh --config ts-quality.config.json",
    "screening:api:check": "ts-quality check --config ts-quality.config.json"
  }
}
```

If the target uses a custom loader instead of plain `node --test`, keep the custom loader in the wrapper script rather than spreading it through CI YAML. Examples:

```json
{
  "scripts": {
    "test:api:slice": "pnpm --filter @acme/api exec node --loader ts-node/esm --test test/token.test.ts",
    "test:api:slice:tsx": "pnpm --filter @acme/api exec tsx --test test/token.test.ts",
    "test:api:slice:vitest": "pnpm --filter @acme/api exec vitest run test/token.test.ts --coverage.enabled --coverage.reporter=lcov"
  }
}
```

For a dist-backed pilot, prefer the command that the package normally trusts in CI. If that command runs authored TS directly through a loader, record that as a source-mode loader pilot. If it runs built JS, keep the source-map LCOV and runtime mirror checks below mandatory.

## Candidate `ts-quality.config.json`

Tune paths to the selected package. The important part is that source patterns stay on authored source while coverage and mutation commands may execute built output.

```json
{
  "sourcePatterns": ["packages/api/src/**/*.ts", "packages/api/src/**/*.tsx"],
  "testPatterns": ["packages/api/test/**/*.ts", "packages/api/test/**/*.tsx", "packages/api/tests/**/*.ts"],
  "coverage": {
    "lcovPath": "coverage/api-token.lcov.info",
    "generateCommand": ["pnpm", "run", "coverage:api:slice", "--silent"],
    "generateWhenMissing": true,
    "generateTimeoutMs": 120000
  },
  "mutations": {
    "testCommand": ["pnpm", "run", "test:api:slice", "--silent"],
    "coveredOnly": true,
    "timeoutMs": 30000,
    "maxSites": 12,
    "runtimeMirrorRoots": ["packages/api/dist", "packages/api/lib"]
  },
  "policy": {
    "maxChangedCrap": 40,
    "minMutationScore": 0.6,
    "minMergeConfidence": 70
  },
  "changeSet": {
    "files": ["packages/api/src/token.ts"],
    "diffFile": ".ts-quality/inputs/review.diff"
  },
  "invariantsPath": ".ts-quality/invariants.ts",
  "constitutionPath": ".ts-quality/constitution.ts",
  "agentsPath": ".ts-quality/agents.ts",
  "approvalsPath": ".ts-quality/approvals.json",
  "waiversPath": ".ts-quality/waivers.json",
  "overridesPath": ".ts-quality/overrides.json"
}
```

Notes:

- Keep `sourcePatterns` on authored `src/**`. Do not screen `dist/**` as the source of truth just because tests import it.
- Include every built runtime root that the focused tests can import in `mutations.runtimeMirrorRoots`; common values are package-local `packages/<name>/dist`, `packages/<name>/lib`, `packages/<name>/build`, and sometimes root-level `dist` for bundled packages.
- Keep `changeSet.diffFile` repo-local. Materialized configs copy diff inputs into a reserved materialized inputs subtree, but the pilot config should still name an explicit source diff path.
- Set `coveredOnly: true` only when LCOV reliably maps back to authored source lines. If source-map remapping is not working yet, leave the failed warning as evidence rather than widening source patterns to built files.

## Diff-hunk input

Generate a stable diff file from the exact review slice:

```bash
mkdir -p .ts-quality/inputs
git diff --unified=0 -- packages/api/src/token.ts > .ts-quality/inputs/review.diff
```

When there is no live git diff, create a minimal patch file that contains only the intended hunk for the selected source file. The hunk should mention the authored source path, not the built runtime path.

Validation checks after `check`:

- `run.json` changed files include `packages/api/src/token.ts`.
- The effective changed functions correspond to the hunked lines, not every function in the file.
- Mutation sites outside the hunk are not counted as the primary changed-scope pressure unless another configured changed file/hunk includes them.
- `report --run-id` and `explain --run-id` explain any uncovered or surviving pressure against the hunked source slice.

## Source-map LCOV checks

Before trusting a dist-backed run, inspect the generated LCOV directly:

```bash
pnpm run coverage:api:slice --silent
rg '^SF:' coverage/api-token.lcov.info
```

Acceptable LCOV shape:

```text
SF:packages/api/src/token.ts
DA:42,1
```

Risky shape that should fail or warn until remapped:

```text
SF:packages/api/dist/token.js
DA:42,1
```

If LCOV only names built files:

1. ensure TypeScript emits source maps for the package build;
2. run Node with `NODE_OPTIONS=--enable-source-maps` or configure the target coverage tool's source-map remapper;
3. confirm source-map paths are repo-local and point back to `packages/api/src/**`;
4. rerun coverage and `ts-quality check` with the same changed scope;
5. keep any `analysisWarnings` in the pilot result instead of editing config to hide the risk.

## Runtime mirror checks

The mutation baseline should prove the real runtime path while still mutating authored source. For a dist-backed package:

- run the package build before the baseline test command;
- configure `runtimeMirrorRoots` for each runtime root the tests import;
- verify that the baseline command passes before mutation outcomes are trusted;
- keep the test command focused on the package slice rather than falling back to repo-global tests when a focused command exists.

Pilot result checks:

- `run.json` records the configured runtime mirror roots in the mutation execution fingerprint or mutation config snapshot.
- Mutants execute through the same custom runner/loader/build wrapper as the baseline command.
- A baseline failure blocks confidence instead of producing a fake-green mutation score.
- Surviving mutants produce a remediation payload rather than being treated as an adoption failure by themselves.

## Package attribution checks

After `check`, inspect the selected run:

```bash
RUN_ID="pilot-complex-ts-monorepo"
jq '.changedFiles, .filePackages // .packageAttribution // empty' ".ts-quality/runs/$RUN_ID/run.json"
```

Expected evidence:

- changed file: `packages/api/src/token.ts`;
- package name: the package-local manifest name, for example `@acme/api`;
- package root: `packages/api` when that field is present;
- governance and authorization rules, if configured, match package-local paths rather than root-global globs only.

If attribution is missing, document whether the target package lacks a package manifest, uses a nonstandard workspace layout, or exposes a ts-quality gap that needs product work.

## Execution sequence

```bash
set -euo pipefail

RUN_ID="pilot-complex-ts-monorepo"
CHANGED_SCOPE="packages/api/src/token.ts"

pnpm install --frozen-lockfile
pnpm run build:api --silent
pnpm run coverage:api:slice --silent
rg '^SF:' coverage/api-token.lcov.info

npx ts-quality doctor --config ts-quality.config.json --machine --changed "$CHANGED_SCOPE"
npx ts-quality witness refresh --config ts-quality.config.json --changed "$CHANGED_SCOPE"
npx ts-quality check --config ts-quality.config.json --changed "$CHANGED_SCOPE" --run-id "$RUN_ID"
npx ts-quality report --run-id "$RUN_ID" --json > ".ts-quality/runs/$RUN_ID/report.projected.json"
npx ts-quality explain --run-id "$RUN_ID"
npx ts-quality govern --run-id "$RUN_ID"
```

Optional authorization, only when the target repo has an agent/grant model for the package slice:

```bash
npx ts-quality authorize --agent release-bot --run-id "$RUN_ID"
```

## Result packet template

Record the actual pilot results in a follow-up evidence entry. Do not fill these fields with expected values.

```json
{
  "packageSpec": "ts-quality@<version>",
  "targetRepo": "<repo path or public repo>",
  "targetPackage": "<workspace package name>",
  "runId": "pilot-complex-ts-monorepo",
  "changedFiles": ["packages/api/src/token.ts"],
  "diffHunkScoped": "<true|false|not-inspected>",
  "coverageFiles": ["<SF entries that map to authored source>"],
  "builtCoverageOnlyWarning": "<present|absent>",
  "runtimeMirrorRoots": ["packages/api/dist"],
  "customRunnerOrLoader": "<command summary>",
  "baselineMutationCommandPassed": "<true|false>",
  "mutationSitesInScope": "<number>",
  "killedMutantsInScope": "<number>",
  "survivingMutantsInScope": "<number>",
  "packageAttribution": {
    "filePath": "packages/api/src/token.ts",
    "packageName": "<workspace package name>"
  },
  "outcome": "<pass|fail>",
  "mergeConfidence": "<number>",
  "nextEvidenceAction": "<summary>"
}
```

## Pass/fail interpretation

A useful complex monorepo pilot does not need a passing verdict. It must truthfully distinguish product evidence from target-repo weakness:

- **Pass with source-mapped LCOV and killed mutants**: adoption story holds for this package shape.
- **Fail because source-map LCOV maps only to `dist/**`**: target coverage setup is not yet trustworthy for authored-source screening.
- **Fail because baseline mutation command fails**: target runner/loader/build wrapper must be fixed before mutation evidence can be trusted.
- **Fail because mutants survive**: adoption succeeded; the target code/test suite has a concrete evidence obligation.
- **Fail because package attribution is absent or wrong**: document whether target layout is unsupported or ts-quality needs package-discovery hardening.

Do not lower thresholds, remove `diffFile`, broaden `sourcePatterns` to built output, or switch to repo-global tests just to produce a green run.
