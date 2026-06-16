// We need enough history before the displayed window for the CTL (42-day)
// EWMA to converge close to its steady-state value.
const LOOKBACK_DAYS = 200;
const DISPLAY_DAYS  = 30;
const TAU_CTL = 42;
const TAU_ATL = 7;

export default async () => {
  const apiKey    = process.env.INTERVALS_API_KEY;
  const athleteId = process.env.INTERVALS_ATHLETE_ID;

  if (!apiKey || !athleteId) {
    return json({ error: 'Intervals API ikke konfigureret' }, 500);
  }

  const today = new Date();
  const end   = fmt(today);
  const start = fmt(new Date(today - LOOKBACK_DAYS * 86_400_000));

  const auth    = 'Basic ' + btoa('API_KEY:' + apiKey);
  const baseUrl = `https://intervals.icu/api/v1/athlete/${athleteId}`;

  const res = await fetch(
    `${baseUrl}/activities?oldest=${start}&newest=${end}`,
    { headers: { Authorization: auth } }
  );

  if (!res.ok) {
    return json({ error: 'Intervals activities API fejl', status: res.status }, 502);
  }

  const activities = await res.json();

  // Sum training load per day, split by sport category.
  const loadByDay = {};
  for (const a of activities) {
    const cat = categoryOf(a.type);
    if (!cat) continue;
    const date = (a.start_date_local ?? a.start_date ?? '').slice(0, 10);
    if (!date) continue;
    const load = a.icu_training_load ?? 0;
    if (!loadByDay[date]) loadByDay[date] = { run: 0, strength: 0 };
    loadByDay[date][cat] += load;
  }

  // Build a continuous daily timeline (0-load on rest days) so the EWMA decays correctly.
  const startMs = Date.parse(start + 'T00:00:00Z');
  const endMs   = Date.parse(end   + 'T00:00:00Z');
  const days = [];
  for (let t = startMs; t <= endMs; t += 86_400_000) {
    const date = fmt(new Date(t));
    const d = loadByDay[date];
    days.push({ date, run: d?.run ?? 0, strength: d?.strength ?? 0 });
  }

  const runCtl = ewma(days.map(d => d.run), TAU_CTL);
  const runAtl = ewma(days.map(d => d.run), TAU_ATL);
  const strCtl = ewma(days.map(d => d.strength), TAU_CTL);
  const strAtl = ewma(days.map(d => d.strength), TAU_ATL);

  const series = days.map((d, i) => ({
    date: d.date,
    run: {
      ctl: r1(runCtl[i]),
      atl: r1(runAtl[i]),
      tsb: r1(runCtl[i] - runAtl[i]),
    },
    strength: {
      ctl: r1(strCtl[i]),
      atl: r1(strAtl[i]),
      tsb: r1(strCtl[i] - strAtl[i]),
    },
  })).slice(-DISPLAY_DAYS);

  return json({ today: end, series });
};

// ── helpers ───────────────────────────────────────────────
function categoryOf(type) {
  if (!type) return null;
  if (type === 'Run' || type.includes('Run')) return 'run';
  if (type === 'WeightTraining') return 'strength';
  return null;
}

// Exponentially weighted moving average with the same time-constant model
// Intervals.icu uses for its own CTL/ATL (Banister/Coggan PMC).
function ewma(values, tau) {
  const alpha = 1 - Math.exp(-1 / tau);
  let prev = 0;
  return values.map(v => { prev = prev + (v - prev) * alpha; return prev; });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function fmt(d) { return d.toISOString().slice(0, 10); }
function r1(v)  { return v != null ? Math.round(v * 10) / 10 : null; }

export const config = { path: '/api/get-sport-load' };
