---
summary: "Invariant declaration contract for ts-quality, including deterministic evidence expectations."
read_when:
  - "When editing invariants or their supporting evidence semantics"
  - "When documenting how invariant support is evaluated"
type: "reference"
---

# Invariant DSL

Invariants are executable intent. They are written as TypeScript or JavaScript arrays.

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

Scenarios may also declare explicit `executionWitnessPatterns`. Matching witness files are stronger than lexical alignment: when a witness artifact matches the invariant id, scenario id, passing status, and impacted source scope, the scenario can graduate to execution-backed support even if no focused lexical test document was found.

If a scenario also declares `executionWitnessCommand` plus `executionWitnessOutput`, `ts-quality check` auto-generates that witness for impacted scenarios before invariant evaluation runs. That makes execution-backed support an opt-in repo-native workflow, not just a manual artifact drop.

Unrelated tests elsewhere in the repo do not satisfy an invariant just because they contain the same words or mention selector text in free-form prose.
A scenario also needs a **single assertion-bearing focused test-case witness**: happy-path and failure-path keywords may not be stitched together across separate test files or across separate test cases in the same file to manufacture support, and a non-asserting setup-only test case does not count as lexical support.

Today lexical matching is still **deterministic lexical evidence**, not execution-backed behavioral proof. Current lexical-only matches are reported as `lexically-supported`. The plain `supported` label is now reserved for scenarios backed by explicit execution witness artifacts. That means the engine does not silently upgrade deterministic lexical alignment into proof-like status.

Minimal execution witness artifact contract:

```json
{
  "version": "1",
  "kind": "execution-witness",
  "invariantId": "auth.refresh.validity",
  "scenarioId": "expired-boundary",
  "status": "pass",
  "sourceFiles": ["src/auth/token.js"],
  "testFiles": ["test/token.runtime.test.js"],
  "observedAt": "2026-04-21T00:00:00.000Z"
}
```

A matching witness must bind to the same invariant id + scenario id, declare `status: "pass"`, and cover the impacted source scope through exact repo-relative `sourceFiles`. Every generated witness now also gets a sibling `.receipt.json` artifact recording the exact command, scoped source/test files, and execution receipt that produced it. The additive `evidenceSemantics` fields keep this distinction explicit in artifacts and reports.

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

When evidence is weak, it emits concrete `TestObligation` records.

Each impacted invariant also records an additive `evidenceSummary` in the run artifact. The summary is deterministic and compact: it lists `evidenceSemantics` / `evidenceSemanticsSummary`, impacted files, focused tests, optional `executionWitnessFiles`, changed functions, low-coverage counts, mutation counts, per-scenario support, and named sub-signals (`focused-test-alignment`, `execution-witness`, `scenario-support`, `coverage-pressure`, `mutation-pressure`, `changed-function-pressure`) so reviewers can inspect invariant support without reverse-engineering free-form evidence strings. Every sub-signal is also labeled with a provenance mode: `explicit` when it came from direct configuration or artifact evidence, `inferred` when it depended on deterministic alignment heuristics, and `missing` when that class of support is absent.
