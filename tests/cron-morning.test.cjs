const { test, before, afterEach } = require('node:test');
const assert = require('node:assert/strict');

let cron;
before(async () => { cron = await import('../api/cron-morning.mjs'); });
const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; });

const SUB = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p', auth: 'a' } };
const store = (v = SUB) => { const s = { value: v, async read() { return s.value; }, async save(x) { s.value = x; }, async remove() { s.value = null; } }; return s; };
const req = auth => new Request('https://x/api/cron-morning', { headers: auth ? { authorization: auth } : {} });
const morning = { coach: null, lastWeightDate: null, lastBodyCompDate: null, todayEvents: [] };

function deps(over = {}) {
  const sent = [];
  return { sent, store: store(), send: async (s, p) => { sent.push(p); return { ok: true, gone: false, status: 201 }; }, loadMorning: async () => morning, ...over };
}

test('rejects missing, wrong or unconfigured secret', async () => {
  process.env.CRON_SECRET = 's3cret';
  for (const auth of [undefined, 'Bearer nope', 's3cret']) {
    const d = deps();
    const r = await cron.makeGET(d)(req(auth));
    assert.equal(r.status, 401, String(auth));
    assert.equal(d.sent.length, 0);
  }
  delete process.env.CRON_SECRET;
  const d = deps();
  assert.equal((await cron.makeGET(d)(req('Bearer undefined'))).status, 401);
  assert.equal((await cron.makeGET(d)(req('Bearer '))).status, 401);
  assert.equal(d.sent.length, 0);
});

test('no subscription → nothing sent', async () => {
  process.env.CRON_SECRET = 's3cret';
  const d = deps({ store: store(null) });
  const r = await cron.makeGET(d)(req('Bearer s3cret'));
  assert.deepEqual(await r.json(), { sent: false, reason: 'no subscription' });
  assert.equal(d.sent.length, 0);
});

test('sends the morning message (Intervals down → Good morning)', async () => {
  process.env.CRON_SECRET = 's3cret';
  const d = deps();
  const r = await cron.makeGET(d)(req('Bearer s3cret'));
  assert.equal(r.status, 200);
  assert.deepEqual(d.sent, [{ title: 'Good morning', body: "Open Coach for today's readiness.", url: '/' }]);
});

test('a 410 deletes the subscription', async () => {
  process.env.CRON_SECRET = 's3cret';
  const s = store();
  const r = await cron.makeGET(deps({ store: s, send: async () => ({ ok: false, gone: true, status: 410 }) }))(req('Bearer s3cret'));
  assert.equal(r.status, 502);
  assert.equal(s.value, null);
});

test('loadMorning never throws when Intervals and calendars are not configured', async () => {
  for (const k of Object.keys(process.env)) if (/^INTERVALS_|_ICS_URL$/.test(k)) delete process.env[k];
  const m = await cron.loadMorning(new Date('2026-10-05T07:00:00Z'));
  assert.deepEqual(m, morning);
});

test('loadMorning falls back to coach: null when Intervals answers non-OK', async () => {
  for (const k of Object.keys(process.env)) if (/_ICS_URL$/.test(k)) delete process.env[k];
  Object.assign(process.env, { INTERVALS_API_KEY: 'k', INTERVALS_ATHLETE_ID: 'i' });
  const realFetch = global.fetch;
  global.fetch = async () => new Response('nope', { status: 503 });
  try {
    assert.equal((await cron.loadMorning(new Date('2026-10-05T07:00:00Z'))).coach, null);
  } finally { global.fetch = realFetch; }
});

test('vercel.json schedules the cron at 07:00 UTC', () => {
  const v = require('../vercel.json');
  assert.deepEqual(v.crons, [{ path: '/api/cron-morning', schedule: '0 7 * * *' }]);
});

test('storage errors give a JSON 500', async () => {
  process.env.CRON_SECRET = 's3cret';
  const d = deps({ store: { async read() { throw new Error('BlobError'); } } });
  const r = await cron.makeGET(d)(req('Bearer s3cret'));
  assert.equal(r.status, 500);
  assert.deepEqual(await r.json(), { error: 'Storage unavailable' });
  assert.equal(d.sent.length, 0);
});
