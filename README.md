# CoachHtml

Personal training dashboard (React/Vite PWA on Vercel) backed by Intervals.icu, plus a remote MCP server so Claude can read and adjust the same data.

## Intervals MCP server

`POST /api/mcp`: a stateless MCP server (Streamable HTTP, JSON responses) that exposes Intervals.icu as tools.

### Setup

| Environment variable | Purpose |
|---|---|
| `INTERVALS_API_KEY` | Intervals.icu API key (Settings → Developer) |
| `INTERVALS_ATHLETE_ID` | Athlete id, e.g. `i123456` |
| `MCP_SECRET` | Long random value. The endpoint refuses every request without it |

In Claude.ai, go to **Customize → Connectors → + Add → Add custom connector**. Use the URL `https://<domain>/api/mcp?key=<MCP_SECRET>` and choose "No sign in". Treat the URL as a password, because it gives read and write access to the account.

### Conventions

- **Units:** durations are in seconds and also shown as `m:ss`. Distances are in meters, or km where the field name says `_km`. Speed is in m/s, and pace is shown as `m:ss/km`. Power is in watts and HR in bpm.
- **Compact output:** null fields are removed. Tools that return activities or settings give a readable summary by default, and `verbose=true` returns the raw Intervals objects.
- **Safe writes:** every tool that changes or deletes data has `dry_run=true` as its default. It then only returns the before/after diff. The change is applied only when the tool is called with `dry_run=false`.
- **Errors:** errors are returned as readable tool errors for 401/403, 404, 429 and 5xx responses. A 429 is retried once after `Retry-After`, waiting at most 5 s.
- **Wellness HRV:** `hrv` is the Garmin overnight value and is the one to use for readiness. `hrvSDNN` is Apple's daytime value and is not comparable.

### Tools

Required parameters are in **bold**. Date parameters are `YYYY-MM-DD`.

**Profile and settings**

| Tool | Parameters | What it does |
|---|---|---|
| `get_athlete` | verbose | Weight, resting HR, Garmin sync settings and the zones for every sport |
| `get_sport_settings` | **type**, verbose | LTHR, max HR, HR zones, threshold pace and pace zones (min/km), FTP and power zones (W) |
| `update_sport_settings` | **type**, lthr, max_hr, hr_zones, hr_zone_names, threshold_pace, pace_zones, pace_zone_names, ftp, indoor_ftp, power_zones, power_zone_names, dry_run | Any number of zones, given as ascending upper limits. `threshold_pace` accepts `"m:ss"` per km. Existing activities are not recalculated |
| `update_athlete` | weight, resting_hr, garmin_wellness_keys, dry_run | Weight in kg, resting HR, and which wellness fields Garmin delivers |

**Activities**

| Tool | Parameters | What it does |
|---|---|---|
| `get_activities` | oldest, newest, type, limit, fields, verbose | Compact overview with source (Garmin / HealthFit (MOWL, Bevel) / Watchletic), indoor flag and available streams. `type=Ride` also matches VirtualRide |
| `get_activity` | **id**, intervals, verbose | One activity with zone times, decoupling, weather and intervals |
| `search_activities` | **query**, type, oldest, newest, limit | Name search, or exact tag search with `#tag` |
| `update_activity` | **id**, name, type, rpe, feel, tags, trainer, description, kg_lifted, dry_run | Correct an activity |
| `delete_activity` | **id**, dry_run | Delete an activity, e.g. a duplicate |
| `find_duplicates` | oldest, newest, min_overlap_secs | Overlapping activities of the same sport, with a suggestion for which to keep (watts > HR > none; Garmin for cycling, HealthFit for running and strength) |
| `update_intervals` | **id**, **intervals**, replace, dry_run | Add intervals, e.g. a test segment, by `start_secs`/`end_secs` or by stream index |

**Analysis**

| Tool | Parameters | What it does |
|---|---|---|
| `get_activity_streams` | **id**, types, resolution, from_secs, to_secs | HR, speed/pace, watts, cadence, altitude and distance, averaged per `resolution` seconds (default 30) |
| `analyze_activity` | **id**, hr_zones, hr_zone_names, from_secs, to_secs, split, split_secs, target_pct_ftp | Time in zones (Intervals zones and your own limits), Pa:Hr/Pw:Hr decoupling, splits per km or 5 min, meters per heartbeat, NP, IF and work intervals as % of FTP, weather |
| `get_best_efforts` | **metric** (power/hr/pace), type, durations, distances, oldest, newest | Best watts or HR for durations, or best time for distances, with date and activity id |
| `get_training_summary` | oldest, newest, group_by (week/month), type | Sessions, time, distance, load, HR-zone time and totals per sport |
| `get_fitness` | oldest, newest, step | CTL, ATL, form and ramp rate (from wellness) |

**Wellness and calendar**

| Tool | Parameters | What it does |
|---|---|---|
| `get_wellness` | oldest, newest, fields | Daily wellness. Use `fields` to fetch only selected fields |
| `update_wellness` | **date**, **fields**, dry_run | Write wellness fields for one day |
| `get_events` | oldest, newest, category | Planned workouts, races and notes |
| `create_event` | **date**, **name**, category, type, description, moving_time, load, dry_run | Add an event. Workout steps use Intervals workout syntax |
| `update_event` | **id**, date, name, type, description, moving_time, dry_run | Move or change an event |
| `delete_event` | **id**, dry_run | Delete an event |

### Code

- `api/mcp.mjs`: HTTP endpoint and auth
- `api/_lib/mcp-server.mjs`: JSON-RPC handling and the tool registry
- `api/_lib/mcp/tools/*.mjs`: tool definitions
- `api/_lib/mcp/analysis.mjs`: pure stream calculations (zones, decoupling, NP, splits)
- `api/_lib/mcp/format.mjs`: compact output, units, diff, source detection

## Development

```sh
npm install
npm run dev        # Vite dev server
npm test           # Vitest (React components)
npm run test:node  # node:test (server code, MCP tools)
```
