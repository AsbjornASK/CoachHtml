// Google Calendar ICS feeds, one per life category.

import { fmt, daysAgo } from './util.mjs';

const TZ = 'Europe/Copenhagen';

const CAL_SOURCES = [
  { cat: 'training',     env: 'CAL_TRAINING_ICS_URL',     fallback: 'FYSISK_HELBRED_ICS_URL' },
  { cat: 'work',         env: 'CAL_WORK_ICS_URL' },
  { cat: 'social',       env: 'CAL_SOCIAL_ICS_URL' },
  { cat: 'relationship', env: 'CAL_RELATIONSHIP_ICS_URL' },
  { cat: 'interests',    env: 'CAL_INTERESTS_ICS_URL' },
];

export function activeCalendars() {
  return CAL_SOURCES.map(s => ({
    cat: s.cat,
    url: process.env[s.env] || (s.fallback ? process.env[s.fallback] : null),
  })).filter(s => s.url);
}

// Fetches all feeds and returns their events tagged with `category`. Failed feeds yield no events.
export async function fetchCalendarEvents(sources) {
  const texts = await Promise.all(
    sources.map(s => fetch(s.url).then(r => r.ok ? r.text() : '').catch(() => ''))
  );
  return sources.flatMap((s, i) => parseICS(texts[i]).map(ev => ({ ...ev, category: s.cat })));
}

// Today's and the next 14 days' events from all calendars, sorted; null when none are configured.
export async function calendarEvents(today = new Date()) {
  const sources = activeCalendars();
  if (!sources.length) return null;

  const todayStr = fmt(today);
  const limitStr = daysAgo(-14, today);

  const events = (await fetchCalendarEvents(sources))
    .filter(e => e.date >= todayStr && e.date <= limitStr)
    .map(({ title, date, timeStart, timeEnd, category }) => ({ title, date, timeStart, timeEnd, category }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.timeStart ?? '').localeCompare(b.timeStart ?? ''));

  return {
    today:    events.filter(e => e.date === todayStr),
    upcoming: events.filter(e => e.date > todayStr).slice(0, 5),
  };
}

// All-day events have allDay: true, timeStart/timeEnd null and the default 60 min duration.
export function parseICS(ics) {
  const events = [];
  const blocks = ics.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block   = blocks[i];
    const summary = extractStr(block, SUMMARY_RE);
    const dtstart = extractDT(block, DTSTART_RE);
    const dtend   = extractDT(block, DTEND_RE);
    if (!summary || !dtstart) continue;
    const allDay = dtstart.ms === null;
    events.push({
      title:       summary,
      date:        dtstart.date,
      timeStart:   dtstart.time,
      timeEnd:     dtend?.time ?? null,
      allDay,
      durationMin: !allDay && dtend?.ms != null ? Math.max(0, Math.round((dtend.ms - dtstart.ms) / 60000)) : 60,
    });
  }
  return events;
}

const SUMMARY_RE = /^SUMMARY[;:](.+)$/m;
// Group 1 = parameters (may hold TZID=…), group 2 = the date-time value
const DTSTART_RE = /^DTSTART([^:]*):([\dTZ]+)/m;
const DTEND_RE   = /^DTEND([^:]*):([\dTZ]+)/m;

const DATE_FMT = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const TIME_FMT = new Intl.DateTimeFormat('da-DK', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

function extractStr(block, re) {
  const m = block.match(re);
  return m ? m[1].trim().replace(/\\n/g, ' ').replace(/\\,/g, ',') : null;
}

function extractDT(block, re) {
  const m = block.match(re);
  if (!m) return null;
  const raw = m[2];
  if (/^\d{8}$/.test(raw)) {
    return { date: `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`, time: null, ms: null };
  }
  const parts = [raw.slice(0,4), raw.slice(4,6) - 1, raw.slice(6,8), raw.slice(9,11), raw.slice(11,13)].map(Number);
  const wall = Date.UTC(...parts);
  // UTC ("Z"), otherwise wall-clock time in the TZID zone (floating times: our own zone)
  const tz = m[1].match(/TZID=([^;]+)/)?.[1] ?? TZ;
  const dt = new Date(raw.endsWith('Z') ? wall : wall - tzOffsetMs(tz, wall - tzOffsetMs(tz, wall)));
  return { date: DATE_FMT.format(dt), time: TIME_FMT.format(dt), ms: dt.getTime() };
}

// Offset of `tz` from UTC at instant `ms`, in ms (e.g. +2 h for Copenhagen in summer)
function tzOffsetMs(tz, ms) {
  let p;
  try {
    p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric',
      day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(ms).map(x => [x.type, +x.value]));
  } catch {
    return tz === TZ ? 0 : tzOffsetMs(TZ, ms); // unknown TZID: fall back to our own zone
  }
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ms / 60000) * 60000;
}
