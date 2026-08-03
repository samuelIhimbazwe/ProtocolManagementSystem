import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET ?? 'pmss-dev-secret-change-in-production'
const JWT_EXPIRES = process.env.JWT_EXPIRES ?? '12h'

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.app_role, memberId: user.member_id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES },
  )
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET)
    req.auth = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export { JWT_SECRET }
