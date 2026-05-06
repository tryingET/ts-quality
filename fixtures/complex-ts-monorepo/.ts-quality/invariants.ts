export default [{
  id: 'api.refresh.expiry-boundary',
  title: 'API refresh expiry boundary',
  description: 'Refresh tokens expire exactly at their expiry timestamp.',
  severity: 'high',
  selectors: ['path:packages/api/src/token.ts', 'symbol:isRefreshExpired'],
  requiredTestPatterns: ['packages/api/test/token.test.js'],
  scenarios: [{
    id: 'expiry-boundary',
    description: 'exact expiry boundary denies access',
    keywords: ['active token before expiry allows access'],
    failurePathKeywords: ['exact expiry boundary denies access'],
    executionWitnessCommand: ['node', 'packages/api/test/token.test.js'],
    executionWitnessOutput: '.ts-quality/witnesses/api-refresh-expiry-boundary.json',
    executionWitnessTestFiles: ['packages/api/test/token.test.js'],
    expected: 'deny'
  }]
}];
