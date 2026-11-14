# Opsætning af push-notifikationer

Det her skal du selv gøre, efter koden til web push er merget. Følg trinene i rækkefølge. Det tager cirka 15 minutter.

**Før du starter:**

- PR #8 (`feature/coach-page-structure`) og web push-PR'en (`feature/web-push`) er merget til `main`.
- Du har adgang til projektet på [vercel.com](https://vercel.com).
- Du har Node.js på din computer (du kører allerede tests med det).
- Din iPhone kører iOS 16.4 eller nyere: **Indstillinger → Generelt → Om → iOS-version**.

---

## 1. Opret en privat Blob store

Her gemmes din iPhones push-subscription.

1. Gå til [vercel.com](https://vercel.com) og åbn projektet **CoachHtml**.
2. Klik på fanen **Storage** øverst.
3. Klik **Create Database** (eller **Create** → **Blob**).
4. Vælg **Blob**.
5. Navn: `coach-push`. Access: **Private**. Region: den, der ligger tættest på (fx Frankfurt).
6. Klik **Create**.
7. Vercel spørger, hvilket projekt storen skal forbindes til. Vælg **CoachHtml** og sæt flueben ved **Production**, **Preview** og **Development**. Klik **Connect**.

**Tjek:** Under **Settings → Environment Variables** står der nu `BLOB_STORE_ID`. Den skal du ikke røre.

## 2. Lav VAPID-nøgler

VAPID-nøglerne beviser over for Apple, at notifikationerne kommer fra din app.

1. Åbn en terminal i projektmappen (`C:\Users\AsbjørnSchönebergKro\source\repos\CoachHtml`).
2. Kør:

   ```
   npm install
   npx web-push generate-vapid-keys
   ```

3. Den skriver to linjer ud, cirka sådan:

   ```
   Public Key:
   BExxxx...(ca. 87 tegn)
   Private Key:
   xxxx...(ca. 43 tegn)
   ```

4. Kopier begge værdier ind i en midlertidig note. **Den private nøgle må ikke committes eller deles.**

Lav kun nøglerne én gang. Hvis du laver nye senere, holder din nuværende subscription op med at virke, og du skal slå notifikationer til igen på iPhone.

## 3. Lav en CRON_SECRET

Den sikrer, at kun Vercel kan udløse morgen-notifikationen.

Kør i samme terminal:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Kopier den lange streng.

## 4. Sæt miljøvariablerne i Vercel

1. I projektet på Vercel: **Settings** → **Environment Variables**.
2. Tilføj de fire variabler nedenfor, én ad gangen. For hver: skriv **Key** og **Value**, sæt flueben ved **Production** og **Preview**, og klik **Save**.

| Key | Value | Sensitive |
|---|---|---|
| `VAPID_PUBLIC_KEY` | Public Key fra trin 2 | Nej |
| `VAPID_PRIVATE_KEY` | Private Key fra trin 2 | **Ja** |
| `VAPID_SUBJECT` | `mailto:` efterfulgt af din e-mail, fx `mailto:dig@example.com` | Nej |
| `CRON_SECRET` | Strengen fra trin 3 | **Ja** |

Slet den midlertidige note med nøglerne, når de er gemt i Vercel.

## 5. Deploy igen

Nye miljøvariabler virker først i et nyt deploy.

1. Gå til fanen **Deployments**.
2. Find det øverste deploy med mærket **Production**.
3. Klik på de tre prikker (**⋯**) → **Redeploy** → **Redeploy**.
4. Vent til status er **Ready**.

**Tjek:** Under **Settings → Cron Jobs** står der nu `/api/cron-morning` med tidsplanen `0 7 * * *`. Er listen tom, er `vercel.json` ikke kommet med i deployet.

## 6. Føj appen til hjemmeskærmen på iPhone

Push virker kun fra den installerede app, ikke fra Safari.

1. Åbn appens produktions-URL i **Safari** på din iPhone (fx `https://coach-html.vercel.app`; den står øverst på projektsiden i Vercel under **Domains**).
2. Tryk på **Del**-knappen (firkanten med pilen op).
3. Rul ned og tryk **Føj til hjemmeskærm**.
4. Navnet er "Coach". Tryk **Tilføj**.
5. Luk Safari, og **åbn Coach fra ikonet på hjemmeskærmen**. Herfra bruger du appen fremover.

## 7. Slå notifikationer til

1. I Coach-appen (fra hjemmeskærmen): tryk på **person-ikonet** øverst til højre.
2. Under **Notifications** tryk **Turn on**.
3. iPhone spørger, om Coach må sende notifikationer. Tryk **Tillad**.
4. Status skifter til *On*.

## 8. Send en test

1. Tryk **Send test** på Profil-siden.
2. Inden for få sekunder kommer notifikationen "Coach – Test notification ✓".
3. Tryk på den. Profil-siden åbnes.

## 9. Kør morgen-notifikationen manuelt (valgfrit)

Hvis du ikke vil vente til i morgen:

1. På Vercel: **Settings** → **Cron Jobs**.
2. Ud for `/api/cron-morning` klik **Run**.
3. Du får morgenbeskeden med det samme: en påmindelse, hvis du ikke har tjekket ind i dag, og ellers din Readiness og dagens pas.

---

## Hvornår kommer notifikationen?

Cron'en kører 07:00 UTC hver dag:

| Periode | Dansk tid |
|---|---|
| Sommertid (marts–oktober) | ca. kl. 9 |
| Vintertid (oktober–marts) | ca. kl. 8 |

På Vercel Hobby kan den komme op til en time senere end angivet.

## Fejlfinding

| Problem | Løsning |
|---|---|
| Profil viser "Add Coach to your Home Screen first" | Du har åbnet siden i Safari. Åbn appen fra ikonet på hjemmeskærmen (trin 6). |
| Profil viser "Blocked" | **Indstillinger → Notifikationer → Coach** → slå **Tillad notifikationer** til. Åbn appen igen. |
| Profil viser "Notifications are not set up on the server" | `VAPID_PUBLIC_KEY` mangler, eller der er ikke deployet efter trin 4. Gentag trin 4–5. |
| "Send test" giver "Error: Push failed" | Tjek, at `VAPID_PRIVATE_KEY` og `VAPID_SUBJECT` er sat og passer til den offentlige nøgle. Slå notifikationer fra og til igen. |
| "Send test" giver "Error: No subscription" | Blob-storen er ikke forbundet (trin 1), eller subscriptionen er slettet. Tryk **Turn on** igen. |
| Status skifter selv til *Off* | Apple har meldt subscriptionen død (fx efter geninstallation af appen), og serveren har slettet den. Tryk **Turn on** igen. |
| Ingen morgen-notifikation | **Settings → Cron Jobs** → klik på `/api/cron-morning` for at se loggen. `401` betyder, at `CRON_SECRET` mangler. `no subscription` betyder, at du skal slå notifikationer til igen. |
| Notifikationer i lokal udvikling | Virker ikke på iPhone med `vercel dev`, da det kræver HTTPS og den installerede app. Test på det deployede site. |
