import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { classifyWorkout, workoutToLog } from '../lib/healthExport.js'

// Ingest webhook for the Health Auto Export iOS app (REST API automation).
// The Strava app syncs workouts (incl. GPS routes) into Apple Health; HAE
// POSTs them here, and runs/hikes are upserted into `logs` in the same
// Strava-shaped JSON the running/hiking pages already render. Token-authed
// like the ESF-551 webhook; other workout types are reported as skipped.
const DEFAULT_RUN_ACTIVITY_ID = 'd3555da1-b932-42e2-9cbb-0908aaf1c73a'
const DEFAULT_HIKE_ACTIVITY_ID = 'a2fb0a80-f149-4761-a339-aeb282ba06a9'

const router = Router()

router.post('/', async (req, res, next) => {
  try {
    const expected = process.env.HEALTH_EXPORT_TOKEN
    const provided = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1]
    if (!expected || provided !== expected) return res.status(401).json({ error: 'Unauthorized' })

    const userId = process.env.HEALTH_EXPORT_USER_ID || process.env.ESF551_USER_ID
    if (!userId) return res.status(500).json({ error: 'Missing server configuration', missing: { userId: true } })

    const activityIds = {
      run: process.env.HEALTH_EXPORT_RUN_ACTIVITY_ID || DEFAULT_RUN_ACTIVITY_ID,
      hike: process.env.HEALTH_EXPORT_HIKE_ACTIVITY_ID || DEFAULT_HIKE_ACTIVITY_ID,
    }

    const workouts = req.body?.data?.workouts
    if (!Array.isArray(workouts)) return res.status(400).json({ error: 'Expected data.workouts array' })

    const results = []
    for (const workout of workouts) {
      const kind = classifyWorkout(workout?.name)
      if (!kind) {
        results.push({ name: workout?.name ?? null, status: 'skipped', reason: 'not a run or hike' })
        continue
      }
      const parsed = workoutToLog(workout, kind)
      if (parsed.error) {
        results.push({ name: workout?.name ?? null, status: 'skipped', reason: parsed.error })
        continue
      }
      await prisma.log.upsert({
        where: { activity_id_datetime: { activity_id: activityIds[kind], datetime: parsed.datetime } },
        update: { data: parsed.data },
        create: { user_id: userId, activity_id: activityIds[kind], datetime: parsed.datetime, data: parsed.data },
      })
      results.push({ name: parsed.data.name, status: 'imported', kind, datetime: parsed.datetime.toISOString() })
    }

    const imported = results.filter((r) => r.status === 'imported').length
    res.json({ ok: true, imported, skipped: results.length - imported, results })
  } catch (err) {
    next(err)
  }
})

export default router
