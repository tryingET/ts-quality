---
summary: "Adoption evidence: dependency-intelligence corridor run against cloned open-pencil with bun.lock full-tree support."
read_when:
  - "Reviewing dependency-intelligence corridor adoption evidence."
  - "Checking OpenPencil full dependency tree results."
  - "Reviewing bun.lock support in dep-diet static/runtime depmodels."
type: "evidence"
---

# OpenPencil dependency-intelligence pilot — 2026-05-03

## Purpose

The operator asked to clone the real OpenPencil source repo and run the dependency-intelligence corridor against it.

Target cloned locally:

```text
/home/tryinget/ai-society/softwareco/contrib/open-pencil
```

Clone source:

```text
https://github.com/open-pencil/open-pencil
```

Boundary preserved:

```text
static importance != runtime observation != removal authority
```

## Repo change needed before the pilot

OpenPencil uses Bun:

```text
bun.lock
```

The previous dep-diet lockfile enrichment only walked npm `package-lock.json`. To make the OpenPencil run truthful, dep-diet was extended to read Bun lockfiles and workspace package dependencies.

Changed repo:

```text
/home/tryinget/ai-society/softwareco/owned/dep-diet
```

Commit:

```text
db87218 feat: read bun lockfile dependency trees
```

What this adds:

- parses `bun.lock` with trailing commas;
- reads root workspace dependencies;
- reads `workspaces` entries such as `packages/cli`, `packages/core`, `packages/vue`, `packages/mcp`, and `packages/docs`;
- reads Bun `packages` entries and dependency metadata;
- emits package nodes, edges, introducer paths, and lockfile metadata for Bun projects;
- keeps lockfile evidence static-only and non-authoritative for removal.

## Pilot workspace

Generated artifacts were kept out of git:

```text
/tmp/open-pencil-depintel-pilot/
```

Key outputs:

```text
/tmp/open-pencil-depintel-pilot/gardener/open-pencil_dependency_analysis.json
/tmp/open-pencil-depintel-pilot/runtime/open-pencil-runtime-bundle.json
/tmp/open-pencil-depintel-pilot/depmodel/open-pencil.depmodel.v1.json
/tmp/open-pencil-depintel-pilot/depviz/report
```

## Commands

### Static evidence

```bash
cd /home/tryinget/ai-society/softwareco/contrib/gardener
uv run --python 3.12 python -m gardener.main_cli \
  /home/tryinget/ai-society/softwareco/contrib/open-pencil \
  -o /tmp/open-pencil-depintel-pilot/gardener/open-pencil \
  -l typescript,javascript \
  --minimal-outputs
```

Gardener result summary:

```text
Found 764 source files, 6 total manifest files (1 at root)
Found 97 unique external packages
Dependency graph built with 1177 nodes and 3800 edges
```

Top static dependencies included:

```text
vue
canvaskit-wasm
bun:test
nanoevents
@playwright/test
@vueuse/core
culori
yoga-layout
agentfmt
vite
reka-ui
trystero
@ai-sdk/anthropic
@ai-sdk/google
@ai-sdk/openai
```

### Runtime bundle input

No install/runtime command was run for this pilot. To avoid falsely claiming runtime package observations, the runtime bundle was a zero-observation placeholder with an explicit diagnostic:

```text
OpenPencil pilot used static Gardener evidence plus bun.lock full-tree enrichment only; no runtime package observations were claimed.
```

This is intentionally weaker than command-level runtime evidence. It is still useful for proving the full static lockfile dependency tree and dep-viz report path.

### Depmodel production

```bash
cd /tmp/open-pencil-depintel-pilot
node /home/tryinget/ai-society/softwareco/owned/dep-diet/scripts/depdiet.mjs analyze \
  /home/tryinget/ai-society/softwareco/contrib/open-pencil \
  --gardener-output gardener/open-pencil_dependency_analysis.json \
  --runtime-bundle runtime/open-pencil-runtime-bundle.json \
  --out-depmodel depmodel/open-pencil.depmodel.v1.json \
  --compact
```

Compact output:

```text
Analyze ../../home/tryinget/ai-society/softwareco/contrib/open-pencil: 113 findings, 113 packages, 81 edges, 81 introducer paths.
Report: out/depdiet/analyze/report.json
Depmodel: depmodel/open-pencil.depmodel.v1.json
Static/runtime evidence: confirmed=0 runtime-only=0 declared-unobserved=1398 static-central-unobserved=4 ambiguous=0.
Review signals: hidden-root=0 declared-unobserved-review=1398 critical-soil=0 risky-core=4 ambiguous-review=0.
Authority: Static/runtime evidence is context for review, not standalone removal permission.
```

The first line is the regular dep-diet analyze finding summary. The static/runtime evidence line is the enriched depmodel evidence summary and reflects all lockfile packages.

### Dep-viz report

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
go run ./cmd/depviz report \
  --model /tmp/open-pencil-depintel-pilot/depmodel/open-pencil.depmodel.v1.json \
  --out /tmp/open-pencil-depintel-pilot/depviz/report \
  --render-only
```

Result:

```text
depviz report: wrote /tmp/open-pencil-depintel-pilot/depviz/report
```

## Depmodel result

```json
{
  "packages": 1402,
  "edges": 3254,
  "introducerPaths": 1402,
  "lockFiles": ["bun.lock"],
  "lockfilePackageCount": 1402,
  "lockfileEdgeCount": 3254
}
```

Static/runtime summary:

```json
{
  "staticRuntimeConfirmed": 0,
  "staticCentralUnobserved": 4,
  "runtimeOnly": 0,
  "declaredUnobserved": 1398,
  "ambiguousEvidence": 0,
  "reviewSignals": {
    "hiddenRoot": 0,
    "declaredUnobservedReview": 1398,
    "criticalSoil": 0,
    "riskyCore": 4,
    "ambiguousEvidence": 0
  },
  "authorityNote": "Static/runtime evidence is context for review, not standalone removal permission."
}
```

Sample package IDs from the pasted dependency set:

```json
[
  { "name": "@ai-sdk/anthropic", "packageId": "npm:@ai-sdk/anthropic@3.0.64" },
  { "name": "@open-pencil/cli", "packageId": "npm:@open-pencil/cli@0.11.8" },
  { "name": "@open-pencil/core", "packageId": "npm:@open-pencil/core@0.11.8" },
  { "name": "@open-pencil/vue", "packageId": "npm:@open-pencil/vue@0.11.8" },
  { "name": "trystero", "packageId": "npm:trystero@0.22.0" },
  { "name": "zod", "packageId": "npm:zod@4.3.6" },
  { "name": "yoga-layout", "packageId": "npm:yoga-layout@3.3.0-grid.3" }
]
```

Example deep transitive paths proving the tree is walked past direct dependencies:

```json
[
  "npm:vite-plugin-pwa@1.2.0",
  "npm:workbox-build@7.4.0",
  "npm:@surma/rollup-plugin-off-main-thread@2.2.3",
  "npm:string.prototype.matchall@4.0.12",
  "npm:es-abstract@1.24.1",
  "npm:typed-array-byte-offset@1.0.4",
  "npm:reflect.getprototypeof@1.0.10",
  "npm:which-builtin-type@1.2.1",
  "npm:is-async-function@2.1.1",
  "npm:async-function@1.0.0"
]
```

```json
[
  "npm:trystero@0.22.0",
  "npm:firebase@12.11.0",
  "npm:@firebase/firestore@4.13.0",
  "npm:@grpc/proto-loader@0.7.15",
  "npm:yargs@17.7.2",
  "npm:cliui@8.0.1",
  "npm:wrap-ansi@7.0.0",
  "npm:ansi-styles@4.3.0",
  "npm:color-convert@2.0.1",
  "npm:color-name@1.1.4"
]
```

## Verification

### dep-diet

```bash
node --test tests/integration_analyze_contract.test.mjs tests/static_runtime_evidence_corridor.test.mjs
npm test
bash scripts/ci/full.sh
git diff --check
```

Result:

```text
13 pass / 0 fail
ci-targeted: ok (29 files)
rocs validate: OK
git diff --check: pass
```

### Report artifact check

```text
/tmp/open-pencil-depintel-pilot/depviz/report/index.html
/tmp/open-pencil-depintel-pilot/depviz/report/assets/report/main.js
```

Both files exist.

## Interpretation

This pilot proves the dependency-intelligence corridor can now walk OpenPencil's `bun.lock` dependency tree to leaves and render it through dep-viz.

It does **not** prove runtime coverage because no OpenPencil command was executed with runtime package observations. The `declared-unobserved` count is therefore expected and means "not observed by this zero-observation runtime bundle," not "safe to remove."
