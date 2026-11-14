// Pure server helpers extracted from get-coach / get-vitals / get-calendar.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');

const ctx = {};
before(async () => Object.assign(ctx,
  await import('../api/_lib/coach-data.mjs'),
  await import('../api/_lib/intervals.mjs'),
  await import('../api/_lib/calendar.mjs')));

const day = (date, over = {}) => ({ id: date, restingHR: 50, hrv: 70, sleepSecs: 7.5 * 3600, ctl: 40, atl: 45, ...over });

test('coachData builds the Coach payload from parsed days', () => {
  const days = ctx.parseDays([day('2026-10-04'), day('2026-10-05', { soreness: 2, fatigue: 1, injury: 1 })]);
  const c = ctx.coachData(days, [{ type: 'Run' }], '2026-10-05');
  assert.equal(c.today, '2026-10-05');
  assert.equal(c.latest.date, '2026-10-05');
  assert.equal(c.latest.hrv, 70);
  assert.equal(c.latest.tsb, -5);
  assert.deepEqual(c.subjective, { mood: null, soreness: 2, fatigue: 1, motivation: null, injury: 1 });
  assert.equal(c.trends.hrv.length, 2);
  assert.deepEqual(c.sleep8, [7.5, 7.5]);
  assert.deepEqual(c.activities, [{ type: 'Run' }]);
});

test('freshnessDates finds the last weight and last body composition', () => {
  const days = ctx.parseDays([
    day('2026-10-01', { weight: 78, bodyFat: 15 }),
    day('2026-10-03', { weight: 78.2 }),
    day('2026-10-04'),
  ]);
  assert.deepEqual(ctx.freshnessDates(days), { lastWeightDate: '2026-10-03', lastBodyCompDate: '2026-10-01' });
  assert.deepEqual(ctx.freshnessDates([]), { lastWeightDate: null, lastBodyCompDate: null });
});

test('calendarEvents is null without configured calendars', async () => {
  for (const k of Object.keys(process.env)) if (/_ICS_URL$/.test(k)) delete process.env[k];
  assert.equal(await ctx.calendarEvents(new Date('2026-10-05T06:00:00Z')), null);
});
