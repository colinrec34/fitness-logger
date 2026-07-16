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

**React 19 + TypeScript SPA** deployed on Vercel. Supabase is the backend (auth + Postgres). No server-side rendering.

### Auth and activity registration

`AuthContext` (`src/context/AuthContext.tsx`) is the single source of truth for the authenticated user and their activity list. On login it fetches the `activities` table, which drives two things simultaneously:

1. **Navbar** — `Navbar.tsx` sorts and renders links from `activities` ordered by `placement_row`/`placement_col`
2. **Routes** — `App.tsx` dynamically registers a `<Route>` per active activity slug, mapping each slug to its component via the `activityComponents` record

This means adding a new activity requires: a row in the `activities` table, a component registered in `activityComponents`, and a hardcoded `ACTIVITY_ID` UUID in that component matching the DB row.

### Database tables

- `activities` — per-user config: `slug`, `display_name`, `is_active`, `placement_row`, `placement_col`
- `logs` — all activity entries: `user_id`, `activity_id`, `datetime`, `data` (JSONB), `location_id?`
- `locations` — named geo points: `user_id`, `activity_id`, `name`, `lat`, `lon`

All writes use `upsert` with `onConflict: "activity_id,datetime"` so re-submitting the same date overwrites rather than duplicates.

### Two activity patterns

**Strava-synced** (running, hiking): Read-only pages. On mount, they call the `strava-sync` Supabase edge function with the user's JWT, which syncs new activities from Strava into `logs`. Data includes polyline-encoded routes rendered with react-leaflet + `@mapbox/polyline`.

**Manual-entry with locations** (surfing, skiing, golfing, snorkeling): Two-column layout — left is a form + session history, right is `StatisticsSection` + a Leaflet map with markers per saved location. Changing the date picker pre-populates the form from any existing log for that day. Locations are stored in the `locations` table and selected via dropdown; new ones can be added inline with lat/lon.

**Manual-entry without locations** (weight, lifting): Weight is a simple time-series chart. Lifting is the most complex page — tracks six lifts (squat, bench, deadlift, pullups, overhead press, power clean) each with warmup and working sets (reps × weight × sets), renders per-lift line charts using recharts.

### Shared utilities

- `StatisticsSection` (`src/components/StatisticsSection.tsx`) — generic stats card; takes a `computeStats` callback and wires it to `TimeRangeFilter`
- `TimeRangeFilter` / `filterLogsByRange` (`src/components/TimeRangeFilter.tsx`) — range buttons (1d/5d/1m/6m/YTD/1y/5y/Max) + filter function; used across all activity pages
- `groupLogsByLocation` / `FitBoundsPoints` (`src/lib/locationUtils.tsx`) — groups logs by their `location_id` for map marker tooltips; `FitBoundsPoints` auto-fits a Leaflet map to a set of points
- `currentDatetimeLocal` (`src/lib/datetimeLocal.ts`) — returns current datetime formatted for `<input type="datetime-local">`

### Vercel API function

`api/esf551.ts` — serverless endpoint that accepts a POST from a Raspberry Pi Pico W running MicroPython (`pico/esf551/`). The Pico connects to an Etekcity ESF-551 smart scale via BLE and POSTs weight readings here, which are written directly to Supabase using the service role key. Authenticated via a shared bearer token (`ESF551_WEBHOOK_TOKEN` env var).

### Environment variables

| Variable | Used by |
|---|---|
| `VITE_SUPABASE_URL` | Frontend + `api/esf551.ts` fallback |
| `VITE_SUPABASE_ANON_KEY` | Frontend |
| `SUPABASE_URL` | `api/esf551.ts` (preferred) |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/esf551.ts` |
| `ESF551_WEBHOOK_TOKEN` | `api/esf551.ts` |
| `ESF551_USER_ID` | `api/esf551.ts` |
| `ESF551_WEIGHT_ACTIVITY_ID` | `api/esf551.ts` (optional, has default) |
