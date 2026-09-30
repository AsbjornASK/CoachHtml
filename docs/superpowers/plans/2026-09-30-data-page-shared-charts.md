# data.html Shared Charts Implementation Plan

> **For agentic workers:** executed natively (superpowers:executing-plans). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move the Dashboard's chart code into `static/js/charts.js` and use it on data.html with more data points, restyling data.html's remaining charts to the same design.

**Architecture:** One UMD-style module (browser globals + `module.exports`, like `static/js/wellness-labels.js`). Timeline charts take an optional `layout` (`{ W, PDL, PDR }`), defaulting to today's Dashboard values. Pages keep only `render`, their periods and boot code.

**Tech Stack:** vanilla JS/SVG strings, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-30-data-page-shared-charts-design.md`

## Global Constraints
- Dashboard output must stay byte-identical for the same data. The before snapshot is `scratchpad/snap-before.txt` (made with `scratchpad/dash-snapshot.cjs` and the real data in `dash-fixed.json`).
- English UI only. No previews or mockups (CLAUDE.md). No commits unless the user asks (CLAUDE.md: `/simplify` and `/code-review` first).
- Axis text uses `AXIS_FS` (12), dots use `DOT_R` (6), dates use `fmtDM`/`fmtDate`, and wellness colours come from `WELLNESS_COLORS`.

## Review Focus
1. **Dashboard regressions:** any character difference against `snap-before.txt`.
2. **data.html with a partial API response:** a missing `/api/get-sport-load` still renders everything except Run/Strength Form.
3. **Wide layout (`W: 900`):** labels must not be clipped and dots must line up across the 30-day charts.
4. **Scripts on each page:** `charts.js` must load after `wellness-labels.js`, since it uses `WELLNESS`, on both pages.
5. **Dead code:** nothing left on data.html referencing removed helpers (`chipClass`, `r1`, old legends, `sdnnStressChart`, `calHrvScatter`).

---

### Task 1: Create `static/js/charts.js`; Dashboard uses it (no visible change)
**Files:** create `static/js/charts.js`; modify `static/dashboard.html` and `tests/dashboard-trends.test.cjs`, `tests/hrv-bands.test.cjs`.
- [ ] Move the shared constants and functions listed in the spec out of dashboard.html into charts.js, adding a `layout` parameter to `timelineX`/`timelineLabels` and the three timeline charts (default `{ W: 500, PDL: 46, PDR: 12 }`).
- [ ] Add a test in `tests/charts.test.cjs` (RED first): `timelineX(0, 10)` = 46 and `timelineX(9, 10)` = 488 by default; with `{ W: 900, PDL: 46, PDR: 12 }` the last position is 888.
- [ ] Switch the Dashboard tests to `require('../static/js/charts.js')` instead of extracting from HTML.
- [ ] Verify: `node --test "tests/*.test.cjs"` is green, and `dash-snapshot.cjs … static/js/charts.js` produces output identical to `snap-before.txt`.

### Task 2: data.html uses the shared charts with more data points
**Files:** modify `static/data.html` and `tests/data-page.test.cjs` (new).
- [ ] RED test (source check): data.html loads `wellness-labels.js` then `charts.js`, and its render calls `hrvCalStressChart(lastDays(series, today, 14)…`, `lastDays(series, today, 30)` for HRV/Sleep/Partner with the wide layout, and `trendGraph` for weight/VO₂ max with 90 days.
- [ ] Replace data.html's HRV over time and Sleep over time cards with the shared charts, and add the HRV · Calendar · Stress, Partner vs. alone, Weight and VO₂ max cards. Remove the old copies and duplicate helpers.
- [ ] Verify: tests are green and all pages pass `node --check`.

### Task 3: Restyle data.html's own charts and remove its dead charts
**Files:** modify `static/data.html` and `tests/data-page.test.cjs`.
- [ ] RED tests on the rendered SVG of each kept chart:
  - Fitness & Form (overall, Run, Strength): axis `font-size="12"`, d/m ticks, mood dots `r="6"`
  - Calendar load: SDNN dots `r="6"` with no SDNN polyline or line segments
  - scatters: dots `r="6"`, axes 12 px
  - legends use `wellnessLegend` (no "Avg/Low")
- [ ] Implement using `AXIS_FS`, `DOT_R`, `fmtDM`, `fmtDate`, `WELLNESS_COLORS` and `wellnessLegend`. KPI cards and check-in table use module colours. Delete `sdnnStressChart` and `calHrvScatter`.
- [ ] Verify: tests are green; syntax checks pass; a text summary of data.html with real data has no empty or broken chart.

### Task 4: Final verification and review
- [ ] Full suite, syntax checks, Dashboard snapshot comparison.
- [ ] Whole-change review by a fresh reviewer against this plan's Review Focus. Fix Critical/Important issues test-first.
- [ ] Report to the user. No commit.
