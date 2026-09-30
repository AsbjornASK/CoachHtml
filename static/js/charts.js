// Shared chart code for Dashboard and data.html: constants, date helpers, the shared timeline and the charts.
// Loaded as a classic <script> after /js/wellness-labels.js in the browser, and required by the Node tests.
(function (root) {
  const { WELLNESS, WELLNESS_COLORS } = typeof module !== 'undefined' ? require('./wellness-labels.js') : root;

// ── Constants ──────────────────────────────────────────────────────────────
const DAYS_S = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// 1-based label arrays (index = wellness value) from the shared wellness labels
const MOOD_LABELS  = ['', ...WELLNESS.mood.labels];
const FAT_LABELS   = ['', ...WELLNESS.fatigue.labels];

const CHECKIN_COLORS = Object.fromEntries(WELLNESS_COLORS.map((c, i) => [i + 1, c]));

// Measurement charts show separate dots (no lines between days: nothing is measured in between)
const DOT_R = 6;
const AXIS_FS = 12;

// Daily charts (HRV, Sleep, Partner) share one timeline: the same calendar days, width and margins, so
// their dates line up. Each page picks how many days; HRV · Calendar · Stress has its own column layout.
// Default timeline geometry (Dashboard); wide pages pass their own { W, PDL, PDR }
const TL = { W: 500, PDL: 46, PDR: 12 };

function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return `${DAYS_S[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function fmtN(v, dec = 0) {
  if (v == null) return '–';
  return dec === 0 ? String(Math.round(v)) : v.toFixed(dec).replace('.', ',');
}

const DAY_MS = 86_400_000;

// ISO date (YYYY-MM-DD) n days before the ISO date `iso`
function isoDaysBefore(iso, n) {
  return new Date(Date.parse(iso) - n * DAY_MS).toISOString().slice(0, 10);
}

// d/m label for an ISO date, e.g. 30/9
function fmtDM(iso) {
  const d = new Date(iso + 'T12:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// The last n calendar days up to today; days without data are { date } placeholders
function lastDays(series, today, n) {
  const byDate = new Map(series.map(d => [d.date, d]));
  return Array.from({ length: n }, (_, i) => {
    const date = isoDaysBefore(today, n - 1 - i);
    return byDate.get(date) ?? { date };
  });
}

// x of day i (0..n-1) on the shared timeline
function timelineX(i, n, layout = TL) {
  return layout.PDL + i * (layout.W - layout.PDL - layout.PDR) / Math.max(n - 1, 1);
}

// A date label under every day of the shared timeline; beyond 20 days every second day (always today),
// so d/m labels like 10/10 never touch
function timelineLabels(days, y, layout = TL) {
  const step = days.length > 20 ? 2 : 1;
  return days.map((d, i) => (days.length - 1 - i) % step ? '' :
    `<text class="x-tick" x="${timelineX(i, days.length, layout).toFixed(1)}" y="${y}" font-size="${AXIS_FS}" fill="#aeaeb2" text-anchor="middle">${fmtDM(d.date)}</text>`).join('');
}

const emptyMsg = msg => `<p style="color:#aeaeb2;font-size:13px">${msg}</p>`;
const legendItem = (color, label) => `<div class="legend-item"><div class="legend-dot" style="background:${color}"></div>${label}</div>`;

// Legend for dots coloured by a wellness field (values 1–4): the same labels and colours as the dots
function wellnessLegend(title, field) {
  const items = WELLNESS[field].labels.map((l, i) => legendItem(WELLNESS_COLORS[i], l)).join('');
  return `<div class="legend"><div class="legend-item"><span class="legend-title">${title}</span></div>${items}</div>`;
}

// ── HRV + check-in chart ──────────────────────────────────────────────────
function hrvCheckinChart(days, layout = TL) {
  const hrvDays = days.filter(d => d.hrv != null);
  if (hrvDays.length < 3) return emptyMsg('Not enough HRV data');

  const { W, PDL, PDR } = layout, H = 180, axH = 20, PDY = 8;
  const plotW = W - PDL - PDR;
  const vals = hrvDays.map(d => d.hrv);
  const rawMn = Math.min(...vals), rawMx = Math.max(...vals);
  const mn = Math.floor(rawMn / 5) * 5, mx = Math.ceil(rawMx / 5) * 5, rng = mx - mn || 1;
  const px = i => timelineX(i, days.length, layout);
  const py = v => PDY + (1 - (v - mn) / rng) * (H - 2 * PDY);

  const tickCount = 5;
  const yTicks = Array.from({length: tickCount}, (_, k) => {
    const v = mn + k * (mx - mn) / (tickCount - 1);
    const y = py(v).toFixed(1);
    return `<line x1="${PDL}" y1="${y}" x2="${PDL + plotW}" y2="${y}" stroke="#f2f2f7" stroke-width="1"/>
            <text x="${PDL - 6}" y="${y}" font-size="${AXIS_FS}" fill="#aeaeb2" text-anchor="end" dominant-baseline="middle">${Math.round(v)} ms</text>`;
  }).join('');

  const axisLabel = `<text x="8" y="${H / 2}" font-size="${AXIS_FS}" fill="#8e8e93" text-anchor="middle" transform="rotate(-90 8 ${H / 2})">HRV (ms)</text>`;

  const dots = days.map((d, i) => {
    if (d.hrv == null) return '';
    const col = CHECKIN_COLORS[d.fatigue] ?? '#007aff';
    return `<circle cx="${px(i).toFixed(1)}" cy="${py(d.hrv).toFixed(1)}" r="${DOT_R}" fill="${col}" stroke="#fff" stroke-width="1.5"><title>${fmtDate(d.date)}: HRV=${d.hrv} ms, Fatigue=${FAT_LABELS[d.fatigue] ?? '–'}</title></circle>`;
  }).join('');

  const xLabels = timelineLabels(days, H + axH - 3, layout);

  return `
    ${wellnessLegend('Fatigue', 'fatigue')}
    <div class="chart-wrap">
      <svg viewBox="0 0 ${W} ${H + axH}" width="100%" style="overflow:visible">
        ${yTicks}${axisLabel}${dots}${xLabels}
      </svg>
    </div>`;
}

// ── Sleep chart coloured by mood ──────────────────────────────────────────
function sleepMoodChart(days, layout = TL) {
  const sleepDays = days.filter(d => d.sleep != null);
  if (sleepDays.length < 3) return emptyMsg('Not enough sleep data');

  const { W, PDL, PDR } = layout, H = 180, axH = 20, PDY = 8;
  const plotW = W - PDL - PDR;
  const vals = sleepDays.map(d => d.sleep);
  const mn = Math.max(0, Math.floor(Math.min(...vals) - 0.5)), mx = Math.ceil(Math.max(...vals) + 0.5), rng = mx - mn || 1;
  const px = i => timelineX(i, days.length, layout);
  const py = v => PDY + (1 - (v - mn) / rng) * (H - 2 * PDY);

  // Y-axis ticks: whole hours in range
  const hourTicks = [];
  for (let h = Math.ceil(mn); h <= Math.floor(mx); h++) {
    const y = py(h).toFixed(1);
    const isRef = h === 7 || h === 8;
    const col = h === 8 ? '#30d158' : h === 7 ? '#ff9f0a' : '#aeaeb2';
    hourTicks.push(
      `<line x1="${PDL}" y1="${y}" x2="${PDL + plotW}" y2="${y}" stroke="${isRef ? col + '33' : '#f2f2f7'}" stroke-width="${isRef ? 1.5 : 1}"/>`,
      `<text x="${PDL - 6}" y="${y}" font-size="${AXIS_FS}" fill="${col}" text-anchor="end" dominant-baseline="middle">${h}h</text>`
    );
  }

  const axisLabel = `<text x="8" y="${H / 2}" font-size="${AXIS_FS}" fill="#8e8e93" text-anchor="middle" transform="rotate(-90 8 ${H / 2})">Sleep (h)</text>`;

  const dots = days.map((d, i) => {
    if (d.sleep == null) return '';
    const col = CHECKIN_COLORS[d.mood] ?? '#007aff';
    return `<circle cx="${px(i).toFixed(1)}" cy="${py(d.sleep).toFixed(1)}" r="${DOT_R}" fill="${col}" stroke="#fff" stroke-width="1.5"><title>${fmtDate(d.date)}: Sleep=${d.sleep}h, Mood=${MOOD_LABELS[d.mood] ?? '–'}</title></circle>`;
  }).join('');

  const xLabels = timelineLabels(days, H + axH - 3, layout);

  return `
    ${wellnessLegend('Mood', 'mood')}
    <div class="chart-wrap">
      <svg viewBox="0 0 ${W} ${H + axH}" width="100%" style="overflow:visible">
        ${hourTicks.join('')}${axisLabel}${dots}${xLabels}
      </svg>
    </div>`;
}

// ── Kalender kategorier ───────────────────────────────────────────────────
const CAT_META = {
  training:     { label: 'Training',       color: '#bf5af2' },
  work:         { label: 'Work',       color: '#ff9f0a' },
  social:       { label: 'Social',        color: '#30d158' },
  relationship: { label: 'Dating',         color: '#ff2d55' },
  interests:    { label: 'Interests',    color: '#007aff' },
};
const CAT_KEYS = Object.keys(CAT_META);

// ── HRV level and norm (top chart) ───────────────────────────────────────
const HRV_NORM_DAYS = 42;

// 1 (top quartile, green) … 4 (bottom quartile, purple) against [q25, median, q75] of the last 180 days
function hrvLevel(v, bands) {
  if (v == null || !bands) return null;
  return v >= bands[2] ? 1 : v >= bands[1] ? 2 : v >= bands[0] ? 3 : 4;
}

// ▲ green / ▼ orange when v is more than ½ SD from the mean of the HRV_NORM_DAYS before `date`; grey otherwise
// (also grey with fewer than 7 earlier values to compare against)
function hrvNormMark(series, date, key, v) {
  const none = { arrow: '', color: '#8e8e93' }; // grey
  const from = isoDaysBefore(date, HRV_NORM_DAYS);
  const prev = series.filter(d => d.date >= from && d.date < date && d[key] != null).map(d => d[key]);
  if (prev.length < 7) return none;
  const mean = prev.reduce((a, b) => a + b, 0) / prev.length;
  const sd = Math.sqrt(prev.reduce((a, b) => a + (b - mean) ** 2, 0) / prev.length);
  if (!sd) return none;
  const z = (v - mean) / sd;
  return z > 0.5 ? { arrow: '▲', color: WELLNESS_COLORS[0] } : z < -0.5 ? { arrow: '▼', color: WELLNESS_COLORS[1] } : none;
}

// Moon (night) or sun (day) icon of radius r centred on (cx, cy)
function hrvIcon(kind, cx, cy, r, color, title) {
  const t = `<title>${title}</title>`;
  if (kind === 'moon')
    return `<path class="hrv-moon" fill="${color}" d="M${cx.toFixed(1)} ${(cy - r).toFixed(1)}A${r} ${r} 0 1 0 ${cx.toFixed(1)} ${(cy + r).toFixed(1)}A${(r * 0.72).toFixed(1)} ${r} 0 1 1 ${cx.toFixed(1)} ${(cy - r).toFixed(1)}Z">${t}</path>`;
  const rays = Array.from({ length: 8 }, (_, k) => {
    const a = k * Math.PI / 4, c = Math.cos(a), sn = Math.sin(a);
    return `<line x1="${(cx + c * r * 0.78).toFixed(1)}" y1="${(cy + sn * r * 0.78).toFixed(1)}" x2="${(cx + c * r * 1.1).toFixed(1)}" y2="${(cy + sn * r * 1.1).toFixed(1)}"/>`;
  }).join('');
  return `<g class="hrv-sun" fill="${color}" stroke="${color}" stroke-width="${(r * 0.18).toFixed(1)}" stroke-linecap="round"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r * 0.55).toFixed(1)}" stroke="none"/>${rays}${t}</g>`;
}

// ── HRV · Calendar · Stress (swimlanes) ──────────────────────────────
const STRESS_COLORS = CHECKIN_COLORS;
const STRESS_LABELS = ['', ...WELLNESS.stress.labels];
const STRESS_SHORT  = ['', ...WELLNESS.stress.short];

// days = the columns shown; series = full history for the HRV norm; bands = 180-day HRV quartiles
function hrvCalStressChart(days, series, bands) {
  if (!days.some(d => d.hrv != null || d.sdnn != null || d.stress != null || d.cal)) return emptyMsg('No HRV, calendar or stress data yet');

  // Narrow screens get a smaller viewBox so text and dots stay readable
  const narrow = (root.innerWidth ?? 1024) < 600;
  const [W, PDL, hrvH, calH, stressH, axH, iconR, fs] = narrow
    ? [350, 62, 52, 90, 30, 18, 9, 10]
    : [900, 86, 58, 110, 36, 22, 12, 12];
  const PDR = 8, gap = 6;
  const plotW = W - PDL - PDR;
  const colW = plotW / days.length;
  const px = i => PDL + colW * (i + 0.5);

  const nightTop = 0, dayTop = nightTop + hrvH + gap, calTop = dayTop + hrvH + gap, stressTop = calTop + calH + gap, axTop = stressTop + stressH;
  const totalH = axTop + axH;

  // Alternating day bands tie the three rows together
  const dayBands = days.map((d, i) => i % 2 ? '' :
    `<rect x="${(PDL + colW * i).toFixed(1)}" y="0" width="${colW.toFixed(1)}" height="${axTop}" fill="#f9f9fb"/>`).join('');

  const sep = y => `<line x1="${PDL}" y1="${y}" x2="${W - PDR}" y2="${y}" stroke="#e5e5ea" stroke-width="1"/>`;
  const rowLabel = (txt, y0, h) =>
    `<text x="${PDL - 10}" y="${(y0 + h/2).toFixed(1)}" font-size="${fs}" font-weight="600" fill="#8e8e93" text-anchor="end" dominant-baseline="middle">${txt}</text>`;

  // Night HRV (moon) and Day HRV (sun): icon colour = level vs your 180-day quartiles,
  // number = vs your 42-day norm (▲ above, ▼ below)
  const hrvRow = (top, key, rowBands, kind, name) => days.map((d, i) => {
    const cy = top + hrvH / 2 - fs * 0.6, v = d[key];
    if (v == null) return `<text x="${px(i).toFixed(1)}" y="${cy.toFixed(1)}" font-size="${fs}" fill="#c7c7cc" text-anchor="middle" dominant-baseline="middle">–</text>`;
    const level = hrvLevel(v, rowBands);
    const color = level ? WELLNESS_COLORS[level - 1] : '#aeaeb2';
    const mark = hrvNormMark(series, d.date, key, v);
    return hrvIcon(kind, px(i), cy, iconR, color, `${fmtDate(d.date)}: ${name} = ${fmtN(v)} ms`) +
      `<text x="${px(i).toFixed(1)}" y="${(cy + iconR + fs + 1).toFixed(1)}" font-size="${fs}" font-weight="700" fill="${mark.color}" text-anchor="middle">${mark.arrow}${fmtN(v)}</text>`;
  }).join('');
  const night = hrvRow(nightTop, 'hrv', bands?.night, 'moon', 'Night HRV');
  const dayHrv = hrvRow(dayTop, 'sdnn', bands?.day, 'sun', 'Day HRV');

  // Calendar — one block per event, stacked bottom-up, coloured by category
  const events = d => d.cal ? CAT_KEYS.flatMap(k => {
    const titles = d.cal[k + 'Titles'] ?? [];
    const n = Math.max(d.cal[k] ?? 0, titles.length);
    return Array.from({ length: n }, (_, j) => [k, titles[j] ?? '']);
  }) : [];
  const dayEvents = days.map(events);
  const maxEv = Math.max(1, ...dayEvents.map(e => e.length));
  const blockH = (calH - 8) / maxEv;
  const bw = Math.min(colW * 0.62, 44);
  const cal = dayEvents.map((evs, i) => {
    let y = calTop + calH - 4;
    return evs.map(([k, title]) => {
      y -= blockH;
      const g = Math.min(2, blockH * 0.15);
      return `<rect x="${(px(i) - bw/2).toFixed(1)}" y="${(y + g/2).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, blockH - g).toFixed(1)}" rx="2.5" fill="${CAT_META[k].color}" opacity="0.85"><title>${fmtDate(days[i].date)}: ${CAT_META[k].label}${title ? ' — ' + title : ''}</title></rect>`;
    }).join('');
  }).join('');

  // Stress pills
  const pillH = Math.min(22, stressH - 10), pw = Math.min(colW * 0.86, 70);
  const stress = days.map((d, i) => {
    const x = px(i) - pw/2, y = stressTop + (stressH - pillH) / 2;
    if (d.stress == null)
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${pw.toFixed(1)}" height="${pillH}" rx="${pillH/2}" fill="none" stroke="#d1d1d6" stroke-dasharray="3 3"><title>${fmtDate(d.date)}: No stress data</title></rect>`;
    const lbl = colW > 60 ? STRESS_LABELS[d.stress] : colW > 34 ? STRESS_SHORT[d.stress] : '';
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${pw.toFixed(1)}" height="${pillH}" rx="${pillH/2}" fill="${STRESS_COLORS[d.stress]}" opacity="0.85"><title>${fmtDate(d.date)}: Stress = ${STRESS_LABELS[d.stress]}</title></rect>` +
      (lbl ? `<text x="${px(i).toFixed(1)}" y="${(y + pillH/2).toFixed(1)}" font-size="${fs - 1}" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central" pointer-events="none">${lbl}</text>` : '');
  }).join('');

  const xLabels = days.map((d, i) => {
    const weekday = DAYS_S[new Date(d.date + 'T12:00:00').getDay()];
    return `<text x="${px(i).toFixed(1)}" y="${totalH - 5}" font-size="${fs}" fill="#aeaeb2" text-anchor="middle">${colW > 40 ? weekday + ' ' : ''}${fmtDM(d.date)}</text>`;
  }).join('');

  return `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${W} ${totalH}" width="100%">
        ${dayBands}${sep(dayTop - gap/2)}${sep(calTop - gap/2)}${sep(stressTop - gap/2)}
        ${rowLabel('Night HRV', nightTop, hrvH)}${rowLabel('Day HRV', dayTop, hrvH)}${rowLabel('Calendar', calTop, calH)}${rowLabel('Stress', stressTop, stressH)}
        ${night}${dayHrv}${cal}${stress}${xLabels}
      </svg>
    </div>`;
}

// ── Partner vs. alone: one dot per night, tiles show each group's average ──
const PARTNER_COL = '#007aff', ALONE_COL = '#8e8e93'; // blue, not red: red reads as "something is wrong"
const PARTNER_METRICS = [
  { key: 'hrv',   label: 'Night HRV', unit: 'ms',  dec: 0, higherIsBetter: true  },
  { key: 'rhr',   label: 'Resting HR', unit: 'bpm', dec: 0, higherIsBetter: false },
  { key: 'sleep', label: 'Sleep',     unit: 'h',   dec: 1, higherIsBetter: true  },
];

function partnerCompare(series, days, layout = TL) {
  const nights = series.filter(d => d.partner === 1 || d.partner === 2);
  const withP = nights.filter(d => d.partner === 1), alone = nights.filter(d => d.partner === 2);
  if (!withP.length || !alone.length)
    return emptyMsg(`Not enough data yet: needs at least one night with and one without a partner (${withP.length} with, ${alone.length} without). Fill in “Partner” in the morning check-in.`);

  const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
  // Charts use the shared timeline (`days`); the tiles average all logged nights in each group
  const { W, PDL } = layout, H = 110, PDY = 10, axH = 20, fs = AXIS_FS;


  const tiles = PARTNER_METRICS.map(m => {
    const a = avg(withP.map(d => d[m.key]).filter(v => v != null));
    const b = avg(alone.map(d => d[m.key]).filter(v => v != null));
    const diff = a != null && b != null ? a - b : null;
    const better = diff == null || Math.abs(diff) < (m.dec ? 0.05 : 0.5) ? null : (diff > 0) === m.higherIsBetter;
    const diffCol = better == null ? '#8e8e93' : better ? '#30d158' : '#ff3b30';
    return `<div class="pc-tile">
      <div class="pc-label">${m.label}</div>
      <div class="pc-vals"><span style="color:${PARTNER_COL}">${fmtN(a, m.dec)}</span><span class="pc-vs">vs</span><span style="color:${ALONE_COL}">${fmtN(b, m.dec)}</span><span class="pc-unit">${m.unit}</span></div>
      <div class="pc-diff" style="color:${diffCol}">${diff == null ? '–' : (diff > 0 ? '+' : '') + fmtN(diff, m.dec) + ' ' + m.unit} with partner</div>
    </div>`;
  }).join('');

  const charts = PARTNER_METRICS.map(m => {
    // One dot per night in view: the day's column, coloured by with partner (1) / alone (2)
    const shown = days.map((d, i) => ({ d, i })).filter(({ d }) => (d.partner === 1 || d.partner === 2) && d[m.key] != null);
    const all = shown.map(({ d }) => d[m.key]);
    if (!all.length) return '';
    const lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.1 || 1;
    const mn = lo - pad, rng = hi - lo + 2 * pad;
    const py = v => PDY + (1 - (v - mn) / rng) * (H - 2 * PDY);
    const dots = shown.map(({ d, i }) => {
      const [col, who] = d.partner === 1 ? [PARTNER_COL, 'partner'] : [ALONE_COL, 'alone'];
      return `<circle cx="${timelineX(i, days.length, layout).toFixed(1)}" cy="${py(d[m.key]).toFixed(1)}" r="${DOT_R}" fill="${col}" opacity="0.85" stroke="#fff" stroke-width="1.5"><title>${fmtDate(d.date)} (${who}): ${fmtN(d[m.key], m.dec)} ${m.unit}</title></circle>`;
    }).join('');
    const ticks = [lo, hi].map(v =>
      `<text x="${PDL - 6}" y="${py(v).toFixed(1)}" font-size="${fs}" fill="#aeaeb2" text-anchor="end" dominant-baseline="middle">${fmtN(v, m.dec)}</text>`).join('');
    const xl = timelineLabels(days, H + axH - 4, layout);
    return `<div class="pc-chart-label">${m.label}</div>
      <div class="chart-wrap"><svg viewBox="0 0 ${W} ${H + axH}" width="100%">
        ${ticks}${dots}${xl}
      </svg></div>`;
  }).join('');

  return `
    <div class="card-subtitle" style="margin-bottom:12px">Each dot is one night in the last ${days.length} days: <span style="color:${PARTNER_COL};font-weight:600">with partner</span> (${withP.length} nights) vs. <span style="color:${ALONE_COL};font-weight:600">alone</span> (${alone.length} nights). The numbers above average all logged nights in each group.</div>
    <div class="pc-tiles">${tiles}</div>
    ${charts || emptyMsg(`No partner or alone nights logged in the last ${days.length} days.`)}`;
}

// ── Trends over time (weight, VO₂ max) ────────────────────────────────────
const VO2_COLOR = '#007aff'; // neutral blue: VO₂ max is shown, not judged
const WEIGHT_RANGE = [73, 77], VO2_RANGE = [55, 65]; // fixed y axes (kg, ml/kg/min)

// Dot chart of one series field over the last `days` days on fixed axes: weekly date ticks counted back
// from today and three value ticks, so nearby measurements never collide. Only the latest point is
// labelled; every point has a tooltip.
function trendGraph(series, today, { field, days, range, W = 320, color = '#007aff', empty = 'Too few values' }) {
  const end = Date.parse(today), start = end - days * DAY_MS, from = isoDaysBefore(today, days);
  const pts = series.filter(d => d[field] != null && d.date >= from);
  if (pts.length < 2) return `<div style="color:#aeaeb2;font-size:13px">${empty} in the last ${days} days</div>`;

  const H = 120, PDL = 40, PDR = 16, PDT = 20, PDB = 26;
  const vs = pts.map(p => p[field]);
  // A fixed `range` [lo, hi] keeps the axis stable; a value outside it widens the axis to the next whole number
  const [lo, hi] = range
    ? [Math.min(range[0], Math.floor(Math.min(...vs))), Math.max(range[1], Math.ceil(Math.max(...vs)))]
    : [Math.min(...vs), Math.max(...vs)];
  const pad = range ? 0 : Math.max((hi - lo) * 0.15, 0.3);
  const mn = lo - pad, mx = hi + pad;
  const px = t => PDL + ((t - start) / (end - start)) * (W - PDL - PDR);
  const py = v => PDT + ((mx - v) / (mx - mn)) * (H - PDT - PDB);

  const xTicks = [];
  const tickDays = 7 * Math.ceil(days / 35); // weekly up to 35 days, then every 2 or 3 weeks
  for (let t = end; t >= start; t -= tickDays * DAY_MS) xTicks.unshift(t);
  const xAxis = xTicks.map(t =>
    `<text class="x-tick" x="${px(t).toFixed(1)}" y="${H - 6}" font-size="${AXIS_FS}" fill="#aeaeb2" text-anchor="middle">${fmtDM(new Date(t).toISOString().slice(0, 10))}</text>`).join('');

  const yVals = hi - lo < 0.05 ? [lo - 0.3, lo, lo + 0.3] : [lo, (lo + hi) / 2, hi];
  const yDec = yVals.every(Number.isInteger) ? 0 : 1;
  const yAxis = yVals.map(v => {
    const y = py(v).toFixed(1);
    return `<line x1="${PDL}" y1="${y}" x2="${W - PDR}" y2="${y}" stroke="#f2f2f7" stroke-width="1"/>` +
      `<text class="y-tick" x="${PDL - 6}" y="${y}" font-size="${AXIS_FS}" fill="#aeaeb2" text-anchor="end" dominant-baseline="middle">${fmtN(v, yDec)}</text>`;
  }).join('');

  const dots = pts.map((p, i) => {
    const cx = px(Date.parse(p.date)), cy = py(p[field]), isLast = i === pts.length - 1;
    const label = isLast
      ? `<text class="pt-label" x="${cx.toFixed(1)}" y="${(cy - 9).toFixed(1)}" text-anchor="${cx > W * 0.85 ? 'end' : 'middle'}" font-size="${AXIS_FS}" font-weight="700" fill="${color}">${fmtN(p[field], 1)}</text>`
      : '';
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${DOT_R}" fill="${color}" opacity="${isLast ? 1 : 0.75}" stroke="#fff" stroke-width="1.5"><title>${fmtDate(p.date)}: ${fmtN(p[field], 1)}</title></circle>${label}`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;margin-top:10px;overflow:visible">${yAxis}${xAxis}${dots}</svg>`;
}

// Latest VO₂ max (neutral blue) and change since the first value in the window
function vo2Summary(series, today, days = 30) {
  const from = isoDaysBefore(today, days);
  const pts = series.filter(d => d.vo2max != null && d.date >= from);
  if (!pts.length) return '';
  const last = pts[pts.length - 1].vo2max, diff = Math.round((last - pts[0].vo2max) * 10) / 10;
  const change = pts.length > 1 ? ` · ${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${fmtN(Math.abs(diff), 1)} in ${days} days` : '';
  return `<div style="font-size:22px;font-weight:700;color:${VO2_COLOR}">${fmtN(last, 1)} <span style="font-size:12px;font-weight:500;color:#8e8e93">ml/kg/min${change}</span></div>`;
}

// ── Sessions: training load, RPE and heart-rate zones ─────────────────────
// Fixed, neutral sport colours: they tell sports apart and never judge
const SPORT_COLORS = { run: '#007aff', ride: '#5ac8fa', strength: '#5856d6', other: '#aeaeb2' };
const SPORT_LABELS = { run: 'Run', ride: 'Ride', strength: 'Strength', other: 'Other' };

const legend = items => `<div class="legend">${items.map(([color, label]) => legendItem(color, label)).join('')}</div>`;
// Session filter for the Sessions charts: 'all' or one sport
const bySport = sport => s => sport === 'all' || s.sport === sport;
const sportLegend = sessions => Object.keys(SPORT_COLORS).filter(k => sessions.some(s => s.sport === k))
  .map(k => [SPORT_COLORS[k], SPORT_LABELS[k]]);

// Load bars per day (stacked by session, coloured by sport) on the shared timeline, with a dot for the
// NEXT morning's Day HRV (SDNN) coloured against its 42-day norm. Right axis (SDNN) sits beyond the timeline.
// sport = 'all' or one sport; the HRV dots belong to the day and stay whatever the filter
function loadHrvChart(days, sessions, series, layout = TL, sport = 'all') {
  const byDate = new Map(days.map(d => [d.date, []]));
  for (const s of sessions) if (longEnough(s) && bySport(sport)(s)) byDate.get(s.date)?.push(s);
  if (![...byDate.values()].some(l => l.length)) return emptyMsg(`No ${sport === 'all' ? 'training' : sport} sessions in the last ${days.length} days`);

  const { W, PDL, PDR } = layout, H = 200, axH = 20, PDY = 10, RAX = 48;
  const n = days.length, px = i => timelineX(i, n, layout);
  const bw = Math.min(18, (W - PDL - PDR) / Math.max(n - 1, 1) * 0.6);
  const loads = days.map(d => byDate.get(d.date).reduce((a, s) => a + (s.load ?? 0), 0));
  const lMax = Math.max(25, Math.ceil(Math.max(...loads) / 25) * 25);
  const ly = v => PDY + (1 - v / lMax) * (H - 2 * PDY);

  // Next morning's Day HRV for each day; today has no next morning yet
  const sdnnOf = new Map(series.filter(d => d.sdnn != null).map(d => [d.date, d.sdnn]));
  const next = days.map(d => {
    const date = isoDaysBefore(d.date, -1), v = sdnnOf.get(date);
    return v == null ? null : { date, v };
  });
  const sv = next.filter(Boolean).map(p => p.v);
  const sMn = Math.floor(Math.min(...sv) / 5) * 5, sMx = Math.ceil(Math.max(...sv) / 5) * 5, sRng = sMx - sMn || 5;
  const sy = v => PDY + (1 - (v - sMn) / sRng) * (H - 2 * PDY);

  const grid = [0, lMax / 2, lMax].map(v => {
    const y = ly(v).toFixed(1);
    return `<line x1="${PDL}" y1="${y}" x2="${W - PDR}" y2="${y}" stroke="#f2f2f7" stroke-width="1"/>` +
      `<text x="${PDL - 6}" y="${y}" font-size="${AXIS_FS}" fill="#aeaeb2" text-anchor="end" dominant-baseline="middle">${fmtN(v)}</text>`;
  }).join('');
  const sTicks = sv.length ? [sMn, sMn + sRng / 2, sMn + sRng].map(v =>
    `<text x="${W - PDR + 8}" y="${sy(v).toFixed(1)}" font-size="${AXIS_FS}" fill="#aeaeb2" dominant-baseline="middle">${fmtN(v)} ms</text>`).join('') : '';
  const axisLabel = `<text x="8" y="${H / 2}" font-size="${AXIS_FS}" fill="#8e8e93" text-anchor="middle" transform="rotate(-90 8 ${H / 2})">Load</text>`;

  const bars = days.map((d, i) => {
    const list = byDate.get(d.date);
    const tip = `${fmtDate(d.date)}: ` + list.map(s =>
      `${SPORT_LABELS[s.sport]} ${fmtN(s.load)} load${s.minutes != null ? ', ' + fmtN(s.minutes) + ' min' : ''}`).join(' · ');
    let base = 0;
    return list.map(s => {
      if (!s.load) return '';
      const y0 = ly(base + s.load), h = ly(base) - y0;
      base += s.load;
      return `<rect class="load-bar" x="${(px(i) - bw / 2).toFixed(1)}" y="${y0.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${SPORT_COLORS[s.sport]}"><title>${tip}</title></rect>`;
    }).join('');
  }).join('');

  const dots = next.map((p, i) => {
    if (!p) return '';
    const m = hrvNormMark(series, p.date, 'sdnn', p.v);
    return `<circle class="hrv-next" cx="${px(i).toFixed(1)}" cy="${sy(p.v).toFixed(1)}" r="${DOT_R}" fill="${m.color}" stroke="#fff" stroke-width="1.5"><title>${fmtDate(p.date)} (next day): Day HRV ${m.arrow}${fmtN(p.v)} ms</title></circle>`;
  }).join('');

  return `
    ${legend([...sportLegend(sessions.filter(s => byDate.has(s.date))),
      [WELLNESS_COLORS[0], '▲ Next-day HRV above your norm'], ['#8e8e93', 'Within norm'], [WELLNESS_COLORS[1], '▼ Below norm']])}
    <div class="chart-wrap">
      <svg viewBox="0 0 ${W + RAX} ${H + axH}" width="100%" style="overflow:visible">
        ${grid}${sTicks}${axisLabel}${bars}${dots}${timelineLabels(days, H + axH - 3, layout)}
      </svg>
    </div>`;
}

// Average heart rate (x) against RPE (y) per session, with a least-squares trend line from 5 sessions.
// sport = 'all' or one sport; "other" sessions are never shown (mixed activities say little about effort).
const RIDE_MIN_MINUTES = 40; // shorter rides are mostly commutes

// Rides count as training only when longer than RIDE_MIN_MINUTES (RPE and zone charts)
function longEnough(s) {
  return s.sport !== 'ride' || s.minutes > RIDE_MIN_MINUTES;
}

// A session belongs in the scatter: RPE and heart rate, not "other", and long enough
function rpeEligible(s) {
  return s.rpe != null && s.avgHr != null && s.sport !== 'other' && longEnough(s);
}

function rpeHrScatter(sessions, layout = TL, sport = 'all') {
  const pts = sessions.filter(s => rpeEligible(s) && bySport(sport)(s));
  if (pts.length < 5) return emptyMsg(`Not enough ${sport === 'all' ? '' : sport + ' '}sessions with RPE and heart rate yet`);

  const { W, PDL, PDR } = layout, H = 220, axH = 38, PDY = 10;
  const hrs = pts.map(s => s.avgHr);
  const xMn = Math.floor(Math.min(...hrs) / 10) * 10, xMx = Math.max(xMn + 10, Math.ceil(Math.max(...hrs) / 10) * 10);
  const px = v => PDL + (v - xMn) / (xMx - xMn) * (W - PDL - PDR);
  const py = v => PDY + (10 - v) / 9 * (H - 2 * PDY);

  const yTicks = [1, 4, 7, 10].map(v => {
    const y = py(v).toFixed(1);
    return `<line x1="${PDL}" y1="${y}" x2="${W - PDR}" y2="${y}" stroke="#f2f2f7" stroke-width="1"/>` +
      `<text x="${PDL - 6}" y="${y}" font-size="${AXIS_FS}" fill="#aeaeb2" text-anchor="end" dominant-baseline="middle">${v}</text>`;
  }).join('');
  const xTicks = [];
  for (let v = xMn; v <= xMx; v += 10)
    xTicks.push(`<text x="${px(v).toFixed(1)}" y="${H + 16}" font-size="${AXIS_FS}" fill="#aeaeb2" text-anchor="middle">${v}</text>`);
  const labels = `<text x="8" y="${H / 2}" font-size="${AXIS_FS}" fill="#8e8e93" text-anchor="middle" transform="rotate(-90 8 ${H / 2})">RPE</text>` +
    `<text x="${(PDL + W - PDR) / 2}" y="${H + axH - 4}" font-size="${AXIS_FS}" fill="#8e8e93" text-anchor="middle">Average heart rate (bpm)</text>`;

  const mx = hrs.reduce((a, b) => a + b, 0) / pts.length, my = pts.reduce((a, s) => a + s.rpe, 0) / pts.length;
  const sxx = pts.reduce((a, s) => a + (s.avgHr - mx) ** 2, 0);
  let trend = '';
  if (sxx) {
    const b = pts.reduce((a, s) => a + (s.avgHr - mx) * (s.rpe - my), 0) / sxx;
    const [x1, x2] = [Math.min(...hrs), Math.max(...hrs)];
    trend = `<line class="trend" x1="${px(x1).toFixed(1)}" y1="${py(my + b * (x1 - mx)).toFixed(1)}" x2="${px(x2).toFixed(1)}" y2="${py(my + b * (x2 - mx)).toFixed(1)}" stroke="#aeaeb2" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  }

  const dots = pts.map(s =>
    `<circle class="rpe-dot" cx="${px(s.avgHr).toFixed(1)}" cy="${py(s.rpe).toFixed(1)}" r="${DOT_R}" fill="${SPORT_COLORS[s.sport]}" opacity="0.85" stroke="#fff" stroke-width="1.5"><title>${fmtDate(s.date)}: ${SPORT_LABELS[s.sport]}, ${fmtN(s.avgHr)} bpm, RPE ${s.rpe}</title></circle>`).join('');

  return `
    ${legend(sportLegend(pts))}
    <div class="card-subtitle" style="margin-bottom:8px">Each dot is one session. Dots above the line felt harder than the heart rate suggests.</div>
    <div class="chart-wrap">
      <svg viewBox="0 0 ${W} ${H + axH}" width="100%" style="overflow:visible">
        ${yTicks}${xTicks.join('')}${labels}${trend}${dots}
      </svg>
    </div>`;
}

// Minutes per heart-rate zone per Monday–Sunday week, easy share above each bar
const ZONES = [['easy', 'Easy (Z1–Z2)', '#5ac8fa'], ['moderate', 'Moderate (Z3)', WELLNESS_COLORS[1]], ['hard', 'Hard (Z4+)', WELLNESS_COLORS[2]]];

// sport = 'all' or one sport
function zoneWeeksChart(sessions, today, weeks = 12, layout = TL, sport = 'all') {
  sessions = sessions.filter(s => longEnough(s) && bySport(sport)(s));
  const monday = isoDaysBefore(today, (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7);
  const wk = Array.from({ length: weeks }, (_, k) => {
    const start = isoDaysBefore(monday, 7 * (weeks - 1 - k)), end = isoDaysBefore(start, -6);
    const t = { start, easy: 0, moderate: 0, hard: 0 };
    for (const s of sessions)
      if (s.zones && s.date >= start && s.date <= end) for (const [z] of ZONES) t[z] += s.zones[z] ?? 0;
    t.total = t.easy + t.moderate + t.hard;
    return t;
  });
  if (!wk.some(w => w.total)) return emptyMsg(`No ${sport === 'all' ? '' : sport + ' '}heart-rate zone data in the last ${weeks} weeks`);

  const { W, PDL, PDR } = layout, H = 200, axH = 20, PDT = 22;
  const colW = (W - PDL - PDR) / weeks, bw = Math.min(40, colW * 0.6);
  const yMax = Math.ceil(Math.max(...wk.map(w => w.total)) / 60) * 60;
  const py = v => PDT + (1 - v / yMax) * (H - PDT);

  const grid = [0, yMax / 2, yMax].map(v => {
    const y = py(v).toFixed(1);
    return `<line x1="${PDL}" y1="${y}" x2="${W - PDR}" y2="${y}" stroke="#f2f2f7" stroke-width="1"/>` +
      `<text x="${PDL - 6}" y="${y}" font-size="${AXIS_FS}" fill="#aeaeb2" text-anchor="end" dominant-baseline="middle">${fmtN(v / 60, v % 60 ? 1 : 0)} h</text>`;
  }).join('');

  const groups = wk.map((w, i) => {
    const cx = PDL + colW * (i + 0.5);
    let base = 0;
    const rects = ZONES.map(([z, , color]) => {
      if (!w[z]) return '';
      const y0 = py(base + w[z]), h = py(base) - y0;
      base += w[z];
      return `<rect x="${(cx - bw / 2).toFixed(1)}" y="${y0.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}"/>`;
    }).join('');
    const pct = w.total ? Math.round(w.easy / w.total * 100) + ' %' : '–';
    const tip = `Week of ${fmtDate(w.start)}: ` + (w.total ? ZONES.map(([z, label]) => `${label} ${fmtN(w[z])} min`).join(', ') : 'no zone data');
    return `<g class="week"><title>${tip}</title>${rects}` +
      `<text x="${cx.toFixed(1)}" y="${(py(w.total) - 6).toFixed(1)}" font-size="${AXIS_FS}" font-weight="600" fill="${w.total ? '#3a3a3c' : '#c7c7cc'}" text-anchor="middle">${pct}</text>` +
      `<text x="${cx.toFixed(1)}" y="${H + axH - 3}" font-size="${AXIS_FS}" fill="#aeaeb2" text-anchor="middle">${fmtDM(w.start)}</text></g>`;
  }).join('');

  return `
    ${legend(ZONES.map(([, label, color]) => [color, label]))}
    <div class="card-subtitle" style="margin-bottom:8px">Share of easy minutes above each week (Monday–Sunday). Goal: about 80 % easy.</div>
    <div class="chart-wrap">
      <svg viewBox="0 0 ${W} ${H + axH}" width="100%" style="overflow:visible">
        ${grid}${groups}
      </svg>
    </div>`;
}

  const api = { DAYS_S, MONTHS, MOOD_LABELS, FAT_LABELS, CHECKIN_COLORS, DOT_R, AXIS_FS, TL, fmtDate, fmtN, DAY_MS, isoDaysBefore, fmtDM, lastDays, timelineX, timelineLabels, wellnessLegend, hrvCheckinChart, sleepMoodChart, CAT_META, CAT_KEYS, HRV_NORM_DAYS, hrvLevel, hrvNormMark, hrvIcon, STRESS_COLORS, STRESS_LABELS, STRESS_SHORT, hrvCalStressChart, PARTNER_COL, PARTNER_METRICS, partnerCompare, VO2_COLOR, WEIGHT_RANGE, VO2_RANGE, trendGraph, vo2Summary, emptyMsg, SPORT_COLORS, SPORT_LABELS, rpeEligible, longEnough, loadHrvChart, rpeHrScatter, zoneWeeksChart };
  Object.assign(root, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
