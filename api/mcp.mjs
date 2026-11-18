// Remote MCP endpoint for Claude: exposes Intervals.icu as tools.
// Protected by MCP_SECRET, passed as ?key=... in the connector URL or as a Bearer token.

import { createHash, timingSafeEqual } from 'node:crypto';
import { intervalsClient, notConfigured } from './_lib/intervals.mjs';
import { handleMessage } from './_lib/mcp-server.mjs';
import { json } from './_lib/util.mjs';

const digest = s => createHash('sha256').update(s).digest();

export function authorized(req, secret = process.env.MCP_SECRET) {
  if (!secret) return false;
  const given = new URL(req.url).searchParams.get('key')
    ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    ?? '';
  return timingSafeEqual(digest(given), digest(secret));
}

const rpcError = (code, message, status) => json({ jsonrpc: '2.0', id: null, error: { code, message } }, status);

export async function POST(req) {
  if (!process.env.MCP_SECRET) return json({ error: 'MCP_SECRET not configured' }, 500);
  if (!authorized(req)) return json({ error: 'Unauthorized' }, 401);

  const client = intervalsClient();
  if (!client) return notConfigured();

  let body;
  try {
    body = await req.json();
  } catch {
    return rpcError(-32700, 'Parse error', 400);
  }

  const batch     = Array.isArray(body);
  const responses = (await Promise.all((batch ? body : [body]).map(m => handleMessage(m, client)))).filter(Boolean);

  if (!responses.length) return new Response(null, { status: 202 });
  return json(batch ? responses : responses[0]);
}

// No server-initiated stream: this server is stateless.
export const GET    = () => new Response(null, { status: 405, headers: { Allow: 'POST' } });
export const DELETE = GET;
