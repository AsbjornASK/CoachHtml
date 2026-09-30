// Tests sessionsOf from api/_lib/sport-load.mjs: the per-session list behind the Sessions tab on data.html.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const ctx = {};
before(async () => Object.assign(ctx, await import('../api/_lib/sport-load.mjs')));

const act = (date, extra = {}) => ({ start_date_local: date + 'T07:00:00', type: 'Run', ...extra });

test('keeps the last 90 days (today included), oldest first', () => {
  const s = ctx.sessionsOf([act('2026-09-30'), act('2026-07-03'), act('2026-07-02'), act('2026-09-01')], '2026-09-30');
  assert.deepEqual(s.map(x => x.date), ['2026-07-03', '2026-09-01', '2026-09-30']);
});

test('maps activity types to sports', () => {
  const types = ['TrailRun', 'Run', 'WeightTraining', 'VirtualRide', 'Ride', 'Walk'];
  const s = ctx.sessionsOf(types.map(type => act('2026-09-30', { type })), '2026-09-30');
  assert.deepEqual(s.map(x => x.sport), ['run', 'run', 'strength', 'ride', 'ride', 'other']);
});

test('minutes are moving_time / 60 with 1 decimal', () => {
  const [s] = ctx.sessionsOf([act('2026-09-30', { moving_time: 2000 })], '2026-09-30');
  assert.equal(s.minutes, 33.3);
});

test('zones: easy = Z1+Z2, moderate = Z3, hard = Z4 and above, in minutes', () => {
  const [s] = ctx.sessionsOf([act('2026-09-30', { icu_hr_zone_times: [600, 300, 120, 60, 30, 0, 0] })], '2026-09-30');
  assert.deepEqual(s.zones, { easy: 15, moderate: 2, hard: 1.5 });
});

test('copies load, heart rate and RPE', () => {
  const [s] = ctx.sessionsOf([act('2026-09-30', { icu_training_load: 42, average_heartrate: 151, icu_rpe: 6 })], '2026-09-30');
  assert.equal(s.load, 42);
  assert.equal(s.avgHr, 151);
  assert.equal(s.rpe, 6);
});

test('missing fields become null', () => {
  const [s] = ctx.sessionsOf([act('2026-09-30', { icu_hr_zone_times: [] })], '2026-09-30');
  assert.deepEqual(s, { date: '2026-09-30', sport: 'run', load: null, minutes: null, avgHr: null, rpe: null, zones: null });
});

test('activities without a date are skipped', () => {
  const s = ctx.sessionsOf([{ type: 'Run', icu_training_load: 10 }, act('2026-09-30')], '2026-09-30');
  assert.equal(s.length, 1);
});

test('GET /api/get-sport-load returns the last 150 days of sessions (RPE × heart rate uses them all)', () => {
  const src = fs.readFileSync(require.resolve('../api/get-sport-load.mjs'), 'utf8');
  assert.match(src, /^const SESSION_DAYS = 150;/m);
  assert.ok(src.includes('sessions: sessionsOf(activities, end, SESSION_DAYS)'));
});
