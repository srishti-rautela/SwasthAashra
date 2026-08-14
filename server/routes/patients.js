const express = require('express')
const router = express.Router()
const pool = require('../db')
const auth = require('../middleware/auth')

// GET /api/patients/:id/history
// Returns a combined timeline (appointments + prescriptions + discharges)
// for a given patient, most recent first. This route did not exist before -
// the Doctor Dashboard's "View History" button called it but nothing was
// listening, which is why it always showed "Failed to load history".
router.get('/:id/history', auth, async (req, res) => {
  try {
    const patientId = Number(req.params.id)
    if (!patientId) return res.status(400).json({ message: 'Invalid patient id' })

    const [rows] = await pool.query(
      `
      SELECT appointment_date AS date,
             'Appointment' AS type,
             CONCAT('Status: ', status, IF(reason IS NOT NULL AND reason <> '', CONCAT(' — ', reason), '')) AS notes
        FROM appointments
       WHERE patient_user_id = ?

      UNION ALL

      SELECT created_at AS date,
             CONCAT('Prescription (', status, ')') AS type,
             medicines AS notes
        FROM prescriptions
       WHERE patient_id = ?

      UNION ALL

      SELECT created_at AS date,
             CONCAT(type, ' (', status, ')') AS type,
             CONCAT(diagnosis, IF(treatment IS NOT NULL AND treatment <> '', CONCAT(' — ', treatment), '')) AS notes
        FROM discharges
       WHERE patient_id = ?

      ORDER BY date DESC
      LIMIT 200
      `,
      [patientId, patientId, patientId]
    )

    res.json({ rows })
  } catch (e) {
    console.error('Patient history error:', e)
    res.status(500).json({ message: 'Server error while loading patient history' })
  }
})

module.exports = router
