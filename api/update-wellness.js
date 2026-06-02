// Vercel Edge Function: update-wellness
// Proxyer wellness-data til Intervals.icu API med server-side API-nøgle

export const config = { runtime: 'edge' };

export default async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey    = process.env.INTERVALS_API_KEY;
  const athleteId = process.env.INTERVALS_ATHLETE_ID;

  if (!apiKey || !athleteId) {
    return json({ error: 'Intervals API ikke konfigureret på serveren' }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ugyldigt JSON' }, 400);
  }

  const { date, ...fields } = body;
  if (!date) {
    return json({ error: 'Dato mangler' }, 400);
  }

  const payload  = { id: date, ...fields };
  const response = await fetch(
    `https://intervals.icu/api/v1/athlete/${athleteId}/wellness/${date}`,
    {
      method:  'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  'Basic ' + btoa('API_KEY:' + apiKey),
      },
      body: JSON.stringify(payload),
    }
  );

  const responseText = await response.text();

  if (!response.ok) {
    return json({ error: 'Intervals API fejl', details: responseText }, response.status);
  }

  return json({ ok: true });
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
