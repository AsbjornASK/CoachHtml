// Today's and upcoming events from all category calendars.

import { activeCalendars, fetchCalendarEvents } from './_lib/calendar.mjs';
import { json, fmt, daysAgo } from './_lib/util.mjs';

export async function GET() {
  const sources = activeCalendars();
  if (!sources.length) {
    return json({ error: 'No calendar URLs configured' }, 500);
  }

  const today    = new Date();
  const todayStr = fmt(today);
  const limitStr = daysAgo(-14, today);

  const events = (await fetchCalendarEvents(sources))
    .filter(e => e.date >= todayStr && e.date <= limitStr)
    .map(({ title, date, timeStart, timeEnd, category }) => ({ title, date, timeStart, timeEnd, category }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.timeStart ?? '').localeCompare(b.timeStart ?? ''));

  return json({
    today:    events.filter(e => e.date === todayStr),
    upcoming: events.filter(e => e.date > todayStr).slice(0, 5),
  });
}
