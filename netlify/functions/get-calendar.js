// Netlify Function: get-calendar
// Henter og parser ICS fra Google Calendar "Fysisk helbred"

export default async () => {
  const icsUrl = process.env.FYSISK_HELBRED_ICS_URL;

  if (!icsUrl) {
    return json({ error: 'Kalender-URL ikke konfigureret (FYSISK_HELBRED_ICS_URL)' }, 500);
  }

  const res = await fetch(icsUrl);
  if (!res.ok) {
    return json({ error: 'Kunne ikke hente kalender', status: res.status }, 502);
  }

  const ics  = await res.text();
  const events = parseICS(ics);

  const today     = new Date();
  const todayStr  = fmtDate(today);
  const limitStr  = fmtDate(new Date(today.getTime() + 14 * 86_400_000));

  const todayEvents    = events.filter(e => e.date === todayStr);
  const upcomingEvents = events
    .filter(e => e.date > todayStr && e.date <= limitStr)
    .slice(0, 3);

  return json({ today: todayEvents, upcoming: upcomingEvents });
};

// ── ICS parser ────────────────────────────────────────────
function parseICS(ics) {
  const events = [];
  const blocks = ics.split('BEGIN:VEVENT');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const summary  = extract(block, 'SUMMARY');
    const dtstart  = extractDT(block, 'DTSTART');
    const dtend    = extractDT(block, 'DTEND');
    if (!summary || !dtstart) continue;

    events.push({
      title:    summary,
      date:     dtstart.date,
      timeStart: dtstart.time,
      timeEnd:   dtend?.time ?? null,
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || (a.timeStart ?? '').localeCompare(b.timeStart ?? ''));
}

function extract(block, key) {
  const m = block.match(new RegExp(`^${key}[;:](.+)$`, 'm'));
  return m ? m[1].trim().replace(/\\n/g, ' ').replace(/\\,/g, ',') : null;
}

function extractDT(block, key) {
  // Match: DTSTART:20260602T160000Z  or  DTSTART;TZID=...:20260602T160000  or  DTSTART;VALUE=DATE:20260602
  const m = block.match(new RegExp(`^${key}[^:]*:([\\dTZ]+)`, 'm'));
  if (!m) return null;

  const raw = m[1];

  if (/^\d{8}$/.test(raw)) {
    // All-day: 20260602
    return { date: `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`, time: null };
  }

  // Timed: 20260602T160000Z or 20260602T160000
  const year  = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day   = raw.slice(6, 8);
  const hour  = raw.slice(9, 11);
  const min   = raw.slice(11, 13);

  // Konverter UTC til Europe/Copenhagen
  let date = `${year}-${month}-${day}`;
  let time = `${hour}:${min}`;

  if (raw.endsWith('Z')) {
    const dt = new Date(`${date}T${time}:00Z`);
    date = fmtDate(dt, 'Europe/Copenhagen');
    time = fmtTime(dt, 'Europe/Copenhagen');
  }

  return { date, time };
}

function fmtDate(d, tz) {
  if (tz) {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }
  return d.toISOString().slice(0, 10);
}

function fmtTime(d, tz) {
  return new Intl.DateTimeFormat('da-DK', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const config = { path: '/api/get-calendar' };
