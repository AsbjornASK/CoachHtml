// Daily Vercel Cron (vercel.json): one morning push to the stored subscription.
import { pushDeps, guardStorage } from './_lib/push.mjs';
import { morningMessage } from './_lib/morning-message.mjs';
import { coachData } from './_lib/coach-data.mjs';
import { intervalsClient, parseDays, freshnessDates } from './_lib/intervals.mjs';
import { calendarEvents } from './_lib/calendar.mjs';
import { json, fmt, daysAgo } from './_lib/util.mjs';

// Same 21-day window as get-vitals, so the freshness warnings match the Check-in page
export async function loadMorning(today = new Date()) {
  const end = fmt(today);
  const [days, cal] = await Promise.all([
    (async () => {
      const intervals = intervalsClient();
      if (!intervals) return null;
      const res = await intervals.get(`/wellness?oldest=${daysAgo(21, today)}&newest=${end}`);
      return res.ok ? parseDays(await res.json()) : null;
    })().catch(() => null),
    calendarEvents(today).catch(() => null),
  ]);
  return {
    coach: days ? coachData(days, null, end) : null,
    ...(days ? freshnessDates(days) : { lastWeightDate: null, lastBodyCompDate: null }),
    todayEvents: cal?.today ?? [],
  };
}

export function makeGET({ store, send, loadMorning: load }) {
  return guardStorage(async request => {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const sub = await store.read();
    if (!sub) return json({ sent: false, reason: 'no subscription' });

    const today = new Date();
    const msg = morningMessage({ ...(await load(today)), today: fmt(today) });
    const r = await send(sub, msg);
    if (r.gone) await store.remove();
    return r.ok ? json({ sent: true, title: msg.title }) : json({ sent: false, status: r.status }, 502);
  });
}

export const GET = makeGET({ ...pushDeps, loadMorning });
