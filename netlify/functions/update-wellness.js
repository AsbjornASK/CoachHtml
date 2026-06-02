// Netlify Function: update-wellness
// Proxyer wellness-data til Intervals.icu API med server-side API-nøgle

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.INTERVALS_API_KEY;
  const athleteId = process.env.INTERVALS_ATHLETE_ID;

  if (!apiKey || !athleteId) {
    return new Response(
      JSON.stringify({ error: "Intervals API ikke konfigureret på serveren" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ugyldigt JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { date, ...fields } = body;
  if (!date) {
    return new Response(JSON.stringify({ error: "Dato mangler" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = { id: date, ...fields };

  const response = await fetch(
    `https://intervals.icu/api/v1/athlete/${athleteId}/wellness/${date}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + btoa("API_KEY:" + apiKey),
      },
      body: JSON.stringify(payload),
    }
  );

  const responseText = await response.text();

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: "Intervals API fejl", details: responseText }),
      { status: response.status, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = { path: "/api/update-wellness" };
