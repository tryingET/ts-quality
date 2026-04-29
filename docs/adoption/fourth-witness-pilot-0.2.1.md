---
summary: "Fourth outside-repo adoption pilot using public ts-quality 0.2.1 against pi-server."
read_when:
  - "When checking whether the 0.2.1 compact doctor diagnostics are public and usable"
  - "When prioritizing follow-up after the public 0.2.1 adoption pilot"
type: "evidence"
---

# Fourth outside-repo adoption pilot: public 0.2.1 compact diagnostics

## Scope

This pilot used the public package `ts-quality@0.2.1` against a temporary copy of:

```text
/home/tryinget/ai-society/softwareco/owned/pi-server
```

The source repo was read for setup context and copied to:

```text
/tmp/ts-quality-piserver-021-pilot-mSW1eU
```

The source repo was not mutated.

Changed slice:

```text
changed file: src/command-classification.ts
focused target proof: dist/test-command-classification.js after build
invariant: piserver.command-classification.safe-defaults
scenario: unknown-mutates-known-readonly
```

## First-contact doctor result

The public package now exposes the compact machine protocol:

```bash
npx --yes --package ts-quality@0.2.1 --min-release-age=0 ts-quality doctor --machine --changed src/command-classification.ts
```

Key output:

```text
TSQ_DOCTOR_MACHINE_V1
config	error	message=No ts-quality config found in /tmp/ts-quality-piserver-021-pilot-mSW1eU
changed	ok	files=src/command-classification.ts
coverage	missing	lcovPath=coverage/lcov.info	generateCommand=none
recommend	coverage	coverage-generate-command	Configure coverage.generateCommand to create coverage/lcov.info.	command_arg=node	command_arg=--test	command_arg=--experimental-test-coverage	command_arg=--test-reporter=lcov	command_arg=--test-reporter-destination=coverage/lcov.info
recommend	focused-test	focused-test-command	Candidate focused test command: npm run test (adjust to the smallest trustworthy slice).	command_arg=npm	command_arg=run	command_arg=test
recommend	witness	witness-command-shape	Candidate witness command shape: ts-quality witness test --invariant <id> --scenario <id> --source-files <src> --test-files <test> --out .ts-quality/witnesses/<id>.json -- <focused command>	command_arg=ts-quality	command_arg=witness	command_arg=test	...
```

This closes the public `0.2.0` drift: compact diagnostics and repeated `command_arg=` fields are visible from npm, not just from `main`.

## Setup and bounded check

The pilot installed target dependencies, built the target, initialized with the TypeScript/dist preset, and then configured a bounded review for `src/command-classification.ts`.

The important target-specific config choices were:

```ts
coverage: {
  lcovPath: 'coverage/lcov.info',
  generateCommand: [
    'node', '--enable-source-maps', '--test', '--experimental-test-coverage',
    '--test-reporter=lcov', '--test-reporter-destination=coverage/lcov.info',
    'dist/test-command-classification.js'
  ],
  generateTimeoutMs: 60000
},
mutations: {
  testCommand: ['node', '--experimental-vm-modules', 'dist/test-command-classification.js'],
  coveredOnly: true,
  timeoutMs: 60000,
  maxSites: 8,
  runtimeMirrorRoots: ['dist']
},
changeSet: { files: ['src/command-classification.ts'] }
```

The first bounded check passed coverage generation and produced actionable mutation guidance:

```bash
npx --yes --package ts-quality@0.2.1 --min-release-age=0 ts-quality check --run-id piserver-021-before-witness
npx --yes --package ts-quality@0.2.1 --min-release-age=0 ts-quality explain --run-id piserver-021-before-witness
```

Key output:

```text
Coverage generation: pass -> coverage/lcov.info
Merge confidence: 23/100 (fail)
Next evidence action: Add or tighten an assertion covering src/command-classification.ts around the surviving mutant.
Remaining blocker: mutation-pressure
Actionable surviving mutants:
- src/command-classification.ts:85 false -> true
- src/command-classification.ts:86 true -> false
```

## Witness path result

A manual `witness test` command successfully wrote a pass witness artifact and receipt:

```bash
npx --yes --package ts-quality@0.2.1 --min-release-age=0 ts-quality witness test \
  --invariant piserver.command-classification.safe-defaults \
  --scenario unknown-mutates-known-readonly \
  --source-files src/command-classification.ts \
  --test-files src/test-command-classification.ts \
  --out .ts-quality/witnesses/command-classification-safe-defaults.json \
  -- node --experimental-vm-modules --input-type=module -e "...assertions..."
```

However, a follow-up `check` did **not** upgrade the scenario to execution-backed support from the manually-created witness alone. The run still reported deterministic lexical evidence and missing scenario support.

Configuring the same scenario with `executionWitnessCommand`, `executionWitnessOutput`, `executionWitnessTestFiles`, and `executionWitnessTimeoutMs` allowed `check` to auto-run and recognize the witness:

```text
Execution witnesses: auto-ran 1, skipped 0
Evidence semantics: execution-backed witness artifacts matched the invariant scenario scope
scenario results: unknown-mutates-known-readonly=execution-backed witness matched
```

The final run still failed truthfully because mutation pressure remained below budget:

```text
Merge confidence: 23/100 (fail)
Remaining blocker: mutation-pressure
mutation: 2 surviving mutant(s); tighten focused assertions
coverage: coverage evidence present
witness: execution-backed witness considered
```

## What worked

- Public `ts-quality@0.2.1` exposes `doctor --machine`.
- Public `doctor --machine` starts with `TSQ_DOCTOR_MACHINE_V1`.
- Public `doctor --machine` emits repeated `command_arg=` fields for exact command guidance.
- `init --preset node-test-ts-dist` provided useful TypeScript/dist starter guidance.
- Configured LCOV generation mapped coverage back to `src/command-classification.ts` with source maps.
- `next-evidence-action.txt` and `mutation-remediation.json` pointed to the true remaining blocker: surviving mutants, not coverage or witness setup.
- Scenario-configured execution witnesses were auto-run and recognized by `check`.

## Remaining gap found

Manual `witness test --out .ts-quality/witnesses/...` created a valid pass witness artifact, but `check` did not consume it unless the scenario also declared an execution witness path/command for auto-run.

That is adoption-sensitive because the README quickstart teaches the manual witness habit before rerunning `check`. The next product slice should either:

1. make `check` discover matching manually-created `.ts-quality/witnesses/*.json` artifacts by invariant id, scenario id, pass status, and source scope; or
2. make the docs and CLI wording explicit that `check` only considers scenario-configured execution witnesses.

The better product behavior is option 1: manual focused witnesses should become first-class evidence without requiring config duplication.

## Production-readiness implication

`0.2.1` successfully fixes the compact public diagnostics gap and proves the public package can guide a target repo from setup diagnostics to generated coverage, mutation remediation, and execution-backed witness evidence.

The next high-leverage patch is not another release-contract fix; it is making the manual witness habit match the documented adoption path.

## Follow-up status

Task `#1938` closes this pilot gap on `main`: `check` now discovers matching pass witnesses under `.ts-quality/witnesses/**/*.json` by invariant id, scenario id, and impacted source scope, while ignoring sibling receipt sidecars. The next public proof should verify the manual `witness test` -> `check` upgrade from the next released package in a target repo.
