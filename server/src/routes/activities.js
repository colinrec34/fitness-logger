import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

// List the current user's activities.
router.get('/', async (req, res, next) => {
  try {
    const activities = await prisma.activity.findMany({
      where: { user_id: req.userId },
      orderBy: [{ placement_row: 'asc' }, { placement_col: 'asc' }],
    })
    res.json(activities)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const { slug, display_name, placement_row, placement_col, is_active } = req.body
    if (!slug || !display_name) return res.status(400).json({ error: 'slug and display_name required' })
    const activity = await prisma.activity.create({
      data: {
        user_id: req.userId,
        slug,
        display_name,
        placement_row: placement_row ?? 0,
        placement_col: placement_col ?? 0,
        is_active: is_active ?? true,
      },
    })
    res.status(201).json(activity)
  } catch (err) {
    next(err)
  }
})

// Replace the navbar/card ordering: body is { slugs: [...] } listing every
// activity in the desired order. Placements are renumbered to row=index, col=0.
// The (user_id, placement_row, placement_col) unique constraint is checked
// per-row, so shift everything out of the way before assigning final values.
router.put('/order', async (req, res, next) => {
  try {
    const { slugs } = req.body
    if (!Array.isArray(slugs) || !slugs.every((s) => typeof s === 'string'))
      return res.status(400).json({ error: 'slugs array required' })
    const existing = await prisma.activity.findMany({ where: { user_id: req.userId } })
    const known = new Set(existing.map((a) => a.slug))
    if (slugs.length !== known.size || !slugs.every((s) => known.has(s)))
      return res.status(400).json({ error: 'slugs must list every activity exactly once' })
    await prisma.$transaction([
      prisma.activity.updateMany({
        where: { user_id: req.userId },
        data: { placement_row: { increment: 1000 } },
      }),
      ...slugs.map((slug, i) =>
        prisma.activity.updateMany({
          where: { user_id: req.userId, slug },
          data: { placement_row: i, placement_col: 0 },
        })
      ),
    ])
    const activities = await prisma.activity.findMany({
      where: { user_id: req.userId },
      orderBy: [{ placement_row: 'asc' }, { placement_col: 'asc' }],
    })
    res.json(activities)
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.activity.findFirst({ where: { id: req.params.id, user_id: req.userId } })
    if (!existing) return res.status(404).json({ error: 'Activity not found' })
    const { display_name, is_active, placement_row, placement_col } = req.body
    const activity = await prisma.activity.update({
      where: { id: req.params.id },
      data: {
        ...(display_name !== undefined && { display_name }),
        ...(is_active !== undefined && { is_active }),
        ...(placement_row !== undefined && { placement_row }),
        ...(placement_col !== undefined && { placement_col }),
      },
    })
    res.json(activity)
  } catch (err) {
    next(err)
  }
})

export default router
