# Web push-notifikationer og Profil-side

**Dato:** 2026-10-05
**Status:** Design godkendt i chat, afventer review af spec
**Branch:** `feature/web-push` (bygger oven på `feature/coach-page-structure` / PR #8)

## Formål

Appen skal give én notifikation hver morgen på brugerens iPhone, så morgenflowet ikke afhænger af, at appen bliver åbnet:

- **Ikke tjekket ind** → påmindelse om at tjekke ind.
- **Tjekket ind** → dagens Readiness og dagens planlagte træning.
- **Vægt eller body composition forældet** → advarslen lægges med i samme besked.

Notifikationer slås til og fra på en ny **Profil-side**.

### Rammer

| | |
|---|---|
| Enhed | Kun iPhone (iOS 16.4+). Push virker kun, når appen er føjet til hjemmeskærmen. |
| Brugere | Én bruger, én subscription. |
| Tidspunkt | Én Vercel Cron om dagen, `0 7 * * *` (UTC): ca. kl. 9 om sommeren, ca. kl. 8 om vinteren. På Hobby kan den komme op til en time senere. |
| Lagring | Vercel Blob, privat, én fil. |
| Sprog | Engelsk, som resten af UI'et. |

### Uden for scope

- Flere enheder eller brugere.
- Flere notifikationer om dagen, eller en notifikation lige efter check-in.
- AI-genereret anbefalingstekst.
- Andet indhold på Profil-siden end notifikationer.

## Sider

### Profil: `static/profile.html` (ny)

Åbnes fra et person-ikon øverst til højre i topbaren på alle sider med en topbar (Check-in, Coach, Vitals, Dashboard, Data). Ikonet indsættes af et fælles script, `static/js/app-shell.js`, så sidernes markup ikke skal ændres. Bundbaren er uændret. Profil-siden har samme topbar og bundbar som de andre mobilsider, uden aktiv fane.

Ét kort, **Notifications**, med:

- **Status**, en af:
  - *On*: der findes en subscription i browseren, og serveren har den samme (`endpoint` fra `GET /api/push-subscribe` er det samme).
  - *Off*: understøttet, men ikke slået til.
  - *Add to Home Screen first*: iPhone i Safari uden for den installerede app (`navigator.standalone !== true` og ingen `PushManager`).
  - *Not supported*: ingen service worker eller `PushManager`.
  - *Blocked*: `Notification.permission === 'denied'`. Teksten forklarer, at det slås til igen under iOS-indstillinger.
- **Til/fra-knap**:
  - Til: `Notification.requestPermission()` (skal ske direkte i klikket), `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, `POST /api/push-subscribe`.
  - Fra: `subscription.unsubscribe()` og `DELETE /api/push-subscribe`.
- **Send test**: `POST /api/push-test`. Vises kun, når status er *On*. Resultatet vises som tekst under knappen.

Den offentlige VAPID-nøgle og den gemte subscriptions `endpoint` hentes fra `GET /api/push-subscribe`, så nøglen kun står ét sted (env var).

### Alle sider

- `<link rel="manifest" href="/manifest.webmanifest">`, `apple-touch-icon`, `apple-mobile-web-app-capable` og `theme-color` i `<head>`.
- `<script src="/js/app-shell.js"></script>` sidst i `<body>`. Scriptet registrerer service workeren (`/sw.js`), så den er aktiv, uanset hvilken side appen åbnes på, og indsætter person-ikonet (inline SVG) i `.topbar`.

### Coach og Vitals: `static/index.html`, `static/vitals.html`

Readiness-beregningen (som i dag står ens i begge filer) flyttes til et delt modul (se nedenfor). Siderne viser de samme tal som før.

## PWA

- **`static/manifest.webmanifest`**: `name: "Coach"`, `start_url: "/"`, `display: "standalone"`, baggrund og `theme_color` som appens topbar, ikoner 192 og 512 px.
- **Ikoner**: `static/icons/icon-180.png` (apple-touch-icon), `icon-192.png`, `icon-512.png`. Der findes ingen ikoner i dag, så de genereres af et lille Node-script (`scripts/make-icons.cjs`, kun `zlib`) som en farvet flade med et simpelt symbol. De kan skiftes ud senere.
- **`static/sw.js`**:
  - `push`: læser `{ title, body, url }` fra payloaden og kalder `showNotification(title, { body, data: { url }, icon })`.
  - `notificationclick`: lukker notifikationen og fokuserer et åbent vindue med `url`, ellers åbnes et nyt.
  - Ingen caching eller offline-funktion.

## API

### `api/push-subscribe.mjs` (ny)

| Metode | Gør |
|---|---|
| `GET` | Returnerer `{ publicKey, endpoint }`: `VAPID_PUBLIC_KEY` og den gemte subscriptions `endpoint` (eller `null`). `500`, hvis `VAPID_PUBLIC_KEY` mangler. |
| `POST` | Validerer, at body har `endpoint` (https) og `keys.p256dh` og `keys.auth`. Gemmer som `push/subscription.json` i Vercel Blob (privat, overskriver). |
| `DELETE` | Sletter `push/subscription.json`. |

Endpointet kræver ikke login, ligesom resten af API'et. Nogen kan derfor overskrive eller slette subscriptionen og selv modtage morgenbeskeden (Readiness og dagens pas). Det er samme data, som `get-coach` og `get-calendar` allerede udleverer uden login. `endpoint` skal ligge hos en kendt push-tjeneste (Apple, Google, Mozilla, Microsoft), så cron'en ikke kan bruges til at kalde vilkårlige adresser.

### `api/push-test.mjs` (ny)

`POST`: henter subscriptionen og sender `{ title: "Coach", body: "Test notification ✓", url: "/profile.html" }`. Svarer `404`, hvis der ingen subscription er.

### `api/cron-morning.mjs` (ny)

`GET`, kaldt af Vercel Cron:

1. Afviser med `401`, hvis `Authorization` ikke er `Bearer ${CRON_SECRET}`.
2. Henter subscriptionen. Findes den ikke, svares `200 { sent: false, reason: "no subscription" }`.
3. Henter Coach-data, sidste vægt og body-comp-dato og dagens kalender parallelt.
4. Bygger beskeden med `morningMessage(...)` og sender den.
5. Svarer push-tjenesten `404` eller `410`, slettes subscriptionen.

### Delte server-moduler

- **`api/_lib/coach-data.mjs`**: det objekt, `get-coach.mjs` bygger i dag, flyttes til den rene funktion `coachData(days, activities, end)`. `get-coach.mjs` henter som før og returnerer `json(coachData(...))`. Den er uændret udadtil.
- **`api/_lib/intervals.mjs`**: ny `freshnessDates(days)` → `{ lastWeightDate, lastBodyCompDate }`, flyttet fra `get-vitals.mjs`, som både `get-vitals` og cron'en bruger. Cron'en henter 21 dages wellness én gang og bruger dagene til både `coachData` og `freshnessDates`.
- **`api/_lib/calendar.mjs`**: ny funktion `calendarEvents(today)` med den hentning, filtrering og sortering, `get-calendar.mjs` laver i dag. `get-calendar` bruger den og er uændret udadtil. Cron'en tager dagens events derfra. Er der ingen kalendere sat op, er listen tom.
- **`api/_lib/push.mjs`**: `readSubscription()`, `saveSubscription()`, `deleteSubscription()` (Vercel Blob) og `sendPush(subscription, payload)` (`web-push`, VAPID fra env). Returnerer `{ ok, gone }`, hvor `gone` betyder 404 eller 410.
- **`api/_lib/morning-message.mjs`**: ren funktion, se nedenfor.

### Delte klient- og server-moduler

Samme mønster som `wellness-labels.js`: klassisk `<script>` i browseren og `require` i Node (via `createRequire` i `.mjs`).

- **`static/js/readiness.js`** (ny): `BL`, `calcRecovery`, `calcSleep`, `calcSubjectiveScore`, `calcReadiness`, `verdictColor` flyttes uændret fra `index.html`.
- **`static/js/checkin-state.js`**: `hasCheckinValues` genbruges uændret.
- **`static/js/data-freshness.js`**: `freshnessWarnings` genbruges. Ny `warningText(w)` giver advarslens tekst, så Check-in-siden og notifikationen skriver det samme.
- **`static/js/app-shell.js`** (ny): registrerer service workeren og indsætter Profil-ikonet.
- **`static/js/push-status.js`** (ny): den rene statusfunktion til Profil-siden.

## Morgenbeskeden

`morningMessage({ coach, lastWeightDate, lastBodyCompDate, todayEvents, today })` returnerer `{ title, body, url }`.

| Situation | Titel | Tekst | `url` |
|---|---|---|---|
| Ikke tjekket ind (`!hasCheckinValues(coach.subjective)`) | `Morning check-in` | `You haven't checked in yet.` | `/checkin.html` |
| Tjekket ind, Readiness kan beregnes | `Readiness 72 🟢` | `Today: <titel> <hh:mm>` for hvert træningsevent, adskilt af ` · `, eller `Rest day` | `/` |
| Tjekket ind, Readiness mangler (HRV eller søvn mangler) | `Readiness –` | som ovenfor | `/` |
| Intervals kunne ikke nås | `Good morning` | `Open Coach for today's readiness.` | `/` |

- Farven følger `verdictColor`: 🟢 (≥ 65), 🟡 (≥ 45), 🔴.
- Træningsevents er dagens events med `category === 'training'`, sorteret efter starttid, som på Coach-siden.
- Advarsler fra `freshnessWarnings(...)` tilføjes som ekstra linjer, fx `⚠ Weight not logged for 10 days`, med samme tekst som Check-in-siden.

## Konfiguration

- **`package.json`** (ny): afhængigheder `web-push` og `@vercel/blob`, og script `"test": "node --test \"tests/*.test.*\""`. `"type"` sættes ikke, fordi API-filerne er `.mjs` og testene `.cjs`.
- **`vercel.json`**: `"crons": [{ "path": "/api/cron-morning", "schedule": "0 7 * * *" }]`.
- **Env vars**:
  - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`: genereres én gang med `npx web-push generate-vapid-keys`.
  - `VAPID_SUBJECT`: `mailto:` med brugerens e-mail.
  - `CRON_SECRET`: tilfældig streng. Vercel sender den automatisk til cron-kald.
  - `BLOB_STORE_ID`: kommer automatisk, når en privat Blob store forbindes til projektet. Adgang sker med Vercels OIDC, så der er intet token at sætte.

Manuelle trin for brugeren: oprette Blob store og forbinde den, sætte de fire env vars, deploye og føje appen til hjemmeskærmen på iPhone.

## Test

Node-tests (`node --test`), med falske `fetch`, Blob og `web-push`:

- **`readiness.js`**: de flyttede funktioner giver samme tal som før for et par faste input.
- **`morning-message`**: alle fire situationer, Rest day, flere pas og med og uden advarsler.
- **`cron-morning`**: forkert eller manglende secret giver 401, ingen subscription sender intet, gyldig subscription sender én push med den rigtige payload, svar 410 sletter subscriptionen.
- **`push-subscribe`**: `GET` returnerer nøglen, `POST` afviser ugyldig body og gemmer gyldig, `DELETE` sletter.
- **`get-coach` / `get-vitals`**: de eksisterende tests består uændret efter udtrækningen.
- **Profil-siden**: statuslogikken (on, off, add to home screen, not supported, blocked) testes med en stub-DOM, som `checkin-load.test.cjs` gør.

Manuelt efter deploy: Profil → slå til → **Send test** på iPhone. Push kan ikke testes med `vercel dev` på iPhone, fordi det kræver HTTPS og den installerede app.
