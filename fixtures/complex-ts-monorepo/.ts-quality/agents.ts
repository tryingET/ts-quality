export default [{
  id: 'release-bot',
  kind: 'automation',
  roles: ['release'],
  grants: [{
    id: 'api-merge',
    actions: ['merge'],
    paths: ['packages/api/src/**'],
    minMergeConfidence: 60
  }]
}];
