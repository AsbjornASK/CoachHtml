const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkinKey, hasCheckinValues } = require('../static/js/checkin-state.js');

test('checkinKey is checkin_<date>', () => {
  assert.equal(checkinKey('2026-09-30'), 'checkin_2026-09-30');
});

test('hasCheckinValues is true when any subjective field is set', () => {
  assert.equal(hasCheckinValues({ mood: null, soreness: null, fatigue: 2, motivation: null }), true);
  assert.equal(hasCheckinValues({ mood: null, soreness: null, fatigue: null, motivation: null }), false);
  assert.equal(hasCheckinValues({ mood: 2 }), false, 'mood is saved to yesterday');
  assert.equal(hasCheckinValues({ mood: null, soreness: null, fatigue: null, motivation: null, injury: 3 }), true);
  assert.equal(hasCheckinValues(null), false);
});
