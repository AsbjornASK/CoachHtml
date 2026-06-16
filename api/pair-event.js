// Vercel Edge Function: pair-event
// Parrer en uploadet Intervals.icu-aktivitet manuelt med en planlagt session

export const config = { runtime: 'edge' };

export default async (req) => {
  const apiKey    = process.env.INTERVALS_API_KEY;
  const athleteId = process.env.INTERVALS_ATHLETE_ID;

  if (!apiKey || !athleteId) {
    return json({ error: 'Intervals API ikke konfigureret' }, 500);
  }

  const { eventId, activityId } = await req.json().catch(() => ({}));
  if (!eventId || !activityId) {
    return json({ error: 'eventId og activityId er påkrævet' }, 400);
  }

  const auth    = 'Basic ' + btoa('API_KEY:' + apiKey);
  const baseUrl = `https://intervals.icu/api/v1/athlete/${athleteId}`;

  const res = await fetch(`${baseUrl}/events/${eventId}`, {
    method: 'PUT',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ paired_activity_id: activityId }),
  });

  if (!res.ok) {
    const details = await res.text().catch(() => '');
    return json({ error: 'Intervals events API fejl', status: res.status, details }, 502);
  }

  return json({ ok: true });
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
