// HRV level bands (180-day quartiles, API) and the Night/Day HRV rows of the Dashboard's top chart.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const wellness = require('../static/js/wellness-labels.js');

test('quartiles gives [q25, median, q75] rounded to 1 decimal; null with fewer than 8 values', async () => {
  const { quartiles } = await import('../api/_lib/util.mjs');
  assert.deepEqual(quartiles([1, 2, 3, 4, 5, 6, 7, 8, 9]), [3, 5, 7]);
  assert.deepEqual(quartiles([10, 20, null, 30, 40, 50, 60, 70, 80]), [27.5, 45, 62.5]);
  assert.equal(quartiles([1, 2, 3]), null);
});

test('get-dashboard reads 180 days for the bands but still returns ~90 days of series', () => {
  const src = fs.readFileSync(path.join(__dirname, '../api/get-dashboard.mjs'), 'utf8');
  assert.match(src, /const BANDS_DAYS = 180/);
  assert.ok(/return json\(\{[^}]*hrvBands/.test(src));
  assert.match(src, /series\s*=\s*days\.filter\(d => d\.date >= start\)/);
});

// ── Dashboard helpers ─────────────────────────────────────────────────────
const html = fs.readFileSync(path.join(__dirname, '../static/dashboard.html'), 'utf8');
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const block = name => grab(new RegExp(`^function ${name}\\([\\s\\S]*?^}`, 'm'));
// shared date helpers every dashboard function may use
const HELPERS = [grab(/^const DAY_MS = .*$/m), block('isoDaysBefore'), block('fmtDM')].join('\n');
const ctx = Object.assign({ window: { innerWidth: 400 } }, wellness);
vm.runInNewContext([HELPERS,
  grab(/^const DAYS_S = .*$/m), grab(/^const MONTHS = .*$/m), grab(/^const CHECKIN_COLORS .*$/m), grab(/^const STRESS_COLORS = .*$/m),
  grab(/^const STRESS_LABELS = .*$/m), grab(/^const STRESS_SHORT .*$/m), grab(/^const CAT_META = \{[\s\S]*?^\};/m), grab(/^const CAT_KEYS = .*$/m),
  grab(/^const HRV_NORM_DAYS = .*$/m),
  block('fmtN'), block('fmtDate'), block('hrvLevel'), block('hrvNormMark'), block('hrvIcon'), block('hrvCalStressChart'),
  'this.HRV_NORM_DAYS = HRV_NORM_DAYS;', // const bindings aren't put on the vm context by themselves
].join('\n'), ctx);

const BANDS = { night: [86.8, 93, 98.5], day: [63.2, 72.6, 84.1] };

test('hrvLevel: top quartile is 1 (green) … bottom quartile is 4 (purple)', () => {
  assert.equal(ctx.hrvLevel(99, BANDS.night), 1);
  assert.equal(ctx.hrvLevel(95, BANDS.night), 2);
  assert.equal(ctx.hrvLevel(90, BANDS.night), 3);
  assert.equal(ctx.hrvLevel(80, BANDS.night), 4);
  assert.equal(ctx.hrvLevel(80, null), null);
});

// 42 prior days alternating 70 / 80 → mean 75, sd 5
const DATES = Array.from({ length: 43 }, (_, i) => new Date(Date.parse('2026-08-19') + i * 864e5).toISOString().slice(0, 10));
const history = DATES.slice(0, 42).map((date, i) => ({ date, sdnn: i % 2 ? 80 : 70 }));

test('hrvNormMark: ▲ green above, ▼ orange below, grey within ±½ SD of the 42-day norm', () => {
  assert.equal(ctx.HRV_NORM_DAYS, 42);
  const at = v => ctx.hrvNormMark([...history, { date: DATES[42], sdnn: v }], DATES[42], 'sdnn', v);
  assert.deepEqual({ ...at(80) }, { arrow: '▲', color: '#30d158' });
  assert.deepEqual({ ...at(70) }, { arrow: '▼', color: '#ff9f0a' });
  assert.deepEqual({ ...at(76) }, { arrow: '', color: '#8e8e93' });
});

test('hrvNormMark: no arrow with fewer than 7 earlier values', () => {
  const few = history.slice(-5);
  assert.deepEqual({ ...ctx.hrvNormMark(few, DATES[42], 'sdnn', 90) }, { arrow: '', color: '#8e8e93' });
});

test('top chart: moon for Night HRV and sun for Day HRV, coloured by level; numbers carry the norm mark', () => {
  const days = [
    { date: DATES[41], hrv: 99, sdnn: 60 },
    { date: DATES[42], hrv: null, sdnn: 80 },
  ];
  const svg = ctx.hrvCalStressChart(days, [...history, days[1]], BANDS);
  assert.match(svg, />Night HRV</);
  assert.match(svg, />Day HRV</);
  assert.match(svg, /class="hrv-moon"[^>]*fill="#30d158"/);   // 99 ≥ q75 → green
  assert.match(svg, /class="hrv-sun"[^>]*fill="#bf5af2"/);    // 60 < q25 → purple
  assert.match(svg, /class="hrv-sun"[^>]*fill="#ff9f0a"/);    // 80 in 72.6–84.1 → yellow
  assert.match(svg, /fill="#30d158"[^>]*>▲80</);              // above the 42-day norm
  assert.equal((svg.match(/class="hrv-moon"/g) || []).length, 1); // missing night value → no moon
});

test('top chart card is titled "HRV · Calendar · Stress"', () => {
  assert.ok(html.includes('<div class="card-title">HRV · Calendar · Stress</div>'));
  assert.ok(html.includes('hrvCalStressChart(lastDays(series, today, 7), series, data.hrvBands)'));
});
