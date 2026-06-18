// Netlify Function: get-data
// Henter wellness + fitness data fra Intervals.icu API

export default async () => {
  const apiKey   = process.env.INTERVALS_API_KEY;
  const athleteId = process.env.INTERVALS_ATHLETE_ID;

  if (!apiKey || !athleteId) {
    return json({ error: 'Intervals API ikke konfigureret' }, 500);
  }

  const today     = new Date();
  const end       = fmt(today);
  const yesterday = fmt(new Date(today - 86_400_000));
  const start     = fmt(new Date(today - 14 * 86_400_000));

  const auth    = 'Basic ' + btoa('API_KEY:' + apiKey);
  const baseUrl = `https://intervals.icu/api/v1/athlete/${athleteId}`;

  const [wellnessRes, eventsRes, activitiesRes] = await Promise.all([
    fetch(`${baseUrl}/wellness?oldest=${start}&newest=${end}`,   { headers: { Authorization: auth } }),
    fetch(`${baseUrl}/events?oldest=${end}&newest=${end}`,       { headers: { Authorization: auth } }),
    fetch(`${baseUrl}/activities?oldest=${end}&newest=${end}`,   { headers: { Authorization: auth } }),
  ]);

  if (!wellnessRes.ok) {
    return json({ error: 'Intervals wellness API fejl', status: wellnessRes.status }, 502);
  }

  const rawWellness   = await wellnessRes.json();
  const rawEvents     = eventsRes.ok ? await eventsRes.json() : [];
  const rawActivities = activitiesRes.ok ? await activitiesRes.json() : [];

  // Find dagens planlagte sessions der ikke automatisk er parret med en
  // uploadet aktivitet, og forslå et match ud fra sportstype.
  const unpairedEvents     = rawEvents.filter(e => e.category === 'WORKOUT' && !e.paired_activity_id);
  const unpairedActivities = rawActivities.filter(a => !a.paired_event_id);
  const pairSuggestions = unpairedEvents
    .map(e => {
      const match = unpairedActivities.find(a => a.type === e.type);
      return match ? {
        eventId:      e.id,
        eventName:    e.name,
        eventType:    e.type,
        activityId:   match.id,
        activityName: match.name,
        activityType: match.type,
      } : null;
    })
    .filter(Boolean);

  // API returns an array of objects with an `id` field for the date
  const days = (Array.isArray(rawWellness) ? rawWellness : Object.entries(rawWellness).map(([k, v]) => ({ id: k, ...v })))
    .map(d => ({ ...d, date: d.id ?? d.date }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Find seneste valide dag for nøgle-metrics (ignorer RHR >= 65)
  const latest = findLatest(days, d => d.restingHR && d.restingHR < 65);

  // 7-dages arrays til sparklines/trend (seneste 7 dage)
  const last7 = days.slice(-7);

  // 14-dages CTL/ATL til fitness-graf
  const fitnessHistory = days.map(d => ({
    date: d.date,
    ctl:  round1(d.ctl  ?? null),
    atl:  round1(d.atl  ?? null),
    tsb:  d.ctl != null && d.atl != null ? round1(d.ctl - d.atl) : null,
  }));

  // Yesterday's health markers
  const yesterdayEntry = days.find(d => d.date === yesterday) ?? {};

  // Subjektive felter fra i dag (det brugeren har logget via morgen check-in)
  const todayEntry = days.find(d => d.date === end) ?? {};

  const bodyCompEntries = days.filter(d => d.weight && (d.fatMass || d.bodyFat));
  const bodyCompEntry   = bodyCompEntries[bodyCompEntries.length - 1];
  const prevBodyCompEntry = bodyCompEntries[bodyCompEntries.length - 2];
  const HEIGHT = 1.755;
  const toInBody = (e) => {
    if (!e) return null;
    const w  = e.weight;
    const fp = e.bodyFat ?? null;
    return {
      date:    e.date,
      weight:  round1(w),
      fatPct:  round1(fp),
      fatMass: (w && fp) ? round1(w * fp / 100) : null,
      bmi:     round1(w / (HEIGHT * HEIGHT)),
    };
  };

  return json({
    today: end,
    latest: {
      date:             latest?.date ?? null,
      hrv:              latest?.hrv  ?? null,
      restingHR:        latest?.restingHR ?? null,
      sleepHours:       latest?.sleepSecs ? round1(latest.sleepSecs / 3600) : null,
      sleepScore:       latest?.sleepScore ?? null,
      sleepQuality:     latest?.sleepQuality ?? null,
      sleepEfficiency:  latest?.sleepEfficiency ?? null,
      hrDip:            latest?.hrDip ?? null,
      ctl:              round1(latest?.ctl ?? null),
      atl:              round1(latest?.atl ?? null),
      tsb:              latest?.ctl != null && latest?.atl != null ? round1(latest.ctl - latest.atl) : null,
      rampRate:         round1(latest?.rampRate ?? null),
      weight:           round1(latest?.weight ?? null),
    },
    trends: {
      hrv:        last7.map(d => d.hrv   ?? null),
      rhr:        last7.map(d => (d.restingHR && d.restingHR < 65) ? d.restingHR : null),
      sleep:      last7.map(d => d.sleepSecs ? round1(d.sleepSecs / 3600) : null),
      sleepScore: last7.map(d => d.sleepScore ?? null),
      dates:      last7.map(d => d.date),
    },
    sleep8: days.slice(-8).map(d => d.sleepSecs ? round1(d.sleepSecs / 3600) : null),
    fitnessHistory,
    subjective: {
      date:         todayEntry.date         ?? null,
      mood:         todayEntry.mood         ?? null,
      soreness:     todayEntry.soreness     ?? null,
      fatigue:      todayEntry.fatigue      ?? null,
      motivation:   todayEntry.motivation   ?? null,
      comments:     todayEntry.comments     ?? null,
    },
    inBody: bodyCompEntry ? { ...toInBody(bodyCompEntry), prev: toInBody(prevBodyCompEntry) } : null,
    healthMarkers: {
      date:         yesterday,
      sdnn:         round1(yesterdayEntry.sdnn   ?? yesterdayEntry.hrvSDNN ?? null),
      steps:        yesterdayEntry.steps  ?? null,
      spo2:         round1(yesterdayEntry.spO2   ?? yesterdayEntry.spo2   ?? null),
      vo2max:       round1(yesterdayEntry.vo2max ?? yesterdayEntry.vo2Max  ?? null),
      stressLevel:  yesterdayEntry.stressLevel  ?? null,
      sleepQuality: round1(yesterdayEntry.sleepQuality ?? null),
      mood:         yesterdayEntry.mood       ?? null,
      soreness:     yesterdayEntry.soreness   ?? null,
      fatigue:      yesterdayEntry.fatigue    ?? null,
      motivation:   yesterdayEntry.motivation ?? null,
      comments:     yesterdayEntry.comments   ?? null,
    },
    events: rawEvents,
    pairSuggestions,
  });
};

// ── helpers ───────────────────────────────────────────────
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

function round1(v) {
  return v != null ? Math.round(v * 10) / 10 : null;
}

function findLatest(days, pred) {
  for (let i = days.length - 1; i >= 0; i--) {
    if (pred(days[i])) return days[i];
  }
  return days[days.length - 1] ?? null;
}


export const config = { path: '/api/get-data' };
