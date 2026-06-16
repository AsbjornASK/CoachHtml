export default async () => {
  const apiKey    = process.env.INTERVALS_API_KEY;
  const athleteId = process.env.INTERVALS_ATHLETE_ID;

  if (!apiKey || !athleteId) {
    return json({ error: 'Intervals API ikke konfigureret' }, 500);
  }

  const today = new Date();
  const end   = fmt(today);
  const start = fmt(new Date(today - 30 * 86_400_000));

  const auth    = 'Basic ' + btoa('API_KEY:' + apiKey);
  const baseUrl = `https://intervals.icu/api/v1/athlete/${athleteId}`;

  const wellnessRes = await fetch(
    `${baseUrl}/wellness?oldest=${start}&newest=${end}`,
    { headers: { Authorization: auth } }
  );

  if (!wellnessRes.ok) {
    return json({ error: 'Intervals wellness API fejl', status: wellnessRes.status }, 502);
  }

  const rawWellness = await wellnessRes.json();

  const days = (Array.isArray(rawWellness)
    ? rawWellness
    : Object.entries(rawWellness).map(([k, v]) => ({ id: k, ...v }))
  )
    .map(d => ({ ...d, date: d.id ?? d.date }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const series = days.map(d => ({
    date:       d.date,
    ctl:        r1(d.ctl),
    atl:        r1(d.atl),
    tsb:        d.ctl != null && d.atl != null ? r1(d.ctl - d.atl) : null,
    hrv:        r1(d.hrv),
    rhr:        (d.restingHR && d.restingHR < 65) ? d.restingHR : null,
    sleep:      d.sleepSecs ? r1(d.sleepSecs / 3600) : null,
    sleepScore: d.sleepScore ?? null,
    mood:       d.mood       ?? null,
    soreness:   d.soreness   ?? null,
    fatigue:    d.fatigue    ?? null,
    motivation: d.motivation ?? null,
    comments:   d.comments   ?? null,
    weight:     r1(d.weight),
    bodyFat:    r1(d.bodyFat ?? d.fatMass ?? null),
    steps:      d.steps ?? null,
  }));

  return json({ today: end, series });
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function fmt(d) { return d.toISOString().slice(0, 10); }
function r1(v)  { return v != null ? Math.round(v * 10) / 10 : null; }

export const config = { path: '/api/get-dashboard' };
