---
summary: "Constitution rule types and governance model for ts-quality."
read_when:
  - "When defining constitutional rules"
  - "When interpreting governance findings or plans"
type: "reference"
---

# Governance and constitution

A constitution defines what the system must remain true to while it evolves.

Supported rule kinds:

- `boundary` — forbid specific module/import crossings
- `risk` — stricter CRAP, mutation, or merge-confidence budgets for sensitive domains
- `approval` — require human approvers with named roles
- `rollback` — require attested evidence before risky migrations
- `ownership` — reserve paths for named owners or explicitly allowed agents

Example:

```ts
export default [
  {
    kind: 'boundary',
    id: 'api-cannot-import-identity',
    from: ['packages/api/**'],
    to: ['packages/identity/**'],
    mode: 'forbid',
    message: 'API code may not import identity state directly.'
  }
];
```

Approval-style rules may target either the rule id itself or an exact run binding of `runId` / `runId:ruleId`. `ts-quality check --run-id <id>` lets operators pre-bind that exact run identity when they need deterministic approval targeting. Caller-supplied run ids are validated as artifact ids and may contain only letters, numbers, dots, underscores, and hyphens. Constitutional amendments preserve the configured constitution file format, including `.json` configurations.

Ownership rules are enforced through explicit approvals: the named `owner` (or an `allowedAgents` entry) must record a matching approval for the reserved path scope.

`ts-quality govern` renders constitutional findings. `ts-quality plan` turns those findings into concrete next steps with tradeoffs.
