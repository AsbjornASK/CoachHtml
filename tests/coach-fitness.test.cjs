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
  grab(/^const TLR_MIN_SD=.*$/m),
  grab(/^const TLR_Z_BOUNDS=.*$/m),
  grab(/^const TLR_Z_ZONES=.*$/m),
  block('tlrCardHTML'),
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
  _lastSport: { series, baseline: { run: { mean: -1.4, sd: 1.7, days: 42 }, strength: { mean: -0.8, sd: 0.8, days: 42 } } },
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

test('TLR Overall keeps TSB against the fixed zones', () => {
  const h = ctx.trainingCardsHTML('overall');
  assert.match(h, />Training Load Ratio</);
  assert.match(h, /Accumulated fatigue/);
  assert.match(h, /-11,9/);
});

test('TLR Run: zone from z vs the 42-day baseline, card shows TSB and the norm', () => {
  const h = ctx.trainingCardsHTML('run');
  assert.match(h, /Training Load Ratio · Run/);
  assert.match(h, /Accumulated fatigue/); // z = (-3.7 - -1.4) / 1.7 = -1.35
  assert.match(h, />-3,7</);
  assert.ok(h.includes('1,4 SD below your 42-day norm (-1,4 ± 1,7)'));
});

// Renders the Run cards with a temporary Run baseline, restoring the shared one even if an assertion throws
function runCardsWith(baseline) {
  const saved = ctx._lastSport.baseline.run;
  ctx._lastSport.baseline.run = baseline;
  try { return ctx.trainingCardsHTML('run'); } finally { ctx._lastSport.baseline.run = saved; }
}

test('TLR sport zones: z within ±0.5 is Maintenance, above +1 is Tapered', () => {
  assert.match(runCardsWith({ mean: -3.5, sd: 1.0, days: 42 }), /Maintenance/);
  assert.match(runCardsWith({ mean: -6, sd: 1.0, days: 42 }), /Tapered/);
});

test('TLR sport shows Not enough load when its TSB barely varies', () => {
  assert.match(runCardsWith({ mean: -1.4, sd: 0.1, days: 42 }), /Not enough load/);
});

test('TLR Strength gets a zone even at a small CTL (2.9) when its baseline is valid', () => {
  const h = ctx.trainingCardsHTML('strength');
  assert.match(h, /Training Load Ratio · Strength/);
  assert.match(h, /Maintenance/); // z = (-1.0 - -0.8) / 0.8 = -0.25
  assert.doesNotMatch(h, /Not enough load/);
});

test('trainingCardsHTML renders both cards for the same tab', () => {
  const h = ctx.trainingCardsHTML('run');
  assert.match(h, /Fitness · Run/);
  assert.match(h, /Training Load Ratio · Run/);
  assert.match(h, /-3,7/);
});

test('fitnessGraph: a sport with no load in the lookback gives the empty state, not a NaN chart', () => {
  const zeros = [{ date: '2026-09-28', ctl: 0, atl: 0 }, { date: '2026-09-29', ctl: 0, atl: 0 }, { date: '2026-09-30', ctl: 0, atl: 0 }];
  const out = ctx.fitnessGraph(zeros);
  assert.doesNotMatch(out, /NaN|Infinity/);
  assert.equal(out, '');
});
