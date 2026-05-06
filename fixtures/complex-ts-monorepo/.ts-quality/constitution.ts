export default [{
  kind: 'risk',
  id: 'api-refresh-risk-budget',
  paths: ['packages/api/src/**'],
  severity: 'error',
  message: 'API refresh logic must keep enough deterministic evidence.',
  maxCrap: 40,
  minMutationScore: 0.5,
  minMergeConfidence: 60
}];
