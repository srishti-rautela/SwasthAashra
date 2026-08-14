const fs = require('fs')
const path = require('path')
const multer = require('multer')

const root = path.join(__dirname, '..', 'uploads', 'appointment_files')
fs.mkdirSync(root, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, root),
  filename: (req, file, cb) => {
    const ts = Date.now()
    const safe = file.originalname.replace(/[^\w.\-]+/g, '_')
    const pid = String((req.body?.patientId || req.query?.patientId || '')).trim()
    const prefix = pid ? `pid-${pid}_` : ''
    cb(null, `${prefix}${ts}_${safe}`)
  },
})
module.exports = multer({ storage })