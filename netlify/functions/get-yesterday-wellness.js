// Netlify Function: get-yesterday-wellness
// Henter gårsdagens wellness-entry direkte fra Intervals.icu

export default async () => {
  const apiKey    = process.env.INTERVALS_API_KEY;
  const athleteId = process.env.INTERVALS_ATHLETE_ID;

  if (!apiKey || !athleteId) {
    return json({ error: 'Intervals API ikke konfigureret' }, 500);
  }

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const auth = 'Basic ' + btoa('API_KEY:' + apiKey);

  const res = await fetch(
    `https://intervals.icu/api/v1/athlete/${athleteId}/wellness/${yesterday}`,
    { headers: { Authorization: auth } }
  );

  if (!res.ok) {
    return json({ error: 'Intervals wellness API fejl', status: res.status }, 502);
  }

  const w = await res.json();

  return json({
    date:       yesterday,
    mood:       w.mood       ?? null,
    soreness:   w.soreness   ?? null,
    fatigue:    w.fatigue    ?? null,
    motivation: w.motivation ?? null,
    stress:     w.stress     ?? null,
    sleepQuality: w.sleepQuality ?? null,
    comments:   w.comments   ?? null,
  });
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const config = { path: '/api/get-yesterday-wellness' };
