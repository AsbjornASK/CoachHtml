// Pure math behind /api/get-sport-load.

import { r1, r2 } from './util.mjs';

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
