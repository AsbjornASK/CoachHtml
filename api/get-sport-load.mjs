import { intervalsClient, notConfigured } from './_lib/intervals.mjs';
import { json, fmt, daysAgo, r1, DAY_MS } from './_lib/util.mjs';
import { ewma, baselineOf, sportOf, sessionsOf } from './_lib/sport-load.mjs';

// We need enough history before the displayed window for the CTL (42-day)
// EWMA to converge close to its steady-state value.
const LOOKBACK_DAYS = 200;
const DISPLAY_DAYS  = 30;
const TAU_CTL = 42;
const TAU_ATL = 7;
// Sessions list for data.html: RPE × heart rate uses all of it; the other Sessions charts show less
const SESSION_DAYS = 150;

export async function GET() {
  const intervals = intervalsClient();
  if (!intervals) return notConfigured();

  const today = new Date();
  const end   = fmt(today);
  const start = daysAgo(LOOKBACK_DAYS, today);

  const res = await intervals.get(`/activities?oldest=${start}&newest=${end}`);

  if (!res.ok) {
    return json({ error: 'Intervals activities API error', status: res.status }, 502);
  }

  const activities = await res.json();

  // Sum training load per day, split by sport category.
  const loadByDay = {};
  for (const a of activities) {
    const cat = sportOf(a.type);
    if (cat !== 'run' && cat !== 'strength') continue;
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
  for (let t = startMs; t <= endMs; t += DAY_MS) {
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

  return json({ today: end, series, baseline, sessions: sessionsOf(activities, end, SESSION_DAYS) });
}
