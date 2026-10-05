import { intervalsClient, notConfigured, parseDays } from './_lib/intervals.mjs';
import { coachData } from './_lib/coach-data.mjs';
import { json, fmt, daysAgo } from './_lib/util.mjs';

export async function GET() {
  const intervals = intervalsClient();
  if (!intervals) return notConfigured();

  const today = new Date();
  const end   = fmt(today);
  const start = daysAgo(14, today);

  const [wellnessRes, activitiesRes] = await Promise.all([
    intervals.get(`/wellness?oldest=${start}&newest=${end}`),
    intervals.get(`/activities?oldest=${end}&newest=${end}`),
  ]);

  if (!wellnessRes.ok) {
    return json({ error: 'Intervals wellness API error', status: wellnessRes.status }, 502);
  }

  const activities = activitiesRes.ok
    ? (await activitiesRes.json()).map(a => ({ type: a.type ?? null }))
    : null;

  return json(coachData(parseDays(await wellnessRes.json()), activities, end));
}
