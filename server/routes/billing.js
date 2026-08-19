const express = require('express')
const crypto = require('crypto')
const Razorpay = require('razorpay')
const router = express.Router()
const pool = require('../db')
const auth = require('../middleware/auth')

// ================== Razorpay client ==================
// Test-mode keys are free forever (https://razorpay.com) - no real money
// moves until you switch to live keys. See server/.env for where to put
// RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.

let razorpay = null;

if (
  process.env.RAZORPAY_KEY_ID &&
  process.env.RAZORPAY_KEY_SECRET
) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });

  console.log("Razorpay enabled");
} else {
  console.log("Razorpay disabled - running in demo mode");
}

function paymentGatewayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

// ================== Existing routes (table name bug fixed: bills -> billing) ==================

// GET /api/billing - full list (staff/admin use)
router.get('/', auth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, discharge_id, amount, status, razorpay_order_id, razorpay_payment_id, paid_at, created_at FROM billing ORDER BY created_at DESC'
    )
    res.json({ rows })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// GET /api/billing/my - bills belonging to the logged-in patient
router.get('/my', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.discharge_id, b.amount, b.status, b.paid_at, b.created_at,
              d.diagnosis, d.type
         FROM billing b
         JOIN discharges d ON d.id = b.discharge_id
        WHERE d.patient_id = ?
        ORDER BY b.created_at DESC`,
      [req.user.id]
    )
    res.json({ rows })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// POST /api/billing - generate/overwrite bill for a discharge
router.post('/', auth, async (req, res) => {
  try {
    const { dischargeId } = req.body
    if (!dischargeId) return res.status(400).json({ message: 'Missing dischargeId' })
    const amount = 2500 // compute as needed
    await pool.query(
      'INSERT INTO billing (discharge_id, amount, status) VALUES (?, ?, "Pending") ON DUPLICATE KEY UPDATE amount=VALUES(amount)',
      [dischargeId, amount]
    )
    res.json({ ok: true })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// ================== Payment gateway (Razorpay) ==================

// Helper: load a bill and confirm the requesting user is allowed to pay it.
// Patients may only pay their own bill; staff/doctor/pharmacy/insurance/admin
// roles may act on any bill (e.g. paying on a patient's behalf at the counter).
async function loadPayableBill(billId, user) {
  const [[bill]] = await pool.query(
    `SELECT b.*, d.patient_id
       FROM billing b
       JOIN discharges d ON d.id = b.discharge_id
      WHERE b.id = ?`,
    [billId]
  )
  if (!bill) return { error: { status: 404, message: 'Bill not found' } }
  if (bill.status === 'Paid') return { error: { status: 400, message: 'Bill is already paid' } }
  if (user.role === 'patient' && bill.patient_id !== user.id) {
    return { error: { status: 403, message: 'You cannot pay someone else\'s bill' } }
  }
  return { bill }
}

// POST /api/billing/:id/create-order
// Creates a Razorpay order for the given bill and returns the details the
// frontend Checkout widget needs.
router.post('/:id/create-order', auth, async (req, res) => {
  try {
    if (!paymentGatewayConfigured()) {
      return res.status(503).json({ message: 'Payment gateway is not configured yet (missing RAZORPAY_KEY_ID/SECRET in server/.env)' })
    }

    const { bill, error } = await loadPayableBill(req.params.id, req.user)
    if (error) return res.status(error.status).json({ message: error.message })

    // Razorpay expects the amount in the smallest currency unit (paise for INR)
    const amountInPaise = Math.round(Number(bill.amount) * 100)

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `bill_${bill.id}`,
      notes: { billId: String(bill.id), dischargeId: String(bill.discharge_id) },
    })

    await pool.query('UPDATE billing SET razorpay_order_id = ? WHERE id = ?', [order.id, bill.id])

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID, // safe to expose - this is the public key
      billId: bill.id,
    })
  } catch (e) {
    console.error('Razorpay create-order error:', e)
    res.status(500).json({ message: 'Could not start payment. Please try again.' })
  }
})

// POST /api/billing/:id/verify
// Verifies the payment signature Razorpay Checkout returns after a
// successful payment, then marks the bill as Paid. This signature check is
// what proves the payment is genuine - never mark a bill Paid without it.
router.post('/:id/verify', auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment verification fields' })
    }

    const { bill, error } = await loadPayableBill(req.params.id, req.user)
    if (error) return res.status(error.status).json({ message: error.message })

    if (bill.razorpay_order_id !== razorpay_order_id) {
      return res.status(400).json({ message: 'Order mismatch' })
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification failed. Signature mismatch.' })
    }

    await pool.query(
      'UPDATE billing SET status = "Paid", razorpay_payment_id = ?, paid_at = NOW() WHERE id = ?',
      [razorpay_payment_id, bill.id]
    )

    res.json({ ok: true, message: 'Payment verified successfully' })
  } catch (e) {
    console.error('Razorpay verify error:', e)
    res.status(500).json({ message: 'Server error while verifying payment' })
  }
})

module.exports = router
