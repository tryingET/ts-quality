---
summary: "External dogfood run: dep-diet mapping quality slice using local ts-quality after adoption/retention hardening."
read_when:
  - "Reviewing external adoption evidence for ts-quality dogfood runs."
  - "Investigating target-repo setup pitfalls around temp copies, node_modules symlinks, or retention output."
type: "evidence"
---

# dep-diet external dogfood run — 2026-04-30

## Target and slice

- Target repo source: `/home/tryinget/ai-society/softwareco/owned/dep-diet`
- Execution mode: temp copy only; no target-repo commit or source mutation.
- Temp run root: `/tmp/tsq-dogfood-depdiet-zSnTRV`
- ts-quality CLI: local repo `dist/packages/ts-quality/src/cli.js` after `adopt --from-run` and `retention` work.
- Changed slice: `src/domain/mappingQuality.mjs`
- Focused test: `tests/mapping_quality_checks.test.mjs`
- Run id: `depdiet-mapping-quality-dogfood`

## Control-plane shape

The dogfood run used a one-slice `ts-quality.config.json` with:

- source scope: `src/domain/**/*.mjs`
- test scope: `tests/mapping_quality_checks.test.mjs`
- LCOV generation: `node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=coverage/lcov.info tests/mapping_quality_checks.test.mjs`
- mutation baseline: `node --test tests/mapping_quality_checks.test.mjs`
- changed file: `src/domain/mappingQuality.mjs`
- invariant: `mapping.quality.scll`
- witness: `.ts-quality/witnesses/mapping-quality-scll.json`

## Commands and receipts

```bash
node dist/packages/ts-quality/src/cli.js doctor \
  --root /tmp/tsq-dogfood-depdiet-zSnTRV \
  --changed src/domain/mappingQuality.mjs \
  --machine

node dist/packages/ts-quality/src/cli.js retention \
  --root /tmp/tsq-dogfood-depdiet-zSnTRV \
  --machine

node dist/packages/ts-quality/src/cli.js witness test \
  --root /tmp/tsq-dogfood-depdiet-zSnTRV \
  --invariant mapping.quality.scll \
  --scenario invalid-mappings-fail-dimensions \
  --source-files src/domain/mappingQuality.mjs \
  --test-files tests/mapping_quality_checks.test.mjs \
  --out .ts-quality/witnesses/mapping-quality-scll.json \
  -- node --test tests/mapping_quality_checks.test.mjs

node dist/packages/ts-quality/src/cli.js check \
  --root /tmp/tsq-dogfood-depdiet-zSnTRV \
  --changed src/domain/mappingQuality.mjs \
  --run-id depdiet-mapping-quality-dogfood
```

## Result

```json
{
  "outcome": "pass",
  "mergeConfidence": 100,
  "mutation": {
    "killed": 3,
    "survived": 0,
    "errors": 0,
    "sites": 3
  },
  "coverage": {
    "files": 3,
    "changedFunctionMin": 87.23
  },
  "nextEvidenceAction": "none",
  "sidecarSufficiency": "turnkey"
}
```

The run produced execution-backed invariant support for `mapping.quality.scll`, consumed the focused witness, generated LCOV, killed all measured mutants, and emitted no blocking next-evidence action.

## Adoption/retention observations

`doctor --machine` was useful as the first compact setup packet: it identified the loaded config, explicit changed scope, missing LCOV with configured generator, focused test candidate, witness command shape, and artifact-retention recommendation.

`retention --machine` was useful after the witness/check run because it separated:

- reusable files to keep: `ts-quality.config.json`, control-plane files, and `.ts-quality/witnesses/mapping-quality-scll.json`
- generated or ephemeral files to ignore: `.ts-quality/runs/`, `.ts-quality/latest.json`, `.ts-quality/mutation-manifest.json`, `coverage/lcov.info`, witness receipt sidecars, and private key material

This validates the retention projection as an adoption follow-up to the earlier `adopt --from-run` materializer.

## Harness pitfall discovered

The first temp-copy attempt symlinked the target repo's `node_modules` directory into the temp root. Mutation setup failed with:

```text
EISDIR: illegal operation on a directory, read
```

Stack inspection showed the failure came from mutation workspace fingerprinting trying to digest the `node_modules` symlink as a file. Replacing the root symlink with a minimal copied dependency directory (`node_modules/zod`) resolved the dogfood run.

This is a target-harness pitfall and likely a product hardening candidate: repo file discovery / mutation fingerprinting should avoid following or digesting directory symlinks even when the symlink name is otherwise excluded as `node_modules`.

## Follow-up candidate

Create a bounded product task to harden mutation workspace repo-file fingerprinting around symlinked excluded directories, especially `node_modules` symlinks common in package-manager workflows.
