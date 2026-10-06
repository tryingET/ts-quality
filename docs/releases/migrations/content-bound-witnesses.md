---
summary: "0.7.0 migration from unbound witness records to current-content execution evidence."
read_when:
  - "When upgrading witness records or investigating stale/contradictory support"
type: "guide"
---

# Content-bound witnesses — migration (since 0.7.0)

This behavior ships in `ts-quality@0.7.0` (published 2026-10-06, AK #6548). Version 0.6.0 and earlier accept unbound witnesses.

## Changed behavior

Witness outer `version: "1"` remains readable. Generated records and receipts now include additive `binding.version: "1"`. A legacy record without a binding no longer grants execution-backed support; reports explain the missing binding and rerun action. Malformed, unknown, unsafe, missing or stale bindings also cannot grant support. Lexical support retains its weaker label and explicit/inferred/missing provenance.

The binding covers exact declared source/test bytes, ancestor package/lock/tsconfig inputs (including absent-file sentinels), command/timeout, Node/platform/architecture and a hash of selected execution environment settings. See `docs/invariant-dsl.md` for the field contract. Raw environment values are not persisted. The producer also checks execution-local input metadata to catch rewriting and restoring bytes during the command. This guard is not a persisted timestamp freshness rule: selection still uses only current bindings and contradiction, never age.

Any current failure for the same invariant/scenario overlapping an impacted source path vetoes passes, even from a different command. Neither observation timestamps nor durations choose a winner. A failed command must be fixed and rerun, or its obsolete witness explicitly retired; merely adding another passing artifact does not erase the contradiction.

## Upgrade steps

1. Inspect the focused command and declare relevant tests/runtime files, including built files when the proof executes them. Build first when needed.
2. Run `ts-quality witness test --invariant <id> --scenario <id> --source-files <src> --test-files <test> --out .ts-quality/witnesses/<name>.json -- <focused-command>`, or configure the same inputs and use `ts-quality witness refresh`.
3. Inspect both witness and receipt bindings and command outcome. Never invent digests in historical JSON or copy old approvals to new evidence.
4. Run `ts-quality check --changed <src> --run-id <new-unused-id>` and inspect scenario support and the overall verdict separately.
5. If a current failure still contradicts support, repair/rerun that failure or deliberately retire its record. Do not change timestamps to favor a pass.

## Limits

Bindings cover explicit inputs, not a discovered complete dependency graph. An empty test list certifies no undeclared test corpus. The environment projection covers PATH, NODE_OPTIONS, NODE_ENV, TZ, LANG and LC_ALL, not every application-specific variable or external service state. These local records are not signatures or authenticity guarantees against manual filesystem edits. Execution-backed scenario support is not itself an approving merge verdict, authorization, accepted adoption or publication proof.
