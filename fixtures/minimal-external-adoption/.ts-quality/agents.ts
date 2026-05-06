export default [{
  id: 'release-bot',
  kind: 'automation',
  roles: ['ci'],
  grants: [{
    id: 'release-bot-merge',
    actions: ['merge'],
    paths: ['src/auth/**'],
    minMergeConfidence: 65
  }]
}];
