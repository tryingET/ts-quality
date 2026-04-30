---
summary: "LLM-facing next evidence closure prompt for one ts-quality run."
read_when:
  - "When an agent needs to close the next evidence gap for this run"
  - "When turning ts-quality evidence into a bounded repair task"
type: "handoff"
---

# Next Evidence Closure

Primary action: Tighten focused assertions for 3 surviving mutant(s) across 3 mutation group(s).
Kind: mutation-survivors
Why: Surviving mutants mean existing tests executed but did not distinguish changed behavior from a mutated implementation.
Expected confidence lift if closed: +54

## Evidence basis
- Coverage: present; files 2; changed-function min 100%; changed functions under80 0
- Mutation: 1/4 killed; 3 survived; 0 errors
- Witness: missing-or-not-required
- Governance: errors; errors 2; warnings 0
- Confidence: 6/100

## Edit targets
- test/token.test.js

## Evidence targets
- src/auth/token.js

## Steps
1. Add a boundary assertion around src/auth/token.js:2; this mutant changed >= to >.
   - rationale: This mutation group changed >= to >; the focused test command still passed.
   - edit: test/token.test.js
   - run: node --test
2. Assert the combined-condition case around src/auth/token.js:8; this mutant changed && to ||.
   - rationale: This mutation group changed && to ||; the focused test command still passed.
   - edit: test/token.test.js
   - run: node --test
3. Assert the combined-condition case around src/auth/token.js:7; this mutant changed && to ||.
   - rationale: This mutation group changed && to ||; the focused test command still passed.
   - edit: test/token.test.js
   - run: node --test

## Completion criteria
- Add assertions that fail for each listed surviving mutation group.
- Rerun the focused test command and then ts-quality check for the same changed scope.
- The next run reports zero surviving mutants for this scope.

## Not the problem
- coverage is present; changed functions under 80% coverage: 0
