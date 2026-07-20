# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server
npm run build     # tsc + vite build
npm run lint      # eslint
npm run preview   # preview production build
```

There are no tests.

## Architecture

**React 19 + TypeScript SPA** with a self-hosted **Express + Prisma + PostgreSQL** backend (JWT auth), served as one Docker container (Express serves the built SPA + `/api`). The frontend talks to the API through a thin shim in `src/api/supabaseClient.ts` that preserves the old `supabase.from(...)`/`supabase.auth.*` call sites, so the activity pages are unchanged. All endpoints are scoped to the JWT user (replacing the former Supabase RLS). No server-side rendering.

### Auth and activity registration

`AuthContext` (`src/context/AuthContext.tsx`) is the single source of truth for the authenticated user and their activity list. On login it fetches the `activities` table, which drives two things simultaneously:

1. **Navbar** — `Navbar.tsx` sorts and renders links from `activities` ordered by `placement_row`/`placement_col`
2. **Routes** — `App.tsx` dynamically registers a `<Route>` per active activity slug, mapping each slug to its component via the `activityComponents` record
3. **Home cards** — `Home.tsx` renders dashboard cards from the same sorted list via its `cardComponents` record

The `/settings` page (`src/pages/Settings.tsx`) reorders activities in the UI: it calls `PUT /api/activities/order` with the full slug list, which renumbers placements to `row=index, col=0` in a transaction (shifting rows first to dodge the `(user_id, placement_row, placement_col)` unique constraint), then refreshes `AuthContext` so navbar and cards update immediately.

This means adding a new activity requires: a row in the `activities` table, a component registered in `activityComponents`, and a hardcoded `ACTIVITY_ID` UUID in that component matching the DB row.

### Database tables

- `activities` — per-user config: `slug`, `display_name`, `is_active`, `placement_row`, `placement_col`
- `logs` — all activity entries: `user_id`, `activity_id`, `datetime`, `data` (JSONB), `location_id?`
- `locations` — named geo points: `user_id`, `activity_id`, `name`, `lat`, `lon`

All writes use `upsert` with `onConflict: "activity_id,datetime"` so re-submitting the same date overwrites rather than duplicates.

### Two activity patterns

**Read-only route pages** (running, hiking): display run/hike logs from the DB with polyline-encoded routes rendered via react-leaflet + `@mapbox/polyline`. (These previously auto-synced from Strava via a Supabase edge function; the Strava sync was removed when the API was blocked. New runs/hikes now arrive via the Health Auto Export ingest — see below.)

**Manual-entry with locations** (surfing, skiing, golfing, snorkeling, basketball, volleyball, tennis): Two-column layout — left is a form + session history, right is `StatisticsSection` + a Leaflet map with markers per saved location. Changing the date picker pre-populates the form from any existing log for that day. Locations are stored in the `locations` table and selected via dropdown; new ones can be added inline with lat/lon.

**Manual-entry without locations** (weight, lifting): Weight is a simple time-series chart. Lifting is the most complex page — tracks six lifts (squat, bench, deadlift, pullups, overhead press, power clean) each with warmup and working sets (reps × weight × sets), renders per-lift line charts using recharts.

### Shared utilities

- `StatisticsSection` (`src/components/StatisticsSection.tsx`) — generic stats card; takes a `computeStats` callback and wires it to `TimeRangeFilter`
- `TimeRangeFilter` / `filterLogsByRange` (`src/components/TimeRangeFilter.tsx`) — range buttons (1d/5d/1m/6m/YTD/1y/5y/Max) + filter function; used across all activity pages
- `groupLogsByLocation` / `FitBoundsPoints` (`src/lib/locationUtils.tsx`) — groups logs by their `location_id` for map marker tooltips; `FitBoundsPoints` auto-fits a Leaflet map to a set of points
- `currentDatetimeLocal` (`src/lib/datetimeLocal.ts`) — returns current datetime formatted for `<input type="datetime-local">`

### ESF-551 scale webhook

`server/src/routes/esf551.js` — Express route (`POST /api/esf551`) that accepts weight readings from a Raspberry Pi Pico W running MicroPython (`pico/esf551/`), which reads an Etekcity ESF-551 smart scale over BLE. Writes a weight log via Prisma. Authenticated via a shared bearer token (`ESF551_WEBHOOK_TOKEN`).

### Health Auto Export workout ingest

`server/src/routes/healthExport.js` — Express route (`POST /api/health-export`) that accepts workout payloads from the Health Auto Export iOS app (REST API automation). The Strava app syncs workouts + GPS routes into Apple Health; HAE POSTs them here. Runs and hikes are converted (`server/src/lib/healthExport.js`) into the same Strava-shaped `data` JSON the running/hiking pages render (`map.summary_polyline`, `distance` in meters, `elapsed_time` in seconds) and upserted on `(activity_id, datetime=workout start)`; other workout types are skipped. Bearer-token auth (`HEALTH_EXPORT_TOKEN`). The route has its own 250mb JSON parser (GPS payloads are large), mounted in `app.js` ahead of the global 1mb parser; the nginx vhost (`deploy/nginx-fitness.conf`) raises `client_max_body_size` to match.

### Strava scraper (`strava-scraper/`)

Python container (docker-compose service `strava-scraper`) that replaces the paywalled Strava API: it authenticates to strava.com with a browser session cookie (`STRAVA_SESSION_COOKIE` = the `_strava4_session` cookie value from a logged-in browser — no password stored), lists activities via the training page's JSON endpoint (`/athlete/training_activities`), downloads GPX for new runs/hikes (`/activities/{id}/export_gpx`), computes distance/elevation from trackpoints, and POSTs each one to `/api/health-export` in HAE's workout format with an explicit `type` ("Run"/"Hike"; Strava titles are custom, so the ingest classifies on `type` before `name`). First run backfills full history; synced ids persist in the `strava_scraper_state` volume. Polls hourly (`STRAVA_SYNC_INTERVAL_SECONDS`). If it logs auth failures, the cookie expired — paste a fresh one into `.env` and restart the service.

### Environment variables (server)

| Variable | Used by |
|---|---|
| `DATABASE_URL` | Prisma / Postgres connection |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Token signing |
| `ESF551_WEBHOOK_TOKEN` | `routes/esf551.js` (bearer token) |
| `ESF551_USER_ID` | `routes/esf551.js` (target user) |
| `ESF551_WEIGHT_ACTIVITY_ID` | `api/esf551.ts` (optional, has default) |
| `HEALTH_EXPORT_TOKEN` | `routes/healthExport.js` (bearer token) |
| `HEALTH_EXPORT_USER_ID` | `routes/healthExport.js` (target user; falls back to `ESF551_USER_ID`) |
| `HEALTH_EXPORT_RUN_ACTIVITY_ID` / `HEALTH_EXPORT_HIKE_ACTIVITY_ID` | `routes/healthExport.js` (optional, default to the hardcoded page IDs) |
