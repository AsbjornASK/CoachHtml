# data.html i samme design som Dashboard: fælles graf-modul

**Dato:** 2026-09-30
**Status:** Design godkendt i chat, afventer review af spec

## Formål

Desktop-siden `data.html` har stadig sine egne, ældre kopier af graferne:
- linjer mellem målinger
- små punkter og 9 px akser
- blandede datoformater
- hårdkodede farver

Den skal have samme design som Dashboard: x- og y-akser, farver og datoer. Dashboard og data.html skal fremover bruge **de samme graf-funktioner**, så designet ikke glider fra hinanden igen. data.html viser flere datapunkter end Dashboard.

## Fælles graf-modul: `static/js/charts.js`

Graf-koden flyttes fra `static/dashboard.html` til ét modul. Modulet indlæses som almindeligt `<script>` i browseren (globale navne) og med `require` i Node-testene, efter samme mønster som `static/js/wellness-labels.js`. Det kræver `wellness-labels.js`.

Modulet indeholder:
- **Konstanter:** `DOT_R` (6), `AXIS_FS` (12), `DAY_MS`, `PARTNER_COL`, `ALONE_COL`, `PARTNER_METRICS`, `CAT_META`, `CAT_KEYS`, `HRV_NORM_DAYS` (42).
- **Formatering:** `fmtN`, `fmtDate`, `fmtDM`, `isoDaysBefore`.
- **Tidslinje:** `lastDays(series, today, n)`, `timelineX(i, n, layout)`, `timelineLabels(days, y, layout)`.
- **Legende:** `wellnessLegend(title, field)`.
- **Grafer:**
  - `hrvCheckinChart(days, layout)`
  - `sleepMoodChart(days, layout)`
  - `partnerCompare(series, days, layout)`
  - `trendGraph(series, today, opts)`
  - `vo2Summary(series, today, days)`
  - `hrvCalStressChart(days, series, bands, layout)`
  - samt `hrvLevel`, `hrvNormMark`, `hrvIcon`

### Bredde (layout)

De fælles grafer tager et `layout`-objekt `{ W, PDL, PDR }`. Dashboard bruger `{ W: 500, PDL: 46, PDR: 12 }`, som giver det nuværende udseende. data.html bruger en bredere viewBox (`W: 900`), så 12 px-teksten ikke skaleres op på de brede desktop-kort. Uden `layout` bruges Dashboards værdier.

`hrvCalStressChart` beholder sin egen smal/bred-logik (`window.innerWidth < 600`).

## Dashboard (`static/dashboard.html`)

- Indlæser `wellness-labels.js` og `charts.js`.
- Beholder kun de sidespecifikke dele:
  - `render`
  - perioderne: `TIMELINE_DAYS` = 10, `WEIGHT_WINDOW` = 21, `VO2_WINDOW` = 30, `WEIGHT_RANGE`, `VO2_RANGE`, `VO2_COLOR`
  - boot-koden
- **Intet synligt ændres.** Resultatet skal være tegn-for-tegn det samme som før for de samme data.

## data.html

Indlæser `wellness-labels.js` og `charts.js` og bruger de fælles grafer med flere datapunkter:

| Graf | Periode |
|---|---|
| HRV · Calendar · Stress | 14 dage |
| HRV × Fatigue, Sleep × Mood, Partner vs. alone | 30 dage, fælles tidslinje (`lastDays(series, today, 30)`) |
| Weight over time, VO₂ max over time | 90 dage (samme faste y-akser og VO₂ max-farve som Dashboard) |

`/api/get-dashboard` sender allerede 90 dage i `series` og `hrvBands`, så der er ikke brug for nye API-kald.

### data.html-grafer, der bliver, i nyt design

Fælles regler: aksetekst `AXIS_FS` (12 px), datoer via `fmtDM` på x-aksen og `fmtDate` i tooltips, og farver fra `WELLNESS_COLORS`. Ingen hårdkodede farver for wellness-værdier.

- **KPI-kort (CTL, ATL, TSB, HRV):** beholdes. De bruger samme farver (`WELLNESS_COLORS`, blå `#007aff`) og skrift som resten.
- **Fitness & Form** (samlet, Run og Strength):
  - linjerne beholdes, fordi CTL, ATL og TSB er løbende gennemsnit
  - x-aksen er 30-dages tidslinjen med d/m-datoer
  - akser er 12 px
  - mood-prikkerne har r = `DOT_R` og mood-farver
- **Calendar load & SDNN** (`calendarLoadChart`):
  - SDNN vises som punkter uden forbindende linjer, r = `DOT_R`
  - kalenderkategorier bruger `CAT_META`-farverne
  - akser er 12 px med d/m-datoer
- **Scatter-plots** (TSB vs. Mood, Sleep vs. Mood): punkter med r = `DOT_R`, farvet efter mood via `WELLNESS_COLORS`, og akser på 12 px.
- **Check-in-historik og indsigter:** datoer via `fmtDate`, og chip-farverne afledt af `WELLNESS_COLORS`.

Legender på data.html bygges med `wellnessLegend`, og "Avg/Low" slås ikke længere sammen.

## Fjernes

- **Dashboard:** graf-koden, der flyttes til `charts.js`, så der ikke er dubletter.
- **data.html:**
  - de gamle kopier af `hrvCheckinChart`, `sleepMoodChart`, `fmtDate`, `fmtN` og `r1`
  - legender og farvekonstanter, der er erstattet af modulet
  - `chipClass`, hvis chip-farverne afledes direkte
  - `sdnnStressChart` og `calHrvScatter`, som ikke vises nogen steder i dag (død kode)

## Fejlhåndtering

Uændret: hver graf viser sin egen "Not enough …"-besked ved for få data, og siden viser fejlkortet, hvis `/api/get-dashboard` fejler. data.html fortsætter med at hente `/api/get-sport-load` til Run- og Strength-Form.

## Test

- **Eksisterende Dashboard-tests** (`dashboard-trends`, `hrv-bands`) læser funktionerne direkte fra `static/js/charts.js` med `require` i stedet for at trække dem ud af HTML'en med regex. Alle eksisterende forventninger skal stadig holde, og tallene bekræfter, at Dashboard er uændret.
- **Nye tests:**
  - `layout`: samme tidslinje med `W: 900` giver datoer på de skalerede positioner, og standard-layoutet giver Dashboards nuværende positioner
  - data.html bruger 30-, 14- og 90-dages perioderne (kildetjek af `render`)
  - omlagte data.html-grafer: ingen linjer mellem SDNN-målinger i Calendar load, `DOT_R` i scatter-plots, `AXIS_FS` på akserne, `wellnessLegend` uden "Avg/Low"
  - ingen dansk tekst på nogen side (findes allerede)
- **Manuelt:** syntakstjek af alle sider, og en tekstopsummering af data.html-graferne med rigtige data. Ingen forhåndsvisning, medmindre du beder om det.
