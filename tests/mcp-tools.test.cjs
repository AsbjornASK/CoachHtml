// Every MCP tool against a fake Intervals API: paths, defaults, compact output and dry_run.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { fakeClient, runTool } = require('./helpers/fake-intervals.cjs');

let handle;
before(async () => { handle = (await import('../api/_lib/mcp-server.mjs')).handleMessage; });
const run = (client, name, args) => runTool(handle, client, name, args);

const seq = (n, f) => Array.from({ length: n }, (_, i) => f(i));

const RUN_SETTINGS = {
  id: 2, types: ['Run', 'VirtualRun'], lthr: 175, max_hr: 190,
  hr_zones: [148, 156, 165, 174, 179, 184, 190],
  hr_zone_names: ['Recovery', 'Aerobic', 'Tempo', 'SubThreshold', 'SuperThreshold', 'Aerobic Capacity', 'Anaerobic'],
  threshold_pace: 3.8910506, pace_zones: [76.8, 88, 94.3, 100, 103.4, 111.5, 999],
  pace_zone_names: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5a', 'Z5b', 'Z5c'], ftp: null, warmup_time: 300,
};

const HEALTHFIT_RIDE = {
  id: 'i2', type: 'VirtualRide', start_date_local: '2026-11-26T16:05:01', elapsed_time: 1908, moving_time: 1908,
  trainer: true, source: 'OAUTH_CLIENT', oauth_client_name: 'HealthFit', external_id: 'x-MOWL.fit',
  stream_types: ['time', 'heartrate'], average_heartrate: 133, icu_training_load: 23,
};
const GARMIN_RIDE = {
  id: 'i1', type: 'VirtualRide', start_date_local: '2026-11-26T16:04:00', elapsed_time: 1900, moving_time: 1890,
  source: 'GARMIN_CONNECT', stream_types: ['time', 'heartrate', 'watts', 'cadence'], icu_average_watts: 180,
};
const RUN = {
  id: 'i3', type: 'Run', start_date_local: '2026-11-28T13:28:12', elapsed_time: 1979, moving_time: 1977,
  distance: 6019.8, average_speed: 3.041, average_heartrate: 134, trainer: true, icu_training_load: 34,
  icu_hr_zone_times: [1500, 400, 77, 0, 0, 0, 0], name: 'Løb', source: 'OAUTH_CLIENT', oauth_client_name: 'HealthFit',
};

// --- settings ---

test('get_sport_settings returns a compact zone table with paces', async () => {
  const c = fakeClient({ 'GET /sport-settings/Run': RUN_SETTINGS });
  const { data } = await run(c, 'get_sport_settings', { type: 'Run' });
  assert.equal(data.lthr, 175);
  assert.deepEqual(data.hr_zones[0], { name: 'Recovery', from: 0, to: 148, unit: 'bpm' });
  assert.equal(data.threshold_pace.per_km, '4:17/km');
  assert.equal(data.pace_zones.length, 7);
  assert.equal(data.ftp, undefined);
});

test('update_sport_settings dry run shows the diff, warns on generic names and writes nothing', async () => {
  const c = fakeClient({ 'GET /sport-settings/Run': RUN_SETTINGS });
  const { data } = await run(c, 'update_sport_settings', { type: 'Run', hr_zones: [141, 157, 166, 175, 190] });
  assert.equal(data.dry_run, true);
  assert.deepEqual(data.changes.hr_zones, { before: RUN_SETTINGS.hr_zones, after: [141, 157, 166, 175, 190] });
  assert.deepEqual(data.changes.hr_zone_names.after, ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']);
  assert.match(data.warnings[0], /5 zones but 7 names/);
  assert.equal(data.after.hr_zones.length, 5);
  assert.ok(c.calls.every(x => x.method === 'GET'));
});

test('update_sport_settings applies named zones and pace with dry_run=false', async () => {
  const c = fakeClient({
    'GET /sport-settings/Run': RUN_SETTINGS,
    'PUT /sport-settings/Run': (p, body) => ({ ...RUN_SETTINGS, ...body }),
  });
  const names = ['Rolig', 'Let', 'Moderat', 'Hård', 'Max'];
  const { data } = await run(c, 'update_sport_settings', {
    type: 'Run', hr_zones: [141, 157, 166, 175, 190], hr_zone_names: names, threshold_pace: '4:20', dry_run: false,
  });
  assert.equal(data.applied, true);
  const put = c.calls.find(x => x.method === 'PUT');
  assert.equal(put.path, '/sport-settings/Run?recalcHrZones=false');
  assert.deepEqual(put.payload.hr_zone_names, names);
  assert.equal(put.payload.threshold_pace, 1000 / 260);
  assert.deepEqual(data.warnings, []);
});

test('update_sport_settings rejects unordered zones and mismatched names', async () => {
  const c = fakeClient({ 'GET /sport-settings/Run': RUN_SETTINGS });
  assert.match((await run(c, 'update_sport_settings', { type: 'Run', hr_zones: [150, 140] })).error, /strictly increasing/);
  assert.match((await run(c, 'update_sport_settings', { type: 'Run', hr_zones: [141, 190], hr_zone_names: ['a'] })).error, /1 names but there are 2 zones/);
  assert.match((await run(c, 'update_sport_settings', { type: 'Run' })).error, /Nothing to change/);
});

test('update_athlete maps weight and resting HR and is dry by default', async () => {
  const c = fakeClient({ 'GET ': { icu_weight: 74.2, icu_resting_hr: 54 }, 'PUT ': {} });
  const dry = (await run(c, 'update_athlete', { weight: 73.8 })).data;
  assert.deepEqual(dry.changes, { icu_weight: { before: 74.2, after: 73.8 } });
  await run(c, 'update_athlete', { resting_hr: 52, garmin_wellness_keys: ['hrv', 'restingHR'], dry_run: false });
  assert.deepEqual(c.calls.at(-1).payload, { icu_resting_hr: 52, icu_garmin_wellness_keys: ['hrv', 'restingHR'] });
});

// --- activities ---

test('get_activities asks for compact fields and filters by type family', async () => {
  const c = fakeClient({ 'GET /activities': [RUN, HEALTHFIT_RIDE, { ...RUN, id: 'i9', type: 'WeightTraining' }] });
  const { data } = await run(c, 'get_activities', { type: 'Ride', limit: 5 });
  assert.match(c.calls[0].path, /^\/activities\?oldest=2026-11-04&newest=2026-11-18&fields=id%2Ctype%2Cstart_date_local/);
  assert.doesNotMatch(c.calls[0].path, /limit=/);
  assert.equal(data.length, 1);
  assert.equal(data[0].source, 'HealthFit (MOWL)');
  assert.equal(data[0].indoor, true);
  assert.equal(data[0].duration, '31:48');
});

test('get_activities passes custom fields and limit through', async () => {
  const c = fakeClient({ 'GET /activities': [{ id: 'i3', type: 'Run', decoupling: 4.2 }] });
  const { data } = await run(c, 'get_activities', { fields: ['decoupling'], limit: 3 });
  assert.match(c.calls[0].path, /fields=id%2Ctype%2Cstart_date_local%2Cname%2Cdecoupling&limit=3/);
  assert.deepEqual(data, [{ id: 'i3', type: 'Run', decoupling: 4.2 }]);
});

test('get_activity is compact unless verbose', async () => {
  const act = { ...RUN, gap: null, icu_hr_zones: [148, 156], description: 'Tempo', icu_intervals: [{ type: 'WORK', moving_time: 600, average_heartrate: 150, label: 'A', foo: null }] };
  const c = fakeClient({ 'GET ~/activity/i3': act });
  const { data } = await run(c, 'get_activity', { id: 'i3', intervals: true });
  assert.equal(c.calls[0].path, '~/activity/i3?intervals=true');
  assert.equal(data.pace, '5:29/km');
  assert.deepEqual(data.hr_zone_time, ['25:00', '6:40', '1:17', '0:00', '0:00', '0:00', '0:00']);
  assert.deepEqual(data.intervals, [{ label: 'A', type: 'WORK', time: '10:00', avg_hr: 150 }]);
  const verbose = (await run(c, 'get_activity', { id: 'i3', verbose: true })).data;
  assert.equal('gap' in verbose, false);
  assert.equal(verbose.icu_hr_zones.length, 2);
});

test('search_activities filters by type and date after searching', async () => {
  const c = fakeClient({ 'GET /activities/search': [
    { id: 'a', name: 'FTP TEST', type: 'VirtualRide', start_date_local: '2026-10-01T10:00:00', tags: ['test'] },
    { id: 'b', name: 'TEST run', type: 'Run', start_date_local: '2026-10-02T10:00:00' },
    { id: 'c', name: 'old TEST', type: 'Ride', start_date_local: '2025-01-01T10:00:00' },
  ] });
  const { data } = await run(c, 'search_activities', { query: 'TEST', type: 'Ride', oldest: '2026-01-01' });
  assert.match(c.calls[0].path, /q=TEST&limit=200/);
  assert.deepEqual(data.map(r => r.id), ['a']);
  assert.deepEqual(data[0].tags, ['test']);
});

test('update_activity maps rpe and shows a diff before writing', async () => {
  const c = fakeClient({ 'GET ~/activity/i2': HEALTHFIT_RIDE, 'PUT ~/activity/i2': (p, b) => ({ ...HEALTHFIT_RIDE, ...b }) });
  const dry = (await run(c, 'update_activity', { id: 'i2', name: 'Z2', rpe: 4, tags: ['spinning'] })).data;
  assert.equal(dry.dry_run, true);
  assert.deepEqual(Object.keys(dry.changes), ['name', 'icu_rpe', 'tags']);
  assert.equal(c.calls.length, 1);
  const done = (await run(c, 'update_activity', { id: 'i2', rpe: 4, dry_run: false })).data;
  assert.equal(done.applied, true);
  assert.deepEqual(c.calls.at(-1), { method: 'PUT', path: '~/activity/i2', payload: { icu_rpe: 4 } });
});

test('delete_activity only deletes with dry_run=false', async () => {
  const c = fakeClient({ 'GET ~/activity/i2': HEALTHFIT_RIDE, 'DELETE ~/activity/i2': '' });
  assert.equal((await run(c, 'delete_activity', { id: 'i2' })).data.activity.id, 'i2');
  assert.ok(!c.calls.some(x => x.method === 'DELETE'));
  assert.equal((await run(c, 'delete_activity', { id: 'i2', dry_run: false })).data.deleted.id, 'i2');
  assert.ok(c.calls.some(x => x.method === 'DELETE'));
});

test('find_duplicates keeps the Garmin ride with power over the HealthFit copy', async () => {
  const c = fakeClient({ 'GET /activities': [RUN, HEALTHFIT_RIDE, GARMIN_RIDE] });
  const { data } = await run(c, 'find_duplicates', {});
  assert.equal(data.checked, 3);
  assert.equal(data.duplicate_groups, 1);
  assert.equal(data.groups[0].keep.id, 'i1');
  assert.deepEqual(data.groups[0].remove.map(r => r.id), ['i2']);
});

test('find_duplicates prefers HealthFit for runs when streams are equal', async () => {
  const watchletic = { ...RUN, id: 'w', source: 'OAUTH_CLIENT', oauth_client_name: 'Watchletic', stream_types: ['time', 'heartrate'] };
  const healthfit = { ...RUN, id: 'h', start_date_local: '2026-11-28T13:28:40', stream_types: ['time', 'heartrate'] };
  const c = fakeClient({ 'GET /activities': [watchletic, healthfit] });
  const { data } = await run(c, 'find_duplicates', {});
  assert.equal(data.groups[0].keep.id, 'h');
});

test('update_intervals converts seconds to stream indexes and merges by default', async () => {
  const c = fakeClient({
    'GET ~/activity/i1/streams': [{ type: 'time', data: seq(3000, i => i) }],
    'GET ~/activity/i1/intervals': { icu_intervals: [{ id: 1, type: 'WORK', label: 'old', start_index: 0, end_index: 10 }] },
    'PUT ~/activity/i1/intervals': (p, b) => ({ icu_intervals: b }),
  });
  const dry = (await run(c, 'update_intervals', { id: 'i1', intervals: [{ start_secs: 600, end_secs: 3300, label: 'TEST' }] })).data;
  assert.deepEqual(dry.proposed, [{ start_index: 600, end_index: 3000, label: 'TEST', type: 'WORK' }]);
  assert.equal(dry.before[0].label, 'old');
  await run(c, 'update_intervals', { id: 'i1', intervals: [{ start_index: 1, end_index: 5 }], replace: true, dry_run: false });
  assert.equal(c.calls.at(-1).path, '~/activity/i1/intervals?all=true');
  assert.match((await run(c, 'update_intervals', { id: 'i1', intervals: [{ start_index: 5, end_index: 5 }] })).error, /ends before/);
});

// --- analysis ---

test('get_activity_streams downsamples, maps aliases and adds pace', async () => {
  const c = fakeClient({ 'GET ~/activity/i3/streams': [
    { type: 'time', data: seq(60, i => i) },
    { type: 'heartrate', data: seq(60, () => 140) },
    { type: 'velocity_smooth', data: seq(60, () => 1000 / 330) },
    { type: 'watts', data: seq(60, () => null) },
  ] });
  const { data } = await run(c, 'get_activity_streams', { id: 'i3', types: ['hr', 'pace', 'power'] });
  assert.match(c.calls[0].path, /types=time%2Cheartrate%2Cvelocity_smooth%2Cwatts/);
  assert.equal(data.points, 2);
  assert.deepEqual(data.streams.heartrate, [140, 140]);
  assert.deepEqual(data.streams.pace_per_km, ['5:30', '5:30']);
  assert.deepEqual(data.missing, ['watts']);
});

test('analyze_activity on a run: both zone models, Pa:Hr, km splits, meters per beat', async () => {
  const n = 1800;
  const c = fakeClient({
    'GET ~/activity/i3': { ...RUN, icu_hr_zones: [148, 156, 165, 174, 179, 184, 190] },
    'GET ~/activity/i3/streams': [
      { type: 'time', data: seq(n, i => i) },
      { type: 'heartrate', data: seq(n, i => (i < n / 2 ? 135 : 145)) },
      { type: 'velocity_smooth', data: seq(n, () => 3) },
      { type: 'distance', data: seq(n, i => i * 3) },
    ],
  });
  const { data } = await run(c, 'analyze_activity', { id: 'i3', hr_zones: [141, 157, 166, 175, 190] });
  assert.equal(data.hr_zones_intervals.length, 7);
  assert.deepEqual(data.hr_zones_custom.map(z => z.secs), [900, 900, 0, 0, 0]);
  assert.equal(data.decoupling.kind, 'Pa:Hr');
  assert.equal(data.decoupling.pct, 6.9);
  assert.match(data.decoupling.caveat, /Treadmill/);
  assert.equal(data.splits.length, 6);
  assert.equal(data.meters_per_beat, 1.29);
  assert.equal(data.avg_pace, '5:33/km');
  assert.equal(data.power, undefined);
});

test('analyze_activity on a ride: NP, IF and work intervals vs target', async () => {
  const n = 1200;
  const c = fakeClient({
    'GET ~/activity/i1': { ...GARMIN_RIDE, icu_ftp: 250, icu_intervals: [
      { type: 'WORK', label: 'Main', moving_time: 600, average_watts: 225, average_heartrate: 150 },
      { type: 'RECOVERY', moving_time: 300, average_watts: 120 },
    ] },
    'GET ~/activity/i1/streams': [
      { type: 'time', data: seq(n, i => i) },
      { type: 'heartrate', data: seq(n, () => 140) },
      { type: 'watts', data: seq(n, () => 200) },
    ],
  });
  const { data } = await run(c, 'analyze_activity', { id: 'i1', target_pct_ftp: 88 });
  assert.equal(data.power.np, 200);
  assert.equal(data.power.intensity_factor, 0.8);
  assert.equal(data.decoupling.kind, 'Pw:Hr');
  assert.equal(data.decoupling.pct, 0);
  assert.deepEqual(data.power.work_intervals, [{ label: 'Main', time: '10:00', avg_watts: 225, avg_hr: 150, pct_ftp: 90, vs_target_pct: 2 }]);
  assert.equal(data.splits[0].time, '5:00');
});

test('analyze_activity without streams says so', async () => {
  const c = fakeClient({ 'GET ~/activity/i9': { id: 'i9', type: 'WeightTraining' }, 'GET ~/activity/i9/streams': [] });
  assert.match((await run(c, 'analyze_activity', { id: 'i9' })).data.note, /No stream data/);
});

test('get_best_efforts picks the requested durations with date and activity', async () => {
  const c = fakeClient({ 'GET /power-curves': {
    list: [{ secs: [60, 300, 1200, 2700], values: [400, 300, 240, 215], activity_id: ['a', 'b', 'c', 'c'], watts_per_kg: [5.4, 4, 3.2, 2.9] }],
    activities: { c: { start_date_local: '2026-11-01T10:00:00', name: 'Long' } },
  } });
  const { data } = await run(c, 'get_best_efforts', { metric: 'power', durations: [2700, 3600], oldest: '2026-09-01' });
  assert.match(c.calls[0].path, /type=Ride&curves=r\.2026-09-01\.2026-11-18/);
  assert.deepEqual(data.efforts[0], { secs: 2700, duration: '45:00', value: 215, unit: 'W', w_per_kg: 2.9, activity_id: 'c', date: '2026-11-01', name: 'Long' });
  assert.equal(data.efforts[1].value, null);
});

test('get_best_efforts for pace uses distances', async () => {
  const c = fakeClient({ 'GET /pace-curves': { list: [{ distance: [1000, 5000], values: [270, 1500], activity_id: ['r1', 'r2'] }] } });
  const { data } = await run(c, 'get_best_efforts', { metric: 'pace' });
  assert.match(c.calls[0].path, /type=Run/);
  assert.equal(data.efforts[1].pace, '5:00/km');
  assert.equal(data.efforts[1].time, '25:00');
  assert.match(data.efforts[2].note, /Longer/);
});

// --- wellness, fitness, summary ---

test('get_wellness passes fields and keeps the date', async () => {
  const c = fakeClient({ 'GET /wellness': [{ id: '2026-11-18', hrv: 70 }] });
  const { data } = await run(c, 'get_wellness', { fields: ['hrv'] });
  assert.equal(c.calls[0].path, '/wellness?oldest=2026-11-04&newest=2026-11-18&fields=id%2Chrv');
  assert.deepEqual(data, [{ id: '2026-11-18', hrv: 70 }]);
});

test('get_fitness computes form and thins long ranges to weeks', async () => {
  const days = seq(70, i => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10));
  const c = fakeClient({ 'GET /wellness': days.map(d => ({ id: d, ctl: 20, atl: 25, rampRate: 1 })) });
  const { data } = await run(c, 'get_fitness', { oldest: days[0], newest: days.at(-1) });
  assert.equal(data[0].form, -5);
  assert.equal(data[0].form_pct, -25);
  assert.ok(data.length <= 11);
  assert.equal(data.at(-1).date, days.at(-1));
});

test('get_training_summary groups by week with zone time and per-sport totals', async () => {
  const c = fakeClient({ 'GET /activities': [RUN, { ...RUN, start_date_local: '2026-11-23T10:00:00' }, { ...HEALTHFIT_RIDE, icu_hr_zone_times: [100] }] });
  const { data } = await run(c, 'get_training_summary', {});
  assert.deepEqual(data.map(g => g.period), ['2026-11-23']);
  assert.equal(data[0].sessions, 3);
  assert.equal(data[0].load, 91);
  assert.equal(data[0].by_type.Run.sessions, 2);
  assert.equal(data[0].by_type.Ride.sessions, 1);
  assert.equal(data[0].hr_zone_time[0], '51:40');
});

test('update_wellness is dry by default and writes with the date as id', async () => {
  const c = fakeClient({ 'GET /wellness/2026-11-18': { id: '2026-11-18', weight: 74 }, 'PUT /wellness/2026-11-18': {} });
  const dry = (await run(c, 'update_wellness', { date: '2026-11-18', fields: { weight: 73.5 } })).data;
  assert.deepEqual(dry.changes, { weight: { before: 74, after: 73.5 } });
  await run(c, 'update_wellness', { date: '2026-11-18', fields: { weight: 73.5 }, dry_run: false });
  assert.deepEqual(c.calls.at(-1).payload, { weight: 73.5, id: '2026-11-18' });
});

test('get_athlete is compact and lists sport zones', async () => {
  const c = fakeClient({ 'GET ': { id: 'i1', icu_weight: 74.2, icu_resting_hr: 54, icu_garmin_wellness_keys: null, sportSettings: [RUN_SETTINGS], icu_api_key: null } });
  const { data } = await run(c, 'get_athlete', {});
  assert.equal(data.weight_kg, 74.2);
  assert.equal(data.garmin.wellness_keys, 'all');
  assert.equal(data.sports[0].lthr, 175);
});

// --- events ---

test('create_event is dry by default and posts at the start of the day', async () => {
  const c = fakeClient({ 'POST /events': (p, b) => ({ id: 5, ...b }) });
  const dry = (await run(c, 'create_event', { date: '2026-11-20', name: 'Tempo', type: 'Run', load: 50 })).data;
  assert.equal(dry.event.date, '2026-11-20');
  assert.equal(c.calls.length, 0);
  const done = (await run(c, 'create_event', { date: '2026-11-20', name: 'Tempo', type: 'Run', description: '- 20m Z3', load: 50, dry_run: false })).data;
  assert.equal(done.event.id, 5);
  assert.deepEqual(c.calls[0].payload, {
    start_date_local: '2026-11-20T00:00:00', category: 'WORKOUT', name: 'Tempo', type: 'Run', description: '- 20m Z3', icu_training_load: 50,
  });
});

test('update_event and delete_event show the event before changing it', async () => {
  const ev = { id: 7, start_date_local: '2026-11-20T00:00:00', name: 'Tempo', category: 'WORKOUT' };
  const c = fakeClient({ 'GET /events/7': ev, 'PUT /events/7': (p, b) => ({ ...ev, ...b }), 'DELETE /events/7': '' });
  const moved = (await run(c, 'update_event', { id: 7, date: '2026-11-21' })).data;
  assert.deepEqual(moved.changes.start_date_local, { before: '2026-11-20T00:00:00', after: '2026-11-21T00:00:00' });
  assert.equal((await run(c, 'delete_event', { id: 7 })).data.event.name, 'Tempo');
  assert.ok(c.calls.every(x => x.method === 'GET'));
  await run(c, 'delete_event', { id: 7, dry_run: false });
  assert.equal(c.calls.at(-1).method, 'DELETE');
});

test('get_events defaults to the next 14 days', async () => {
  const c = fakeClient({ 'GET /events': [{ id: 1, start_date_local: '2026-11-19T00:00:00', name: 'X', moving_time: 3600 }] });
  const { data } = await run(c, 'get_events', {});
  assert.equal(c.calls[0].path, '/events?oldest=2026-11-18&newest=2026-12-02');
  assert.deepEqual(data, [{ id: 1, date: '2026-11-19', name: 'X', duration: '1:00:00', moving_time: 3600 }]);
});
