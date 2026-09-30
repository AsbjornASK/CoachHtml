export const config = { runtime: 'edge' };

// We need enough history before the displayed window for the CTL (42-day)
// EWMA to converge close to its steady-state value.
const LOOKBACK_DAYS = 200;
const DISPLAY_DAYS  = 30;
const TAU_CTL = 42;
const TAU_ATL = 7;
// Per-sport TSB is judged against its own recent norm; 42 days = one CTL time constant
const BASELINE_DAYS = 42;

export default async () => {
  const apiKey    = process.env.INTERVALS_API_KEY;
  const athleteId = process.env.INTERVALS_ATHLETE_ID;

  if (!apiKey || !athleteId) {
    return json({ error: 'Intervals API not configured' }, 500);
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
    return json({ error: 'Intervals activities API error', status: res.status }, 502);
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
  const runTsb = runCtl.map((c, i) => c - runAtl[i]);
  const strTsb = strCtl.map((c, i) => c - strAtl[i]);

  const series = days.map((d, i) => ({
    date: d.date,
    run: {
      ctl: r1(runCtl[i]),
      atl: r1(runAtl[i]),
      tsb: r1(runTsb[i]),
    },
    strength: {
      ctl: r1(strCtl[i]),
      atl: r1(strAtl[i]),
      tsb: r1(strTsb[i]),
    },
  })).slice(-DISPLAY_DAYS);

  const baseline = {
    run:      baselineOf(runTsb),
    strength: baselineOf(strTsb),
  };

  return json({ today: end, series, baseline });
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
function r2(v)  { return v != null ? Math.round(v * 100) / 100 : null; }

// Mean and SD of TSB over the BASELINE_DAYS before today (today excluded, so it isn't compared with itself)
function baselineOf(tsb) {
  const win = tsb.slice(-BASELINE_DAYS - 1, -1);
  const mean = win.reduce((a, b) => a + b, 0) / win.length;
  const sd = Math.sqrt(win.reduce((a, b) => a + (b - mean) ** 2, 0) / win.length);
  return { mean: r1(mean), sd: r2(sd), days: win.length };
}
