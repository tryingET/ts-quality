---
summary: "AK6700 (decision180 S1): native CRAP inventory, own-body complexity, explicit coverage status and the valid legacy mutation catalog."
read_when:
  - "When changing CRAP function inventory, complexity, LCOV coverage meaning or the mutation operator catalog"
type: "decision"
---

# Native quality correctness — decision180 S1

## Basis

Decision180 (accepted 2026-10-06, ADR `2026-10-04-legacy-useful-native-supersession.md`) selected the native U1-U4 design, including G2 (keep valid runtime loose-equality probes) and G5 (explicit coverage input, no ambiguous fallback). AK #6700 implements that slice. The AK6581 parity probe at the pinned commits showed the active analysis missed constructors and accessors, counted ambient declarations, charged nested function bodies to their parent, used text lines as the coverage denominator, kept repeated LCOV records apart, lacked five legacy operator families and mutated a boolean inside a type alias.

This is a breaking change under the alpha policy (`2026-03-19-alpha-breaking-changes-allowed.md`): CRAP symbols, complexity values, coverage percentages, mutation site sets and therefore scores can change for the same source.

## Design

- **Inventory (U1).** One entry per function-like node with an executable body: functions, methods, constructors, `get`/`set` accessors, arrows and function expressions. No body means no entry, which excludes abstract and overload signatures; nothing inside a `declare` declaration is inventoried. Symbols stay `<kind>:<name>` with whitespace collapsed to single spaces; arrows and function expressions take the name they are bound to (variable, property, class field, parameter or destructuring default, `=`/`||=`/`&&=`/`??=` target, `default` for default exports including `export =`); callbacks stay `<anonymous@line>` on purpose. Legacy `Class.member` names are a G6-held interface, not adopted.
- **Complexity (U2).** Decision points of the function's own body; nested functions are their own entries. CRAP keeps percent units, clamps coverage to 0-100 and rounds to two decimals. Equal-CRAP hotspots sort by file, start line, end line and symbol.
- **Coverage (U3).** The denominator is the function's LCOV-instrumented `DA` lines. A function with no `DA` line (an empty body under statement-level LCOV such as istanbul) is measured by its `FN`/`FNDA` entry record instead, kept in the additive `functionHits`. Repeated records for one file merge and their hits add up. A function's coverage is unknown when its evidence is missing, ambiguous (several suffix matches), malformed (unreadable DA records; the file's `pct` is then 0), mismatched (LCOV lines past the end of the source) or not instrumented. Unknown coverage is named in the additive `coverageStatus`, scored as uncovered, and raises a verdict warning when the function is changed. It is never scored as covered. Path matching is unchanged: exact, else a unique suffix; several suffix matches are reported as ambiguous instead of picked. For a source file at the repository root a unique suffix is a basename, so that pre-existing case can still borrow another directory's record.
- **Mutation catalog (U4, G2).** Adds `*`→`/`, `==`↔`!=`, `++`↔`--`, numeric `0`↔`1` and condition inversion (`!(expr)`, or `expr` for `!expr`) in `if`, `?:`, `while`, `do` and `for`. Type nodes, interfaces, aliases, type parameters, `declare` declarations and `.d.ts` files are skipped; a class `extends` expression is runtime code and stays mutable. Numeric property and destructuring keys are not mutated. A replacement that would lex together with a neighbor (`a */* c */ b`, `a-++b`) is skipped, because it would run a different mutant. Every operator fixture of the AK6581 corpus now yields the legacy spans and replacements.

## Alternatives and limits

A `null` CRAP for missing coverage (legacy) was rejected: it would let unknown evidence fall out of budgets. A numeric worst-case score plus an explicit status keeps policy fail-closed and the report truthful. Re-adding basename/implicit LCOV lookup was rejected (G5). Restoring legacy function names, flat JSON, CLI flags, exit codes or exports stays held under G6.

Not in this slice: parallel workers (G3), relative timeouts (G4), declaration-level selection (G10), aggregate LCOV (G11), selection/budget preview (S2). The primary action still shows at most eight survivor groups, so a wider catalog can push later groups out of that view; `mutation-remediation.json` keeps every survivor. Condition inversion and the operator inside it (`!(a === b)` and `!==`) are both sites, as in legacy, so they can double-count.

Known residuals, outside this slice's paths: invariant summaries, `explain` and the coverage basis still print unknown coverage as 0% (`packages/invariants` and the evidence-basis projection do not carry `coverageStatus` yet); `mutations.coveredOnly` still selects sites from malformed or mismatched evidence (S2 selection); class field initializers of a class nested in a function count toward that function's complexity.

## Verification and migration

Focused scenarios live in `test/crap4ts.test.mjs`, `test/ts-mutate.test.mjs`, `test/evidence-model.test.mjs`, `test/policy-engine.test.mjs` and `test/legacy-quality-catalog.test.mjs` (the recorded legacy oracle). The crosswalk is `../adoption/legacy-parity/native-s1-catalog-crosswalk.md`; the consumer migration is `../releases/migrations/legacy-quality-native-correctness.md`.
