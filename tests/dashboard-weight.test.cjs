// Runs dashboard.html's weightGraph (plus its fmtN) in isolation.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../static/dashboard.html'), 'utf8');
const src = html.match(/^function fmtN[\s\S]*?^}/m)[0] + '\n' + html.match(/^const WEIGHT_WINDOW[\s\S]*?^}/m)[0] + '\nthis.weightGraph = weightGraph;';
const ctx = {};
vm.runInNewContext(src, ctx);

test('too few measurements shows the window length in days', () => {
  assert.match(ctx.weightGraph([], '2026-09-30'), /in the last 21 days/);
});

test('graph only includes weights inside the 21-day window', () => {
  const svg = ctx.weightGraph([{ date: '2026-09-01', weight: 80.2 }, { date: '2026-09-20', weight: 79.4 }, { date: '2026-09-29', weight: 78.9 }], '2026-09-30');
  assert.equal((svg.match(/<circle/g) || []).length, 2);
  assert.match(svg, /78,9/);
});
