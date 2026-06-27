const test = require('node:test');
const assert = require('node:assert/strict');
const { generatePosId } = require('../src/utils/helpers');

test('generatePosId returns unique values even when the clock repeats', () => {
  const originalDateNow = Date.now;
  Date.now = () => 1710000000000;

  try {
    const ids = Array.from({ length: 5 }, () => generatePosId());
    assert.equal(new Set(ids).size, ids.length);
  } finally {
    Date.now = originalDateNow;
  }
});
