const express = require('express')
const router = express.Router()
const pool = require('../db')
const auth = require('../middleware/auth')

// GET /api/doctors?date=YYYY-MM-DD&time=HH:MM (optional)
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id AS doctor_id, name, COALESCE(specialization, COALESCE(department,'')) AS specialization
       FROM users WHERE role='doctor' ORDER BY name`
    )
    // naive availability flag if query params provided
    const { date, time } = req.query
    if (date && time) {
      for (const r of rows) {
        const [[clash]] = await pool.query(
          `SELECT appointment_id FROM appointments
           WHERE doctor_id=? AND appointment_date=? AND appointment_time=? AND status IN ('Pending','Confirmed') LIMIT 1`,
          [r.doctor_id, date, time]
        )
        r.availability = clash ? 'Busy' : 'Available'
      }
    } else {
      rows.forEach(r => (r.availability = 'Available'))
    }
    res.json({ rows })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

module.exports = router