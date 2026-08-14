const express = require('express')
const router = express.Router()
const pool = require('../db')
const auth = require('../middleware/auth')

// GET /api/prescriptions
router.get('/', auth, async (req, res) => {
  try {
    const { doctor_id, scope } = req.query
    const where = []
    const params = []

    if (doctor_id) { where.push('p.doctor_id=?'); params.push(Number(doctor_id)) }
    if (String(scope || '').toLowerCase() === 'pharmacy') {
      where.push(`p.status IN ('Pending','Processing')`)
    }

    const sql = `
      SELECT
        p.id,
        CONCAT('RX-', LPAD(p.id,4,'0')) AS rx,
        p.medicines,
        p.status,
        p.created_at,
        pu.name AS patient_name,
        pu.id   AS patient_id,
        du.name AS doctor_name,
        du.id   AS doctor_id
      FROM prescriptions p
      JOIN users pu ON pu.id = p.patient_id
      JOIN users du ON du.id = p.doctor_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY p.created_at DESC
    `
    const [rows] = await pool.query(sql, params)
    res.json({ rows })
  } catch (e) {
    console.error(e); res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/prescriptions (doctor creates)
router.post('/', auth, async (req, res) => {
  try {
    const { patientId, medicines } = req.body
    const pid = Number(patientId)
    if (!pid || !medicines) return res.status(400).json({ message: 'Missing fields' })

    const [[pat]] = await pool.query('SELECT id FROM users WHERE id=? AND role="patient" LIMIT 1', [pid])
    if (!pat) return res.status(400).json({ message: 'Patient not found' })

    await pool.query(
      'INSERT INTO prescriptions (patient_id, doctor_id, medicines, status) VALUES (?, ?, ?, "Pending")',
      [pid, req.user.id, Array.isArray(medicines) ? JSON.stringify(medicines) : String(medicines)]
    )
    await pool.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [
      pid, 'New prescription available at pharmacy'
    ])
    res.json({ ok: true })
  } catch (e) {
    if (e?.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ message: 'Invalid patient or doctor reference' })
    }
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/prescriptions/:id/process
router.post('/:id/process', auth, async (req, res) => {
  try {
    const { id } = req.params
    const { medicineItems } = req.body
    if (!Array.isArray(medicineItems) || medicineItems.length === 0) {
      return res.status(400).json({ message: 'Medicine items required' })
    }

    const [[pr]] = await pool.query(
      `SELECT p.*, pu.id AS patient_id, du.id AS doctor_id
       FROM prescriptions p
       JOIN users pu ON pu.id = p.patient_id
       JOIN users du ON du.id = p.doctor_id
       WHERE p.id=?`,
      [id]
    )
    if (!pr) return res.status(404).json({ message: 'Prescription not found' })
    if (String(pr.status).toLowerCase() === 'completed') {
      return res.status(400).json({ message: 'Already completed' })
    }

    await pool.query('UPDATE prescriptions SET status="Processing" WHERE id=?', [id])

    const [billResult] = await pool.query(
      `INSERT INTO pharmacy_bills (prescription_id, patient_id, doctor_id, total_amount, status, created_by)
       VALUES (?, ?, ?, 0, "Pending", ?)`,
      [id, pr.patient_id, pr.doctor_id, req.user.id]
    )
    const billId = billResult.insertId

    let totalAmount = 0
    const values = medicineItems.map(mi => {
      const rate = Number(mi.rate)
      const qty = Number(mi.quantity)
      const total = rate * qty
      totalAmount += total
      return [
        id,     // prescription_id
        null,   // quick_prescription_id
        null,   // solo_sale_id
        mi.medicine_name,
        mi.batch_number,
        mi.expiry_date,
        rate,
        qty,
        total
      ]
    })

    await pool.query(
      `INSERT INTO pharmacy_medicine_items
       (prescription_id, quick_prescription_id, solo_sale_id, medicine_name, batch_number, expiry_date, rate, quantity, total_amount)
       VALUES ?`,
      [values]
    )
    await pool.query('UPDATE pharmacy_bills SET total_amount=? WHERE id=?', [totalAmount, billId])

    res.json({ ok: true, billId, totalAmount })
  } catch (e) {
    console.error(e); res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/prescriptions/:id/complete
router.post('/:id/complete', auth, async (req, res) => {
  try {
    const { id } = req.params
    await pool.query('UPDATE prescriptions SET status="Completed" WHERE id=?', [id])
    await pool.query('UPDATE pharmacy_bills SET status="Completed", completed_at=NOW() WHERE prescription_id=?', [id])

    const [[row]] = await pool.query('SELECT patient_id FROM prescriptions WHERE id=?', [id])
    if (row?.patient_id) {
      await pool.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [
        row.patient_id, 'Your prescription is ready for pickup'
      ])
    }
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router