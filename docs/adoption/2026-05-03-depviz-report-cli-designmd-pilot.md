---
summary: "Adoption evidence: dep-viz report CLI materializes and serves the full dependency-intelligence report from a dep-diet depmodel."
read_when:
  - "Reviewing dependency-intelligence corridor adoption evidence."
  - "Checking whether dep-viz has a real CLI path for existing depmodel.v1 artifacts."
  - "Following up on OpenPencil/designmd dependency tree pilots."
type: "evidence"
---

# dep-viz report CLI and designmd pilot — 2026-05-03

## Purpose

This slice closed the architecture mismatch where the dependency-intelligence plan named a `depviz report --model ...` command but the shipped path was still a Node helper script.

Boundary preserved:

```text
static importance != runtime observation != removal authority
```

The CLI materializes the full dep-viz report app from a `depmodel.v1` artifact and optionally serves it. It does not make static/runtime evidence into prune/remove authority.

## Repo changes

### dep-diet

- Repo: `/home/tryinget/ai-society/softwareco/owned/dep-diet`
- Commit: `ef33b06 fix: use review-safe static runtime signals`
- Purpose:
  - renamed review-signal vocabulary away from removal-suggestive `dead-branch` wording;
  - uses `declared-unobserved-review` and `ambiguous-review` as review/posture signals separate from raw evidence classifications;
  - keeps `authority.removalAuthority: false` intact.

### dep-viz

- Repo: `/home/tryinget/ai-society/softwareco/owned/dep-viz`
- Commit: `a1d453c feat: add depmodel report command`
- Purpose:
  - added real Go CLI support for:

    ```bash
    depviz report --model <depmodel.v1.json> --out <report-dir> [--open]
    depviz report --model <depmodel.v1.json> --out <report-dir> --render-only
    ```

  - materializes the embedded full report app without relying on the Node helper as the primary operator path;
  - keeps `depviz serve` as the serving implementation after materialization.

### ts-quality

- Repo: `/home/tryinget/ai-society/softwareco/owned/ts-quality`
- Commit: `c702d9a docs: align dependency intelligence CLI architecture`
- Purpose:
  - aligned the architecture evidence doc with the shipped report-directory CLI shape.

## OpenPencil target discovery

A local search for a source OpenPencil workspace/package containing the pasted large dependency manifest did not find such a repo under the current local workspace. The only local OpenPencil-related owned target found was:

```text
/home/tryinget/ai-society/softwareco/owned/designmd-foundry/package.json
```

That repo depends on the published `@open-pencil/cli@0.11.6`, so the pilot below proves the installed designmd/OpenPencil-adjacent tree, not the larger pasted OpenPencil workspace manifest.

## Pilot command path

Generated artifacts were kept out of git under:

```text
/tmp/designmd-depintel-cli-pilot/
```

The pilot ran:

```bash
# static evidence
cd /home/tryinget/ai-society/softwareco/contrib/gardener
uv run --python 3.12 python -m gardener.main_cli \
  /home/tryinget/ai-society/softwareco/owned/designmd-foundry \
  -o /tmp/designmd-depintel-cli-pilot/gardener/designmd-foundry \
  -l typescript,javascript \
  --minimal-outputs

# runtime command observation
cd /tmp/designmd-depintel-cli-pilot
node /home/tryinget/ai-society/softwareco/owned/runtime-trace-insights/scripts/runtime_trace_bundle.mjs record \
  /home/tryinget/ai-society/softwareco/owned/designmd-foundry \
  --observed-package @typescript/native-preview \
  --out runtime/designmd-foundry-runtime-bundle.json \
  --run-id designmd-typecheck-report-cli \
  -- npm run typecheck

# depmodel production
node /home/tryinget/ai-society/softwareco/owned/dep-diet/scripts/depdiet.mjs analyze \
  /home/tryinget/ai-society/softwareco/owned/designmd-foundry \
  --gardener-output gardener/designmd-foundry_dependency_analysis.json \
  --runtime-bundle runtime/designmd-foundry-runtime-bundle.json \
  --out-depmodel depmodel/designmd-foundry.depmodel.v1.json \
  --compact

# full report app materialization through the new Go CLI
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
go run ./cmd/depviz report \
  --model /tmp/designmd-depintel-cli-pilot/depmodel/designmd-foundry.depmodel.v1.json \
  --out /tmp/designmd-depintel-cli-pilot/depviz/report \
  --render-only
```

The serve path was also smoke-tested on a non-default port:

```bash
timeout 3s go run ./cmd/depviz report \
  --model /tmp/designmd-depintel-cli-pilot/depmodel/designmd-foundry.depmodel.v1.json \
  --out /tmp/designmd-depintel-cli-pilot/depviz/report-served \
  --port 7789
```

Observed result:

```text
depviz serve: serving /tmp/designmd-depintel-cli-pilot/depviz/report-served
depviz serve: listening on http://127.0.0.1:7789/
depviz serve: press Ctrl+C to stop
depviz serve: shutting down
depviz report serve accepted and was timeout-stopped
```

## Pilot result

The dep-diet compact output reported:

```text
Static/runtime evidence: confirmed=1 runtime-only=0 declared-unobserved=60 static-central-unobserved=0 ambiguous=0.
Review signals: hidden-root=0 declared-unobserved-review=60 critical-soil=0 risky-core=0 ambiguous-review=0.
Authority: Static/runtime evidence is context for review, not standalone removal permission.
```

Depmodel summary:

```json
{
  "packages": 61,
  "edges": 67,
  "introducerPaths": 61,
  "lockfilePackageCount": 61,
  "reviewSignals": {
    "hiddenRoot": 0,
    "declaredUnobservedReview": 60,
    "criticalSoil": 0,
    "riskyCore": 0,
    "ambiguousEvidence": 0
  }
}
```

The full dependency tree includes a transitive OpenPencil path down to a leaf:

```json
[
  "npm:@open-pencil/cli@0.11.6",
  "npm:canvaskit-wasm@0.40.0",
  "npm:@webgpu/types@0.1.21"
]
```

Report artifacts were materialized at:

```text
/tmp/designmd-depintel-cli-pilot/depviz/report/index.html
/tmp/designmd-depintel-cli-pilot/depviz/report/assets/report/main.js
```

## Verification

### dep-diet

```bash
node --test tests/static_runtime_evidence_corridor.test.mjs tests/integration_analyze_contract.test.mjs
npm test
git diff --check
```

Result:

```text
12 pass / 0 fail
ci-targeted: ok (29 files)
git diff --check: pass
```

The targeted docs strict check over changed owned docs passed. A broader `docs/project` strict check still reports the pre-existing unrelated `docs/project/gardener-integration-spike.md` missing-front-matter issue.

### dep-viz

```bash
go test ./...
npm test
bash scripts/ci/full.sh
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
git diff --check
```

Result:

```text
go test ./...: pass
npm test: 88 pass / 0 fail
rocs validate: OK
docs strict: pass
git diff --check: pass
```

### ts-quality

```bash
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
git diff --check
```

Result:

```text
Strict check: pass
git diff --check: pass
```

## Next follow-up

To prove the larger dependency list the operator pasted, the actual OpenPencil source workspace/package still needs to be present locally or supplied as a path. Once available, rerun the same corridor against that repo and inspect whether its lockfile format is npm `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, or a workspace lockfile that requires a new dep-diet reader.
