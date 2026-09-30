// data.html (desktop overview) uses the shared charts from static/js/charts.js with more data points.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../static/data.html'), 'utf8');
const render = html.match(/^function render\([\s\S]*?^}/m)[0];

test('loads wellness-labels.js, then charts.js, before its own script', () => {
  const i = html.indexOf('<script src="/js/wellness-labels.js">'), j = html.indexOf('<script src="/js/charts.js">');
  const own = html.indexOf('<script>\n');
  assert.ok(i > 0 && j > i && own > j, `${i} ${j} ${own}`);
});

test('shared daily charts on a 30-day timeline with the wide layout', () => {
  assert.match(html, /^const DATA_DAYS = 30;/m);
  assert.match(html, /^const WIDE = \{ W: 900, PDL: 46, PDR: 12 \};/m);
  assert.match(render, /const t30 = lastDays\(data\.series, today, DATA_DAYS\);/);
  assert.match(render, /hrvCheckinChart\(t30, WIDE\)/);
  assert.match(render, /sleepMoodChart\(t30, WIDE\)/);
  assert.match(render, /partnerCompare\(data\.series, t30, WIDE\)/);
});

test('HRV · Calendar · Stress over 14 days; weight and VO₂ max over 90 days', () => {
  assert.match(render, /hrvCalStressChart\(lastDays\(data\.series, today, 14\), data\.series, data\.hrvBands\)/);
  assert.match(render, /trendGraph\(data\.series, today, \{ field: 'weight', days: 90, range: WEIGHT_RANGE/);
  assert.match(render, /trendGraph\(data\.series, today, \{ field: 'vo2max', days: 90, range: VO2_RANGE, color: VO2_COLOR/);
  assert.match(render, /vo2Summary\(data\.series, today, 90\)/);
});

test('same card titles as the Dashboard for the shared charts', () => {
  for (const t of ['HRV · Calendar · Stress', 'HRV × Fatigue', 'Sleep × Mood', 'Partner vs. alone', 'Weight over time', 'VO₂ max over time']) {
    assert.ok(render.includes(`<div class="card-title">${t}</div>`), t);
  }
  assert.ok(!render.includes('HRV over time') && !render.includes('Sleep over time'));
});

test('no local copies of the shared helpers or charts', () => {
  for (const name of ['hrvCheckinChart', 'sleepMoodChart', 'fmtDate', 'fmtN', 'r1']) {
    assert.ok(!new RegExp(`^function ${name}\\(`, 'm').test(html), name);
  }
  for (const name of ['DAYS_S', 'MONTHS', 'MOOD_LABELS', 'FAT_LABELS', 'CHECKIN_COLORS', 'STRESS_COLORS', 'STRESS_LABELS', 'CAT_META', 'CAT_KEYS']) {
    assert.ok(!new RegExp(`^const ${name}\\b`, 'm').test(html), name);
  }
});

// ── Task 3: data.html's own charts in the Dashboard design ─────────────────
const vm = require('node:vm');
globalThis.innerWidth = 1280;
const shared = require('../static/js/charts.js');
const wellness = require('../static/js/wellness-labels.js');
const block = name => { const m = html.match(new RegExp('^function ' + name + '\\([\\s\\S]*?^}', 'm')); if (!m) throw new Error('not found: ' + name); return m[0]; };
const page = Object.assign({}, wellness, shared);
vm.runInNewContext([
  html.match(/^const SOR_LABELS .*$/m)[0], html.match(/^const MOT_LABELS .*$/m)[0],
  ...['chipClass', 'fitnessCheckinChart', 'sportFitnessChart', 'tsbMoodScatter', 'sleepMoodScatter', 'calendarLoadChart', 'checkinTable'].map(n => { try { return block(n); } catch { return ''; } }),
].join('\n'), page);

const month = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.parse('2026-09-01') + i * 864e5).toISOString().slice(0, 10),
  ctl: 40 + i / 10, atl: 45 + (i % 5), tsb: -5 + (i % 7), mood: (i % 4) + 1, fatigue: (i % 4) + 1, soreness: 2, motivation: 2,
  sleep: 7 + (i % 3) / 2, hrv: 70 + (i % 9), sdnn: 60 + (i % 11), stress: (i % 4) + 1, cal: i % 3 ? { work: 1, workTitles: ['Work'] } : null,
}));
const smallFonts = svg => (svg.match(/font-size="(9|10)"|font-size:10px/g) || []).length;

test('Fitness & Form: 12 px axes, d/m dates, mood dots r=6, four-colour Mood legend', () => {
  const svg = page.fitnessCheckinChart(month);
  assert.equal(smallFonts(svg), 0);
  assert.match(svg, /font-size="12"/);
  assert.match(svg, />1\/9</);
  assert.match(svg, /<circle[^>]* r="6"/);
  assert.ok(svg.includes('<span class="legend-title">Mood</span>') && !svg.includes('Avg/Low'));
});

test('Run/Strength Fitness & Form: 12 px axes and d/m dates', () => {
  const svg = page.sportFitnessChart(month.map(d => ({ date: d.date, ctl: d.ctl / 5, atl: d.atl / 5, tsb: d.tsb / 5 })));
  assert.equal(smallFonts(svg), 0);
  assert.match(svg, />1\/9</);
});

test('Calendar load: SDNN as separate dots r=6 (no line), 12 px axes, stress colours from the wellness module', () => {
  const svg = page.calendarLoadChart(month);
  assert.equal(smallFonts(svg), 0);
  assert.doesNotMatch(svg, /<line[^>]*stroke="#1c1c1e" stroke-width="2"/);
  assert.match(svg, /<circle[^>]* r="6"[^>]*><title>[^<]*SDNN/);
  assert.ok(!svg.includes('legend-line'));
});

test('Scatter plots: dots r=6, 12 px axes, sleep axis in hours ("h", not "t")', () => {
  for (const svg of [page.tsbMoodScatter(month), page.sleepMoodScatter(month)]) {
    assert.equal(smallFonts(svg), 0);
    assert.match(svg, /<circle[^>]* r="6"/);
  }
  assert.match(page.sleepMoodScatter(month), /\d,\dh</);
  assert.doesNotMatch(page.sleepMoodScatter(month), /\dt</);
});

test('no hard-coded wellness colours in data.html script; unused charts removed', () => {
  const script = html.match(/<script>\n([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(script, /#30d158|#ff9f0a|#ff3b30|#bf5af2/);
  assert.ok(!/^function (sdnnStressChart|calHrvScatter)\(/m.test(html));
});

// ── Tabs and the Sessions tab ───────────────────────────────────────────────
const TABS = [['recovery', 'Recovery'], ['training', 'Training'], ['sessions', 'Sessions'], ['body', 'Body'], ['life', 'Life load'], ['patterns', 'Patterns']];
const CARDS = {
  recovery: ['HRV · Calendar · Stress', 'HRV × Fatigue', 'Sleep × Mood', 'Partner vs. alone'],
  training: ['Fitness (CTL)', 'Fatigue (ATL)', 'Form (TSB)', 'HRV', 'Fitness & Form: 30 days', 'Run: Fitness & Form', 'Strength: Fitness & Form'],
  sessions: ['Load × Day HRV', 'RPE × heart rate', 'Heart-rate zones per week'],
  body: ['Weight over time', 'VO₂ max over time'],
  life: ['Calendar load & SDNN recovery'],
  patterns: ['Insights', 'Check-in history: last 21 days', 'TSB vs Mood', 'Sleep vs Mood'],
};

test('six tabs in order, with the storage key dataTab', () => {
  assert.match(html, /^const DATA_TABS = \['recovery', 'training', 'sessions', 'body', 'life', 'patterns'\];/m);
  assert.match(html, /'dataTab'/);
});

// Runs data.html's inline script against a stub DOM. `storage` is a localStorage stub, or 'throw'.
async function runPage(storage) {
  const els = {};
  const panelsFor = new Map();
  const nodes = (html, re) => [...html.matchAll(re)].map(m => ({
    dataset: { tab: m[1] }, hidden: false, attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); },
    classList: { set: new Set(), toggle(c, on) { on ? this.set.add(c) : this.set.delete(c); }, contains(c) { return this.set.has(c); } },
  }));
  const el = id => (els[id] ??= { style: {}, innerHTML: '', textContent: '', listeners: {}, addEventListener(t, f) { this.listeners[t] = f; } });
  const query = sel => {
    const app = el('app').innerHTML;
    const key = sel + app.length;
    if (!panelsFor.has(key)) panelsFor.set(key, sel === '.tab-panel'
      ? nodes(app, /<section class="tab-panel" data-tab="(\w+)"/g)
      : nodes(app, /<button class="tab" data-tab="(\w+)"/g));
    return panelsFor.get(key);
  };
  const series = month.map(d => ({ ...d, weight: 75, vo2max: 58 }));
  const sport = {
    today: '2026-09-30',
    series: month.map(d => ({ date: d.date, run: { ctl: 5, atl: 6, tsb: -1 }, strength: { ctl: 3, atl: 4, tsb: -1 } })),
    sessions: [{ date: '2026-09-29', sport: 'run', load: 40, minutes: 45, avgHr: 150, rpe: 5, zones: { easy: 30, moderate: 10, hard: 5 } }],
  };
  const ctx = {
    innerWidth: 1280, console, setTimeout,
    document: { getElementById: el, querySelectorAll: query, addEventListener() {} },
    fetch: async url => ({ ok: true, status: 200, json: async () => (url === '/api/get-dashboard' ? { today: '2026-09-30', series } : sport) }),
  };
  Object.defineProperty(ctx, 'localStorage', { get() { if (storage === 'throw') throw new Error('SecurityError'); return storage; } });
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const src of ['wellness-labels.js', 'charts.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../static/js/', src), 'utf8'), ctx);
  vm.runInContext(html.match(/<script>\n([\s\S]*?)<\/script>/)[1], ctx);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(els['error-msg']?.textContent ?? '', '');
  const visible = () => query('.tab-panel').filter(p => !p.hidden).map(p => p.dataset.tab);
  return { els, app: el('app'), query, visible };
}
const memStorage = init => { const m = new Map(Object.entries(init)); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };

test('tab bar and panels render in order; every card sits in its tab', async () => {
  const { app } = await runPage(memStorage({}));
  const buttons = [...app.innerHTML.matchAll(/<button class="tab" data-tab="(\w+)"[^>]*>([^<]+)</g)].map(m => [m[1], m[2]]);
  assert.deepEqual(buttons, TABS);
  const panels = app.innerHTML.split('<section class="tab-panel" data-tab="').slice(1);
  assert.deepEqual(panels.map(p => p.slice(0, p.indexOf('"'))), TABS.map(t => t[0]));
  for (const p of panels) {
    const tab = p.slice(0, p.indexOf('"'));
    const titles = [...p.matchAll(/class="card-title">([^<]+)/g)].map(m => m[1].trim());
    assert.deepEqual(titles, CARDS[tab], tab);
  }
});

test('Recovery is shown by default and only one panel is visible', async () => {
  const { visible, query } = await runPage(memStorage({}));
  assert.deepEqual(visible(), ['recovery']);
  assert.deepEqual(query('.tab').filter(b => b.classList.contains('selected')).map(b => b.dataset.tab), ['recovery']);
});

test('a stored tab is restored; clicking a tab shows it and stores it', async () => {
  const storage = memStorage({ dataTab: 'body' });
  const { visible, app } = await runPage(storage);
  assert.deepEqual(visible(), ['body']);
  app.listeners.click({ target: { closest: sel => (sel === '.tab' ? { dataset: { tab: 'sessions' } } : null) } });
  assert.deepEqual(visible(), ['sessions']);
  assert.equal(storage.m.get('dataTab'), 'sessions');
});

test('an unknown stored value or a throwing localStorage falls back to Recovery', async () => {
  assert.deepEqual((await runPage(memStorage({ dataTab: 'nonsense' }))).visible(), ['recovery']);
  const blocked = await runPage('throw');
  assert.deepEqual(blocked.visible(), ['recovery']);
  blocked.app.listeners.click({ target: { closest: () => ({ dataset: { tab: 'life' } }) } });
  assert.deepEqual(blocked.visible(), ['life']);
});

test('Sessions tab draws the three charts from sportData.sessions on the 30-day wide timeline', () => {
  assert.ok(render.includes(`<div id="load-hrv">\${sportCard('load-hrv', data, sessions, 'all')}</div>`));
  assert.ok(html.includes('loadHrvChart(lastDays(series, today, DATA_DAYS), sessions, series, WIDE, sport)'));
  assert.ok(render.includes(`<div id="rpe-hr">\${sportCard('rpe-hr', data, sessions, 'all')}</div>`));
  assert.ok(render.includes('<div class="card-title">RPE × heart rate</div>\n        <div class="card-subtitle" style="margin-bottom:10px">Sessions from the last 150 days</div>'));
  assert.ok(render.includes(`<div id="zone-weeks">\${sportCard('zone-weeks', data, sessions, 'all')}</div>`));
  assert.ok(html.includes('rpeHrScatter(sessions, WIDE, sport)'));
  assert.ok(html.includes('zoneWeeksChart(sessions, today, 12, WIDE, sport)'));
  assert.match(render, /const sessions = sportData\?\.sessions \?\? \[\];/);
});

test('tab bar follows the ARIA tab pattern: selected state, panels linked to their tabs', async () => {
  const storage = memStorage({ dataTab: 'body' });
  const { app, query } = await runPage(storage);
  assert.deepEqual(query('.tab').map(b => b.attrs['aria-selected']), ['false', 'false', 'false', 'true', 'false', 'false']);
  for (const [t] of TABS) {
    assert.match(app.innerHTML, new RegExp('<section class="tab-panel" data-tab="' + t + '" role="tabpanel" id="panel-' + t + '" aria-labelledby="tab-' + t + '"'));
    assert.match(app.innerHTML, new RegExp('<button class="tab" data-tab="' + t + '" role="tab" id="tab-' + t + '" aria-controls="panel-' + t + '"'));
  }
});

test('RPE × heart rate: sport filter buttons (no Other); clicking one redraws only that card', async () => {
  const { app, els } = await runPage(memStorage({}));
  const card = app.innerHTML.slice(app.innerHTML.indexOf('<div id="rpe-hr">'));
  assert.ok(card.includes('<button data-card="rpe-hr" data-sport="all" class="selected" aria-pressed="true">All</button><button data-card="rpe-hr" data-sport="run" class="" aria-pressed="false">Run</button>'));
  assert.doesNotMatch(card.slice(0, card.indexOf('</div>')), /data-sport="other"/);
  app.listeners.click({ target: { closest: sel => (sel === '[data-sport]' ? { dataset: { card: 'rpe-hr', sport: 'run' } } : null) } });
  assert.match(els['rpe-hr'].innerHTML, /<button data-card="rpe-hr" data-sport="run" class="selected" aria-pressed="true">Run/);
  assert.match(els['rpe-hr'].innerHTML, /Not enough run sessions with RPE and heart rate yet/);
});

test('Heart-rate zones per week: the same sport filter; clicking redraws only the zone card', async () => {
  const { app, els } = await runPage(memStorage({}));
  const card = app.innerHTML.slice(app.innerHTML.indexOf('<div id="zone-weeks">'));
  assert.ok(card.includes('<button data-card="zone-weeks" data-sport="all" class="selected" aria-pressed="true">All</button><button data-card="zone-weeks" data-sport="run" class="" aria-pressed="false">Run</button></div>'));
  const click = sport => app.listeners.click({ target: { closest: sel => (sel === '[data-sport]' ? { dataset: { card: 'zone-weeks', sport } } : null) } });
  click('run');
  assert.match(els['zone-weeks'].innerHTML, /data-sport="run" class="selected"/);
  assert.match(els['zone-weeks'].innerHTML, /<g class="week"/);
  assert.equal(els['rpe-hr'], undefined); // the RPE card is untouched
  click('ride');
  assert.match(els['zone-weeks'].innerHTML, /No ride heart-rate zone data in the last 12 weeks/);
});

test('Load × Day HRV: the same sport filter; clicking redraws only that card', async () => {
  const { app, els } = await runPage(memStorage({}));
  const card = app.innerHTML.slice(app.innerHTML.indexOf('<div id="load-hrv">'));
  assert.ok(card.includes('<button data-card="load-hrv" data-sport="all" class="selected" aria-pressed="true">All</button><button data-card="load-hrv" data-sport="run" class="" aria-pressed="false">Run</button></div>'));
  app.listeners.click({ target: { closest: sel => (sel === '[data-sport]' ? { dataset: { card: 'load-hrv', sport: 'ride' } } : null) } });
  assert.match(els['load-hrv'].innerHTML, /No ride sessions in the last 30 days/);
});
