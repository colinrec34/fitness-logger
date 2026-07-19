import polyline from '@mapbox/polyline'

// Transforms Health Auto Export "workouts v2" objects
// (https://github.com/Lybron/health-auto-export/wiki/API-Export---JSON-Format)
// into the Strava-shaped `data` JSON the running/hiking pages already render.
// Kept free of prisma/express imports so it can be exercised standalone.

const METERS_PER_UNIT = { m: 1, km: 1000, mi: 1609.34, ft: 0.3048, yd: 0.9144 }
const METERS_PER_SEC_PER_UNIT = { 'm/s': 1, kmph: 1 / 3.6, 'km/h': 1 / 3.6, mph: 0.44704 }
// Strava's summary_polyline is similarly downsampled; keeps the JSONB row and
// Leaflet rendering small even for multi-hour GPS tracks.
const MAX_POLYLINE_POINTS = 500

// HAE sends "yyyy-MM-dd HH:mm:ss Z" (e.g. "2026-07-18 06:03:00 -0700"); try
// progressively more ISO-ified variants for stricter Date parsers.
export function parseHaeDate(value) {
  if (typeof value !== 'string' || value === '') return null
  const candidates = [value, value.replace(' ', 'T'), value.replace(' ', 'T').replace(' ', '')]
  for (const candidate of candidates) {
    const d = new Date(candidate)
    if (!Number.isNaN(d.getTime())) return d
  }
  return null
}

function qtyIn(field, factors) {
  if (typeof field?.qty !== 'number' || !Number.isFinite(field.qty)) return null
  const factor = factors[field?.units]
  return factor == null ? null : field.qty * factor
}

// Apple workout type names as HAE exports them ("Running", "Outdoor Run",
// "Hiking", ...) or Strava types from the scraper ("Run", "TrailRun", "Hike").
export function classifyWorkout(name) {
  const n = String(name || '').toLowerCase()
  if (n.includes('run')) return 'run'
  if (n.includes('hik')) return 'hike'
  return null
}

function routeCoords(route) {
  if (!Array.isArray(route)) return []
  const coords = []
  for (const point of route) {
    const lat = point?.latitude ?? point?.lat
    const lon = point?.longitude ?? point?.lon ?? point?.lng
    if (typeof lat === 'number' && typeof lon === 'number') coords.push([lat, lon])
  }
  return coords
}

function downsample(coords, max) {
  if (coords.length <= max) return coords
  const step = Math.ceil(coords.length / max)
  const sampled = coords.filter((_, i) => i % step === 0)
  if (sampled[sampled.length - 1] !== coords[coords.length - 1]) {
    sampled.push(coords[coords.length - 1])
  }
  return sampled
}

export function workoutToLog(workout, kind) {
  const start = parseHaeDate(workout?.start)
  if (!start) return { error: 'missing or unparseable start date' }
  const end = parseHaeDate(workout?.end)

  const elapsed = end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000)) : null
  const duration = Number.isFinite(workout?.duration) ? Math.round(workout.duration) : null
  const movingTime = duration ?? elapsed ?? 0

  const coords = routeCoords(workout?.route)
  const summaryPolyline = coords.length > 1 ? polyline.encode(downsample(coords, MAX_POLYLINE_POINTS)) : ''

  const distance = qtyIn(workout?.distance, METERS_PER_UNIT) ?? 0
  const sportType = kind === 'hike' ? 'Hike' : 'Run'

  const data = {
    name: workout?.name || sportType,
    distance,
    elapsed_time: elapsed ?? duration ?? 0,
    moving_time: movingTime,
    total_elevation_gain: qtyIn(workout?.elevationUp, METERS_PER_UNIT) ?? 0,
    average_speed: qtyIn(workout?.avgSpeed, METERS_PER_SEC_PER_UNIT) ?? (movingTime > 0 ? distance / movingTime : 0),
    max_speed: qtyIn(workout?.maxSpeed, METERS_PER_SEC_PER_UNIT) ?? 0,
    type: sportType,
    sport_type: sportType,
    start_date: start.toISOString(),
    start_date_local: workout?.start ?? null,
    start_latlng: coords[0] ?? [],
    end_latlng: coords[coords.length - 1] ?? [],
    map: { id: '', resource_state: 2, summary_polyline: summaryPolyline },
    manual: false,
    external_id: workout?.id ?? null,
    source: 'health-auto-export',
  }
  if (typeof workout?.heartRate?.avg?.qty === 'number') data.average_heartrate = workout.heartRate.avg.qty
  if (typeof workout?.heartRate?.max?.qty === 'number') data.max_heartrate = workout.heartRate.max.qty
  return { datetime: start, data }
}
