// Sends a test notification from the Profile page.
import { pushDeps } from './_lib/push.mjs';
import { json } from './_lib/util.mjs';

export function makePOST({ store, send }) {
  return async function POST() {
    const sub = await store.read();
    if (!sub) return json({ error: 'No subscription' }, 404);
    const r = await send(sub, { title: 'Coach', body: 'Test notification ✓', url: '/profile.html' });
    if (r.gone) await store.remove();
    return r.ok ? json({ ok: true }) : json({ error: 'Push failed', status: r.status }, 502);
  };
}

export const POST = makePOST(pushDeps);
