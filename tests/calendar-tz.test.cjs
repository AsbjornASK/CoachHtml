// api/_lib/calendar.mjs: ICS times with a TZID (e.g. recurring Google Calendar events) are local wall-clock
// times, not UTC. The server runs in UTC, so they must not be parsed with the machine's timezone.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');

const ctx = {};
before(async () => Object.assign(ctx, await import('../api/_lib/calendar.mjs')));

const ics = (start, end) => `BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Run\n${start}\n${end}\nEND:VEVENT\nEND:VCALENDAR`;

test('TZID=Europe/Copenhagen times are Copenhagen wall-clock times', () => {
  const [ev] = ctx.parseICS(ics('DTSTART;TZID=Europe/Copenhagen:20260930T073000', 'DTEND;TZID=Europe/Copenhagen:20260930T083000'));
  const [utc] = ctx.parseICS(ics('DTSTART:20260930T053000Z', 'DTEND:20260930T063000Z'));
  assert.equal(ev.date, '2026-09-30');
  assert.equal(ev.timeStart, utc.timeStart); // 07:30 Copenhagen = 05:30Z (summer time)
  assert.equal(ev.timeEnd, utc.timeEnd);
  assert.equal(ev.durationMin, 60);
});

test('winter time and floating times (no TZID, no Z) are also Copenhagen time', () => {
  const [winter] = ctx.parseICS(ics('DTSTART;TZID=Europe/Copenhagen:20261201T073000', 'DTEND;TZID=Europe/Copenhagen:20261201T080000'));
  const [winterUtc] = ctx.parseICS(ics('DTSTART:20261201T063000Z', 'DTEND:20261201T070000Z'));
  assert.equal(winter.timeStart, winterUtc.timeStart);
  const [floating] = ctx.parseICS(ics('DTSTART:20260930T073000', 'DTEND:20260930T083000'));
  const [utc] = ctx.parseICS(ics('DTSTART:20260930T053000Z', 'DTEND:20260930T063000Z'));
  assert.equal(floating.timeStart, utc.timeStart);
});

test('another TZID is honoured', () => {
  const [ny] = ctx.parseICS(ics('DTSTART;TZID=America/New_York:20260930T013000', 'DTEND;TZID=America/New_York:20260930T023000'));
  const [utc] = ctx.parseICS(ics('DTSTART:20260930T053000Z', 'DTEND:20260930T063000Z'));
  assert.equal(ny.timeStart, utc.timeStart); // 01:30 EDT = 05:30Z
  assert.equal(ny.date, '2026-09-30');
});
