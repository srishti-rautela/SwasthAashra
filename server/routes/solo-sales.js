const express = require('express')
const router = express.Router()
const pool = require('../db')
const auth = require('../middleware/auth')

// GET solo sales
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.customer_name, s.customer_contact, s.total_amount, s.status,
              s.created_at, s.completed_at,
              u.name AS created_by_name
       FROM solo_sales s
       JOIN users u ON u.id = s.created_by
       ORDER BY s.created_at DESC
       LIMIT 50`
    )
    res.json({ rows })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST create solo sale
router.post('/', auth, async (req, res) => {
  try {
    const { customerName, customerContact, medicineItems } = req.body
    
    if (!customerName || !Array.isArray(medicineItems) || medicineItems.length === 0) {
      return res.status(400).json({ message: 'Customer name and medicine items required' })
    }
    
    // Calculate total
    let totalAmount = 0
    for (const item of medicineItems) {
      totalAmount += Number(item.rate) * Number(item.quantity)
    }
    
    // Create solo sale
    const [saleResult] = await pool.query(
      `INSERT INTO solo_sales (customer_name, customer_contact, total_amount, status, created_by)
       VALUES (?, ?, ?, "Pending", ?)`,
      [customerName, customerContact || null, totalAmount, req.user.id]
    )
    const saleId = saleResult.insertId
    
    // Insert medicine items
    const items = medicineItems.map(item => [
      null, // prescription_id
      null, // quick_prescription_id
      saleId, // solo_sale_id
      item.medicine_name,
      item.batch_number,
      item.expiry_date,
      item.rate,
      item.quantity,
      Number(item.rate) * Number(item.quantity)
    ])
    
    await pool.query(
      `INSERT INTO pharmacy_medicine_items 
       (prescription_id, quick_prescription_id, solo_sale_id, medicine_name, batch_number, expiry_date, rate, quantity, total_amount)
       VALUES ?`,
      [items]
    )
    
    res.json({ ok: true, saleId, totalAmount })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST complete solo sale (generate receipt)
router.post('/:id/complete', auth, async (req, res) => {
  try {
    const { id } = req.params
    
    await pool.query(
      'UPDATE solo_sales SET status="Completed", completed_at=NOW() WHERE id=?',
      [id]
    )
    
    // Get sale details for receipt
    const [[sale]] = await pool.query(
      `SELECT s.*, u.name AS created_by_name
       FROM solo_sales s
       JOIN users u ON u.id = s.created_by
       WHERE s.id=?`,
      [id]
    )
    
    const [items] = await pool.query(
      'SELECT * FROM pharmacy_medicine_items WHERE solo_sale_id=?',
      [id]
    )
    
    res.json({ ok: true, sale, items })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router

