// Pure math behind /api/get-sport-load.

import { r1, r2, fmt, DAY_MS } from './util.mjs';

// Per-sport TSB is judged against its own recent norm; 42 days = one CTL time constant
export const BASELINE_DAYS = 42;

// Exponentially weighted moving average with the same time-constant model
// Intervals.icu uses for its own CTL/ATL (Banister/Coggan PMC).
export function ewma(values, tau) {
  const alpha = 1 - Math.exp(-1 / tau);
  let prev = 0;
  return values.map(v => { prev = prev + (v - prev) * alpha; return prev; });
}

// Mean and SD of TSB over the BASELINE_DAYS before today (today excluded, so it isn't compared with itself)
export function baselineOf(tsb) {
  const win = tsb.slice(-BASELINE_DAYS - 1, -1);
  const mean = win.reduce((a, b) => a + b, 0) / win.length;
  const sd = Math.sqrt(win.reduce((a, b) => a + (b - mean) ** 2, 0) / win.length);
  return { mean: r1(mean), sd: r2(sd), days: win.length };
}

// Sport category of an Intervals.icu activity type
export function sportOf(type) {
  if (type?.includes('Run')) return 'run';
  if (type === 'WeightTraining') return 'strength';
  if (type?.includes('Ride')) return 'ride';
  return 'other';
}

const minutes = sec => r1(sec / 60);

// One entry per activity in the `days` days up to and including `today` (YYYY-MM-DD), oldest first.
// zones are minutes in easy (Z1+Z2), moderate (Z3) and hard (Z4 and above).
export function sessionsOf(activities, today, days = 90) {
  const first = fmt(new Date(Date.parse(today + 'T00:00:00Z') - (days - 1) * DAY_MS));
  return activities
    .map(a => ({ a, date: (a.start_date_local ?? a.start_date ?? '').slice(0, 10) }))
    .filter(({ date }) => date && date >= first && date <= today)
    .sort((x, y) => x.date.localeCompare(y.date))
    .map(({ a, date }) => {
      const z = a.icu_hr_zone_times;
      const sum = (from, to) => minutes(z.slice(from, to).reduce((s, v) => s + (v ?? 0), 0));
      return {
        date,
        sport: sportOf(a.type),
        load: a.icu_training_load ?? null,
        minutes: a.moving_time != null ? minutes(a.moving_time) : null,
        avgHr: a.average_heartrate ?? null,
        rpe: a.icu_rpe ?? null,
        zones: z?.length ? { easy: sum(0, 2), moderate: sum(2, 3), hard: sum(3) } : null,
      };
    });
}
