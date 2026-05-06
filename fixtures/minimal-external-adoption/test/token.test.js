const assert = require('node:assert/strict');
const { isRefreshExpired, canRefresh } = require('../src/auth/token.js');

const token = { expiresAtMs: 1000 };
assert.equal(canRefresh(token, 999), true, 'active token before expiry allows access');
assert.equal(isRefreshExpired(token, 1000), true, 'exact expiry boundary denies access');
assert.equal(canRefresh(token, 1000), false, 'expired token cannot refresh at boundary');
