const express = require('express')
const router = express.Router()
const pool = require('../db')
const auth = require('../middleware/auth')

router.get('/', auth, async (req, res) => {
  try {
    try {
      const [rows] = await pool.query(
        `SELECT id, message, is_read, created_at
           FROM notifications
          WHERE user_id=?
          ORDER BY created_at DESC`,
        [req.user.id]
      )
      return res.json({ rows })
    } catch (e) {
      if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e
      const [rows] = await pool.query(
        `SELECT id, message, created_at
           FROM notifications
          WHERE user_id=?
          ORDER BY created_at DESC`,
        [req.user.id]
      )
      return res.json({ rows: rows.map(r => ({ ...r, is_read: 0 })) })
    }
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// Mark one as read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    try {
      await pool.query(`UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?`, [req.params.id, req.user.id])
      res.json({ ok: true })
    } catch (e) {
      if (e?.code === 'ER_BAD_FIELD_ERROR') return res.json({ ok: true }) // ignore if column not present
      throw e
    }
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

module.exports = router