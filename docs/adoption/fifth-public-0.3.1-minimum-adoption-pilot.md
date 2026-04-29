---
summary: "Public ts-quality@0.3.1 minimum-adoption pilot in a fresh temp repo."
read_when:
  - "When checking whether the 0.3 public contract baseline works from the published package."
  - "When planning the next outside-repo adoption pilot."
type: "evidence"
---

# Public 0.3.1 minimum-adoption pilot

## Purpose

Verify that the published `ts-quality@0.3.1` package can execute the minimum 0.3 adoption story in a fresh external repo without using the local source checkout or maintainer-only repo memory.

Minimum story under test:

1. `doctor --machine --changed <slice>` gives a compact setup packet.
2. A manual `witness test` artifact is written under `.ts-quality/witnesses/`.
3. `check --run-id <id>` consumes the manual witness as execution-backed scenario evidence.
4. `report --run-id <id>` and `explain --run-id <id>` project the selected run.

## Environment

- Package: `ts-quality@0.3.1`
- Temp repo: `/tmp/ts-quality-031-minimum-adoption-efoKUG`
- Run id: `pilot-031-minimum`
- Fresh-release npm setting used by this harness: `NPM_CONFIG_MIN_RELEASE_AGE=0`
- Local ts-quality source checkout was not used for CLI execution.

## Target repo shape

Tiny JavaScript repo:

```text
src/auth/token.js
test/token.test.js
ts-quality.config.json
.ts-quality/invariants.ts
.ts-quality/constitution.ts
.ts-quality/agents.ts
.ts-quality/{approvals,waivers,overrides}.json
```

Behavior slice:

- `src/auth/token.js` exports `canUseRefreshToken(token, now)`.
- Tests cover expired, active, and revoked refresh token behavior.
- Invariant: `auth.refresh.validity` / scenario `expired-boundary`.

## Commands exercised

```bash
export NPM_CONFIG_MIN_RELEASE_AGE=0

npx -y -p ts-quality@0.3.1 ts-quality doctor \
  --config ts-quality.config.json \
  --machine \
  --changed src/auth/token.js

mkdir -p coverage
npm run coverage:slice --silent

npx -y -p ts-quality@0.3.1 ts-quality witness test \
  --invariant auth.refresh.validity \
  --scenario expired-boundary \
  --source-files src/auth/token.js \
  --test-files test/token.test.js \
  --out .ts-quality/witnesses/auth-refresh-expired-boundary.json \
  -- npm run test:auth-token --silent

npx -y -p ts-quality@0.3.1 ts-quality check \
  --config ts-quality.config.json \
  --changed src/auth/token.js \
  --run-id pilot-031-minimum

npx -y -p ts-quality@0.3.1 ts-quality report --run-id pilot-031-minimum
npx -y -p ts-quality@0.3.1 ts-quality explain --run-id pilot-031-minimum
```

## Result summary

```json
{
  "packageSpec": "ts-quality@0.3.1",
  "runId": "pilot-031-minimum",
  "outcome": "pass",
  "mergeConfidence": 100,
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
Artifacts: /tmp/ts-quality-031-minimum-adoption-efoKUG/.ts-quality/runs/pilot-031-minimum
```

## Findings

### Confirmed

- The public package exposes the compact doctor protocol header `TSQ_DOCTOR_MACHINE_V1`.
- `doctor --machine` includes repeated `command_arg=` fields.
- The manual witness was consumed by `check` without scenario-level `executionWitnessCommand` or `executionWitnessOutput` in the invariant config.
- The scenario became `supportKind: "execution-witness"` with `evidenceSemantics: "execution-backed"`.
- `run.executionWitnesses` stayed absent, confirming this was manual witness consumption rather than auto-run witness config.
- `report --run-id` and `explain --run-id` rendered the selected run from the public package.

### Adoption friction observed

- This harness environment required `NPM_CONFIG_MIN_RELEASE_AGE=0` for immediate use of a just-published version. That is release-freshness policy, not a package contract failure.
- Node's LCOV reporter did not create the `coverage/` directory automatically; the pilot needed `mkdir -p coverage` before `npm run coverage:slice`.
- `witness test` does not need `--config`; it binds directly through invariant/scenario/source/test/out flags plus the focused command after `--`.

## Conclusion

The public `0.3.1` package passes the minimum adoption story in a fresh external repo:

```text
doctor --machine -> manual witness -> check -> report/explain by run id
```

The next adoption work should repeat this against more realistic repo shapes: TypeScript source-mode tests, dist-backed TypeScript tests, monorepo package boundaries, and repos with weaker coverage or governance constraints.
