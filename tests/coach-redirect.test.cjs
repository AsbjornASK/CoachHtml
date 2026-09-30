// Runs Coach's hasCheckinToday (from static/index.html) with stub localStorage variants.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { checkinKey, hasCheckinValues } = require('../static/js/checkin-state.js');

const html = fs.readFileSync(path.join(__dirname, '../static/index.html'), 'utf8');
const fnSrc = html.match(/^function hasCheckinToday[\s\S]*?^}/m)[0];

function hasCheckinToday(subj, localStorage) {
  const ctx = { checkinKey, hasCheckinValues, localStorage };
  vm.runInNewContext(fnSrc, ctx);
  return ctx.hasCheckinToday(subj);
}

test('not checked in when Intervals and localStorage are empty', () => {
  assert.equal(hasCheckinToday({ mood: null }, { getItem: () => null }), false);
});

test('checked in when Intervals has a subjective value', () => {
  assert.equal(hasCheckinToday({ fatigue: 2 }, { getItem: () => null }), true);
});

test('checked in when this device saved a check-in (Intervals lagging)', () => {
  assert.equal(hasCheckinToday(null, { getItem: () => '{}' }), true);
});

test('blocked localStorage counts as checked in (no redirect loop)', () => {
  assert.equal(hasCheckinToday(null, { getItem: () => { throw new Error('blocked'); } }), true);
});
