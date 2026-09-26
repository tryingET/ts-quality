---
summary: "Real third-party target-shape adoption proof for appmap-node: Jest + @swc/jest, CommonJS TypeScript, Yarn 4, tests colocated in src/__tests__, run from the published ts-quality@0.6.0; plus the doctor/source-scope defects it exposed and fixed."
read_when:
  - "When checking real outside-repo adoption evidence for Jest, Yarn 4, or colocated test layouts"
  - "When changing doctor test-runner detection, coverage advice, or source/test scoping"
  - "When reviewing artifact compatibility captures from third-party target repos"
type: "evidence"
---

# appmap-node Jest/Yarn 4 adoption proof

AK task: #6003.

## Target shape

- Target repo: `softwareco/contrib/appmap-node` at `4713c11` (upstream `getappmap/appmap-node`, released 2.27.0 on 2026-09-21), exported with `git archive HEAD` into an isolated scratch target. The fork was not mutated.
- Shape, none of which earlier pilots covered:
  - Jest with the `@swc/jest` transform (TypeScript compiled in memory);
  - CommonJS TypeScript library;
  - Yarn 4 (Berry) with the `node-modules` linker, run through the committed `yarnPath` release;
  - tests colocated under `src/__tests__/`, inside the default `src/**` source root;
  - a mature third-party codebase not written with ts-quality in mind.
- Environment deviation, recorded honestly: `better-sqlite3` (a dev dependency for appmap-node's integration fixtures) has no Node 26 prebuilt binary and failed to build, so the pilot ran on Node 22.23.3, ts-quality's supported floor, where `yarn install --immutable` succeeds.
- Baseline: `jest` passed 39 of 41 suites (2 skipped upstream), 189 tests, in 30 s.

## Public installed-package path exercised

The CLI was installed from npm (`ts-quality@0.6.0`) into a separate prefix.

```bash
ts-quality --version                                   # 0.6.0
ts-quality doctor --machine --changed src/config.ts    # before init
ts-quality init                                        # no Jest preset exists; default preset
ts-quality check --changed src/config.ts --run-id naive-001   # init defaults
# configure focused Jest coverage + mutation commands and one invariant
ts-quality witness test --invariant config.malformed-yaml-fails-informatively --scenario malformed-appmap-yml \
  --source-files src/config.ts --test-files src/__tests__/config.test.ts \
  --out .ts-quality/witnesses/config-malformed-yaml.json \
  -- node .yarn/releases/yarn-4.13.0.cjs jest src/__tests__/config.test.ts -t "malformed throws"
ts-quality check --changed src/config.ts --run-id jest-yarn4-adoption
ts-quality report|explain|plan|govern --run-id jest-yarn4-adoption
ts-quality authorize --agent release-bot --action merge --run-id jest-yarn4-adoption
ts-quality retention --machine
```

With init defaults, `check` failed closed (`Fix the baseline test command before trusting mutation evidence`) because the default mutation command is `node --test`, which does not run Jest tests.

## Observed outcome

- outcome `fail`, merge confidence `15/100`; Jest coverage generation `pass` (relative `SF:src/config.ts`)
- mutation `4 killed / 12 site(s), 8 survived, 0 error(s)`; evidence closure `mutation-survivors` with suggested edit file `src/__tests__/config.test.ts`
- execution witness matched; `focused-test-alignment [clear; mode=inferred]`, provenance `explicit 5, inferred 1, missing 0`
- `authorize` denies because the starter constitution's `default-risk` budget is violated, which is correct governance behavior for this slice

Mutation evidence was checked against Jest's transform cache and module registry: every kill names a failing behavioral assertion, every survivor ran all 9 focused tests green, and one survivor (`keepSourceTokens: true -> false` at `src/config.ts:194`) was reproduced by hand in a separate copy with `jest --no-cache`, which also passed. Survivors are genuine, not unloaded mutants.

## Defects the pilot exposed

| # | Defect | Status |
|---|---|---|
| J1 | Source discovery did not exclude test files, so tests colocated under `src/__tests__/` counted as source (doctor reported `sources=75` including 22 test files) and were eligible for source coverage, complexity, and CRAP treatment. | Fixed: files matching `testPatterns` are excluded from source discovery in both `check` and `doctor`. |
| J2 | `doctor` recommended Node's built-in `node --test --experimental-test-coverage` as the coverage command for a repository whose `test` script is `jest`. | Fixed: the recommendation follows the repository's test runner (Jest or Vitest LCOV flags through the declared package manager), falling back to the node:test command only when no runner is recognized. |
| J3 | With `init` defaults, `mutations.testCommand` is `node --test` in a Jest repository and `doctor` raised no risk; the mismatch surfaced only when `check` failed the baseline. | Fixed: new `mutation-test-runner-mismatch` warn risk when the mutation command's runner (resolving `npm test` / `<pm> run <script>` wrappers) differs from the repository test script's runner. |

After the fixes, the repacked CLI was reinstalled and run on a fresh copy with init defaults: `doctor` reported `sources=55` (tests excluded), the `mutation-test-runner-mismatch` risk, and `yarn run test --coverage --coverageReporters=lcov --coverageDirectory=coverage`; the configured pilot run was unchanged (15, `fail`, 4 killed / 8 survived).

Observations that are not defects:

- `init --preset jest` was added the same day. Dogfooding it here exposed a regression in mutation workspaces: with a symlinked `node_modules`, every mutant died on `yarn run` failing to find its install state, and the run reported a false `pass` (12 of 12 killed). The root cause was broader than the symlink: a kill was never checked against the unmutated code in the same workspace. Mutation runs now execute a workspace baseline first and fail closed when it fails; the same slice then reports the genuine 4 killed / 8 survived.
- The preset's commands run the whole Jest suite until narrowed; in a fresh copy of this repository two integration suites fail without built fixtures, and `check` correctly refuses the failed coverage run.
- The starter constitution includes an example `payments-review` rule that matches nothing in this repository.

## Compatibility capture

`fixtures/artifact-compatibility/real-jest-yarn4/` holds the run packet, config, and control plane. The scratch root and the OS temp directory were replaced with `<target-root>` and `<tmpdir>`.

The third-party source `src/config.ts` is deliberately not vendored: the workspace pre-commit scanner flags upstream code, editing it would break the captured digest, and keeping third-party code out of the repository is simpler. `test/artifact-compatibility-fixtures.test.mjs` therefore proves that the packet parses, `report --json` exposes the captured verdict (15, `fail`), and `explain`, `plan`, `govern`, and `authorize` fail closed with a run-drift notice instead of trusting a packet whose source is absent. The real governance verdict is recorded above.

The packet contains short excerpts of appmap-node (mutation snippets and test names), Copyright 2023 AppLand Inc., MIT License with the Commons Clause; that license is kept verbatim in the fixture's `LICENSE`. Fixtures are not part of the published npm package.
