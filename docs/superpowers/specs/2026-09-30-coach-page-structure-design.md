# Coach-sidens struktur og ny Check-in-side

**Dato:** 2026-09-30
**Status:** Design godkendt i chat, afventer review af spec

## Formål

Morgenflowet skal følge den rækkefølge, brugeren faktisk tænker i:

1. **Tjek ind**: subjektiv tilstand, stress i går, partner, vægt.
2. **Se, hvordan kroppen har det**: nattens scores og Night physiology.
3. **Se form og belastning**: fitness og Training Load Ratio.
4. **Se dagens træning**: hvad der er planlagt, og om det er gennemført.

Hver side får ét klart ansvar:

| Side | Ansvar |
|---|---|
| **Check-in** (ny) | At tjekke ind og se/rette dagens check-in |
| **Coach** | De værdier, der fortæller, hvordan kroppen har det, og hvad der skal trænes i dag |
| **Vitals** | Alle tallene |
| **Dashboard** | Sammensatte grafer (uændret) |

## Sider

### Check-in: `static/checkin.html` (ny)

- **Morning Check-in-formularen** flytter uændret fra `index.html`: soreness, fatigue, humør, motivation, stress (i går), partner og vægt, med den samme gem-logik via `/api/update-wellness` og den samme localStorage-nøgle `checkin_<YYYY-MM-DD>`.
- **Today's check-in-kortet** flytter fra `vitals.html`: dagens svar i et gitter og noten med autosave (1,5 s efter sidste tastetryk).
- Tilstande:
  - **Ikke tjekket ind i dag:** formularen vises.
  - **Efter gem:** viderestil til `/`.
  - **Allerede tjekket ind** (siden åbnes direkte senere på dagen): formularen skjules, og Today's check-in-kortet vises med noten, som kan redigeres.
- Siden henter sine data fra `/api/get-vitals`. Det endpoint returnerer allerede `todayWellness` og `yesterdayWellness`, så der er ikke brug for et nyt endpoint.

### Coach: `static/index.html`

Siden deles med `.section-header` (samme stil som Vitals) i tre sektioner:

- **Body**
  - Scores: Readiness, Recovery og Sleep-ringene + readiness-historik.
  - Night physiology.
- **Training**
  - Fitness (Overall / Run / Strength-faner).
  - Training Load Ratio.
- **Today**
  - Today's sessions med kalender-status (se nedenfor).
  - Upcoming sessions.

Fjernes fra Coach:
- Morning Check-in-formularen (flyttes til Check-in).
- Match training-kortet og al pair-logik.

**Viderestilling:** når `/api/get-coach` er indlæst, og der hverken er et check-in for i dag i `subjective` (mood, soreness, fatigue eller motivation sat) eller i localStorage `checkin_<dato>`, sendes brugeren videre med `location.replace('/checkin.html')`. `replace` bruges, så tilbage-knappen ikke fører til en tom Coach-side. Fejler datahentningen, sker der ingen viderestilling, og fejlkortet vises som i dag.

### Vitals: `static/vitals.html`

- Today's check-in-kortet og dets note-autosave fjernes (det er flyttet til Check-in).
- Sektionen **Today** indeholder herefter kun Body composition og InBody-importen.

### Navigation

`index.html`, `vitals.html`, `dashboard.html` og `checkin.html` får den samme bundmenu med fire faner:

**Check-in** (flueben-ikon) · **Coach** · **Vitals** · **Dashboard**

Fanen for den aktuelle side markeres med `class="active"`. `data.html` er en desktop-side uden bundmenu og ændres ikke.

## Kalender-status (erstatter Match training)

### Data

`/api/get-coach` henter allerede dagens aktiviteter fra Intervals.icu. I stedet for `pairSuggestions` returnerer endpointet:

```js
activities: [{ type, name }]   // dagens aktiviteter
```

`events` og `pairSuggestions` fjernes fra svaret, og kaldet til `/events` droppes.

### Matchning (i `index.html`)

Kun kalender-events med `category === 'training'` vises under Today's sessions. Hvert event får en sporttype ud fra titlen (der skelnes ikke mellem store og små bogstaver):

| Titlen indeholder | Matcher aktivitetstype |
|---|---|
| `run` | alle typer, der indeholder `Run` |
| `strength` | `WeightTraining` |
| `cykel` eller `ride` | alle typer, der indeholder `Ride` |
| andet | ingen matchning, ingen status vises |

Events behandles i tidsrækkefølge, og hver aktivitet kan kun matche ét event.

### Status

| Status | Betingelse | Visning |
|---|---|---|
| **Done** | Der er en matchende aktivitet | Grøn `✓ Done` |
| **Planned** | Ingen aktivitet, og `timeEnd` er ikke passeret (eller mangler) | Grå `Planned` |
| **Missed** | Ingen aktivitet, og `timeEnd` er passeret (Europe/Copenhagen) | Orange `Missed` |

Er der ingen træningsevents i dag, vises "Rest day" som i dag.

## Fjernes

- `api/pair-event.js`.
- Pair-CSS og pair-click-handleren i `index.html`.
- `_checkinSaved`-flaget i `index.html`, fordi formularen ikke længere ligger der.

## Fejlhåndtering

- Kalender eller aktiviteter mangler (API-fejl): Today's sessions vises uden status, og som i dag vises "Rest day", hvis kalenderen mangler.
- `/api/get-vitals` fejler på Check-in-siden: formularen vises alligevel, da den ikke er afhængig af data, og Today's check-in-kortet udelades.

## Test

Projektet er statisk HTML uden testopsætning, så der testes manuelt på et Vercel preview-deploy. Matchningsfunktionen testes desuden med `node` på eksempeldata.

1. Uden check-in i dag (ryd localStorage) sender `/` videre til `/checkin.html`.
2. Efter gem lander brugeren på `/`, og der sker ingen ny viderestilling.
3. `/checkin.html` åbnet efter check-in viser Today's check-in, og noten gemmes ("Gemt").
4. Coach viser sektionerne Body, Training og Today i den rigtige rækkefølge, og "Work" vises ikke under Today's sessions.
5. En uploadet cykeltur giver `✓ Done` ud for "Cykeltur". Et passeret event uden aktivitet giver `Missed`.
6. Bundmenuen virker fra alle fire sider, og den aktive fane er markeret.
7. Vitals viser ikke længere Today's check-in.
