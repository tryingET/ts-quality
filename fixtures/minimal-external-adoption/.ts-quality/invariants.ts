export default [{
  id: 'auth.refresh.validity',
  title: 'Refresh token validity',
  description: 'Expired refresh tokens must never authorize access.',
  severity: 'high',
  selectors: ['path:src/auth/token.js', 'symbol:isRefreshExpired'],
  requiredTestPatterns: ['test/token.test.js'],
  scenarios: [{
    id: 'expired-boundary',
    description: 'exact expiry boundary denies access',
    keywords: ['active token before expiry allows access'],
    failurePathKeywords: ['exact expiry boundary denies access'],
    expected: 'deny'
  }]
}];
