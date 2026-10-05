// The morning push text: check-in reminder, or Readiness + today's sessions, plus freshness warnings.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { hasCheckinValues } = require('../../static/js/checkin-state.js');
const { freshnessWarnings, warningText } = require('../../static/js/data-freshness.js');
const { calcRecovery, calcSleep, calcReadiness, verdictColor } = require('../../static/js/readiness.js');

const DOT = { green: '🟢', yellow: '🟡', red: '🔴' };

// Same inputs as the Coach page's Readiness ring
function readinessOf(coach) {
  const l = coach.latest ?? {};
  const rec = calcRecovery(l.hrv, l.restingHR, l.sleepHours, l.tsb);
  const slp = calcSleep(l.sleepHours, l.sleepScore, coach.sleep8);
  return calcReadiness(rec, slp, coach.subjective);
}

function planLine(events) {
  const sessions = (events ?? [])
    .filter(e => e.category === 'training')
    .sort((a, b) => (a.timeStart ?? '').localeCompare(b.timeStart ?? ''))
    .map(e => e.timeStart ? `${e.title} ${e.timeStart}` : e.title);
  return sessions.length ? 'Today: ' + sessions.join(' · ') : 'Rest day';
}

export function morningMessage({ coach, lastWeightDate, lastBodyCompDate, todayEvents, today }) {
  if (!coach) return { title: 'Good morning', body: "Open Coach for today's readiness.", url: '/' };

  const warnings = freshnessWarnings({ today, lastWeightDate, lastBodyCompDate }).map(w => '⚠ ' + warningText(w));
  const withWarnings = first => [first, ...warnings].join('\n');

  if (!hasCheckinValues(coach.subjective)) {
    return { title: 'Morning check-in', body: withWarnings("You haven't checked in yet."), url: '/checkin.html' };
  }
  const r = readinessOf(coach);
  return {
    title: r == null ? 'Readiness –' : `Readiness ${r} ${DOT[verdictColor(r)]}`,
    body:  withWarnings(planLine(todayEvents)),
    url:   '/',
  };
}
