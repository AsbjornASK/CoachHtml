const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sessionStatuses, hhmm } = require('../static/js/session-status.js');

const ev = (title, timeStart, timeEnd, category = 'training') => ({ title, date: '2026-09-30', timeStart, timeEnd, category });

test('hhmm normalizes da-DK and colon times', () => {
  assert.equal(hhmm('16.00'), '1600');
  assert.equal(hhmm('7:05'), '0705');
  assert.equal(hhmm(null), null);
});

test('only training events are returned, sorted by start time', () => {
  const out = sessionStatuses([ev('Strength 2', '16.00', '17.30'), ev('Work', '09.00', '18.00', 'work'), ev('Easy Run', '07.00', '08.00')], [], '0600');
  assert.deepEqual(out.map(e => e.title), ['Easy Run', 'Strength 2']);
});

test('matching activity gives done', () => {
  const out = sessionStatuses([ev('Cykeltur', '16.00', '18.00')], [{ type: 'Ride' }], '1200');
  assert.equal(out[0].status, 'done');
});

test('run matches any Run variant, strength matches WeightTraining', () => {
  const out = sessionStatuses([ev('Trail run', '07.00', '08.00'), ev('Strength 2', '16.00', '17.00')], [{ type: 'TrailRun' }, { type: 'WeightTraining' }], '2000');
  assert.deepEqual(out.map(e => e.status), ['done', 'done']);
});

test('no activity: planned before end time, missed after', () => {
  assert.equal(sessionStatuses([ev('Strength 2', '16.00', '17.30')], [], '1729')[0].status, 'planned');
  assert.equal(sessionStatuses([ev('Strength 2', '16.00', '17.30')], [], '1730')[0].status, 'missed');
});

test('each activity matches only one session', () => {
  const out = sessionStatuses([ev('Run AM', '07.00', '08.00'), ev('Run PM', '17.00', '18.00')], [{ type: 'Run' }], '2000');
  assert.deepEqual(out.map(e => e.status), ['done', 'missed']);
});

test('untimed event is never missed', () => {
  assert.equal(sessionStatuses([ev('Strength', null, null)], [], '2359')[0].status, 'planned');
});

test('unknown sport title gets no status', () => {
  assert.equal(sessionStatuses([ev('Yoga', '07.00', '08.00')], [{ type: 'Yoga' }], '2000')[0].status, null);
});

test('activities null (API failed) gives no status at all', () => {
  const out = sessionStatuses([ev('Strength 2', '16.00', '17.30')], null, '2000');
  assert.equal(out[0].status, null);
});

test('sportOf maps titles to run / strength / ride, else null', () => {
  const { sportOf } = require('../static/js/session-status.js');
  assert.equal(sportOf('Easy Run'), 'run');
  assert.equal(sportOf('Strength 2'), 'strength');
  assert.equal(sportOf('Cykeltur'), 'ride');
  assert.equal(sportOf('Yoga'), null);
});

test('sportOf matches sport words at a word start, not inside other words', () => {
  const { sportOf } = require('../static/js/session-status.js');
  assert.equal(sportOf('Crunches & core'), null);
  assert.equal(sportOf('Strides'), null);
  assert.equal(sportOf('Running intervals'), 'run');
  assert.equal(sportOf('Cykeltur'), 'ride');
});
