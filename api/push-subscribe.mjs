// The Profile page's push subscription: public key + stored endpoint, save, delete.
import { pushDeps, isValidSubscription, guardStorage } from './_lib/push.mjs';
import { json } from './_lib/util.mjs';

export function makeHandlers({ store }) {
  return {
    GET: guardStorage(async () => {
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      if (!publicKey) return json({ error: 'Push not configured' }, 500);
      const saved = await store.read();
      return json({ publicKey, endpoint: saved?.endpoint ?? null });
    }),
    POST: guardStorage(async request => {
      const body = await request.json().catch(() => null);
      if (!isValidSubscription(body)) return json({ error: 'Invalid subscription' }, 400);
      await store.save({ endpoint: body.endpoint, keys: { p256dh: body.keys.p256dh, auth: body.keys.auth } });
      return json({ ok: true });
    }),
    DELETE: guardStorage(async () => {
      await store.remove();
      return json({ ok: true });
    }),
  };
}

export const { GET, POST, DELETE } = makeHandlers(pushDeps);
