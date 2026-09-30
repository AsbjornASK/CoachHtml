# data.html: kategorier i faner og en ny Sessions-fane

**Dato:** 2026-09-30
**Status:** Design godkendt i chat, afventer review af spec

## Formål

data.html (desktop-oversigten) er for rodet: 17 kort står i én lang række uden overskrifter. Siden skal deles op i **faner efter kategori**, så man ser ét emne ad gangen.

Brugeren vil også kunne se **hvor hårdt der er trænet** i forhold til recovery. Det gøres med tre nye grafer i en ny fane, **Sessions**.

En spike (2026-09-30) viste:
- Intervals.icu har belastning, tid, gennemsnitspuls, minutter pr. pulszone og RPE på de fleste pas. RPE findes på 47 af 74 pas.
- Sammenhængen mellem hård træning og recovery dagen efter er svag og forstyrret, fordi brugeren træner hårdt på friske dage.

Graferne *viser* derfor data, som brugeren selv kan aflæse, og recovery måles i forhold til brugerens egen norm. Der beregnes ikke korrelationer.

## Faner

Under topbaren kommer en fanerække: **Recovery · Training · Sessions · Body · Life load · Patterns**. Man ser én fane ad gangen.

| Fane | Kort (samme grafer som i dag, kun flyttet, undtagen Sessions) |
|---|---|
| Recovery | HRV · Calendar · Stress, HRV × Fatigue, Sleep × Mood, Partner vs. alone |
| Training | KPI-kort (CTL/ATL/TSB/HRV), Fitness & Form, Run og Strength |
| Sessions | **Load × Day HRV**, **RPE × heart rate**, **Heart-rate zones per week** (nye) |
| Body | Weight, VO₂ max |
| Life load | Calendar load & SDNN |
| Patterns | Indsigter (flyttes ud af Fitness & Form-kortet), check-in-historik, TSB vs Mood, Sleep vs Mood |

- Alle faner bygges ved indlæsning. Et klik skifter kun, hvilken fane der vises, så der er ingen nye kald.
- **Recovery** er standard. Den valgte fane gemmes i `localStorage` under nøglen `dataTab`. Ved ukendt værdi, blokeret lagring eller fejl bruges Recovery.
- Fanerne har samme segment-stil som Training-fanerne på Coach (grå baggrund, valgt fane som hvid pille). Stilen ligger i data.html's egen `<style>`, fordi det er side-UI og ikke en graf.

## Data: `sessions` fra `/api/get-sport-load`

API'et henter allerede 200 dages aktiviteter. Det får nyt felt `sessions` med pas fra de **seneste 90 dage**, ældste først:

```js
sessions: [{
  date: 'YYYY-MM-DD',                  // start_date_local
  sport: 'run' | 'strength' | 'ride' | 'other',
  load: number | null,                 // icu_training_load
  minutes: number | null,              // moving_time / 60, 1 decimal
  avgHr: number | null,                // average_heartrate
  rpe: number | null,                  // icu_rpe (1–10)
  zones: { easy, moderate, hard } | null   // minutes: Z1+Z2, Z3, Z4 and above (icu_hr_zone_times)
}]
```

- Beregningen ligger som ren funktion `sessionsOf(activities, today, days = 90)` i `api/_lib/sport-load.mjs`.
- Sportsreglerne:
  - `run`: typen indeholder "Run"
  - `strength`: `WeightTraining`
  - `ride`: typen indeholder "Ride"
  - `other`: alt andet
- Aktiviteter uden dato springes over.
- `series` og `baseline` er uændrede.

## Nye grafer (i `static/js/charts.js`)

Alle følger det eksisterende design: `AXIS_FS` (12 px), `DOT_R`, `fmtDM`/`fmtDate`, farver fra modulet og den fælles tidslinje, hvor det giver mening. Sportsfarverne er faste, neutrale og ikke vurderende: `SPORT_COLORS = { run: '#007aff', ride: '#5ac8fa', strength: '#5856d6', other: '#aeaeb2' }`.

1. **`loadHrvChart(days, sessions, series, layout)`: Load × Day HRV**
   - x-aksen er den fælles 30-dages tidslinje (`lastDays`, `WIDE`).
   - En søjle pr. dag med summen af belastning, stablet og farvet efter sport. Venstre y-akse er belastning.
   - Et punkt med **næste morgens** Day HRV (SDNN fra `series` dagen efter), farvet efter `hrvNormMark` (▲ grøn, ▼ orange, grå). Højre y-akse er SDNN i ms.
   - Legende for sportene og ▲/▼.
   - Ingen pas i perioden giver beskeden "No training sessions in the last 30 days".
2. **`rpeHrScatter(sessions, layout)`: RPE × heart rate**
   - Pas med både RPE og gennemsnitspuls: x er gennemsnitspuls (bpm), y er RPE (1–10), punkter farvet efter sport.
   - Med mindst 5 pas tegnes en stiplet grå tendenslinje (mindste kvadraters metode). Undertekst: "Dots above the line felt harder than the heart rate suggests."
   - Færre end 5 pas giver "Not enough sessions with RPE yet".
3. **`zoneWeeksChart(sessions, today, weeks = 12, layout)`: Heart-rate zones per week**
   - En stablet søjle pr. uge (mandag–søndag, de seneste 12 uger) med minutter i easy (Z1–Z2), moderate (Z3) og hard (Z4+). Farverne er `#5ac8fa`, `WELLNESS_COLORS[1]` og `WELLNESS_COLORS[2]`.
   - Over hver søjle står andelen af easy i procent, fx "78 %". En tynd reference-note forklarer: "Goal: about 80 % easy".
   - Uger uden zonedata står tomme med "–".

## data.html-ændringer

- Hent `sessions` fra det eksisterende `/api/get-sport-load`-kald. Mangler det, viser Sessions-graferne deres tomme-beskeder.
- Byg fanerne og placér kortene som i tabellen. Indsigterne får deres eget kort i Patterns.

## Fejlhåndtering

- `/api/get-sport-load` fejler:
  - Training viser "Not enough data" for Run og Strength, som i dag.
  - Sessions-graferne viser deres tomme-beskeder.
  - Resten virker.
- Aktiviteter uden puls, RPE eller zoner udelades fra den graf, der kræver feltet. De kan stadig indgå i de andre.

## Test

- `tests/sport-load-sessions.test.cjs`:
  - `sessionsOf` returnerer 90-dages vinduet sorteret med ældste først.
  - Sport-kategorierne stemmer.
  - Minutter og zoner er rigtigt summeret (easy = Z1+Z2, moderate = Z3, hard = Z4+).
  - Manglende felter bliver `null`.
  - Aktiviteter uden dato springes over.
- `tests/charts-sessions.test.cjs`:
  - `loadHrvChart`: søjler pr. dag stablet efter sport, SDNN-punkt fra dagen efter med ▲/▼-farve, og tomme-beskeden.
  - `rpeHrScatter`: punkter kun for pas med RPE og puls, tendenslinje fra 5 pas, og beskeden under 5.
  - `zoneWeeksChart`: 12 uger, procent easy, og "–" for uger uden data.
- `tests/data-page.test.cjs` (udvides):
  - de seks faner i rækkefølge, og hvert kort i den rigtige fane
  - kun én fane synlig
  - gemt fane gendannes, og ugyldig eller blokeret lagring giver Recovery
- Hele suiten, syntakstjek og en kørsel af data.html uden browser med rigtige data. Ingen forhåndsvisning, medmindre brugeren beder om det.
