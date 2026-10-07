---
summary: "Decision180 S4 (AK6703) crosswalk: every one of the 33 legacy root scripts and the extra legacy justfile jobs mapped to a native, reused or held contract."
read_when:
  - "When looking for the native replacement of a legacy ts-quality-tools script, justfile recipe or CI artifact"
  - "When deciding whether an old alias, schema or artifact name may be removed (it may not without a G6 decision)"
type: "reference"
---

# Native S4 crosswalk: legacy root scripts and justfile jobs

Source of the legacy list: `softwareco/infra/ts-quality-tools` at commit
`c5c726e61f0783c473650dbfd25a59bced7d9c7f` (`package.json` scripts and `justfile`), the same pin as
`assessment.md`. Decision: `../../decisions/2026-10-04-legacy-useful-native-supersession.md` (decision180, U12-U16).

Classes:

- **native**: a native job now exists; its own tests prove it. The old spelling, schema and output are **not**
  reproduced.
- **reused**: an existing native owner already does the job (verify/build/test, the AK6553 `Justfile`, the
  AK6548 release workflow).
- **held**: deliberately not built. G11 (workspace-wide aggregate LCOV) and G7 (old two-component topology) are
  utility or topology holds.

Every old script name, justfile recipe, artifact schema (`quality-bundle.json`, `repo-readiness-snapshot.json`,
`repo-validation-summary.json`, `release-trust-report.json`) and artifact name stays a **G6 compatibility hold**.
No alias was created. A named receiver migration or an explicit owner discontinuation decision must come first.
A green native job is not an approval, a release permission or a claim of executed coverage.

## All 33 legacy root scripts

| # | Legacy script | Class | Native contract |
|---|---|---|---|
| 1 | `build` | reused | `npm run build` / `just build` |
| 2 | `test:root` | reused | `npm test` / `just test` (one root suite under `test/`) |
| 3 | `test:workspaces` | reused | `npm test` (no per-workspace test scripts exist) |
| 4 | `test` | reused | `npm test` |
| 5 | `check` | reused | `just check` (script typecheck, lint, tests). The product `ts-quality check` is a different job, not an alias |
| 6 | `coverage:workspaces` | held (G11) | Target-owned LCOV per run (`coverage.generateCommand`, G5). No workspace-wide aggregation |
| 7 | `coverage` | held (G11) | as row 6 |
| 8 | `quality` | native (S3) | `ts-quality navigate --run-id <id>`; the old loop output is a G6 hold |
| 9 | `quality:loop` | native (S3) | as row 8 |
| 10 | `quality:plan` | native (S3) | `ts-quality navigate --run-id <id> --json`; the old `QualityPlan` schema is a G6 hold. `ts-quality plan` is the governance plan, a different job |
| 11 | `quality:bundle` | native (S4) | `ts-quality index write --all --run-id <ids>`: references and digests, with no recomputed plan or trend |
| 12 | `quality:bundle:inspect` | native (S4) | `ts-quality index inspect [--package <dir>] [--json]` |
| 13 | `quality:bundle:smoke` | native (S4) | `test/native-package-index.test.mjs`, `test/native-package-index-ci.test.mjs`, installed `cli.packageIndex` packaging proof |
| 14 | `repo:readiness` | native (S4) | `npm run repo:summary -- --package-index <file> --release-report <file>`: separate facts. The joined `overallStatus` is deliberately absent |
| 15 | `repo:readiness:snapshot` | native (S4) | as row 14 |
| 16 | `repo:readiness:inspect` | native (S4) | Each source reloads itself (`ts-quality index inspect`, `npm run release:diagnostics:inspect`). `repo:summary:compare` schema-checks summaries |
| 17 | `repo:readiness:smoke` | native (S4) | `test/release-diagnostics-summary.test.mjs` |
| 18 | `repo:validation:summary` | native (S4) | `npm run repo:summary -- --verification-log verification/verification.log`: the mode is `full`, `smoke`, `failed` or `partial` |
| 19 | `repo:validation:summary:inspect` | native (S4), partial | Summaries are regenerated from their sources rather than inspected; `compare` refuses unknown kinds and schema versions. No standalone summary inspector was built (no receiver) |
| 20 | `repo:validation:summary:compare` | native (S4) | `npm run repo:summary:compare -- --baseline <file> --candidate <file>`: differences only. Sections are compared only when comparable (same mode, same package set, same target) |
| 21 | `repo:validation:summary:smoke` | native (S4) | `test/release-diagnostics-summary.test.mjs` (smoke vs full is not comparable) |
| 22 | `ci:quality-bundle` | native (S4) | `.github/workflows/ci.yml`: the node 24 leg uploads `ts-quality-package-index` (exactly `upload.paths`, produced by the installed tarball), and the `package-index-reader` job inspects the download with the installed tarball |
| 23 | `ci:repo-readiness` | held (G6) | No joined readiness artifact is uploaded: separate facts by design. The sources are checked in, or reproducible with `npm run release:diagnostics` |
| 24 | `mutate:target` | native (S2) | `ts-quality mutations preview --mutation-targets <spec>` and `ts-quality check --mutation-targets <spec>`; the mission/result adapter is a G6 hold |
| 25 | `release:targets:list` | native (S4) | `npm run release:diagnostics`: one staged target (`ts-quality`, G7). `npm run pack:ts-quality` stages it |
| 26 | `release:targets:check` | native (S4) | `npm run release:diagnostics`, `target.*` checks. The two-component topology is a G7 hold |
| 27 | `release:trust:report` | native (S4) | `npm run release:diagnostics -- --json` |
| 28 | `release:trust:preview` | native (S4) | `npm run release:diagnostics -- --tag v<x.y.z> --out <file>`: exit 1 on a failing check, offline, never permission |
| 29 | `release:trust:inspect` | native (S4) | `npm run release:diagnostics:inspect -- --report <file>` |
| 30 | `release:trust:smoke` | native (S4) | `test/release-diagnostics.test.mjs`: negative tag, workflow, target, provenance, symlink and no-Git cases |
| 31 | `release:check:all` | reused (6548) | `npm run verify` (staged-package and installed-tarball checks in `smoke:packaging`) and the release workflow scripts `release:plan`, `release:prepare`, `release:github`, `release:verify-public`. Per-component release checks are a G7 hold |
| 32 | `ci:smoke` | reused | `just check` / `npm run loop-verify-fast`; CI runs the full `npm run verify:ci` |
| 33 | `ci:full` | reused | `npm run verify` / `just ci`, plus the CI package-index roundtrip |

## Legacy justfile recipes beyond the npm wrappers

Recipes that only wrap a row above (`build`, `check`, `test`, `quality-bundle*`, `repo-readiness*`,
`repo-validation-summary*`, `ci-smoke`, `ci-full`) follow that row. The AK6553 `Justfile` owns the native recipe
surface; S4 adds no recipe.

| Legacy recipe | Class | Native contract |
|---|---|---|
| `default` | reused (6553) | `just help` |
| `coverage <package>` | held (G11) | Target-owned LCOV through the run config; no per-package or aggregate coverage orchestration |
| `quality <package>` | native (S3/S4) | `ts-quality navigate --run-id <id>` and `ts-quality index inspect --package <dir>` |
| `quality-all` | native (S4) | `ts-quality index write --all --run-id <ids>` then `ts-quality index inspect` |
| `mutate <package> <file>` | native (S2) | `ts-quality check --changed <file> --mutation-targets file:<file> --run-id <id>` |

## What S4 deliberately does not claim

- Package enumeration is not executed coverage: an index marks a package without a changed file in its runs as
  `no-run-evidence`, and `completeness.executedCoverageClaim` is always `none` (G11 stays held).
- The summary never joins quality, verification and release into one status. `compare` never says "improved".
- Release diagnostics read local files only: no Git, npm, network or GitHub. Publishing stays with the GitHub
  Release workflow and AK6548. A passing preview grants nothing.
