// Listing, searching, correcting and de-duplicating activities.

import { getJson, qs, send } from '../api.mjs';
import { streamMap } from '../analysis.mjs';
import {
  ACTIVITY_LIST_FIELDS, activityRow, compact, diff, dryRunReply, family, mmss, sourceOf, typeMatches,
} from '../format.mjs';
import { date, dryRun, newest, obj, oldest, range, sportType, verbose } from './schema.mjs';

const activityPath = id => `~/activity/${encodeURIComponent(id)}`;

// Activities in a range (newest first), optionally filtered by type family. fields null = all fields.
export async function listActivities(c, { oldest, newest, type, limit, fields = ACTIVITY_LIST_FIELDS }) {
  const rows = await getJson(c, `/activities${qs({
    oldest, newest, fields: fields && [...new Set(['id', 'type', ...fields])],
    // With a type filter the API limit would cut before filtering.
    limit: type ? null : limit,
  })}`) ?? [];
  const filtered = rows.filter(r => typeMatches(r.type, type));
  return limit ? filtered.slice(0, limit) : filtered;
}

const intervalView = i => compact({
  id: i.id, label: i.label, type: i.type, start_index: i.start_index, end_index: i.end_index,
  time: mmss(i.moving_time), distance_m: i.distance ? Math.round(i.distance) : null,
  avg_hr: i.average_heartrate, max_hr: i.max_heartrate, avg_watts: i.average_watts,
  np: i.weighted_average_watts, intensity: i.intensity, decoupling: i.decoupling,
});

// Weather and zone fields worth keeping in the compact single-activity view.
const DETAIL_FIELDS = [
  'description', 'elapsed_time', 'average_cadence', 'icu_hr_zones', 'icu_hr_zone_times', 'icu_zone_times',
  'lthr', 'icu_ftp', 'icu_intensity', 'icu_efficiency_factor', 'decoupling', 'trimp', 'calories',
  'average_weather_temp', 'average_feels_like', 'average_wind_speed', 'headwind_percent',
  'interval_summary', 'icu_ctl', 'icu_atl', 'paired_event_id', 'compliance', 'kg_lifted', 'race',
];

export function activityDetail(a) {
  const row = activityRow(a);
  for (const k of DETAIL_FIELDS) if (a[k] != null) row[k] = a[k];
  if (a.icu_hr_zone_times) row.hr_zone_time = a.icu_hr_zone_times.map(mmss);
  if (a.icu_intervals) row.intervals = a.icu_intervals.map(intervalView);
  return row;
}

// Score for keeping one of a duplicate pair: richer streams first, then the preferred source.
function keepScore(a) {
  const s = a.stream_types ?? [];
  const streams = s.includes('watts') ? 2 : s.includes('heartrate') ? 1 : 0;
  const src = sourceOf(a) ?? '';
  const preferred = family(a.type) === 'Ride' ? /^Garmin/.test(src) : /^HealthFit/.test(src);
  return streams * 10 + (preferred ? 5 : 0) + (a.moving_time ?? 0) / 1e6;
}

const startMs = a => Date.parse(a.start_date_local);
const endMs   = a => startMs(a) + (a.elapsed_time ?? a.moving_time ?? 0) * 1000;

// Groups activities of the same family whose time spans overlap by at least minOverlap seconds.
export function duplicateGroups(acts, minOverlap = 60) {
  const sorted = [...acts].sort((x, y) => startMs(x) - startMs(y));
  const groups = [];
  for (const a of sorted) {
    const g = groups.find(g => g.family === family(a.type)
      && g.items.some(b => Math.min(endMs(a), endMs(b)) - Math.max(startMs(a), startMs(b)) >= minOverlap * 1000));
    if (g) g.items.push(a); else groups.push({ family: family(a.type), items: [a] });
  }
  return groups.filter(g => g.items.length > 1).map(g => {
    const ranked = [...g.items].sort((x, y) => keepScore(y) - keepScore(x));
    return {
      keep: activityRow(ranked[0]),
      remove: ranked.slice(1).map(activityRow),
      reason: 'Kept the one with the richest streams (watts > HR > none), then the preferred source (Garmin for cycling, HealthFit for running/strength), then the longest.',
    };
  });
}

export const activityTools = [
  {
    name: 'get_activities',
    description: 'Completed activities in a date range, newest first, as a compact overview: duration (m:ss and secs), distance (km), pace (min/km) for runs, HR, watts, load, RPE, indoor flag, source (Garmin, HealthFit (MOWL/Bevel), Watchletic...) and available streams. Filter by type; use fields for specific raw Intervals fields.',
    inputSchema: obj({
      oldest: oldest(14), newest,
      type: sportType,
      limit: { type: 'integer', description: 'Max activities returned' },
      fields: { type: 'array', items: { type: 'string' }, description: 'Raw Intervals field names to return instead of the overview, e.g. ["icu_hr_zone_times","decoupling"]' },
      verbose,
    }),
    run: async (c, a, today) => {
      const r = range(a, 14, today);
      if (a.fields?.length) return listActivities(c, { ...r, type: a.type, limit: a.limit, fields: ['start_date_local', 'name', ...a.fields] });
      const rows = await listActivities(c, { ...r, type: a.type, limit: a.limit, fields: a.verbose ? null : undefined });
      return a.verbose ? compact(rows) : rows.map(activityRow);
    },
  },
  {
    name: 'get_activity',
    description: 'One activity by id (e.g. "i12345678"): the overview plus description, HR zone times, efficiency, decoupling, weather and optionally the intervals/laps. verbose=true returns every raw field.',
    inputSchema: obj({
      id: { type: 'string', description: 'Activity id' },
      intervals: { type: 'boolean', description: 'Include the interval breakdown' },
      verbose,
    }, ['id']),
    run: async (c, a) => {
      const act = await getJson(c, `${activityPath(a.id)}${a.intervals ? '?intervals=true' : ''}`);
      return a.verbose ? compact(act) : activityDetail(act);
    },
  },
  {
    name: 'search_activities',
    description: 'Find activities by name (case-insensitive substring, e.g. "TEST" or "tærskel") or by exact tag when the query starts with # (e.g. "#test"). Optional type and date filters. Returns compact rows.',
    inputSchema: obj({
      query: { type: 'string' },
      type: sportType,
      oldest: { ...date, description: 'Only activities on or after this date' },
      newest: { ...date, description: 'Only activities on or before this date' },
      limit: { type: 'integer', description: 'Max results (default 20)' },
    }, ['query']),
    run: async (c, a) => {
      const limit = a.limit ?? 20;
      const filtering = a.type || a.oldest || a.newest;
      const rows = await getJson(c, `/activities/search${qs({ q: a.query, limit: filtering ? Math.max(limit * 10, 200) : limit })}`) ?? [];
      const day = r => r.start_date_local?.slice(0, 10);
      return rows
        .filter(r => typeMatches(r.type, a.type) && (!a.oldest || day(r) >= a.oldest) && (!a.newest || day(r) <= a.newest))
        .slice(0, limit)
        .map(r => compact({ ...activityRow(r), description: r.description }));
    },
  },
  {
    name: 'update_activity',
    description: 'Correct an activity: name, type (e.g. VirtualRide for indoor cycling), rpe (1-10), feel (1-5, 1 = strong, 5 = weak), tags (replaces the list), trainer (true = indoor), description, kg_lifted. dry_run defaults to true.',
    inputSchema: obj({
      id: { type: 'string' },
      name: { type: 'string' },
      type: { type: 'string' },
      rpe: { type: 'integer', minimum: 1, maximum: 10 },
      feel: { type: 'integer', minimum: 1, maximum: 5 },
      tags: { type: 'array', items: { type: 'string' } },
      trainer: { type: 'boolean' },
      description: { type: 'string' },
      kg_lifted: { type: 'number', description: 'Total kg lifted (strength)' },
      dry_run: dryRun,
    }, ['id']),
    run: async (c, a) => {
      const change = compact({
        name: a.name, type: a.type, icu_rpe: a.rpe, feel: a.feel, tags: a.tags,
        trainer: a.trainer, description: a.description, kg_lifted: a.kg_lifted,
      });
      if (!Object.keys(change).length) throw new Error('Nothing to change');
      const current = await getJson(c, activityPath(a.id));
      const changes = diff(current, change);
      if (a.dry_run !== false) return dryRunReply(`update activity ${a.id}`, { activity: activityRow(current), changes });
      const saved = await send(c, 'PUT', activityPath(a.id), change);
      return { applied: true, changes, activity: activityRow(saved ?? { ...current, ...change }) };
    },
  },
  {
    name: 'delete_activity',
    description: 'Delete an activity, e.g. the extra copy of a duplicate (see find_duplicates). Cannot be undone. dry_run defaults to true and shows what would be deleted.',
    inputSchema: obj({ id: { type: 'string' }, dry_run: dryRun }, ['id']),
    run: async (c, a) => {
      const current = await getJson(c, activityPath(a.id));
      if (a.dry_run !== false) return dryRunReply(`delete activity ${a.id}`, { activity: activityRow(current) });
      await send(c, 'DELETE', activityPath(a.id));
      return { applied: true, deleted: activityRow(current) };
    },
  },
  {
    name: 'find_duplicates',
    description: 'Find duplicate activities: same sport family (Ride/VirtualRide, Run/VirtualRun, ...) with overlapping time spans, e.g. the same session synced from both Garmin and HealthFit or Watchletic. Suggests which to keep. Read-only; delete with delete_activity.',
    inputSchema: obj({
      oldest: oldest(30), newest,
      min_overlap_secs: { type: 'integer', description: 'Minimum overlap to count as duplicate (default 60)' },
    }),
    run: async (c, a, today) => {
      const acts = await listActivities(c, range(a, 30, today));
      const groups = duplicateGroups(acts, a.min_overlap_secs ?? 60);
      return { checked: acts.length, duplicate_groups: groups.length, groups };
    },
  },
  {
    name: 'update_intervals',
    description: 'Add or replace intervals on an activity, e.g. mark a test segment. Each interval needs start/end as seconds from the start (start_secs/end_secs) or stream indexes (start_index/end_index), plus optional label and type (WORK or RECOVERY). replace=true replaces all intervals; otherwise they are merged. dry_run defaults to true.',
    inputSchema: obj({
      id: { type: 'string' },
      intervals: {
        type: 'array',
        items: obj({
          start_secs: { type: 'number' }, end_secs: { type: 'number' },
          start_index: { type: 'integer' }, end_index: { type: 'integer' },
          label: { type: 'string' }, type: { type: 'string', enum: ['WORK', 'RECOVERY'] },
        }),
      },
      replace: { type: 'boolean', description: 'Replace all existing intervals (default false = merge)' },
      dry_run: dryRun,
    }, ['id', 'intervals']),
    run: async (c, a) => {
      let time;
      if (a.intervals.some(i => i.start_index == null || i.end_index == null)) {
        time = streamMap(await getJson(c, `${activityPath(a.id)}/streams${qs({ types: ['time'] })}`)).time ?? [];
      }
      const indexAt = secs => {
        const i = time.findIndex(t => t >= secs);
        return i < 0 ? time.length : i;
      };
      const proposed = a.intervals.map(i => compact({
        start_index: i.start_index ?? indexAt(i.start_secs ?? 0),
        end_index: i.end_index ?? indexAt(i.end_secs ?? Infinity),
        label: i.label, type: i.type ?? 'WORK',
      }));
      for (const p of proposed) if (!(p.end_index > p.start_index)) throw new Error(`Interval "${p.label ?? ''}" ends before it starts`);
      const current = await getJson(c, `${activityPath(a.id)}/intervals`);
      const before = (current?.icu_intervals ?? []).map(intervalView);
      if (a.dry_run !== false) {
        return dryRunReply(`${a.replace ? 'replace' : 'add'} intervals on ${a.id}`, { before, proposed });
      }
      const saved = await send(c, 'PUT', `${activityPath(a.id)}/intervals${a.replace ? '?all=true' : ''}`, proposed);
      return { applied: true, intervals: (saved?.icu_intervals ?? []).map(intervalView) };
    },
  },
];
