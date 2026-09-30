# Coach Page Structure + Check-in Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the morning flow into a new Check-in page and a Coach page organized into Body / Training / Today, and replace Match training with a per-session done/planned/missed status.

**Architecture:** A static HTML app (one self-contained HTML file per page in `static/`) with Vercel Edge Functions in `api/`. The one piece of real logic, matching sessions to activities, goes in a small shared script, `static/js/session-status.js`. It works both as a browser global and as a CommonJS module, so it can be tested with Node's built-in test runner. Everything else moves or reorganizes existing inline markup and scripts.

**Tech Stack:** Vanilla HTML/CSS/JS (no build step), Vercel Edge Functions, Intervals.icu API, Node 26 `node:test` for the one unit-tested module.

**Spec:** `docs/superpowers/specs/2026-09-30-coach-page-structure-design.md`

## Global Constraints

- No build step, no npm dependencies. Pages stay single HTML files with inline `<style>`/`<script>`. The only exception is `static/js/session-status.js`.
- Files use CRLF line endings (git autocrlf). When editing by script, keep the existing line endings.
- UI copy: card titles and statuses are in English (`Today's check-in`, `✓ Done`, `Planned`, `Missed`). Existing Danish microcopy (`Gemt`, `Gemmer…`, `Tilføj en note til i dag…`, button labels) stays as it is.
- "Today" is the existing `new Date().toISOString().slice(0,10)` and the localStorage key is `checkin_<YYYY-MM-DD>`. Both must match exactly between Check-in and Coach.
- Time comparisons for "Missed" use Europe/Copenhagen. Calendar times arrive as `"16.00"` (da-DK format).
- Nav order on every page with a bottom bar: **Check-in · Coach · Vitals · Dashboard**. `data.html` is not touched.
- Commits follow `CLAUDE.md`: run `/simplify` and then `/code-review` before committing. That is why this plan has one commit task at the end instead of a commit per task.

## Review Focus

1. **Saved check-in, but Intervals hasn't caught up yet.** After saving, Coach loads `/api/get-coach` before Intervals returns the new wellness values. The user must not be bounced back to Check-in. The localStorage check prevents this (covered in Task 4, Step 6).
2. **localStorage unavailable** (private mode, blocked storage). `hasCheckinToday` must treat a throwing `localStorage` as "checked in", so there is no redirect loop (covered in Task 4, Steps 1–2).
3. **Activities API failed** (`activities: null`). Sessions must show no status rather than a false `Missed` (covered in Task 1 tests).
4. **Two sessions of the same sport, one activity.** Only the first session gets `Done`, and the second is `Planned`/`Missed` (covered in Task 1 tests).
5. **All-day or untimed training event** (`timeEnd: null`). It must never become `Missed` (covered in Task 1 tests).

---

### Task 1: Session-status module (TDD)

**Files:**
- Create: `static/js/session-status.js`
- Test: `tests/session-status.test.cjs`

**Interfaces:**
- Produces:
  - `sessionStatuses(events: CalEvent[], activities: {type:string,name?:string}[] | null, nowHHMM: string) => (CalEvent & {status: 'done'|'planned'|'missed'|null})[]`. It returns only `category === 'training'` events, sorted by `timeStart`.
  - `hhmm(t: string|null) => string|null`, which turns `"16.00"`/`"16:00"` into `"1600"`.
  - Both are set on `window` in the browser and exported via `module.exports` in Node.
- `CalEvent` = `{title, date, timeStart, timeEnd, category}` as returned by `/api/get-calendar`.

- [ ] **Step 1: Write the failing tests**

Create `tests/session-status.test.cjs`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sessionStatuses, hhmm } = require('../static/js/session-status.js');

const ev = (title, timeStart, timeEnd, category = 'training') => ({ title, date: '2026-09-30', timeStart, timeEnd, category });

test('hhmm normalizes da-DK and colon times', () => {
  assert.equal(hhmm('16.00'), '1600');
  assert.equal(hhmm('7:05'), '0705');
  assert.equal(hhmm(null), null);
});

test('only training events are returned, sorted by start time', () => {
  const out = sessionStatuses([ev('Strength 2', '16.00', '17.30'), ev('Work', '09.00', '18.00', 'work'), ev('Easy Run', '07.00', '08.00')], [], '0600');
  assert.deepEqual(out.map(e => e.title), ['Easy Run', 'Strength 2']);
});

test('matching activity gives done', () => {
  const out = sessionStatuses([ev('Cykeltur', '16.00', '18.00')], [{ type: 'Ride' }], '1200');
  assert.equal(out[0].status, 'done');
});

test('run matches any Run variant, strength matches WeightTraining', () => {
  const out = sessionStatuses([ev('Trail run', '07.00', '08.00'), ev('Strength 2', '16.00', '17.00')], [{ type: 'TrailRun' }, { type: 'WeightTraining' }], '2000');
  assert.deepEqual(out.map(e => e.status), ['done', 'done']);
});

test('no activity: planned before end time, missed after', () => {
  assert.equal(sessionStatuses([ev('Strength 2', '16.00', '17.30')], [], '1729')[0].status, 'planned');
  assert.equal(sessionStatuses([ev('Strength 2', '16.00', '17.30')], [], '1730')[0].status, 'missed');
});

test('each activity matches only one session', () => {
  const out = sessionStatuses([ev('Run AM', '07.00', '08.00'), ev('Run PM', '17.00', '18.00')], [{ type: 'Run' }], '2000');
  assert.deepEqual(out.map(e => e.status), ['done', 'missed']);
});

test('untimed event is never missed', () => {
  assert.equal(sessionStatuses([ev('Strength', null, null)], [], '2359')[0].status, 'planned');
});

test('unknown sport title gets no status', () => {
  assert.equal(sessionStatuses([ev('Yoga', '07.00', '08.00')], [{ type: 'Yoga' }], '2000')[0].status, null);
});

test('activities null (API failed) gives no status at all', () => {
  const out = sessionStatuses([ev('Strength 2', '16.00', '17.30')], null, '2000');
  assert.equal(out[0].status, null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL with `Cannot find module '../static/js/session-status.js'`

- [ ] **Step 3: Write the implementation**

Create `static/js/session-status.js`:

```js
// Matches today's calendar training sessions to Intervals.icu activities.
// Loaded as a classic <script> in the browser and required by the Node tests.
(function (root) {
  const SPORT_RULES = [
    { title: /run/i,        type: t => /Run/.test(t) },
    { title: /strength/i,   type: t => t === 'WeightTraining' },
    { title: /cykel|ride/i, type: t => /Ride/.test(t) },
  ];

  function hhmm(t) {
    return t ? t.replace(/\D/g, '').padStart(4, '0') : null;
  }

  function sessionStatuses(events, activities, nowHHMM) {
    const used = new Set();
    return (events ?? [])
      .filter(e => e.category === 'training')
      .sort((a, b) => (a.timeStart ?? '').localeCompare(b.timeStart ?? ''))
      .map(e => {
        const rule = SPORT_RULES.find(r => r.title.test(e.title));
        if (!rule || activities == null) return { ...e, status: null };
        const idx = activities.findIndex((a, i) => !used.has(i) && rule.type(a.type ?? ''));
        if (idx >= 0) { used.add(idx); return { ...e, status: 'done' }; }
        const end = hhmm(e.timeEnd);
        return { ...e, status: end && end <= nowHHMM ? 'missed' : 'planned' };
      });
  }

  root.sessionStatuses = sessionStatuses;
  root.hhmm = hhmm;
  if (typeof module !== 'undefined') module.exports = { sessionStatuses, hhmm };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/`
Expected: 9 tests, all PASS.

---

### Task 2: `/api/get-coach` returns activities, and the pairing endpoint is removed

**Files:**
- Modify: `api/get-coach.js` (fetch block ~lines 17–29, pairing block ~lines 36–42, response ~lines 83–84)
- Delete: `api/pair-event.js`

**Interfaces:**
- Produces: the `/api/get-coach` JSON gains `activities: {type:string, name:string}[] | null` (`null` when the Intervals activities call fails) and loses `events` and `pairSuggestions`.

- [ ] **Step 1: Drop the events fetch**

In `api/get-coach.js`, replace:

```js
  const [wellnessRes, eventsRes, activitiesRes] = await Promise.all([
    fetch(`${base}/wellness?oldest=${start}&newest=${end}`, { headers: { Authorization: auth } }),
    fetch(`${base}/events?oldest=${end}&newest=${end}`,     { headers: { Authorization: auth } }),
    fetch(`${base}/activities?oldest=${end}&newest=${end}`, { headers: { Authorization: auth } }),
  ]);
```

with:

```js
  const [wellnessRes, activitiesRes] = await Promise.all([
    fetch(`${base}/wellness?oldest=${start}&newest=${end}`, { headers: { Authorization: auth } }),
    fetch(`${base}/activities?oldest=${end}&newest=${end}`, { headers: { Authorization: auth } }),
  ]);
```

- [ ] **Step 2: Replace raw events and pairing with an activities list**

Replace:

```js
  const rawEvents     = eventsRes.ok     ? await eventsRes.json()     : [];
  const rawActivities = activitiesRes.ok ? await activitiesRes.json() : [];
```

with:

```js
  const activities = activitiesRes.ok
    ? (await activitiesRes.json()).map(a => ({ type: a.type ?? null, name: a.name ?? null }))
    : null;
```

Then delete the whole block that starts with `const unpairedEvents` and ends with `.filter(Boolean);` (the `pairSuggestions` computation).

- [ ] **Step 3: Update the response**

Replace:

```js
    events: rawEvents,
    pairSuggestions,
```

with:

```js
    activities,
```

- [ ] **Step 4: Delete the pairing endpoint**

Run: `git rm api/pair-event.js`

- [ ] **Step 5: Verify**

Run: `node --check api/get-coach.js && grep -n "rawEvents\|pairSuggestions\|eventsRes" api/get-coach.js`
Expected: no syntax error, and grep prints nothing.

---

### Task 3: Coach page with sections, session status and no Match training

**Files:**
- Modify: `static/index.html`

**Interfaces:**
- Consumes: `window.sessionStatuses` and `window.hhmm` (Task 1), and `data.activities` (Task 2).

- [ ] **Step 1: Load the module**

Directly above the `<script>` tag that opens the main inline script (the one that starts with `const EN_DAYS_S`), add:

```html
<script src="/js/session-status.js"></script>
```

- [ ] **Step 2: CSS: add a section header and session status, remove pair styles**

Delete the six lines that start with `.pair-row`, `.pair-row:last-of-type`, `.pair-event`, `.pair-activity`, `.pair-btn` and `.pair-btn:disabled`. In their place, add:

```css
    .section-header { font-size: 20px; font-weight: 700; margin: 20px 16px 10px; letter-spacing: -0.3px; }
    .session-status { font-size: 12px; font-weight: 700; flex-shrink: 0; }
```

- [ ] **Step 3: Build Today's sessions from `sessionStatuses`**

In `render()`, change the destructuring line to:

```js
  const {latest,trends,sleep8,subjective}=data;
```

Replace the `const workouts=...` and `const wHTML=...` lines with:

```js
  const nowHHMM=hhmm(new Intl.DateTimeFormat('da-DK',{timeZone:'Europe/Copenhagen',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()));
  const STATUS={done:['✓ Done','#30d158'],planned:['Planned','#8e8e93'],missed:['Missed','#ff9f0a']};
  const sessions=sessionStatuses(cal?.today??[],data.activities??null,nowHHMM);
  const wHTML=sessions.length?sessions.map(e=>{
    const s=STATUS[e.status];
    return`<div class="workout-row"><div><div class="workout-title">${e.title}</div><div class="workout-time">${e.timeStart??''}${e.timeEnd?'–'+e.timeEnd:''}</div></div>${s?`<span class="session-status" style="color:${s[1]}">${s[0]}</span>`:''}</div>`;
  }).join(''):`<div class="workout-row"><span class="workout-title" style="color:#aeaeb2">Rest day</span></div>`;
```

Delete the `const pairHTML=...` line.

- [ ] **Step 4: Reorder the template into sections**

Replace the whole `document.getElementById('app').innerHTML=\`...\`;` template with:

```js
  document.getElementById('app').innerHTML=`
    <div class="section-header">Body</div>
    <div class="card">
      <div class="card-title">Scores</div>
      <div class="rings">${ring(ready,rColor,'Readiness')}${ring(rec,recColor,'Recovery')}${ring(slp,slpColor,'Sleep')}</div>
      ${readyHistHTML}
    </div>
    <div class="card">
      <div class="card-title">Night physiology</div>
      <div class="physio-row">
        <div class="physio-item"><div class="metric-label">HRV</div><div class="metric-value ${vc}">${fmtN(latest.hrv)} ms <span class="${hrv_t.c}">${hrv_t.a==='up'?'↑':hrv_t.a==='down'?'↓':'→'}</span></div></div>
        <div class="physio-item"><div class="metric-label">Resting HR</div><div class="metric-value ${vc}">${fmtN(latest.restingHR)} bpm <span class="${rhr_t.c}">${rhr_t.a==='up'?'↑':rhr_t.a==='down'?'↓':'→'}</span></div></div>
        <div class="physio-item"><div class="metric-label">Sleep</div><div class="metric-value ${vc}">${fmtN(latest.sleepHours)} h <span class="${slp_t.c}">${slp_t.a==='up'?'↑':slp_t.a==='down'?'↓':'→'}</span></div></div>
      </div>
    </div>
    <div class="section-header">Training</div>
    <div class="card">
      <div class="card-title">Fitness</div>
      <div class="fit-tabs" id="fit-tabs">${[['overall','Overall'],['run','Run'],['strength','Strength']].map(([k,l])=>`<button data-tab="${k}" class="${_fitTab===k?'selected':''}" ${k!=='overall'&&!hasSport?'disabled':''}>${l}${k!=='overall'&&k===todaySport?' •':''}</button>`).join('')}</div>
      <div id="fitness-body">${fitnessBodyHTML(_fitTab)}</div>
    </div>
    ${tlrHTML(latest.tsb)}
    <div class="section-header">Today</div>
    <div class="card"><div class="card-title">Today's sessions</div>${wHTML}</div>
    ${upcoming.length?`<div class="card"><div class="card-title">Upcoming sessions</div>${uHTML}</div>`:''}
  `;
```

- [ ] **Step 5: Remove the pairing click handler**

Delete the whole IIFE that starts with `(function(){` followed by `document.addEventListener('click',async e=>{` and `const btn=e.target.closest('.pair-btn');`, down to and including its closing `})();`.

- [ ] **Step 6: Verify**

Run:
```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' static/index.html > "$TMP/i.js" && node --check "$TMP/i.js" && grep -n "pair" static/index.html
```
Expected: no syntax error, and grep prints nothing.

---

### Task 4: Check-in page, with the form moved out of Coach and Coach redirecting

**Files:**
- Create: `static/checkin.html`
- Modify: `static/index.html` (remove `#checkin-card` markup + form IIFE + `_checkinSaved`, add redirect)

**Interfaces:**
- Consumes: `/api/get-vitals` → `todayWellness: {date, mood, soreness, fatigue, motivation, comments}` (already implemented), and `/api/update-wellness` POST `{date, ...fields}`.
- Produces:
  - localStorage `checkin_<TODAY>`, a JSON object of the saved fields.
  - `hasCheckinToday(subj)` in `index.html`.

- [ ] **Step 1: Add `hasCheckinToday` to Coach**

In `static/index.html`, directly above `function render(`, add:

```js
// Checked in today if Intervals has subjective values, or this device saved a check-in
// (Intervals can lag right after saving). Storage errors count as checked in to avoid redirect loops.
function hasCheckinToday(subj){
  if(subj&&(subj.mood||subj.soreness||subj.fatigue||subj.motivation))return true;
  try{return localStorage.getItem('checkin_'+new Date().toISOString().slice(0,10))!=null;}
  catch{return true;}
}
```

- [ ] **Step 2: Test `hasCheckinToday` in Node**

Run:
```bash
node -e "
$(sed -n '/^function hasCheckinToday/,/^}/p' static/index.html)
const ok=(n,a,b)=>{if(a!==b){console.error('FAIL',n,a,b);process.exit(1)}};
globalThis.localStorage={getItem:()=>null};
ok('empty',hasCheckinToday({mood:null}),false);
ok('subj',hasCheckinToday({fatigue:2}),true);
globalThis.localStorage={getItem:()=>'{}'};
ok('local',hasCheckinToday(null),true);
globalThis.localStorage={getItem:()=>{throw new Error('blocked')}};
ok('throws',hasCheckinToday(null),true);
console.log('PASS');"
```
Expected: `PASS`

- [ ] **Step 3: Redirect on the initial load only**

In the initial-load IIFE (the first `(async()=>{` after `render`), directly after `const data=await dR.json();`, add:

```js
    if(!hasCheckinToday(data.subjective)){location.replace('/checkin.html');return;}
```

Do **not** add it to the pull-to-refresh loader.

- [ ] **Step 4: Remove the form from Coach**

In `static/index.html`:
- Delete the whole `<div class="card" id="checkin-card" ...>` element (from that line through its closing `</div>` just before `<div id="app"`).
- Delete the whole form IIFE: the `(function(){` whose first line is `const TODAY=new Date().toISOString().slice(0,10);`, through its `})();`.
- In the `let` line, remove `,_checkinSaved=false`.
- At the end of `render()`, delete the two lines `if(_checkinSaved||hasSubj){...}` and `else{...checkin-card...}`, and delete the now-unused `const hasSubj=...` line.
- In the initial-load `catch`, replace `['app','checkin-card'].forEach(id=>document.getElementById(id).style.display='');` with `document.getElementById('app').style.display='';`.
- Delete the CSS rules that are now only used by the form: `.checkin-row`, `.checkin-row:last-of-type`, `.checkin-label`, `.checkin-label small`, `.btn-group` (all 7 `.btn-group…` lines), `.checkin-weight`, `.checkin-weight:focus`, `.submit-btn`, `.submit-btn:disabled`, `.checkin-done-badge`, `.form-status`, `.form-status.ok…`, `.subjective-grid`, `.subj-item` (both lines), `.subj-label` and `.subj-value`.

- [ ] **Step 5: Create `static/checkin.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>Coach Check-in</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif; background: #f2f2f7; color: #1c1c1e; max-width: 430px; margin: 0 auto; padding: 0 0 calc(88px + env(safe-area-inset-bottom)); min-height: 100vh; }
    .topbar { background: #fff; border-bottom: 1px solid #e5e5ea; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; height: 52px; position: sticky; top: 0; z-index: 10; gap: 8px; margin-bottom: 12px; }
    .topbar-title { font-size: 16px; font-weight: 700; letter-spacing: -0.3px; flex-shrink: 0; }
    .topbar-date { font-size: 11px; color: #8e8e93; text-align: right; line-height: 1.3; flex-shrink: 0; }
    .bottombar { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #e5e5ea; height: calc(80px + env(safe-area-inset-bottom)); padding-bottom: env(safe-area-inset-bottom); z-index: 20; }
    .bottombar-inner { max-width: 430px; height: 80px; margin: 0 auto; display: flex; }
    .bottombar a { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 11px; font-weight: 600; color: #8e8e93; text-decoration: none; -webkit-tap-highlight-color: transparent; padding-bottom: 10px; }
    .bottombar a svg { width: 22px; height: 22px; }
    .bottombar a.active { color: #007aff; }
    .card { background: #fff; border-radius: 16px; margin: 0 12px 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .card-title { font-size: 11px; font-weight: 700; color: #8e8e93; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 14px; }
    .checkin-row { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #f2f2f7; gap: 8px; }
    .checkin-row:last-of-type { border-bottom: none; }
    .checkin-label { font-size: 13px; font-weight: 500; color: #1c1c1e; width: 88px; flex-shrink: 0; line-height: 1.2; }
    .checkin-label small { display: block; font-size: 10px; font-weight: 400; color: #aeaeb2; }
    .btn-group { display: flex; flex: 1; gap: 4px; }
    .btn-group button { flex: 1; padding: 6px 2px; font-size: 10px; font-weight: 700; border: 1.5px solid #e5e5ea; border-radius: 8px; background: #fff; color: #8e8e93; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .btn-group button.selected { background: #007aff; color: #fff; border-color: #007aff; }
    .btn-group button.selected.c-green { background: #30d158; border-color: #30d158; }
    .btn-group button.selected.c-yellow { background: #ff9f0a; border-color: #ff9f0a; }
    .btn-group button.selected.c-red { background: #ff3b30; border-color: #ff3b30; }
    .btn-group button.selected.c-purple { background: #bf5af2; border-color: #bf5af2; }
    .checkin-weight { flex: 1; min-width: 0; font-size: 15px; border: 1.5px solid #e5e5ea; border-radius: 8px; padding: 7px 10px; color: #1c1c1e; background: #f9f9fb; outline: none; font-family: inherit; }
    .checkin-weight:focus { border-color: #007aff; background: #fff; }
    .submit-btn { width: 100%; margin-top: 14px; padding: 13px; color: #fff; font-size: 16px; font-weight: 700; border: none; border-radius: 12px; cursor: pointer; -webkit-tap-highlight-color: transparent; background: #007aff; }
    .submit-btn:disabled { background: #aeaeb2 !important; cursor: default; }
    .form-status { text-align: center; font-size: 13px; margin-top: 10px; min-height: 18px; }
    .form-status.ok { color: #30d158; font-weight: 600; } .form-status.err { color: #ff3b30; }
    .subjective-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .subj-item { text-align: center; padding: 8px; border-radius: 10px; }
    .subj-item.s1 { background: #e8f8ee; color: #1a7a33; } .subj-item.s2 { background: #fff8e1; color: #b86e00; } .subj-item.s3 { background: #ffe5e5; color: #c0392b; } .subj-item.s4 { background: #f3e8ff; color: #7a1fa2; }
    .subj-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; opacity: 0.7; }
    .subj-value { font-size: 14px; font-weight: 700; margin-top: 2px; }
    .note-area { width: 100%; margin-top: 12px; padding-top: 12px; border-top: 1px solid #f2f2f7; }
    .note-textarea { width: 100%; font-size: 13px; border: 1.5px solid #e5e5ea; border-radius: 10px; padding: 10px 12px; color: #1c1c1e; background: #f9f9fb; resize: none; outline: none; font-family: inherit; min-height: 72px; }
    .note-textarea:focus { border-color: #007aff; background: #fff; }
    .note-status { font-size: 11px; color: #aeaeb2; margin-top: 4px; min-height: 14px; text-align: right; }
    .note-status.ok { color: #30d158; } .note-status.err { color: #ff3b30; }
    .coach-link { display: block; text-align: center; margin-top: 14px; font-size: 15px; font-weight: 600; color: #007aff; text-decoration: none; }
    .skeleton { animation: pulse 1.4s ease-in-out infinite; background: #e5e5ea; border-radius: 16px; height: 320px; margin: 0 12px 12px; }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-title">Check-in</div>
    <div class="topbar-date" id="topbar-date"></div>
  </div>
  <div id="loading" class="skeleton"></div>

  <div class="card" id="checkin-card" style="display:none">
    <div class="card-title">Morning Check-in</div>
    <div class="checkin-row">
      <div class="checkin-label">Soreness<small>Pre-workout</small></div>
      <div class="btn-group" data-field="soreness">
        <button data-val="1" data-color="c-green">LOW</button><button data-val="2" data-color="c-yellow">AVG</button><button data-val="3" data-color="c-red">HIGH</button><button data-val="4" data-color="c-purple">EXTREME</button>
      </div>
    </div>
    <div class="checkin-row">
      <div class="checkin-label">Fatigue<small>Pre-workout</small></div>
      <div class="btn-group" data-field="fatigue">
        <button data-val="1" data-color="c-green">LOW</button><button data-val="2" data-color="c-yellow">AVG</button><button data-val="3" data-color="c-red">HIGH</button><button data-val="4" data-color="c-purple">EXTREME</button>
      </div>
    </div>
    <div class="checkin-row">
      <div class="checkin-label">Humør</div>
      <div class="btn-group" data-field="mood">
        <button data-val="1" data-color="c-green">GREAT</button><button data-val="2" data-color="c-yellow">GOOD</button><button data-val="3" data-color="c-red">AVG</button><button data-val="4" data-color="c-purple">LOW</button>
      </div>
    </div>
    <div class="checkin-row">
      <div class="checkin-label">Motivation</div>
      <div class="btn-group" data-field="motivation">
        <button data-val="1" data-color="c-green">EXTREME</button><button data-val="2" data-color="c-yellow">HIGH</button><button data-val="3" data-color="c-red">MIDDEL</button><button data-val="4" data-color="c-purple">LOW</button>
      </div>
    </div>
    <div class="checkin-row">
      <div class="checkin-label">Stress<small>I går</small></div>
      <div class="btn-group" data-field="stress">
        <button data-val="1" data-color="c-green">LAV</button><button data-val="2" data-color="c-yellow">MODERAT</button><button data-val="3" data-color="c-red">HØJ</button><button data-val="4" data-color="c-purple">MEGET HØJ</button>
      </div>
    </div>
    <div class="checkin-row">
      <div class="checkin-label">Partner<small>Sov sammen i nat</small></div>
      <!-- Intervals custom wellness field "Partner" (select): 1 = Ja, 2 = Nej -->
      <div class="btn-group" data-field="Partner">
        <button data-val="1">JA</button><button data-val="2">NEJ</button>
      </div>
    </div>
    <div class="checkin-row">
      <div class="checkin-label">Vægt<small>kg</small></div>
      <input type="number" id="checkin-weight" class="checkin-weight" placeholder="Dagens vægt (kg)" step="0.1" min="40" max="200" inputmode="decimal">
    </div>
    <button class="submit-btn" id="checkin-submit">Save to Intervals</button>
    <div class="form-status" id="checkin-status"></div>
  </div>

  <div class="card" id="subj-card" style="display:none"></div>

  <div class="bottombar"><div class="bottombar-inner">
    <a href="/checkin.html" class="active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="8 12 11 15 16 9"/></svg><span>Check-in</span></a>
    <a href="/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg><span>Coach</span></a>
    <a href="/vitals.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 12 7 12 10 19 14 5 17 12 22 12"/></svg><span>Vitals</span></a>
    <a href="/dashboard.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="14"/></svg><span>Dashboard</span></a>
  </div></div>

<script>
const EN_DAYS_S=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const EN_MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TODAY=new Date().toISOString().slice(0,10);
const YESTERDAY=new Date(Date.now()-86400000).toISOString().slice(0,10);
const LS='checkin_'+TODAY;
const SLBLS={mood:['Great','Good','Avg','Low'],soreness:['Low','Avg','High','Extreme'],fatigue:['Low','Avg','High','Extreme'],motivation:['Extreme','High','Middel','Low']};
const SLBL_NAMES={mood:'Humør',soreness:'Soreness',fatigue:'Fatigue',motivation:'Motivation'};

function readSaved(){try{return JSON.parse(localStorage.getItem(LS)||'null');}catch{return null;}}
function hasValues(w){return !!(w&&(w.mood||w.soreness||w.fatigue||w.motivation));}

function showSummary(w){
  const card=document.getElementById('subj-card');
  card.innerHTML=`<div class="card-title">Today's check-in</div>
    <div class="subjective-grid">${['mood','soreness','fatigue','motivation'].map(f=>{const v=w[f]??null;return`<div class="subj-item s${v??2}"><div class="subj-label">${SLBL_NAMES[f]}</div><div class="subj-value">${v?SLBLS[f][v-1]:'-'}</div></div>`;}).join('')}</div>
    <div class="note-area"><textarea class="note-textarea" id="subj-note" placeholder="Tilføj en note til i dag…">${w.comments??''}</textarea><div class="note-status" id="subj-note-status"></div></div>
    <a class="coach-link" href="/">Go to Coach →</a>`;
  card.style.display='';
}

(async()=>{
  const d=new Date();
  document.getElementById('topbar-date').textContent=`${EN_DAYS_S[d.getDay()]} ${d.getDate()} ${EN_MONTHS[d.getMonth()]}`;
  let tw=null;
  try{const r=await fetch('/api/get-vitals');if(r.ok)tw=(await r.json()).todayWellness??null;}catch{}
  document.getElementById('loading').style.display='none';
  const saved=readSaved();
  if(hasValues(tw))showSummary(tw);
  else if(saved)showSummary({...saved,comments:tw?.comments??null});
  else document.getElementById('checkin-card').style.display='';
})();

// Morning check-in form (moved from Coach). On success: remember locally and go to Coach.
(function(){
  function selectBtn(g,b){g.querySelectorAll('button').forEach(x=>{x.classList.remove('selected','c-green','c-yellow','c-red','c-purple');});b.classList.add('selected');if(b.dataset.color)b.classList.add(b.dataset.color);}
  document.querySelectorAll('#checkin-card .btn-group').forEach(g=>{g.querySelectorAll('button').forEach(b=>{b.addEventListener('click',()=>selectBtn(g,b));});});
  const post=body=>fetch('/api/update-wellness',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  document.getElementById('checkin-submit').addEventListener('click',async()=>{
    const btn=document.getElementById('checkin-submit'),st=document.getElementById('checkin-status');
    const p={date:TODAY};
    document.querySelectorAll('#checkin-card .btn-group').forEach(g=>{const s=g.querySelector('button.selected');if(s)p[g.dataset.field]=+s.dataset.val;});
    // Stress refers to yesterday (same as Vitals page), saved separately below
    const stress=p.stress;delete p.stress;
    const wRaw=document.getElementById('checkin-weight').value.trim().replace(',','.');
    if(wRaw){const w=parseFloat(wRaw);if(!w||w<40||w>200){st.textContent='Ugyldig vægt';st.className='form-status err';return;}p.weight=w;}
    btn.disabled=true;st.textContent='Saving…';st.className='form-status';
    try{
      if(stress!=null){const rs=await post({date:YESTERDAY,stress});if(!rs.ok){const e=await rs.json().catch(()=>({}));throw Object.assign(new Error('Error: '+(e.error||rs.status)),{api:true});}}
      const r=await post(p);
      if(r.ok){
        try{localStorage.setItem(LS,JSON.stringify(stress!=null?{...p,stress}:p));}catch{}
        location.href='/';
      }
      else{const e=await r.json().catch(()=>({}));st.textContent='Error: '+(e.error||r.status);st.className='form-status err';btn.disabled=false;}
    }catch(err){st.textContent=err.api?err.message:'Network error';st.className='form-status err';btn.disabled=false;}
  });
})();

// Today's check-in note: autosave 1.5 s after typing stops (moved from Vitals)
(function(){
  let timer=null;
  document.addEventListener('input',e=>{
    if(e.target.id!=='subj-note')return;
    const st=document.getElementById('subj-note-status');
    if(st)st.textContent='';
    clearTimeout(timer);
    timer=setTimeout(async()=>{
      const val=e.target.value;
      if(st)st.textContent='Gemmer…';
      try{
        const r=await fetch('/api/update-wellness',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:TODAY,comments:val})});
        if(r.ok){if(st){st.textContent='Gemt';st.className='note-status ok';setTimeout(()=>{if(st)st.textContent='';},2000);}}
        else{if(st){st.textContent='Fejl ved gemning';st.className='note-status err';}}
      }catch(err){if(st){st.textContent='Netværksfejl';st.className='note-status err';}}
    },1500);
  });
})();
</script>
</body>
</html>
```

- [ ] **Step 6: Verify**

Run:
```bash
for f in index checkin; do awk '/<script>/{f=1;next}/<\/script>/{f=0}f' static/$f.html > "$TMP/$f.js" && node --check "$TMP/$f.js" && echo "$f OK"; done
grep -n "checkin-card\|_checkinSaved\|checkin-submit" static/index.html
```
Expected: `index OK`, `checkin OK`, and the grep prints nothing.

Walk through the flow by reading the code:
- `index` initial load with no check-in → `location.replace('/checkin.html')`.
- Checkin save → sets `checkin_<TODAY>` → `location.href='/'`.
- `index` → `hasCheckinToday` is true via localStorage, so there is no redirect, even if Intervals still returns empty `subjective` (Review Focus 1).

---

### Task 5: Remove Today's check-in from Vitals

**Files:**
- Modify: `static/vitals.html`

- [ ] **Step 1: Remove the card**

In `static/vitals.html`:
- In the `render()` destructuring, remove `todayWellness,`.
- Delete the block from `const tw=todayWellness??{};` through the end of the `const todayCheckinHTML=\`...\`;` statement (the line ending in `}</div>\`;`).
- In the `app.innerHTML` template, delete the line `${todayCheckinHTML}`, so `<div class="section-header">Today</div>` is followed directly by `${weightCardHTML}${ibUrlRowHTML}`.
- Delete the IIFE that starts with the comment `// Today's check-in note: autosave 1.5 s after typing stops`, through its `})();`.
- Delete the five CSS lines that start with `.note-area`, `.note-textarea`, `.note-textarea:focus`, `.note-status` and `.note-status.ok`.

Keep `todayWellness` in `api/get-vitals.js`, because `checkin.html` uses it.

- [ ] **Step 2: Verify**

Run:
```bash
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' static/vitals.html > "$TMP/v.js" && node --check "$TMP/v.js" && grep -n "todayWellness\|todayCheckinHTML\|subj-note\|note-" static/vitals.html
```
Expected: no syntax error, and grep prints nothing.

---

### Task 6: Four-tab navigation on Coach, Vitals and Dashboard

**Files:**
- Modify: `static/index.html`, `static/vitals.html`, `static/dashboard.html` (the `<div class="bottombar-inner">` contents)

- [ ] **Step 1: Add the Check-in tab first in each bottom bar**

In each of the three files, insert this line as the first child of `<div class="bottombar-inner">`. Match the indentation of the existing `<a>` lines in that file: 4 spaces in `index.html` and `vitals.html`, 2 spaces in `dashboard.html`.

```html
<a href="/checkin.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="8 12 11 15 16 9"/></svg><span>Check-in</span></a>
```

The existing `class="active"` markers stay where they are: Coach on `index.html`, Vitals on `vitals.html`, Dashboard on `dashboard.html`.

- [ ] **Step 2: Verify**

Run: `grep -c 'href="/checkin.html"' static/index.html static/vitals.html static/dashboard.html static/checkin.html`
Expected: `1` for each file.

---

### Task 7: Final verification and commit

- [ ] **Step 1: Run all automated checks**

```bash
node --test tests/
for f in index checkin vitals dashboard; do awk '/<script>/{f=1;next}/<\/script>/{f=0}f' static/$f.html > "$TMP/$f.js" && node --check "$TMP/$f.js" && echo "$f OK"; done
node --check api/get-coach.js && node --check api/get-vitals.js && echo "api OK"
```
Expected: 9 tests pass, the four pages print OK, and `api OK`.

- [ ] **Step 2: Ask the user to verify on a preview deploy** (spec test list)

1. Clear localStorage, then open `/` → you are redirected to `/checkin.html`.
2. Save the check-in → you land on `/` with no redirect.
3. Open `/checkin.html` again → Today's check-in is shown, and editing the note shows "Gemt".
4. Coach shows Body, Training and Today in order, and "Work" is not listed under Today's sessions.
5. An uploaded ride gives `✓ Done` next to "Cykeltur". A past session with no activity shows `Missed`.
6. The bottom bar works from all four pages, and the active tab is highlighted.
7. Vitals no longer shows Today's check-in.

- [ ] **Step 3: Commit following CLAUDE.md**

Run `/simplify`, then `/code-review`. Fix what they find, tell the user what changed, and then commit, but only when the user asks. The working tree also contains the earlier, uncommitted Vitals/Fitness/TLR changes and `CLAUDE.md`. Ask the user whether those go in the same commit.
