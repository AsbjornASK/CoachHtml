// PWA shell: manifest, icons, service worker and the shared head/script on every page.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = p => fs.readFileSync(path.join(__dirname, '..', p));
const PAGES = ['index', 'checkin', 'vitals', 'dashboard', 'data', 'profile'];

test('manifest is valid and its icons exist as PNGs of the right size', () => {
  const m = JSON.parse(read('static/manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, '/');
  for (const icon of m.icons) {
    const png = read('static' + icon.src);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    const [w, h] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), w);
    assert.equal(png.readUInt32BE(20), h);
  }
  assert.equal(read('static/icons/icon-180.png').readUInt32BE(16), 180);
});

for (const page of PAGES) {
  test(`${page}.html has the PWA head tags and app-shell.js`, () => {
    const html = read(`static/${page}.html`).toString();
    assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest">/);
    assert.match(html, /<link rel="apple-touch-icon" href="\/icons\/icon-180\.png">/);
    assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/);
    assert.match(html, /<script src="\/js\/app-shell\.js"><\/script>/);
  });
}

function runSW() {
  const handlers = {};
  const shown = [], opened = [];
  const clients = { matchAll: async () => [], openWindow: async url => { opened.push(url); } };
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    registration: { showNotification: async (title, opts) => { shown.push({ title, opts }); } },
  };
  vm.runInNewContext(read('static/sw.js').toString(), { self, clients });
  return { handlers, shown, opened };
}

test('sw.js shows the pushed title/body and opens its url on click', async () => {
  const { handlers, shown, opened } = runSW();
  let p;
  handlers.push({ data: { json: () => ({ title: 'Readiness 72 🟢', body: 'Rest day', url: '/' }) }, waitUntil: x => { p = x; } });
  await p;
  assert.equal(shown[0].title, 'Readiness 72 🟢');
  assert.equal(shown[0].opts.body, 'Rest day');
  assert.equal(shown[0].opts.data.url, '/');
  handlers.notificationclick({ notification: { data: { url: '/checkin.html' }, close() {} }, waitUntil: x => { p = x; } });
  await p;
  assert.deepEqual(opened, ['/checkin.html']);
});

test('sw.js falls back to a generic notification without or with broken data', async () => {
  for (const data of [null, { json: () => { throw new Error('bad'); } }]) {
    const { handlers, shown } = runSW();
    let p;
    handlers.push({ data, waitUntil: x => { p = x; } });
    await p;
    assert.equal(shown[0].title, 'Coach');
  }
});

test('sw.js takes control at once so updates and notification taps work in the Home Screen app', async () => {
  const handlers = {};
  let skipped = false, claimed = false;
  const self = { addEventListener: (t, fn) => { handlers[t] = fn; }, skipWaiting: async () => { skipped = true; }, registration: {} };
  const clients = { claim: async () => { claimed = true; } };
  vm.runInNewContext(read('static/sw.js').toString(), { self, clients });
  let p;
  handlers.install({ waitUntil: x => { p = x; } }); await p;
  handlers.activate({ waitUntil: x => { p = x; } }); await p;
  assert.equal(skipped, true);
  assert.equal(claimed, true);
});

test('sw.js opens a new window when the open one cannot be navigated', async () => {
  const handlers = {};
  const opened = [];
  const win = { focus: async () => {}, navigate: async () => { throw new TypeError('not controlled'); } };
  const clients = { matchAll: async () => [win], openWindow: async url => { opened.push(url); } };
  vm.runInNewContext(read('static/sw.js').toString(), { self: { addEventListener: (t, fn) => { handlers[t] = fn; } }, clients });
  let p;
  handlers.notificationclick({ notification: { data: { url: '/checkin.html' }, close() {} }, waitUntil: x => { p = x; } });
  await p;
  assert.deepEqual(opened, ['/checkin.html']);
});

test('the cron function bundle includes the shared static/js modules', () => {
  const v = require('../vercel.json');
  assert.equal(v.functions?.['api/cron-morning.mjs']?.includeFiles, 'static/js/**');
});
