# Morning Health Coach

This project generates and deploys a daily mobile readiness page for:

https://coachhealth.netlify.app/

## Daily run

Follow `MorningAgent.md` exactly.

Each morning:

1. Fetch the required Intervals.icu wellness and workout data.
2. Fetch today's Google Calendar events from the calendars listed in `MorningAgent.md`.
3. Calculate Recovery Score, Sleep Score, and Readiness Score.
4. Generate `index.html` as a static mobile-first iPhone page.
5. Deploy the current folder to Netlify:
   - Site ID: `e7787410-bd7d-4811-9d23-6df9b5a6d28e`
   - URL: `https://coachhealth.netlify.app/`
6. Create or update the 10:00 Google Calendar event in "Fysisk helbred".

## HTML rules

- Do not show fake iPhone chrome: no clock, network, battery, upload/share icon, weather chip, or bottom navigation.
- Use three score rings: Readiness, Recovery, Sleep.
- Readiness ring uses verdict color:
  - green when `readiness >= 65`
  - yellow when `45 <= readiness <= 64`
  - red when `readiness < 45`
- Show all workouts for the day as separate title-only rows.
- Do not put the long 6-point coach text inside the "Dagens pas" card.
- Never expose API tokens, calendar IDs, raw payloads, or private configuration in the deployed HTML.

## Required environment

The runner must have:

- Claude Code authenticated
- Netlify CLI installed
- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID=e7787410-bd7d-4811-9d23-6df9b5a6d28e`
- `MORNING_STATUS_URL=https://coachhealth.netlify.app/`
