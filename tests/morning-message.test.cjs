const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { calcRecovery, calcSleep, calcReadiness } = require('../static/js/readiness.js');

let morningMessage;
before(async () => ({ morningMessage } = await import('../api/_lib/morning-message.mjs')));

const TODAY = '2026-10-05';
const coach = (subjective, latest = { hrv: 90, restingHR: 48, sleepHours: 8, sleepScore: 85, tsb: 2 }) =>
  ({ latest, sleep8: [8, 8, 8, 8], subjective });
const fresh = { lastWeightDate: TODAY, lastBodyCompDate: TODAY };
const run = (t, over = {}) => ({ title: t, timeStart: '17:00', category: 'training', ...over });

test('not checked in → check-in reminder that opens Check-in', () => {
  const m = morningMessage({ coach: coach({ soreness: null, fatigue: null }), ...fresh, todayEvents: [], today: TODAY });
  assert.deepEqual(m, { title: 'Morning check-in', body: "You haven't checked in yet.", url: '/checkin.html' });
});

test('checked in → Readiness with colour and today\'s sessions in start order', () => {
  const c = coach({ soreness: 1, fatigue: 1 });
  const expected = calcReadiness(calcRecovery(90, 48, 8, 2), calcSleep(8, 85, [8, 8, 8, 8]), c.subjective);
  assert.ok(expected >= 65);
  const m = morningMessage({ coach: c, ...fresh, today: TODAY,
    todayEvents: [run('Strength', { timeStart: '18:30' }), run('Easy run', { timeStart: '07:00' }), { title: 'Work', timeStart: '09:00', category: 'work' }] });
  assert.equal(m.title, `Readiness ${expected} 🟢`);
  assert.equal(m.body, 'Today: Easy run 07:00 · Strength 18:30');
  assert.equal(m.url, '/');
});

test('no training today → Rest day; all-day session has no time', () => {
  const c = coach({ fatigue: 2 });
  assert.equal(morningMessage({ coach: c, ...fresh, todayEvents: [], today: TODAY }).body, 'Rest day');
  assert.equal(morningMessage({ coach: c, ...fresh, todayEvents: null, today: TODAY }).body, 'Rest day');
  assert.equal(morningMessage({ coach: c, ...fresh, todayEvents: [run('Long run', { timeStart: null })], today: TODAY }).body, 'Today: Long run');
});

test('missing HRV → Readiness –', () => {
  const m = morningMessage({ coach: coach({ fatigue: 2 }, { hrv: null, restingHR: 50, sleepHours: 7, sleepScore: null, tsb: 0 }), ...fresh, todayEvents: [], today: TODAY });
  assert.equal(m.title, 'Readiness –');
});

test('low readiness is red', () => {
  const low = { hrv: 40, restingHR: 62, sleepHours: 5, sleepScore: 40, tsb: -15 };
  const subj = { fatigue: 4, soreness: 4 };
  assert.ok(calcReadiness(calcRecovery(40, 62, 5, -15), calcSleep(5, 40, [8, 8, 8, 8]), subj) < 45);
  assert.match(morningMessage({ coach: coach(subj, low), ...fresh, todayEvents: [], today: TODAY }).title, /🔴$/);
});

test('stale weight and body comp are added as warning lines (also to the reminder)', () => {
  const m = morningMessage({ coach: coach({ soreness: null }), lastWeightDate: '2026-09-25', lastBodyCompDate: null, todayEvents: [], today: TODAY });
  assert.equal(m.body, "You haven't checked in yet.\n⚠ Weight not logged for 10 days\n⚠ Body composition not measured for over 3 weeks");
});

test('Intervals unavailable → Good morning fallback', () => {
  assert.deepEqual(morningMessage({ coach: null, lastWeightDate: null, lastBodyCompDate: null, todayEvents: [], today: TODAY }),
    { title: 'Good morning', body: "Open Coach for today's readiness.", url: '/' });
});
