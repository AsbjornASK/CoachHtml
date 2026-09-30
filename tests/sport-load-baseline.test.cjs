// Tests the TSB baseline helper from api/_lib/sport-load.mjs.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');

const ctx = {};
before(async () => Object.assign(ctx, await import('../api/_lib/sport-load.mjs')));

test('baseline window is the 42 days before today (today excluded)', () => {
  assert.equal(ctx.BASELINE_DAYS, 42);
  // 50 days: the 42 values before the last one alternate 0 / -2, today is -100
  const tsb = [...Array(7).fill(5), ...Array.from({ length: 42 }, (_, i) => (i % 2 ? -2 : 0)), -100];
  const b = ctx.baselineOf(tsb);
  assert.equal(b.days, 42);
  assert.equal(b.mean, -1);
  assert.equal(b.sd, 1);
});
