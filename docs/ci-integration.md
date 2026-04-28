---
summary: "Recommended CI sequence for building evidence and running ts-quality checks."
read_when:
  - "When wiring ts-quality into CI"
  - "When checking prerequisites for meaningful automated runs"
type: "how-to"
---

# CI integration

Typical CI steps:

```bash
npm run build --silent
npm run typecheck --silent
npm run lint --silent
node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=coverage/lcov.info
npm run witness:refresh --silent
node dist/packages/ts-quality/src/cli.js check --root fixtures/governed-app
```

Notes:

- `npm run witness:refresh --silent` is the repo-native CI/operator surface for pre-refreshing configured execution witnesses against the current changed scope before `check`. If you prefer one command, run `npm run check:with-witnesses --silent` after build/test coverage prerequisites are in place.
- witness commands declared on invariant scenarios do **not** need to repeat `sourceFiles`; `check`/`witness refresh` infer that scope from the impacted invariant slice automatically. Keep the witness command/test-file details in the invariants file and the surrounding config/path rules in `docs/config-reference.md`.
- `ts-quality check` is strongest when `coverage/lcov.info` exists before the run. If CI does not produce LCOV as a separate step, configure `coverage.generateCommand` so `check` creates the LCOV parent directory, runs the repo-local coverage command when the LCOV file is missing, fails closed on generation errors, and records the generation receipt in `run.json` plus `coverage-generation.json` / `coverage-generation.txt` sidecars.
- For TypeScript projects that execute built output, make source-map coverage explicit (for example `NODE_OPTIONS=--enable-source-maps`) so LCOV maps changed `src/**/*.ts` files instead of only `dist/**` / `lib/**` / `build/**`; otherwise `check` will warn that built-output coverage exists without changed-source coverage.
- Mutation testing uses `mutations.testCommand`; keep that command deterministic and repo-local.
- Invariant evidence is focused to aligned test files, so use explicit names/imports or `requiredTestPatterns`.

Then, if needed:

```bash
node dist/packages/ts-quality/src/cli.js attest sign --root . --issuer ci.verify --key-id ci.verify --private-key .ts-quality/keys/ci.verify.pem --subject .ts-quality/runs/<run-id>/verdict.json --claims ci.tests.passed --out .ts-quality/attestations/ci.tests.passed.json
node dist/packages/ts-quality/src/cli.js authorize --root . --agent release-bot
```
