// Netlify Function: get-data
// Henter wellness + fitness data fra Intervals.icu API

export default async () => {
  const apiKey   = process.env.INTERVALS_API_KEY;
  const athleteId = process.env.INTERVALS_ATHLETE_ID;

  if (!apiKey || !athleteId) {
    return json({ error: 'Intervals API ikke konfigureret' }, 500);
  }

  const today = new Date();
  const end   = fmt(today);
  const start = fmt(new Date(today - 14 * 86_400_000));

  const auth    = 'Basic ' + btoa('API_KEY:' + apiKey);
  const baseUrl = `https://intervals.icu/api/v1/athlete/${athleteId}`;

  const [wellnessRes, eventsRes] = await Promise.all([
    fetch(`${baseUrl}/wellness?oldest=${start}&newest=${end}`, { headers: { Authorization: auth } }),
    fetch(`${baseUrl}/events?oldest=${end}&newest=${end}`,    { headers: { Authorization: auth } }),
  ]);

  if (!wellnessRes.ok) {
    return json({ error: 'Intervals wellness API fejl', status: wellnessRes.status }, 502);
  }

  const rawWellness = await wellnessRes.json();
  const rawEvents   = eventsRes.ok ? await eventsRes.json() : [];

  // Sorter dage ældst → nyest
  const days = Object.entries(rawWellness)
    .map(([date, v]) => ({ date, ...v }))
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

  // Subjektive felter fra i dag (det brugeren har logget via morgen check-in)
  const todayEntry = days.find(d => d.date === end) ?? {};

  // InBody fra notes (seneste 14 dage)
  const inBodyEntry = [...days].reverse().find(d =>
    d.notes && d.notes.includes('InBody')
  );

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
      hrv:   last7.map(d => d.hrv   ?? null),
      rhr:   last7.map(d => (d.restingHR && d.restingHR < 65) ? d.restingHR : null),
      sleep: last7.map(d => d.sleepSecs ? round1(d.sleepSecs / 3600) : null),
      dates: last7.map(d => d.date),
    },
    sleep8: days.slice(-8).map(d => d.sleepSecs ? round1(d.sleepSecs / 3600) : null),
    fitnessHistory,
    subjective: {
      date:         todayEntry.date         ?? null,
      sleepQuality: todayEntry.sleepQuality ?? null,
      soreness:     todayEntry.soreness     ?? null,
      fatigue:      todayEntry.fatigue      ?? null,
      motivation:   todayEntry.motivation   ?? null,
    },
    inBody: inBodyEntry?.notes ? parseInBodyNote(inBodyEntry.notes, inBodyEntry.date) : null,
    events: rawEvents,
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

function parseInBodyNote(notes, date) {
  // Format: "InBody 270 · 2026-05-24 07:50: Vægt 76,3 kg · Muskelmasse 39,2 kg · Fedtmasse 8,5 kg · Fedtprocent 11,1% · BMI 24,8"
  const num = s => parseFloat(s.replace(',', '.'));
  return {
    date,
    weight:   num((notes.match(/Vægt ([\d,]+)/)     ?? [])[1]),
    muscle:   num((notes.match(/Muskelmasse ([\d,]+)/) ?? [])[1]),
    fatMass:  num((notes.match(/Fedtmasse ([\d,]+)/)  ?? [])[1]),
    fatPct:   num((notes.match(/Fedtprocent ([\d,]+)/) ?? [])[1]),
    bmi:      num((notes.match(/BMI ([\d,]+)/)        ?? [])[1]),
  };
}

export const config = { path: '/api/get-data' };
