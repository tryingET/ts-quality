---
summary: "Latest repo verification record produced by scripts/verify.mjs."
read_when:
  - "When checking which repo validation commands most recently passed"
  - "When reviewing the generated verification artifact format"
type: "reference"
---

# Verification

The following commands were executed successfully:

- `npm ci --ignore-scripts --no-audit --no-fund`
- `npm run build --silent`
- `npm run typecheck --silent`
- `npm run lint --silent`
- `npm test --silent`
- `npm run sample-artifacts --silent`
- second `npm run sample-artifacts --silent` idempotence check over `examples/artifacts/governed-app`
- `npm run smoke --silent`
- `npm run smoke:packaging --silent`

Log: `verification/verification.log`
