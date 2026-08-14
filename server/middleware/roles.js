module.exports = (...allowed) => (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase()
  const ok = allowed.map(r=>String(r).toLowerCase()).includes(role)
  if (!ok) return res.status(403).json({ message: 'Forbidden' })
  next()
}