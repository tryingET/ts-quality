---
summary: "AK6700 crosswalk: legacy (pin c5c726e) CRAP/coverage/mutation behavior against native S1, row by row, with intentional differences and G6 holds."
read_when:
  - "Checking which legacy CRAP or mutation behavior the native tool now reproduces"
type: "reference"
---

# Native S1 catalog crosswalk

Legacy is `infra/ts-quality-tools` at `c5c726e61f0783c473650dbfd25a59bced7d9c7f`. Native is current source after AK #6700. `test/legacy-quality-catalog.test.mjs` asserts the rows that `observations.json` recorded at that pin: the nine operator fixtures and the CRAP probe rows. The other operator rows were compared by reading legacy `packages/ts-mutate/src/mutations.ts` at the pin; native scenario tests cover them, but no recorded legacy oracle does.

## Mutation operators (U4, G2)

| Legacy operator | Native site | Status |
|---|---|---|
| `+`→`-`, `-`→`+` | same | match (already) |
| `*`→`/` | same | match (new) |
| `<`↔`<=`, `>`↔`>=` | same | match (already) |
| `===`↔`!==` | same | match (already) |
| `==`↔`!=` | same | match (new, G2) |
| `&&`↔`\|\|` | same | match (already) |
| `true`↔`false` | same | match (already) |
| `++`↔`--` (prefix and postfix, operator span) | same | match (new) |
| `0`↔`1` | same, except numeric property and destructuring keys | match (new); key exclusion is a native refinement |
| condition inversion in `if`/`?:`/`while`/`do`/`for`: `!(expr)`, `!expr`→`expr` | same | match (new) |
| skip type nodes, interfaces, aliases, type parameters, import types | same, plus `declare` declarations and `.d.ts` files; a class `extends` expression stays mutable because it runs | match (fixed: native used to mutate a boolean in a type alias); `extends` is a native refinement (legacy skipped it) |
| no guard | a replacement that would lex together with its neighbor (`a */* c */ b`, `a-++b`) is skipped | native refinement: such a splice is a different mutant than intended |

All nine operator fixtures in `fixtures.json` now yield the legacy `[start, end, original, replacement]` tuples. Site order follows the AST like legacy; native site ids and result fields are unchanged.

## CRAP inventory, complexity and coverage (U1-U3, G5)

| Probe row | Legacy | Native after S1 | Status |
|---|---|---|---|
| nested-function-complexity | 1 | 1 | match |
| constructor-accessor-discovery | 4 functions | 4 functions | match in count; names are native `constructor:Box`, `get:value`, `set:value`, `method:method` (legacy `Box.get value` names held, G6) |
| ambient-function-discovery | 0 | 0 | match |
| lcov-range-denominator | 100 | 100 | match |
| lcov-duplicate-records | 1 record, 2 lines | 1 record, 2 lines | match |
| missing-coverage-crap | `null` | `2` with `coverageStatus: "missing"` | intentional difference: explicit unknown, scored as uncovered |

Native additions without a legacy row: ambiguous suffix matches, malformed DA records, LCOV lines past the end of the source and functions without instrumented lines all report an explicit `coverageStatus`; a changed function with unknown coverage adds a verdict warning.

## Still held

Unchanged by S1 and held under G6 until a named receiver or an owner discontinuation decision: CRAP and mutation root exports, legacy CLI flags and exit codes (`crap-cli-unknown-option`), flat CRAP JSON (`crap-cli-json-shape`), legacy function names and types. S2-S4 own selection, budgets, navigation and indexes.
