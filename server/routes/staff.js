const express = require('express')
const router = express.Router()
const pool = require('../db')
const auth = require('../middleware/auth')

// List discharges to verify
router.get('/discharges', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT d.id, u.name AS patient, d.status, IFNULL(b.status,"Pending") AS billing FROM discharges d JOIN users u ON u.id=d.patient_id LEFT JOIN bills b ON b.discharge_id=d.id ORDER BY d.created_at DESC'
    )
    res.json({ rows })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// Approve discharge
router.post('/discharges/:id/approve', auth, async (req, res) => {
  try {
    const { id } = req.params
    await pool.query('UPDATE discharges SET status="Approved" WHERE id=?', [id])
    res.json({ ok: true })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// Generate bill
router.post('/billing/generate', auth, async (req, res) => {
  try {
    const { dischargeId } = req.body
    const amount = 2500 // placeholder; compute from treatments and stay
    await pool.query('INSERT INTO bills (discharge_id, amount, status) VALUES (?, ?, "Pending") ON DUPLICATE KEY UPDATE amount=VALUES(amount)', [dischargeId, amount])
    res.json({ ok: true })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// List bills
router.get('/billing/list', auth, async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, discharge_id, amount, status FROM bills ORDER BY created_at DESC')
    res.json({ rows })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

module.exports = router