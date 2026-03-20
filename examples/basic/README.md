---
summary: "Minimal example for running ts-quality with the smallest local setup."
read_when:
  - "When starting from the basic example"
  - "When checking the minimum files needed for a local run"
type: "tutorial"
---

# Basic example

This example shows the minimal config and support files needed to run `ts-quality` locally.

You can also materialize the author-authored config/support files into boring runtime JSON before running the check:

```bash
npx ts-quality materialize --root examples/basic
npx ts-quality check --root examples/basic --config .ts-quality/materialized/ts-quality.config.json
```
