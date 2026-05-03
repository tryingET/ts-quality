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

## Follow-up duplicate and vulnerability checks

After the initial inventory run, two follow-up checks were performed.

### Duplicate / doublet audit

A raw `bun.lock` audit grouped entries by actual package name and version. Result:

```json
{
  "packageEntries": 1397,
  "actualNames": 1202,
  "multiVersionCount": 86,
  "multiInstanceSameVersionCount": 6
}
```

Top multi-version examples:

```text
commander: 2.20.3, 4.1.1, 5.1.0, 8.3.0
@libp2p/interface: 2.10.4, 2.11.0, 3.1.0
estree-walker: 1.0.1, 2.0.2, 3.0.3
lru-cache: 5.1.1, 10.4.3, 11.2.7
@babel/parser: 7.29.2, 8.0.0-rc.3
semver: 6.3.1, 7.7.4
@vueuse/core: 12.8.2, 14.2.1
```

This is evidence of version-divergence pressure, not a safe-dedupe recommendation. The follow-up `dep-diet` slice completed AK `2091` and made this first-class inventory evidence:

```text
6607567 feat: surface dependency version inventory
```

The generated depmodel now carries `metadata.evidenceCorridor.dependencyInventory` with same-name version groups, lockfile occurrence counts, incoming edge counts, and an explicit inventory-only authority note. Re-running the OpenPencil depmodel after that slice produced:

```json
{
  "packageNameCount": 1208,
  "packageVersionNodeCount": 1299,
  "lockfileOccurrenceCount": 1402,
  "versionDivergentPackageNameCount": 86,
  "repeatedPackageVersionOccurrenceCount": 27
}
```

This keeps package/version nodes and graph edges visible. It does not collapse packages, imply deduplication, or grant prune/removal authority.

### Vulnerability scan

The first dep-viz scan only detected the Rust `desktop` module because dep-viz did not recognize `bun.lock` as a JS module. That bug was fixed in dep-viz:

```text
6a3617f fix: detect bun lockfiles as js modules
```

After that fix, the container-backed dep-viz scan ran:

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
go run ./cmd/depviz scan \
  /home/tryinget/ai-society/softwareco/contrib/open-pencil \
  --container \
  --format json \
  --include-metadata \
  --out /tmp/open-pencil-depintel-pilot/depviz-scan-with-bun
```

Result:

```json
{
  "sbomCount": 2,
  "scanCount": 2,
  "moduleCount": 2,
  "vulnerabilityCount": 6,
  "policy": {
    "effectiveThreshold": "high",
    "violation": false
  }
}
```

Detected modules:

```json
[
  { "moduleId": "js:.", "ecosystem": "js", "lockFiles": ["bun.lock"] },
  { "moduleId": "rust:desktop", "ecosystem": "rust", "lockFiles": ["desktop/Cargo.lock"] }
]
```

Observed Grype findings:

```text
GHSA-wrw7-89jp-8q8g  pkg:cargo/glib@0.18.5  medium  fixed in 0.20.0
GHSA-cq8v-f236-94qc  pkg:cargo/rand@0.7.3   low     fixed in 0.8.6
GHSA-cq8v-f236-94qc  pkg:cargo/rand@0.8.5   low     fixed in 0.8.6
```

The same Cargo findings appeared under both `js:.` and `rust:desktop` in the scan model because the root JS module SBOM is produced from the repository root and includes nested Rust desktop artifacts. This was a dep-viz scan attribution concern, not six distinct vulnerable packages.

The follow-up dep-viz slices completed AK `2093` and the final semantic-model task `2103`:

```text
608b71d fix: prefer nested vulnerability attribution
e97b21a feat: preserve nested vulnerability attribution
```

After those slices, dep-viz keeps the primary vulnerability count on the narrowest nested module and preserves the broader parent observation in `vulnerabilities[].attribution.secondaryModuleAttributions`.

Re-run command:

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
go run ./cmd/depviz scan \
  /home/tryinget/ai-society/softwareco/contrib/open-pencil \
  --out /tmp/open-pencil-depintel-pilot/depviz-scan-semantic-attribution \
  --container \
  --format json
```

Result:

```json
{
  "sbomCount": 2,
  "scanCount": 2,
  "moduleCount": 2,
  "vulnerabilityCount": 3,
  "policy": {
    "effectiveThreshold": "high",
    "violation": false
  }
}
```

Each primary finding is now attributed to `rust:desktop` and preserves a secondary parent attribution for `js:.` with parent finding/reference/provenance IDs. This is vulnerability-count hygiene and traceability preservation only; package nodes, dependency edges, and introducer paths remain uncollapsed.

This scan used Grype's vulnerability database. It was not an independent multi-provider scan across OSV/npm-audit/GitHub Advisory/Snyk.

The follow-up dep-viz slice completed AK `2092`:

```text
87800d5 feat: correlate vulnerability providers
```

Dep-viz now has the depmodel/report semantics needed for multi-provider correlation: same-module/package/vulnerability findings from more than one provider merge into one primary vulnerability with `source: "multi-provider"`, highest normalized severity, combined traceability IDs, and `vulnerabilities[].correlation` metadata (`correlationKey`, `providerCount`, `providers`, `equivalentFindingIds`, and `providerFindings`). The report table surfaces provider counts.

This was initially correlation readiness and contract support only. The follow-up dep-viz slice completed AK `2114` and added the first actual second-provider scan path:

```text
b94a37e feat: add osv vulnerability provider
```

`depviz scan` now accepts:

```bash
--vuln-providers grype,osv
```

Semantics:

- Grype remains the primary scan provider.
- OSV-Scanner runs additively against the same per-module SBOMs.
- OSV advisory groups are normalized to one provider finding per alias group.
- GHSA/CVE/RUSTSEC identifiers are preferred in that order for cross-provider correlation.
- Matching Grype + OSV findings merge into one primary vulnerability with `source: "multi-provider"` and provider traceability in `vulnerabilities[].correlation`.
- OSV-only findings remain `source: "osv"` and are not falsely represented as corroborated by Grype.

OpenPencil re-run with Grype + OSV:

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
rm -rf /tmp/open-pencil-depintel-pilot/depviz-scan-grype-osv
go run ./cmd/depviz scan /home/tryinget/ai-society/softwareco/contrib/open-pencil \
  --out /tmp/open-pencil-depintel-pilot/depviz-scan-grype-osv \
  --container \
  --vuln-providers grype,osv \
  --format json
```

Result:

```json
{
  "sbomCount": 2,
  "scanCount": 2,
  "moduleCount": 2,
  "vulnerabilityCount": 20,
  "policy": {
    "effectiveThreshold": "high",
    "violation": false
  }
}
```

Provider breakdown in the generated depmodel:

```json
{
  "sources": {
    "multi-provider": 3,
    "osv": 17
  },
  "providerCounts": {
    "1": 17,
    "2": 3
  },
  "tools": {
    "grype": "0.108.0",
    "osv-scanner": "ghcr.io/google/osv-scanner@sha256:385ff9dd9d50a573766fc226f24da1d61cd5843542ff7e04c563561bbd918e30"
  }
}
```

The three previously observed Grype findings are now corroborated by OSV and emitted as `source: "multi-provider"` under `rust:desktop`:

```text
GHSA-wrw7-89jp-8q8g  pkg:cargo/glib@0.18.5  medium  providers=grype,osv
GHSA-cq8v-f236-94qc  pkg:cargo/rand@0.7.3   low     providers=grype,osv
GHSA-cq8v-f236-94qc  pkg:cargo/rand@0.8.5   low     providers=grype,osv
```

The additional 17 OSV-only findings are RustSec/OSV advisory evidence, many with unknown normalized severity. They are real second-provider findings, but they are **not** Grype-corroborated. The high-threshold policy still did not violate.

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

### dep-viz

```bash
go test ./internal/adapters/grype ./internal/model ./internal/output
go test ./cmd/depviz ./internal/model ./internal/output
node --test tests/report-vulnerabilities.test.mjs tests/report-model-loader.test.mjs
go test ./...
npm test
bash scripts/ci/full.sh
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
git diff --check
```

Result:

```text
go targeted tests: pass
go test ./...: pass
npm test: 91 pass / 0 fail
rocs validate: OK
docs strict: pass
git diff --check: pass
```

### Report artifact check

```text
/tmp/open-pencil-depintel-pilot/depviz/report/index.html
/tmp/open-pencil-depintel-pilot/depviz/report/assets/report/main.js
```

Both files exist.

## Interpretation

This pilot proves the dependency-intelligence corridor can now walk OpenPencil's `bun.lock` dependency tree to leaves, render it through dep-viz, make same-name version divergence visible as inventory context, and avoid inflated nested-module vulnerability counts while preserving parent-scan attribution.

It does **not** prove runtime coverage because no OpenPencil command was executed with runtime package observations. The `declared-unobserved` count is therefore expected and means "not observed by this zero-observation runtime bundle," not "safe to remove."

It now proves one concrete multi-provider vulnerability path for OpenPencil: Grype plus OSV-Scanner, both container-backed, with three corroborated Grype+OSV findings and 17 OSV-only findings. It does **not** prove npm-audit/GitHub Advisory/Snyk coverage, and OSV-only findings should not be described as Grype-corroborated.
