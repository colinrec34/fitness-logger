import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

// Thin proxy to Nominatim (OpenStreetMap's free place-search API) so "add a
// location" can be search-based instead of manual lat/lon entry. Proxied
// server-side rather than called from the browser because Nominatim's public
// endpoint sends no CORS headers, and because its usage policy expects
// requests to carry an identifying User-Agent, which a browser fetch can't
// set itself.
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim()
    if (!q) return res.json([])

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'fitness-logger/1.0 (personal self-hosted fitness tracker; single user)',
        Accept: 'application/json',
      },
    })
    if (!upstream.ok) return res.status(502).json({ error: 'Location search failed' })

    const results = await upstream.json()
    res.json(
      results.map((r) => ({
        displayName: r.display_name,
        shortName: r.display_name.split(',')[0],
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
      }))
    )
  } catch (err) {
    next(err)
  }
})

export default router
