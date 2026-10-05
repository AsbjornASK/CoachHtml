const { test, before, afterEach } = require('node:test');
const assert = require('node:assert/strict');

let sub, tst;
before(async () => { sub = await import('../api/push-subscribe.mjs'); tst = await import('../api/push-test.mjs'); });
const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; });

const SUB = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p', auth: 'a' } };
function fakeStore(initial = null) {
  const s = { value: initial, async read() { return s.value; }, async save(v) { s.value = v; }, async remove() { s.value = null; } };
  return s;
}
const req = (method, body) => new Request('https://x/api', { method, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });

test('GET returns the public key and the stored endpoint', async () => {
  process.env.VAPID_PUBLIC_KEY = 'PUB';
  const r = await sub.makeHandlers({ store: fakeStore(SUB) }).GET(req('GET'));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { publicKey: 'PUB', endpoint: SUB.endpoint });
  const empty = await sub.makeHandlers({ store: fakeStore() }).GET(req('GET'));
  assert.deepEqual(await empty.json(), { publicKey: 'PUB', endpoint: null });
});

test('GET without VAPID_PUBLIC_KEY is a 500', async () => {
  delete process.env.VAPID_PUBLIC_KEY;
  const r = await sub.makeHandlers({ store: fakeStore() }).GET(req('GET'));
  assert.equal(r.status, 500);
  assert.deepEqual(await r.json(), { error: 'Push not configured' });
});

test('POST stores a valid subscription and rejects garbage', async () => {
  const store = fakeStore();
  assert.equal((await sub.makeHandlers({ store }).POST(req('POST', SUB))).status, 200);
  assert.deepEqual(store.value, SUB);
  for (const bad of [{ endpoint: 'http://x', keys: SUB.keys }, { endpoint: SUB.endpoint }, 'not json', {}]) {
    const s2 = fakeStore();
    const r = await sub.makeHandlers({ store: s2 }).POST(req('POST', bad));
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.equal(s2.value, null);
  }
});

test('POST stores only endpoint and keys', async () => {
  const store = fakeStore();
  await sub.makeHandlers({ store }).POST(req('POST', { ...SUB, expirationTime: null, extra: 'x' }));
  assert.deepEqual(store.value, SUB);
});

test('DELETE removes the subscription', async () => {
  const store = fakeStore(SUB);
  assert.equal((await sub.makeHandlers({ store }).DELETE(req('DELETE'))).status, 200);
  assert.equal(store.value, null);
});

test('push-test sends a test notification to the stored subscription', async () => {
  const sent = [];
  const send = async (s, p) => { sent.push({ s, p }); return { ok: true, gone: false, status: 201 }; };
  const r = await tst.makePOST({ store: fakeStore(SUB), send })(req('POST'));
  assert.equal(r.status, 200);
  assert.deepEqual(sent, [{ s: SUB, p: { title: 'Coach', body: 'Test notification ✓', url: '/profile.html' } }]);
});

test('push-test without a subscription is a 404; a gone subscription is deleted', async () => {
  const send = async () => ({ ok: false, gone: true, status: 410 });
  assert.equal((await tst.makePOST({ store: fakeStore(), send })(req('POST'))).status, 404);
  const store = fakeStore(SUB);
  const r = await tst.makePOST({ store, send })(req('POST'));
  assert.equal(r.status, 502);
  assert.equal(store.value, null);
});
