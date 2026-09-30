// Runs Coach's Fitness / Training Load Ratio helpers (from static/index.html) in a sandbox.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../static/index.html'), 'utf8');
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const block = name => grab(new RegExp(`^function ${name}\\([\\s\\S]*?^}`, 'm'));

const src = [
  grab(/^function fmtN.*$/m),
  grab(/^const TLR_ZONES=[\s\S]*?^\];/m),
  block('tlrHTML'),
  block('fitnessGraph'),
  grab(/^const TAB_LABELS=.*$/m),
  grab(/^const titleFor=.*$/m),
  block('tabData'),
  block('fitnessCardHTML'),
  block('trainingCardsHTML'),
  'this.titleFor = titleFor;', // const bindings aren't put on the vm context by themselves
].join('\n');

const series = [
  { date: '2026-09-29', run: { ctl: 5.5, atl: 9.0, tsb: -3.5 }, strength: { ctl: 2.8, atl: 3.5, tsb: -0.7 } },
  { date: '2026-09-30', run: { ctl: 5.6, atl: 9.3, tsb: -3.7 }, strength: { ctl: 2.9, atl: 3.8, tsb: -1.0 } },
];
const ctx = {
  _lastData: {
    latest: { ctl: 40.2, atl: 52.1, tsb: -11.9, rampRate: 1.8 },
    fitnessHistory: [{ date: '2026-09-29', ctl: 40, atl: 50 }, { date: '2026-09-30', ctl: 40.2, atl: 52.1 }],
  },
  _lastSport: { series },
};
vm.runInNewContext(src, ctx);

test('tabData: overall uses latest, run uses the last sport-series entry', () => {
  assert.equal(ctx.tabData('overall').tsb, -11.9);
  assert.equal(ctx.tabData('overall').rampRate, 1.8);
  const run = ctx.tabData('run');
  assert.deepEqual([run.ctl, run.atl, run.tsb, run.rampRate], [5.6, 9.3, -3.7, null]);
  assert.equal(run.hist.length, 2);
});

test('titleFor adds the sport, except for Overall', () => {
  assert.equal(ctx.titleFor('Fitness', 'overall'), 'Fitness');
  assert.equal(ctx.titleFor('Training Load Ratio', 'run'), 'Training Load Ratio · Run');
});

test('Fitness card for Strength shows strength numbers and no ramp badge', () => {
  const h = ctx.fitnessCardHTML('strength');
  assert.match(h, /Fitness · Strength/);
  assert.match(h, /2,9/);
  assert.doesNotMatch(h, /ramp-badge/);
});

test('Fitness card for Overall keeps the ramp badge in the title', () => {
  assert.match(ctx.fitnessCardHTML('overall'), /ramp-badge/);
});

test('TLR follows the tab: Run TSB lands in Maintenance, Overall in Accumulated fatigue', () => {
  const run = ctx.tlrHTML(ctx.tabData('run').tsb, ctx.titleFor('Training Load Ratio', 'run'));
  assert.match(run, /Training Load Ratio · Run/);
  assert.match(run, /Maintenance/);
  assert.match(run, /-3,7/);
  const overall = ctx.tlrHTML(ctx.tabData('overall').tsb, ctx.titleFor('Training Load Ratio', 'overall'));
  assert.match(overall, />Training Load Ratio</);
  assert.match(overall, /Accumulated fatigue/);
});

test('trainingCardsHTML renders both cards for the same tab', () => {
  const h = ctx.trainingCardsHTML('run');
  assert.match(h, /Fitness · Run/);
  assert.match(h, /Training Load Ratio · Run/);
  assert.match(h, /-3,7/);
});
