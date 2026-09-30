// Intervals.icu client and wellness-day helpers.

import { json, r1 } from './util.mjs';

// Resting HR at or above this is treated as a measurement artifact.
const RHR_MAX = 65;

// Returns { get, put } bound to the configured athlete, or null if env vars are missing.
export function intervalsClient() {
  const apiKey    = process.env.INTERVALS_API_KEY;
  const athleteId = process.env.INTERVALS_ATHLETE_ID;
  if (!apiKey || !athleteId) return null;

  const base = `https://intervals.icu/api/v1/athlete/${athleteId}`;
  const auth = 'Basic ' + btoa('API_KEY:' + apiKey);

  return {
    get: path => fetch(base + path, { headers: { Authorization: auth } }),
    put: (path, body) => fetch(base + path, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body:    JSON.stringify(body),
    }),
  };
}

export const notConfigured = () => json({ error: 'Intervals API not configured' }, 500);

// Intervals returns wellness either as an array or as an object keyed by date.
export function parseDays(raw) {
  return (Array.isArray(raw) ? raw : Object.entries(raw).map(([k, v]) => ({ id: k, ...v })))
    .map(d => ({ ...d, date: d.id ?? d.date }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Latest day matching pred, falling back to the last day.
export function findLatest(days, pred) {
  for (let i = days.length - 1; i >= 0; i--) if (pred(days[i])) return days[i];
  return days[days.length - 1] ?? null;
}

export const rhrOf      = d => (d?.restingHR && d.restingHR < RHR_MAX) ? d.restingHR : null;
export const tsbOf      = d => d?.ctl != null && d?.atl != null ? r1(d.ctl - d.atl) : null;
export const sleepHours = d => d?.sleepSecs ? r1(d.sleepSecs / 3600) : null;
