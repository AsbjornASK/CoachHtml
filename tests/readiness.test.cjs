// static/js/readiness.js is the single Readiness formula for Coach, Vitals and the morning push.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const r = require('../static/js/readiness.js');

test('recovery at baseline is 50, better HRV raises it', () => {
  assert.equal(r.calcRecovery(r.BL.hrv.mean, r.BL.rhr.mean, r.BL.sleep.mean, r.BL.tsb.mean), 50);
  assert.ok(r.calcRecovery(90, 50, 8, 0) > 50);
  assert.equal(r.calcRecovery(null, 50, 8, 0), null);
});

test('readiness with and without subjective values', () => {
  assert.equal(r.calcReadiness(60, 80, null), 70);
  assert.equal(r.calcReadiness(60, 80, { fatigue: 1, soreness: 2 }), Math.round(60 * 0.4 + 80 * 0.2 + Math.round(90 * 0.6 + 68 * 0.4) * 0.4));
  assert.equal(r.calcReadiness(null, 80, null), null);
});

test('verdict colours', () => {
  assert.equal(r.verdictColor(65), 'green');
  assert.equal(r.verdictColor(45), 'yellow');
  assert.equal(r.verdictColor(44), 'red');
});

test('Coach and Vitals load readiness.js and no longer define the formula inline', () => {
  for (const page of ['index', 'vitals']) {
    const html = fs.readFileSync(path.join(__dirname, `../static/${page}.html`), 'utf8');
    assert.match(html, /<script src="\/js\/readiness\.js"><\/script>/, page);
    assert.doesNotMatch(html, /function calcRecovery|const BL = \{/, page);
  }
});
