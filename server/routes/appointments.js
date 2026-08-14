const express = require('express')
const router = express.Router()
const pool = require('../db')
const auth = require('../middleware/auth')
const allowRoles = require('../middleware/roles')
const upload = require('../middleware/upload')

// helper: check availability (avoid double-booking for confirmed slots)
async function checkAvailability({ patientUserId, doctorId, date, time }) {
  const [[pClash]] = await pool.query(
    `SELECT appointment_id FROM appointments
     WHERE patient_user_id=? AND appointment_date=? AND appointment_time=? AND status='Confirmed' LIMIT 1`,
    [patientUserId, date, time]
  )
  if (pClash) return { ok: false, msg: 'You already have an appointment at this time' }

  const [[dClash]] = await pool.query(
    `SELECT appointment_id FROM appointments
     WHERE doctor_id=? AND appointment_date=? AND appointment_time=? AND status='Confirmed' LIMIT 1`,
    [doctorId, date, time]
  )
  if (dClash) return { ok: false, msg: 'Doctor is busy at the selected time' }

  return { ok: true }
}

// GET /api/appointments
router.get('/', auth, async (req, res) => {
  try {
    const scope = String(req.query.scope || '').toLowerCase()
    const when = String(req.query.when || (scope === 'doctor' ? 'upcoming' : 'all')).toLowerCase()

    const where = []
    const params = []
    let sql =
      `SELECT a.appointment_id AS id, a.patient_user_id, a.patient_id, a.doctor_id,
              a.appointment_date, a.appointment_time, a.reason, a.status, a.created_at,
              p.name AS patient_name, d.name AS doctor_name
       FROM appointments a
       JOIN users p ON p.id=a.patient_user_id
       JOIN users d ON d.id=a.doctor_id`

    if (scope === 'doctor') {
      where.push('a.doctor_id=?', "a.status='Confirmed'")
      params.push(req.user.id)
    } else if (scope === 'patient') {
      where.push('a.patient_user_id=?')
      params.push(req.user.id)
    } else if (scope === 'staff') {
      // staff sees upcoming all (no approvals)
      where.push('a.appointment_date>=CURDATE()')
    }

    if (when === 'today') where.push('a.appointment_date=CURDATE()')
    else if (when === 'upcoming') where.push('a.appointment_date>=CURDATE()')

    if (where.length) sql += ' WHERE ' + where.join(' AND ')
    sql += ' ORDER BY a.appointment_date, a.appointment_time'

    const [rows] = await pool.query(sql, params)
    res.json({ rows })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// POST /api/appointments — patient books → Confirmed immediately + assign
router.post('/', auth, upload.array('attachments', 5), async (req, res) => {
  try {
    const { doctorId, date, time, reason } = req.body
    if (!doctorId || !date || !time) return res.status(400).json({ message: 'Missing fields' })

    const [[doc]] = await pool.query(`SELECT id, name FROM users WHERE id=? AND role='doctor' LIMIT 1`, [doctorId])
    if (!doc) return res.status(400).json({ message: 'Invalid doctor' })
    const [[pat]] = await pool.query(`SELECT id, name, patient_code FROM users WHERE id=? LIMIT 1`, [req.user.id])
    if (!pat?.patient_code) return res.status(400).json({ message: 'Patient profile incomplete' })

    // clash check only against Confirmed slots
    const [[dClash]] = await pool.query(
      `SELECT appointment_id FROM appointments
       WHERE doctor_id=? AND appointment_date=? AND appointment_time=? AND status='Confirmed' LIMIT 1`,
      [doc.id, date, time]
    )
    if (dClash) return res.status(400).json({ message: 'Doctor is busy at that time' })

    const [ins] = await pool.query(
      `INSERT INTO appointments (patient_user_id, patient_id, doctor_id, appointment_date, appointment_time, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Confirmed')`,
      [pat.id, pat.patient_code, doc.id, date, time, reason || null]
    )
    const apptId = ins.insertId

    if (req.files?.length) {
      const vals = req.files.map(f => [apptId, f.filename, f.originalname, f.mimetype, f.size])
      await pool.query(
        `INSERT INTO appointment_files (appointment_id, filename, original_name, mime_type, size) VALUES ?`,
        [vals]
      )
    }

    // directly assign to chosen doctor
    await pool.query(
      `INSERT IGNORE INTO doctor_patient_assignments (doctor_id, patient_id) VALUES (?, ?)`,
      [doc.id, pat.id]
    )

    // notify patient and doctor of confirmation
    await pool.query(
      `INSERT INTO notifications (user_id, message, is_read) VALUES (?, ?, 0), (?, ?, 0)`,
      [
        pat.id, `Your appointment with ${doc.name} is confirmed for ${date} ${time}`,
        doc.id, `New appointment confirmed: ${pat.name} (${pat.patient_code}) on ${date} ${time}`
      ]
    )

    res.json({ ok: true, appointment_id: apptId, status: 'Confirmed' })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// POST /api/appointments/staff — staff creates → Confirmed immediately + assign
router.post('/staff', auth, allowRoles('staff','admin'), async (req, res) => {
  try {
    const { patientRef, doctorId, date, time, reason } = req.body
    if (!patientRef || !doctorId || !date || !time) return res.status(400).json({ message: 'Missing fields' })

    let pat
    if (/^P-\d{8}-\d{4}$/i.test(String(patientRef))) {
      [[pat]] = await pool.query(`SELECT id, name, patient_code FROM users WHERE patient_code=? LIMIT 1`, [patientRef])
    } else {
      [[pat]] = await pool.query(`SELECT id, name, patient_code FROM users WHERE id=? LIMIT 1`, [Number(patientRef)])
    }
    if (!pat) return res.status(400).json({ message: 'Patient not found' })

    const [[doc]] = await pool.query(`SELECT id, name FROM users WHERE id=? AND role='doctor' LIMIT 1`, [doctorId])
    if (!doc) return res.status(400).json({ message: 'Invalid doctor' })

    const avail = await checkAvailability({ patientUserId: pat.id, doctorId, date, time })
    if (!avail.ok) return res.status(400).json({ message: avail.msg })

    const [ins] = await pool.query(
      `INSERT INTO appointments (patient_user_id, patient_id, doctor_id, appointment_date, appointment_time, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Confirmed')`,
      [pat.id, pat.patient_code, doctorId, date, time, reason || null]
    )

    await pool.query(`INSERT IGNORE INTO doctor_patient_assignments (doctor_id, patient_id) VALUES (?, ?)`, [doc.id, pat.id])

    await pool.query(
      `INSERT INTO notifications (user_id, message, is_read) VALUES (?, ?, 0), (?, ?, 0)`,
      [
        pat.id, `Your appointment with ${doc.name} is confirmed for ${date} ${time}`,
        doc.id, `New appointment confirmed: ${pat.name} (${pat.patient_code}) on ${date} ${time}`
      ]
    )

    res.json({ ok: true, appointment_id: ins.insertId, status: 'Confirmed' })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// PATCH /api/appointments/:id — patient cancel or doctor complete
router.patch('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params
    const { action, date, time } = req.body

    if (action === 'cancel') {
      await pool.query(
        `UPDATE appointments SET status='Cancelled' WHERE appointment_id=? AND patient_user_id=? AND status IN ('Confirmed')`,
        [id, req.user.id]
      )
    } else if (action === 'reschedule') {
      const [[row]] = await pool.query(
        `SELECT patient_user_id, doctor_id FROM appointments WHERE appointment_id=? AND patient_user_id=?`,
        [id, req.user.id]
      )
      if (!row) return res.status(404).json({ message: 'Not found' })
      const avail = await checkAvailability({ patientUserId: row.patient_user_id, doctorId: row.doctor_id, date, time })
      if (!avail.ok) return res.status(400).json({ message: avail.msg })
      await pool.query(
        `UPDATE appointments SET appointment_date=?, appointment_time=?, status='Confirmed' WHERE appointment_id=? AND patient_user_id=?`,
        [date, time, id, req.user.id]
      )
    } else if (action === 'complete') {
      await pool.query(
        `UPDATE appointments SET status='Completed' WHERE appointment_id=? AND doctor_id=?`,
        [id, req.user.id]
      )
    } else if (action === 'confirm') {
      // allow doctor to revert back to Confirmed
      await pool.query(
        `UPDATE appointments SET status='Confirmed' WHERE appointment_id=? AND doctor_id=?`,
        [id, req.user.id]
      )
    } else if (action === 'toggle') {
      // toggle between Confirmed and Completed by doctor
      await pool.query(
        `UPDATE appointments
            SET status = IF(status='Confirmed','Completed','Confirmed')
          WHERE appointment_id=? AND doctor_id=? AND status IN ('Confirmed','Completed')`,
        [id, req.user.id]
      )
    }

    // return the latest status
    const [[row]] = await pool.query(
      `SELECT appointment_id AS id, status FROM appointments WHERE appointment_id=? LIMIT 1`,
      [id]
    )
    res.json({ ok: true, id: row?.id, status: row?.status })
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// --- utils for slot scanning (local to this file) ---
const _pad = (n) => String(n).padStart(2,'0')
const _toHM = (n) => `${_pad(Math.floor(n/60))}:${_pad(n%60)}`
const _toMin = (hm) => { const [h='0',m='0']=String(hm).slice(0,5).split(':'); return (+h)*60 + (+m) }
const _addDaysISO = (iso, add) => {
  const d = new Date(iso); d.setDate(d.getDate()+add)
  return `${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())}`
}

// GET /api/appointments/next-free?doctorId=&fromDate=&fromTime=&slot=30&days=14
router.get('/next-free', auth, async (req, res) => {
  try {
    const doctorId = req.query.doctorId
    const fromDate = req.query.fromDate
    const fromTime = (req.query.fromTime || '00:00').slice(0,5)
    const slot = Math.max(15, Number(req.query.slot || 30))  // minutes
    const days = Math.min(Number(req.query.days || 14), 60)

    if (!doctorId || !fromDate) {
      return res.status(400).json({ message: 'doctorId and fromDate are required' })
    }

    // Working window (adjust if you have per-doctor schedule)
    const workStart = _toMin('09:00')
    const workEnd   = _toMin('17:00')

    for (let di = 0; di < days; di++) {
      const dateISO = di === 0 ? fromDate : _addDaysISO(fromDate, di)

      // Fetch existing confirmed times for this doctor and date
      const [rows] = await pool.query(
        `SELECT appointment_time FROM appointments
          WHERE doctor_id=? AND appointment_date=? AND status='Confirmed'`,
        [doctorId, dateISO]
      )
      const busySet = new Set(rows.map(r => String(r.appointment_time).slice(0,5)))

      // Align start time on first day
      let startMin = workStart
      if (dateISO === fromDate) {
        const fm = _toMin(fromTime)
        startMin = Math.max(workStart, Math.ceil(fm/slot) * slot)
      }

      // Scan slots
      for (let t = startMin; t + slot <= workEnd; t += slot) {
        const hm = _toHM(t)
        if (!busySet.has(hm)) {
          return res.json({ date: dateISO, time: hm })
        }
      }
    }

    // No exact free slot; suggest a few earliest on the last checked day
    const lastDay = _addDaysISO(fromDate, Math.max(0, days-1))
    const [rows2] = await pool.query(
      `SELECT appointment_time FROM appointments
        WHERE doctor_id=? AND appointment_date=? AND status='Confirmed'`,
      [doctorId, lastDay]
    )
    const busyLast = new Set(rows2.map(r => String(r.appointment_time).slice(0,5)))
    const suggestions = []
    for (let t = workStart; t + slot <= workEnd && suggestions.length < 4; t += slot) {
      const hm = _toHM(t)
      if (!busyLast.has(hm)) suggestions.push(hm)
    }
    return res.json({ date: null, time: null, suggestions })
  } catch (e) {
    console.error('next-free error:', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/appointments/availability?doctorId=&date=&time=
router.get('/availability', auth, async (req, res) => {
  try {
    const { doctorId, date, time } = req.query
    if (!doctorId || !date || !time) {
      return res.status(400).json({ message: 'doctorId, date, time are required' })
    }
    const [[row]] = await pool.query(
      `SELECT appointment_id FROM appointments
         WHERE doctor_id=? AND appointment_date=? AND appointment_time=? AND status='Confirmed'
         LIMIT 1`,
      [doctorId, date, String(time).slice(0,5)]
    )
    return res.json({ available: !row })
  } catch (e) {
    console.error('availability error:', e?.message || e)
    return res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router