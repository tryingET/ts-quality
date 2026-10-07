const { test } = require('node:test');
const assert = require('node:assert/strict');
const { label } = require('../packages/web/src/label.js');

test('label', () => {
  assert.equal(label(1), 'item');
  assert.equal(label(2), 'items');
});
