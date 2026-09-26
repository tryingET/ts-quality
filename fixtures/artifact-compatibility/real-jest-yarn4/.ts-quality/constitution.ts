export default [
  { kind: 'risk', id: 'default-risk', paths: ['src/**'], message: 'Changed source must stay within risk budgets.', maxCrap: 30, minMutationScore: 0.8, minMergeConfidence: 70 },
  { kind: 'approval', id: 'payments-review', paths: ['src/payments/**'], message: 'Payments changes require a maintainer approval.', minApprovals: 1, roles: ['maintainer'] }
];
