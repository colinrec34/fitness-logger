import jwt from 'jsonwebtoken'

// Validates `Authorization: Bearer <jwt>` and sets req.userId. Replaces the
// per-row Supabase RLS check (user_id = auth.uid()) with server-side scoping.
export function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' })
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
