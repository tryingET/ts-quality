---
summary: "Agent legitimacy, grant scope, and authorization decision model for ts-quality."
read_when:
  - "When editing agent grants or legitimacy rules"
  - "When interpreting authorization outcomes"
type: "reference"
---

# Legitimacy and agent licensing

Agents define who or what may act.

```ts
export default [
  {
    id: 'release-bot',
    kind: 'automation',
    roles: ['ci'],
    grants: [
      {
        id: 'release-bot-merge',
        actions: ['merge'],
        paths: ['src/**'],
        minMergeConfidence: 80,
        requireAttestations: ['ci.tests.passed'],
        requireHumanReview: true
      }
    ]
  }
];
```

Authorization considers:

- grant scope
- changed files
- merge confidence
- constitutional approval rules
- verified attestation claims
- recorded overrides

Recorded overrides are re-validated against human `override` grants on the exact changed scope. An override record without a matching override grant is ignored rather than treated as a blanket bypass.

Product authorization artifacts now also project additive `evidenceContext` from the exact run they evaluated: the run id, authoritative artifact paths, current blocking governance findings, and the first at-risk invariant provenance summary. Verified attestation claims now have to bind to repo-local artifacts under that exact run boundary; a foreign file with a matching path shape is not accepted as current-run proof. That context is a concise projection of `run.json`, not a competing evidence authority.

Outputs are explicit decisions: approve, deny, narrow-scope, request-more-proof, or require-human-approver.
