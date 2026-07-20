import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import rateLimit from 'express-rate-limit'
import authRoutes from './routes/auth.js'
import activityRoutes from './routes/activities.js'
import logRoutes from './routes/logs.js'
import locationRoutes from './routes/locations.js'
import esf551Routes from './routes/esf551.js'
import healthExportRoutes from './routes/healthExport.js'
import latestActivityRoutes from './routes/latestActivity.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
// Behind nginx: trust the single hop so express-rate-limit reads the real IP.
app.set('trust proxy', 1)

// SPA and API are served from the same origin; allow same-origin requests (plus
// the dev client and an optional CLIENT_URL). Same approach as the other apps.
const allowedOrigins = ['http://localhost:5173', process.env.CLIENT_URL].filter(Boolean)
app.use(cors((req, cb) => {
  const origin = req.header('Origin')
  const host = req.header('Host')
  const sameOrigin = !!host && (origin === `http://${host}` || origin === `https://${host}`)
  const allow = !origin || sameOrigin || allowedOrigins.includes(origin)
  cb(null, { origin: allow, credentials: true })
}))

// Health Auto Export workout payloads with GPS routes can be tens of MB, so
// this route gets its own parser, mounted ahead of the global 1mb one.
app.use('/api/health-export', express.json({ limit: '250mb' }), healthExportRoutes)

app.use(express.json({ limit: '1mb' }))

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false })
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false,
  skip: (req) => req.method === 'GET',
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/esf551', esf551Routes)
app.use('/api/latest-activity', latestActivityRoutes)
app.use('/api/activities', writeLimiter, activityRoutes)
app.use('/api/logs', writeLimiter, logRoutes)
app.use('/api/locations', writeLimiter, locationRoutes)

// Serve the built frontend (present in the Docker image).
const distDir = path.resolve(__dirname, '../../dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' })
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

// JSON error handler
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

export default app
