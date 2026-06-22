export const config = { runtime: 'edge' };

export default async () => {
  const apiKey    = process.env.INTERVALS_API_KEY;
  const athleteId = process.env.INTERVALS_ATHLETE_ID;

  if (!apiKey || !athleteId) {
    return json({ error: 'Intervals API ikke konfigureret' }, 500);
  }

  const today = new Date();
  const end   = fmt(today);
  const start = fmt(new Date(today - 14 * 86_400_000));
  const auth  = 'Basic ' + btoa('API_KEY:' + apiKey);
  const base  = `https://intervals.icu/api/v1/athlete/${athleteId}`;

  const [wellnessRes, eventsRes, activitiesRes] = await Promise.all([
    fetch(`${base}/wellness?oldest=${start}&newest=${end}`, { headers: { Authorization: auth } }),
    fetch(`${base}/events?oldest=${end}&newest=${end}`,     { headers: { Authorization: auth } }),
    fetch(`${base}/activities?oldest=${end}&newest=${end}`, { headers: { Authorization: auth } }),
  ]);

  if (!wellnessRes.ok) {
    return json({ error: 'Intervals wellness API fejl', status: wellnessRes.status }, 502);
  }

  const rawWellness   = await wellnessRes.json();
  const rawEvents     = eventsRes.ok     ? await eventsRes.json()     : [];
  const rawActivities = activitiesRes.ok ? await activitiesRes.json() : [];

  const days   = parseDays(rawWellness);
  const last7  = days.slice(-7);
  const latest = findLatest(days, d => d.restingHR && d.restingHR < 65);
  const todayEntry = days.find(d => d.date === end) ?? {};

  const unpairedEvents     = rawEvents.filter(e => e.category === 'WORKOUT' && !e.paired_activity_id);
  const unpairedActivities = rawActivities.filter(a => !a.paired_event_id);
  const pairSuggestions = unpairedEvents
    .map(e => {
      const match = unpairedActivities.find(a => a.type === e.type);
      return match ? { eventId: e.id, eventName: e.name, eventType: e.type, activityId: match.id, activityName: match.name, activityType: match.type } : null;
    })
    .filter(Boolean);

  return json({
    today: end,
    latest: {
      date:       latest?.date       ?? null,
      hrv:        latest?.hrv        ?? null,
      restingHR:  latest?.restingHR  ?? null,
      sleepHours: latest?.sleepSecs  ? round1(latest.sleepSecs / 3600) : null,
      sleepScore: latest?.sleepScore ?? null,
      ctl:        round1(latest?.ctl ?? null),
      atl:        round1(latest?.atl ?? null),
      tsb:        latest?.ctl != null && latest?.atl != null ? round1(latest.ctl - latest.atl) : null,
      rampRate:   round1(latest?.rampRate ?? null),
    },
    trends: {
      hrv:       last7.map(d => d.hrv ?? null),
      rhr:       last7.map(d => (d.restingHR && d.restingHR < 65) ? d.restingHR : null),
      sleep:     last7.map(d => d.sleepSecs ? round1(d.sleepSecs / 3600) : null),
      sleepScore:last7.map(d => d.sleepScore ?? null),
      tsb:       last7.map(d => d.ctl != null && d.atl != null ? round1(d.ctl - d.atl) : null),
      fatigue:   last7.map(d => d.fatigue   ?? null),
      soreness:  last7.map(d => d.soreness  ?? null),
      dates:     last7.map(d => d.date),
    },
    sleep8: days.slice(-8).map(d => d.sleepSecs ? round1(d.sleepSecs / 3600) : null),
    fitnessHistory: days.map(d => ({
      date: d.date,
      ctl:  round1(d.ctl ?? null),
      atl:  round1(d.atl ?? null),
      tsb:  d.ctl != null && d.atl != null ? round1(d.ctl - d.atl) : null,
    })),
    subjective: {
      date:       todayEntry.date       ?? null,
      mood:       todayEntry.mood       ?? null,
      soreness:   todayEntry.soreness   ?? null,
      fatigue:    todayEntry.fatigue    ?? null,
      motivation: todayEntry.motivation ?? null,
      comments:   todayEntry.comments   ?? null,
    },
    events: rawEvents,
    pairSuggestions,
  });
};

function parseDays(raw) {
  return (Array.isArray(raw) ? raw : Object.entries(raw).map(([k, v]) => ({ id: k, ...v })))
    .map(d => ({ ...d, date: d.id ?? d.date }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function fmt(d) { return d.toISOString().slice(0, 10); }
function round1(v) { return v != null ? Math.round(v * 10) / 10 : null; }
function findLatest(days, pred) {
  for (let i = days.length - 1; i >= 0; i--) if (pred(days[i])) return days[i];
  return days[days.length - 1] ?? null;
}
