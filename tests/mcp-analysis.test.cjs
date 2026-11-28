// Pure helpers behind the MCP tools: formatting and stream analysis.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');

const ctx = {};
before(async () => Object.assign(ctx,
  await import('../api/_lib/mcp/format.mjs'),
  await import('../api/_lib/mcp/analysis.mjs')));

const seq = (n, f) => Array.from({ length: n }, (_, i) => f(i));

test('compact drops nulls recursively', () => {
  assert.deepEqual(ctx.compact({ a: 1, b: null, c: { d: undefined, e: [1, { f: null }] } }), { a: 1, c: { e: [1, {}] } });
});

test('mmss, paceOf and parsePace', () => {
  assert.equal(ctx.mmss(65), '1:05');
  assert.equal(ctx.mmss(3725), '1:02:05');
  assert.equal(ctx.paceOf(1000 / 330), '5:30/km');
  assert.equal(ctx.paceOf(0), null);
  assert.equal(ctx.parsePace('4:17'), 1000 / 257);
  assert.equal(ctx.parsePace(3.5), 3.5);
  assert.throws(() => ctx.parsePace('fast'));
});

test('diff lists only changed fields', () => {
  assert.deepEqual(ctx.diff({ a: 1, z: [1, 2] }, { a: 1, z: [1, 3], n: 5 }), {
    z: { before: [1, 2], after: [1, 3] }, n: { before: null, after: 5 },
  });
});

test('typeMatches treats Ride and Run as families', () => {
  assert.ok(ctx.typeMatches('VirtualRide', 'Ride'));
  assert.ok(ctx.typeMatches('TrailRun', 'Run'));
  assert.ok(!ctx.typeMatches('Ride', 'VirtualRide'));
  assert.ok(!ctx.typeMatches('WeightTraining', 'Run'));
  assert.ok(ctx.typeMatches('Walk'));
});

test('sourceOf names the sync app and the recording app', () => {
  assert.equal(ctx.sourceOf({ source: 'GARMIN_CONNECT' }), 'Garmin');
  assert.equal(ctx.sourceOf({ source: 'OAUTH_CLIENT', oauth_client_name: 'HealthFit', external_id: '2026-11-14-144903-Indoor Cycling-MOWL.fit' }), 'HealthFit (MOWL)');
  assert.equal(ctx.sourceOf({ source: 'OAUTH_CLIENT', oauth_client_name: 'HealthFit', external_id: '2026-11-26-160457-Indoor Cycling-Asbj?rn ? Apple?Watch.fit' }), 'HealthFit (Apple Watch)');
  assert.equal(ctx.sourceOf({ source: 'OAUTH_CLIENT', oauth_client_name: 'Watchletic' }), 'Watchletic');
});

test('activityRow gives pace for runs and the indoor flag', () => {
  const r = ctx.activityRow({ id: 'i1', type: 'Run', moving_time: 1977, distance: 6019.8, average_speed: 3.041, trainer: true, stream_types: ['time', 'heartrate'] });
  assert.equal(r.duration, '32:57');
  assert.equal(r.distance_km, 6.02);
  assert.equal(r.pace, '5:29/km');
  assert.equal(r.indoor, true);
  assert.deepEqual(r.streams, ['heartrate']);
  assert.equal(ctx.activityRow({ type: 'VirtualRide' }).indoor, true);
});

test('downsample averages buckets and keeps cumulative distance', () => {
  const map = { time: seq(60, i => i), heartrate: seq(60, i => (i < 30 ? 100 : 140)), distance: seq(60, i => i * 3) };
  const d = ctx.downsample(map, 30);
  assert.deepEqual(d.time, [0, 30]);
  assert.deepEqual(d.heartrate, [100, 140]);
  assert.deepEqual(d.distance, [87, 177]);
});

test('timeInZones uses upper limits and puts values above the last limit in the last zone', () => {
  const time = seq(6, i => i);
  const z = ctx.timeInZones([120, 141, 142, 170, 195, null], time, [141, 157, 166, 175, 190]);
  assert.deepEqual(z.map(x => x.secs), [2, 1, 0, 1, 1]);
  assert.equal(z[0].range, '0-141');
  assert.equal(z[1].range, '142-157');
  assert.equal(z[0].zone, 'Z1');
});

test('decoupling is positive when HR drifts up at constant output', () => {
  const time = seq(100, i => i * 10);
  const hr = seq(100, i => (i < 50 ? 130 : 140));
  const speed = seq(100, () => 3);
  assert.equal(ctx.decoupling(time, hr, speed), 7.1);
  assert.equal(ctx.decoupling(time, hr, null), null);
});

test('normalizedPower equals steady power and exceeds average for variable power', () => {
  const time = seq(600, i => i);
  assert.equal(ctx.normalizedPower(time, seq(600, () => 200)), 200);
  const surges = seq(600, i => (Math.floor(i / 60) % 2 ? 300 : 100));
  assert.ok(ctx.normalizedPower(time, surges) > 220);
});

test('splits per km and per time', () => {
  const time = seq(601, i => i);
  const map = { time, distance: seq(601, i => i * 3.5), heartrate: seq(601, () => 140) };
  const km = ctx.splits(map, 'km');
  assert.equal(km[0].distance_m, 1001);
  assert.equal(km[0].avg_hr, 140);
  assert.match(km[0].pace, /^4:4\d\/km$/);
  const t = ctx.splits(map, 'time', 300);
  assert.equal(t.length, 2);
  assert.equal(t[0].time, '5:00');
});

test('metersPerBeat divides distance by heartbeats', () => {
  const map = { time: seq(61, i => i), heartrate: seq(61, () => 120), distance: seq(61, i => i * 3) };
  assert.equal(ctx.metersPerBeat(map), 1.48);
  assert.equal(ctx.metersPerBeat({ time: [0, 1], heartrate: [100, 100] }), null);
});

test('slice keeps a time window', () => {
  const s = ctx.slice({ time: [0, 10, 20, 30], heartrate: [1, 2, 3, 4] }, 10, 30);
  assert.deepEqual(s, { time: [10, 20], heartrate: [2, 3] });
});
