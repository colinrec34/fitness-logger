import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

// Verify the activity belongs to the caller (replaces RLS ownership checks).
async function ownsActivity(userId, activityId) {
  return prisma.activity.findFirst({ where: { id: activityId, user_id: userId } })
}

// GET /api/logs?activity_id=... — the caller's logs for one activity, oldest first.
router.get('/', async (req, res, next) => {
  try {
    const { activity_id } = req.query
    if (!activity_id) return res.status(400).json({ error: 'activity_id required' })
    const logs = await prisma.log.findMany({
      where: { user_id: req.userId, activity_id },
      orderBy: { datetime: 'asc' },
    })
    res.json(logs)
  } catch (err) {
    next(err)
  }
})

// Upsert a log (matches the client's upsert on the (activity_id, datetime) key).
router.post('/', async (req, res, next) => {
  try {
    const { activity_id, datetime, data, location_id } = req.body
    if (!activity_id || !datetime || data === undefined) {
      return res.status(400).json({ error: 'activity_id, datetime and data required' })
    }
    if (!(await ownsActivity(req.userId, activity_id))) {
      return res.status(404).json({ error: 'Activity not found' })
    }
    const when = new Date(datetime)
    const log = await prisma.log.upsert({
      where: { activity_id_datetime: { activity_id, datetime: when } },
      update: { data, location_id: location_id ?? null },
      create: { user_id: req.userId, activity_id, datetime: when, data, location_id: location_id ?? null },
    })
    res.json(log)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.log.findFirst({ where: { id: req.params.id, user_id: req.userId } })
    if (!existing) return res.status(404).json({ error: 'Log not found' })
    await prisma.log.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
