const { test, before } = require('node:test');
const assert = require('node:assert/strict');

// burdenIndex is an ES module — load via dynamic import
let computeBurden;
before(async () => {
  ({ computeBurden } = await import('../src/shared/utils/burdenIndex.js'));
});

test('empty series returns empty array', async () => {
  assert.deepEqual(computeBurden([]), []);
});

test('all neutral days returns burden near 0', async () => {
  const series = [
    { date: '2026-01-01', stress: 2, fatigue: 2, soreness: 2, injury: null },
    { date: '2026-01-02', stress: 2, fatigue: 2, soreness: 2, injury: null },
  ];
  const result = computeBurden(series);
  assert.ok(Math.abs(result[0].burden) < 0.01, `expected ~0, got ${result[0].burden}`);
  assert.ok(Math.abs(result[1].burden) < 0.01, `expected ~0, got ${result[1].burden}`);
});

test('high stress day increases burden', async () => {
  const series = [
    { date: '2026-01-01', stress: 4, fatigue: 4, soreness: 4, injury: null },
  ];
  const result = computeBurden(series);
  assert.ok(result[0].burden > 0, `expected > 0, got ${result[0].burden}`);
});

test('restorative day decreases burden', async () => {
  const series = [
    { date: '2026-01-01', stress: 4, fatigue: 4, soreness: 4, injury: null },
    { date: '2026-01-02', stress: 1, fatigue: 1, soreness: 1, injury: null },
  ];
  const result = computeBurden(series);
  assert.ok(result[1].burden < result[0].burden, `day2 ${result[1].burden} should be less than day1 ${result[0].burden}`);
});

test('sick day flagged when injury >= 3', async () => {
  const series = [
    { date: '2026-01-01', stress: null, fatigue: null, soreness: null, injury: 3 },
    { date: '2026-01-02', stress: null, fatigue: null, soreness: null, injury: 1 },
  ];
  const result = computeBurden(series);
  assert.equal(result[0].sick, true);
  assert.equal(result[1].sick, false);
});

test('null values treated as neutral (score 0)', async () => {
  const series = [
    { date: '2026-01-01', stress: null, fatigue: null, soreness: null, injury: null },
  ];
  const result = computeBurden(series);
  assert.ok(Math.abs(result[0].burden) < 0.01, `expected ~0, got ${result[0].burden}`);
});
