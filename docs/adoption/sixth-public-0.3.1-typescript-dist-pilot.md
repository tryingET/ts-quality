---
summary: "Public ts-quality@0.3.1 TypeScript dist-backed adoption pilot."
read_when:
  - "When checking whether the 0.3 public contract baseline works for TypeScript repos whose tests execute dist output."
  - "When planning source-map coverage or runtime-mirror adoption for TypeScript targets."
type: "evidence"
---

# Public 0.3.1 TypeScript dist-backed adoption pilot

## Purpose

Verify that the published `ts-quality@0.3.1` package can run the minimum adoption story in a fresh TypeScript target where tests execute built `dist/**` output while `ts-quality` screens authored `src/**/*.ts` files.

This is the next target shape after the tiny JavaScript pilot in `docs/adoption/fifth-public-0.3.1-minimum-adoption-pilot.md`.

Minimum story under test:

1. `doctor --machine --changed <src slice>` gives a compact setup packet.
2. A manual `witness test` artifact is written for the authored source slice.
3. `check --run-id <id>` generates LCOV through `coverage.generateCommand`, maps coverage back to `src/**`, consumes the manual witness, and evaluates mutation pressure against the dist-backed test command.
4. `report --run-id <id>` and `explain --run-id <id>` project the selected run.

## Environment

- Package: `ts-quality@0.3.1`
- Temp repo: `/tmp/ts-quality-031-ts-dist-pilot-lCdscm`
- Run id: `pilot-031-ts-dist`
- Fresh-release npm setting: `NPM_CONFIG_MIN_RELEASE_AGE=0`
- Local ts-quality source checkout was not used for CLI execution.

## Target repo shape

Tiny TypeScript repo:

```text
src/auth/token.ts
test/token.test.mjs
tsconfig.json
ts-quality.config.json
.ts-quality/invariants.ts
.ts-quality/constitution.ts
.ts-quality/agents.ts
.ts-quality/{approvals,waivers,overrides}.json
```

Tests import built runtime:

```js
import { canUseRefreshToken } from '../dist/auth/token.js';
```

The TypeScript build enables source maps:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "sourceMap": true,
    "strict": true
  }
}
```

The coverage command enables source-map remapping:

```json
{
  "scripts": {
    "build": "npx -y -p typescript tsc -p tsconfig.json",
    "coverage:slice": "mkdir -p coverage && npm run build --silent && NODE_OPTIONS=--enable-source-maps node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=coverage/lcov.info test/token.test.mjs",
    "test:auth-token": "npm run build --silent && NODE_OPTIONS=--enable-source-maps node --test test/token.test.mjs"
  }
}
```

Relevant `ts-quality.config.json` shape:

```json
{
  "sourcePatterns": ["src/**/*.ts"],
  "testPatterns": ["test/**/*.mjs"],
  "coverage": {
    "lcovPath": "coverage/lcov.info",
    "generateCommand": ["npm", "run", "coverage:slice", "--silent"]
  },
  "mutations": {
    "testCommand": ["npm", "run", "test:auth-token", "--silent"],
    "coveredOnly": false,
    "timeoutMs": 20000,
    "maxSites": 4,
    "runtimeMirrorRoots": ["dist"]
  },
  "changeSet": { "files": ["src/auth/token.ts"] }
}
```

## Commands exercised

```bash
export NPM_CONFIG_MIN_RELEASE_AGE=0

npx -y -p ts-quality@0.3.1 ts-quality doctor \
  --config ts-quality.config.json \
  --machine \
  --changed src/auth/token.ts

npx -y -p ts-quality@0.3.1 ts-quality witness test \
  --invariant auth.refresh.validity \
  --scenario expired-boundary \
  --source-files src/auth/token.ts \
  --test-files test/token.test.mjs \
  --out .ts-quality/witnesses/auth-refresh-expired-boundary.json \
  -- npm run test:auth-token --silent

npx -y -p ts-quality@0.3.1 ts-quality check \
  --config ts-quality.config.json \
  --changed src/auth/token.ts \
  --run-id pilot-031-ts-dist

npx -y -p ts-quality@0.3.1 ts-quality report --run-id pilot-031-ts-dist
npx -y -p ts-quality@0.3.1 ts-quality explain --run-id pilot-031-ts-dist
```

## Result summary

```json
{
  "packageSpec": "ts-quality@0.3.1",
  "runId": "pilot-031-ts-dist",
  "outcome": "pass",
  "mergeConfidence": 100,
  "changedFiles": [
    "src/auth/token.ts"
  ],
  "coverageFiles": [
    "src/auth/token.ts"
  ],
  "analysisWarnings": [],
  "evidenceSemantics": "execution-backed",
  "supportKind": "execution-witness",
  "supported": true,
  "witnessFiles": [
    ".ts-quality/witnesses/auth-refresh-expired-boundary.json"
  ],
  "autoRanExecutionWitnesses": false,
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
Artifacts: /tmp/ts-quality-031-ts-dist-pilot-lCdscm/.ts-quality/runs/pilot-031-ts-dist
```

## Findings

### Confirmed

- The public package supports the same minimum adoption story when tests execute `dist/**` output.
- With `sourceMap: true` and `NODE_OPTIONS=--enable-source-maps`, Node's LCOV output mapped back to `src/auth/token.ts`.
- `analysisWarnings` stayed empty; the source-map coverage risk did not trigger because changed-source coverage was present.
- `coverage.generateCommand` successfully generated LCOV during `check`.
- The manual witness was consumed as execution-backed evidence for the authored source slice.
- `runtimeMirrorRoots: ["dist"]` plus a build-before-test command allowed mutation pressure to work against the dist-backed runtime test path.
- `report --run-id` and `explain --run-id` rendered the selected run from the public package.

### Remaining caution

This was still a tiny TypeScript repo. Larger TypeScript repos may have multi-package builds, custom loaders, test runners, or coverage reporters that need repo-specific wrapper scripts. The source-map principle held in this pilot: keep screening on authored `src/**`, build before dist-backed tests, and enable source-map coverage remapping.

## Conclusion

The public `0.3.1` package passes the minimum adoption story for a TypeScript repo whose tests execute built `dist/**` output while evidence remains anchored to authored `src/**/*.ts` files.

The next adoption pilots should cover monorepo package boundaries and weaker/partial coverage targets.
