// Runs profile.html's inline script against stubs to check the Turn on flow.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const status = require('../static/js/push-status.js');

const html = fs.readFileSync(path.join(__dirname, '../static/profile.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function runPage({ browserSub, serverEndpoint }) {
  const posts = [];
  const els = {};
  const el = () => ({ style: {}, textContent: '', className: '', disabled: false, addEventListener() {} });
  let current = browserSub;
  const pushManager = {
    getSubscription: async () => current,
    subscribe: async () => { current = { endpoint: 'https://web.push.apple.com/new', unsubscribe: async () => true, toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'p', auth: 'a' } }; } }; return current; },
  };
  const ctx = {
    document: { getElementById: id => (els[id] ??= el()) },
    navigator: { serviceWorker: { ready: Promise.resolve({ pushManager }) }, userAgent: 'iPhone', standalone: true },
    PushManager: {}, Notification: { permission: 'granted', requestPermission: async () => 'granted' },
    matchMedia: () => ({ matches: true }), atob: s => Buffer.from(s, 'base64').toString('binary'), Uint8Array,
    fetch: async (url, opts) => {
      if (opts?.method === 'POST') { posts.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({}) }; }
      return { ok: true, json: async () => ({ publicKey: 'AAAA', endpoint: serverEndpoint }) };
    },
    ...status, console, setTimeout,
  };
  ctx.window = ctx;
  vm.runInNewContext(script, ctx);
  return { ctx, posts, sub: () => current };
}

const settle = () => new Promise(r => setTimeout(r, 20));

test('Turn on replaces a browser subscription the server no longer has', async () => {
  let unsubscribed = false;
  const dead = { endpoint: 'https://web.push.apple.com/dead', unsubscribe: async () => { unsubscribed = true; return true; } };
  const { ctx, posts } = runPage({ browserSub: dead, serverEndpoint: null });
  await settle();
  await ctx.turnOn();
  assert.equal(unsubscribed, true);
  assert.equal(posts.at(-1).endpoint, 'https://web.push.apple.com/new');
});

test('Turn on without a browser subscription subscribes and saves it', async () => {
  const { ctx, posts } = runPage({ browserSub: null, serverEndpoint: null });
  await settle();
  await ctx.turnOn();
  assert.equal(posts.at(-1).endpoint, 'https://web.push.apple.com/new');
});

test('a service worker that never becomes ready shows "not supported" instead of hanging', async () => {
  const els = {};
  const el = () => ({ style: {}, textContent: '', className: '', disabled: false, addEventListener() {} });
  const ctx = {
    document: { getElementById: id => (els[id] ??= el()) },
    navigator: { serviceWorker: { ready: new Promise(() => {}) }, userAgent: 'iPhone', standalone: true },
    PushManager: {}, Notification: { permission: 'default' }, matchMedia: () => ({ matches: true }),
    setTimeout: fn => fn(), // the readiness timeout fires at once
    fetch: async () => ({ ok: true, json: async () => ({ publicKey: 'AAAA', endpoint: null }) }),
    ...status, console,
  };
  ctx.window = ctx;
  vm.runInNewContext(script, ctx);
  await settle();
  assert.equal(els['notif-status'].textContent, status.STATUS_TEXT.unsupported);
});
