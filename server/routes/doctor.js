const express = require('express')
const router = express.Router()
const pool = require('../db')
const auth = require('../middleware/auth')

// Stats (optional)
router.get('/dashboard', auth, async (req, res) => {
  try {
    const [[todayConfirmed]] = await pool.query(
      `SELECT COUNT(*) AS c FROM appointments WHERE doctor_id=? AND appointment_date=CURDATE() AND status='Confirmed'`,
      [req.user.id]
    )
    const [[totalConfirmed]] = await pool.query(
      `SELECT COUNT(*) AS c FROM appointments WHERE doctor_id=? AND status='Confirmed'`,
      [req.user.id]
    )
    const [[totalCompleted]] = await pool.query(
      `SELECT COUNT(*) AS c FROM appointments WHERE doctor_id=? AND status='Completed'`,
      [req.user.id]
    )
    res.json({ stats: { today: todayConfirmed.c, total: totalConfirmed.c, completed: totalCompleted.c } })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// Assigned/confirmed patients
router.get('/patients', auth, async (req, res) => {
  try {
    const [confirmed] = await pool.query(
      `SELECT DISTINCT u.id, u.name
         FROM appointments a
         JOIN users u ON u.id=a.patient_user_id
        WHERE a.doctor_id=? AND a.status='Confirmed' AND a.appointment_date>=CURDATE()
        ORDER BY u.name
        LIMIT 500`,
      [req.user.id]
    )
    let assigned = []
    try {
      const [rows] = await pool.query(
        `SELECT u.id, u.name
           FROM doctor_patient_assignments x
           JOIN users u ON u.id=x.patient_id
          WHERE x.doctor_id=?
          ORDER BY u.name
          LIMIT 500`,
        [req.user.id]
      )
      assigned = rows
    } catch {}
    const map = new Map(); [...assigned, ...confirmed].forEach(p => map.set(p.id, p))
    res.json({ rows: Array.from(map.values()) })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

module.exports = router