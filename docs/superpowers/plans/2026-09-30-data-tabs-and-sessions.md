# data.html Tabs + Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split data.html into six category tabs and add a Sessions tab with three charts that relate training hardness to recovery.

**Architecture:** `/api/get-sport-load` gains `sessions` (last 90 days of activities, computed by a pure `sessionsOf` in `api/_lib/sport-load.mjs`). Three new chart functions go into `static/js/charts.js`. data.html builds all tabs up front and toggles visibility, remembering the tab in `localStorage`.

**Tech Stack:** vanilla JS/SVG strings, Vercel Node functions (`.mjs`), `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-30-data-tabs-and-sessions-design.md`

## Global Constraints
- English UI text only (the `tests/no-danish.test.cjs` check covers all pages).
- Chart design: axis text `AXIS_FS` (12), dots `DOT_R` (6), dates via `fmtDM`/`fmtDate`, wellness colours via `WELLNESS_COLORS`. Sport colours are `SPORT_COLORS = { run: '#007aff', ride: '#5ac8fa', strength: '#5856d6', other: '#aeaeb2' }`.
- The Dashboard must stay byte-identical. Check with `scratchpad/dash-snapshot.cjs` against `snap-before.txt`. No existing chart function changes behaviour.
- No previews or mockups; no commits unless the user asks (CLAUDE.md).

## Review Focus
1. **Days with several sessions of different sports:** bars must stack correctly and the tooltip must list each session.
2. **Next-morning SDNN on the last day** (today has no "next morning"): no dot, no crash.
3. **Weeks crossing the 90-day window edge and ISO week start (Monday):** weekly zone totals must be correct, and the oldest week may be partial.
4. **Blocked or throwing `localStorage`** (private mode): the page still renders and falls back to Recovery.
5. **RPE without heart rate, or heart rate without RPE:** such sessions are excluded from the scatter only.

---

### Task 1: `sessionsOf` in the API
**Files:**
- Modify: `api/_lib/sport-load.mjs`, `api/get-sport-load.mjs`
- Test: `tests/sport-load-sessions.test.cjs`

**Interfaces:**
- Produces: `sessionsOf(activities, today, days = 90) → [{ date, sport, load, minutes, avgHr, rpe, zones: {easy, moderate, hard} | null }]`, sorted oldest first. `GET /api/get-sport-load` returns `{ today, series, baseline, sessions }`.

- [ ] **Step 1:** Write the tests (dynamic `import('../api/_lib/sport-load.mjs')`):
  - window: 90 days, oldest first
  - `sport`: 'TrailRun' → run, 'WeightTraining' → strength, 'VirtualRide' → ride, 'Walk' → other
  - `minutes` is `moving_time / 60` with 1 decimal
  - `zones`: `[600,300,120,60,30,0,0]` seconds → `{ easy: 15, moderate: 2, hard: 1.5 }`
  - missing fields → `null`
  - no date → skipped
  - also a source check that `get-sport-load.mjs` returns `sessions`
- [ ] **Step 2:** Run `node --test tests/sport-load-sessions.test.cjs` and expect it to fail (`sessionsOf` is not exported).
- [ ] **Step 3:** Implement `sessionsOf`, export it, and return `sessions: sessionsOf(activities, end)` from the handler.
- [ ] **Step 4:** Run the full suite (green), then run the API locally with `scratchpad/run-api.mjs` and check the session count and fields.

### Task 2: the three chart functions
**Files:**
- Modify: `static/js/charts.js`
- Test: `tests/charts-sessions.test.cjs`

**Interfaces:**
- Consumes: `sessions` from Task 1; `lastDays`, `timelineX`, `timelineLabels`, `hrvNormMark` and `fmtDM` from charts.js.
- Produces:
  - `SPORT_COLORS`
  - `loadHrvChart(days, sessions, series, layout = TL)`
  - `rpeHrScatter(sessions, layout = TL)`
  - `zoneWeeksChart(sessions, today, weeks = 12, layout = TL)`
  - each returns an HTML string (legend + svg, or an empty-state `<p>`)

- [ ] **Step 1:** Write the tests with fixtures:
  - `loadHrvChart`: two sessions on one day render two stacked `<rect class="load-bar">` in the sport colours; the next-day SDNN dot is `class="hrv-next"` with the ▲ colour when above the norm; the last day has no dot; no sessions gives "No training sessions in the last 30 days"
  - `rpeHrScatter`: only sessions with both RPE and heart rate become dots; a dashed trend line (`class="trend"`) from 5 sessions; under 5 gives "Not enough sessions with RPE yet"
  - `zoneWeeksChart`: 12 `class="week"` groups, Monday-based weeks, "78 %" style labels, "–" for empty weeks
  - all charts use `font-size="12"` and no 9/10 px text
- [ ] **Step 2:** Run the tests and expect them to fail (functions not defined).
- [ ] **Step 3:** Implement the three functions and export them.
- [ ] **Step 4:** Run the full suite (green) and confirm the Dashboard snapshot is still identical.

### Task 3: tabs on data.html and the Sessions tab
**Files:**
- Modify: `static/data.html`
- Test: `tests/data-page.test.cjs`

**Interfaces:**
- Consumes: the Task 2 chart functions and `sportData.sessions`.
- Produces: `DATA_TABS = ['recovery','training','sessions','body','life','patterns']` with labels Recovery, Training, Sessions, Body, Life load, Patterns; `<section class="tab-panel" data-tab="…">`; `selectTab(name)`; storage key `dataTab`.

- [ ] **Step 1:** Write the tests:
  - source/render checks for the six tabs in order, and that each card title sits inside the right panel
  - a headless run: only one panel visible; the stored 'body' tab is restored; the stored value 'nonsense' falls back to Recovery; a throwing `localStorage` falls back to Recovery; insights sit in Patterns
- [ ] **Step 2:** Run the tests and expect them to fail.
- [ ] **Step 3:** Implement the tab bar (segment style in data.html's `<style>`), the six panels, the click handler, and saving and restoring the tab with try/catch. Move the insights into their own Patterns card, and add the Sessions panel with the three charts (`lastDays(data.series, today, DATA_DAYS)` and `WIDE`).
- [ ] **Step 4:** Run the full suite, syntax checks, and `scratchpad/run-data-page.cjs` with real data: every tab renders, with no leaks and no small fonts.

### Task 4: verification and review
- [ ] Full suite, syntax checks on all pages, Dashboard snapshot identical.
- [ ] Fresh reviewer on the whole change against the Review Focus above; fix Critical/Important issues test-first.
- [ ] Report to the user. No commit.
