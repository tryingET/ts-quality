const assert = require('node:assert/strict');
const { isRefreshExpired, refreshSubject } = require('../dist/token.js');

const token = { subject: 'user-123', expiresAtMs: 1000 };
assert.equal(isRefreshExpired(token, 999), false, 'active token before expiry allows access');
assert.equal(isRefreshExpired(token, 1000), true, 'exact expiry boundary denies access');
assert.equal(refreshSubject(token), 'user-123', 'subject stays attached to the refresh token');
