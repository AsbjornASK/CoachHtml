// Output helpers for the MCP tools: compact objects, human-readable units, diffs.

// Drops null/undefined values (recursively), so tool output stays small.
export function compact(v) {
  if (Array.isArray(v)) return v.map(compact);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) if (x != null) out[k] = compact(x);
    return out;
  }
  return v;
}

const pad = n => String(n).padStart(2, '0');

// Seconds as m:ss, or h:mm:ss from one hour.
export function mmss(secs) {
  if (secs == null || !Number.isFinite(secs)) return null;
  const s = Math.round(secs), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

// Speed in m/s as pace "m:ss/km".
export function paceOf(mps) {
  return mps > 0 ? `${mmss(1000 / mps)}/km` : null;
}

// Pace given as "m:ss" (per km) or a number of m/s, returned as m/s.
export function parsePace(p) {
  if (typeof p === 'number') return p;
  const m = /^(\d+):(\d{2})$/.exec(String(p).trim());
  if (!m) throw new Error(`Pace must be "m:ss" per km or m/s, got "${p}"`);
  return 1000 / (Number(m[1]) * 60 + Number(m[2]));
}

export const round = (v, d = 1) => v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d;
export const km = m => m ? round(m / 1000, 2) : null;

// Fields that differ between before and the proposed change.
export function diff(before, change) {
  const out = {};
  for (const [k, after] of Object.entries(change)) {
    const was = before?.[k] ?? null;
    if (JSON.stringify(was) !== JSON.stringify(after)) out[k] = { before: was, after };
  }
  return out;
}

// Standard reply of a write tool run without dry_run=false.
export const dryRunReply = (action, details) => ({
  dry_run: true,
  action,
  ...details,
  note: 'Nothing was changed. Call again with dry_run=false to apply.',
});

// --- Activities ---

const RIDE = /Ride$|^Cyclocross$/;
const RUN  = /Run$/;

// Sport family used for type filters and duplicate matching.
export function family(type = '') {
  if (RIDE.test(type)) return 'Ride';
  if (RUN.test(type)) return 'Run';
  return type;
}

// A type filter matches the exact type or, for Ride/Run, the whole family.
export const typeMatches = (type, filter) => !filter || type === filter || (filter === family(filter) && family(type) === filter);

export const isIndoor = a => a.trainer === true || /^Virtual/.test(a.type ?? '');

// "Garmin", "HealthFit (MOWL)", "HealthFit (Bevel)", "Watchletic" ...
export function sourceOf(a) {
  if (a.source === 'GARMIN_CONNECT') return 'Garmin';
  const app = /-([^-]+)\.(fit|tcx|gpx)$/i.exec(a.external_id ?? '')?.[1];
  const recorder = app && (/apple.?watch/i.test(app) ? 'Apple Watch' : app);
  const via = a.oauth_client_name ?? (a.source && a.source !== 'OAUTH_CLIENT' ? a.source : null);
  if (via && recorder && recorder !== via) return `${via} (${recorder})`;
  return via ?? recorder ?? a.device_name ?? null;
}

// Fields the compact activity view needs from the API.
export const ACTIVITY_LIST_FIELDS = [
  'id', 'start_date_local', 'type', 'name', 'moving_time', 'elapsed_time', 'distance',
  'average_speed', 'average_heartrate', 'max_heartrate', 'icu_average_watts', 'icu_weighted_avg_watts',
  'icu_training_load', 'icu_rpe', 'feel', 'trainer', 'tags', 'source', 'oauth_client_name',
  'external_id', 'device_name', 'stream_types', 'total_elevation_gain',
];

// One compact, human-readable activity row.
export function activityRow(a) {
  const run = family(a.type) === 'Run' || a.type === 'Walk' || a.type === 'Hike';
  return compact({
    id: a.id,
    date: a.start_date_local,
    type: a.type,
    name: a.name,
    duration: mmss(a.moving_time),
    moving_time: a.moving_time,
    distance_km: km(a.distance),
    pace: run ? paceOf(a.average_speed) : null,
    speed_kmh: !run && a.average_speed ? round(a.average_speed * 3.6) : null,
    avg_hr: a.average_heartrate,
    max_hr: a.max_heartrate,
    avg_watts: a.icu_average_watts,
    np: a.icu_weighted_avg_watts,
    load: a.icu_training_load,
    rpe: a.icu_rpe,
    feel: a.feel,
    elevation_m: a.total_elevation_gain || null,
    tags: a.tags?.length ? a.tags : null,
    indoor: isIndoor(a),
    source: sourceOf(a),
    streams: a.stream_types?.filter(s => s !== 'time'),
  });
}
