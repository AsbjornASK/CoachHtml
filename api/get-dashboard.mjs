import { intervalsClient, notConfigured, parseDays, rhrOf, tsbOf, sleepHours } from './_lib/intervals.mjs';
import { json, fmt, daysAgo, r1 } from './_lib/util.mjs';
import { activeCalendars, fetchCalendarEvents } from './_lib/calendar.mjs';

export async function GET() {
  const intervals = intervalsClient();
  if (!intervals) return notConfigured();

  const today = new Date();
  const end   = fmt(today);
  const start = daysAgo(90, today); // 90 days so partner comparison has enough nights

  const [wellnessRes, events] = await Promise.all([
    intervals.get(`/wellness?oldest=${start}&newest=${end}`),
    fetchCalendarEvents(activeCalendars()),
  ]);

  if (!wellnessRes.ok) {
    return json({ error: 'Intervals wellness API error', status: wellnessRes.status }, 502);
  }

  // Timed calendar events per date: count, minutes and titles per category
  const calByDate = {};
  for (const ev of events) {
    if (ev.allDay || ev.date < start || ev.date > end) continue;
    const day = calByDate[ev.date] ??= {};
    const cat = ev.category;
    day[cat]          = (day[cat]          ?? 0) + 1;
    day[cat + 'Min']  = (day[cat + 'Min']  ?? 0) + ev.durationMin;
    (day[cat + 'Titles'] ??= []).push(ev.title);
  }

  const days = parseDays(await wellnessRes.json());

  const series = days.map(d => ({
    date:       d.date,
    ctl:        r1(d.ctl),
    atl:        r1(d.atl),
    tsb:        tsbOf(d),
    hrv:        r1(d.hrv),
    rhr:        rhrOf(d),
    sleep:      sleepHours(d),
    sleepScore: d.sleepScore ?? null,
    mood:       d.mood       ?? null,
    soreness:   d.soreness   ?? null,
    fatigue:    d.fatigue    ?? null,
    motivation: d.motivation ?? null,
    stress:     d.stress     ?? null,
    partner:    d.Partner    ?? null, // custom field: 1 = Ja, 2 = Nej
    comments:   d.comments   ?? null,
    sdnn:       r1(d.sdnn ?? d.hrvSDNN ?? null),
    weight:     r1(d.weight),
    bodyFat:    r1(d.bodyFat ?? d.fatMass ?? null),
    steps:      d.steps ?? null,
    cal:        calByDate[d.date] ?? null,
  }));

  return json({ today: end, series });
}
