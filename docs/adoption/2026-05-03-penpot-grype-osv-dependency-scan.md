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

Penpot is a polyglot repo with Clojure/ClojureScript, TypeScript/JavaScript, and Rust/WASM modules.

The first run detected JavaScript/PNPM and Rust/Cargo modules only. That exposed a dep-viz gap for Penpot's Clojure `deps.edn` manifests. The follow-up dep-viz slice completed AK `2122`:

```text
7c4b1b5 feat: scan clojure deps manifests
```

Dep-viz first added Clojure `deps.edn` direct manifest-coordinate support, then completed AK `2126`:

```text
3e88394 feat: resolve clojure classpaths
```

The Clojure path now:

- detects `deps.edn` modules;
- prefers tools.deps classpath resolution via `clojure -Spath`;
- converts resolved Maven repository JARs into Maven PURLs;
- falls back to direct `:mvn/version` manifest coordinates when the resolver is unavailable;
- emits generated CycloneDX SBOMs;
- runs Grype and optional OSV against those generated SBOMs;
- records Clojure modules with `ecosystem: "clojure"` in depmodel;
- records the mode in `provenance.tools["clojure-deps"]`.

Boundary: this is resolver-backed default tools.deps classpath evidence for each `deps.edn` module. Alias selection remains a future UX/design slice.

## Command

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
rm -rf /tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-resolved
mkdir -p /tmp/penpot-depintel-pilot
go run ./cmd/depviz scan /home/tryinget/ai-society/softwareco/contrib/penpot \
  --out /tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-resolved \
  --container \
  --vuln-providers grype,osv \
  --format json \
  > /tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-resolved-stdout.json \
  2> /tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-resolved-stderr.log
```

Artifacts:

```text
/tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-resolved/model/depmodel.v1.json
/tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-resolved/report/index.html
/tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-resolved-stdout.json
/tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-resolved-stderr.log
```

## Scan result

The scan completed and published artifacts. The policy threshold was `high`, and the scan reported a policy violation.

```json
{
  "sbomCount": 20,
  "scanCount": 20,
  "moduleCount": 20,
  "vulnerabilityCount": 325,
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
  "modules": 20,
  "packages": 7226,
  "edges": 15420,
  "introducerPaths": 7226,
  "ecosystems": {
    "js": 12,
    "clojure": 6,
    "rust": 2
  }
}
```

Detected modules:

```text
clojure:.                                deps.edn
clojure:backend                          backend/deps.edn
clojure:common                           common/deps.edn
clojure:exporter                         exporter/deps.edn
clojure:frontend                         frontend/deps.edn
clojure:library                          library/deps.edn
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
  "clojure-deps": "tools-deps-classpath",
  "grype": "0.108.0",
  "osv-scanner": "ghcr.io/google/osv-scanner@sha256:385ff9dd9d50a573766fc226f24da1d61cd5843542ff7e04c563561bbd918e30"
}
```

Provider breakdown:

```json
{
  "sources": {
    "multi-provider": 293,
    "grype": 17,
    "osv": 15
  },
  "providerCounts": {
    "1": 32,
    "2": 293
  }
}
```

Severity breakdown:

```json
{
  "critical": 2,
  "high": 169,
  "medium": 143,
  "low": 11
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
66  clojure modules combined
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
high      js:docs          pkg:npm/undici@7.18.2                  GHSA-f269-vfmq-vjvj  providers=grype,osv
high      clojure:backend  pkg:maven/org.lz4/lz4-java@1.8.0       GHSA-cmp6-m4wj-q63q  providers=grype,osv
high      clojure:backend  pkg:maven/org.lz4/lz4-java@1.8.0       GHSA-vqf4-7m7x-wgfc  providers=grype,osv
medium    clojure:common   pkg:maven/org.apache.logging.log4j/log4j-core@2.25.3  GHSA-3pxv-7cmr-fjr4  providers=grype,osv
```

These examples are evidence for vulnerability triage. They are not direct remediation instructions by themselves; remediation still needs repo-owner review, version constraints, and compatibility testing.

## Interpretation

This Penpot run proves that the current dep-viz corridor can run a real second vulnerability provider on a larger polyglot repo and materially populate provider-correlation metadata:

- 325 primary findings across supported JS/Rust modules plus resolver-backed Clojure `deps.edn` modules.
- 293 findings corroborated by both Grype and OSV.
- 32 provider-singleton findings (`grype`-only or `osv`-only).
- 66 Clojure classpath findings, 64 corroborated by both providers and 2 Grype-only.
- Policy violation at the default/effective `high` threshold.

The strong positive signal is that provider correlation is no longer just schema readiness; it is populated by a real second-provider run.

The hard boundary is equally important: this is now resolver-backed default tools.deps classpath evidence, not all possible alias profiles. A future slice should add explicit alias/profile selection before making claims about every dev/test/build Clojure classpath.

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
