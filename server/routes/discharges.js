const express = require('express')
const router = express.Router()
const pool = require('../db')
const auth = require('../middleware/auth')
const allowRoles = require('../middleware/roles')

function normalizeDate(input) {
  if (!input) return null
  const s = String(input).trim()
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/) // dd-mm-yyyy
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return s // assume yyyy-mm-dd
}

// Doctor initiates Discharge/Transfer
router.post('/initiate', auth, allowRoles('doctor'), async (req, res) => {
  try {
    const body = req.body || {}
    const patientId = body.patientId || body.patient_id || body.patient_user_id
    const type = body.type || 'Discharge'
    const diagnosis = String(body.diagnosis || '').trim()
    const treatment = body.treatment || null
    const remarks = body.remarks || null
    const followUpDate = normalizeDate(body.followUpDate)

    if (!patientId || !diagnosis) {
      return res.status(400).json({ message: 'Missing fields: patientId and diagnosis are required' })
    }

    const [ins] = await pool.query(
      `INSERT INTO discharges (patient_id, doctor_id, type, diagnosis, treatment, remarks, follow_up_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [patientId, req.user.id, type, diagnosis, treatment, remarks, followUpDate]
    )
    const dischargeId = ins.insertId

    await pool.query(
      `INSERT INTO discharge_approvals (discharge_id, department, status) VALUES
       (?, 'Staff', 'Pending'), (?, 'Pharmacy', 'Pending'), (?, 'Insurance', 'Pending')`,
      [dischargeId, dischargeId, dischargeId]
    )

    // notify departments (is_read exists in your DB)
    const [[pat]] = await pool.query(`SELECT name FROM users WHERE id=?`, [patientId])
    const msg = `Discharge/Transfer request for ${pat?.name || 'patient'} needs your approval`
    const [staff] = await pool.query(`SELECT id FROM users WHERE role IN ('staff','admin')`)
    const [pharm] = await pool.query(`SELECT id FROM users WHERE role='pharmacy'`)
    const [insr]  = await pool.query(`SELECT id FROM users WHERE role='insurance'`)
    const values = [...staff, ...pharm, ...insr].map(u => [u.id, msg, 0])
    if (values.length) await pool.query(`INSERT INTO notifications (user_id, message, is_read) VALUES ?`, [values])

    res.json({ ok: true, id: dischargeId })
  }  catch (e) {
    console.error("===== DISCHARGE INITIATE ERROR =====");
    console.error(e);
    console.error("Code:", e.code);
    console.error("SQL:", e.sqlMessage);
    console.error("=============================");

    res.status(500).json({
        message: e.message,
        code: e.code,
        sql: e.sqlMessage
    });
}
});
// Department list
router.get('/requests', auth, allowRoles('staff','admin','pharmacy','insurance'), async (req, res) => {
  try {
    const role = String(req.user.role).toLowerCase()
    const dept = role === 'pharmacy' ? 'Pharmacy' : role === 'insurance' ? 'Insurance' : 'Staff'
    const status = String(req.query.status || 'pending').toLowerCase()
    const where = ['da.department=?']; const params = [dept]
    if (status !== 'all') { where.push('LOWER(da.status)=?'); params.push(status[0].toUpperCase()+status.slice(1)) }
    const [rows] = await pool.query(
      `SELECT d.id, d.type, d.patient_id, d.doctor_id, d.diagnosis, d.treatment, d.remarks, d.follow_up_date,
              d.status AS overall_status,
              p.name AS patient_name, doc.name AS doctor_name,
              da.department, da.status AS dept_status, da.details, da.reviewed_by, da.reviewed_at
         FROM discharge_approvals da
         JOIN discharges d ON d.id=da.discharge_id
         JOIN users p ON p.id=d.patient_id
         JOIN users doc ON doc.id=d.doctor_id
        WHERE ${where.join(' AND ')}
        ORDER BY d.id DESC`,
      params
    )
    res.json({ rows })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// Department approve/reject
router.patch('/:id/approve', auth, allowRoles('staff','admin','pharmacy','insurance'), async (req, res) => {
  try {
    const { id } = req.params
    const { action, details } = req.body
    if (!['approve','reject'].includes(String(action))) return res.status(400).json({ message: 'Invalid action' })
    const role = String(req.user.role).toLowerCase()
    const dept = role === 'pharmacy' ? 'Pharmacy' : role === 'insurance' ? 'Insurance' : 'Staff'
    const newStatus = action === 'approve' ? 'Approved' : 'Rejected'

    const [r] = await pool.query(
      `UPDATE discharge_approvals
          SET status=?, details=?, reviewed_by=?, reviewed_at=NOW()
        WHERE discharge_id=? AND department=?`,
      [newStatus, details || null, req.user.id, id, dept]
    )
    if (!r.affectedRows) return res.status(404).json({ message: 'Request not found' })

    const [[rej]] = await pool.query(`SELECT COUNT(*) AS c FROM discharge_approvals WHERE discharge_id=? AND status='Rejected'`, [id])
    if (rej.c > 0) {
      await pool.query(`UPDATE discharges SET status='Rejected', completed_at=NULL WHERE id=?`, [id])
    } else {
      const [[pending]] = await pool.query(`SELECT COUNT(*) AS c FROM discharge_approvals WHERE discharge_id=? AND status='Pending'`, [id])
      if (pending.c === 0) await pool.query(`UPDATE discharges SET status='Completed', completed_at=NOW() WHERE id=?`, [id])
    }

    res.json({ ok: true })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// List discharges for current user (doctor or patient) with approvals
router.get('/my', auth, async (req, res) => {
  try {
    const role = String(req.user.role).toLowerCase()
    if (!['patient','doctor'].includes(role)) return res.status(403).json({ message: 'Forbidden' })
    const where = role === 'doctor' ? 'd.doctor_id=?' : 'd.patient_id=?'
    const [rows] = await pool.query(
      `SELECT d.id, d.type, d.diagnosis, d.treatment, d.remarks, d.follow_up_date, d.status AS overall_status,
              d.created_at, d.completed_at,
              p.id AS patient_id, p.name AS patient_name,
              doc.id AS doctor_id, doc.name AS doctor_name
         FROM discharges d
         JOIN users p   ON p.id=d.patient_id
         JOIN users doc ON doc.id=d.doctor_id
        WHERE ${where}
        ORDER BY d.id DESC
        LIMIT 50`,
      [req.user.id]
    )
    if (!rows.length) return res.json({ rows: [] })
    const ids = rows.map(r => r.id)
    const [appr] = await pool.query(
      `SELECT discharge_id, department, status, details, reviewed_by, reviewed_at
         FROM discharge_approvals
        WHERE discharge_id IN (${ids.map(()=>'?').join(',')})
        ORDER BY discharge_id, department`,
      ids
    )
    const map = new Map(rows.map(r => [r.id, { ...r, approvals: [] }]))
    for (const a of appr) map.get(a.discharge_id)?.approvals.push(a)
    res.json({ rows: Array.from(map.values()) })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// GET /discharges/:id/summary
router.get('/:id/summary', async (req, res) => {
  const { id } = req.params;
  try {
    // Main discharge info
    const [summaryRows] = await pool.query(`
      SELECT
        d.id AS discharge_id,
        d.type AS discharge_type,
        d.diagnosis,
        d.treatment,
        d.remarks AS final_notes,
        d.follow_up_date,
        d.status AS discharge_status,
        d.created_at AS admission_date,
        d.completed_at AS discharge_date,
        p.id AS patient_id,
        p.name AS patient_name,
        p.patient_code,
        p.gender,
        p.age,
        p.contact,
        p.department AS patient_department,
        doc.id AS doctor_id,
        doc.name AS doctor_name,
        doc.specialization
      FROM discharges d
      JOIN users p ON p.id = d.patient_id
      JOIN users doc ON doc.id = d.doctor_id
      WHERE d.id = ?
      LIMIT 1
    `, [id]);
    if (!summaryRows.length) return res.status(404).json({ error: 'Not found' });

    // Approvals
    const [approvals] = await pool.query(
      'SELECT department, details AS remarks, status FROM discharge_approvals WHERE discharge_id = ?', [id]
    );

    // Admission fee (fixed)
    const admission_fee = 500;

    // Pharmacy bills for this patient
    const patientId = summaryRows[0].patient_id;
    const [pharmacyBills] = await pool.query(
      `SELECT total_amount FROM pharmacy_bills WHERE patient_id = ?`, [patientId]
    );
    const pharmacy_total = pharmacyBills.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);

    res.json({
      ...summaryRows[0],
      approvals,
      admission_fee,
      pharmacy_total
    });
  } catch (err) {
    console.error('Discharge summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router