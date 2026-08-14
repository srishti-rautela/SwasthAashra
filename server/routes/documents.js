const { Router } = require('express')
const fs = require('fs')
const path = require('path')
const upload = require('../middleware/upload')

const router = Router()
const uploadsDir = path.join(__dirname, '..', 'uploads', 'appointment_files')

const fileMatchesPatient = (filename, patientId) => {
  if (!patientId) return true
  const f = filename.toLowerCase()
  const pid = String(patientId).toLowerCase()
  return f.includes(`pid-${pid}_`) || f.includes(`_${pid}`) || f.includes(`${pid}_`) || f.includes(`-${pid}-`)
}

const listFiles = (patientId) => {
  if (!fs.existsSync(uploadsDir)) return []
  return fs.readdirSync(uploadsDir)
    .filter(f => fileMatchesPatient(f, patientId))
    .map(f => ({
      filename: f,
      mtimeMs: fs.statSync(path.join(uploadsDir, f)).mtimeMs,
      url: `/uploads/appointment_files/${encodeURIComponent(f)}`,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
}

// GET /api/documents/latest?patientId=123
router.get('/documents/latest', (req, res) => {
  const { patientId } = req.query
  const files = listFiles(patientId)
  if (!files.length) return res.status(404).json({ message: 'No document found' })
  return res.json(files[0])
})

// GET /api/documents?patientId=123
router.get('/documents', (req, res) => {
  const { patientId } = req.query
  return res.json(listFiles(patientId))
})

// POST /api/documents/upload (form-data: file, patientId)
router.post('/documents/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' })
  return res.json({
    filename: req.file.filename,
    url: `/uploads/appointment_files/${encodeURIComponent(req.file.filename)}`,
  })
})

module.exports = router