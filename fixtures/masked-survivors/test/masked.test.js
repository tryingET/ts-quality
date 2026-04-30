const test = require('node:test');
const assert = require('assert/strict');
const {
  requireName,
  hasKindLabel,
  statusGateTruthiness,
  stableFlagTruthiness,
} = require('../src/masked');

test('masked boundary output still routes to missing fallback', () => {
  assert.equal(requireName(''), 'missing');
});

test('masked equality output remains truthy', () => {
  assert.equal(hasKindLabel('known'), true);
});

test('masked combined condition output remains truthy', () => {
  assert.equal(statusGateTruthiness('active'), true);
});

test('masked boolean output remains truthy through fallback', () => {
  assert.equal(stableFlagTruthiness(), true);
});
