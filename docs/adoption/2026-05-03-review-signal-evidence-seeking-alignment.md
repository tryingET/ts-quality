---
summary: "Adoption evidence: dependency-intelligence review signals now seek evidence rather than granting dependency-change decisions."
read_when:
  - "Reviewing dependency-intelligence corridor adoption evidence."
  - "Checking static/runtime review-signal authority boundaries."
  - "Planning dep-viz evidence-queue follow-up work."
type: "evidence"
---

# Review-signal evidence-seeking alignment — 2026-05-03

## Purpose

This note records the post-implementation proof that dependency-intelligence review signals are now framed as evidence-seeking follow-up, not dependency-change authority.

Boundary preserved:

```text
review signals seek evidence != review signals grant removal/prune decisions
```

## Source commits

### dep-diet producer

- Repo: `/home/tryinget/ai-society/softwareco/owned/dep-diet`
- Commit: `662f3f9 fix: make review signals evidence seeking`
- Relevant behavior:
  - compact analyze output says `Evidence-seeking review signals`;
  - `declared-unobserved-review` uses `posture: "collect-evidence"` rather than candidate/removal language;
  - next-evidence copy asks operators to collect runtime/static evidence before interpreting dependency-change possibilities;
  - `authority.removalAuthority: false` remains the machine-readable boundary.

### dep-viz renderer

- Repo: `/home/tryinget/ai-society/softwareco/owned/dep-viz`
- Renderer slice commit: `7cb25d5 feat: render static runtime follow-up prompts`
- Current proof checkout: `b94a37e feat: add osv vulnerability provider`
- Relevant behavior:
  - overview and Sunshine report surfaces render review signals as evidence-seeking follow-up prompts;
  - report assets preserve review questions, next evidence actions, and authority notes;
  - dep-viz does not reinterpret dep-diet review signals as remove/prune authority.

## Fresh end-to-end proof

Generated artifacts were kept out of git under:

```text
/tmp/dependency-review-signal-proof-2026-05-03/
```

The proof used the dep-diet static/runtime fixture corridor and materialized a dep-viz report from the produced depmodel.

```bash
workdir=/tmp/dependency-review-signal-proof-2026-05-03
rm -rf "$workdir"
mkdir -p "$workdir/fixtures/gardener" "$workdir/fixtures/runtime_trace_bundle/v1" "$workdir/out"
cp -R /home/tryinget/ai-society/softwareco/owned/dep-diet/tests/fixtures/js_ts/npm-lockfile "$workdir/project"
cp /home/tryinget/ai-society/softwareco/owned/dep-diet/fixtures/gardener/depdiet-minimal-gardener-output.json \
  "$workdir/fixtures/gardener/depdiet-minimal-gardener-output.json"
cp /home/tryinget/ai-society/softwareco/owned/dep-diet/fixtures/runtime_trace_bundle/v1/dependency-corridor-runtime-bundle.json \
  "$workdir/fixtures/runtime_trace_bundle/v1/dependency-corridor-runtime-bundle.json"

(
  cd "$workdir"
  node /home/tryinget/ai-society/softwareco/owned/dep-diet/scripts/depdiet.mjs analyze project \
    --gardener-output fixtures/gardener/depdiet-minimal-gardener-output.json \
    --runtime-bundle fixtures/runtime_trace_bundle/v1/dependency-corridor-runtime-bundle.json \
    --out-depmodel out/depdiet/analyze/depmodel.json \
    --compact
)

(
  cd /home/tryinget/ai-society/softwareco/owned/dep-viz
  go run ./cmd/depviz report \
    --model "$workdir/out/depdiet/analyze/depmodel.json" \
    --out "$workdir/out/depviz/report" \
    --render-only
)
```

Observed compact producer output:

```text
Analyze project: 3 findings, 3 packages, 2 edges, 2 introducer paths.
Report: out/depdiet/analyze/report.json
Depmodel: out/depdiet/analyze/depmodel.json
Static/runtime evidence: confirmed=1 runtime-only=1 declared-unobserved=2 static-central-unobserved=0 ambiguous=0.
Evidence-seeking review signals: hidden-root=1 declared-unobserved-review=2 critical-soil=1 risky-core=0 ambiguous-review=0.
Authority: Static/runtime evidence is context for review, not standalone removal permission.
Dependency inventory: package-names=4 package-version-nodes=4 lockfile-occurrences=2 version-divergent-names=0 repeated-version-occurrences=0.
Inventory authority: Dependency version groups are inventory context only; they do not imply deduplication, pruning, or removal authority.
```

Observed dep-viz report materialization:

```text
depviz report: model /tmp/dependency-review-signal-proof-2026-05-03/out/depdiet/analyze/depmodel.json
depviz report: wrote /tmp/dependency-review-signal-proof-2026-05-03/out/depviz/report
depviz report: URL after serve http://127.0.0.1:7777/
Serve later with:
  depviz serve --port 7777 /tmp/dependency-review-signal-proof-2026-05-03/out/depviz/report
```

Rendered report assets include the new evidence-seeking copy:

```text
/tmp/dependency-review-signal-proof-2026-05-03/out/depviz/report/assets/report/views/Sunshine.js:
  detailParts.push(`Evidence-seeking review signals: ${reviewSignals.map((signal) => signal.label || signal.code).join(", ")}.`);

/tmp/dependency-review-signal-proof-2026-05-03/out/depviz/report/assets/report/views/Overview.js:
  <strong data-overview-static-runtime-review-signal-heading="true">Evidence-seeking review signals</strong>
```

## Evidence queue follow-up recommendation

The next dep-viz product slice should be an **Evidence queue**, not a dependency-removal recommendation queue.

Bounded target:

```text
dep-viz groups packages by review-signal posture and exposes the next evidence question/action before any dependency-change planning.
```

Suggested first slice:

- add a report panel or filter for packages with `evidence.staticRuntime.reviewSignals.length > 0`;
- group by signal posture: `collect-evidence`, `investigate`, and `preserve-context`;
- show package, classification, signal code, review question, next evidence action, and authority note;
- avoid labels such as remove candidate, prune candidate, or decision recommendation;
- keep dep-diet as the producer of signal semantics and dep-viz as the renderer.

Acceptance checks for that future slice:

```text
npm test
node --test tests/report-sunshine.test.mjs tests/report-model-loader.test.mjs
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
git diff --check
```

## Conclusion

The dependency-intelligence corridor now has a verified producer-to-renderer path where review signals are explicitly evidence-seeking. Static/runtime evidence, review signals, and dependency inventory remain context for operator review, not standalone dependency-change authority.
