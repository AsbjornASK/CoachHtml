export const config = { runtime: 'edge' };

const CAL_SOURCES = [
  { cat: 'training',     env: 'CAL_TRAINING_ICS_URL',     fallback: 'FYSISK_HELBRED_ICS_URL' },
  { cat: 'work',         env: 'CAL_WORK_ICS_URL' },
  { cat: 'social',       env: 'CAL_SOCIAL_ICS_URL' },
  { cat: 'relationship', env: 'CAL_RELATIONSHIP_ICS_URL' },
  { cat: 'interests',    env: 'CAL_INTERESTS_ICS_URL' },
];

export default async () => {
  const apiKey    = process.env.INTERVALS_API_KEY;
  const athleteId = process.env.INTERVALS_ATHLETE_ID;

  if (!apiKey || !athleteId) {
    return json({ error: 'Intervals API ikke konfigureret' }, 500);
  }

  const today = new Date();
  const end   = fmt(today);
  const start = fmt(new Date(today - 30 * 86_400_000));

  const auth    = 'Basic ' + btoa('API_KEY:' + apiKey);
  const baseUrl = `https://intervals.icu/api/v1/athlete/${athleteId}`;

  const activeSources = CAL_SOURCES.map(s => ({
    cat: s.cat,
    url: process.env[s.env] || (s.fallback ? process.env[s.fallback] : null),
  })).filter(s => s.url);

  const [wellnessRes, ...calTexts] = await Promise.all([
    fetch(`${baseUrl}/wellness?oldest=${start}&newest=${end}`, { headers: { Authorization: auth } }),
    ...activeSources.map(s => fetch(s.url).then(r => r.ok ? r.text() : '').catch(() => '')),
  ]);

  if (!wellnessRes.ok) {
    return json({ error: 'Intervals wellness API fejl', status: wellnessRes.status }, 502);
  }

  const rawWellness = await wellnessRes.json();

  // Build calendar event map keyed by date
  const calByDate = {};
  for (let i = 0; i < activeSources.length; i++) {
    const cat = activeSources[i].cat;
    for (const ev of parseICS(calTexts[i] ?? '')) {
      if (ev.date < start || ev.date > end) continue;
      if (!calByDate[ev.date]) calByDate[ev.date] = {};
      calByDate[ev.date][cat]          = (calByDate[ev.date][cat]          ?? 0) + 1;
      calByDate[ev.date][cat + 'Min']  = (calByDate[ev.date][cat + 'Min']  ?? 0) + ev.durationMin;
    }
  }

  const days = (Array.isArray(rawWellness)
    ? rawWellness
    : Object.entries(rawWellness).map(([k, v]) => ({ id: k, ...v }))
  )
    .map(d => ({ ...d, date: d.id ?? d.date }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const series = days.map(d => ({
    date:       d.date,
    ctl:        r1(d.ctl),
    atl:        r1(d.atl),
    tsb:        d.ctl != null && d.atl != null ? r1(d.ctl - d.atl) : null,
    hrv:        r1(d.hrv),
    rhr:        (d.restingHR && d.restingHR < 65) ? d.restingHR : null,
    sleep:      d.sleepSecs ? r1(d.sleepSecs / 3600) : null,
    sleepScore: d.sleepScore ?? null,
    mood:       d.mood       ?? null,
    soreness:   d.soreness   ?? null,
    fatigue:    d.fatigue    ?? null,
    motivation: d.motivation ?? null,
    stress:     d.stress     ?? null,
    comments:   d.comments   ?? null,
    sdnn:       r1(d.sdnn ?? d.hrvSDNN ?? null),
    weight:     r1(d.weight),
    bodyFat:    r1(d.bodyFat ?? d.fatMass ?? null),
    steps:      d.steps ?? null,
    cal:        calByDate[d.date] ?? null,
  }));

  return json({ today: end, series });
};

// ── ICS parser ────────────────────────────────────────────────────────────
function parseICS(ics) {
  const events = [];
  const blocks = ics.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block   = blocks[i];
    const summary = extractStr(block, 'SUMMARY');
    const dtstart = extractDT(block, 'DTSTART');
    const dtend   = extractDT(block, 'DTEND');
    if (!summary || !dtstart) continue;
    let durationMin = 60;
    if (dtend?.ms != null && dtstart?.ms != null) {
      durationMin = Math.max(0, Math.round((dtend.ms - dtstart.ms) / 60000));
    }
    events.push({ title: summary, date: dtstart.date, durationMin });
  }
  return events;
}

function extractStr(block, key) {
  const m = block.match(new RegExp(`^${key}[;:](.+)$`, 'm'));
  return m ? m[1].trim().replace(/\\n/g, ' ').replace(/\\,/g, ',') : null;
}

function extractDT(block, key) {
  const m = block.match(new RegExp(`^${key}[^:]*:([\\dTZ]+)`, 'm'));
  if (!m) return null;
  const raw = m[1];
  if (/^\d{8}$/.test(raw)) {
    return { date: `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`, ms: null };
  }
  const year = raw.slice(0,4), mo = raw.slice(4,6), day = raw.slice(6,8);
  const hr = raw.slice(9,11), min = raw.slice(11,13);
  const isUTC = raw.endsWith('Z');
  const dt = new Date(`${year}-${mo}-${day}T${hr}:${min}:00${isUTC ? 'Z' : ''}`);
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
  return { date, ms: dt.getTime() };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function fmt(d) { return d.toISOString().slice(0, 10); }
function r1(v)  { return v != null ? Math.round(v * 10) / 10 : null; }
