// Every page's visible markup and script strings must be English (comments are ignored).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DANISH = /[æøåÆØÅ]|\b(Gem|Gemt|Gemmer|Fejl|Humør|Vægt|Søvn|Indsæt|Importer|Opdateret|Ingen|ikke|dage|uger|JA|NEJ|MIDDEL|Middel|LAV|HØJ|Kunne)\b|'da-DK'/;

for (const page of ['index', 'checkin', 'vitals', 'dashboard', 'data']) {
  test(`${page}.html has no Danish UI text`, () => {
    const html = fs.readFileSync(path.join(__dirname, `../static/${page}.html`), 'utf8');
    const visible = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const hit = visible.split(/\r?\n/).find(l => DANISH.test(l));
    assert.equal(hit, undefined, `Danish text found: ${hit?.trim().slice(0, 120)}`);
  });
}
