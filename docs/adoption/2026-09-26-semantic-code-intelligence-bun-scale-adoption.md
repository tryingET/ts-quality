---
summary: "Real large-repo and Bun-runner adoption proof for semantic-code-intelligence: ~170 ESM TypeScript source files, Bun test runner and LCOV, run from the published ts-quality@0.6.0; scale measurements plus the hidden-directory discovery defect it exposed and fixed."
read_when:
  - "When checking real adoption evidence for Bun-tested or large TypeScript repositories"
  - "When changing source/test discovery, hidden-directory handling, or doctor coverage advice"
  - "When judging check runtime on repositories with many source files"
type: "evidence"
---

# semantic-code-intelligence Bun/scale adoption proof

AK task: #6004.

## Target shape

- Target repo: `softwareco/owned/semantic-code-intelligence` at `bbeebdfd`, exported with `git archive HEAD` into an isolated scratch target (the source checkout had unrelated uncommitted work, which was not copied or touched).
- Shape, none of which earlier pilots covered:
  - the Bun test runner (`bun test`) and Bun's LCOV reporter, behind a sliced shell wrapper (`scripts/run-normal-tests.sh`);
  - a large ESM TypeScript service (Express, MCP/LSP adapters): 176 files under `src/`, 198 test files, 807 tracked files;
  - `bun.lock` as the only lockfile.
- Baseline: the repository's own `scripts/run-normal-tests.sh` passed 40 of 41 batches in 62 s; the failing batch is three LSP server integration tests timing out at 5 s, which is environment-dependent and unrelated to ts-quality. The focused slice test (`tests/runtime-config.test.ts`) passes 17 tests in 0.19 s.

## Public installed-package path exercised

`ts-quality@0.6.0` was installed from npm into a separate prefix and run on Node 22.23.3:

```bash
ts-quality doctor --machine --changed src/core/runtime-config.ts   # before init: 0.2 s over 176 sources
ts-quality init
ts-quality witness test --invariant runtime-config.path-containment --scenario escape-attempts-rejected \
  --source-files src/core/runtime-config.ts --test-files tests/runtime-config.test.ts \
  --out .ts-quality/witnesses/runtime-config-path-containment.json \
  -- bun test tests/runtime-config.test.ts -t "cannot escape"
ts-quality check --changed src/core/runtime-config.ts --run-id bun-large-esm-adoption
```

Coverage used `bun test tests/runtime-config.test.ts --coverage --coverage-reporter=lcov --coverage-dir=.ts-quality/adoption/coverage`; mutation used `bun test tests/runtime-config.test.ts`. `sourcePatterns` was left at the repository-wide default so `check` analyzed every source file.

## Scale outcome

- `check` over 170 source files (after the fix below), 60 LCOV records, and 25 mutation sites completed in about 24 s (27.7 s before the fix); `doctor` took 0.2 s.
- outcome `fail`, merge confidence `19/100`; coverage basis correctly counted only the 1 changed source file in the 60-record Bun LCOV
- mutation `16 killed / 25 site(s), 9 survived, 0 error(s)`; `authorize` denies on the starter `default-risk` governance budget, which is correct for this slice

Mutation evidence on the Bun path was checked: kills show Bun assertion frames from the focused test, survivors ran all 17 tests green, and one survivor (`parent === current` → `!==` in `findRuntimeConfigPath`, which ends the parent-directory walk early) was reproduced by hand with a direct `bun test` run that also passed.

## Defect the pilot exposed

| # | Defect | Status |
|---|---|---|
| S1 | Source and test discovery walked into hidden directories. The target's own test run generates untracked `.ontology/snapshots/<uuid>/` copies of the repository, so 16 of 17 "focused tests" were snapshot copies, `doctor` reported `tests=587`, and evidence closure told the operator to edit `.ontology/snapshots/.../tests/runtime-config.test.ts`. | Fixed: discovery skips files under hidden directories unless the matching pattern names a hidden directory explicitly (for example `.storybook/**`). After the fix the same target reports `tests=231`, the single real focused test, and `Suggested edit files: tests/runtime-config.test.ts`, with an unchanged verdict. |

Observations that are not fixed here:

- `doctor` suggests reusing the repository's `test:coverage` script. Here that script runs the whole suite with `bun test --coverage` and no LCOV reporter; under `check` it hit the 60 s generation timeout and fails closed with a clear message. For large repositories a focused LCOV command is the right advice; the wrapper script hides the runner, so `doctor` cannot detect this yet.
- The repository test script is a shell wrapper, so runner detection cannot see that it runs Bun; runner-mismatch warnings therefore do not fire for this shape.

## Compatibility capture

Vendoring all 170 analyzed source files and the 2.4 MB scale packet would add about 5 MB, so the fixture `fixtures/artifact-compatibility/real-bun-esm/` is a narrowed capture of the same target and slice (`sourcePatterns: ['src/core/runtime-config.ts']`, same verdict 19 / 16 killed / 9 survived). It includes the one source file, so projections run without drift and keep the real governance verdict. `src/core/runtime-config.ts` is Apache-2.0 code from semantic-code-intelligence; its license is in the fixture's `LICENSE`. Fixtures are not part of the published npm package.
