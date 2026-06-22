// Vercel Edge Function: get-calendar
// Henter ICS fra alle 5 Google Calendars og returnerer dagens + kommende events

export const config = { runtime: 'edge' };

const CAL_SOURCES = [
  { cat: 'training',     env: 'CAL_TRAINING_ICS_URL',     fallback: 'FYSISK_HELBRED_ICS_URL' },
  { cat: 'work',         env: 'CAL_WORK_ICS_URL' },
  { cat: 'social',       env: 'CAL_SOCIAL_ICS_URL' },
  { cat: 'relationship', env: 'CAL_RELATIONSHIP_ICS_URL' },
  { cat: 'interests',    env: 'CAL_INTERESTS_ICS_URL' },
];

export default async () => {
  const activeSources = CAL_SOURCES.map(s => ({
    cat: s.cat,
    url: process.env[s.env] || (s.fallback ? process.env[s.fallback] : null),
  })).filter(s => s.url);

  if (!activeSources.length) {
    return json({ error: 'Ingen kalender-URLs konfigureret' }, 500);
  }

  const texts = await Promise.all(
    activeSources.map(s => fetch(s.url).then(r => r.ok ? r.text() : '').catch(() => ''))
  );

  const today    = new Date();
  const todayStr = fmtDate(today);
  const limitStr = fmtDate(new Date(today.getTime() + 14 * 86_400_000));

  const allEvents = [];
  for (let i = 0; i < activeSources.length; i++) {
    for (const ev of parseICS(texts[i] ?? '')) {
      allEvents.push({ ...ev, category: activeSources[i].cat });
    }
  }

  allEvents.sort((a, b) => a.date.localeCompare(b.date) || (a.timeStart ?? '').localeCompare(b.timeStart ?? ''));

  const todayEvents    = allEvents.filter(e => e.date === todayStr);
  const upcomingEvents = allEvents.filter(e => e.date > todayStr && e.date <= limitStr).slice(0, 5);

  return json({ today: todayEvents, upcoming: upcomingEvents });
};

function parseICS(ics) {
  const events = [];
  const blocks = ics.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block    = blocks[i];
    const summary  = extract(block, 'SUMMARY');
    const dtstart  = extractDT(block, 'DTSTART');
    const dtend    = extractDT(block, 'DTEND');
    if (!summary || !dtstart) continue;
    events.push({
      title:     summary,
      date:      dtstart.date,
      timeStart: dtstart.time,
      timeEnd:   dtend?.time ?? null,
    });
  }
  return events;
}

function extract(block, key) {
  const m = block.match(new RegExp(`^${key}[;:](.+)$`, 'm'));
  return m ? m[1].trim().replace(/\\n/g, ' ').replace(/\\,/g, ',') : null;
}

function extractDT(block, key) {
  const m = block.match(new RegExp(`^${key}[^:]*:([\\dTZ]+)`, 'm'));
  if (!m) return null;
  const raw = m[1];
  if (/^\d{8}$/.test(raw)) {
    return { date: `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`, time: null };
  }
  const year = raw.slice(0,4), mo = raw.slice(4,6), day = raw.slice(6,8);
  const hr = raw.slice(9,11), min = raw.slice(11,13);
  const dt = new Date(`${year}-${mo}-${day}T${hr}:${min}:00${raw.endsWith('Z') ? 'Z' : ''}`);
  return {
    date: fmtDate(dt, 'Europe/Copenhagen'),
    time: fmtTime(dt, 'Europe/Copenhagen'),
  };
}

function fmtDate(d, tz) {
  if (tz) return new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
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
