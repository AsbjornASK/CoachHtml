// MCP endpoint: JSON-RPC handling, tool calls against a fake Intervals client, and auth.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');

const ctx = {};
before(async () => Object.assign(ctx,
  await import('../api/_lib/mcp-server.mjs'),
  { endpoint: await import('../api/mcp.mjs') }));

const TODAY = new Date('2026-11-18T08:00:00Z');

// Records calls and answers every request with the given body.
function fakeClient(body = [], status = 200) {
  const calls = [];
  const request = async (method, path, payload) => {
    calls.push({ method, path, payload });
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, request, get: p => request('GET', p), put: (p, b) => request('PUT', p, b) };
}

const call = (client, name, args) =>
  ctx.handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, client, TODAY);

test('initialize echoes the protocol version and advertises tools', async () => {
  const r = await ctx.handleMessage({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-11-25' } });
  assert.equal(r.id, 0);
  assert.equal(r.result.protocolVersion, '2025-11-25');
  assert.deepEqual(r.result.capabilities, { tools: {} });
});

test('notifications get no response; unknown methods get -32601', async () => {
  assert.equal(await ctx.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  const r = await ctx.handleMessage({ jsonrpc: '2.0', id: 2, method: 'resources/list' });
  assert.equal(r.error.code, -32601);
});

test('tools/list hides the run functions', async () => {
  const r = await ctx.handleMessage({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
  assert.ok(r.result.tools.length >= 8);
  for (const t of r.result.tools) {
    assert.equal(t.run, undefined);
    assert.equal(t.inputSchema.type, 'object');
  }
});

test('get_wellness defaults to the last 14 days', async () => {
  const c = fakeClient([{ id: '2026-11-18', hrv: 70 }]);
  const r = await call(c, 'get_wellness', {});
  assert.equal(c.calls[0].path, '/wellness?oldest=2026-11-04&newest=2026-11-18');
  assert.deepEqual(JSON.parse(r.result.content[0].text), [{ id: '2026-11-18', hrv: 70 }]);
});

test('get_activities trims each activity to key fields', async () => {
  const c = fakeClient([{ id: 'i1', type: 'Run', distance: 10000, icu_power_hr_z2: 123, laps: [] }]);
  const r = await call(c, 'get_activities', { oldest: '2026-11-01', newest: '2026-11-10' });
  assert.equal(c.calls[0].path, '/activities?oldest=2026-11-01&newest=2026-11-10');
  assert.deepEqual(JSON.parse(r.result.content[0].text), [{ id: 'i1', type: 'Run', distance: 10000 }]);
});

test('get_activity uses the non-athlete path', async () => {
  const c = fakeClient({ id: 'i1' });
  await call(c, 'get_activity', { id: 'i1', intervals: true });
  assert.equal(c.calls[0].path, '~/activity/i1?intervals=true');
});

test('create_event posts a workout at the start of the day', async () => {
  const c = fakeClient({ id: 5 });
  await call(c, 'create_event', { date: '2026-11-20', name: 'Tempo', type: 'Run', description: '- 20m Z3', load: 50 });
  assert.deepEqual(c.calls[0], { method: 'POST', path: '/events', payload: {
    start_date_local: '2026-11-20T00:00:00', category: 'WORKOUT', name: 'Tempo',
    type: 'Run', description: '- 20m Z3', icu_training_load: 50,
  } });
});

test('update_wellness puts the fields with the date as id', async () => {
  const c = fakeClient({});
  await call(c, 'update_wellness', { date: '2026-11-18', fields: { weight: 78.4 } });
  assert.deepEqual(c.calls[0], { method: 'PUT', path: '/wellness/2026-11-18', payload: { weight: 78.4, id: '2026-11-18' } });
});

test('missing arguments and API errors come back as tool errors', async () => {
  const missing = await call(fakeClient(), 'delete_event', {});
  assert.equal(missing.result.isError, true);
  const failed = await call(fakeClient({ error: 'nope' }, 404), 'get_activity', { id: 'x' });
  assert.equal(failed.result.isError, true);
  assert.match(failed.result.content[0].text, /404/);
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
