const express = require('express')
const router = express.Router()
const pool = require('../db')
const auth = require('../middleware/auth')

// GET appointments of current patient
router.get('/appointments', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, doctor_name AS doctor, appt_date AS date, appt_time AS time, status FROM appointments WHERE patient_id=? ORDER BY appt_date, appt_time',
      [req.user.id]
    )
    res.json({ rows })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// Book appointment
router.post('/appointments', auth, async (req, res) => {
  try {
    const { doctorId, date, time, reason } = req.body
    if (!doctorId || !date || !time) return res.status(400).json({ message: 'Missing fields' })

    // prevent overlap (simple check)
    const [exists] = await pool.query(
      'SELECT id FROM appointments WHERE patient_id=? AND appt_date=? AND appt_time=? AND status="Scheduled"',
      [req.user.id, date, time]
    )
    if (exists.length) return res.status(400).json({ message: 'Slot already booked' })

    // fetch doctor name for convenience
    const [[doc]] = await pool.query('SELECT name FROM users WHERE id=?', [doctorId])
    const doctorName = doc?.name || 'Doctor'

    await pool.query(
      'INSERT INTO appointments (patient_id, doctor_id, doctor_name, appt_date, appt_time, reason, status) VALUES (?,?,?,?,?,?, "Scheduled")',
      [req.user.id, doctorId, doctorName, date, time, reason || null]
    )
    res.json({ ok: true })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// Update appointment (cancel/reschedule)
router.patch('/appointments/:id', auth, async (req, res) => {
  try {
    const { action, date, time } = req.body
    const { id } = req.params
    if (action === 'cancel') {
      await pool.query('UPDATE appointments SET status="Cancelled" WHERE id=? AND patient_id=?', [id, req.user.id])
    } else if (action === 'reschedule') {
      await pool.query('UPDATE appointments SET appt_date=?, appt_time=? WHERE id=? AND patient_id=?', [date, time, id, req.user.id])
    }
    res.json({ ok: true })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// Discharge summaries and records
router.get('/records', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT d.id, CONCAT("Discharge — ", DATE_FORMAT(d.created_at,"%d %b %Y")) AS title, d.pdf_url AS url FROM discharges d WHERE d.patient_id=? ORDER BY d.created_at DESC',
      [req.user.id]
    )
    res.json({ rows })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

module.exports = router