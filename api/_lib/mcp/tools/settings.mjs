// Sport settings (zones, thresholds) and athlete profile.

import { getJson, send } from '../api.mjs';
import { compact, diff, dryRunReply, mmss, paceOf, parsePace, round } from '../format.mjs';
import { dryRun, obj, sportType, verbose } from './schema.mjs';

// Bounds are upper limits; returns [{ name, from, to }].
const zoneTable = (bounds, names, unit, scale = x => x) => bounds?.map((b, i) => ({
  name: names?.[i] ?? `Z${i + 1}`,
  from: i ? scale(bounds[i - 1]) : 0,
  to: b >= 999 ? 'max' : scale(b),
  unit,
}));

export function settingsView(s) {
  const pace = s.threshold_pace;
  return compact({
    id: s.id,
    types: s.types,
    lthr: s.lthr,
    max_hr: s.max_hr,
    hr_zones: zoneTable(s.hr_zones, s.hr_zone_names, 'bpm'),
    threshold_pace: pace ? { mps: round(pace, 3), per_km: paceOf(pace) } : null,
    pace_zones: pace && s.pace_zones
      ? zoneTable(s.pace_zones, s.pace_zone_names, '% of threshold speed').map((z, i) => ({
        ...z, slowest_pace: i ? paceOf(pace * s.pace_zones[i - 1] / 100) : null,
        fastest_pace: s.pace_zones[i] >= 999 ? null : paceOf(pace * s.pace_zones[i] / 100),
      }))
      : null,
    ftp: s.ftp,
    indoor_ftp: s.indoor_ftp,
    power_zones: s.ftp && s.power_zones
      ? zoneTable(s.power_zones, s.power_zone_names, '% of FTP').map((z, i) => ({
        ...z, watts_to: s.power_zones[i] >= 999 ? 'max' : Math.round(s.ftp * s.power_zones[i] / 100),
      }))
      : null,
    warmup: mmss(s.warmup_time),
  });
}

const increasing = xs => xs.every((x, i) => !i || x > xs[i - 1]);

// Validates a zone list and its names; fills generic names when the count changes. Returns warnings.
function checkZones(change, current, zonesKey, namesKey, label) {
  const zones = change[zonesKey];
  const warnings = [];
  if (zones) {
    if (!zones.length || !zones.every(Number.isFinite) || !increasing(zones)) {
      throw new Error(`${zonesKey} must be strictly increasing numbers (zone upper limits)`);
    }
    if (!change[namesKey] && current[namesKey]?.length !== zones.length) {
      change[namesKey] = zones.map((_, i) => `Z${i + 1}`);
      warnings.push(`${label}: ${zones.length} zones but ${current[namesKey]?.length ?? 0} names; using Z1..Z${zones.length}. Pass ${namesKey} to name them.`);
    }
  }
  const names = change[namesKey];
  const count = (zones ?? current[zonesKey])?.length;
  if (names && names.length !== count) throw new Error(`${namesKey} has ${names.length} names but there are ${count} zones`);
  return warnings;
}

const numList = description => ({ type: 'array', items: { type: 'number' }, description });
const nameList = { type: 'array', items: { type: 'string' } };

export const settingsTools = [
  {
    name: 'get_sport_settings',
    description: 'Training zones and thresholds for one sport: LTHR, max HR, HR zones (bpm), threshold pace and pace zones (min/km), FTP and power zones (watts). Use before analyzing intensity or changing zones.',
    inputSchema: obj({ type: sportType, verbose }, ['type']),
    run: async (c, a) => {
      const s = await getJson(c, `/sport-settings/${encodeURIComponent(a.type)}`);
      return a.verbose ? compact(s) : settingsView(s);
    },
  },
  {
    name: 'update_sport_settings',
    description: 'Change zones/thresholds for one sport. Zones are upper limits in ascending order and any number of zones is allowed (e.g. 5 HR zones [141,157,166,175,190], last = max HR). hr_zones in bpm; pace_zones and power_zones in % of threshold pace / FTP. threshold_pace as "m:ss" per km or m/s. Existing activities keep their old zones. dry_run defaults to true.',
    inputSchema: obj({
      type: sportType,
      lthr: { type: 'integer', description: 'Lactate threshold HR, bpm' },
      max_hr: { type: 'integer', description: 'Max HR, bpm' },
      hr_zones: numList('HR zone upper limits, bpm'),
      hr_zone_names: nameList,
      threshold_pace: { type: ['string', 'number'], description: '"m:ss" per km, or m/s' },
      pace_zones: numList('Pace zone upper limits, % of threshold speed'),
      pace_zone_names: nameList,
      ftp: { type: 'integer', description: 'Watts' },
      indoor_ftp: { type: 'integer', description: 'Watts' },
      power_zones: numList('Power zone upper limits, % of FTP'),
      power_zone_names: nameList,
      dry_run: dryRun,
    }, ['type']),
    run: async (c, a) => {
      const path = `/sport-settings/${encodeURIComponent(a.type)}`;
      const current = await getJson(c, path);
      const keys = ['lthr', 'max_hr', 'hr_zones', 'hr_zone_names', 'pace_zones', 'pace_zone_names',
        'ftp', 'indoor_ftp', 'power_zones', 'power_zone_names'];
      const change = Object.fromEntries(keys.filter(k => a[k] != null).map(k => [k, a[k]]));
      if (a.threshold_pace != null) change.threshold_pace = parsePace(a.threshold_pace);
      if (!Object.keys(change).length) throw new Error('Nothing to change: pass at least one setting');

      const warnings = [
        ...checkZones(change, current, 'hr_zones', 'hr_zone_names', 'HR'),
        ...checkZones(change, current, 'pace_zones', 'pace_zone_names', 'Pace'),
        ...checkZones(change, current, 'power_zones', 'power_zone_names', 'Power'),
      ];
      const maxHr = change.max_hr ?? current.max_hr, hrZones = change.hr_zones;
      if (hrZones && maxHr && hrZones[hrZones.length - 1] !== maxHr) {
        warnings.push(`The last HR zone limit (${hrZones[hrZones.length - 1]}) differs from max_hr (${maxHr}).`);
      }

      const changes = diff(current, change);
      if (a.dry_run !== false) {
        return dryRunReply(`update ${a.type} sport settings`, {
          changes, warnings, after: settingsView({ ...current, ...change }),
        });
      }
      const saved = await send(c, 'PUT', `${path}?recalcHrZones=false`, change);
      return { applied: true, changes, warnings, settings: settingsView(saved ?? { ...current, ...change }) };
    },
  },
  {
    name: 'update_athlete',
    description: 'Change athlete-level values: weight (kg), resting HR (bpm), and which wellness fields are downloaded from Garmin (garmin_wellness_keys, e.g. ["hrv","restingHR","sleepSecs"]; empty list or null means all). dry_run defaults to true.',
    inputSchema: obj({
      weight: { type: 'number', description: 'kg' },
      resting_hr: { type: 'integer', description: 'bpm' },
      garmin_wellness_keys: { type: ['array', 'null'], items: { type: 'string' } },
      dry_run: dryRun,
    }),
    run: async (c, a) => {
      const change = compact({ icu_weight: a.weight, icu_resting_hr: a.resting_hr });
      if ('garmin_wellness_keys' in a) change.icu_garmin_wellness_keys = a.garmin_wellness_keys?.length ? a.garmin_wellness_keys : null;
      if (!Object.keys(change).length) throw new Error('Nothing to change: pass weight, resting_hr or garmin_wellness_keys');
      const current = await getJson(c, '');
      const changes = diff(current, change);
      if (a.dry_run !== false) return dryRunReply('update athlete', { changes });
      await send(c, 'PUT', '', change);
      return { applied: true, changes };
    },
  },
];
