import { intervalsClient, notConfigured, parseDays, findLatest, rhrOf, tsbOf, sleepHours } from './_lib/intervals.mjs';
import { json, fmt, daysAgo, r1 } from './_lib/util.mjs';

export async function GET() {
  const intervals = intervalsClient();
  if (!intervals) return notConfigured();

  const today     = new Date();
  const end       = fmt(today);
  const yesterday = daysAgo(1, today);
  const start     = daysAgo(21, today);

  const [wellnessRes, ywRes] = await Promise.all([
    intervals.get(`/wellness?oldest=${start}&newest=${end}`),
    intervals.get(`/wellness/${yesterday}`),
  ]);

  if (!wellnessRes.ok) {
    return json({ error: 'Intervals wellness API error', status: wellnessRes.status }, 502);
  }

  const rawWellness    = await wellnessRes.json();
  const yw             = ywRes.ok ? await ywRes.json() : {};

  const days           = parseDays(rawWellness);
  const last7          = days.slice(-7);
  const latest         = findLatest(days, d => rhrOf(d) != null);
  const yesterdayEntry = days.find(d => d.date === yesterday) ?? {};
  const todayEntry     = days.find(d => d.date === end) ?? {};

  const HEIGHT = 1.755;
  const bodyCompEntries = days.filter(d => d.weight && (d.fatMass || d.bodyFat));
  const bodyComp        = bodyCompEntries[bodyCompEntries.length - 1];
  const prevBodyComp    = bodyCompEntries[bodyCompEntries.length - 2];
  const toInBody = e => {
    if (!e) return null;
    const fp = e.bodyFat ?? null;
    return { date: e.date, weight: r1(e.weight), fatPct: r1(fp), fatMass: (e.weight && fp) ? r1(e.weight * fp / 100) : null, bmi: r1(e.weight / (HEIGHT * HEIGHT)) };
  };

  return json({
    today: end,
    latest: {
      date:         latest?.date         ?? null,
      hrv:          latest?.hrv          ?? null,
      restingHR:    latest?.restingHR    ?? null,
      sleepHours:   sleepHours(latest),
      sleepScore:   latest?.sleepScore   ?? null,
      sleepQuality: latest?.sleepQuality ?? null,
      ctl:          r1(latest?.ctl),
      atl:          r1(latest?.atl),
      tsb:          tsbOf(latest),
      rampRate:     r1(latest?.rampRate),
    },
    trends: {
      hrv:        last7.map(d => d.hrv ?? null),
      rhr:        last7.map(d => rhrOf(d)),
      sleep:      last7.map(d => sleepHours(d)),
      sleepScore: last7.map(d => d.sleepScore ?? null),
      dates:      last7.map(d => d.date),
    },
    sleep8: days.slice(-8).map(d => sleepHours(d)),
    healthMarkers: {
      date:   yesterday,
      sdnn:   r1(yesterdayEntry.sdnn   ?? yesterdayEntry.hrvSDNN ?? null),
      steps:  yesterdayEntry.steps  ?? null,
      spo2:   r1(yesterdayEntry.spO2   ?? yesterdayEntry.spo2   ?? null),
      vo2max: r1(yesterdayEntry.vo2max ?? yesterdayEntry.vo2Max  ?? null),
    },
    yesterdayWellness: {
      date:         yesterday,
      mood:         yw.mood         ?? yesterdayEntry.mood         ?? null,
      soreness:     yw.soreness     ?? yesterdayEntry.soreness     ?? null,
      fatigue:      yw.fatigue      ?? yesterdayEntry.fatigue      ?? null,
      motivation:   yw.motivation   ?? yesterdayEntry.motivation   ?? null,
      stress:       yw.stress       ?? yesterdayEntry.stress       ?? null,
      sleepQuality: yw.sleepQuality ?? yesterdayEntry.sleepQuality ?? null,
      comments:     yw.comments     ?? yesterdayEntry.comments     ?? null,
    },
    todayWellness: {
      date:       end,
      mood:       todayEntry.mood       ?? null,
      soreness:   todayEntry.soreness   ?? null,
      fatigue:    todayEntry.fatigue    ?? null,
      motivation: todayEntry.motivation ?? null,
      comments:   todayEntry.comments   ?? null,
      weight:     r1(todayEntry.weight),
    },
    inBody: bodyComp ? { ...toInBody(bodyComp), prev: toInBody(prevBodyComp) } : null,
    // Last logged dates inside the 21-day window; null means nothing logged in the window
    lastWeightDate:   days.findLast(d => d.weight)?.date ?? null,
    lastBodyCompDate: bodyComp?.date ?? null,
  });
}
