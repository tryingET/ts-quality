---
summary: "Real target-shape adoption proof for kinetic-caption-studio: ESM TypeScript, Vitest baseline, focused tsx witness, and artifact compatibility capture."
read_when:
  - "When checking real outside-repo target-shape adoption evidence"
  - "When reviewing artifact compatibility captures from non-fixture target repos"
type: "evidence"
---

# Kinetic Caption Studio Vitest/ESM adoption proof

## Target shape

- Target repo: `softwareco/owned/kinetic-caption-studio` copied into an isolated temp target.
- Shape: clean ESM TypeScript package, Vitest test suite, `tsx` source loader, package scripts for `test`, `check`, `build`, and `ci`.
- Slice: `packages/core/src/segmentation.ts` with the existing `tests/segmentation.test.ts` behavior encoded as a focused `node --import tsx --test` witness/coverage proof.

The source repo worktree was not mutated.

## Public installed-package path exercised

From the isolated target, using the packaged `ts-quality-0.5.0.tgz`:

```bash
ts-quality --version
# 0.5.0

ts-quality doctor --machine --changed packages/core/src/segmentation.ts

ts-quality witness test \
  --invariant segmentation.readable-bursts \
  --scenario lesson-basic-shorts-a2 \
  --source-files packages/core/src/segmentation.ts \
  --test-files .ts-quality/adoption/segmentation-proof.test.ts,tests/segmentation.test.ts \
  --out .ts-quality/witnesses/segmentation-readable-bursts.json \
  -- node --import tsx --test .ts-quality/adoption/segmentation-proof.test.ts

ts-quality check --run-id kinetic-vitest-esm-adoption --changed packages/core/src/segmentation.ts

ts-quality report --run-id kinetic-vitest-esm-adoption
ts-quality explain --run-id kinetic-vitest-esm-adoption
ts-quality retention --machine
```

## Observed outcome

`check` completed with:

- outcome: `pass`
- merge confidence: `90/100`
- coverage generation: `pass -> .ts-quality/adoption/lcov.info`
- mutation: `12 killed / 12 site(s), 0 survived`
- evidence closure: `none`
- execution witness: `.ts-quality/witnesses/segmentation-readable-bursts.json` matched the invariant id, scenario id, pass status, and impacted source scope

The run still surfaced truthful residual pressure:

- `segmentation.readable-bursts` remained `unsupported` rather than overclaimed because one changed function (`toEffectiveCues`) had coverage below 80%.
- This is acceptable product behavior for the slice: the decision passed, but the summary preserved the weakest trust boundary instead of equating high confidence with full proof.

## Compatibility capture

The real target-shape run packet and the minimal support files needed to project it are checked in under:

- `fixtures/artifact-compatibility/real-kinetic-vitest-esm/run.json.fixture`
- `fixtures/artifact-compatibility/real-kinetic-vitest-esm/ts-quality.config.ts`
- `fixtures/artifact-compatibility/real-kinetic-vitest-esm/.ts-quality/*`
- `fixtures/artifact-compatibility/real-kinetic-vitest-esm/packages/core/src/segmentation.ts`

`test/artifact-compatibility-fixtures.test.mjs` proves the captured packet remains projectable through:

- `report --json`
- `explain`
- `plan`
- `govern`
- `authorize`

The authorization projection is intentionally checked as a run-bound denial (`Unknown agent release-bot`) because the captured control-plane snapshot has no `release-bot` grant. This proves selected-run authorization projection compatibility, not accepted automation approval.

This converts one more real adoption run into executable compatibility coverage instead of leaving it as prose-only evidence.
