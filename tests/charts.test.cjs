// static/js/charts.js as a module: exports, and the layout parameter for wide pages.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

globalThis.innerWidth = 400; // hrvCalStressChart reads the screen width from the global object
const charts = require('../static/js/charts.js');

test('exports the shared chart functions and constants', () => {
  for (const name of ['lastDays', 'timelineX', 'timelineLabels', 'wellnessLegend', 'hrvCheckinChart', 'sleepMoodChart',
    'partnerCompare', 'trendGraph', 'vo2Summary', 'hrvCalStressChart', 'fmtDM', 'fmtDate', 'DOT_R', 'AXIS_FS', 'TL',
    'WEIGHT_RANGE', 'VO2_RANGE', 'VO2_COLOR']) {
    assert.ok(name in charts, name);
  }
});

test('timelineX: default layout is the Dashboard geometry; a wide layout scales it', () => {
  assert.equal(charts.timelineX(0, 10), 46);
  assert.equal(charts.timelineX(9, 10), 488);
  const wide = { W: 900, PDL: 46, PDR: 12 };
  assert.equal(charts.timelineX(0, 30, wide), 46);
  assert.equal(charts.timelineX(29, 30, wide), 888);
});

test('timeline charts use the layout width for the viewBox and the date positions', () => {
  const days = charts.lastDays([{ date: '2026-09-30', hrv: 70, sleep: 7.5, fatigue: 2, mood: 1 }], '2026-09-30', 30)
    .map((d, i) => ({ hrv: 60 + (i % 5), sleep: 7 + (i % 3) / 10, fatigue: 2, mood: 1, ...d }));
  const wide = { W: 900, PDL: 46, PDR: 12 };
  for (const chart of [charts.hrvCheckinChart, charts.sleepMoodChart]) {
    const svg = chart(days, wide);
    assert.match(svg, /viewBox="0 0 900 /);
    const xs = [...svg.matchAll(/class="x-tick" x="([\d.]+)"/g)].map(m => +m[1]);
    assert.equal(xs.length, 15);          // every second day beyond 20 days
    assert.equal(xs[xs.length - 1], 888); // today is always labelled
  }
});

test('Dashboard loads wellness-labels.js before charts.js and keeps only its periods', () => {
  const html = fs.readFileSync(path.join(__dirname, '../static/dashboard.html'), 'utf8');
  const i = html.indexOf('/js/wellness-labels.js'), j = html.indexOf('/js/charts.js');
  assert.ok(i > 0 && j > i);
  assert.ok(!/^function (hrvCheckinChart|trendGraph|partnerCompare|hrvCalStressChart)\(/m.test(html));
  assert.match(html, /^const TIMELINE_DAYS = 10;/m);
});

// ── Label spacing on long windows (review findings) ────────────────────────
const xTicks = svg => [...svg.matchAll(/class="x-tick" x="([\d.]+)"/g)].map(m => +m[1]);
const minGap = xs => Math.min(...xs.slice(1).map((x, i) => x - xs[i]));

test('trendGraph over 90 days: date ticks far enough apart to not overlap', () => {
  const series = Array.from({ length: 90 }, (_, i) => ({ date: charts.isoDaysBefore('2026-09-30', 89 - i), weight: 75 + (i % 3) / 10 }));
  for (const W of [320, 440]) {
    const xs = xTicks(charts.trendGraph(series, '2026-09-30', { field: 'weight', days: 90, range: [73, 77], W }));
    assert.ok(minGap(xs) >= 40, `W=${W}: min gap ${minGap(xs)}`);
  }
});

test('trendGraph keeps weekly ticks for the Dashboard windows (21 and 30 days)', () => {
  const series = [{ date: '2026-09-20', weight: 75 }, { date: '2026-09-29', weight: 74.6 }];
  assert.equal(xTicks(charts.trendGraph(series, '2026-09-30', { field: 'weight', days: 21 })).length, 4);
  assert.equal(xTicks(charts.trendGraph(series, '2026-09-30', { field: 'weight', days: 30 })).length, 5);
});

test('trendGraph accepts a width option (default 320)', () => {
  const series = [{ date: '2026-09-20', weight: 75 }, { date: '2026-09-29', weight: 74.6 }];
  assert.match(charts.trendGraph(series, '2026-09-30', { field: 'weight', days: 21 }), /viewBox="0 0 320 /);
  assert.match(charts.trendGraph(series, '2026-09-30', { field: 'weight', days: 21, W: 440 }), /viewBox="0 0 440 /);
});

test('timeline labels: every day up to 20 days, every second day (ending today) beyond', () => {
  const tenDays = charts.lastDays([], '2026-10-12', 10);
  assert.equal(xTicks(charts.timelineLabels(tenDays, 0)).length, 10);
  const wide = { W: 900, PDL: 46, PDR: 12 };
  const month = charts.lastDays([], '2026-10-12', 30);
  const svg = charts.timelineLabels(month, 0, wide);
  const xs = xTicks(svg);
  assert.equal(xs.length, 15);
  assert.equal(xs[xs.length - 1], 888);          // today is always labelled
  assert.match(svg, />12\/10</);
  assert.ok(minGap(xs) >= 50, `min gap ${minGap(xs)}`);
});
