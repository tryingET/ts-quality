---
summary: "Unreleased migration for decision180 S1: CRAP inventory/complexity/coverage semantics and the wider mutation catalog."
read_when:
  - "When upgrading past 0.7.0 and CRAP symbols, coverage or mutation scores moved"
  - "When parsing complexity[] or coverage[] from run.json"
type: "guide"
---

# Native quality correctness — Unreleased migration

This describes current source after 0.7.0, not a published release. Applies to consumers of `run.json`, `report.json`, CRAP text output and mutation results, including CI assertions, dashboards and agents that compare runs.

## 1. Expect different numbers for the same code

Re-run `check` with a new run id; do not compare new scores with runs from 0.7.0 or earlier as if the code had changed.

- More CRAP entries: constructors and `get`/`set` accessors now have their own entries. Ambient, abstract and overload signatures no longer do.
- Lower parent complexity: a function no longer counts the branches of functions nested inside it.
- Different coverage percentages: the denominator is now the function's LCOV-instrumented lines, not its non-blank text lines. Comments and declarations that the coverage tool does not instrument no longer count as uncovered.
- More mutation sites: multiplication, loose equality, increments, numeric `0`/`1` and condition inversion. Mutation scores and survivor counts move. With `mutations.maxSites`, the first sites now include these probes, so the budget covers fewer source lines.
- Mutation results cached by earlier versions are reused only for unchanged sites; new sites run fresh.

## 2. Update symbol matching

Arrows and function expressions now carry the name they are bound to (`arrow:handler`, `function-expression:module.exports.save`, `arrow:default`) instead of `<anonymous@line>`. Constructors are `constructor:<Class>`; accessors are `get:<name>` and `set:<name>`. Callbacks remain `<anonymous@line>`. Update baselines, invariant selectors and dashboards that key on the old anonymous names.

## 3. Read `coverageStatus` before trusting `coveragePct`

`complexity[].coverageStatus` is additive. `measured` means `coveragePct` is real. Any other value (`missing`, `ambiguous`, `malformed`, `mismatched`, `not-instrumented`) means unknown coverage: `coveragePct` is 0 and CRAP is the fully-uncovered score. In your own outputs, report those functions as unknown rather than "0% covered", and fix the evidence. ts-quality labels them in the CRAP text report, the CRAP budget finding, the PR summary hotspot and the verdict warning; its invariant summaries, `explain` and coverage basis still print 0% for now.

- `missing`: no LCOV record for the file; generate target-owned coverage (`coverage.generateCommand`) or fix `sourcePatterns`/`lcovPath`.
- `ambiguous`: several LCOV records end with the same path; produce LCOV with repository-relative `SF:` paths.
- `malformed`: unreadable `DA:` records (see `coverage[].malformedLines`); regenerate the LCOV.
- `mismatched`: LCOV lines past the end of the source, usually LCOV from compiled or stale output; map coverage back to source.
- `not-instrumented`: the function's lines have neither `DA` entries nor an `FN`/`FNDA` entry record.

A changed function with unknown coverage adds a verdict warning, so a former `pass` can become `warn`. Older packets have no `coverageStatus`; treat its absence as not provided, not as measured.

## 4. Repeated LCOV records

`coverage[]` now has one entry per file. Repeated `SF:` records merge and their hits add up, so `coveredLines`/`totalLines`/`pct` describe the union. A file with unreadable `DA:` records has `pct: 0` and `malformedLines`. The additive `functionHits` keeps `FN`/`FNDA` entry hits by start line.

## Verification

```bash
npm run verify
node --test test/legacy-quality-catalog.test.mjs
```

Mutation results gain new `operator` values (`*`, `==`, `!=`, `++`, `--`, `0`, `1`, `condition`) and matching `description` strings; parsers that switch on operator values must accept them.

Not changed: CLI flags and exit codes, report schemas apart from the additive fields and values above, primaryAction selection and its eight-group cap, and every G6-held legacy interface (old function names, flat CRAP JSON, legacy flags and exports).
