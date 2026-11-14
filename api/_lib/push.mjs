// The single Web Push subscription (private Vercel Blob) and sending to it.
import { put, get, del } from '@vercel/blob';
import webpush from 'web-push';
import { json } from './util.mjs';

export const SUBSCRIPTION_PATH = 'push/subscription.json';
const TTL_SECONDS = 4 * 3600; // a morning message is useless after a few hours

// Apple, Google, Mozilla and Microsoft push services; anything else could point the cron at an arbitrary URL
const PUSH_HOST = /(^|\.)push\.apple\.com$|^fcm\.googleapis\.com$|^updates\.push\.services\.mozilla\.com$|(^|\.)notify\.windows\.com$/;

function isPushEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && PUSH_HOST.test(u.hostname);
  } catch { return false; }
}

export function isValidSubscription(s) {
  return !!s && typeof s === 'object'
    && typeof s.endpoint === 'string' && isPushEndpoint(s.endpoint)
    && typeof s.keys?.p256dh === 'string' && typeof s.keys?.auth === 'string';
}

// Storage (Blob) errors answer a JSON 500 instead of crashing the function
export const guardStorage = handler => async request => {
  try { return await handler(request); }
  catch (e) { console.error(e); return json({ error: 'Storage unavailable' }, 500); }
};

export const blobStore = {
  async read() {
    // useCache: false so a fresh subscribe/unsubscribe is seen immediately
    const r = await get(SUBSCRIPTION_PATH, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return null;
    try { return JSON.parse(await new Response(r.stream).text()); } catch { return null; }
  },
  async save(sub) {
    await put(SUBSCRIPTION_PATH, JSON.stringify(sub), {
      access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json',
    });
  },
  async remove() {
    await del(SUBSCRIPTION_PATH);
  },
};

// { ok, gone, status }; gone = the push service says the subscription no longer exists
export async function sendPush(sub, payload, lib = webpush) {
  try {
    const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
    lib.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const res = await lib.sendNotification(sub, JSON.stringify(payload), { TTL: TTL_SECONDS });
    return { ok: true, gone: false, status: res?.statusCode ?? 201 };
  } catch (e) {
    const status = e?.statusCode ?? null;
    return { ok: false, gone: status === 404 || status === 410, status };
  }
}

export const pushDeps = { store: blobStore, send: sendPush };
