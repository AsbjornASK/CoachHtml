export const config = { runtime: 'edge' };

export default async () => {
  const apiKey    = process.env.INTERVALS_API_KEY;
  const athleteId = process.env.INTERVALS_ATHLETE_ID;

  if (!apiKey || !athleteId) {
    return json({ error: 'Intervals API ikke konfigureret' }, 500);
  }

  const today     = new Date();
  const end       = fmt(today);
  const yesterday = fmt(new Date(today - 86_400_000));
  const start     = fmt(new Date(today - 14 * 86_400_000));
  const auth      = 'Basic ' + btoa('API_KEY:' + apiKey);
  const base      = `https://intervals.icu/api/v1/athlete/${athleteId}`;

  const [wellnessRes, ywRes] = await Promise.all([
    fetch(`${base}/wellness?oldest=${start}&newest=${end}`, { headers: { Authorization: auth } }),
    fetch(`${base}/wellness/${yesterday}`,                  { headers: { Authorization: auth } }),
  ]);

  if (!wellnessRes.ok) {
    return json({ error: 'Intervals wellness API fejl', status: wellnessRes.status }, 502);
  }

  const rawWellness    = await wellnessRes.json();
  const yw             = ywRes.ok ? await ywRes.json() : {};

  const days           = parseDays(rawWellness);
  const last7          = days.slice(-7);
  const latest         = findLatest(days, d => d.restingHR && d.restingHR < 65);
  const yesterdayEntry = days.find(d => d.date === yesterday) ?? {};

  const HEIGHT = 1.755;
  const bodyCompEntries = days.filter(d => d.weight && (d.fatMass || d.bodyFat));
  const bodyComp        = bodyCompEntries[bodyCompEntries.length - 1];
  const prevBodyComp    = bodyCompEntries[bodyCompEntries.length - 2];
  const toInBody = e => {
    if (!e) return null;
    const fp = e.bodyFat ?? null;
    return { date: e.date, weight: round1(e.weight), fatPct: round1(fp), fatMass: (e.weight && fp) ? round1(e.weight * fp / 100) : null, bmi: round1(e.weight / (HEIGHT * HEIGHT)) };
  };

  return json({
    today: end,
    latest: {
      date:         latest?.date         ?? null,
      hrv:          latest?.hrv          ?? null,
      restingHR:    latest?.restingHR    ?? null,
      sleepHours:   latest?.sleepSecs    ? round1(latest.sleepSecs / 3600) : null,
      sleepScore:   latest?.sleepScore   ?? null,
      sleepQuality: latest?.sleepQuality ?? null,
      ctl:          round1(latest?.ctl   ?? null),
      atl:          round1(latest?.atl   ?? null),
      tsb:          latest?.ctl != null && latest?.atl != null ? round1(latest.ctl - latest.atl) : null,
      rampRate:     round1(latest?.rampRate ?? null),
    },
    trends: {
      hrv:        last7.map(d => d.hrv ?? null),
      rhr:        last7.map(d => (d.restingHR && d.restingHR < 65) ? d.restingHR : null),
      sleep:      last7.map(d => d.sleepSecs ? round1(d.sleepSecs / 3600) : null),
      sleepScore: last7.map(d => d.sleepScore ?? null),
      dates:      last7.map(d => d.date),
    },
    sleep8: days.slice(-8).map(d => d.sleepSecs ? round1(d.sleepSecs / 3600) : null),
    healthMarkers: {
      date:   yesterday,
      sdnn:   round1(yesterdayEntry.sdnn   ?? yesterdayEntry.hrvSDNN ?? null),
      steps:  yesterdayEntry.steps  ?? null,
      spo2:   round1(yesterdayEntry.spO2   ?? yesterdayEntry.spo2   ?? null),
      vo2max: round1(yesterdayEntry.vo2max ?? yesterdayEntry.vo2Max  ?? null),
    },
    yesterdayWellness: {
      date:         yesterday,
      mood:         yw.mood         ?? yesterdayEntry.mood         ?? null,
      soreness:     yw.soreness     ?? yesterdayEntry.soreness     ?? null,
      fatigue:      yw.fatigue      ?? yesterdayEntry.fatigue      ?? null,
      motivation:   yw.motivation   ?? yesterdayEntry.motivation   ?? null,
      stress:       yw.stress       ?? yesterdayEntry.stress       ?? null,
      sleepQuality: yw.sleepQuality ?? yesterdayEntry.sleepQuality ?? null,
      comments:     yw.comments     ?? yesterdayEntry.comments     ?? null,
    },
    inBody: bodyComp ? { ...toInBody(bodyComp), prev: toInBody(prevBodyComp) } : null,
    weightHistory: days.filter(d => d.weight).slice(-60).map(d => ({ date: d.date, weight: round1(d.weight) })),
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
