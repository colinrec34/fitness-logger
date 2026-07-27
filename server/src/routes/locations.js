import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

// lat/lon are Decimal in the DB; return them as numbers so the map/client can use them.
function shape(loc) {
  return { ...loc, lat: loc.lat == null ? null : Number(loc.lat), lon: loc.lon == null ? null : Number(loc.lon) }
}

// GET /api/locations?activity_id=... — the caller's saved locations for an activity.
router.get('/', async (req, res, next) => {
  try {
    const { activity_id } = req.query
    const where = { user_id: req.userId, ...(activity_id ? { activity_id } : {}) }
    const locations = await prisma.location.findMany({ where, orderBy: { name: 'asc' } })
    res.json(locations.map(shape))
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const { activity_id, name, lat, lon, data } = req.body
    if (!activity_id || !name) return res.status(400).json({ error: 'activity_id and name required' })
    const owns = await prisma.activity.findFirst({ where: { id: activity_id, user_id: req.userId } })
    if (!owns) return res.status(404).json({ error: 'Activity not found' })
    const location = await prisma.location.create({
      data: {
        user_id: req.userId,
        activity_id,
        name,
        lat: lat === undefined || lat === null || lat === '' ? null : lat,
        lon: lon === undefined || lon === null || lon === '' ? null : lon,
        data: data === undefined ? null : data,
      },
    })
    res.status(201).json(shape(location))
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'A location with that name already exists for this activity' })
    }
    next(err)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.location.findFirst({ where: { id: req.params.id, user_id: req.userId } })
    if (!existing) return res.status(404).json({ error: 'Location not found' })
    const { name, lat, lon, data } = req.body
    const update = {}
    if (name !== undefined) update.name = name
    if (lat !== undefined) update.lat = lat === null || lat === '' ? null : lat
    if (lon !== undefined) update.lon = lon === null || lon === '' ? null : lon
    if (data !== undefined) update.data = data
    const location = await prisma.location.update({ where: { id: req.params.id }, data: update })
    res.json(shape(location))
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'A location with that name already exists for this activity' })
    }
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.location.findFirst({ where: { id: req.params.id, user_id: req.userId } })
    if (!existing) return res.status(404).json({ error: 'Location not found' })
    await prisma.location.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
