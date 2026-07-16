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
