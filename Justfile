# Standardized softwareco/owned command surface (softwareco/owned/docs/project/standardized-justfile-contract.md).
# Thin delegation: the npm scripts stay the validation owners, and `npm run verify` stays the root gate.
# fmt: omitted because no formatter is configured in this repo; formatting is not part of the validation contract.
# dev: omitted because the repo has no long-running dev, watch or server mode.

# List the supported targets.
help:
    @just --list

# Default test suite (builds first).
test:
    npm test --silent

# Fast local gate: script typecheck, lint, then the test suite (which builds and typechecks the packages).
check:
    npm run typecheck:scripts --silent
    npm run lint --silent
    npm test --silent

# Compile the packages into dist/.
build:
    npm run build --silent

# Repository lint rules.
lint:
    npm run lint --silent

# Full local CI gate: the root verify contract (install, build, typechecks, lint, tests, samples, smoke, packaging).
ci:
    npm run verify --silent

# Toolchain and workspace diagnostic (not a validation pass).
doctor:
    npm run loop-doctor --silent

# Run the built ts-quality CLI once, for example: just run check --changed src/a.ts --run-id review-001
run *args:
    node dist/packages/ts-quality/src/cli.js {{args}}

# repo-loop-validation-v1 phases (scripts/loop-phase.mjs owns their semantics).

# Loop phase: diagnostic.
loop-doctor:
    npm run loop-doctor --silent

# Loop phase: fast verification.
loop-verify-fast:
    npm run loop-verify-fast --silent

# Loop phase: impact plan.
loop-impact-plan:
    npm run loop-impact-plan --silent

# Loop phase: impact run.
loop-impact-run:
    npm run loop-impact-run --silent

# Loop phase: wide impact.
loop-impact-wide:
    npm run loop-impact-wide --silent

# Loop phase: landing check.
loop-landing-check:
    npm run loop-landing-check --silent
