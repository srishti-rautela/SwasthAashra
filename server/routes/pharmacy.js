// ================== Imports ==================
const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const cors = require('cors')
const pool = require('../db') // ADD: DB pool

// ================== Router & Middleware ==================
router.use(cors({ origin: true, credentials: true }))

// ================== Constants ==================
// Dropdown options for doctor UI
const DOSAGE_OPTIONS = ['OD', 'BD', 'TDS', 'QID', 'HS', 'PRN'] // once daily, twice, thrice, four times, bedtime, as needed
const DURATION_OPTIONS = [3, 5, 7, 10, 14, 21, 28, 30]

// ================== Doctor — Options ==================
// Doctor: get dropdown options for quick prescription
router.get('/quick-prescriptions/options', auth, async (_req, res) => {
  try {
    res.json({
      dosageOptions: DOSAGE_OPTIONS,
      durationOptions: DURATION_OPTIONS
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// ================== Doctor — Quick Prescriptions ==================
// Doctor: create a quick prescription and send to pharmacy
router.post('/quick-prescriptions', auth, async (req, res) => {
  try {
    const { patient_id, medicine_name, dosage, duration, notes } = req.body

    if (!patient_id) return res.status(400).json({ message: 'patient_id is required' })
    const name = (medicine_name || '').trim()
    const dsg = (dosage || '').trim().toUpperCase()
    const dur = Number(duration)

    if (!name) return res.status(400).json({ message: 'medicine_name is required' })
    if (!DOSAGE_OPTIONS.includes(dsg)) {
      return res.status(400).json({ message: `dosage must be one of: ${DOSAGE_OPTIONS.join(', ')}` })
    }
    if (!DURATION_OPTIONS.includes(dur)) {
      return res.status(400).json({ message: `duration must be one of: ${DURATION_OPTIONS.join(', ')}` })
    }

    const [result] = await pool.query(
      `INSERT INTO quick_prescriptions (patient_id, doctor_id, medicine_name, dosage, course_duration, status, notes)
       VALUES (?, ?, ?, ?, ?, 'Pending', ?)`,
      [patient_id, req.user.id, name, dsg, dur, notes || null]
    )

    const id = result.insertId
    const rx = `QP-${String(id).padStart(4, '0')}`
    res.status(201).json({ id, rx, status: 'Pending' })
  } catch (e) {
    console.error(e)
    // Fallback if 'notes' column doesn't exist
    if (e && e.code === 'ER_BAD_FIELD_ERROR') {
      try {
        const { patient_id, medicine_name, dosage, duration } = req.body
        const [result2] = await pool.query(
          `INSERT INTO quick_prescriptions (patient_id, doctor_id, medicine_name, dosage, course_duration, status)
           VALUES (?, ?, ?, ?, ?, 'Pending')`,
          [patient_id, req.user.id, (medicine_name || '').trim(), (dosage || '').trim().toUpperCase(), Number(duration)]
        )
        const id2 = result2.insertId
        const rx2 = `QP-${String(id2).padStart(4, '0')}`
        return res.status(201).json({ id: id2, rx: rx2, status: 'Pending' })
      } catch (e2) { console.error(e2) }
    }
    res.status(500).json({ message: 'Server error' })
  }
})

// ================== Pharmacy — Processing ==================
// Pharmacy: process a quick prescription (add items and create/update bill)
router.post('/quick-prescriptions/:id/process', auth, async (req, res) => {
  try {
    const { id } = req.params
    const { medicineItems } = req.body

    if (!Array.isArray(medicineItems) || medicineItems.length === 0) {
      return res.status(400).json({ message: 'Medicine items required' })
    }

    // Fetch the quick prescription
    const [[qp]] = await pool.query('SELECT * FROM quick_prescriptions WHERE id=?', [id])
    if (!qp) return res.status(404).json({ message: 'Quick prescription not found' })

    // Get or create a bill for this quick prescription
    const [[existingBill]] = await pool.query(
      'SELECT id, total_amount, status FROM pharmacy_bills WHERE quick_prescription_id=?',
      [id]
    )

    let billId
    if (existingBill) {
      billId = existingBill.id
    } else {
      const [billResult] = await pool.query(
        `INSERT INTO pharmacy_bills (quick_prescription_id, patient_id, doctor_id, total_amount, status, created_by, created_at)
         VALUES (?, ?, ?, 0, "Pending", ?, NOW())`,
        [id, qp.patient_id, qp.doctor_id, req.user.id]
      )
      billId = billResult.insertId
    }

    // Prepare medicine items rows
    let totalAmount = 0
    const rows = medicineItems.map((item) => {
      const name = (item.medicine_name || qp.medicine_name || 'Medicine').trim()
      const batch = (item.batch_number || '').trim()
      const expiry = item.expiry_date ? new Date(item.expiry_date) : null
      const rate = Number(item.rate || 0)
      const qty = Number(item.quantity || 0)
      const lineTotal = +(rate * qty).toFixed(2)
      totalAmount += lineTotal
      return [
        null,              // prescription_id
        Number(id),        // quick_prescription_id
        null,              // solo_sale_id
        name,              // medicine_name
        batch || null,     // batch_number
        expiry ? expiry : null, // expiry_date
        rate,              // rate
        qty,               // quantity
        lineTotal          // total_amount
      ]
    })

    // Insert items
    await pool.query(
      `INSERT INTO pharmacy_medicine_items 
       (prescription_id, quick_prescription_id, solo_sale_id, medicine_name, batch_number, expiry_date, rate, quantity, total_amount)
       VALUES ?`,
      [rows]
    )

    // Update bill total and prescription status
    await pool.query('UPDATE pharmacy_bills SET total_amount = total_amount + ? WHERE id=?', [totalAmount, billId])
    await pool.query('UPDATE quick_prescriptions SET status="Processing" WHERE id=?', [id])

    res.json({ ok: true, billId, addedAmount: totalAmount })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// ================== Pharmacy — Completion ==================
// Pharmacy: complete a quick prescription (mark paid and dispensed)
router.post('/quick-prescriptions/:id/complete', auth, async (req, res) => {
  try {
    const { id } = req.params
    // Mark prescription and bill as completed
    await pool.query('UPDATE quick_prescriptions SET status="Dispensed" WHERE id=?', [id])
    await pool.query(
      'UPDATE pharmacy_bills SET status="Completed", completed_at=NOW() WHERE quick_prescription_id=?',
      [id]
    )
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// ================== Pharmacy — Queries ==================
// GET referrals: list prescriptions (Pending/Processing) for pharmacy to process
router.get('/referrals', auth, async (_req, res) => {
  try {
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
      WHERE p.status IN ('Pending','Processing')
      ORDER BY p.created_at DESC
    `
    const [rows] = await pool.query(sql)
    return res.json({ rows })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
})

// GET medicine items for a bill (helps showing added lines)
router.get('/bills/:id/items', auth, async (req, res) => {
  try {
    const { id } = req.params
    const [[bill]] = await pool.query('SELECT id, quick_prescription_id FROM pharmacy_bills WHERE id=?', [id])
    if (!bill) return res.status(404).json({ message: 'Bill not found' })

    const [items] = await pool.query(
      `SELECT id, medicine_name, batch_number, expiry_date, rate, quantity, total_amount
       FROM pharmacy_medicine_items
       WHERE quick_prescription_id=?`,
      [bill.quick_prescription_id]
    )
    res.json({ items })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Solo-sales list – from solo_sales table; fallback to empty if table missing
router.get('/solo-sales', auth, async (_req, res) => {
  try {
    // Preferred: dedicated solo_sales table
    const [rows] = await pool.query(
      `SELECT id, customer_name, customer_contact, total_amount, status, created_at
       FROM solo_sales
       ORDER BY created_at DESC`
    )
    return res.json({ rows })
  } catch (e) {
    // Fallback if table doesn’t exist or any error
    if (e && (e.code === 'ER_NO_SUCH_TABLE' || e.code === 'ER_BAD_TABLE_ERROR')) {
      return res.json({ rows: [] })
    }
    console.error(e)
    return res.json({ rows: [] })
  }
})

// ================== Exports ==================
module.exports = router