---
summary: "Entry point for browsing the repo-local ontology and bridge artifacts."
read_when:
  - "When orienting within the ontology folder"
  - "When deciding which ontology artifact to open first"
type: "reference"
---

# Ontology Index (repo)

Start here when browsing manually.

- `ontology/manifest.yaml` — which layers apply
- `ontology/src/system4d.yaml` — repo-local System4D (implementation)
- `ontology/src/reference/concepts/` — repo-local concepts (only when needed)
- `ontology/src/bridge/mapping.yaml` — map concepts to code symbols
- `ontology/dist/` — generated artifacts (tool-first)

Tip: Use `./scripts/rocs.sh pack <concept_id>` instead of opening many files.
