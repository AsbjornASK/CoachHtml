import { intervalsClient, notConfigured, parseDays, findLatest, rhrOf, tsbOf, sleepHours, isBodyComp, freshnessDates } from './_lib/intervals.mjs';
import { json, fmt, daysAgo, r1 } from './_lib/util.mjs';

export async function GET() {
  const intervals = intervalsClient();
  if (!intervals) return notConfigured();

  const today     = new Date();
  const end       = fmt(today);
  const yesterday = daysAgo(1, today);
  const start     = daysAgo(90, today);

  const [wellnessRes, ywRes] = await Promise.all([
    intervals.get(`/wellness?oldest=${start}&newest=${end}`),
    intervals.get(`/wellness/${yesterday}`),
  ]);

  if (!wellnessRes.ok) {
    return json({ error: 'Intervals wellness API error', status: wellnessRes.status }, 502);
  }

  const rawWellness = await wellnessRes.json();
  const yw          = ywRes.ok ? await ywRes.json() : {};

  const days    = parseDays(rawWellness);
  const allDays = days;
  const spo2Entries = allDays.filter(d => (d.spO2 ?? d.spo2) != null);
  const lastSpo2    = spo2Entries[spo2Entries.length - 1];
  const prevSpo2    = spo2Entries[spo2Entries.length - 2];
  const vo2Entries  = allDays.filter(d => (d.vo2max ?? d.vo2Max) != null);
  const lastVo2     = vo2Entries[vo2Entries.length - 1];
  const prevVo2     = vo2Entries[vo2Entries.length - 2];
  const last7          = days.slice(-7);
  const latest         = findLatest(days, d => rhrOf(d) != null);
  const yesterdayEntry = days.find(d => d.date === yesterday) ?? {};
  const todayEntry     = days.find(d => d.date === end) ?? {};

  const HEIGHT = 1.755;
  const bodyCompEntries = days.filter(isBodyComp);
  const bodyComp        = bodyCompEntries[bodyCompEntries.length - 1];
  const prevBodyComp    = bodyCompEntries[bodyCompEntries.length - 2];
  const toInBody = e => {
    if (!e) return null;
    const fp = e.bodyFat ?? null;
    return { date: e.date, weight: r1(e.weight), fatPct: r1(fp), fatMass: (e.weight && fp) ? r1(e.weight * fp / 100) : null, bmi: r1(e.weight / (HEIGHT * HEIGHT)), height: HEIGHT };
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
      sdnn:       last7.map(d => r1(d.sdnn ?? d.hrvSDNN ?? null)),
      steps:      last7.map(d => d.steps ?? null),
      dates:      last7.map(d => d.date),
      wellness: {
        soreness:     last7.map(d => d.soreness     ?? null),
        fatigue:      last7.map(d => d.fatigue      ?? null),
        motivation:   last7.map(d => d.motivation   ?? null),
        stress:       last7.map(d => d.stress       ?? null),
        mood:         last7.map(d => d.mood         ?? null),
        sleepQuality: last7.map(d => d.sleepQuality ?? null),
      },
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
      soreness:   todayEntry.soreness   ?? null,
      fatigue:    todayEntry.fatigue    ?? null,
      motivation: todayEntry.motivation ?? null,
      injury:     todayEntry.injury     ?? null,
      comments:   todayEntry.comments   ?? null,
      weight:     r1(todayEntry.weight),
    },
    inBody: bodyComp ? { ...toInBody(bodyComp), prev: toInBody(prevBodyComp) } : null,
    spo2Latest: lastSpo2 ? { date: lastSpo2.date, value: r1(lastSpo2.spO2 ?? lastSpo2.spo2), prev: prevSpo2 ? r1(prevSpo2.spO2 ?? prevSpo2.spo2) : null } : null,
    vo2Latest:  lastVo2  ? { date: lastVo2.date,  value: r1(lastVo2.vo2max  ?? lastVo2.vo2Max),  prev: prevVo2  ? r1(prevVo2.vo2max  ?? prevVo2.vo2Max)  : null } : null,
    // Last logged dates inside the 21-day window; null means nothing logged in the window
    ...freshnessDates(days),
  });
}
