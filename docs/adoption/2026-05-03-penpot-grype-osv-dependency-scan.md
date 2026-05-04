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

Dep-viz then completed AK `2127`:

```text
25576a4 feat: select clojure scan aliases
```

`depviz scan` accepts global Clojure alias selection:

```bash
--clojure-aliases dev,test
```

Aliases are passed to tools.deps as `-A:dev:test`, recorded in scan metadata, and reflected in `provenance.tools["clojure-deps"]`.

Dep-viz then completed AK `2128`:

```text
1050c6a feat: map clojure aliases per module
```

`depviz scan` now accepts per-module Clojure alias overrides:

```bash
--clojure-alias-map 'backend=dev,test;frontend=dev,shadow-cljs;common='
```

Per-module entries are keyed by repo-relative `deps.edn` module path, override the global alias list, and can intentionally clear aliases for a module with an empty right-hand side.

Dep-viz then completed the report/triage surfacing slice:

```text
2ebfa1d feat: surface vulnerability triage evidence
```

The scan output now includes compact `triageClusters` grouped by `(packageId, vulnerabilityId)` with severity, affected-module count, finding count, provider count, provider names, and modules. The report vulnerability view also surfaces:

- provider names and provider counts per finding;
- per-module Clojure alias mode from `provenance.tools["clojure-deps"]`;
- highest-impact vulnerability clusters as triage evidence, not remediation authority.

Dep-viz then completed the handoff generation slice:

```text
1fd703b feat: generate exploitability handoff packets
```

`depviz handoff exploitability` now generates local-only `depviz.exploitability-validation-handoff.v1` packets for downstream validation repos such as `dep-redteam`. The command reads an existing depmodel, summarizes the target `SECURITY.md`, preserves tool/provider/cluster evidence, requires an operator-confirmed authorization scope, and does not contact maintainers.

Dep-redteam then completed the first validation-consumer slice:

```text
b51bcf6 feat: add passive validation contracts
```

`dep-redteam` now carries machine-readable JSON schema contracts for both the dep-viz handoff packet and the dep-redteam result packet, plus a passive validation command that can move results beyond `not_started` without claiming exploitability.

Dep-redteam then enriched passive validation evidence:

```text
41e89a0 feat: enrich passive validation evidence
```

Passive result packets now include advisory evidence, affected-component package-name hints, dependency-role hints, introducer path samples, future safe-reproducer needs, and richer draft rendering. Dev/tooling role hints are seeded from `~/ai-society/core/tech-stack-core` lane quality/testing surfaces. The matching is token-aware so short tool names such as `ty` do not accidentally classify unrelated package names such as `netty` as dev tooling.

Dep-redteam then added a non-executing local-lab planning contract:

```text
855d69a feat: plan local lab validation
```

`depredteam.local-lab-plan.v1` and the `dep-redteam plan-local-lab` CLI describe approval gates, blocked/readiness states, required preconditions, validation questions, and candidate evidence artifacts. The plan intentionally keeps `executionAllowed = false` and `approvalRequired = true` for every entry; it does not run payloads or authorize active validation.

Dep-redteam then added manual local-lab evidence capture:

```text
51a4433 feat: capture local lab evidence
```

`depredteam.local-lab-evidence.v1` records manually supplied evidence from a separate approved local run. The CLI can validate evidence packets and apply them to result packets, but it records `executionBoundary.executedByDepRedteam = false`; dep-redteam still does not run validation payloads itself.

Dep-redteam then hardened local-lab evidence transition fixtures:

```text
f7f76f8 test: harden local lab evidence transitions
```

Fixture packets under `tests/fixtures/local_lab_evidence/` now pin valid `not_reproduced`, `reachable_not_exploited`, and `safe_reproducer_confirmed` shapes, plus an invalid recommendation case where disclosure is recommended without a safe reproducer. Regression tests prove blocked plan entries cannot accept manual evidence and that a safe-reproducer fixture is the only fixture class that can recommend human-reviewed disclosure.

Dep-redteam then added advisory-specific local-lab design packets:

```text
9212d4d feat: design local lab validation
```

`depredteam.local-lab-design.v1` and the `dep-redteam design-local-lab` CLI define affected behavior, advisory preconditions, local setup assumptions, synthetic input design, expected safe observations, stop conditions, and required evidence artifacts for one selected advisory. Design packets keep `executionAllowed = false`, require future approval before execution, and can only be created for entries already marked `ready_for_local_lab_design`.

Dep-redteam then enriched advisory intelligence from existing depmodel/provider metadata:

```text
64a13f7 feat: enrich advisory intelligence
```

Passive/design packets now carry patched versions, CVE ids, CVSS scores/vectors, reference URLs, and explicit known unknowns when the current depmodel does not represent affected version ranges, CWE identifiers, or affected behavior/function details. No external advisory fetching was added; enrichment uses already captured depmodel evidence only.

Dep-redteam then adopted compact real dep-viz corridor fixtures:

```text
1e437b0 test: adopt real depviz corridor fixtures
```

The new fixtures under `tests/fixtures/depviz_corridor/` are derived from the Penpot dep-viz Grype+OSV pilot. They pin one handoff, one passive advisory result with enriched intelligence, one local-lab plan/design path, and one blocked-case path where scanner evidence remains below design-ready validation. This makes future schema or validator drift visible without executing exploit code or sending a disclosure.

## Command

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
rm -rf /tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-module-aliases-triage
mkdir -p /tmp/penpot-depintel-pilot
go run ./cmd/depviz scan /home/tryinget/ai-society/softwareco/contrib/penpot \
  --out /tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-module-aliases-triage \
  --container \
  --vuln-providers grype,osv \
  --clojure-alias-map 'backend=dev,test;common=dev,test,shadow-cljs;frontend=dev,shadow-cljs;exporter=dev,shadow-cljs;library=dev,shadow-cljs;.=' \
  --format json \
  > /tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-module-aliases-triage-stdout.json \
  2> /tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-module-aliases-triage-stderr.log
```

Artifacts:

```text
/tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-module-aliases-triage/model/depmodel.v1.json
/tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-module-aliases-triage/report/index.html
/tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-module-aliases-triage-stdout.json
/tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-module-aliases-triage-stderr.log
```

## Scan result

The scan completed and published artifacts. The policy threshold was `high`, and the scan reported a policy violation.

```json
{
  "sbomCount": 21,
  "scanCount": 21,
  "moduleCount": 21,
  "vulnerabilityCount": 395,
  "policy": {
    "effectiveThreshold": "high",
    "violation": true
  }
}
```

The `go run` wrapper surfaced a non-zero command status because dep-viz returned its policy-violation path. This is expected for a high-threshold policy violation and does not mean artifacts failed to publish. The run-summary telemetry also reported the final module count truthfully:

```json
"signals": {
  "moduleCount": 21
}
```

## Module inventory

```json
{
  "modules": 21,
  "packages": 7370,
  "edges": 15125,
  "introducerPaths": 7370,
  "ecosystems": {
    "js": 13,
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
js:mcp/packages/server                   mcp/packages/server/pnpm-lock.yaml
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
  "clojure-deps": {
    "clojure:.": "tools-deps-classpath",
    "clojure:backend": "tools-deps-classpath aliases=dev,test",
    "clojure:common": "tools-deps-classpath aliases=dev,test,shadow-cljs",
    "clojure:exporter": "tools-deps-classpath aliases=dev,shadow-cljs",
    "clojure:frontend": "tools-deps-classpath aliases=dev,shadow-cljs",
    "clojure:library": "tools-deps-classpath aliases=dev,shadow-cljs"
  },
  "grype": "0.108.0",
  "osv-scanner": "ghcr.io/google/osv-scanner@sha256:385ff9dd9d50a573766fc226f24da1d61cd5843542ff7e04c563561bbd918e30"
}
```

Provider breakdown:

```json
{
  "sources": {
    "multi-provider": 363,
    "grype": 17,
    "osv": 15
  },
  "providerCounts": {
    "1": 32,
    "2": 363
  }
}
```

Severity breakdown:

```json
{
  "critical": 6,
  "high": 221,
  "medium": 157,
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
126 clojure findings combined
8   js:mcp/packages/server
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
high      js:docs          pkg:npm/undici@7.18.2                  GHSA-f269-vfmq-vjvj  providers=grype,osv
high      clojure:backend  pkg:maven/org.lz4/lz4-java@1.8.0       GHSA-cmp6-m4wj-q63q  providers=grype,osv
high      clojure:backend  pkg:maven/org.lz4/lz4-java@1.8.0       GHSA-vqf4-7m7x-wgfc  providers=grype,osv
medium    clojure:common   pkg:maven/org.apache.logging.log4j/log4j-core@2.25.3  GHSA-3pxv-7cmr-fjr4  providers=grype,osv
```

These examples are evidence for vulnerability triage. They are not direct remediation instructions by themselves; remediation still needs repo-owner review, version constraints, and compatibility testing.

## Triage clusters

The updated scan stdout includes compact `triageClusters`. Top clusters from this Penpot run:

```text
1. critical modules=4 findings=4 providers=grype,osv pkg:maven/io.undertow/undertow-core@2.3.10.Final GHSA-j382-5jj3-vw4j clojure:common, clojure:exporter, clojure:frontend, clojure:library
2. critical modules=1 findings=1 providers=grype,osv pkg:npm/basic-ftp@5.1.0 GHSA-5rq4-664w-9x2c js:plugins
3. critical modules=1 findings=1 providers=grype,osv pkg:npm/handlebars@4.7.8 GHSA-2w6w-674q-4c4q js:docs
4. high modules=6 findings=6 providers=grype,osv pkg:npm/minimatch@3.1.2 GHSA-23c5-xmqv-rm74 js:backend, js:common, js:docs, js:frontend, js:library, js:plugins
5. high modules=6 findings=6 providers=grype,osv pkg:npm/minimatch@3.1.2 GHSA-3ppc-4f35-3m26 js:backend, js:common, js:docs, js:frontend, js:library, js:plugins
6. high modules=6 findings=6 providers=grype,osv pkg:npm/minimatch@3.1.2 GHSA-7r86-cg39-jmmj js:backend, js:common, js:docs, js:frontend, js:library, js:plugins
7. high modules=6 findings=6 providers=grype,osv pkg:npm/picomatch@2.3.1 GHSA-c2c7-rcm5-vvqj js:backend, js:common, js:docs, js:frontend, js:library, js:plugins
8. high modules=4 findings=4 providers=grype,osv pkg:maven/io.netty/netty-codec-http@4.1.117.Final GHSA-pwqr-wmgm-9rr8 clojure:common, clojure:exporter, clojure:frontend, clojure:library
9. high modules=4 findings=4 providers=grype,osv pkg:maven/io.netty/netty-handler@4.1.117.Final GHSA-4g8c-wm8x-jfhw clojure:common, clojure:exporter, clojure:frontend, clojure:library
10. high modules=4 findings=4 providers=grype,osv pkg:maven/io.undertow/undertow-core@2.3.10.Final GHSA-33hj-rcmx-86mv clojure:common, clojure:exporter, clojure:frontend, clojure:library
```

Interpretation boundary: clusters identify high-impact triage review targets by severity, affected-module count, provider corroboration, and finding count. They do not decide upgrades, removals, exploitability, or remediation order without Penpot owner review.

## Interpretation

This Penpot run proves that the current dep-viz corridor can run a real second vulnerability provider on a larger polyglot repo and materially populate provider-correlation metadata:

- 395 primary findings across supported JS/Rust modules plus resolver-backed Clojure `deps.edn` modules with explicit per-module aliases selected.
- 363 findings corroborated by both Grype and OSV.
- 32 provider-singleton findings (`grype`-only or `osv`-only).
- 126 Clojure classpath findings, 124 corroborated by both providers and 2 Grype-only.
- Policy violation at the default/effective `high` threshold.

The strong positive signal is that provider correlation is no longer just schema readiness; it is populated by a real second-provider run, and Clojure evidence can now record different resolver profiles per module.

The hard boundary is equally important: this is resolver-backed tools.deps classpath evidence for the specific per-module alias map shown above. It is not evidence for every possible alias combination, and the scan result is still triage evidence rather than Penpot remediation authority.

## Handoff and validation-plan proof

Generated local-only handoff packet:

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
go run ./cmd/depviz handoff exploitability \
  --model /tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-module-aliases-triage/model/depmodel.v1.json \
  --target /home/tryinget/ai-society/softwareco/contrib/penpot \
  --security-policy /home/tryinget/ai-society/softwareco/contrib/penpot/SECURITY.md \
  --authorization-scope local_clone_only \
  --report /tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-module-aliases-triage/report/index.html \
  --scan-output /tmp/penpot-depintel-pilot/depviz-scan-grype-osv-clojure-module-aliases-triage-stdout.json \
  --repo-url https://github.com/penpot/penpot \
  --out /tmp/penpot-depintel-pilot/depviz-handoff-triage/exploitability-validation.v1.json
```

Handoff summary:

```json
{
  "schemaVersion": "depviz.exploitability-validation-handoff.v1",
  "securityPolicyMechanism": {
    "kind": "email",
    "address": "support@penpot.app",
    "publicIssueAllowed": false
  },
  "authorization": {
    "status": "operator_confirmed",
    "scope": "local_clone_only"
  },
  "triageClusterCount": 10
}
```

`dep-redteam` consumed the packet successfully and first produced the planned `not_started` result:

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-redteam
uv run dep-redteam validate-handoff /tmp/penpot-depintel-pilot/depviz-handoff-triage/exploitability-validation.v1.json --json
uv run dep-redteam plan /tmp/penpot-depintel-pilot/depviz-handoff-triage/exploitability-validation.v1.json \
  --out /tmp/penpot-depintel-pilot/depviz-handoff-triage/validation-result.json
```

After the passive-validation slice, the same handoff was checked without executing target code:

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-redteam
uv run dep-redteam validate-passive /tmp/penpot-depintel-pilot/depviz-handoff-triage/exploitability-validation.v1.json \
  --target /home/tryinget/ai-society/softwareco/contrib/penpot \
  --out /tmp/penpot-depintel-pilot/depviz-handoff-triage/validation-result.passive.json
uv run dep-redteam validate-result /tmp/penpot-depintel-pilot/depviz-handoff-triage/validation-result.passive.json --json
uv run dep-redteam draft /tmp/penpot-depintel-pilot/depviz-handoff-triage/exploitability-validation.v1.json \
  --result /tmp/penpot-depintel-pilot/depviz-handoff-triage/validation-result.passive.json \
  --out /tmp/penpot-depintel-pilot/depviz-handoff-triage/disclosure-draft.md
```

Passive validation result boundary after enrichment:

```text
10 dependency_present_only
0  reachable_unproven
0  safe_reproducer_confirmed

role hints:
5 runtime_or_buildtime_unknown
5 docs_test_likely
0 dev_tooling_likely

disclosure: local draft only, not sent automatically
```

Interpretation: the top ten Penpot triage clusters were present in the depmodel, but passive source-reference inspection did not find code-reference evidence for those package names in the bounded local checkout scan. Five clusters were associated with docs/test-like evidence, while the Undertow/Netty/basic-ftp clusters remained runtime/buildtime unknown rather than falsely classified as dev tooling. This is stronger than `not_started`, but still not exploitability proof and still not a disclosure recommendation.

The local-lab planning packet was generated with:

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-redteam
uv run dep-redteam plan-local-lab /tmp/penpot-depintel-pilot/depviz-handoff-triage/exploitability-validation.v1.json \
  --result /tmp/penpot-depintel-pilot/depviz-handoff-triage/validation-result.passive.json \
  --out /tmp/penpot-depintel-pilot/depviz-handoff-triage/local-lab-plan.json
uv run dep-redteam validate-local-lab-plan /tmp/penpot-depintel-pilot/depviz-handoff-triage/local-lab-plan.json --json
```

Local-lab plan boundary:

```text
schema: depredteam.local-lab-plan.v1
defaultExecutionAllowed: false
10 blocked_pending_reachability_evidence
```

The Penpot local-lab plan stayed blocked, so no Penpot local-lab evidence packet was recorded:

```text
10 blocked_pending_reachability_evidence
```

Advisory intelligence examples from the regenerated passive result:

```text
GHSA-j382-5jj3-vw4j  patched=2.3.21.Final  CVE-2025-12543  CVSS=9.6  refs=12  known_unknowns=3
GHSA-5rq4-664w-9x2c  patched=5.2.0         CVE-2026-27699  CVSS=9.1  refs=5   known_unknowns=3
GHSA-2w6w-674q-4c4q  patched=4.7.9         CVE-2026-33937  CVSS=9.8  refs=5   known_unknowns=3
```

This proves the corridor now has a repeatable path from scan evidence to SECURITY.md-aware handoff, machine-readable result contracts, passive applicability validation, advisory/role enrichment, non-executing local-lab planning, manual evidence-capture contracts, and local disclosure draft. It still does not prove exploitability; safe reproducer execution remains future human-approved `dep-redteam` work.

## Cleanup

The scan-created Penpot `.tmp` directory was removed after the run:

```bash
cd /home/tryinget/ai-society/softwareco/contrib/penpot
rm -rf .tmp
git status --short --branch
```

Observed:

```text
## HEAD (no branch)
```
