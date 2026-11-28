// Pure calculations on activity streams. A stream map is { time: [secs], heartrate: [...], ... }.

import { mmss, paceOf, round } from './format.mjs';

// Seconds of a sample longer than this (a pause) count as this much.
const MAX_DT = 10;

// Intervals returns [{ type, data }, ...].
export const streamMap = streams => Object.fromEntries((streams ?? []).map(s => [s.type, s.data]));

const mean = xs => {
  let sum = 0, n = 0;
  for (const x of xs) if (x != null && Number.isFinite(x)) { sum += x; n++; }
  return n ? sum / n : null;
};

// Duration of each sample (time to the next one), pauses capped at MAX_DT.
function durations(time) {
  return time.map((t, i) => i < time.length - 1 ? Math.min(Math.max(time[i + 1] - t, 0), MAX_DT) : 1);
}

// Keeps only samples with from_secs <= time < to_secs.
export function slice(map, fromSecs = 0, toSecs = Infinity) {
  const time = map.time ?? [];
  const keep = time.map((t, i) => t >= fromSecs && t < toSecs ? i : -1).filter(i => i >= 0);
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, keep.map(i => v[i])]));
}

// Averages every stream over buckets of `resolution` seconds.
export function downsample(map, resolution = 30) {
  const time = map.time ?? [];
  const keys = Object.keys(map).filter(k => k !== 'time');
  const out = { time: [], ...Object.fromEntries(keys.map(k => [k, []])) };
  let start = 0;
  while (start < time.length) {
    const bucket = Math.floor(time[start] / resolution);
    let end = start;
    while (end < time.length && Math.floor(time[end] / resolution) === bucket) end++;
    out.time.push(bucket * resolution);
    for (const k of keys) {
      const v = map[k];
      // Distance is cumulative: take the last value, not the mean.
      out[k].push(k === 'distance' ? round(v[end - 1], 0) : round(mean(v.slice(start, end)), k === 'velocity_smooth' ? 2 : 1));
    }
    start = end;
  }
  return out;
}

// Seconds per zone. bounds are zone upper limits (bpm), as Intervals stores them:
// zone i holds values <= bounds[i]; values above the last bound fall in the last zone.
export function timeInZones(values, time, bounds, names = []) {
  const secs = bounds.map(() => 0);
  const dt = durations(time);
  values.forEach((v, i) => {
    if (v == null) return;
    const z = bounds.findIndex(b => v <= b);
    secs[z < 0 ? bounds.length - 1 : z] += dt[i];
  });
  const total = secs.reduce((a, b) => a + b, 0) || 1;
  return bounds.map((b, i) => ({
    zone: names[i] ?? `Z${i + 1}`,
    range: `${i ? bounds[i - 1] + 1 : 0}-${b}`,
    secs: secs[i],
    time: mmss(secs[i]),
    pct: round(secs[i] / total * 100),
  }));
}

// Aerobic decoupling: output per heartbeat in the first half vs the second half (by time), in %.
// Positive means the heart rate drifted up relative to the output. Below ~5% is usually read as aerobically stable.
export function decoupling(time, hr, output) {
  if (!time?.length || !hr?.length || !output?.length) return null;
  const mid = time[0] + (time[time.length - 1] - time[0]) / 2;
  const ratio = pick => {
    const o = mean(output.filter((_, i) => pick(time[i])));
    const h = mean(hr.filter((_, i) => pick(time[i])));
    return o != null && h ? o / h : null;
  };
  const first = ratio(t => t < mid), second = ratio(t => t >= mid);
  return first && second ? round((first - second) / first * 100) : null;
}

// Normalized power: 30 s rolling mean of power, raised to the 4th, averaged, 4th root.
export function normalizedPower(time, watts) {
  if (!watts?.some(w => w != null)) return null;
  let sum = 0, j = 0, acc = 0, n = 0, total = 0, count = 0;
  for (let i = 0; i < watts.length; i++) {
    sum += watts[i] ?? 0; n++;
    while (time[i] - time[j] >= 30) { sum -= watts[j] ?? 0; n--; j++; }
    if (time[i] - time[0] >= 29) { acc = sum / n; total += acc ** 4; count++; }
  }
  return count ? Math.round((total / count) ** 0.25) : Math.round(mean(watts));
}

// Splits per km (needs a distance stream) or per fixed number of seconds.
export function splits(map, by = 'km', secs = 300) {
  const { time = [], distance, heartrate, watts, velocity_smooth: speed } = map;
  const useKm = by === 'km' && distance?.some(d => d > 0);
  const key = i => useKm ? Math.floor((distance[i] ?? 0) / 1000) : Math.floor((time[i] - time[0]) / secs);
  const out = [];
  let start = 0;
  while (start < time.length) {
    const k = key(start);
    let end = start;
    while (end < time.length && key(end) === k) end++;
    const dur = time[Math.min(end, time.length - 1)] - time[start];
    const dist = distance ? (distance[Math.min(end, time.length - 1)] ?? 0) - (distance[start] ?? 0) : null;
    if (dur > 0) out.push({
      split: out.length + 1,
      time: mmss(dur),
      distance_m: dist != null ? Math.round(dist) : null,
      pace: dist > 0 ? paceOf(dist / dur) : (speed ? paceOf(mean(speed.slice(start, end))) : null),
      avg_hr: round(mean(heartrate?.slice(start, end) ?? []), 0),
      avg_watts: watts ? round(mean(watts.slice(start, end)), 0) : null,
    });
    start = end;
  }
  return out;
}

// Meters per heartbeat over the samples: total distance / total beats.
export function metersPerBeat(map) {
  const { time = [], heartrate, distance } = map;
  if (!heartrate || !distance || time.length < 2) return null;
  const dt = durations(time);
  const beats = heartrate.reduce((a, h, i) => a + (h ?? 0) * dt[i] / 60, 0);
  const meters = (distance[distance.length - 1] ?? 0) - (distance[0] ?? 0);
  return beats ? round(meters / beats, 2) : null;
}

export const avg = mean;
