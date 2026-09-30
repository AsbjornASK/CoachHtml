// Generic HTTP, date and number helpers shared by the API functions.

export const DAY_MS = 86_400_000;

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function fmt(d) { return d.toISOString().slice(0, 10); }
// Negative n gives a date in the future.
export function daysAgo(n, from = new Date()) { return fmt(new Date(from - n * DAY_MS)); }
export function r1(v) { return v != null ? Math.round(v * 10) / 10 : null; }
export function r2(v) { return v != null ? Math.round(v * 100) / 100 : null; }
