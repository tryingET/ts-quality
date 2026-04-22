---
summary: "PR-facing summary for a ts-quality run with concise invariant evidence provenance."
read_when:
  - "When pasting a concise ts-quality result into a PR or review surface"
  - "When inspecting the generated summary artifact format"
type: "reference"
---

# ts-quality summary

- Merge confidence: **6/100**
- Outcome: **fail**
- Highest-risk changed hotspot: `src/auth/token.js` function:canUseRefreshToken with CRAP 3
- Surviving mutants: **3**
- Invariant at risk: **auth.refresh.validity**
  - Evidence semantics: deterministic lexical alignment over focused tests; not execution-backed behavioral proof
  - Evidence provenance: explicit 3, inferred 1, missing 1
  - focused-test-alignment [clear; mode=inferred]: 1 focused test file aligned to invariant scope
  - scenario-support [missing; mode=missing]: 0/1 scenario(s) have deterministic lexical support
  - mutation-pressure [warning; mode=explicit]: 3 surviving mutants across 4 mutation sites
- Best next action: Add or tighten an assertion covering src/auth/token.js around the surviving mutant.

## Blocking findings
- Merge confidence 6 below minimum 65
- Mutation score 0.25 is below budget 0.75
- Surviving mutant in src/auth/token.js
- Surviving mutant in src/auth/token.js
- Surviving mutant in src/auth/token.js
- Invariant auth.refresh.validity is at-risk
- Auth code requires stronger evidence because it decides authorization.
- Auth code requires stronger evidence because it decides authorization.
