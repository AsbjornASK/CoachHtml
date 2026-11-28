// MCP endpoint: JSON-RPC handling, error mapping, retries and auth.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { fakeClient } = require('./helpers/fake-intervals.cjs');

const ctx = {};
before(async () => Object.assign(ctx,
  await import('../api/_lib/mcp-server.mjs'),
  { endpoint: await import('../api/mcp.mjs'), intervals: await import('../api/_lib/intervals.mjs') }));

const call = (client, name, args) =>
  ctx.handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, client);

test('initialize echoes the protocol version and gives unit instructions', async () => {
  const r = await ctx.handleMessage({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-11-25' } });
  assert.equal(r.id, 0);
  assert.equal(r.result.protocolVersion, '2025-11-25');
  assert.deepEqual(r.result.capabilities, { tools: {} });
  assert.match(r.result.instructions, /dry_run/);
});

test('notifications get no response; unknown methods get -32601', async () => {
  assert.equal(await ctx.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  const r = await ctx.handleMessage({ jsonrpc: '2.0', id: 2, method: 'resources/list' });
  assert.equal(r.error.code, -32601);
});

test('tools/list has unique tools with object schemas and no run functions', async () => {
  const { tools } = (await ctx.handleMessage({ jsonrpc: '2.0', id: 3, method: 'tools/list' })).result;
  assert.equal(new Set(tools.map(t => t.name)).size, tools.length);
  assert.ok(tools.length >= 22);
  for (const t of tools) {
    assert.equal(t.run, undefined);
    assert.equal(t.inputSchema.type, 'object');
    assert.ok(t.description.length > 40, t.name);
  }
});

test('every write tool has dry_run', async () => {
  const { tools } = (await ctx.handleMessage({ jsonrpc: '2.0', id: 4, method: 'tools/list' })).result;
  const writers = tools.filter(t => /^(update|create|delete)_/.test(t.name));
  assert.ok(writers.length >= 9);
  for (const t of writers) assert.ok(t.inputSchema.properties.dry_run, t.name);
});

test('missing arguments and API errors come back as readable tool errors', async () => {
  const missing = await call(fakeClient(), 'delete_event', {});
  assert.equal(missing.result.isError, true);
  assert.match(missing.result.content[0].text, /Missing argument: id/);

  const notFound = await call(fakeClient({ 'GET ~/activity/x': [404, 'gone'] }), 'get_activity', { id: 'x' });
  assert.equal(notFound.result.isError, true);
  assert.match(notFound.result.content[0].text, /Not found/);

  const denied = await call(fakeClient({ 'GET ': [401, 'bad key'] }), 'get_athlete', {});
  assert.match(denied.result.content[0].text, /refused access \(401\)/);

  const limited = await call(fakeClient({ 'GET ': [429, ''] }), 'get_athlete', {});
  assert.match(limited.result.content[0].text, /rate limit/);
});

test('the Intervals client retries a 429 once after Retry-After', async () => {
  process.env.INTERVALS_API_KEY = 'k';
  process.env.INTERVALS_ATHLETE_ID = 'i1';
  const realFetch = global.fetch;
  const seen = [];
  global.fetch = async url => {
    seen.push(url);
    return seen.length === 1
      ? new Response('', { status: 429, headers: { 'Retry-After': '0' } })
      : new Response('{}', { status: 200 });
  };
  try {
    const res = await ctx.intervals.intervalsClient().get('/wellness');
    assert.equal(res.status, 200);
    assert.equal(seen.length, 2);
    assert.equal(seen[0], 'https://intervals.icu/api/v1/athlete/i1/wellness');
  } finally {
    global.fetch = realFetch;
  }
});

test('authorized accepts the key as query or Bearer token only when it matches', () => {
  const req = (url, auth) => new Request(url, { method: 'POST', headers: auth ? { authorization: auth } : {} });
  assert.equal(ctx.endpoint.authorized(req('https://x/api/mcp?key=s3cret'), 's3cret'), true);
  assert.equal(ctx.endpoint.authorized(req('https://x/api/mcp', 'Bearer s3cret'), 's3cret'), true);
  assert.equal(ctx.endpoint.authorized(req('https://x/api/mcp?key=wrong'), 's3cret'), false);
  assert.equal(ctx.endpoint.authorized(req('https://x/api/mcp'), 's3cret'), false);
  assert.equal(ctx.endpoint.authorized(req('https://x/api/mcp?key='), undefined), false);
});

test('POST rejects requests without the key', async () => {
  process.env.MCP_SECRET = 's3cret';
  const res = await ctx.endpoint.POST(new Request('https://x/api/mcp', { method: 'POST', body: '{}' }));
  assert.equal(res.status, 401);
});
