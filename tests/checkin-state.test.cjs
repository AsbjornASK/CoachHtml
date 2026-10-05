const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TODAY_FIELDS, checkinKey, hasCheckinValues } = require('../static/js/checkin-state.js');
const { WELLNESS } = require('../static/js/wellness-labels.js');

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

test('TODAY_FIELDS are wellness fields not logged against yesterday', () => {
  for (const f of TODAY_FIELDS) {
    assert.ok(WELLNESS[f], f);
    assert.notEqual(WELLNESS[f].day, 'yesterday', f);
  }
});
