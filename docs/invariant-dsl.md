---
summary: "Invariant declaration contract for ts-quality, including deterministic evidence expectations."
read_when:
  - "When editing invariants or their supporting evidence semantics"
  - "When documenting how invariant support is evaluated"
type: "reference"
---

# Invariant DSL

Invariants are executable intent. They are written as TypeScript or JavaScript arrays.
If you are authoring a target repo's first invariant, start with `docs/adoption/first-invariant-witness-authoring.md` for the narrow first-slice workflow, good/bad examples, and lexical-vs-execution-backed support interpretation before using this reference.

```ts
export default [
  {
    id: 'auth.refresh.validity',
    title: 'Refresh token validity',
    description: 'Expired refresh tokens must never authorize access.',
    severity: 'high',
    selectors: ['path:src/auth/**', 'symbol:isRefreshExpired'],
    scenarios: [
      {
        id: 'expired-boundary',
        description: 'exact expiry boundary denies access',
        keywords: ['active token before expiry allows access'],
        failurePathKeywords: ['exact expiry boundary denies access'],
        executionWitnessPatterns: ['.ts-quality/witnesses/auth-refresh-expired-boundary.json'],
        expected: 'deny'
      }
    ]
  }
];
```

## Selector forms

- `path:src/auth/**`
- `symbol:isRefreshExpired`
- `domain:payments`

## Deterministic reasoning

The engine does not guess semantics. It uses:

- changed-file and diff-hunk impact
- function evidence from CRAP analysis
- mutation survivors in invariant scope
- focused test corpus keywords for happy-path and failure-path scenarios

Focused tests are selected by either:

- explicit `requiredTestPatterns`, or
- deterministic alignment to the impacted source via file-name/import hints

Scenarios may also declare explicit `executionWitnessPatterns`. Matching witness files are stronger than lexical alignment: when a witness artifact matches the invariant id, scenario id, passing status, and impacted source scope, the scenario can graduate to execution-backed support even if no focused lexical test document was found. When no explicit patterns are declared, `check` still discovers manual witnesses under `.ts-quality/witnesses/**/*.json` and ignores sibling `.receipt.json` sidecars while matching by invariant id, scenario id, `status: "pass"`, and impacted source scope.

If a scenario also declares `executionWitnessCommand` plus `executionWitnessOutput`, `ts-quality check` auto-generates that witness for impacted scenarios before invariant evaluation runs. That makes execution-backed support available both as a manual first-witness artifact and as an opt-in repo-native auto-run workflow.

Unrelated tests elsewhere in the repo do not satisfy an invariant just because they contain the same words or mention selector text in free-form prose.
A scenario also needs a **single assertion-bearing focused test-case witness**: happy-path and failure-path keywords may not be stitched together across separate test files or across separate test cases in the same file to manufacture support, and a non-asserting setup-only test case does not count as lexical support.

Today lexical matching is still **deterministic lexical evidence**, not execution-backed behavioral proof. Current lexical-only matches are reported as `lexically-supported`. The plain `supported` label is now reserved for scenarios backed by explicit execution witness artifacts. That means the engine does not silently upgrade deterministic lexical alignment into proof-like status.

## Content-bound execution witnesses (since 0.7.0)

Generated records retain `version: "1"`, `kind: "execution-witness"`, invariant/scenario ids, status, source/test lists and optional `observedAt`. Both the record and receipt now contain an additive `binding`:

| Field | Meaning |
| --- | --- |
| `version: "1"` | Binding schema, independent of the outer witness version |
| `sourceDigests`, `testDigests` | Exact SHA-256 bytes for every declared source/test path |
| `contextDigests` | Package manifests, npm/pnpm/Yarn/Bun lockfiles and `tsconfig.json` in root and source/test ancestors; absent files use `sha256:missing` |
| `command`, `timeoutMs` | Exact command array and timeout (`null` when unspecified) |
| `environmentDigest` | Hash of PATH, NODE_OPTIONS, NODE_ENV, TZ, LANG and LC_ALL; raw values are not persisted |
| `runtime` | Node version, platform and architecture |
| `fingerprint` | Stable digest of the complete binding basis |

Before granting execution-backed support, evaluation recomputes the binding from current repo-local bytes and execution context. Missing files, unsafe paths, malformed/unknown bindings and drift remove support. The producer rejects non-regular inputs, output/input aliases, hardlinked output files and symlink components in witness/receipt output paths (including dangling links). It checks original publication paths again after the command. It compares execution-local inode/ctime/mtime state as well as bytes to detect input rewrite-and-restore during the command; that metadata is not persisted or used for freshness/selection. Missing context paths also track their containing directory during execution, so commands should not create/delete context inputs or write into those directories unexpectedly. Configured scenarios additionally require their command, declared tests and timeout to match.

**Contradiction rule:** any currently bound failure for the same invariant/scenario overlapping any impacted source path vetoes all matching passes, even from another command. Stale failures cannot veto current evidence. File ordering is sorted; timestamps, duration and `observedAt` never select a winner. After repairing a failure, rerun its witness or explicitly retire obsolete contradictory files; adding another pass alone is insufficient.

**Legacy migration:** records without `binding` remain readable but are explicitly downgraded to missing execution evidence with rerun guidance. Regenerate them using `witness test` or `witness refresh`, then `check` with a new run id. Do not add invented digests to historical JSON. See `docs/releases/migrations/content-bound-witnesses.md`.

A matching witness must bind to the same invariant id + scenario id, declare `status: "pass"`, and cover the impacted source scope through exact repo-relative `sourceFiles`. It must also satisfy the current binding and contradiction rules above. Manual witnesses written by `ts-quality witness test --out .ts-quality/witnesses/<name>.json` are consumed by the next `check` without requiring `executionWitnessPatterns`; explicit patterns remain available when a repo stores witnesses somewhere else or wants narrower matching. Every generated witness now also gets a sibling `.receipt.json` artifact recording the exact command, scoped source/test files, and execution receipt that produced it. The additive `evidenceSemantics` fields keep this distinction explicit in artifacts and reports.

When the witness should come from a real deterministic proof command instead of a hand-authored file, generate it with:

```bash
npx ts-quality witness test \
  --invariant auth.refresh.validity \
  --scenario expired-boundary \
  --source-files src/auth/token.js \
  --test-files test/token.test.js \
  --out .ts-quality/witnesses/auth-refresh-expired-boundary.json \
  -- node --test test/token.test.js
```

Choose the proof command before writing the witness artifact. Start from the changed source file and the focused test file you would cite in review; prefer a module-level command that proves that behavior over a repo-global `npm test` when the global command cannot focus the slice or leaves long-lived handles. Use repo-global `npm test` only as baseline evidence when no focused command exists yet, and record that limitation instead of presenting it as invariant proof. If the proof requires TypeScript source-mode loaders, environment flags, or a long inline assertion, put the exact command in a repo-local npm script and invoke that script after `--`. If the witness imports built output, run the target repo build first so the receipt records a command against current dist bytes. Declare the compiled files and other execution inputs in source/test lists when they must participate in drift checks. These bindings are explicit scope, not exhaustive dependency discovery, command-quality proof or authentication against manual filesystem edits. An empty test list binds only the command and declared sources/context; it does not certify any undeclared test corpus. Execution-backed support alone does not make the overall verdict or authorization pass.

When evidence is weak, it emits concrete `TestObligation` records.

Each impacted invariant also records an additive `evidenceSummary` in the run artifact. The summary is deterministic and compact: it lists `evidenceSemantics` / `evidenceSemanticsSummary`, impacted files, focused tests, optional `executionWitnessFiles`, changed functions, low-coverage counts, mutation counts, per-scenario support, and named sub-signals (`focused-test-alignment`, `execution-witness`, `scenario-support`, `coverage-pressure`, `mutation-pressure`, `changed-function-pressure`) so reviewers can inspect invariant support without reverse-engineering free-form evidence strings. Every sub-signal is also labeled with a provenance mode: `explicit` when it came from direct configuration or artifact evidence, `inferred` when it depended on deterministic alignment heuristics, and `missing` when that class of support is absent.
