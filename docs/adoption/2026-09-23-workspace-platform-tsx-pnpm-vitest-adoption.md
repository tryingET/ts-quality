---
summary: "Real target-shape adoption proof for workspace-platform: pnpm workspace, React TSX, Vitest + jsdom, tsconfig-paths workspace aliases, plus the product defects the pilot exposed and fixed."
read_when:
  - "When checking real outside-repo target-shape adoption evidence for TSX, React, pnpm workspaces, or Vitest/jsdom"
  - "When reviewing artifact compatibility captures from non-fixture target repos"
  - "When changing doctor script/package-manager heuristics or focused-test alignment"
type: "evidence"
---

# workspace-platform TSX/pnpm/Vitest adoption proof

AK task: #5890.

## Target shape

- Target repo: `softwareco/owned/workspace-platform` at `39fb381`, exported with `git archive HEAD` into an isolated scratch target. The source repo worktree was not mutated.
- Shape, none of which earlier pilots covered:
  - pnpm workspace (`packageManager: pnpm@10.30.3`, `pnpm-workspace.yaml`, per-package `node_modules`);
  - React TSX source (`packages/react/src/index.tsx`, 1095 lines of JSX);
  - Vitest 2.1 with the `jsdom` environment and `@vitejs/plugin-react`;
  - tests import source through workspace package aliases (`@workspace-platform/react`) resolved by `vite-tsconfig-paths`, not relative paths.
- Setup deviations, recorded honestly:
  - the target gitignores `pnpm-lock.yaml`; the on-disk lockfile was copied in so `pnpm install --frozen-lockfile` reproduced the target's resolved dependency set;
  - the target ships no coverage provider; `@vitest/coverage-v8@2.1.4` (matching Vitest) was added in the scratch copy only.
- Baseline: `pnpm test` passed 5 files / 19 tests before any ts-quality step.

## Public installed-package path exercised

The CLI was installed from the packed `ts-quality-0.5.1.tgz` into a separate prefix, so the target `package.json` did not gain a ts-quality dependency.

```bash
ts-quality --version                       # 0.5.1
ts-quality doctor --machine --changed packages/react/src/index.tsx
ts-quality init --preset vitest
ts-quality check --changed packages/react/src/index.tsx --run-id naive-001   # with init defaults: fails closed
# configure sourcePatterns, Vitest v8 LCOV generation, focused mutation command, one invariant
ts-quality witness test \
  --invariant react.missing-view-fallback \
  --scenario demo-manifest-missing-preview \
  --source-files packages/react/src/index.tsx \
  --test-files tests/react-renderer.test.tsx \
  --out .ts-quality/witnesses/react-missing-view-fallback.json \
  -- pnpm exec vitest run tests/react-renderer.test.tsx -t "deterministic fallback"
ts-quality check --changed packages/react/src/index.tsx --run-id tsx-pnpm-vitest-adoption
ts-quality report|explain|plan|govern --run-id tsx-pnpm-vitest-adoption
ts-quality authorize --agent release-bot --action merge --run-id tsx-pnpm-vitest-adoption
ts-quality retention --machine
```

Coverage generation and the mutation test command both used the focused Vitest run:

```ts
const focused = ['pnpm', 'exec', 'vitest', 'run', 'tests/react-renderer.test.tsx'];
coverage.generateCommand: [...focused, '--coverage.enabled', '--coverage.provider=v8', '--coverage.reporter=lcov',
  '--coverage.reportsDirectory=.ts-quality/adoption/coverage', '--coverage.include=packages/react/src/**']
mutations.testCommand: focused
```

## Observed outcome

`check` completed in about 25 seconds with:

- outcome: `fail`, merge confidence `62/100`
- coverage generation: `pass -> .ts-quality/adoption/coverage/lcov.info` (Vitest v8 LCOV maps to repo-relative `SF:packages/react/src/index.tsx`)
- mutation: `7 killed / 12 site(s), 5 survived, 0 error(s)` on TSX source
- evidence closure: `mutation-survivors`, "Tighten focused assertions for 5 surviving mutant(s)", suggested edit file `tests/react-renderer.test.tsx`
- execution witness matched invariant id, scenario id, pass status, and impacted source scope

The mutation results were inspected per mutant: every kill names a failing behavioral assertion (for example `renders a deterministic fallback when a registered view export is missing`), and every survivor ran the full 5 focused tests green. No kill came from a module-resolution or environment failure, so the score is not inflated by the mutant workspace.

The `fail` is truthful product behavior: one focused test file exercises part of a 1095-line module, leaving 19 changed functions under 80% coverage and 5 surviving mutants. This complements the kinetic capture, which is a pass.

## Defects the pilot exposed

| # | Defect | Status |
|---|---|---|
| A1 | Focused-test alignment ignored workspace package imports. `tests/react-renderer.test.tsx` imports `@workspace-platform/react`, which tsconfig `paths` maps to the changed file, but alignment only used path and basename hints (`index`), so the invariant reported `focused-test-alignment [missing]` and evidence provenance `missing 1`. | Fixed: alignment resolves the nearest workspace `package.json` below the repo root for each impacted file and aligns tests that import that exact package name or a subpath. The repo-root package is excluded, and prefix names such as `@x/react-dom` do not match `@x/react`. Mode stays `inferred`, with a reason naming the package. |
| D1 | `doctor` recommended `npm run clean` as the coverage command because the `clean` script body (`rimraf coverage ...`) contains the word "coverage". Following that advice deletes coverage and build output. | Fixed: coverage candidates must be named for coverage/LCOV or run a coverage tool, and destructive or `clean` scripts are never candidates. |
| D2 | `doctor` reported `config ok` and `changed ok` while the changed file matched no `sourcePatterns` (the `vitest` preset defaults to `src/**`, the workspace uses `packages/*/src/**`), so `check` would have no coverage, complexity, or mutation evidence for it. | Fixed: new `changed-outside-source-patterns` warn risk names the files and the workspace pattern hint. |
| D3 | `doctor` suggested `npm run ...` in a repo that declares `packageManager: pnpm`. | Fixed: commands use the declared package manager, falling back to lockfile detection, then npm. |
| D4 | The coverage-generation failure message is escaped twice (`\u000a` and `\\u000a`) because the message is escaped when built and again by the CLI error renderer. | Not fixed here: the CLI escaping is a deliberate security boundary; recorded as a follow-up. |
| D5 | Mutant workspaces linked only the root `node_modules`. This target was unaffected (dependencies hoisted to the root), but follow-up #5900 reproduced false kills on a real strict `pnpm install` workspace (`ms` only in `packages/fmt/node_modules`): the pre-fix package reported `Outcome: pass` with 3/3 mutants killed, all by `Cannot find module 'ms'`. | Fixed in #5900: mutant workspaces link every workspace `node_modules`, and the mutation runtime version was bumped so cached results from the old workspace are not reused. The strict target now reports `Outcome: fail`, 1 killed / 2 survived; this pilot's result is unchanged (7 killed / 5 survived). |

Committing the doctor fix also tripped the workspace pre-commit bug scanner on pre-existing lines in `packages/ts-quality/src/index.ts`. The attestation subject-digest check now uses `timingSafeEqual`, and two scanner false positives (a file-extension check and an amendment outcome check) carry `ubs:ignore` annotations with reasons.

After the fixes, the repacked CLI was reinstalled and the same flow was rerun on the same target. `doctor` on the init-default config now prints `coverage=` (no `clean`), the `changed-outside-source-patterns` risk, and `pnpm run test`; `check` produces the same verdict with `focused-test-alignment [clear; mode=inferred]` and provenance `explicit 5, inferred 1, missing 0`.

Observations that are not defects:

- `check` exits `0` with outcome `fail`; the gate is `govern`/`authorize`, consistent with earlier pilots.
- `repo.rootDir` in `run.json` stores an absolute root without its leading slash; committed samples show the same form.

## Compatibility capture

The run packet and the support files needed to project it are checked in under `fixtures/artifact-compatibility/real-tsx-pnpm-vitest/`. The packet was captured after the fixes; the scratch root was replaced with `<target-root>` and `repo.rootDir` with the fixture path.

`test/artifact-compatibility-fixtures.test.mjs` proves the packet stays projectable through `report --json`, `explain`, `plan`, `govern`, and `authorize`, with no drift notice. Authorization is checked as a run-bound deny (`No authority grant covers the requested action and scope.`) because the starter control plane grants no merge authority; that proves projection compatibility, not accepted automation approval.
