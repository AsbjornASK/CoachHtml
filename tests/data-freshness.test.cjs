const { test } = require('node:test');
const assert = require('node:assert/strict');
const { daysSince, freshnessWarnings, warningText } = require('../static/js/data-freshness.js');

const TODAY = '2026-09-30';

test('daysSince counts whole days between ISO dates', () => {
  assert.equal(daysSince('2026-09-30', TODAY), 0);
  assert.equal(daysSince('2026-09-23', TODAY), 7);
  assert.equal(daysSince('2026-08-31', TODAY), 30);
  assert.equal(daysSince(null, TODAY), null);
});

test('no warnings when weight is exactly 7 days old and body comp exactly 21 days old', () => {
  assert.deepEqual(freshnessWarnings({ today: TODAY, lastWeightDate: '2026-09-23', lastBodyCompDate: '2026-09-09' }), []);
});

test('weight warning only once 7 days are exceeded (8 days)', () => {
  assert.deepEqual(freshnessWarnings({ today: TODAY, lastWeightDate: '2026-09-22', lastBodyCompDate: '2026-09-29' }), [{ kind: 'weight', days: 8 }]);
});

test('body comp warning only once 21 days are exceeded (22 days)', () => {
  assert.deepEqual(freshnessWarnings({ today: TODAY, lastWeightDate: TODAY, lastBodyCompDate: '2026-09-08' }), [{ kind: 'bodyComp', days: 22 }]);
});

test('missing data warns with days null, weight first', () => {
  assert.deepEqual(freshnessWarnings({ today: TODAY, lastWeightDate: null, lastBodyCompDate: null }), [{ kind: 'weight', days: null }, { kind: 'bodyComp', days: null }]);
});

test('warningText matches the Check-in banners', () => {
  assert.equal(warningText({ kind: 'weight', days: 10 }), 'Weight not logged for 10 days');
  assert.equal(warningText({ kind: 'weight', days: null }), 'Weight not logged for over 3 weeks');
  assert.equal(warningText({ kind: 'bodyComp', days: 30 }), 'Body composition not measured for 30 days');
  assert.equal(warningText({ kind: 'bodyComp', days: null }), 'Body composition not measured for over 3 weeks');
});
