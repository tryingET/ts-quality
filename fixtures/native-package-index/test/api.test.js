const { test } = require('node:test');
const assert = require('node:assert/strict');
const { overLimit } = require('../packages/api/src/limit.js');

test('overLimit', () => {
  assert.equal(overLimit(20), true);
  assert.equal(overLimit(1), false);
});
