---
summary: "Third outside-repo adoption pilot attempting the public ts-quality 0.2.0 compact-diagnostics loop against pi-server."
read_when:
  - "When checking whether the public 0.2.0 adoption loop actually exposed doctor --machine"
  - "When deciding the next release-verification hardening slice after the stale public-contract finding"
type: "evidence"
---

# Third outside-repo adoption pilot: public 0.2.0 compact diagnostics

## Scope

This pilot selected the same real outside repo used for the previous LCOV/witness rerun so the new variable would be the public `0.2.0` package contract rather than target-repo unfamiliarity:

```text
/home/tryinget/ai-society/softwareco/owned/pi-server
```

The source repo was read for setup context and copied to a temporary working directory. The source repo was not mutated.

```text
/tmp/ts-quality-piserver-020-pilot-09IOAr
```

Changed slice selected for the pilot:

```text
changed file: src/command-classification.ts
focused target proof: dist/test-command-classification.js after build
expected witness scope: piserver.command-classification.safe-defaults / unknown-mutates-known-readonly
```

## Public-package attempt

The intended first command for the compact agent setup path was:

```bash
npx --yes --package ts-quality@0.2.0 --min-release-age=0 ts-quality doctor --machine
```

It failed immediately:

```text
unknown option --machine
```

The public registry confirms the `0.2.0` tarball was built from the release commit before compact machine diagnostics landed on `main`:

```json
{
  "version": "0.2.0",
  "gitHead": "d0de351c491931dd1833242a66d8d5ec33b0d123"
}
```

The plain public `doctor` command did exist, but the compact protocol needed by harnessed LLMs did not:

```bash
npx --yes --package ts-quality@0.2.0 --min-release-age=0 ts-quality doctor --changed src/command-classification.ts
```

Relevant output:

```text
ts-quality doctor
config: not loaded (No ts-quality config found in /tmp/ts-quality-piserver-020-pilot-09IOAr)
changed scope: src/command-classification.ts
coverage lcovPath: coverage/lcov.info (missing)
coverage.generateCommand: not configured
Recommendations:
- Configure coverage.generateCommand to create coverage/lcov.info, for example node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=coverage/lcov.info.
- Coverage risk: changed src/**/*.ts files and built runtime roots are present. Enable source-map coverage mapping, for example NODE_OPTIONS=--enable-source-maps, or configure coverage to map back to src/**.
- Candidate focused test command: npm run build:js -- --runInBand (adjust to the smallest trustworthy slice).
```

## Finding

The public `0.2.0` pilot could not validate the advertised compact-diagnostics adoption path because `doctor --machine` was unreleased. That is a release-contract gap, not a target-repo adoption failure.

The attempt also exposed a doctor recommendation smell already present on `main`: script discovery ranked `build:js` as a test candidate because the build script text mentions test source files. For pi-server, that makes the focused-test recommendation less useful than `npm run test` or the previously proven module-level `dist/test-command-classification.js` command.

## Product slice created by the finding

The follow-up hardening is intentionally narrower than a new feature:

1. Public release verification must fail closed when a critical advertised CLI subcommand is absent from the tarball.
2. The publish workflow and local `release:verify-public` must verify both:
   - `ts-quality --help`
   - `ts-quality doctor --machine --changed src/index.ts` starts with `TSQ_DOCTOR_MACHINE_V1`
3. Doctor script ranking should prefer script names that explicitly match `test` / `coverage` before scripts whose command bodies merely mention those words, and it should not append Jest-only `--runInBand` to generic Node test scripts.
4. Product posture should distinguish public `0.2.0` truth from unreleased `main` truth until the next package is published.

## Closure signal

This pilot does not close the outside-repo compact-diagnostics proof. It closes a more upstream release-readiness gap: the next public release cannot pass the repo's own public verifier unless the compact doctor protocol is actually present in the published package.

The next outside-repo adoption pilot should use the first public release after this hardening and restart from:

```bash
npx --yes --package ts-quality@<next-version> --min-release-age=0 ts-quality doctor --machine --changed src/command-classification.ts
```
