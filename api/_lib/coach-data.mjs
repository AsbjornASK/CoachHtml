// The Coach page payload, built from parsed wellness days. Shared by get-coach and the morning push.
import { findLatest, rhrOf, tsbOf, sleepHours } from './intervals.mjs';
import { r1 } from './util.mjs';

export function coachData(days, activities, end) {
  const last7      = days.slice(-7);
  const latest     = findLatest(days, d => rhrOf(d) != null);
  const todayEntry = days.find(d => d.date === end) ?? {};

  return {
    today: end,
    latest: {
      date:       latest?.date       ?? null,
      hrv:        latest?.hrv        ?? null,
      restingHR:  latest?.restingHR  ?? null,
      sleepHours: sleepHours(latest),
      sleepScore: latest?.sleepScore ?? null,
      ctl:        r1(latest?.ctl),
      atl:        r1(latest?.atl),
      tsb:        tsbOf(latest),
      rampRate:   r1(latest?.rampRate),
    },
    trends: {
      hrv:       last7.map(d => d.hrv ?? null),
      rhr:       last7.map(d => rhrOf(d)),
      sleep:     last7.map(d => sleepHours(d)),
      sleepScore:last7.map(d => d.sleepScore ?? null),
      tsb:       last7.map(d => tsbOf(d)),
      fatigue:   last7.map(d => d.fatigue   ?? null),
      soreness:  last7.map(d => d.soreness  ?? null),
      dates:     last7.map(d => d.date),
    },
    sleep8: days.slice(-8).map(d => sleepHours(d)),
    fitnessHistory: days.map(d => ({
      date: d.date,
      ctl:  r1(d.ctl),
      atl:  r1(d.atl),
      tsb:  tsbOf(d),
    })),
    subjective: {
      mood:       todayEntry.mood       ?? null,
      soreness:   todayEntry.soreness   ?? null,
      fatigue:    todayEntry.fatigue    ?? null,
      motivation: todayEntry.motivation ?? null,
      injury:     todayEntry.injury     ?? null,
    },
    activities,
  };
}
