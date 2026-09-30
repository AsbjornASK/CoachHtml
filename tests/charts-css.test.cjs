// Every page that renders the shared charts must also get the CSS those charts rely on.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const NEEDS_CSS = ['legend-title', 'pc-tiles', 'pc-tile', 'pc-label', 'pc-chart-label', 'pc-vals', 'pc-vs', 'pc-unit', 'pc-diff'];

test('static/css/charts.css styles every class the shared charts depend on', () => {
  const css = read('static/css/charts.css');
  for (const c of NEEDS_CSS) assert.match(css, new RegExp(`\\.${c}\\b`), c);
});

for (const page of ['static/dashboard.html', 'static/data.html']) {
  test(`${page} links charts.css and has no own copy of those rules`, () => {
    const html = read(page);
    assert.ok(html.includes('<link rel="stylesheet" href="/css/charts.css">'));
    const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
    for (const c of NEEDS_CSS) assert.ok(!new RegExp(`\\.${c}\\b`).test(style), `${page} still defines .${c}`);
  });
}
