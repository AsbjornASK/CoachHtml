// Fake Intervals client for MCP tool tests.
// routes maps "METHOD path-without-query" to a body, or to [status, body]. Unknown routes answer 404.
function fakeClient(routes = {}) {
  const calls = [];
  const request = async (method, path, payload) => {
    calls.push({ method, path, payload });
    const key = `${method} ${path.split('?')[0]}`;
    if (!(key in routes)) return new Response('no route', { status: 404 });
    const route = typeof routes[key] === 'function' ? routes[key](path, payload) : routes[key];
    const [status, body] = Array.isArray(route) && typeof route[0] === 'number' && route.length === 2 && typeof route[1] !== 'number'
      ? route : [200, route];
    return new Response(body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body), { status });
  };
  return { calls, request, get: p => request('GET', p), put: (p, b) => request('PUT', p, b) };
}

// Calls one tool and returns { data, error } with the JSON text parsed.
async function runTool(handleMessage, client, name, args = {}, today = new Date('2026-11-18T08:00:00Z')) {
  const r = await handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, client, today);
  const textOut = r.result.content[0].text;
  let data;
  try { data = JSON.parse(textOut); } catch { data = textOut; }
  return r.result.isError ? { error: textOut } : { data };
}

module.exports = { fakeClient, runTool };
