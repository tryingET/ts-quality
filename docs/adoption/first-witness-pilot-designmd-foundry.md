---
summary: "First outside-repo first-witness pilot using published ts-quality against a temp copy of designmd-foundry."
read_when:
  - "When evaluating production-readiness evidence for outside-repo first-witness adoption"
  - "When choosing the next adoption-friction reduction slice"
type: "evidence"
---

# First outside-repo first-witness pilot: designmd-foundry

## Scope

This pilot used the public package `ts-quality@0.1.7` against a temporary copy of:

```text
/home/tryinget/ai-society/softwareco/owned/designmd-foundry
```

The source repo was read for routing and setup context, but was not mutated. The pilot copy lived under `/tmp/ts-quality-designmd-pilot-*`.

Routing assumption: `designmd-foundry` was selected as a real TypeScript/Node target repo outside `ts-quality`, while avoiding Prompt Vault / pi-extensions and unrelated repos.

## Commands exercised

Installed the public package in the pilot copy, bypassing the operator's local npm age gate only for this fresh release:

```bash
npm install --save-dev ts-quality@0.1.7 --min-release-age=0
npx --min-release-age=0 ts-quality --help
npx --min-release-age=0 ts-quality init
```

Configured a bounded review for one changed source file:

```text
changed file: src/core/schemas.ts
focused test: tests/regressions.test.ts
invariant: designmd.activity-schema.validation
scenario: valid-check-activity-and-invalid-kind
```

Ran the pre-witness review:

```bash
npm test
npx --min-release-age=0 ts-quality check --run-id designmd-pilot-before-witness
npx --min-release-age=0 ts-quality explain --run-id designmd-pilot-before-witness
npx --min-release-age=0 ts-quality report --run-id designmd-pilot-before-witness
```

Generated a focused execution witness:

```bash
npx --min-release-age=0 ts-quality witness test \
  --invariant designmd.activity-schema.validation \
  --scenario valid-check-activity-and-invalid-kind \
  --source-files src/core/schemas.ts \
  --test-files tests/regressions.test.ts \
  --out .ts-quality/witnesses/activity-schema-validation.json \
  -- node --disable-warning=ExperimentalWarning --experimental-strip-types --input-type=module -e "import assert from 'node:assert/strict'; import { validateActivityRequestBody } from './src/core/schemas.ts'; assert.deepEqual(validateActivityRequestBody({ kind: 'check', source: 'pi', message: 'Validated', detail: 'npm test' }), { kind: 'check', source: 'pi', message: 'Validated', detail: 'npm test' }); assert.throws(() => validateActivityRequestBody({ kind: 'debug', message: 'Nope' }), /kind must be one of/);"
```

Reran the review after witness generation:

```bash
npx --min-release-age=0 ts-quality check --run-id designmd-pilot-with-witness
npx --min-release-age=0 ts-quality explain --run-id designmd-pilot-with-witness
```

## What worked

- Public `ts-quality@0.1.7` installed and ran in a non-`ts-quality` TypeScript repo.
- Top-level help exposed the first bounded-review and first focused-witness path.
- `init` created the expected starter config/control-plane files.
- A bounded check over `src/core/schemas.ts` produced run artifacts and projected explain/report output.
- `witness test` generated both:
  - `.ts-quality/witnesses/activity-schema-validation.json`
  - `.ts-quality/witnesses/activity-schema-validation.receipt.json`
- The second check recognized the witness and upgraded scenario support from deterministic lexical support to execution-backed support.
- The post-witness `check-summary.txt` showed all invariant evidence provenance modes as explicit:

```text
Evidence semantics: execution-backed witness artifacts matched the invariant scenario scope
Evidence provenance: explicit 6, inferred 0, missing 0
```

## What remained red for target-repo truth

The target review still failed, truthfully, because the selected source slice had unresolved product evidence pressure:

- no LCOV file was present, so changed-function coverage was 0%;
- the sampled mutation run reported 2 killed and 4 surviving mutants;
- `validateVariantPatchRequestBody` exceeded the configured CRAP budget.

This is a good product signal: the witness lane can upgrade one invariant scenario without hiding unrelated coverage, mutation, and complexity gaps.

## Adoption friction observed

1. The local operator npm configuration applied an age gate to the freshly published package; the pilot needed `--min-release-age=0` to install `0.1.7` immediately.
2. The default `init` mutation command (`node --test`) was not right for this repo; the operator had to know to switch it to `npm test` and cap mutation sites.
3. The witness command was precise but long, especially for a TypeScript source-mode repo requiring Node type stripping flags.
4. The invariant/explain output correctly showed execution-backed support after the witness, but high-level reason text still said the invariant needed stronger evidence because mutation/coverage pressure remained. That wording may confuse first-time operators.

## Production-readiness implication

This pilot partially closes the first outside-repo adoption gap: the published package can run the bounded-review plus focused-witness habit against a real TypeScript repo without mutating that repo.

It does not yet prove broad production adoption. The next product slice should reduce the observed setup friction, especially target-repo test-command discovery, witness command ergonomics, and post-witness summary wording when execution support is present but other evidence pressure remains.

## Follow-up mitigation landed

The immediate follow-up reduced two pilot frictions:

- `witness test --help` now explicitly recommends moving long TypeScript/source-mode proof commands into a repo-local npm script and invoking that script after `--`.
- Concise invariant provenance now adds an explicit post-witness note when execution-backed support is present but other risk pressure remains, for example:

```text
Execution witness is present; remaining risk comes from coverage-pressure, mutation-pressure.
```

That wording keeps the witness success visible without hiding truthful coverage, mutation, or complexity gaps.
