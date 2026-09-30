// Runs the TSB baseline helper from api/get-sport-load.js in a sandbox.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '../api/get-sport-load.js'), 'utf8');
const grab = re => { const m = src.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {};
vm.runInNewContext([
  grab(/^const BASELINE_DAYS = .*$/m),
  grab(/^function r1[\s\S]*?$/m),
  grab(/^function r2[\s\S]*?$/m),
  grab(/^function baselineOf\([\s\S]*?^}/m),
  'this.baselineOf = baselineOf; this.BASELINE_DAYS = BASELINE_DAYS;',
].join('\n'), ctx);

test('baseline window is the 42 days before today (today excluded)', () => {
  assert.equal(ctx.BASELINE_DAYS, 42);
  // 50 days: the 42 values before the last one alternate 0 / -2, today is -100
  const tsb = [...Array(7).fill(5), ...Array.from({ length: 42 }, (_, i) => (i % 2 ? -2 : 0)), -100];
  const b = ctx.baselineOf(tsb);
  assert.equal(b.days, 42);
  assert.equal(b.mean, -1);
  assert.equal(b.sd, 1);
});
