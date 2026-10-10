---
summary: "v0.8.0 migration for decision180 S2: explicit mutation targets, inert preview, selection ledger, time budget and runner truth."
read_when:
  - "When upgrading past the S1 changes and mutation results, errors or caching behave differently"
  - "When parsing run.json mutationSelection or mutation result origin/errorKind"
  - "When replacing legacy --scan, --lines, --function-id, --since-last-run or --mutate-all jobs"
type: "guide"
---

# Native mutation selection — v0.8.0 migration

Part of v0.8.0; [`v0.8.0.md`](v0.8.0.md) is the release-level map. It applies to CI scripts, agents and parsers that read `run.json` mutation fields, and to operators replacing legacy mutation jobs.

## 1. A killed test process is no longer a kill

A test process that dies from a signal (for example the OOM killer) used to count as a killed mutant, because its exit was non-zero. It is now an `error` result with `errorKind: "signal"`. Error results are blocking verdict findings, as before. Scores that were inflated by such kills drop. The mutation runtime version moved to 9, so every result cached by an earlier version is re-run once instead of being reused.

## 2. Error outcomes are re-run, never cached

Only `killed`, `survived` and `invalid` outcomes are cached. A timeout or infrastructure error is executed again on the next run, so raising `mutations.timeoutMs` takes effect at once. Results carry additive `origin` (`executed`, `cached`, `not-executed`) and, for errors, `errorKind` (`timeout`, `command-missing`, `signal`, `spawn`, `baseline`, `budget`). Treat absent fields in older packets as not provided.

## 3. Read the selection ledger, not just the score

`run.json` has additive `mutationSelection`. Before trusting a mutation score in CI, assert `mutationSelection.complete == true`; it is false when the baseline failed, a site was left unrun or any selected site ended in an execution error. See `docs/ci-integration.md`. Sites excluded as `outside-changed-hunks`, `uncovered`, `not-targeted`, `nested-function` or `budget-sites` were never tested.

## 4. Optional time budget

`mutations.maxDurationMs` stops launching mutants after that much mutant execution time. Unrun selected sites become `error` results with `errorKind: "budget"`, so the verdict fails closed until the budget covers the selection. Prefer a smaller `maxSites` or explicit targets for a bounded, complete experiment.

## 5. Explicit targets and preview replace legacy selection flags

| Legacy job | Native replacement |
|---|---|
| `--scan` | `ts-quality mutations preview [--json]` (inert: runs nothing, writes nothing) |
| `--lines` | `span:<path>:<start>-<end>` target |
| `--function-id` with `--start-line`/`--end-line` | `symbol:<path>#<kind:name>@<start>-<end>` target; nested functions are never mutated by it |
| one known site | `site:<id>` target from a preview |
| `--since-last-run` | automatic fingerprinted cache reuse, reported as `origin: "cached"` |
| `--mutate-all` | no target and a `maxSites` large enough for the eligible set |

Pass targets with `check --mutation-targets "<spec>;<spec>"` or config `mutations.targets`; an empty list is rejected. `check` refuses missing, renamed, ambiguous, stale, out-of-scope and no-eligible-site targets: command-line targets before the run id is reserved or any command runs, configured targets after coverage generation but before witnesses and mutants. Resolve them with the preview first. Targeted or time-budgeted runs are not trend-comparable with differently selected runs. The old flag spellings, mission JSON and declaration-level selection stay held (decision180 G6/G10), not reproduced.

## Verification

```bash
npm run verify
node --test test/native-selection-targeting.test.mjs test/native-selection-cli.test.mjs
```

Not changed: verdict scoring formulas, CLI exit codes, primaryAction selection, parallelism (held, G3) and relative timeouts (held, G4).
