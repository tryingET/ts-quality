---
summary: "Adoption evidence: Penpot dependency vulnerability scan with Grype plus OSV provider correlation."
read_when:
  - "Reviewing dependency-intelligence corridor adoption evidence."
  - "Checking Penpot multi-provider vulnerability scan results."
  - "Reviewing dep-viz Grype plus OSV provider-correlation evidence."
type: "evidence"
---

# Penpot Grype + OSV dependency scan — 2026-05-03

## Purpose

After the OpenPencil pilot proved the new `depviz scan --vuln-providers grype,osv` path, the operator asked to proceed with another real target, mentioning Penpot.

Target cloned locally:

```text
/home/tryinget/ai-society/softwareco/contrib/penpot
```

Clone source:

```text
https://github.com/penpot/penpot
```

Observed checkout:

```text
## develop...origin/develop
```

Boundary preserved:

```text
multi-provider evidence != all-provider coverage
policy violation != remediation authority
scanner-supported modules != whole-system dependency coverage
```

## Scanner support boundary

Penpot is a polyglot repo with Clojure/ClojureScript, TypeScript/JavaScript, and Rust/WASM modules. This scan used dep-viz's currently supported scanner path, which detected JavaScript/PNPM and Rust/Cargo modules.

Detected by this run:

- 12 JavaScript modules from `package.json` / PNPM or npm lockfiles.
- 2 Rust modules from `Cargo.lock`.

Not fully covered by this dep-viz scan path:

- Clojure `deps.edn` dependency resolution for backend/common/frontend/exporter/library.

The result is therefore a truthful dependency vulnerability scan for the JS/Rust surfaces dep-viz can currently model, not a complete Penpot whole-system dependency audit.

## Command

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
rm -rf /tmp/penpot-depintel-pilot/depviz-scan-grype-osv
mkdir -p /tmp/penpot-depintel-pilot
go run ./cmd/depviz scan /home/tryinget/ai-society/softwareco/contrib/penpot \
  --out /tmp/penpot-depintel-pilot/depviz-scan-grype-osv \
  --container \
  --vuln-providers grype,osv \
  --format json \
  > /tmp/penpot-depintel-pilot/depviz-scan-grype-osv-stdout.json \
  2> /tmp/penpot-depintel-pilot/depviz-scan-grype-osv-stderr.log
```

Artifacts:

```text
/tmp/penpot-depintel-pilot/depviz-scan-grype-osv/model/depmodel.v1.json
/tmp/penpot-depintel-pilot/depviz-scan-grype-osv/report/index.html
/tmp/penpot-depintel-pilot/depviz-scan-grype-osv-stdout.json
/tmp/penpot-depintel-pilot/depviz-scan-grype-osv-stderr.log
```

## Scan result

The scan completed and published artifacts. The policy threshold was `high`, and the scan reported a policy violation.

```json
{
  "sbomCount": 14,
  "scanCount": 14,
  "moduleCount": 14,
  "vulnerabilityCount": 259,
  "policy": {
    "effectiveThreshold": "high",
    "violation": true
  }
}
```

The `go run` wrapper surfaced a non-zero command status because dep-viz returned its policy-violation path. This is expected for a high-threshold policy violation and does not mean artifacts failed to publish.

## Module inventory

```json
{
  "modules": 14,
  "packages": 6578,
  "edges": 14772,
  "introducerPaths": 6578,
  "ecosystems": {
    "js": 12,
    "rust": 2
  }
}
```

Detected modules:

```text
js:.                                      pnpm-lock.yaml
js:backend                               backend/pnpm-lock.yaml
js:common                                common/pnpm-lock.yaml
js:docs                                  docs/pnpm-lock.yaml
js:exporter                              exporter/pnpm-lock.yaml
js:frontend                              frontend/pnpm-lock.yaml
js:frontend/packages/draft-js            frontend/packages/draft-js/pnpm-lock.yaml
js:library                               library/pnpm-lock.yaml
js:mcp                                   mcp/pnpm-lock.yaml
js:plugins                               plugins/pnpm-lock.yaml
js:plugins/libs/plugins-runtime          plugins/libs/plugins-runtime/package-lock.json
js:render-wasm                           render-wasm/pnpm-lock.yaml
rust:render-wasm                         render-wasm/Cargo.lock
rust:render-wasm/macros                  render-wasm/macros/Cargo.lock
```

## Provider and severity breakdown

Tools recorded by the depmodel:

```json
{
  "grype": "0.108.0",
  "osv-scanner": "ghcr.io/google/osv-scanner@sha256:385ff9dd9d50a573766fc226f24da1d61cd5843542ff7e04c563561bbd918e30"
}
```

Provider breakdown:

```json
{
  "sources": {
    "multi-provider": 229,
    "grype": 15,
    "osv": 15
  },
  "providerCounts": {
    "1": 30,
    "2": 229
  }
}
```

Severity breakdown:

```json
{
  "critical": 2,
  "high": 151,
  "medium": 99,
  "low": 7
}
```

Findings by module, top counts:

```text
92  js:plugins
62  js:frontend
36  js:docs
28  js:mcp
16  js:exporter
6   js:backend
6   js:common
6   js:library
2   js:frontend/packages/draft-js
2   js:render-wasm
2   rust:render-wasm
1   js:plugins/libs/plugins-runtime
```

## High/critical examples

Examples of high/critical findings that were corroborated by both Grype and OSV:

```text
critical  js:docs      pkg:npm/handlebars@4.7.8  GHSA-2w6w-674q-4c4q  providers=grype,osv
high      js:backend   pkg:npm/minimatch@3.1.2   GHSA-23c5-xmqv-rm74  providers=grype,osv
high      js:backend   pkg:npm/minimatch@3.1.2   GHSA-3ppc-4f35-3m26  providers=grype,osv
high      js:backend   pkg:npm/minimatch@3.1.2   GHSA-7r86-cg39-jmmj  providers=grype,osv
high      js:backend   pkg:npm/picomatch@2.3.1   GHSA-c2c7-rcm5-vvqj  providers=grype,osv
high      js:docs      pkg:npm/liquidjs@10.24.0  GHSA-4rc3-7j7w-m548  providers=grype,osv
high      js:docs      pkg:npm/undici@7.18.2     GHSA-f269-vfmq-vjvj  providers=grype,osv
```

These examples are evidence for vulnerability triage. They are not direct remediation instructions by themselves; remediation still needs repo-owner review, version constraints, and compatibility testing.

## Interpretation

This Penpot run proves that the current dep-viz corridor can run a real second vulnerability provider on a larger polyglot repo and materially populate provider-correlation metadata:

- 259 primary findings across supported JS/Rust modules.
- 229 findings corroborated by both Grype and OSV.
- 30 provider-singleton findings (`grype`-only or `osv`-only).
- Policy violation at the default/effective `high` threshold.

The strong positive signal is that provider correlation is no longer just schema readiness; it is populated by a real second-provider run.

The hard boundary is equally important: this is not a complete Penpot ecosystem audit because dep-viz does not yet resolve Clojure `deps.edn` dependency graphs. A future slice should either add Clojure/deps.edn SBOM support or explicitly hand Clojure vulnerability evidence to another owner/tool before making whole-repo security claims.

## Cleanup

The scan-created Penpot `.tmp` directory was removed after the run:

```bash
cd /home/tryinget/ai-society/softwareco/contrib/penpot
rm -rf .tmp
git status --short --branch
```

Observed:

```text
## develop...origin/develop
```
