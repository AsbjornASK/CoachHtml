export const config = { runtime: 'edge' };

export default async (req) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: 'GEMINI_API_KEY not set' }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { vc, latest, subjective, sessions } = body;

  const colorLabel = { green: 'Green', yellow: 'Yellow', red: 'Red' }[vc] ?? 'Unknown';

  const lines = [
    `Traffic light: ${colorLabel}`,
    latest.hrv        != null ? `HRV: ${latest.hrv} ms`             : null,
    latest.restingHR  != null ? `Resting HR: ${latest.restingHR} bpm` : null,
    latest.sleepHours != null ? `Sleep: ${latest.sleepHours} h`      : null,
    latest.sleepScore != null ? `Sleep score: ${latest.sleepScore}`  : null,
    latest.tsb        != null ? `TSB: ${latest.tsb}`                 : null,
    latest.ctl        != null ? `CTL (fitness): ${latest.ctl}`       : null,
    latest.atl        != null ? `ATL (fatigue): ${latest.atl}`       : null,
    subjective?.soreness   != null ? `Soreness: ${['Low','Avg','High','Extreme'][subjective.soreness-1]}` : null,
    subjective?.fatigue    != null ? `Fatigue: ${['Low','Avg','High','Extreme'][subjective.fatigue-1]}`   : null,
    subjective?.motivation != null ? `Motivation: ${['Extreme','High','Avg','Low'][subjective.motivation-1]}` : null,
    sessions?.length ? `Today's sessions: ${sessions.join(', ')}` : `Today's sessions: Rest day`,
  ].filter(Boolean).join('\n');

  const prompt = `You are a concise endurance sports coach writing a daily training recommendation.

Athlete data:
${lines}

Rules:
- Start with the verdict in bold using <b>…</b> (e.g. "<b>Green day — execute all sessions in full.</b>")
- Follow with 1-2 sentences of personalized advice based on the numbers above
- Reference at least one specific metric (HRV, TSB, sleep, etc.)
- Total length: 2-3 sentences maximum
- Tone: direct, supportive, no filler phrases
- Output plain text with only the <b> tag allowed`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return json({ error: 'Gemini API error', detail: err }, 502);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return json({ recommendation: text });
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
