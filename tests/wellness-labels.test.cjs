const { test } = require('node:test');
const assert = require('node:assert/strict');
const { WELLNESS, WELLNESS_COLORS, WELLNESS_BTN_CLASSES } = require('../static/js/wellness-labels.js');

test('every wellness field has a name and 4 labels (value 1 = best)', () => {
  assert.deepEqual(Object.keys(WELLNESS), ['mood', 'soreness', 'fatigue', 'motivation', 'stress', 'sleepQuality', 'sickness']);
  for (const f of Object.values(WELLNESS)) {
    assert.equal(typeof f.name, 'string');
    assert.equal(f.labels.length, 4);
  }
  assert.equal(WELLNESS.motivation.labels[2], 'Medium');
});

test('colours and button classes cover values 1–4', () => {
  assert.deepEqual(WELLNESS_COLORS, ['#30d158', '#ff9f0a', '#ff3b30', '#bf5af2']);
  assert.deepEqual(WELLNESS_BTN_CLASSES, ['c-green', 'c-yellow', 'c-red', 'c-purple']);
});
