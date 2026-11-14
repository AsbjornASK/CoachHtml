# Web Push Notifications and Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send one morning Web Push notification to the user's iPhone (check-in reminder, or Readiness + today's sessions, plus stale weight/body-comp warnings), switched on from a new Profile page.

**Architecture:** The app becomes an installable PWA (manifest, icons, `sw.js`, shared `app-shell.js`). Readiness math and warning text move into dual browser/Node modules under `static/js/`, so the Coach page and the server produce the same numbers. A daily Vercel Cron calls `api/cron-morning.mjs`, which reads one subscription from a private Vercel Blob, builds the message with a pure function and sends it with `web-push`.

**Tech Stack:** Plain HTML + classic scripts, Vercel Functions (`.mjs`, Web `Request`/`Response`), Node test runner (`node --test`, `.cjs` tests), `web-push`, `@vercel/blob` (private store, OIDC).

**Spec:** `docs/superpowers/specs/2026-10-05-web-push-notifications-design.md`

## Global Constraints

- Branch: `feature/web-push` (stacked on `feature/coach-page-structure` / PR #8).
- All UI text and notification text is English. `tests/no-danish.test.cjs` must cover `profile.html`.
- iPhone only, iOS 16.4+; push only works from the Home Screen app.
- One user, one subscription, stored at Blob pathname `push/subscription.json` with `access: 'private'`.
- Cron: `{ "path": "/api/cron-morning", "schedule": "0 7 * * *" }` (UTC).
- Env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `BLOB_STORE_ID` (auto from Blob connection).
- Readiness colours: 🟢 `>= 65`, 🟡 `>= 45`, otherwise 🔴 (from `verdictColor`).
- Shared browser/Node modules follow the `wellness-labels.js` pattern: IIFE over `typeof window !== 'undefined' ? window : globalThis`, plus `module.exports` when `module` exists. `.mjs` files load them with `createRequire(import.meta.url)`.
- API handlers keep the existing style: `export async function GET/POST/DELETE(request)` returning `json(...)` from `api/_lib/util.mjs`.
- Run the whole suite with `npm test` (= `node --test "tests/*.test.*"`). Every task ends green.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **VAPID env vars missing or malformed**: `GET /api/push-subscribe` must answer `500 { error: 'Push not configured' }`, and `sendPush` must return `{ ok: false }` instead of throwing (Task 5 tests both).
2. **Garbage subscription bodies** (no `endpoint`, `http://` endpoint, missing keys, invalid JSON): `POST /api/push-subscribe` must answer `400` and store nothing (Task 6 tests these).
3. **Subscription deleted on the server after a 410, while the iPhone still has its browser subscription**: Profile must show *Off* (not *On*), and turning it on again must re-POST (Task 9 tests the status with `serverEndpoint: null`).
4. **Intervals down or returning non-OK at cron time**: the cron must still send the fallback `Good morning` message, not crash (Task 7 tests it).
5. **Cron called without, or with a wrong, `Authorization` header, or with `CRON_SECRET` unset**: must be `401` and send nothing (Task 7 tests all three).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `package.json`, `package-lock.json` | Create | Dependencies `web-push`, `@vercel/blob`; `npm test`. |
| `.gitignore` | Modify | Ignore `node_modules/`. |
| `static/js/readiness.js` | Create | `BL`, `calcRecovery`, `calcSleep`, `calcSubjectiveScore`, `calcReadiness`, `verdictColor`. |
| `static/index.html`, `static/vitals.html` | Modify | Use `readiness.js` instead of inline copies. |
| `static/js/data-freshness.js` | Modify | Add `warningText(w)`. |
| `static/checkin.html` | Modify | Use `warningText`. |
| `api/_lib/coach-data.mjs` | Create | Pure `coachData(days, activities, end)`. |
| `api/get-coach.mjs` | Modify | Use `coachData`. |
| `api/_lib/intervals.mjs` | Modify | Add `isBodyComp`, `freshnessDates(days)`. |
| `api/get-vitals.mjs` | Modify | Use `isBodyComp`, `freshnessDates`. |
| `api/_lib/calendar.mjs` | Modify | Add `calendarEvents(today)`. |
| `api/get-calendar.mjs` | Modify | Use `calendarEvents`. |
| `api/_lib/morning-message.mjs` | Create | Pure `morningMessage(...)`. |
| `api/_lib/push.mjs` | Create | Blob store, subscription validation, `sendPush`. |
| `api/push-subscribe.mjs` | Create | `GET`/`POST`/`DELETE` subscription. |
| `api/push-test.mjs` | Create | `POST` sends a test push. |
| `api/cron-morning.mjs` | Create | Daily cron handler. |
| `vercel.json` | Modify | `crons`, `sw.js` no-cache header. |
| `scripts/make-icons.cjs` | Create | Generates PNG icons (zlib only). |
| `static/icons/icon-180.png`, `icon-192.png`, `icon-512.png` | Create | Generated icons. |
| `static/manifest.webmanifest` | Create | PWA manifest. |
| `static/sw.js` | Create | `push` + `notificationclick`. |
| `static/js/app-shell.js` | Create | Registers `sw.js`, adds Profile icon to `.topbar`. |
| `static/{index,checkin,vitals,dashboard,data}.html` | Modify | PWA head tags + `app-shell.js`. |
| `static/js/push-status.js` | Create | Pure `notificationStatus(...)`. |
| `static/profile.html` | Create | Profile page with Notifications card. |
| `docs/web-push-setup.md` | Already written | User setup guide (Danish); Task 10 checks it against the code. |
| `tests/*.test.cjs` | Create/Modify | One test file per task, listed in each task. |

---

### Task 1: Project setup and shared `readiness.js`

**Files:**
- Create: `package.json`, `static/js/readiness.js`, `tests/readiness.test.cjs`
- Modify: `.gitignore`, `static/index.html:109-141`, `static/vitals.html:90-122`, `static/index.html:103-105` and `static/vitals.html:84-85` (script tags)

**Interfaces:**
- Produces (global in browser, `module.exports` in Node): `BL`, `calcRecovery(hrv, rhr, sleep, tsb) → number|null`, `calcSleep(hrs, score, s8) → number|null`, `calcSubjectiveScore(subj) → number|null`, `calcReadiness(r, s, subj) → number|null`, `verdictColor(r) → 'green'|'yellow'|'red'`.

- [ ] **Step 1: Create `package.json` and install**

```json
{
  "name": "coach-html",
  "private": true,
  "scripts": {
    "test": "node --test \"tests/*.test.*\""
  },
  "dependencies": {
    "@vercel/blob": "latest",
    "web-push": "latest"
  }
}
```

Run: `npm install` (this pins exact versions in `package.json` ranges and writes `package-lock.json`). Then replace `"latest"` with the installed `^x.y.z` versions from `package-lock.json`.

Append to `.gitignore`:

```
# npm
node_modules/
```

- [ ] **Step 2: Write the failing test** `tests/readiness.test.cjs`

```js
// static/js/readiness.js is the single Readiness formula for Coach, Vitals and the morning push.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const r = require('../static/js/readiness.js');

test('recovery at baseline is 50, better HRV raises it', () => {
  assert.equal(r.calcRecovery(r.BL.hrv.mean, r.BL.rhr.mean, r.BL.sleep.mean, r.BL.tsb.mean), 50);
  assert.ok(r.calcRecovery(90, 50, 8, 0) > 50);
  assert.equal(r.calcRecovery(null, 50, 8, 0), null);
});

test('readiness with and without subjective values', () => {
  assert.equal(r.calcReadiness(60, 80, null), 70);
  assert.equal(r.calcReadiness(60, 80, { fatigue: 1, soreness: 2 }), Math.round(60 * 0.4 + 80 * 0.2 + Math.round(90 * 0.6 + 68 * 0.4) * 0.4));
  assert.equal(r.calcReadiness(null, 80, null), null);
});

test('verdict colours', () => {
  assert.equal(r.verdictColor(65), 'green');
  assert.equal(r.verdictColor(45), 'yellow');
  assert.equal(r.verdictColor(44), 'red');
});

test('Coach and Vitals load readiness.js and no longer define the formula inline', () => {
  for (const page of ['index', 'vitals']) {
    const html = fs.readFileSync(path.join(__dirname, `../static/${page}.html`), 'utf8');
    assert.match(html, /<script src="\/js\/readiness\.js"><\/script>/, page);
    assert.doesNotMatch(html, /function calcRecovery|const BL = \{/, page);
  }
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node --test tests/readiness.test.cjs`
Expected: FAIL with `Cannot find module '../static/js/readiness.js'`.

- [ ] **Step 4: Create `static/js/readiness.js`** by moving the code verbatim from `static/index.html:109-141` (`BL` through `verdictColor`; it is identical in `static/vitals.html:90-122`)

```js
// Readiness formula shared by Coach, Vitals and the morning push (api/_lib/morning-message.mjs).
// Loaded as a classic <script> in the browser and required by the Node tests and API functions.
(function (root) {
  const BL = {
    hrv:  {mean:74.56,std:16.26,w:0.45},
    rhr:  {mean:52.46,std:4.55, w:0.25},
    sleep:{mean:7.97, std:0.78, w:0.20},
    tsb:  {mean:-1.33,std:4.58, w:0.10},
  };

  function calcRecovery(hrv,rhr,sleep,tsb){
    if(hrv==null)return null;
    let z=0,wt=0;
    if(hrv!=null){z+=BL.hrv.w*(hrv-BL.hrv.mean)/BL.hrv.std;wt+=BL.hrv.w;}
    if(rhr!=null&&rhr<65){z+=BL.rhr.w*(BL.rhr.mean-rhr)/BL.rhr.std;wt+=BL.rhr.w;}
    if(sleep!=null){z+=BL.sleep.w*(sleep-BL.sleep.mean)/BL.sleep.std;wt+=BL.sleep.w;}
    if(tsb!=null){z+=BL.tsb.w*(tsb-BL.tsb.mean)/BL.tsb.std;wt+=BL.tsb.w;}
    if(wt===0)return null;
    return Math.min(100,Math.max(1,Math.round(50+(z/wt)*wt*16.6)));
  }

  function calcSleep(hrs,score,s8){
    if(hrs==null)return null;
    const dur=Math.min(100,(hrs/7.5)*100);
    const res=score??70;
    let con=70;
    const v=(s8??[]).filter(x=>x!=null);
    if(v.length>=4){const m=v.reduce((a,b)=>a+b,0)/v.length;const sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length);con=Math.min(100,Math.max(0,(1-Math.max(0,sd-0.5)/1.5)*100));}
    return Math.min(100,Math.max(0,Math.round(0.50*dur+0.30*res+0.20*con)));
  }

  const SUBJ_SCORE=[90,68,42,10];
  function calcSubjectiveScore(subj){const f=subj?.fatigue!=null?SUBJ_SCORE[subj.fatigue-1]:null;const s=subj?.soreness!=null?SUBJ_SCORE[subj.soreness-1]:null;if(f==null&&s==null)return null;if(f==null)return s;if(s==null)return f;return Math.round(f*0.6+s*0.4);}
  function calcReadiness(r,s,subj){if(r==null||s==null)return null;const sub=calcSubjectiveScore(subj);if(sub==null)return Math.min(100,Math.max(1,Math.round(r*0.5+s*0.5)));return Math.min(100,Math.max(1,Math.round(r*0.4+s*0.2+sub*0.4)));}

  function verdictColor(r){return r>=65?'green':r>=45?'yellow':'red';}

  const api = { BL, calcRecovery, calcSleep, calcSubjectiveScore, calcReadiness, verdictColor };
  Object.assign(root, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

Before deleting the inline copies, diff them against this file (`git diff --no-index` on the extracted ranges) and stop if they differ from each other.

- [ ] **Step 5: Remove the inline copies and load the module**

In `static/index.html` delete lines from `const BL = {` through `function verdictColor(...)` (keep `const HEX=...` and everything after). Add before the inline `<script>`:

```html
<script src="/js/readiness.js"></script>
```

Do the same in `static/vitals.html` (delete `const BL = {` … `function verdictColor(...)`, add the script tag before its inline `<script>`).

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: PASS. If a test that sandboxes `index.html` functions fails because `calcRecovery` is gone, add `...require('../static/js/readiness.js')` to that test's vm context.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore static/js/readiness.js static/index.html static/vitals.html tests/readiness.test.cjs
git commit -m "refactor: shared readiness.js for Coach, Vitals and the server"
```

---

### Task 2: Shared warning text

**Files:**
- Modify: `static/js/data-freshness.js`, `static/checkin.html` (`renderWarnings`)
- Test: `tests/data-freshness.test.cjs`

**Interfaces:**
- Produces: `warningText({ kind: 'weight'|'bodyComp', days: number|null }) → string`, e.g. `'Weight not logged for 10 days'`, `'Body composition not measured for over 3 weeks'`.

- [ ] **Step 1: Add the failing test** to `tests/data-freshness.test.cjs` (update its `require` to also take `warningText`)

```js
test('warningText matches the Check-in banners', () => {
  assert.equal(warningText({ kind: 'weight', days: 10 }), 'Weight not logged for 10 days');
  assert.equal(warningText({ kind: 'weight', days: null }), 'Weight not logged for over 3 weeks');
  assert.equal(warningText({ kind: 'bodyComp', days: 30 }), 'Body composition not measured for 30 days');
  assert.equal(warningText({ kind: 'bodyComp', days: null }), 'Body composition not measured for over 3 weeks');
});
```

- [ ] **Step 2: Run it**: `node --test tests/data-freshness.test.cjs` → FAIL (`warningText is not a function`).

- [ ] **Step 3: Implement** in `static/js/data-freshness.js`, after `freshnessWarnings`:

```js
  // Banner / notification text for one warning from freshnessWarnings
  function warningText(w) {
    const when = w.days == null ? 'over 3 weeks' : `${w.days} days`;
    return w.kind === 'weight' ? `Weight not logged for ${when}` : `Body composition not measured for ${when}`;
  }
```

and export it: `root.warningText = warningText;` and add `warningText` to `module.exports`.

In `static/checkin.html` replace the body of the `.map(...)` in `renderWarnings` with:

```js
  el.innerHTML=freshnessWarnings({today:TODAY,..._fresh}).map(w=>`<div class="warn">⚠ ${warningText(w)}</div>`).join('');
```

In `tests/checkin-load.test.cjs` the vm context spreads `freshnessWarnings` only; change its import to `const freshness = require('../static/js/data-freshness.js');` and put `...freshness` in the context instead of `freshnessWarnings`.

- [ ] **Step 4: Run** `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add static/js/data-freshness.js static/checkin.html tests/data-freshness.test.cjs tests/checkin-load.test.cjs
git commit -m "refactor: shared warningText for freshness banners"
```

---

### Task 3: Server data helpers (`coachData`, `freshnessDates`, `calendarEvents`)

**Files:**
- Create: `api/_lib/coach-data.mjs`, `tests/server-data.test.cjs`
- Modify: `api/get-coach.mjs`, `api/_lib/intervals.mjs`, `api/get-vitals.mjs`, `api/_lib/calendar.mjs`, `api/get-calendar.mjs`

**Interfaces:**
- Produces:
  - `coachData(days, activities, end) → { today, latest, trends, sleep8, fitnessHistory, subjective, activities }` (exactly today's `get-coach` JSON).
  - `isBodyComp(day) → boolean`, `freshnessDates(days) → { lastWeightDate: string|null, lastBodyCompDate: string|null }` in `api/_lib/intervals.mjs`.
  - `calendarEvents(today = new Date()) → Promise<{ today: Event[], upcoming: Event[] } | null>` in `api/_lib/calendar.mjs` (`null` when no calendars are configured). `Event = { title, date, timeStart, timeEnd, category }`.

- [ ] **Step 1: Write the failing test** `tests/server-data.test.cjs`

```js
// Pure server helpers extracted from get-coach / get-vitals / get-calendar.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');

const ctx = {};
before(async () => Object.assign(ctx,
  await import('../api/_lib/coach-data.mjs'),
  await import('../api/_lib/intervals.mjs'),
  await import('../api/_lib/calendar.mjs')));

const day = (date, over = {}) => ({ id: date, restingHR: 50, hrv: 70, sleepSecs: 7.5 * 3600, ctl: 40, atl: 45, ...over });

test('coachData builds the Coach payload from parsed days', () => {
  const days = ctx.parseDays([day('2026-10-04'), day('2026-10-05', { soreness: 2, fatigue: 1, injury: 1 })]);
  const c = ctx.coachData(days, [{ type: 'Run' }], '2026-10-05');
  assert.equal(c.today, '2026-10-05');
  assert.equal(c.latest.date, '2026-10-05');
  assert.equal(c.latest.hrv, 70);
  assert.deepEqual(c.subjective, { mood: null, soreness: 2, fatigue: 1, motivation: null, injury: 1 });
  assert.equal(c.trends.hrv.length, 2);
  assert.equal(c.sleep8.length, 2);
  assert.deepEqual(c.activities, [{ type: 'Run' }]);
});

test('freshnessDates finds the last weight and last body composition', () => {
  const days = ctx.parseDays([
    day('2026-10-01', { weight: 78, bodyFat: 15 }),
    day('2026-10-03', { weight: 78.2 }),
    day('2026-10-04'),
  ]);
  assert.deepEqual(ctx.freshnessDates(days), { lastWeightDate: '2026-10-03', lastBodyCompDate: '2026-10-01' });
  assert.deepEqual(ctx.freshnessDates([]), { lastWeightDate: null, lastBodyCompDate: null });
});

test('calendarEvents is null without configured calendars', async () => {
  for (const k of Object.keys(process.env)) if (/_ICS_URL$/.test(k)) delete process.env[k];
  assert.equal(await ctx.calendarEvents(new Date('2026-10-05T06:00:00Z')), null);
});
```

Before writing the test, open `api/_lib/intervals.mjs` and check how `parseDays` maps a raw day (`id` → `date`, `sleepSecs` → hours via `sleepHours`). Adjust the `day(...)` fixture field names to what `parseDays` actually reads.

- [ ] **Step 2: Run it**: `node --test tests/server-data.test.cjs` → FAIL (`Cannot find module .../coach-data.mjs`).

- [ ] **Step 3: Create `api/_lib/coach-data.mjs`** by moving the object literal from `api/get-coach.mjs` (everything inside `json({ ... })`, plus the `last7`/`latest`/`todayEntry` lines):

```js
// The Coach page payload, built from parsed wellness days. Shared by get-coach and the morning push.
import { findLatest, rhrOf, tsbOf, sleepHours } from './intervals.mjs';
import { r1 } from './util.mjs';

export function coachData(days, activities, end) {
  const last7      = days.slice(-7);
  const latest     = findLatest(days, d => rhrOf(d) != null);
  const todayEntry = days.find(d => d.date === end) ?? {};

  return {
    today: end,
    latest: {
      date:       latest?.date       ?? null,
      hrv:        latest?.hrv        ?? null,
      restingHR:  latest?.restingHR  ?? null,
      sleepHours: sleepHours(latest),
      sleepScore: latest?.sleepScore ?? null,
      ctl:        r1(latest?.ctl),
      atl:        r1(latest?.atl),
      tsb:        tsbOf(latest),
      rampRate:   r1(latest?.rampRate),
    },
    trends: {
      hrv:       last7.map(d => d.hrv ?? null),
      rhr:       last7.map(d => rhrOf(d)),
      sleep:     last7.map(d => sleepHours(d)),
      sleepScore:last7.map(d => d.sleepScore ?? null),
      tsb:       last7.map(d => tsbOf(d)),
      fatigue:   last7.map(d => d.fatigue   ?? null),
      soreness:  last7.map(d => d.soreness  ?? null),
      dates:     last7.map(d => d.date),
    },
    sleep8: days.slice(-8).map(d => sleepHours(d)),
    fitnessHistory: days.map(d => ({
      date: d.date,
      ctl:  r1(d.ctl),
      atl:  r1(d.atl),
      tsb:  tsbOf(d),
    })),
    subjective: {
      mood:       todayEntry.mood       ?? null,
      soreness:   todayEntry.soreness   ?? null,
      fatigue:    todayEntry.fatigue    ?? null,
      motivation: todayEntry.motivation ?? null,
      injury:     todayEntry.injury     ?? null,
    },
    activities,
  };
}
```

Copy the literal from the current `api/get-coach.mjs` rather than from this plan if they differ. `api/get-coach.mjs` becomes:

```js
import { intervalsClient, notConfigured, parseDays } from './_lib/intervals.mjs';
import { coachData } from './_lib/coach-data.mjs';
import { json, fmt, daysAgo } from './_lib/util.mjs';

export async function GET() {
  const intervals = intervalsClient();
  if (!intervals) return notConfigured();

  const today = new Date();
  const end   = fmt(today);
  const start = daysAgo(14, today);

  const [wellnessRes, activitiesRes] = await Promise.all([
    intervals.get(`/wellness?oldest=${start}&newest=${end}`),
    intervals.get(`/activities?oldest=${end}&newest=${end}`),
  ]);

  if (!wellnessRes.ok) {
    return json({ error: 'Intervals wellness API error', status: wellnessRes.status }, 502);
  }

  const activities = activitiesRes.ok
    ? (await activitiesRes.json()).map(a => ({ type: a.type ?? null }))
    : null;

  return json(coachData(parseDays(await wellnessRes.json()), activities, end));
}
```

- [ ] **Step 4: Add `isBodyComp` / `freshnessDates`** to the end of `api/_lib/intervals.mjs`:

```js
// A day with an InBody-style measurement (weight plus fat mass or fat %).
export const isBodyComp = d => !!(d.weight && (d.fatMass || d.bodyFat));

// Last logged weight / body composition dates in the given days; null when none.
export function freshnessDates(days) {
  return {
    lastWeightDate:   days.findLast(d => d.weight)?.date ?? null,
    lastBodyCompDate: days.findLast(isBodyComp)?.date ?? null,
  };
}
```

In `api/get-vitals.mjs`: import `isBodyComp, freshnessDates`; change `days.filter(d => d.weight && (d.fatMass || d.bodyFat))` to `days.filter(isBodyComp)`; replace the two `lastWeightDate:` / `lastBodyCompDate:` lines (and their comment) with:

```js
    // Last logged dates inside the 21-day window; null means nothing logged in the window
    ...freshnessDates(days),
```

- [ ] **Step 5: Add `calendarEvents`** to `api/_lib/calendar.mjs` (add `import { fmt, daysAgo } from './util.mjs';` at the top):

```js
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
```

`api/get-calendar.mjs` becomes:

```js
// Today's and upcoming events from all category calendars.

import { calendarEvents } from './_lib/calendar.mjs';
import { json } from './_lib/util.mjs';

export async function GET() {
  const cal = await calendarEvents();
  if (!cal) return json({ error: 'No calendar URLs configured' }, 500);
  return json(cal);
}
```

- [ ] **Step 6: Run** `npm test` → PASS (including the existing `calendar-tz` test).

- [ ] **Step 7: Commit**

```bash
git add api tests/server-data.test.cjs
git commit -m "refactor: extract coachData, freshnessDates and calendarEvents for reuse"
```

---

### Task 4: `morningMessage`

**Files:**
- Create: `api/_lib/morning-message.mjs`, `tests/morning-message.test.cjs`

**Interfaces:**
- Consumes: `hasCheckinValues` (checkin-state.js), `freshnessWarnings`, `warningText` (data-freshness.js), `calcRecovery`, `calcSleep`, `calcReadiness`, `verdictColor` (readiness.js), the `coachData` shape from Task 3.
- Produces: `morningMessage({ coach, lastWeightDate, lastBodyCompDate, todayEvents, today }) → { title: string, body: string, url: string }`. `coach` may be `null` (Intervals failed). `todayEvents` may be `null`.

- [ ] **Step 1: Write the failing test** `tests/morning-message.test.cjs`

```js
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { calcRecovery, calcSleep, calcReadiness } = require('../static/js/readiness.js');

let morningMessage;
before(async () => ({ morningMessage } = await import('../api/_lib/morning-message.mjs')));

const TODAY = '2026-10-05';
const coach = (subjective, latest = { hrv: 90, restingHR: 48, sleepHours: 8, sleepScore: 85, tsb: 2 }) =>
  ({ latest, sleep8: [8, 8, 8, 8], subjective });
const fresh = { lastWeightDate: TODAY, lastBodyCompDate: TODAY };
const run = (t, over = {}) => ({ title: t, timeStart: '17:00', category: 'training', ...over });

test('not checked in → check-in reminder that opens Check-in', () => {
  const m = morningMessage({ coach: coach({ soreness: null, fatigue: null }), ...fresh, todayEvents: [], today: TODAY });
  assert.deepEqual(m, { title: 'Morning check-in', body: "You haven't checked in yet.", url: '/checkin.html' });
});

test('checked in → Readiness with colour and today\'s sessions in start order', () => {
  const c = coach({ soreness: 1, fatigue: 1 });
  const expected = calcReadiness(calcRecovery(90, 48, 8, 2), calcSleep(8, 85, [8, 8, 8, 8]), c.subjective);
  const m = morningMessage({ coach: c, ...fresh, today: TODAY,
    todayEvents: [run('Strength', { timeStart: '18:30' }), run('Easy run', { timeStart: '07:00' }), { title: 'Work', timeStart: '09:00', category: 'work' }] });
  assert.equal(m.title, `Readiness ${expected} 🟢`);
  assert.equal(m.body, 'Today: Easy run 07:00 · Strength 18:30');
  assert.equal(m.url, '/');
});

test('no training today → Rest day; all-day session has no time', () => {
  const c = coach({ fatigue: 2 });
  assert.equal(morningMessage({ coach: c, ...fresh, todayEvents: [], today: TODAY }).body, 'Rest day');
  assert.equal(morningMessage({ coach: c, ...fresh, todayEvents: null, today: TODAY }).body, 'Rest day');
  assert.equal(morningMessage({ coach: c, ...fresh, todayEvents: [run('Long run', { timeStart: null })], today: TODAY }).body, 'Today: Long run');
});

test('missing HRV → Readiness –', () => {
  const m = morningMessage({ coach: coach({ fatigue: 2 }, { hrv: null, restingHR: 50, sleepHours: 7, sleepScore: null, tsb: 0 }), ...fresh, todayEvents: [], today: TODAY });
  assert.equal(m.title, 'Readiness –');
});

test('red and yellow dots', () => {
  const low = { hrv: 40, restingHR: 62, sleepHours: 5, sleepScore: 40, tsb: -15 };
  assert.match(morningMessage({ coach: coach({ fatigue: 4, soreness: 4 }, low), ...fresh, todayEvents: [], today: TODAY }).title, /🔴$/);
});

test('stale weight and body comp are added as warning lines (also to the reminder)', () => {
  const m = morningMessage({ coach: coach({ soreness: null }), lastWeightDate: '2026-09-25', lastBodyCompDate: null, todayEvents: [], today: TODAY });
  assert.equal(m.body, "You haven't checked in yet.\n⚠ Weight not logged for 10 days\n⚠ Body composition not measured for over 3 weeks");
});

test('Intervals unavailable → Good morning fallback', () => {
  assert.deepEqual(morningMessage({ coach: null, lastWeightDate: null, lastBodyCompDate: null, todayEvents: [], today: TODAY }),
    { title: 'Good morning', body: "Open Coach for today's readiness.", url: '/' });
});
```

If the "red" fixture does not land below 45 with the real formula, lower the inputs until `calcReadiness(...)` is `< 45` (compute it in the test with the shared functions, as the second test does).

- [ ] **Step 2: Run it**: `node --test tests/morning-message.test.cjs` → FAIL (module not found).

- [ ] **Step 3: Implement** `api/_lib/morning-message.mjs`

```js
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
```

- [ ] **Step 4: Run** `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/morning-message.mjs tests/morning-message.test.cjs
git commit -m "feat: morning push message builder"
```

---

### Task 5: Push library (Blob store + `sendPush`)

**Files:**
- Create: `api/_lib/push.mjs`, `tests/push-lib.test.cjs`

**Interfaces:**
- Produces:
  - `SUBSCRIPTION_PATH = 'push/subscription.json'`
  - `isValidSubscription(s) → boolean`
  - `blobStore = { read(): Promise<Subscription|null>, save(sub): Promise<void>, remove(): Promise<void> }`
  - `sendPush(sub, payload, lib = webpush) → Promise<{ ok: boolean, gone: boolean, status: number|null }>`
  - `pushDeps = { store: blobStore, send: sendPush }` — the default dependencies handlers use; tests pass fakes with the same shape.

- [ ] **Step 1: Write the failing test** `tests/push-lib.test.cjs`

```js
const { test, before, afterEach } = require('node:test');
const assert = require('node:assert/strict');

let push;
before(async () => { push = await import('../api/_lib/push.mjs'); });
const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; });

const sub = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p', auth: 'a' } };

test('isValidSubscription', () => {
  assert.equal(push.isValidSubscription(sub), true);
  assert.equal(push.isValidSubscription({ ...sub, endpoint: 'http://x' }), false);
  assert.equal(push.isValidSubscription({ endpoint: sub.endpoint }), false);
  assert.equal(push.isValidSubscription({ ...sub, keys: { p256dh: 'p' } }), false);
  assert.equal(push.isValidSubscription(null), false);
  assert.equal(push.isValidSubscription('x'), false);
});

const fakeLib = impl => ({ setVapidDetails() {}, sendNotification: impl });
const vapid = () => Object.assign(process.env, { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:a@b.c' });

test('sendPush sends the JSON payload', async () => {
  vapid();
  let sent;
  const r = await push.sendPush(sub, { title: 'T' }, fakeLib(async (s, body, opts) => { sent = { s, body, opts }; }));
  assert.deepEqual(r, { ok: true, gone: false, status: 201 });
  assert.equal(sent.s, sub);
  assert.deepEqual(JSON.parse(sent.body), { title: 'T' });
  assert.ok(sent.opts.TTL > 0);
});

test('sendPush reports 404/410 as gone and never throws', async () => {
  vapid();
  for (const statusCode of [404, 410]) {
    const r = await push.sendPush(sub, {}, fakeLib(async () => { throw Object.assign(new Error('x'), { statusCode }); }));
    assert.deepEqual(r, { ok: false, gone: true, status: statusCode });
  }
  const r = await push.sendPush(sub, {}, fakeLib(async () => { throw Object.assign(new Error('x'), { statusCode: 500 }); }));
  assert.deepEqual(r, { ok: false, gone: false, status: 500 });
});

test('sendPush without VAPID config returns ok:false instead of throwing', async () => {
  delete process.env.VAPID_PRIVATE_KEY;
  const lib = { setVapidDetails() { throw new Error('bad keys'); }, sendNotification: async () => {} };
  assert.deepEqual(await push.sendPush(sub, {}, lib), { ok: false, gone: false, status: null });
});
```

- [ ] **Step 2: Run it**: `node --test tests/push-lib.test.cjs` → FAIL (module not found).

- [ ] **Step 3: Implement** `api/_lib/push.mjs`

```js
// The single Web Push subscription (private Vercel Blob) and sending to it.
import { put, get, del } from '@vercel/blob';
import webpush from 'web-push';

export const SUBSCRIPTION_PATH = 'push/subscription.json';
const TTL_SECONDS = 4 * 3600; // a morning message is useless after a few hours

export function isValidSubscription(s) {
  return !!s && typeof s === 'object'
    && typeof s.endpoint === 'string' && s.endpoint.startsWith('https://')
    && typeof s.keys?.p256dh === 'string' && typeof s.keys?.auth === 'string';
}

export const blobStore = {
  async read() {
    // useCache: false so a fresh subscribe/unsubscribe is seen immediately
    const r = await get(SUBSCRIPTION_PATH, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return null;
    try { return JSON.parse(await new Response(r.stream).text()); } catch { return null; }
  },
  async save(sub) {
    await put(SUBSCRIPTION_PATH, JSON.stringify(sub), {
      access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json',
    });
  },
  async remove() {
    await del(SUBSCRIPTION_PATH);
  },
};

// { ok, gone, status }; gone = the push service says the subscription no longer exists
export async function sendPush(sub, payload, lib = webpush) {
  try {
    const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
    lib.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const res = await lib.sendNotification(sub, JSON.stringify(payload), { TTL: TTL_SECONDS });
    return { ok: true, gone: false, status: res?.statusCode ?? 201 };
  } catch (e) {
    const status = e?.statusCode ?? null;
    return { ok: false, gone: status === 404 || status === 410, status };
  }
}

export const pushDeps = { store: blobStore, send: sendPush };
```

Check `node_modules/@vercel/blob` (README or `dist/*.d.ts`) that `get(pathname, { access: 'private', useCache })` returns `{ statusCode, stream }` or `null`, and that `put` accepts `allowOverwrite` / `addRandomSuffix`. If the installed version differs, adapt only `blobStore` (its interface stays the same).

- [ ] **Step 4: Run** `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/push.mjs tests/push-lib.test.cjs
git commit -m "feat: push subscription store and sender"
```

---

### Task 6: `api/push-subscribe.mjs` and `api/push-test.mjs`

**Files:**
- Create: `api/push-subscribe.mjs`, `api/push-test.mjs`, `tests/push-api.test.cjs`

**Interfaces:**
- Consumes: `pushDeps`, `isValidSubscription` (Task 5).
- Produces:
  - `push-subscribe.mjs`: `makeHandlers(deps) → { GET, POST, DELETE }`; named exports `GET`, `POST`, `DELETE` = `makeHandlers(pushDeps)`.
    - `GET` → `200 { publicKey, endpoint|null }` or `500 { error: 'Push not configured' }`.
    - `POST` (JSON subscription) → `200 { ok: true }` or `400 { error: 'Invalid subscription' }`.
    - `DELETE` → `200 { ok: true }`.
  - `push-test.mjs`: `makePOST(deps)`; named export `POST`. → `200 { ok: true }`, `404 { error: 'No subscription' }`, or `502 { error: 'Push failed', status }` (and deletes the subscription when `gone`).

- [ ] **Step 1: Write the failing test** `tests/push-api.test.cjs`

```js
const { test, before, afterEach } = require('node:test');
const assert = require('node:assert/strict');

let sub, tst;
before(async () => { sub = await import('../api/push-subscribe.mjs'); tst = await import('../api/push-test.mjs'); });
const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; });

const SUB = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p', auth: 'a' } };
function fakeStore(initial = null) {
  const s = { value: initial, async read() { return s.value; }, async save(v) { s.value = v; }, async remove() { s.value = null; } };
  return s;
}
const req = (method, body) => new Request('https://x/api', { method, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });

test('GET returns the public key and the stored endpoint', async () => {
  process.env.VAPID_PUBLIC_KEY = 'PUB';
  const h = sub.makeHandlers({ store: fakeStore(SUB) });
  const r = await h.GET(req('GET'));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { publicKey: 'PUB', endpoint: SUB.endpoint });
  const empty = await sub.makeHandlers({ store: fakeStore() }).GET(req('GET'));
  assert.deepEqual(await empty.json(), { publicKey: 'PUB', endpoint: null });
});

test('GET without VAPID_PUBLIC_KEY is a 500', async () => {
  delete process.env.VAPID_PUBLIC_KEY;
  const r = await sub.makeHandlers({ store: fakeStore() }).GET(req('GET'));
  assert.equal(r.status, 500);
  assert.deepEqual(await r.json(), { error: 'Push not configured' });
});

test('POST stores a valid subscription and rejects garbage', async () => {
  const store = fakeStore();
  const h = sub.makeHandlers({ store });
  assert.equal((await h.POST(req('POST', SUB))).status, 200);
  assert.deepEqual(store.value, SUB);
  for (const bad of [{ endpoint: 'http://x', keys: SUB.keys }, { endpoint: SUB.endpoint }, 'not json', {}]) {
    const s2 = fakeStore();
    const r = await sub.makeHandlers({ store: s2 }).POST(req('POST', bad));
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.equal(s2.value, null);
  }
});

test('POST stores only endpoint and keys', async () => {
  const store = fakeStore();
  await sub.makeHandlers({ store }).POST(req('POST', { ...SUB, expirationTime: null, extra: 'x' }));
  assert.deepEqual(store.value, SUB);
});

test('DELETE removes the subscription', async () => {
  const store = fakeStore(SUB);
  assert.equal((await sub.makeHandlers({ store }).DELETE(req('DELETE'))).status, 200);
  assert.equal(store.value, null);
});

test('push-test sends a test notification to the stored subscription', async () => {
  const sent = [];
  const send = async (s, p) => { sent.push({ s, p }); return { ok: true, gone: false, status: 201 }; };
  const r = await tst.makePOST({ store: fakeStore(SUB), send })(req('POST'));
  assert.equal(r.status, 200);
  assert.deepEqual(sent, [{ s: SUB, p: { title: 'Coach', body: 'Test notification ✓', url: '/profile.html' } }]);
});

test('push-test without a subscription is a 404; a gone subscription is deleted', async () => {
  const send = async () => ({ ok: false, gone: true, status: 410 });
  assert.equal((await tst.makePOST({ store: fakeStore(), send })(req('POST'))).status, 404);
  const store = fakeStore(SUB);
  const r = await tst.makePOST({ store, send })(req('POST'));
  assert.equal(r.status, 502);
  assert.equal(store.value, null);
});
```

- [ ] **Step 2: Run it**: `node --test tests/push-api.test.cjs` → FAIL (module not found).

- [ ] **Step 3: Implement** `api/push-subscribe.mjs`

```js
// The Profile page's push subscription: public key + stored endpoint, save, delete.
import { pushDeps, isValidSubscription } from './_lib/push.mjs';
import { json } from './_lib/util.mjs';

export function makeHandlers({ store }) {
  return {
    async GET() {
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      if (!publicKey) return json({ error: 'Push not configured' }, 500);
      const saved = await store.read();
      return json({ publicKey, endpoint: saved?.endpoint ?? null });
    },
    async POST(request) {
      const body = await request.json().catch(() => null);
      if (!isValidSubscription(body)) return json({ error: 'Invalid subscription' }, 400);
      await store.save({ endpoint: body.endpoint, keys: { p256dh: body.keys.p256dh, auth: body.keys.auth } });
      return json({ ok: true });
    },
    async DELETE() {
      await store.remove();
      return json({ ok: true });
    },
  };
}

export const { GET, POST, DELETE } = makeHandlers(pushDeps);
```

`api/push-test.mjs`:

```js
// Sends a test notification from the Profile page.
import { pushDeps } from './_lib/push.mjs';
import { json } from './_lib/util.mjs';

export function makePOST({ store, send }) {
  return async function POST() {
    const sub = await store.read();
    if (!sub) return json({ error: 'No subscription' }, 404);
    const r = await send(sub, { title: 'Coach', body: 'Test notification ✓', url: '/profile.html' });
    if (r.gone) await store.remove();
    return r.ok ? json({ ok: true }) : json({ error: 'Push failed', status: r.status }, 502);
  };
}

export const POST = makePOST(pushDeps);
```

- [ ] **Step 4: Run** `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add api/push-subscribe.mjs api/push-test.mjs tests/push-api.test.cjs
git commit -m "feat: push subscribe and test endpoints"
```

---

### Task 7: `api/cron-morning.mjs` + cron config

**Files:**
- Create: `api/cron-morning.mjs`, `tests/cron-morning.test.cjs`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `pushDeps` (Task 5), `morningMessage` (Task 4), `coachData` (Task 3), `freshnessDates`, `parseDays`, `intervalsClient` (intervals.mjs), `calendarEvents` (Task 3).
- Produces: `makeGET({ store, send, loadMorning })`; named export `GET`. `loadMorning(today: Date) → Promise<{ coach, lastWeightDate, lastBodyCompDate, todayEvents }>` (never throws; `coach: null` when Intervals fails). Responses: `401 { error: 'Unauthorized' }`, `200 { sent: false, reason: 'no subscription' }`, `200 { sent: true, title }`, `502 { sent: false, status }`.

- [ ] **Step 1: Write the failing test** `tests/cron-morning.test.cjs`

```js
const { test, before, afterEach } = require('node:test');
const assert = require('node:assert/strict');

let cron;
before(async () => { cron = await import('../api/cron-morning.mjs'); });
const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; });

const SUB = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p', auth: 'a' } };
const store = (v = SUB) => { const s = { value: v, async read() { return s.value; }, async save(x) { s.value = x; }, async remove() { s.value = null; } }; return s; };
const req = auth => new Request('https://x/api/cron-morning', { headers: auth ? { authorization: auth } : {} });
const morning = { coach: null, lastWeightDate: null, lastBodyCompDate: null, todayEvents: [] };

function deps(over = {}) {
  const sent = [];
  return { sent, store: store(), send: async (s, p) => { sent.push(p); return { ok: true, gone: false, status: 201 }; }, loadMorning: async () => morning, ...over };
}

test('rejects missing, wrong or unconfigured secret', async () => {
  process.env.CRON_SECRET = 's3cret';
  for (const auth of [undefined, 'Bearer nope', 's3cret']) {
    const d = deps();
    const r = await cron.makeGET(d)(req(auth));
    assert.equal(r.status, 401, String(auth));
    assert.equal(d.sent.length, 0);
  }
  delete process.env.CRON_SECRET;
  const d = deps();
  assert.equal((await cron.makeGET(d)(req('Bearer undefined'))).status, 401);
  assert.equal((await cron.makeGET(d)(req('Bearer '))).status, 401);
});

test('no subscription → nothing sent', async () => {
  process.env.CRON_SECRET = 's3cret';
  const d = deps({ store: store(null) });
  const r = await cron.makeGET(d)(req('Bearer s3cret'));
  assert.deepEqual(await r.json(), { sent: false, reason: 'no subscription' });
  assert.equal(d.sent.length, 0);
});

test('sends the morning message (Intervals down → Good morning)', async () => {
  process.env.CRON_SECRET = 's3cret';
  const d = deps();
  const r = await cron.makeGET(d)(req('Bearer s3cret'));
  assert.equal(r.status, 200);
  assert.deepEqual(d.sent, [{ title: 'Good morning', body: "Open Coach for today's readiness.", url: '/' }]);
});

test('a 410 deletes the subscription', async () => {
  process.env.CRON_SECRET = 's3cret';
  const s = store();
  const r = await cron.makeGET(deps({ store: s, send: async () => ({ ok: false, gone: true, status: 410 }) }))(req('Bearer s3cret'));
  assert.equal(r.status, 502);
  assert.equal(s.value, null);
});

test('loadMorning never throws when Intervals is not configured', async () => {
  delete process.env.INTERVALS_API_KEY;
  const m = await cron.loadMorning(new Date('2026-10-05T07:00:00Z'));
  assert.equal(m.coach, null);
});
```

- [ ] **Step 2: Run it**: `node --test tests/cron-morning.test.cjs` → FAIL (module not found).

- [ ] **Step 3: Implement** `api/cron-morning.mjs`

```js
// Daily Vercel Cron (vercel.json): one morning push to the stored subscription.
import { pushDeps } from './_lib/push.mjs';
import { morningMessage } from './_lib/morning-message.mjs';
import { coachData } from './_lib/coach-data.mjs';
import { intervalsClient, parseDays, freshnessDates } from './_lib/intervals.mjs';
import { calendarEvents } from './_lib/calendar.mjs';
import { json, fmt, daysAgo } from './_lib/util.mjs';

// Same 21-day window as get-vitals, so the freshness warnings match the Check-in page
export async function loadMorning(today = new Date()) {
  const end = fmt(today);
  const [wellness, cal] = await Promise.all([
    (async () => {
      const intervals = intervalsClient();
      if (!intervals) return null;
      const res = await intervals.get(`/wellness?oldest=${daysAgo(21, today)}&newest=${end}`);
      return res.ok ? parseDays(await res.json()) : null;
    })().catch(() => null),
    calendarEvents(today).catch(() => null),
  ]);
  return {
    coach: wellness ? coachData(wellness, null, end) : null,
    ...(wellness ? freshnessDates(wellness) : { lastWeightDate: null, lastBodyCompDate: null }),
    todayEvents: cal?.today ?? [],
  };
}

export function makeGET({ store, send, loadMorning: load }) {
  return async function GET(request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const sub = await store.read();
    if (!sub) return json({ sent: false, reason: 'no subscription' });

    const today = new Date();
    const msg = morningMessage({ ...(await load(today)), today: fmt(today) });
    const r = await send(sub, msg);
    if (r.gone) await store.remove();
    return r.ok ? json({ sent: true, title: msg.title }) : json({ sent: false, status: r.status }, 502);
  };
}

export const GET = makeGET({ ...pushDeps, loadMorning });
```

- [ ] **Step 4: Add the cron and the `sw.js` header** — `vercel.json` becomes:

```json
{
  "outputDirectory": "static",
  "rewrites": [
    { "source": "/dashboard", "destination": "/dashboard.html" }
  ],
  "crons": [
    { "path": "/api/cron-morning", "schedule": "0 7 * * *" }
  ],
  "headers": [
    { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
  ]
}
```

Add to `tests/cron-morning.test.cjs`:

```js
test('vercel.json schedules the cron at 07:00 UTC', () => {
  const v = require('../vercel.json');
  assert.deepEqual(v.crons, [{ path: '/api/cron-morning', schedule: '0 7 * * *' }]);
});
```

- [ ] **Step 5: Run** `npm test` → PASS.

- [ ] **Step 6: Commit**

```bash
git add api/cron-morning.mjs vercel.json tests/cron-morning.test.cjs
git commit -m "feat: daily morning push cron"
```

---

### Task 8: PWA shell (manifest, icons, service worker, app-shell, head tags)

**Files:**
- Create: `scripts/make-icons.cjs`, `static/icons/icon-180.png`, `static/icons/icon-192.png`, `static/icons/icon-512.png`, `static/manifest.webmanifest`, `static/sw.js`, `static/js/app-shell.js`, `tests/pwa.test.cjs`
- Modify: `static/index.html`, `static/checkin.html`, `static/vitals.html`, `static/dashboard.html`, `static/data.html` (head + end of body)

**Interfaces:**
- Produces: `/sw.js` handling payload `{ title, body, url }`; `app-shell.js` adds `<a class="topbar-profile" href="/profile.html">` to `.topbar`.

- [ ] **Step 1: Write the failing test** `tests/pwa.test.cjs`

```js
// PWA shell: manifest, icons, service worker and the shared head/script on every page.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = p => fs.readFileSync(path.join(__dirname, '..', p));
const PAGES = ['index', 'checkin', 'vitals', 'dashboard', 'data', 'profile'];

test('manifest is valid and its icons exist as PNGs of the right size', () => {
  const m = JSON.parse(read('static/manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, '/');
  for (const icon of m.icons) {
    const png = read('static' + icon.src);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    const [w, h] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), w);
    assert.equal(png.readUInt32BE(20), h);
  }
  assert.equal(read('static/icons/icon-180.png').readUInt32BE(16), 180);
});

for (const page of PAGES) {
  test(`${page}.html has the PWA head tags and app-shell.js`, () => {
    const html = read(`static/${page}.html`).toString();
    assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest">/);
    assert.match(html, /<link rel="apple-touch-icon" href="\/icons\/icon-180\.png">/);
    assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/);
    assert.match(html, /<script src="\/js\/app-shell\.js"><\/script>/);
  });
}

function runSW() {
  const handlers = {};
  const shown = [], opened = [];
  const clients = { matchAll: async () => [], openWindow: async url => { opened.push(url); } };
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    registration: { showNotification: async (title, opts) => { shown.push({ title, opts }); } },
  };
  vm.runInNewContext(read('static/sw.js').toString(), { self, clients });
  return { handlers, shown, opened };
}

test('sw.js shows the pushed title/body and opens its url on click', async () => {
  const { handlers, shown, opened } = runSW();
  let p;
  handlers.push({ data: { json: () => ({ title: 'Readiness 72 🟢', body: 'Rest day', url: '/' }) }, waitUntil: x => { p = x; } });
  await p;
  assert.equal(shown[0].title, 'Readiness 72 🟢');
  assert.equal(shown[0].opts.body, 'Rest day');
  assert.equal(shown[0].opts.data.url, '/');
  handlers.notificationclick({ notification: { data: { url: '/checkin.html' }, close() {} }, waitUntil: x => { p = x; } });
  await p;
  assert.deepEqual(opened, ['/checkin.html']);
});

test('sw.js falls back to a generic notification without data', async () => {
  const { handlers, shown } = runSW();
  let p;
  handlers.push({ data: null, waitUntil: x => { p = x; } });
  await p;
  assert.equal(shown[0].title, 'Coach');
});
```

`profile.html` does not exist until Task 9, so its row in this test fails until then. Temporarily run Task 8 with `PAGES` minus `'profile'` and add it back in Task 9 Step 4.

- [ ] **Step 2: Run it**: `node --test tests/pwa.test.cjs` → FAIL.

- [ ] **Step 3: Create `scripts/make-icons.cjs`** and run it

```js
// Generates the PWA / Home Screen icons (blue square, white ring) as PNGs, using only zlib.
// Run: node scripts/make-icons.cjs
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function icon(size) {
  const bg = [0x00, 0x7a, 0xff], fg = [0xff, 0xff, 0xff];
  const c = size / 2, outer = size * 0.30, inner = size * 0.21;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0]; // filter: none
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      row.push(...(d <= outer && d >= inner ? fg : bg));
    }
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname, '../static/icons');
fs.mkdirSync(dir, { recursive: true });
for (const size of [180, 192, 512]) fs.writeFileSync(path.join(dir, `icon-${size}.png`), icon(size));
```

Run: `node scripts/make-icons.cjs` → creates the three PNGs.

- [ ] **Step 4: Create `static/manifest.webmanifest`**

```json
{
  "name": "Coach",
  "short_name": "Coach",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#f2f2f7",
  "theme_color": "#ffffff",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 5: Create `static/sw.js`**

```js
// Service worker: shows the morning push and opens its page when tapped. No caching.
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = {}; }
  event.waitUntil(self.registration.showNotification(d.title || 'Coach', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const win = list.find(c => 'focus' in c);
    if (win) return (win.navigate ? win.navigate(url) : Promise.resolve()).then(() => win.focus());
    return clients.openWindow(url);
  }));
});
```

- [ ] **Step 6: Create `static/js/app-shell.js`**

```js
// Shared by every page: registers the service worker and adds the Profile icon to the top bar.
(function () {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

  const bar = document.querySelector('.topbar');
  if (!bar || location.pathname === '/profile.html') return;
  const style = document.createElement('style');
  style.textContent = '.topbar-title{margin-right:auto}.topbar-profile{display:flex;color:#007aff;flex-shrink:0;margin-left:12px}.topbar-profile svg{width:24px;height:24px}';
  document.head.appendChild(style);
  const a = document.createElement('a');
  a.href = '/profile.html';
  a.className = 'topbar-profile';
  a.setAttribute('aria-label', 'Profile');
  a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>';
  bar.appendChild(a);
})();
```

- [ ] **Step 7: Add head tags and the script to the five pages**

In each of `static/index.html`, `checkin.html`, `vitals.html`, `dashboard.html`, `data.html`, directly after the `<meta name="viewport" ...>` line:

```html
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="apple-touch-icon" href="/icons/icon-180.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="Coach">
  <meta name="theme-color" content="#ffffff">
```

and directly before `</body>`:

```html
<script src="/js/app-shell.js"></script>
```

`tests/checkin-load.test.cjs` and other page tests extract the *first* inline `<script>` without `src`; check they still pass (they match `<script>([\s\S]*?)<\/script>`, which does not match `<script src=...>`).

- [ ] **Step 8: Run** `npm test` → PASS.

- [ ] **Step 9: Commit**

```bash
git add scripts static/icons static/manifest.webmanifest static/sw.js static/js/app-shell.js static/*.html tests/pwa.test.cjs
git commit -m "feat: installable PWA shell with service worker and Profile icon"
```

---

### Task 9: Profile page

**Files:**
- Create: `static/js/push-status.js`, `static/profile.html`, `tests/push-status.test.cjs`
- Modify: `tests/no-danish.test.cjs` (add `'profile'`), `tests/pwa.test.cjs` (add `'profile'` back to `PAGES`)

**Interfaces:**
- Consumes: `GET/POST/DELETE /api/push-subscribe`, `POST /api/push-test` (Task 6), `app-shell.js` (Task 8).
- Produces: `notificationStatus({ supported, standalone, ios, permission, browserEndpoint, serverEndpoint }) → 'on'|'off'|'install'|'unsupported'|'blocked'`, and `STATUS_TEXT` (status → English sentence).

- [ ] **Step 1: Write the failing test** `tests/push-status.test.cjs`

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { notificationStatus, STATUS_TEXT } = require('../static/js/push-status.js');

const base = { supported: true, standalone: true, ios: true, permission: 'granted', browserEndpoint: 'https://e/1', serverEndpoint: 'https://e/1' };

test('on only when the browser and the server have the same subscription', () => {
  assert.equal(notificationStatus(base), 'on');
  assert.equal(notificationStatus({ ...base, serverEndpoint: null }), 'off');
  assert.equal(notificationStatus({ ...base, serverEndpoint: 'https://e/old' }), 'off');
  assert.equal(notificationStatus({ ...base, browserEndpoint: null }), 'off');
});

test('iPhone Safari outside the Home Screen app must install first', () => {
  assert.equal(notificationStatus({ ...base, supported: false, standalone: false }), 'install');
  assert.equal(notificationStatus({ ...base, supported: false, ios: false, standalone: false }), 'unsupported');
});

test('denied permission is blocked', () => {
  assert.equal(notificationStatus({ ...base, permission: 'denied' }), 'blocked');
});

test('every status has English text', () => {
  for (const s of ['on', 'off', 'install', 'unsupported', 'blocked']) assert.equal(typeof STATUS_TEXT[s], 'string');
});
```

- [ ] **Step 2: Run it**: `node --test tests/push-status.test.cjs` → FAIL.

- [ ] **Step 3: Create `static/js/push-status.js`**

```js
// Notification status shown on the Profile page.
// Loaded as a classic <script> in the browser and required by the Node tests.
(function (root) {
  function notificationStatus({ supported, standalone, ios, permission, browserEndpoint, serverEndpoint }) {
    if (!supported) return ios && !standalone ? 'install' : 'unsupported';
    if (permission === 'denied') return 'blocked';
    return browserEndpoint && browserEndpoint === serverEndpoint ? 'on' : 'off';
  }

  const STATUS_TEXT = {
    on:          'On. You get a notification every morning.',
    off:         'Off.',
    install:     'Add Coach to your Home Screen first: tap Share, then Add to Home Screen, and open it from there.',
    unsupported: 'This browser does not support notifications.',
    blocked:     'Blocked. Allow notifications for Coach in iOS Settings → Notifications.',
  };

  Object.assign(root, { notificationStatus, STATUS_TEXT });
  if (typeof module !== 'undefined') module.exports = { notificationStatus, STATUS_TEXT };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Create `static/profile.html`**

Copy `<head>` base styles (`*`, `body`, `.topbar`, `.topbar-title`, `.card`, `.card-title`, `.bottombar*`) verbatim from `static/checkin.html`, and its whole `<div class="bottombar">…</div>` with no `class="active"` on any link. Page body:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="apple-touch-icon" href="/icons/icon-180.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="Coach">
  <meta name="theme-color" content="#ffffff">
  <title>Profile</title>
  <style>
    /* (base styles copied from checkin.html) */
    .notif-status { font-size: 14px; color: #1c1c1e; line-height: 1.4; margin-bottom: 12px; }
    .notif-btn { width: 100%; padding: 13px; font-size: 16px; font-weight: 700; border: none; border-radius: 12px; color: #fff; background: #007aff; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .notif-btn.secondary { margin-top: 8px; background: #f2f2f7; color: #007aff; }
    .notif-btn:disabled { background: #aeaeb2; color: #fff; cursor: default; }
    .notif-msg { text-align: center; font-size: 13px; margin-top: 8px; min-height: 18px; color: #8e8e93; }
    .notif-msg.err { color: #ff3b30; }
  </style>
</head>
<body>
  <div class="topbar"><div class="topbar-title">Profile</div></div>

  <div class="card">
    <div class="card-title">Notifications</div>
    <div class="notif-status" id="notif-status">Checking…</div>
    <button class="notif-btn" id="notif-toggle" style="display:none"></button>
    <button class="notif-btn secondary" id="notif-test" style="display:none">Send test</button>
    <div class="notif-msg" id="notif-msg"></div>
  </div>

  <!-- (bottombar copied from checkin.html, no active tab) -->

<script src="/js/push-status.js"></script>
<script>
const $=id=>document.getElementById(id);
let _publicKey=null,_serverEndpoint=null,_status=null;

function b64ToBytes(b64){const p='='.repeat((4-b64.length%4)%4);const s=atob((b64+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(s,c=>c.charCodeAt(0));}
const supported=()=>'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const msg=(t,err=false)=>{$('notif-msg').textContent=t;$('notif-msg').className='notif-msg'+(err?' err':'');};

async function browserSubscription(){
  if(!supported())return null;
  const reg=await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function refresh(){
  try{
    const r=await fetch('/api/push-subscribe');
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||r.status);
    _publicKey=d.publicKey;_serverEndpoint=d.endpoint;
  }catch(e){$('notif-status').textContent='Notifications are not set up on the server ('+e.message+').';return;}
  const sub=await browserSubscription().catch(()=>null);
  _status=notificationStatus({
    supported:supported(),
    standalone:window.navigator.standalone===true||matchMedia('(display-mode: standalone)').matches,
    ios:/iPhone|iPad|iPod/.test(navigator.userAgent),
    permission:'Notification' in window?Notification.permission:'default',
    browserEndpoint:sub?.endpoint??null,
    serverEndpoint:_serverEndpoint,
  });
  $('notif-status').textContent=STATUS_TEXT[_status];
  const canToggle=_status==='on'||_status==='off';
  $('notif-toggle').style.display=canToggle?'':'none';
  $('notif-toggle').textContent=_status==='on'?'Turn off':'Turn on';
  $('notif-test').style.display=_status==='on'?'':'none';
}

async function turnOn(){
  // requestPermission must run directly in the tap on iOS
  const perm=await Notification.requestPermission();
  if(perm!=='granted'){await refresh();return;}
  const reg=await navigator.serviceWorker.ready;
  const sub=await reg.pushManager.getSubscription()??await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(_publicKey)});
  const r=await fetch('/api/push-subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sub)});
  if(!r.ok)throw new Error('Could not save ('+r.status+')');
}

async function turnOff(){
  const sub=await browserSubscription();
  if(sub)await sub.unsubscribe();
  const r=await fetch('/api/push-subscribe',{method:'DELETE'});
  if(!r.ok)throw new Error('Could not remove ('+r.status+')');
}

$('notif-toggle').addEventListener('click',async()=>{
  const btn=$('notif-toggle');btn.disabled=true;msg('');
  try{await(_status==='on'?turnOff():turnOn());}catch(e){msg(e.message,true);}
  await refresh();btn.disabled=false;
});

$('notif-test').addEventListener('click',async()=>{
  const btn=$('notif-test');btn.disabled=true;msg('Sending…');
  try{
    const r=await fetch('/api/push-test',{method:'POST'});
    if(r.ok)msg('Sent. It should arrive in a few seconds.');
    else{const d=await r.json().catch(()=>({}));msg('Error: '+(d.error||r.status),true);await refresh();}
  }catch{msg('Network error',true);}
  btn.disabled=false;
});

refresh();
</script>
<script src="/js/app-shell.js"></script>
</body>
</html>
```

Add `'profile'` to the page list in `tests/no-danish.test.cjs` and back into `PAGES` in `tests/pwa.test.cjs`.

- [ ] **Step 5: Run** `npm test` → PASS.

- [ ] **Step 6: Commit**

```bash
git add static/js/push-status.js static/profile.html tests/push-status.test.cjs tests/no-danish.test.cjs tests/pwa.test.cjs
git commit -m "feat: Profile page with notification toggle and test"
```

---

### Task 10: Check the setup guide against the code

**Files:**
- Modify (only if something drifted): `docs/web-push-setup.md` (already written, in Danish)

- [ ] **Step 1: Check names and texts.** Every env var name, path (`/api/cron-morning`, `0 7 * * *`), button label (`Turn on`, `Send test`) and status/error text quoted in `docs/web-push-setup.md` must match the code from Tasks 5–9 exactly. Run:

```bash
grep -o "VAPID_[A-Z_]*\|CRON_SECRET\|BLOB_STORE_ID" docs/web-push-setup.md | sort -u
grep -rho "VAPID_[A-Z_]*\|CRON_SECRET" api | sort -u
```

Expected: the second list is a subset of the first. Fix the guide (not the code) for any quoted UI text that differs.

- [ ] **Step 2: Run** `npm test` → PASS.

- [ ] **Step 3: Commit** (only if the guide changed)

```bash
git add docs/web-push-setup.md
git commit -m "docs: sync web push setup guide with the code"
```
