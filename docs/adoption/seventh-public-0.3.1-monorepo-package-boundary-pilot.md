---
summary: "Public ts-quality@0.3.1 monorepo package-boundary adoption pilot."
read_when:
  - "When checking whether the 0.3 public contract baseline works for monorepo package slices."
  - "When planning package-boundary, package attribution, or authorization adoption for target repos."
type: "evidence"
---

# Public 0.3.1 monorepo package-boundary adoption pilot

## Purpose

Verify that the published `ts-quality@0.3.1` package can run the minimum adoption story in a fresh monorepo target while preserving package attribution for a nested package slice.

This follows:

- `docs/adoption/fifth-public-0.3.1-minimum-adoption-pilot.md` — tiny JavaScript repo
- `docs/adoption/sixth-public-0.3.1-typescript-dist-pilot.md` — TypeScript source screened while tests execute `dist/**`

Minimum story under test:

1. `doctor --machine --changed <package slice>` gives a compact setup packet.
2. A manual `witness test` artifact is written for the package-local behavior slice.
3. `check --run-id <id>` generates LCOV through `coverage.generateCommand`, consumes the manual witness, and attributes the changed file to the nested package.
4. `report --run-id <id>` and `explain --run-id <id>` project the selected run.
5. `authorize --agent <agent> --run-id <id>` binds authorization to the selected run and package-scoped grant.

## Environment

- Package: `ts-quality@0.3.1`
- Temp repo: `/tmp/ts-quality-031-monorepo-pilot-doe1Na`
- Run id: `pilot-031-monorepo`
- Fresh-release npm setting: `NPM_CONFIG_MIN_RELEASE_AGE=0`
- Local ts-quality source checkout was not used for CLI execution.

## Target repo shape

Tiny npm-workspace monorepo:

```text
package.json                         # workspaces: ["packages/*"]
packages/api/package.json            # name: api-pkg
packages/api/src/token.js
packages/api/test/token.test.js
packages/web/package.json            # name: web-pkg
packages/web/src/consumer.js
ts-quality.config.json
.ts-quality/invariants.ts
.ts-quality/constitution.ts
.ts-quality/agents.ts
.ts-quality/{approvals,waivers,overrides}.json
```

Behavior slice:

- changed file: `packages/api/src/token.js`
- nested package: `api-pkg`
- invariant: `api.refresh.validity`
- scenario: `expired-boundary`

Relevant root package scripts:

```json
{
  "scripts": {
    "coverage:api": "mkdir -p coverage && node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=coverage/lcov.info packages/api/test/token.test.js",
    "test:api-token": "node --test packages/api/test/token.test.js"
  }
}
```

Relevant `ts-quality.config.json` shape:

```json
{
  "sourcePatterns": ["packages/*/src/**/*.js"],
  "testPatterns": ["packages/*/test/**/*.js"],
  "coverage": {
    "lcovPath": "coverage/lcov.info",
    "generateCommand": ["npm", "run", "coverage:api", "--silent"]
  },
  "mutations": {
    "testCommand": ["npm", "run", "test:api-token", "--silent"],
    "coveredOnly": false,
    "timeoutMs": 10000,
    "maxSites": 4
  },
  "changeSet": { "files": ["packages/api/src/token.js"] }
}
```

The pilot also included:

- a risk rule for `packages/api/src/**`
- a boundary rule forbidding `packages/web/src/**` from importing `packages/api/src/**`
- a `release-bot` grant for `packages/api/src/**`

## Commands exercised

```bash
export NPM_CONFIG_MIN_RELEASE_AGE=0

npx -y -p ts-quality@0.3.1 ts-quality doctor \
  --config ts-quality.config.json \
  --machine \
  --changed packages/api/src/token.js

npx -y -p ts-quality@0.3.1 ts-quality witness test \
  --invariant api.refresh.validity \
  --scenario expired-boundary \
  --source-files packages/api/src/token.js \
  --test-files packages/api/test/token.test.js \
  --out .ts-quality/witnesses/api-refresh-expired-boundary.json \
  -- npm run test:api-token --silent

npx -y -p ts-quality@0.3.1 ts-quality check \
  --config ts-quality.config.json \
  --changed packages/api/src/token.js \
  --run-id pilot-031-monorepo

npx -y -p ts-quality@0.3.1 ts-quality report --run-id pilot-031-monorepo
npx -y -p ts-quality@0.3.1 ts-quality explain --run-id pilot-031-monorepo
npx -y -p ts-quality@0.3.1 ts-quality govern --run-id pilot-031-monorepo
npx -y -p ts-quality@0.3.1 ts-quality authorize --agent release-bot --run-id pilot-031-monorepo
```

## Result summary

```json
{
  "packageSpec": "ts-quality@0.3.1",
  "runId": "pilot-031-monorepo",
  "outcome": "pass",
  "mergeConfidence": 100,
  "changedFiles": [
    "packages/api/src/token.js"
  ],
  "packageName": "api-pkg",
  "evidenceSemantics": "execution-backed",
  "supportKind": "execution-witness",
  "supported": true,
  "witnessFiles": [
    ".ts-quality/witnesses/api-refresh-expired-boundary.json"
  ],
  "autoRanExecutionWitnesses": false,
  "authorizeOutcome": "approve",
  "authorizeRunId": "pilot-031-monorepo",
  "doctorHeader": "TSQ_DOCTOR_MACHINE_V1",
  "doctorHasCommandArg": true,
  "coverageGenerated": true,
  "reportHasHeading": true,
  "explainHasReasons": true
}
```

`check` output:

```text
Merge confidence: 100/100
Outcome: pass
Coverage generation: pass -> coverage/lcov.info
Artifacts: /tmp/ts-quality-031-monorepo-pilot-doe1Na/.ts-quality/runs/pilot-031-monorepo
```

## Findings

### Confirmed

- The public package supports the minimum adoption story in a nested package path.
- The changed file `packages/api/src/token.js` was attributed to nested package `api-pkg`.
- `coverage.generateCommand` worked from the monorepo root while testing only the API package slice.
- The manual witness was consumed as execution-backed evidence for the API package slice.
- `authorize --agent release-bot --run-id pilot-031-monorepo` approved against the exact run and package-scoped grant.
- `report --run-id` and `explain --run-id` rendered the selected run from the public package.

### Observed limitation

The configured risk and boundary rules produced no governance findings because the slice was healthy and did not violate the web-to-api boundary. `govern` therefore did not mention the risk rule as a passed control. That is truthful, but a separate governance/violation pilot is still needed to prove the negative-path operator story for package boundaries.

## Conclusion

The public `0.3.1` package passes the minimum adoption story for a monorepo nested package slice and preserves package attribution in the run evidence packet.

The next adoption pilots should cover:

1. weak/partial coverage or intentionally failing evidence, and
2. an explicit governance boundary violation with `govern` and `authorize` negative-path outputs.
