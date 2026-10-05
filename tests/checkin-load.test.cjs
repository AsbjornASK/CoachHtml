// Runs checkin.html's inline script against a stub DOM to check what the page
// renders for different /api/get-vitals responses.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { freshnessWarnings } = require('../static/js/data-freshness.js');
const { TODAY_FIELDS, checkinKey, hasCheckinValues } = require('../static/js/checkin-state.js');
const wellness = require('../static/js/wellness-labels.js');

const html = fs.readFileSync(path.join(__dirname, '../static/checkin.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const TODAY = new Date().toISOString().slice(0, 10);
const daysAgo = n => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

function stubElement() {
  return { style: {}, textContent: '', innerHTML: '', value: '', addEventListener() {}, querySelectorAll: () => [] };
}

function runPage(fetchImpl, timeoutMs = 5) {
  const els = {};
  const document = {
    getElementById: id => (els[id] ??= stubElement()),
    querySelectorAll: () => [],
    addEventListener() {},
  };
  // Timeout signals abort after timeoutMs, so the test doesn't wait for the page's real timeout.
  const AbortSignalStub = { timeout: () => { const c = new AbortController(); setTimeout(() => c.abort(new Error('timeout')), timeoutMs); return c.signal; } };
  const ctx = { document, fetch: fetchImpl, localStorage: { getItem: () => null, setItem() {} }, location: {}, AbortSignal: AbortSignalStub, freshnessWarnings, TODAY_FIELDS, checkinKey, hasCheckinValues, ...wellness, setTimeout, clearTimeout, console };
  vm.runInNewContext(script, ctx);
  return { els, ctx };
}

const settle = () => new Promise(r => setTimeout(r, 50));
const jsonFetch = body => async () => ({ ok: true, json: async () => body });

// fetch that never settles unless its signal aborts
const hangingFetch = (url, opts) => new Promise((_, reject) => {
  opts?.signal?.addEventListener('abort', () => reject(opts.signal.reason));
});

const vitals = over => ({
  todayWellness: { mood: 2, soreness: 1, fatigue: 2, motivation: 1, comments: null, weight: 78.4 },
  latest: { hrv: 70, restingHR: 50, sleepHours: 7.5 },
  trends: { hrv: [60, 62, 64, 66, 68, 70, 72], rhr: [52, 52, 51, 51, 50, 50, 50], sleep: [7, 7, 7, 7, 7, 7, 7] },
  lastWeightDate: TODAY,
  lastBodyCompDate: TODAY,
  ...over,
});

test('form is shown when /api/get-vitals hangs', async () => {
  const { els } = runPage(hangingFetch, 20);
  await new Promise(r => setTimeout(r, 100));
  assert.equal(els['loading']?.style.display, 'none', 'skeleton should be hidden');
  assert.equal(els['checkin-card']?.style.display, '', 'check-in form should be visible');
});

test('after check-in: summary shows weight and night physiology is shown', async () => {
  const { els } = runPage(jsonFetch(vitals()));
  await settle();
  assert.match(els['subj-card'].innerHTML, /78,4 kg/);
  assert.equal(els['night-card']?.style.display, '');
  assert.match(els['night-card'].innerHTML, /70 ms/);
  assert.match(els['night-card'].innerHTML, /50 bpm/);
});

test('before check-in: night physiology stays hidden', async () => {
  const { els } = runPage(jsonFetch(vitals({ todayWellness: { mood: null, soreness: null, fatigue: null, motivation: null } })));
  await settle();
  assert.equal(els['checkin-card'].style.display, '');
  assert.notEqual(els['night-card']?.style.display, '');
});

test('warnings for stale weight and missing body composition', async () => {
  const { els } = runPage(jsonFetch(vitals({ lastWeightDate: daysAgo(10), lastBodyCompDate: null })));
  await settle();
  assert.match(els['warnings'].innerHTML, /Weight not logged for 10 days/);
  assert.match(els['warnings'].innerHTML, /Body composition not measured for over 3 weeks/);
});

test('no warnings when everything is fresh', async () => {
  const { els } = runPage(jsonFetch(vitals()));
  await settle();
  assert.equal(els['warnings']?.innerHTML ?? '', '');
});

test('parseIB reads date, weight and fat % from an InBody link', () => {
  const { ctx } = runPage(hangingFetch, 1);
  // main segment: 8 digits, sex, date(9-16), time(17-20), fat mass kg*10 at 47-50, weight kg*10 at 115-118
  const main = '12345678M' + '20260928' + '0715' + '0'.repeat(26) + '0152' + '0'.repeat(64) + '0785';
  const d = ctx.parseIB('https://inbody.example/r?IBData=' + encodeURIComponent('x!' + main + '!y'));
  assert.equal(d.date, '2026-09-28');
  assert.equal(d.weight, 78.5);
  assert.equal(d.fatPct, 19.4);
});

test('after check-in without weight: summary offers a weight input', async () => {
  const { els } = runPage(jsonFetch(vitals({ todayWellness: { mood: 2, soreness: 1, fatigue: 2, motivation: 1, weight: null } })));
  await settle();
  assert.match(els['subj-card'].innerHTML, /id="weight-input"/);
});

test('after check-in with weight: no weight input', async () => {
  const { els } = runPage(jsonFetch(vitals()));
  await settle();
  assert.doesNotMatch(els['subj-card'].innerHTML, /id="weight-input"/);
});

test('saveWeight posts today\'s weight and clears the weight warning', async () => {
  const posts = [];
  const fetchImpl = async (url, opts) => {
    if (opts?.method === 'POST') { posts.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({}) }; }
    return { ok: true, json: async () => vitals({ todayWellness: { mood: 2, soreness: 1, fatigue: 2, motivation: 1, weight: null }, lastWeightDate: daysAgo(10) }) };
  };
  const { els, ctx } = runPage(fetchImpl);
  await settle();
  assert.match(els['warnings'].innerHTML, /Weight not logged/);
  await ctx.saveWeight('78,2');
  assert.deepEqual(posts.at(-1), { date: TODAY, weight: 78.2 });
  assert.doesNotMatch(els['warnings'].innerHTML, /Weight not logged/);
  assert.match(els['weight-cell'].innerHTML, /78,2 kg/);
});

test('saveWeight rejects an invalid weight without posting', async () => {
  const posts = [];
  const fetchImpl = async (url, opts) => {
    if (opts?.method === 'POST') { posts.push(opts.body); return { ok: true, json: async () => ({}) }; }
    return { ok: true, json: async () => vitals({ todayWellness: { mood: 2, soreness: 1, fatigue: 2, motivation: 1, weight: null } }) };
  };
  const { els, ctx } = runPage(fetchImpl);
  await settle();
  await ctx.saveWeight('7');
  assert.equal(posts.length, 0);
  assert.match(els['weight-status'].textContent, /Invalid weight/);
});

test('form buttons are rendered from the shared wellness labels', () => {
  const { ctx } = runPage(hangingFetch, 1);
  const stress = ctx.checkinButtonsHTML('stress');
  assert.match(stress, /data-val="1" data-color="c-green">LOW</);
  assert.match(stress, /data-val="2" data-color="c-yellow">MODERATE</);
  assert.match(stress, /data-val="4" data-color="c-purple">VERY HIGH</);
  assert.match(ctx.checkinButtonsHTML('motivation'), /data-val="3" data-color="c-red">MEDIUM</);
  assert.match(ctx.checkinButtonsHTML('mood'), /data-val="1" data-color="c-green">GREAT</);
});

test('summary shows today\'s Sick/injured and yesterday\'s mood', async () => {
  const { els } = runPage(jsonFetch(vitals({ todayWellness: { soreness: 1, fatigue: 2, motivation: 1, injury: 3, weight: null }, yesterdayWellness: { mood: 4 } })));
  await settle();
  assert.match(els['subj-card'].innerHTML, /Sick\/injured<\/div><div class="subj-value">Sick</);
  assert.match(els['subj-card'].innerHTML, /Mood<small> yesterday<\/small><\/div><div class="subj-value">Low</);
});
