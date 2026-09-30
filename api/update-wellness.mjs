// Proxies wellness data to Intervals.icu so the API key stays server-side.

import { intervalsClient, notConfigured } from './_lib/intervals.mjs';
import { json } from './_lib/util.mjs';

export async function POST(req) {
  const intervals = intervalsClient();
  if (!intervals) return notConfigured();

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { date, ...fields } = body;
  if (!date) {
    return json({ error: 'Date is missing' }, 400);
  }

  const response = await intervals.put(`/wellness/${date}`, { id: date, ...fields });

  if (!response.ok) {
    return json({ error: 'Intervals API error', details: await response.text() }, response.status);
  }

  return json({ ok: true });
}
