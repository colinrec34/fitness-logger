import { Router } from 'express'
import prisma from '../lib/prisma.js'

// Read-only feed for the CTA wall dashboard's "Latest Activity" card: the
// configured user's most recent non-weight log, plus its activity slug and
// location. Token-authed like the ESF-551 and Health Auto Export webhooks
// (reuses their token/user config so no new env vars are needed).
const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const expected = process.env.LATEST_ACTIVITY_TOKEN || process.env.HEALTH_EXPORT_TOKEN
    const provided = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1]
    if (!expected || provided !== expected) return res.status(401).json({ error: 'Unauthorized' })

    const userId = process.env.HEALTH_EXPORT_USER_ID || process.env.ESF551_USER_ID
    if (!userId) return res.status(500).json({ error: 'Missing server configuration', missing: { userId: true } })

    const log = await prisma.log.findFirst({
      where: { user_id: userId, activity: { slug: { not: 'weight' } } },
      orderBy: { datetime: 'desc' },
      include: {
        activity: { select: { slug: true, display_name: true } },
        location: { select: { name: true, lat: true, lon: true } },
      },
    })
    if (!log) return res.json({ log: null, location: null })

    const { activity, location, ...rest } = log
    res.json({
      log: { ...rest, slug: activity.slug, display_name: activity.display_name },
      // Prisma serializes Decimal as strings; the dashboard feeds these to Leaflet.
      location: location
        ? { name: location.name, lat: location.lat != null ? Number(location.lat) : null, lon: location.lon != null ? Number(location.lon) : null }
        : null,
    })
  } catch (err) {
    next(err)
  }
})

export default router
