import { Router } from 'express'
import prisma from '../lib/prisma.js'

// Webhook for the ESF-551 smart scale. Token-authed (not JWT); writes a weight
// log for a fixed user/activity. Ported from the old Vercel serverless function
// — same payload, token, and upsert-on-(activity_id, datetime) behavior.
const DEFAULT_WEIGHT_ACTIVITY_ID = '3bacbc7e-4e70-435a-8927-ccc7ff1568b7'

const router = Router()

function resolveWeightLb(p) {
  if (typeof p.weight_lb === 'number' && Number.isFinite(p.weight_lb)) return p.weight_lb
  if (typeof p.weight_kg === 'number' && Number.isFinite(p.weight_kg)) return Math.round(p.weight_kg * 2.20462 * 10) / 10
  return null
}

function resolveTimestamp(p) {
  if (p.timestamp_iso) {
    const d = new Date(p.timestamp_iso)
    if (!Number.isNaN(d.getTime())) return d
  }
  if (typeof p.timestamp_unix === 'number') {
    const d = new Date(p.timestamp_unix * 1000)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

router.post('/', async (req, res, next) => {
  try {
    const expected = process.env.ESF551_WEBHOOK_TOKEN
    const provided = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1]
    if (!expected || provided !== expected) return res.status(401).json({ error: 'Unauthorized' })

    const userId = process.env.ESF551_USER_ID
    const activityId = process.env.ESF551_WEIGHT_ACTIVITY_ID || DEFAULT_WEIGHT_ACTIVITY_ID
    if (!userId) return res.status(500).json({ error: 'Missing server configuration', missing: { userId: true } })

    const payload = req.body || {}
    if (payload.device && payload.device !== 'esf-551') return res.status(400).json({ error: 'Unsupported device' })

    const weightLb = resolveWeightLb(payload)
    if (weightLb == null) return res.status(400).json({ error: 'Missing weight measurement' })

    const datetime = resolveTimestamp(payload)
    await prisma.log.upsert({
      where: { activity_id_datetime: { activity_id: activityId, datetime } },
      update: { data: { weight: weightLb } },
      create: { user_id: userId, activity_id: activityId, datetime, data: { weight: weightLb } },
    })
    res.json({ ok: true, datetime: datetime.toISOString(), weight_lb: weightLb })
  } catch (err) {
    next(err)
  }
})

export default router
