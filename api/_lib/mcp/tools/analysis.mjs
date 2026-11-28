// Streams, server-side activity analysis and best efforts.

import { getJson, qs } from '../api.mjs';
import {
  avg, decoupling, downsample, metersPerBeat, normalizedPower, slice, splits, streamMap, timeInZones,
} from '../analysis.mjs';
import { activityRow, compact, family, mmss, paceOf, round } from '../format.mjs';
import { date, obj, range, sportType } from './schema.mjs';

const STREAM_ALIASES = {
  hr: 'heartrate', heart_rate: 'heartrate', speed: 'velocity_smooth', pace: 'velocity_smooth',
  velocity: 'velocity_smooth', power: 'watts', elevation: 'altitude',
};
const DEFAULT_STREAMS = ['heartrate', 'velocity_smooth', 'watts', 'cadence', 'altitude', 'distance'];

async function fetchStreams(c, id, types) {
  const raw = await getJson(c, `~/activity/${encodeURIComponent(id)}/streams${qs({ types: ['time', ...types] })}`);
  const map = streamMap(raw);
  // Drop streams that are entirely empty.
  for (const k of Object.keys(map)) if (k !== 'time' && !map[k]?.some(v => v != null)) delete map[k];
  return map;
}

const numList = description => ({ type: 'array', items: { type: 'number' }, description });

export const analysisTools = [
  {
    name: 'get_activity_streams',
    description: 'Time series for one activity, averaged into buckets of `resolution` seconds (default 30; 1 = raw, which can be large). Streams: heartrate (bpm), velocity_smooth (m/s, also given as pace min/km), watts, cadence (rpm/spm), altitude (m), distance (m, cumulative). Aliases hr, pace, power accepted. Prefer analyze_activity for summaries.',
    inputSchema: obj({
      id: { type: 'string' },
      types: { type: 'array', items: { type: 'string' }, description: `Default: ${DEFAULT_STREAMS.join(', ')}` },
      resolution: { type: 'integer', minimum: 1, description: 'Seconds per point (default 30)' },
      from_secs: { type: 'number', description: 'Only from this many seconds into the activity' },
      to_secs: { type: 'number', description: 'Only up to this many seconds into the activity' },
    }, ['id']),
    run: async (c, a) => {
      const types = [...new Set((a.types?.length ? a.types : DEFAULT_STREAMS).map(t => STREAM_ALIASES[t] ?? t))];
      const map = slice(await fetchStreams(c, a.id, types), a.from_secs, a.to_secs);
      const res = a.resolution ?? 30;
      const out = res > 1 ? downsample(map, res) : map;
      if (out.velocity_smooth) out.pace_per_km = out.velocity_smooth.map(v => v > 0.5 ? paceOf(v).replace('/km', '') : null);
      return {
        id: a.id,
        resolution_secs: res,
        points: out.time?.length ?? 0,
        missing: types.filter(t => !map[t]),
        streams: out,
      };
    },
  },
  {
    name: 'analyze_activity',
    description: 'Server-side analysis of one activity from its streams. Returns: time in HR zones (Intervals zones and, if hr_zones is given, your own limits for comparing zone models), aerobic decoupling (Pa:Hr for runs, Pw:Hr when there is power; % drift of output per beat from first to second half, <5% = stable), splits per km or per split_secs, meters per heartbeat for runs, average/normalized power, IF and %FTP per work interval for rides, and weather when recorded. Use from_secs/to_secs to analyze only the main set.',
    inputSchema: obj({
      id: { type: 'string' },
      hr_zones: numList('Own HR zone upper limits in bpm to compare, e.g. [141,157,166,175,190]'),
      hr_zone_names: { type: 'array', items: { type: 'string' } },
      from_secs: { type: 'number' },
      to_secs: { type: 'number' },
      split: { type: 'string', enum: ['auto', 'km', 'time'], description: 'auto = km for runs with distance, else time' },
      split_secs: { type: 'integer', description: 'Seconds per time split (default 300)' },
      target_pct_ftp: { type: 'number', description: 'Target for work intervals in % of FTP, e.g. 88 (220 W at 250 W FTP)' },
    }, ['id']),
    run: async (c, a) => {
      const act = await getJson(c, `~/activity/${encodeURIComponent(a.id)}?intervals=true`);
      const fam = family(act.type);
      const map = slice(await fetchStreams(c, a.id, ['heartrate', 'velocity_smooth', 'distance', 'watts', 'cadence']), a.from_secs, a.to_secs);
      const { time = [], heartrate: hr, watts, velocity_smooth: speed } = map;
      const out = {
        activity: activityRow(act),
        analyzed: { from: mmss(time[0] ?? 0), to: mmss(time[time.length - 1] ?? 0), samples: time.length },
        streams: Object.keys(map).filter(k => k !== 'time'),
      };
      if (!time.length) return { ...out, note: 'No stream data in this activity or range.' };

      if (hr) {
        out.avg_hr = round(avg(hr), 0);
        if (act.icu_hr_zones) out.hr_zones_intervals = timeInZones(hr, time, act.icu_hr_zones);
        if (a.hr_zones?.length) out.hr_zones_custom = timeInZones(hr, time, a.hr_zones, a.hr_zone_names);
      } else {
        out.note = 'No heart-rate stream.';
      }

      const output = watts ? 'watts' : speed ? 'speed' : null;
      if (hr && output) {
        out.decoupling = {
          kind: watts ? 'Pw:Hr' : 'Pa:Hr',
          pct: decoupling(time, hr, watts ?? speed),
          ...(fam === 'Run' && !watts && act.trainer ? { caveat: 'Treadmill speed is estimated by the watch; read Pa:Hr with care.' } : {}),
        };
      }

      const by = a.split === 'time' || (a.split !== 'km' && fam !== 'Run') ? 'time' : 'km';
      out.splits = splits(map, by, a.split_secs ?? 300);

      if (fam === 'Run' || act.type === 'Walk') {
        out.meters_per_beat = metersPerBeat(map);
        if (speed) out.avg_pace = paceOf(avg(speed));
      }

      if (watts) {
        const ftp = act.icu_ftp;
        const np = normalizedPower(time, watts), mean = avg(watts);
        out.power = compact({
          avg_watts: round(mean, 0), np, ftp,
          intensity_factor: ftp ? round(np / ftp, 2) : null,
          variability_index: mean ? round(np / mean, 2) : null,
        });
        const work = (act.icu_intervals ?? []).filter(i => i.type === 'WORK' && i.average_watts);
        if (work.length) {
          out.power.work_intervals = work.map(i => compact({
            label: i.label, time: mmss(i.moving_time), avg_watts: i.average_watts, avg_hr: i.average_heartrate,
            pct_ftp: ftp ? round(i.average_watts / ftp * 100) : null,
            vs_target_pct: ftp && a.target_pct_ftp ? round(i.average_watts / ftp * 100 - a.target_pct_ftp) : null,
          }));
        }
      }

      const weather = compact({
        temp_c: act.average_weather_temp, feels_like_c: act.average_feels_like,
        wind_kmh: act.average_wind_speed != null ? round(act.average_wind_speed * 3.6) : null,
        headwind_pct: act.headwind_percent,
      });
      if (Object.keys(weather).length) out.weather = weather;
      return out;
    },
  },
  {
    name: 'get_best_efforts',
    description: 'Best efforts in a date range from the Intervals curves, with date and activity id. metric power: best average watts for each duration (secs); hr: highest average HR for each duration; pace: fastest time for each distance (meters), with pace min/km. Use e.g. to track a goal like 45 min @ 220 W (power, durations [2700]).',
    inputSchema: obj({
      type: { ...sportType, description: 'Sport, e.g. Ride (includes VirtualRide) or Run. Default Ride for power, Run otherwise.' },
      metric: { type: 'string', enum: ['power', 'hr', 'pace'] },
      durations: numList('Seconds, for power/hr (default 60, 300, 1200, 2700, 3600)'),
      distances: numList('Meters, for pace (default 1000, 5000, 10000)'),
      oldest: { ...date, description: 'Default 90 days ago' },
      newest: date,
    }, ['metric']),
    run: async (c, a, today) => {
      const { oldest, newest } = range(a, 90, today);
      const type = a.type ?? (a.metric === 'power' ? 'Ride' : 'Run');
      const res = await getJson(c, `/${a.metric}-curves${qs({ type, curves: `r.${oldest}.${newest}` })}`);
      const curve = res?.list?.[0];
      const byDistance = a.metric === 'pace';
      const xs = byDistance ? curve?.distance : curve?.secs;
      if (!xs?.length) return { type, metric: a.metric, oldest, newest, efforts: [], note: 'No data for this sport and period.' };

      const wanted = byDistance ? (a.distances ?? [1000, 5000, 10000]) : (a.durations ?? [60, 300, 1200, 2700, 3600]);
      const efforts = wanted.map(w => {
        const i = xs.findIndex(x => x >= w);
        if (i < 0) return { [byDistance ? 'distance_m' : 'secs']: w, value: null, note: 'Longer than any effort in the period' };
        const id = curve.activity_id?.[i];
        const v = curve.values[i];
        return compact({
          ...(byDistance ? { distance_m: xs[i], time: mmss(v), pace: paceOf(xs[i] / v) } : { secs: xs[i], duration: mmss(xs[i]) }),
          value: v,
          unit: { power: 'W', hr: 'bpm', pace: 's' }[a.metric],
          w_per_kg: a.metric === 'power' ? curve.watts_per_kg?.[i] : null,
          activity_id: id,
          date: res.activities?.[id]?.start_date_local?.slice(0, 10),
          name: res.activities?.[id]?.name,
        });
      });
      return { type, metric: a.metric, oldest, newest, efforts };
    },
  },
];
