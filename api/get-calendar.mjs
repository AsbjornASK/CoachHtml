// Today's and upcoming events from all category calendars.

import { calendarEvents } from './_lib/calendar.mjs';
import { json } from './_lib/util.mjs';

export async function GET() {
  const cal = await calendarEvents();
  if (!cal) return json({ error: 'No calendar URLs configured' }, 500);
  return json(cal);
}
