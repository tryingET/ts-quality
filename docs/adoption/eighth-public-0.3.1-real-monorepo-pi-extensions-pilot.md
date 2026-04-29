---
summary: "Public ts-quality@0.3.1 real pi-extensions monorepo adoption pilot."
read_when:
  - "When checking whether the 0.3 public package works against an actual owned monorepo instead of a synthetic fixture."
  - "When investigating why high LCOV coverage can still produce lower merge confidence."
type: "evidence"
---

# Public 0.3.1 real pi-extensions monorepo adoption pilot

## Purpose

Verify that the published `ts-quality@0.3.1` package can run against an actual owned monorepo shape, not only a synthetic fixture.

The target was a temp copy of `../pi-extensions`, focused on the real nested package `packages/pi-provenance`.

This pilot intentionally answers the adoption concern raised after the synthetic monorepo pilot: a synthetic workspace proves the contract mechanics, but an actual repo is the stronger proof of adoption friction, package attribution, LCOV generation, mutation pressure, and authorization behavior.

## Environment

- Package: `ts-quality@0.3.1`
- Source repo copied from: `/home/tryinget/ai-society/softwareco/owned/pi-extensions`
- Temp repo: `/tmp/ts-quality-031-pi-extensions-real-pf5aXa`
- Copy method: `rsync` temp copy excluding `.git`, `node_modules`, `.pi-subagent-sessions`, and `artifacts`
- Run id: `pilot-031-pi-extensions-real`
- Fresh-release npm setting: `NPM_CONFIG_MIN_RELEASE_AGE=0`
- Local `ts-quality` source checkout was not used for CLI execution.
- The live `pi-extensions` checkout was not mutated.

## Target repo shape

Actual package slice:

```text
packages/pi-provenance/package.json        # name: @tryinget/pi-provenance
packages/pi-provenance/src/provenance-core.js
packages/pi-provenance/tests/provenance-core.test.mjs
ts-quality.config.json                     # temp-copy pilot config
.ts-quality/invariants.ts                  # temp-copy pilot invariant
.ts-quality/constitution.ts                # temp-copy pilot controls
.ts-quality/agents.ts                      # temp-copy pilot authorization grant
```

Behavior slice:

- changed file: `packages/pi-provenance/src/provenance-core.js`
- nested package: `@tryinget/pi-provenance`
- invariant: `pi.provenance.assistant-message-minimality`
- scenario: `minimal-fields-no-content`

The invariant asserted that assistant-message provenance must keep provider/model/api/session identity without copying raw assistant content into provenance artifacts.

## Relevant config

```json
{
  "sourcePatterns": ["packages/pi-provenance/src/**/*.js"],
  "testPatterns": ["packages/pi-provenance/tests/**/*.mjs"],
  "coverage": {
    "lcovPath": "coverage/pi-provenance.lcov.info",
    "generateCommand": [
      "node",
      "--test",
      "--experimental-test-coverage",
      "--test-reporter=lcov",
      "--test-reporter-destination=coverage/pi-provenance.lcov.info",
      "packages/pi-provenance/tests/provenance-core.test.mjs"
    ]
  },
  "mutations": {
    "testCommand": ["node", "--test", "packages/pi-provenance/tests/provenance-core.test.mjs"],
    "coveredOnly": true,
    "timeoutMs": 15000,
    "maxSites": 8
  },
  "policy": {
    "maxChangedCrap": 40,
    "minMutationScore": 0,
    "minMergeConfidence": 70
  },
  "changeSet": { "files": ["packages/pi-provenance/src/provenance-core.js"] }
}
```

The authorization grant used the same `minMergeConfidence: 70` floor for `release-bot` on `packages/pi-provenance/src/**`.

## Commands exercised

```bash
export NPM_CONFIG_MIN_RELEASE_AGE=0

npx -y -p ts-quality@0.3.1 ts-quality doctor \
  --config ts-quality.config.json \
  --machine \
  --changed packages/pi-provenance/src/provenance-core.js

npx -y -p ts-quality@0.3.1 ts-quality witness test \
  --invariant pi.provenance.assistant-message-minimality \
  --scenario minimal-fields-no-content \
  --source-files packages/pi-provenance/src/provenance-core.js \
  --test-files packages/pi-provenance/tests/provenance-core.test.mjs \
  --out .ts-quality/witnesses/pi-provenance-minimal-fields-no-content.json \
  -- node --test packages/pi-provenance/tests/provenance-core.test.mjs

npx -y -p ts-quality@0.3.1 ts-quality check \
  --config ts-quality.config.json \
  --changed packages/pi-provenance/src/provenance-core.js \
  --run-id pilot-031-pi-extensions-real

npx -y -p ts-quality@0.3.1 ts-quality report --run-id pilot-031-pi-extensions-real
npx -y -p ts-quality@0.3.1 ts-quality explain --run-id pilot-031-pi-extensions-real
npx -y -p ts-quality@0.3.1 ts-quality govern --run-id pilot-031-pi-extensions-real
npx -y -p ts-quality@0.3.1 ts-quality authorize --agent release-bot --run-id pilot-031-pi-extensions-real
```

## Result summary

```json
{
  "packageSpec": "ts-quality@0.3.1",
  "runId": "pilot-031-pi-extensions-real",
  "outcome": "fail",
  "mergeConfidence": 66,
  "changedFiles": [
    "packages/pi-provenance/src/provenance-core.js"
  ],
  "filePackages": [
    {
      "filePath": "packages/pi-provenance/src/provenance-core.js",
      "packageName": "@tryinget/pi-provenance"
    }
  ],
  "coverage": [
    {
      "filePath": "packages/pi-provenance/src/provenance-core.js",
      "pct": 96,
      "coveredLines": 96,
      "totalLines": 100
    }
  ],
  "evidenceSemantics": "execution-backed",
  "supportKind": "execution-witness",
  "supported": true,
  "changedFunctionsUnder80Coverage": 0,
  "mutationSitesInScope": 8,
  "killedMutantsInScope": 4,
  "survivingMutantsInScope": 4,
  "authorize": {
    "outcome": "require-human-approver",
    "reasons": [
      "Merge confidence 66 is below grant minimum 70."
    ],
    "evidenceRunId": "pilot-031-pi-extensions-real",
    "runOutcome": "fail",
    "mergeConfidence": 66
  }
}
```

`check` output:

```text
Merge confidence: 66/100
Outcome: fail
Coverage generation: pass -> coverage/pi-provenance.lcov.info
Artifacts: /tmp/ts-quality-031-pi-extensions-real-pf5aXa/.ts-quality/runs/pilot-031-pi-extensions-real
```

## LCOV proof

`check` generated LCOV through `coverage.generateCommand`:

```text
coverage/pi-provenance.lcov.info
```

The LCOV mapped to the real package source file:

```text
SF:packages/pi-provenance/src/provenance-core.js
FNF:10
FNH:10
LF:100
LH:96
```

`run.json` normalized this to:

```json
{
  "filePath": "packages/pi-provenance/src/provenance-core.js",
  "pct": 96,
  "coveredLines": 96,
  "totalLines": 100
}
```

No changed function was under the 80% coverage threshold:

```text
changed functions under 80% coverage: 0
```

Representative changed-function evidence:

```text
function:buildAssistantMessageProvenance (... coverage 96.55%, CRAP 7)
function:extractLatestAssistantMessageProvenance (... coverage 90%, CRAP 4.02)
```

## Why confidence was 66 despite high coverage

This run is a useful real-repo counterexample to treating merge confidence as a coverage percentage.

Coverage was strong:

- file coverage: `96%`
- changed functions below 80% coverage: `0`
- coverage-pressure signal: clear

Merge confidence still fell to `66/100` because mutation pressure was not clean:

```text
mutation scope: 8 site(s), 4 killed, 4 survived
```

Confidence breakdown:

```text
base 100
-24 Surviving mutants penalty
-10 Risky invariant/residual pressure penalty
final 66
```

Blocked reasons included:

```text
Merge confidence 66 below minimum 70
Surviving mutant in packages/pi-provenance/src/provenance-core.js
Invariant pi.provenance.assistant-message-minimality is at-risk
```

So the public package correctly separated:

- LCOV coverage: present and high
- execution witness: present and consumed
- package attribution: present
- mutation adequacy: insufficient
- merge authorization: requires human approval

## Findings

### Confirmed

- The public package can run against an actual owned monorepo temp copy without using local `ts-quality` source.
- `doctor --machine` emitted the compact `TSQ_DOCTOR_MACHINE_V1` packet for the real repo slice.
- `coverage.generateCommand` generated real LCOV for `packages/pi-provenance/src/provenance-core.js`.
- The run artifact attributed the changed file to nested package `@tryinget/pi-provenance`.
- The manual witness was consumed as execution-backed evidence for the invariant scenario.
- `report --run-id` and `explain --run-id` rendered the selected public-package run.
- `govern --run-id` produced useful next-step guidance even though there were no configured governance-rule findings.
- `authorize --agent release-bot --run-id ...` refused automation approval under the configured `70` confidence floor and returned `require-human-approver`.

### Real adoption friction surfaced

- The real package has high LCOV but still fails the merge-confidence gate because mutation pressure found surviving mutants.
- The compact `check` stdout reports the LCOV path but not the coverage percentage, so an operator can reasonably ask why confidence is low or high without immediately seeing the coverage basis.
- File-level changed scope made all functions in `provenance-core.js` part of the changed-function pressure. A real PR/diff integration should prefer narrower changed-region evidence when available.

## Product follow-up candidates

1. Surface a compact evidence-basis line in `check` stdout or `check-summary.txt`, for example:

   ```text
   Coverage: packages/pi-provenance/src/provenance-core.js 96%, changed functions under80 0
   Mutation: 4 killed / 8 sites, 4 survived
   ```

2. Add a public walkthrough section explaining that merge confidence is not coverage percentage; it is `100` minus deterministic penalties from mutation, CRAP, invariant, governance, waiver, and authorization-relevant signals.
3. Add a real-repo negative-path adoption example showing that high coverage plus execution witnesses can still require human review when mutation pressure survives.

## Conclusion

The actual `pi-extensions` pilot is more valuable than the synthetic monorepo pilot because it produced a truthful negative-path result:

- LCOV existed and was high.
- Package attribution worked.
- Manual witness consumption worked.
- Public report/explain/govern/authorize surfaces worked.
- Merge confidence correctly dropped to `66/100` because mutation testing found four surviving mutants.

This should become the representative real-world adoption example for explaining why `ts-quality` treats coverage as one evidence layer, not the merge-confidence score itself.
