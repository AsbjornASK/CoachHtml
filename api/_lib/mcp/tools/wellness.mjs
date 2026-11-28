// Athlete profile, wellness, fitness and training summaries.

import { getJson, qs, send } from '../api.mjs';
import { compact, diff, dryRunReply, family, km, mmss, round } from '../format.mjs';
import { listActivities } from './activities.mjs';
import { settingsView } from './settings.mjs';
import { date, dryRun, newest, obj, oldest, range, sportType, verbose } from './schema.mjs';

// Monday of the ISO week of a YYYY-MM-DD date.
export function weekStart(day) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}

// Groups activities by week (Monday) or month and totals them.
export function summarize(acts, groupBy = 'week') {
  const groups = new Map();
  for (const a of acts) {
    const day = a.start_date_local.slice(0, 10);
    const key = groupBy === 'month' ? day.slice(0, 7) : weekStart(day);
    const g = groups.get(key) ?? { period: key, sessions: 0, secs: 0, meters: 0, load: 0, by_type: {}, hr_zone_secs: [] };
    g.sessions++;
    g.secs += a.moving_time ?? 0;
    g.meters += a.distance ?? 0;
    g.load += a.icu_training_load ?? 0;
    const t = family(a.type);
    const bt = g.by_type[t] ?? (g.by_type[t] = { sessions: 0, secs: 0, meters: 0, load: 0 });
    bt.sessions++; bt.secs += a.moving_time ?? 0; bt.meters += a.distance ?? 0; bt.load += a.icu_training_load ?? 0;
    (a.icu_hr_zone_times ?? []).forEach((s, i) => { g.hr_zone_secs[i] = (g.hr_zone_secs[i] ?? 0) + s; });
    groups.set(key, g);
  }
  return [...groups.values()].sort((x, y) => x.period.localeCompare(y.period)).map(g => compact({
    period: g.period,
    sessions: g.sessions,
    time: mmss(g.secs),
    secs: g.secs,
    distance_km: km(g.meters),
    load: g.load,
    hr_zone_time: g.hr_zone_secs.length ? g.hr_zone_secs.map(s => mmss(s ?? 0)) : null,
    by_type: Object.fromEntries(Object.entries(g.by_type).map(([t, v]) => [t, compact({
      sessions: v.sessions, time: mmss(v.secs), distance_km: km(v.meters), load: v.load,
    })])),
  }));
}

const WELLNESS_HELP = 'HRV: `hrv` is Garmin overnight rMSSD (use this for readiness); `hrvSDNN` is Apple daytime SDNN — the two are not comparable. restingHR bpm, sleepSecs seconds, weight kg, bodyFat %, ctl/atl fitness/fatigue. Subjective scores soreness, fatigue, stress, mood, motivation, injury are 1-4 where 1 is best.';

export const wellnessTools = [
  {
    name: 'get_athlete',
    description: 'Athlete profile: weight, resting HR, timezone, connected Garmin sync settings, and a compact view of every sport\'s zones. verbose=true returns the raw profile.',
    inputSchema: obj({ verbose }),
    run: async (c, a) => {
      const at = await getJson(c, '');
      if (a.verbose) return compact(at);
      return compact({
        id: at.id, name: at.name, sex: at.sex, date_of_birth: at.icu_date_of_birth, timezone: at.timezone,
        weight_kg: at.icu_weight, resting_hr: at.icu_resting_hr, height_m: at.height,
        garmin: { activities: at.icu_garmin_sync_activities, wellness: at.icu_garmin_download_wellness, wellness_keys: at.icu_garmin_wellness_keys ?? 'all' },
        wellness_keys: at.icu_wellness_keys,
        sports: at.sportSettings?.map(settingsView),
      });
    },
  },
  {
    name: 'get_wellness',
    description: `Daily wellness records. ${WELLNESS_HELP} Pass fields (e.g. ["hrv","restingHR","sleepSecs"]) to get only those.`,
    inputSchema: obj({
      oldest: oldest(14), newest,
      fields: { type: 'array', items: { type: 'string' }, description: 'Wellness field names; the date (id) is always included' },
    }),
    run: async (c, a, today) => {
      const r = range(a, 14, today);
      const fields = a.fields?.length ? ['id', ...a.fields] : null;
      return compact(await getJson(c, `/wellness${qs({ ...r, fields })}`));
    },
  },
  {
    name: 'update_wellness',
    description: `Write wellness fields for one day. ${WELLNESS_HELP} Other fields: sleepScore, sleepQuality, comments. dry_run defaults to true.`,
    inputSchema: obj({
      date,
      fields: { type: 'object', description: 'Wellness fields to set', additionalProperties: true },
      dry_run: dryRun,
    }, ['date', 'fields']),
    run: async (c, a) => {
      const current = await getJson(c, `/wellness/${a.date}`).catch(e => (e.status === 404 ? {} : Promise.reject(e)));
      const changes = diff(current, a.fields);
      if (a.dry_run !== false) return dryRunReply(`update wellness ${a.date}`, { changes });
      await send(c, 'PUT', `/wellness/${a.date}`, { ...a.fields, id: a.date });
      return { applied: true, changes };
    },
  },
  {
    name: 'get_fitness',
    description: 'Fitness (CTL, 42-day load), fatigue (ATL, 7-day load), form (CTL − ATL, also in % of CTL) and ramp rate per day. Long ranges are thinned to one row per week (the Sunday) unless step="day".',
    inputSchema: obj({
      oldest: oldest(42), newest,
      step: { type: 'string', enum: ['auto', 'day', 'week'], description: 'auto = day up to 60 days, else week' },
    }),
    run: async (c, a, today) => {
      const r = range(a, 42, today);
      const rows = (await getJson(c, `/wellness${qs({ ...r, fields: ['id', 'ctl', 'atl', 'rampRate'] })}`) ?? [])
        .filter(w => w.ctl != null)
        .map(w => ({
          date: w.id, ctl: round(w.ctl), atl: round(w.atl), form: round(w.ctl - w.atl),
          form_pct: w.ctl ? round((w.ctl - w.atl) / w.ctl * 100, 0) : null, ramp: round(w.rampRate),
        }));
      const step = a.step ?? 'auto';
      const weekly = step === 'week' || (step === 'auto' && rows.length > 60);
      return weekly
        ? rows.filter((w, i) => new Date(`${w.date}T00:00:00Z`).getUTCDay() === 0 || i === rows.length - 1)
        : rows;
    },
  },
  {
    name: 'get_training_summary',
    description: 'Training totals per week (Monday start) or month: sessions, time, distance (km), load, time in HR zones (each activity in its own sport zones), and the same split by sport family. Optional type filter.',
    inputSchema: obj({
      oldest: oldest(56), newest,
      group_by: { type: 'string', enum: ['week', 'month'] },
      type: sportType,
    }),
    run: async (c, a, today) => {
      const acts = await listActivities(c, {
        ...range(a, 56, today), type: a.type,
        fields: ['start_date_local', 'moving_time', 'distance', 'icu_training_load', 'icu_hr_zone_times'],
      });
      return summarize(acts, a.group_by ?? 'week');
    },
  },
];
