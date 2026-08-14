const jwt = require('jsonwebtoken')

module.exports = function auth(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsecret')
    req.user = { id: decoded.sub, role: decoded.role, email: decoded.email }
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
}