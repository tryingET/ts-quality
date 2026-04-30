---
summary: "Adoption evidence: runtime-trace-insights can emit runtime trace bundles from observed commands."
read_when:
  - "Reviewing dependency-intelligence corridor adoption evidence."
  - "Checking whether runtime-trace-insights can produce runtime-trace-bundle.v1 without manual bridge files."
type: "evidence"
---

# Runtime trace bundle command — 2026-04-30

## Purpose

This slice closes the weakest seam discovered by the first `designmd-foundry` pilot: runtime-trace-insights now has a command path that records an observed command and emits a `runtime-trace-insights.runtime-trace-bundle.v1` artifact.

Boundary preserved:

```text
static importance != runtime observation != removal authority
```

Observed package declarations are command-level evidence context, not removal authority and not full application runtime coverage.

## Repo changed

### runtime-trace-insights

- Repo: `/home/tryinget/ai-society/softwareco/owned/runtime-trace-insights`
- Commit: `acf33c4 feat: emit runtime trace bundles from commands`
- Changed files:
  - `README.md`
  - `docs/project/runtime-trace-bundle-contract.md`
  - `package.json`
  - `scripts/run_record_runtime_tests.mjs`
  - `scripts/runtime_trace_bundle.mjs`
  - `src/index.mjs`
  - `src/runtime_trace_bundle/index.mjs`
  - `src/runtime_trace_bundle/runtime_trace_bundle_flow.mjs`
  - `tests/runtime_trace_bundle_command.test.mjs`

## New operator path

```bash
node scripts/runtime_trace_bundle.mjs record <project-path> \
  --observed-package <name[@version]> \
  --out out/runtime-trace-insights/runtime-trace-bundle.json \
  -- <observed-command...>
```

Example:

```bash
node scripts/runtime_trace_bundle.mjs record /path/to/designmd-foundry \
  --observed-package @typescript/native-preview \
  --out /tmp/designmd-depintel-pilot/runtime/designmd-foundry-runtime-bundle.json \
  -- npm run typecheck
```

The command:

1. runs the existing runtime-record flow;
2. writes the lower-level runtime trace artifact;
3. resolves package versions from the target repo's `package.json` when possible;
4. writes a `runtime-trace-insights.runtime-trace-bundle.v1` bundle;
5. prints a compact operator summary with the authority reminder.

## Verification

### runtime-trace-insights repo verification

```bash
cd /home/tryinget/ai-society/softwareco/owned/runtime-trace-insights
bash scripts/ci/full.sh
npm test
git diff --check
git status --short --branch
```

Results:

```text
rocs validate: OK
runtime-record-tests: ok (5 files)
git diff --check: pass
## main
```

## Real-pilot replay on designmd-foundry using the new command

A new non-git pilot workspace was created:

```text
/tmp/designmd-depintel-pilot-rti-command/
```

The corridor was run end-to-end:

```bash
cd /home/tryinget/ai-society/softwareco/contrib/gardener
uv run --python 3.12 python -m gardener.main_cli \
  /home/tryinget/ai-society/softwareco/owned/designmd-foundry \
  -o /tmp/designmd-depintel-pilot-rti-command/gardener/designmd-foundry \
  -l typescript,javascript \
  --minimal-outputs

cd /tmp/designmd-depintel-pilot-rti-command
node /home/tryinget/ai-society/softwareco/owned/runtime-trace-insights/scripts/runtime_trace_bundle.mjs record \
  /home/tryinget/ai-society/softwareco/owned/designmd-foundry \
  --observed-package @typescript/native-preview \
  --out runtime/designmd-foundry-runtime-bundle.json \
  --run-id designmd-typecheck-rti-command \
  -- npm run typecheck

node /home/tryinget/ai-society/softwareco/owned/dep-diet/scripts/depdiet.mjs analyze \
  /home/tryinget/ai-society/softwareco/owned/designmd-foundry \
  --gardener-output gardener/designmd-foundry_dependency_analysis.json \
  --runtime-bundle runtime/designmd-foundry-runtime-bundle.json \
  --out-depmodel depmodel/designmd-foundry.depmodel.v1.json \
  --compact

node /home/tryinget/ai-society/softwareco/owned/dep-viz/scripts/render_depmodel_report.mjs \
  --model depmodel/designmd-foundry.depmodel.v1.json \
  --out depviz/designmd-foundry-static-runtime-report.html
```

Observed command output:

```text
Runtime trace bundle: runtime/designmd-foundry-runtime-bundle.json
Observed packages: 1
Authority: evidence context, not removal authority.
```

Dep-diet fusion output:

```text
Static/runtime evidence: confirmed=1 runtime-only=0 declared-unobserved=2 static-central-unobserved=0 ambiguous=0.
Authority: evidence context, not removal authority.
```

Rendered report:

```text
/tmp/designmd-depintel-pilot-rti-command/depviz/designmd-foundry-static-runtime-report.html
```

Resulting observed package:

```json
{
  "name": "@typescript/native-preview",
  "ecosystem": "npm",
  "packageId": "npm:@typescript/native-preview@7.0.0-dev.20260421.2",
  "version": "7.0.0-dev.20260421.2",
  "moduleId": "js:designmd-foundry",
  "observed": true,
  "evidence": {
    "kind": "runtime-command-observation",
    "sourcePath": "package.json#devDependencies.@typescript/native-preview",
    "commandLine": "npm run typecheck"
  }
}
```

Depmodel summary:

```json
{
  "staticRuntimeConfirmed": 1,
  "staticCentralUnobserved": 0,
  "runtimeOnly": 0,
  "declaredUnobserved": 2,
  "ambiguousEvidence": 0
}
```

Operational note: Gardener's `uv.lock` was again touched by `uv run`; it was reverted. Gardener ended clean.

## Next recommended slice

Wire dep-diet's static/runtime how-tos to prefer the runtime-trace-insights bundle command for real-repo pilots, replacing the manual runtime-bundle staging language where appropriate.
