---
summary: "Witness safety checks must distinguish byte freshness, execution stability, contradiction and publication paths."
read_when:
  - "When editing execution witness production/selection or safety regressions"
type: "learning"
---

# Witness freshness and contradiction

AK #6547 began with a reproduced old-pass/current-fail source regression. Scope-only matching was not freshness. The repair makes current declared bytes and execution context explicit in reusable records and receipts, and downgrades unbound legacy records rather than inventing historical bindings.

Independent inspection exposed additional classes worth preserving in tests:

- Before/after byte equality misses rewriting inputs temporarily and restoring them. Execution-local inode/ctime/mtime checks detect the reproduced case without persisting timestamps or selecting witnesses by age.
- Irrelevant malformed observation metadata must not hide a current failure under permissive discovery.
- A pass must cover the full impacted scope; a current failure overlapping only a subset still contradicts that broader pass. A disjoint or stale failure does not.
- Canonical labels and actual publication paths differ for aliases. Rechecking the old label does not constrain a retargeted original path.
- `existsSync` follows symlinks and misses dangling entries. `lstat` on output path components rejects both existing-target and dangling links before/after commands. Hardlink outputs also need explicit rejection.
- Regular-file checks must precede hashing: a FIFO can otherwise block before the command timeout starts.

`test/witness-freshness.test.mjs` preserves real filesystem regressions for these classes. The protected manual contract also exercises generated bindings and source-drift rejection through the installed package. Full task evidence and independent inspection receipts remain on AK, not this learning note.

Explicit bindings still do not certify an undeclared dependency graph, command quality, arbitrary environment/external state, authenticity against privileged tampering, or acceptance/public availability. Conservative metadata checks can reject unrelated directory churn during proof; that is reported as an execution error, not promoted to success. Passing scenario support is distinct from overall verdict and authorization.
