// Runs dashboard.html's trend helpers (trendGraph, vo2Summary, plus fmtN) in a sandbox.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../static/dashboard.html'), 'utf8');
// Chart code lives in static/js/charts.js; page-only constants (periods) stay in dashboard.html
const chartsSrc = fs.readFileSync(path.join(__dirname, '../static/js/charts.js'), 'utf8');
const grab = re => { const m = chartsSrc.match(re) ?? html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const block = name => grab(new RegExp(`^function ${name}\\([\\s\\S]*?^}`, 'm'));
// shared date helpers every dashboard function may use
const HELPERS = [grab(/^const DAY_MS = .*$/m), block('isoDaysBefore'), block('fmtDM'),
  grab(/^const emptyMsg = .*$/m), grab(/^const legendItem = .*$/m)].join('\n');
const ctx = Object.assign({}, require('../static/js/wellness-labels.js'));
vm.runInNewContext([HELPERS,
  grab(/^const DAYS_S = .*$/m), grab(/^const MONTHS = .*$/m),
  block('fmtN'), block('fmtDate'),
  grab(/^const WEIGHT_WINDOW = .*$/m),
  grab(/^const VO2_WINDOW = .*$/m), grab(/^const VO2_COLOR = .*$/m),
  grab(/^const DOT_R = .*$/m), grab(/^const AXIS_FS = .*$/m),
  block('trendGraph'),
  block('vo2Summary'),
  'this.WEIGHT_WINDOW = WEIGHT_WINDOW; this.VO2_WINDOW = VO2_WINDOW;',
].join('\n'), ctx);

const TODAY = '2026-09-30';
const cxs = svg => [...svg.matchAll(/<circle cx="([\d.]+)"/g)].map(m => +m[1]);

test('too few values shows what is missing and the window length', () => {
  assert.match(ctx.trendGraph([], TODAY, { field: 'weight', days: 21, empty: 'Too few weight entries' }), /Too few weight entries in the last 21 days/);
  assert.match(ctx.trendGraph([{ date: '2026-09-29', vo2max: 57.7 }], TODAY, { field: 'vo2max', days: 30, empty: 'Too few VO₂ max values' }), /Too few VO₂ max values in the last 30 days/);
});

test('only values inside the window are plotted', () => {
  const series = [{ date: '2026-08-20', vo2max: 60 }, { date: '2026-09-08', vo2max: 59.3 }, { date: '2026-09-29', vo2max: 57.7 }];
  assert.equal(cxs(ctx.trendGraph(series, TODAY, { field: 'vo2max', days: 30 })).length, 2);
});

test('x follows the dates, so a gap between measurements shows as distance', () => {
  const series = [{ date: '2026-09-08', vo2max: 59.3 }, { date: '2026-09-09', vo2max: 59.6 }, { date: '2026-09-29', vo2max: 57.7 }];
  const [a, b, c] = cxs(ctx.trendGraph(series, TODAY, { field: 'vo2max', days: 30 }));
  assert.ok(c - b > 10 * (b - a), `expected a big gap: ${a}, ${b}, ${c}`);
});

test('fixed weekly x axis counted back from today, independent of the measurement dates', () => {
  const svg = ctx.trendGraph([{ date: '2026-09-27', vo2max: 57.66 }, { date: '2026-09-29', vo2max: 57.7 }], TODAY, { field: 'vo2max', days: 30 });
  const ticks = [...svg.matchAll(/class="x-tick"[^>]*>([^<]+)</g)].map(m => m[1]);
  assert.deepEqual(ticks, ['2/9', '9/9', '16/9', '23/9', '30/9']);
});

test('y axis has three value ticks; only the latest point carries a value label', () => {
  const series = [{ date: '2026-09-08', vo2max: 59.3 }, { date: '2026-09-09', vo2max: 59.6 }, { date: '2026-09-27', vo2max: 57.66 }, { date: '2026-09-29', vo2max: 57.7 }];
  const svg = ctx.trendGraph(series, TODAY, { field: 'vo2max', days: 30 });
  assert.equal((svg.match(/class="y-tick"/g) || []).length, 3);
  const pointLabels = [...svg.matchAll(/class="pt-label"[^>]*>([^<]+)</g)].map(m => m[1]);
  assert.deepEqual(pointLabels, ['57,7']);
  assert.match(svg, /<title>[^<]*59,6[^<]*<\/title>/); // every point keeps a tooltip
});

test('weight graph keeps its 21-day window', () => {
  assert.equal(ctx.WEIGHT_WINDOW, 21);
  const svg = ctx.trendGraph([{ date: '2026-09-01', weight: 80.2 }, { date: '2026-09-20', weight: 79.4 }, { date: '2026-09-29', weight: 78.9 }], TODAY, { field: 'weight', days: ctx.WEIGHT_WINDOW });
  assert.equal(cxs(svg).length, 2);
  assert.match(svg, /78,9/);
});

test('vo2Summary: latest value in neutral blue, change since the first value in the window', () => {
  const series = [{ date: '2026-09-08', vo2max: 59.3 }, { date: '2026-09-29', vo2max: 57.7 }];
  const h = ctx.vo2Summary(series, TODAY);
  assert.equal(ctx.VO2_WINDOW, 30);
  assert.match(h, /57,7/);
  assert.match(h, /#007aff/);
  assert.match(h, /−1,6 in 30 days/);
  assert.match(ctx.vo2Summary([{ date: '2026-09-29', vo2max: 54 }], TODAY), /#007aff/); // not judged by level
  assert.doesNotMatch(h, /#30d158|#ff9f0a|#ff3b30/);
  assert.equal(ctx.vo2Summary([], TODAY), '');
});

test('VO₂ max dots are neutral blue', () => {
  assert.ok(/field: 'vo2max', days: VO2_WINDOW, range: VO2_RANGE, color: VO2_COLOR/.test(html));
  assert.ok(/^const VO2_COLOR = '#007aff';/m.test(chartsSrc));
});

// ── Measurement charts: separate, larger dots and larger axis labels ───────
const wellness = require('../static/js/wellness-labels.js');
const charts = {};
vm.runInNewContext([HELPERS,
  grab(/^const DAYS_S = .*$/m), grab(/^const MONTHS = .*$/m),
  grab(/^const FAT_LABELS .*$/m), grab(/^const MOOD_LABELS .*$/m), grab(/^const CHECKIN_COLORS .*$/m),
  grab(/^const DOT_R = .*$/m), grab(/^const AXIS_FS = .*$/m), grab(/^const TIMELINE_DAYS = .*$/m), grab(/^const TL = .*$/m),
  block('fmtN'), block('fmtDate'), block('timelineX'), block('timelineLabels'), block('wellnessLegend'),
  block('hrvCheckinChart'), block('sleepMoodChart'), block('trendGraph'),
].join('\n'), Object.assign(charts, wellness));

const week = Array.from({ length: 7 }, (_, i) => ({ date: `2026-09-2${i + 1}`, hrv: 60 + i, sleep: 7 + i / 10, fatigue: 2, mood: 1 }));
const connectingLines = svg => (svg.match(/stroke-width="2\.2"/g) || []).length;

for (const [name, chart] of [['HRV', () => charts.hrvCheckinChart(week)], ['Sleep', () => charts.sleepMoodChart(week)]]) {
  test(`${name} chart: no lines between days, dots r=${6}, axis labels at the larger size`, () => {
    const svg = chart();
    assert.equal(connectingLines(svg), 0);
    assert.equal((svg.match(/<circle[^>]* r="6"/g) || []).length, 7);
    assert.doesNotMatch(svg, /font-size="9"/);
    assert.match(svg, /font-size="12"/);
  });
}

test('trend graphs (weight, VO₂ max): no connecting line, filled dots r=6, labels at 12 px', () => {
  const svg = charts.trendGraph([{ date: '2026-09-08', vo2max: 59.3 }, { date: '2026-09-29', vo2max: 57.7 }], TODAY, { field: 'vo2max', days: 30 });
  assert.doesNotMatch(svg, /<polyline/);
  assert.equal((svg.match(/<circle[^>]* r="6"/g) || []).length, 2);
  assert.doesNotMatch(svg, /fill="#fff"/);
  assert.doesNotMatch(svg, /font-size="10"/);
  assert.match(svg, /font-size="12"/);
});

// ── Fixed y ranges ─────────────────────────────────────────────────────────
const yTicks = svg => [...svg.matchAll(/class="y-tick"[^>]*>([^<]+)</g)].map(m => m[1]);

test('a fixed range sets the y axis regardless of the data (VO₂ max 55–65)', () => {
  const svg = ctx.trendGraph([{ date: '2026-09-08', vo2max: 59.3 }, { date: '2026-09-29', vo2max: 57.7 }], TODAY, { field: 'vo2max', days: 30, range: [55, 65] });
  assert.deepEqual(yTicks(svg), ['55', '60', '65']);
});

test('weight uses 73–77 kg', () => {
  const svg = ctx.trendGraph([{ date: '2026-09-20', weight: 75.1 }, { date: '2026-09-29', weight: 74.6 }], TODAY, { field: 'weight', days: 21, range: [73, 77] });
  assert.deepEqual(yTicks(svg), ['73', '75', '77']);
});

test('a value outside the fixed range widens the axis to the next whole number', () => {
  const svg = ctx.trendGraph([{ date: '2026-09-20', weight: 75.1 }, { date: '2026-09-29', weight: 78.4 }], TODAY, { field: 'weight', days: 21, range: [73, 77] });
  assert.deepEqual(yTicks(svg), ['73', '76', '79']);
});

// ── Partner vs. alone: one dot per night, no moving-average lines ──────────
test('Partner vs. alone: separate dots per night, no lines, no moving average', () => {
  const pc = { window: { innerWidth: 400 }, root: { innerWidth: 400 } };
  vm.runInNewContext([HELPERS,
    grab(/^const DAYS_S = .*$/m), grab(/^const MONTHS = .*$/m),
    grab(/^const DOT_R = .*$/m), grab(/^const AXIS_FS = .*$/m),
    grab(/^const TIMELINE_DAYS = .*$/m), grab(/^const TL = .*$/m),
    grab(/^const PARTNER_COL = .*$/m), grab(/^const PARTNER_METRICS = \[[\s\S]*?^\];/m),
    block('fmtN'), block('fmtDate'), block('lastDays'), block('timelineX'), block('timelineLabels'), block('partnerCompare'),
  ].join('\n'), pc);
  const series = [
    { date: '2026-09-25', partner: 1, hrv: 70, rhr: 50, sleep: 7.5 },
    { date: '2026-09-26', partner: 2, hrv: 75, rhr: 49, sleep: 8.0 },
    { date: '2026-09-27', partner: 1, hrv: 68, rhr: 51, sleep: 7.2 },
    { date: '2026-09-28', partner: 2, hrv: 77, rhr: 48, sleep: 8.1 },
  ];
  const h = pc.partnerCompare(series, pc.lastDays(series, TODAY, 10));
  assert.doesNotMatch(h, /<polyline/);
  assert.doesNotMatch(h, /[Mm]oving average|avg \d/);
  assert.equal((h.match(/<circle[^>]* r="6"/g) || []).length, 12); // 4 nights × 3 metrics
  assert.match(h, /Each dot is one night/);
  assert.match(h, /fill="#007aff"[^>]*><title>[^<]*(partner)/); // with partner is blue, not red
  assert.doesNotMatch(h, /#ff2d55/);
});

for (const [title, oldTitle, chart, legend, labels] of [
  ['HRV × Fatigue', 'HRV over time', () => charts.hrvCheckinChart(week), 'Fatigue', ['Low', 'Avg', 'High', 'Extreme']],
  ['Sleep × Mood', 'Sleep over time', () => charts.sleepMoodChart(week), 'Mood', ['Great', 'Good', 'Avg', 'Low']],
]) {
  test(`${title}: short "${legend}" legend and the card title names both`, () => {
    const svg = chart();
    assert.ok(svg.includes(`<span class="legend-title">${legend}</span>`));
    assert.doesNotMatch(svg, /coloured by/);
    for (const l of labels) assert.ok(svg.includes(`></div>${l}</div>`), l);
    assert.ok(html.includes(`<div class="card-title">${title}</div>`));
    assert.ok(!html.includes(`>${oldTitle}<`));
  });
}

// ── Form chart and KPI strip removed; daily charts share a 10-day timeline ─
test('Dashboard has no Form chart, no KPI strip and no sport-load call', () => {
  assert.ok(!html.includes('kpi-strip'));
  assert.ok(!html.includes('<div class="card-title">Form</div>'));
  assert.ok(!/function (fitnessCheckinChart|sportFitnessChart|kpiCard)\(/.test(html));
  assert.ok(!html.includes('/api/get-sport-load'));
});

test('lastDays returns the last N calendar days ending today, filling gaps', () => {
  const tl = {};
  vm.runInNewContext(HELPERS + '\n' + grab(/^const TIMELINE_DAYS = .*$/m) + '\n' + block('lastDays') + '\nthis.lastDays = lastDays; this.N = TIMELINE_DAYS;', tl);
  assert.equal(tl.N, 10);
  const days = tl.lastDays([{ date: '2026-09-22', hrv: 1 }, { date: '2026-09-25', hrv: 2 }, { date: '2026-09-30', hrv: 3 }], TODAY, 10);
  assert.deepEqual(Array.from(days, d => d.date), ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30']);
  assert.equal(days[1].hrv, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(days[2])), { date: '2026-09-23' }); // vm objects have another realm's prototype
});

test('HRV, Sleep and Partner charts share the same 10 dates at the same x positions', () => {
  const tl = { window: { innerWidth: 400 }, root: { innerWidth: 400 } };
  vm.runInNewContext([HELPERS,
    grab(/^const DAYS_S = .*$/m), grab(/^const MONTHS = .*$/m),
    grab(/^const FAT_LABELS .*$/m), grab(/^const MOOD_LABELS .*$/m), grab(/^const CHECKIN_COLORS .*$/m),
    grab(/^const DOT_R = .*$/m), grab(/^const AXIS_FS = .*$/m), grab(/^const TIMELINE_DAYS = .*$/m),
    grab(/^const TL = .*$/m), grab(/^const PARTNER_COL = .*$/m), grab(/^const PARTNER_METRICS = \[[\s\S]*?^\];/m),
    block('fmtN'), block('fmtDate'), block('lastDays'), block('timelineX'), block('timelineLabels'), block('wellnessLegend'),
    block('hrvCheckinChart'), block('sleepMoodChart'), block('partnerCompare'),
    'this.DOT_R = DOT_R;',
  ].join('\n'), Object.assign(tl, wellness));
  const series = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(Date.parse('2026-09-17') + i * 864e5).toISOString().slice(0, 10);
    return { date, hrv: 60 + i, sleep: 7 + i / 20, fatigue: 2, mood: 1, rhr: 50, partner: i % 2 ? 1 : 2 };
  }).filter(d => d.date !== '2026-09-26'); // one missing day
  const days = tl.lastDays(series, TODAY, 10);
  const ticks = svg => [...svg.matchAll(/class="x-tick" x="([\d.]+)"[^>]*>([^<]+)</g)].map(m => m[1] + '@' + m[2]);
  const hrv = ticks(tl.hrvCheckinChart(days)), sleep = ticks(tl.sleepMoodChart(days));
  const partner = ticks(tl.partnerCompare(series, days).split('pc-chart-label')[1]);
  assert.equal(hrv.length, 10);
  assert.equal(hrv[0].split('@')[1], '21/9');
  assert.deepEqual(sleep, hrv);
  assert.deepEqual(partner, hrv);
  assert.equal(tl.DOT_R, 6);
});

test('Mood legend has all four colours, matching the dot colours (Low = purple)', () => {
  const svg = charts.sleepMoodChart(week);
  assert.ok(svg.includes('background:#bf5af2"></div>Low</div>'));
  assert.ok(svg.includes('background:#ff3b30"></div>Avg</div>'));
  assert.ok(!svg.includes('Avg/Low'));
});

test('Partner vs. alone: says so when no partner/alone night falls in the 10-day timeline', () => {
  const pc = { window: { innerWidth: 400 }, root: { innerWidth: 400 } };
  vm.runInNewContext([HELPERS,
    grab(/^const DAYS_S = .*$/m), grab(/^const MONTHS = .*$/m),
    grab(/^const DOT_R = .*$/m), grab(/^const AXIS_FS = .*$/m),
    grab(/^const TIMELINE_DAYS = .*$/m), grab(/^const TL = .*$/m),
    grab(/^const PARTNER_COL = .*$/m), grab(/^const PARTNER_METRICS = \[[\s\S]*?^\];/m),
    block('fmtN'), block('fmtDate'), block('lastDays'), block('timelineX'), block('timelineLabels'), block('partnerCompare'),
  ].join('\n'), pc);
  const old = [
    { date: '2026-09-01', partner: 1, hrv: 70, rhr: 50, sleep: 7.5 },
    { date: '2026-09-02', partner: 2, hrv: 75, rhr: 49, sleep: 8.0 },
  ];
  const h = pc.partnerCompare(old, pc.lastDays(old, TODAY, 10));
  assert.match(h, /pc-tile/);                                   // averages still shown
  assert.match(h, /No partner or alone nights logged in the last 10 days/);
});
