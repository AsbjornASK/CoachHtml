const { test, before, afterEach } = require('node:test');
const assert = require('node:assert/strict');

let push;
before(async () => { push = await import('../api/_lib/push.mjs'); });
const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; });

const sub = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p', auth: 'a' } };

test('isValidSubscription', () => {
  assert.equal(push.isValidSubscription(sub), true);
  assert.equal(push.isValidSubscription({ ...sub, endpoint: 'http://x' }), false);
  assert.equal(push.isValidSubscription({ endpoint: sub.endpoint }), false);
  assert.equal(push.isValidSubscription({ ...sub, keys: { p256dh: 'p' } }), false);
  assert.equal(push.isValidSubscription(null), false);
  assert.equal(push.isValidSubscription('x'), false);
});

const fakeLib = impl => ({ setVapidDetails() {}, sendNotification: impl });
const vapid = () => Object.assign(process.env, { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:a@b.c' });

test('sendPush sends the JSON payload', async () => {
  vapid();
  let sent;
  const r = await push.sendPush(sub, { title: 'T' }, fakeLib(async (s, body, opts) => { sent = { s, body, opts }; }));
  assert.deepEqual(r, { ok: true, gone: false, status: 201 });
  assert.equal(sent.s, sub);
  assert.deepEqual(JSON.parse(sent.body), { title: 'T' });
  assert.ok(sent.opts.TTL > 0);
});

test('sendPush reports 404/410 as gone and never throws', async () => {
  vapid();
  for (const statusCode of [404, 410]) {
    const r = await push.sendPush(sub, {}, fakeLib(async () => { throw Object.assign(new Error('x'), { statusCode }); }));
    assert.deepEqual(r, { ok: false, gone: true, status: statusCode });
  }
  const r = await push.sendPush(sub, {}, fakeLib(async () => { throw Object.assign(new Error('x'), { statusCode: 500 }); }));
  assert.deepEqual(r, { ok: false, gone: false, status: 500 });
});

test('sendPush without VAPID config returns ok:false instead of throwing', async () => {
  delete process.env.VAPID_PRIVATE_KEY;
  const lib = { setVapidDetails() { throw new Error('bad keys'); }, sendNotification: async () => {} };
  assert.deepEqual(await push.sendPush(sub, {}, lib), { ok: false, gone: false, status: null });
});

test('the real web-push library rejects missing VAPID keys without throwing out of sendPush', async () => {
  delete process.env.VAPID_PRIVATE_KEY;
  const r = await push.sendPush(sub, {});
  assert.equal(r.ok, false);
});
