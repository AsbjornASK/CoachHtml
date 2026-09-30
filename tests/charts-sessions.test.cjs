// The Sessions tab charts in static/js/charts.js: Load × Day HRV, RPE × heart rate, heart-rate zones per week.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const charts = require('../static/js/charts.js');
const { SPORT_COLORS, WELLNESS_COLORS } = { ...require('../static/js/wellness-labels.js'), ...charts };

const TODAY = '2026-09-30';
const count = (s, re) => (s.match(re) || []).length;
const noSmallFonts = svg => {
  assert.match(svg, /font-size="12"/);
  assert.doesNotMatch(svg, /font-size="(9|10)"/);
};

// ── loadHrvChart ─────────────────────────────────────────────────────────────
// 20 days of Day HRV around 60 ms (norm), then a high value on 29/9 (the morning after 28/9)
const series = Array.from({ length: 30 }, (_, i) => ({ date: charts.isoDaysBefore(TODAY, 29 - i), sdnn: 58 + (i % 5) }));
series.find(d => d.date === '2026-09-29').sdnn = 90;
const days = charts.lastDays(series, TODAY, 30);

test('loadHrvChart: two sessions on one day stack as two bars in their sport colours', () => {
  const sessions = [
    { date: '2026-09-28', sport: 'run', load: 40, minutes: 45 },
    { date: '2026-09-28', sport: 'strength', load: 20, minutes: 30 },
  ];
  const svg = charts.loadHrvChart(days, sessions, series);
  const bars = [...svg.matchAll(/<rect class="load-bar" x="([\d.]+)" y="([\d.]+)" width="[\d.]+" height="([\d.]+)" fill="([^"]+)"/g)];
  assert.equal(bars.length, 2);
  assert.deepEqual(bars.map(b => b[4]).sort(), [SPORT_COLORS.run, SPORT_COLORS.strength].sort());
  assert.equal(bars[0][1], bars[1][1]); // same day column
  // stacked: the upper bar ends where the lower one starts
  const [lower, upper] = bars.map(b => ({ y: +b[2], h: +b[3] })).sort((a, b) => b.y - a.y);
  assert.ok(Math.abs(upper.y + upper.h - lower.y) < 0.2);
  // the tooltip lists both sessions
  assert.match(svg, /<title>[^<]*Run[^<]*Strength[^<]*<\/title>/);
  noSmallFonts(svg);
});

test('loadHrvChart: next-morning Day HRV dot, ▲ colour when above the norm; none after the last day', () => {
  const sessions = [{ date: '2026-09-28', sport: 'run', load: 40 }, { date: TODAY, sport: 'run', load: 30 }];
  const svg = charts.loadHrvChart(days, sessions, series);
  const dots = [...svg.matchAll(/<circle class="hrv-next" cx="([\d.]+)" cy="[\d.]+" r="6" fill="([^"]+)"/g)];
  const x28 = charts.timelineX(27, 30).toFixed(1); // 28/9 is day 27 of 0–29
  const dot28 = dots.find(d => d[1] === x28);
  assert.ok(dot28, 'dot for 28/9 (SDNN of 29/9)');
  assert.equal(dot28[2], WELLNESS_COLORS[0]);
  assert.ok(!dots.some(d => d[1] === charts.timelineX(29, 30).toFixed(1)), 'no dot for today');
});

test('loadHrvChart: empty message without sessions in the window', () => {
  assert.match(charts.loadHrvChart(days, [], series), /No training sessions in the last 30 days/);
  assert.match(charts.loadHrvChart(days, [{ date: '2026-06-01', sport: 'run', load: 10 }], series), /No training sessions/);
});

// ── rpeHrScatter ─────────────────────────────────────────────────────────────
const rpeSessions = [
  { date: '2026-09-01', sport: 'run', avgHr: 140, rpe: 4 },
  { date: '2026-09-02', sport: 'run', avgHr: 150, rpe: 5 },
  { date: '2026-09-03', sport: 'ride', avgHr: 130, rpe: 3, minutes: 60 },
  { date: '2026-09-04', sport: 'strength', avgHr: 120, rpe: 6 },
  { date: '2026-09-05', sport: 'run', avgHr: 165, rpe: 8 },
  { date: '2026-09-06', sport: 'run', avgHr: null, rpe: 7 },
  { date: '2026-09-07', sport: 'run', avgHr: 150, rpe: null },
];

test('rpeHrScatter: dots only for sessions with both RPE and heart rate, plus a dashed trend line', () => {
  const svg = charts.rpeHrScatter(rpeSessions);
  assert.equal(count(svg, /<circle class="rpe-dot"/g), 5);
  assert.match(svg, /<circle class="rpe-dot"[^>]*fill="#5856d6"/); // strength colour
  assert.match(svg, /<line class="trend"[^>]*stroke-dasharray/);
  assert.match(svg, /Dots above the line felt harder than the heart rate suggests/);
  noSmallFonts(svg);
});

test('rpeHrScatter: fewer than 5 usable sessions gives the empty message', () => {
  assert.match(charts.rpeHrScatter(rpeSessions.slice(0, 4).concat(rpeSessions.slice(5))), /Not enough sessions with RPE and heart rate yet/);
});

// ── zoneWeeksChart ───────────────────────────────────────────────────────────
test('zoneWeeksChart: 12 Monday-based weeks, easy share on top, – for empty weeks', () => {
  const sessions = [
    // week of Mon 28/9 (today is Wed 30/9): 78 % easy
    { date: '2026-09-28', sport: 'run', zones: { easy: 60, moderate: 10, hard: 5 } },
    { date: '2026-09-30', sport: 'ride', minutes: 60, zones: { easy: 18, moderate: 7, hard: 0 } },
    // Sunday 27/9 belongs to the week before (Mon 21/9): 50 %
    { date: '2026-09-27', sport: 'run', zones: { easy: 10, moderate: 0, hard: 10 } },
    { date: '2026-09-26', sport: 'run', zones: null },
  ];
  const svg = charts.zoneWeeksChart(sessions, TODAY);
  const weeks = svg.split('<g class="week"').slice(1);
  assert.equal(weeks.length, 12);
  assert.match(weeks[11], />28\/9</);
  assert.match(weeks[11], />78 %</);
  assert.match(weeks[10], />21\/9</);
  assert.match(weeks[10], />50 %</);
  assert.match(weeks[0], />13\/7</);
  assert.match(weeks[0], />–</);
  assert.match(svg, /Goal: about 80 % easy/);
  noSmallFonts(svg);
});

test('zoneWeeksChart: empty message without any zone data', () => {
  assert.match(charts.zoneWeeksChart([], TODAY), /No heart-rate zone data/);
});

test('exports SPORT_COLORS and the three chart functions', () => {
  assert.deepEqual(charts.SPORT_COLORS, { run: '#007aff', ride: '#5ac8fa', strength: '#5856d6', other: '#aeaeb2' });
  for (const f of ['loadHrvChart', 'rpeHrScatter', 'zoneWeeksChart']) assert.equal(typeof charts[f], 'function', f);
});

test('loadHrvChart: right-axis SDNN labels ("100 ms", ~40 px at 12 px) fit inside the viewBox', () => {
  const hi = series.map(d => ({ ...d, sdnn: d.sdnn + 40 }));
  const svg = charts.loadHrvChart(charts.lastDays(hi, TODAY, 30), [{ date: '2026-09-28', sport: 'run', load: 40 }], hi, { W: 900, PDL: 46, PDR: 12 });
  const vbW = +svg.match(/viewBox="0 0 ([\d.]+) /)[1];
  const xs = [...svg.matchAll(/<text x="([\d.]+)"[^>]*>(\d+) ms</g)].map(m => +m[1] + m[2].length * 7.5 + 3 * 7.5);
  assert.ok(xs.length === 3 && Math.max(...xs) <= vbW, `labels end at ${Math.max(...xs)}, viewBox ${vbW}`);
});

// Run-heavy fixture for the sport filter: 6 runs, 2 rides, 1 strength, 2 "other" (never shown)
const mixed = [
  ...[130, 140, 150, 155, 160, 170].map((hr, i) => ({ date: '2026-09-1' + i, sport: 'run', avgHr: hr, rpe: 3 + i })),
  { date: '2026-09-20', sport: 'ride', avgHr: 120, rpe: 3, minutes: 60 }, { date: '2026-09-21', sport: 'ride', avgHr: 125, rpe: 4, minutes: 60 },
  { date: '2026-09-22', sport: 'strength', avgHr: 110, rpe: 6 },
  { date: '2026-09-23', sport: 'other', avgHr: 100, rpe: 2 }, { date: '2026-09-24', sport: 'other', avgHr: 105, rpe: 2 },
];

test('rpeHrScatter: "other" sessions are never shown', () => {
  const svg = charts.rpeHrScatter(mixed);
  assert.equal(count(svg, /<circle class="rpe-dot"/g), 9);
  assert.doesNotMatch(svg, /<circle class="rpe-dot"[^>]*fill="#aeaeb2"/);
  assert.doesNotMatch(svg, />Other</);
});

test('rpeHrScatter: a sport filter shows only that sport, with its own trend line or empty message', () => {
  const run = charts.rpeHrScatter(mixed, charts.TL, 'run');
  assert.equal(count(run, /<circle class="rpe-dot"/g), 6);
  assert.equal(count(run, new RegExp('class="rpe-dot"[^>]*fill="' + SPORT_COLORS.run + '"', 'g')), 6); // all dots are runs
  assert.match(run, /<line class="trend"/);
  assert.match(charts.rpeHrScatter(mixed, charts.TL, 'ride'), /Not enough ride sessions with RPE and heart rate yet/);
});

test('rpeHrScatter: rides only count when longer than 40 minutes (also under "All")', () => {
  const rides = [
    ...[41, 45, 60, 90, 120].map((m, i) => ({ date: '2026-09-0' + (i + 1), sport: 'ride', avgHr: 120 + i * 5, rpe: 3 + i, minutes: m })),
    { date: '2026-09-07', sport: 'ride', avgHr: 110, rpe: 2, minutes: 40 },
    { date: '2026-09-08', sport: 'ride', avgHr: 105, rpe: 2, minutes: 12 },
    { date: '2026-09-09', sport: 'ride', avgHr: 100, rpe: 2, minutes: null },
  ];
  assert.equal(count(charts.rpeHrScatter(rides, charts.TL, 'ride'), /<circle class="rpe-dot"/g), 5);
  assert.equal(count(charts.rpeHrScatter(rides), /<circle class="rpe-dot"/g), 5);
  assert.equal(charts.rpeEligible({ sport: 'run', avgHr: 150, rpe: 5, minutes: 20 }), true);
  assert.equal(charts.rpeEligible({ sport: 'ride', avgHr: 150, rpe: 5, minutes: 30 }), false);
});

test('zoneWeeksChart: a sport filter counts only that sport', () => {
  const sessions = [
    { date: '2026-09-28', sport: 'run', zones: { easy: 30, moderate: 10, hard: 10 } },
    { date: '2026-09-29', sport: 'ride', minutes: 60, zones: { easy: 50, moderate: 0, hard: 0 } },
  ];
  const lastWeek = svg => svg.split('<g class="week"').at(-1);
  assert.match(lastWeek(charts.zoneWeeksChart(sessions, TODAY)), />80 %</);
  assert.match(lastWeek(charts.zoneWeeksChart(sessions, TODAY, 12, charts.TL, 'run')), />60 %</);
  assert.match(charts.zoneWeeksChart(sessions, TODAY, 12, charts.TL, 'strength'), /No strength heart-rate zone data in the last 12 weeks/);
});

test('zoneWeeksChart: rides only count when longer than 40 minutes (also under "All")', () => {
  const sessions = [
    { date: '2026-09-28', sport: 'run', minutes: 20, zones: { easy: 30, moderate: 10, hard: 10 } },
    { date: '2026-09-29', sport: 'ride', minutes: 60, zones: { easy: 50, moderate: 0, hard: 0 } },
    { date: '2026-09-30', sport: 'ride', minutes: 15, zones: { easy: 15, moderate: 0, hard: 0 } },
    { date: '2026-09-21', sport: 'ride', minutes: 40, zones: { easy: 40, moderate: 0, hard: 0 } },
  ];
  const weeks = svg => svg.split('<g class="week"').slice(1);
  const all = weeks(charts.zoneWeeksChart(sessions, TODAY));
  assert.match(all[11], />80 %</); // (30 + 50) / 100: the 15-min ride is left out
  assert.match(all[10], />–</);    // the 40-min ride is not over 40
  assert.match(weeks(charts.zoneWeeksChart(sessions, TODAY, 12, charts.TL, 'ride'))[11], /Easy \(Z1–Z2\) 50 min/);
  assert.equal(charts.longEnough({ sport: 'ride', minutes: 41 }), true);
  assert.equal(charts.longEnough({ sport: 'ride', minutes: null }), false);
  assert.equal(charts.longEnough({ sport: 'strength', minutes: 10 }), true);
});

test('loadHrvChart: rides only count when longer than 40 minutes; a sport filter shows only that sport', () => {
  const sessions = [
    { date: '2026-09-27', sport: 'run', load: 40, minutes: 45 },
    { date: '2026-09-28', sport: 'ride', load: 50, minutes: 60 },
    { date: '2026-09-28', sport: 'ride', load: 5, minutes: 12 },
  ];
  const bars = svg => (svg.match(/<rect class="load-bar"/g) || []).length;
  const all = charts.loadHrvChart(days, sessions, series);
  assert.equal(bars(all), 2);
  assert.doesNotMatch(all, /Ride 5 load/);
  const ride = charts.loadHrvChart(days, sessions, series, charts.TL, 'ride');
  assert.equal(bars(ride), 1);
  assert.match(ride, /<circle class="hrv-next"/); // HRV dots stay: they belong to the day, not the sport
  assert.match(charts.loadHrvChart(days, sessions, series, charts.TL, 'strength'), /No strength sessions in the last 30 days/);
});
