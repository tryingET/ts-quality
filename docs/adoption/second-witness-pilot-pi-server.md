---
summary: "Second outside-repo first-witness pilot using published ts-quality against a temp copy of pi-server."
read_when:
  - "When evaluating repeated outside-repo first-witness adoption evidence"
  - "When prioritizing the next production-readiness friction after the designmd-foundry pilot"
type: "evidence"
---

# Second outside-repo first-witness pilot: pi-server

## Scope

This pilot used the public package `ts-quality@0.1.7` against a temporary copy of:

```text
/home/tryinget/ai-society/softwareco/owned/pi-server
```

The source repo was read for routing and setup context, but was not mutated. The pilot copy lived under `/tmp/ts-quality-piserver-pilot-*`.

Routing assumption: `pi-server` was selected as a second real TypeScript/Node target repo outside `ts-quality`, distinct from the first `designmd-foundry` pilot and still avoiding Prompt Vault / pi-extensions implementation work.

## Commands exercised

Prepared the target repo copy and proved its focused module test independently:

```bash
npm install
npm run build
node --experimental-vm-modules dist/test-command-classification.js
```

Installed and invoked the public package with the same fresh-release npm age-gate bypass used in the first pilot:

```bash
npm install --save-dev ts-quality@0.1.7 --min-release-age=0
npx --yes --package ts-quality@0.1.7 --min-release-age=0 ts-quality init
```

Configured a bounded review for one changed source file:

```text
changed file: src/command-classification.ts
focused test: src/test-command-classification.ts
invariant: piserver.command-classification.safe-defaults
scenario: unknown-mutates-known-readonly
```

Ran the pre-witness review:

```bash
npx --yes --package ts-quality@0.1.7 --min-release-age=0 ts-quality check --run-id piserver-pilot-before-witness-2
npx --yes --package ts-quality@0.1.7 --min-release-age=0 ts-quality explain --run-id piserver-pilot-before-witness-2
```

Generated a focused execution witness:

```bash
npx --yes --package ts-quality@0.1.7 --min-release-age=0 ts-quality witness test \
  --invariant piserver.command-classification.safe-defaults \
  --scenario unknown-mutates-known-readonly \
  --source-files src/command-classification.ts \
  --test-files src/test-command-classification.ts \
  --out .ts-quality/witnesses/command-classification-safe-defaults.json \
  -- node --experimental-vm-modules --input-type=module -e "import assert from 'node:assert'; import { isMutationCommand, isReadOnlyCommand, isShortTimeoutCommand } from './dist/command-classification.js'; assert.strictEqual(isMutationCommand('unknown_command'), true); assert.strictEqual(isReadOnlyCommand('get_state'), true); assert.strictEqual(isShortTimeoutCommand('get_state'), true);"
```

Reran the review after witness generation:

```bash
npx --yes --package ts-quality@0.1.7 --min-release-age=0 ts-quality check --run-id piserver-pilot-with-witness
npx --yes --package ts-quality@0.1.7 --min-release-age=0 ts-quality explain --run-id piserver-pilot-with-witness
```

## What worked

- Public `ts-quality@0.1.7` ran in a second non-`ts-quality` TypeScript repo.
- A bounded check over `src/command-classification.ts` produced run artifacts and explain output.
- The focused module test was a better target-repo proof command than the full `npm test`, which prints success but leaves process handles open long enough to be awkward for adoption automation.
- `witness test` generated both:
  - `.ts-quality/witnesses/command-classification-safe-defaults.json`
  - `.ts-quality/witnesses/command-classification-safe-defaults.receipt.json`
- The second check recognized the witness and upgraded the selected scenario to execution-backed support.
- The post-witness `check-summary.txt` showed:

```text
Evidence semantics: execution-backed witness artifacts matched the invariant scenario scope
Evidence provenance: explicit 6, inferred 0, missing 0
```

## What remained red for target-repo truth

The target review still failed, truthfully, because the selected source slice had unresolved product evidence pressure:

- no LCOV file was present, so changed-function coverage was 0%;
- `getCommandTimeoutPolicy` exceeded the configured CRAP budget;
- governance still reported the risk-budget failure.

Mutation pressure was strong in this pilot: the sampled mutation run killed 6 mutants with 0 survivors.

## Adoption friction observed

1. The local operator npm configuration again required `--min-release-age=0` for the freshly published package.
2. `ts-quality init` could create starter files, but for this repo the better review command was a module-level test (`dist/test-command-classification.js`) rather than full `npm test`; fresh operators need a discoverable way to select that command.
3. The first attempt to write `.ts-quality/invariants.ts` before ensuring `.ts-quality/` existed failed; this is operator error, but it shows that docs should keep the `init`/directory precondition obvious.
4. Public `0.1.7` still used pre-mitigation post-witness wording: the witness was recognized, but the high-level reason text still said the invariant needed stronger test evidence. The local follow-up in `0b4e59f` adds a clearer residual-pressure note, but a future release should validate the improved wording in the same kind of outside-repo pilot.

## Production-readiness implication

This second pilot strengthens the production-readiness evidence: the bounded-review plus focused-witness habit works in two distinct real TypeScript repos from the published package.

The next product slice should make target-repo proof-command selection more discoverable, especially the difference between a repo-global test command, a module-level proof command, and a source-mode TypeScript witness command.
