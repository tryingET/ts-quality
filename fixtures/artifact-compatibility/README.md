---
summary: "Checked-in run-artifact compatibility fixtures for parser and projection tests."
read_when:
  - "You are changing run artifact schema compatibility fixtures or parser tests."
  - "You need concrete legacy/additive/fail-closed run packet examples."
type: "reference"
---

# Artifact compatibility fixtures

This directory promotes deterministic `ts-quality` run artifacts into parser fixtures for downstream consumer tests.

Source artifact: `examples/artifacts/governed-app/run.json` (`sample-governed-app-run`). The fixture copies preserve the governed-app evidence shape, then vary only the compatibility condition under test:

- `current-0.2.0.run.json.fixture` — current additive run packet with `controlPlane`, `nextEvidenceAction`, and confidence breakdown.
- `legacy-0.1.0-no-additive.run.json.fixture` — legacy-shaped packet with newer additive fields removed.
- `future-additive-0.2.0.run.json.fixture` — current packet with unknown future optional fields added.
- `next-evidence-minimal-0.2.0.run.json.fixture` — current packet with recent optional next-evidence actionability fields removed.
- `unsupported-control-plane.run.json.fixture` — packet that must fail closed for decision projections.
- `malformed-control-plane.run.json.fixture` — packet that must fail closed for decision projections.

`manifest.json` records the expected parser policy. `test/artifact-compatibility-fixtures.test.mjs` verifies both consumer-parser habits and the repo CLI projection behavior against these fixtures.
