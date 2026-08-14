const express = require('express')
const router = express.Router()
const pool = require('../db')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

async function generatePatientCode() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const ymd = `${year}${month}${day}`
  
  // Ensure prefix is exactly 11 characters: P-YYYYMMDD-
  const prefix = `P-${ymd}-`
  
  // Validate prefix length (should be 11: P-YYYYMMDD-)
  if (prefix.length !== 11) {
    console.error(`Invalid prefix length: ${prefix} (${prefix.length} chars)`)
    // Emergency fallback with current date
    const fallbackYmd = `${year}${month}${day}`
    const fallbackPrefix = `P-${fallbackYmd}-`
    const randomSeq = Math.floor(Math.random() * 9000) + 1000
    const code = `${fallbackPrefix}${String(randomSeq).padStart(4, '0')}`
    return code.slice(0, 15) // Ensure max 15 chars
  }
  
  try {
    // Get the maximum sequence number for today's date
    const [[row]] = await pool.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(patient_code, 11, 4) AS UNSIGNED)), 0) AS seq
         FROM users 
         WHERE patient_code LIKE ? AND LENGTH(patient_code) = 15`, 
      [`${prefix}%`]
    )
    
    let seq = parseInt(row?.seq || 0, 10)
    if (isNaN(seq)) seq = 0
    seq = seq + 1
    
    // Ensure seq is between 1 and 9999 (4 digits max)
    if (seq > 9999) seq = 1
    if (seq < 1) seq = 1
    
    // Try to find an available code
    for (let i = 0; i < 100; i++) {
      // Ensure seq is always a valid number between 1-9999
      seq = ((seq - 1) % 9999) + 1
      const seqStr = String(seq).padStart(4, '0')
      
      // Build code: P-YYYYMMDD-XXXX (total 15 chars)
      const code = prefix + seqStr
      
      // Strict validation: code must be exactly 15 characters
      if (code.length !== 15) {
        console.error(`Invalid patient_code length: "${code}" (${code.length} chars). Prefix: "${prefix}" (${prefix.length}), Seq: "${seqStr}" (${seqStr.length})`)
        seq = seq + 1
        continue
      }
      
      // Check if code already exists
      const [[exists]] = await pool.query(`SELECT id FROM users WHERE patient_code=? LIMIT 1`, [code])
      if (!exists) {
        // Final validation before returning
        if (code.length === 15 && code.match(/^P-\d{8}-\d{4}$/)) {
          return code
        }
      }
      seq = seq + 1
    }
    
    // Fallback: random 4-digit suffix (1000-9999)
    const randomSeq = Math.floor(Math.random() * 9000) + 1000
    const seqStr = String(randomSeq).padStart(4, '0')
    const code = prefix + seqStr
    
    // Final validation
    if (code.length === 15) {
      return code
    }
    
    // Emergency fallback: ensure we never return more than 15 chars
    const emergencyCode = (prefix + seqStr).slice(0, 15)
    return emergencyCode.padEnd(15, '0').slice(0, 15)
    
  } catch (err) {
    console.error('Error generating patient code:', err)
    // Emergency fallback: always return exactly 15 characters
    const randomSeq = Math.floor(Math.random() * 9000) + 1000
    const seqStr = String(randomSeq).padStart(4, '0')
    const code = prefix + seqStr
    return code.slice(0, 15) // Force max 15 chars
  }
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, gender, age, contact, role = 'patient', department, specialization } = req.body
    if (!email || !password || !name) return res.status(400).json({ message: 'Missing required fields' })

    // use id (not user_id)
    const [exists] = await pool.query('SELECT id FROM users WHERE email=?', [email])
    if (exists.length) return res.status(400).json({ message: 'Email already registered' })

    const hash = await bcrypt.hash(password, 10)

    // Task 1: If department is selected, automatically set role to department name (lowercase)
    let finalRole = role
    if (department) {
      // Map department to role (Pharmacy -> pharmacy, Insurance -> insurance, etc.)
      finalRole = department.toLowerCase()
      // Special handling: if department is Reception, Staff, or Doctor, keep original role
      if (['reception', 'staff', 'doctor'].includes(finalRole)) {
        finalRole = role // Keep the selected role for these departments
      }
    }

    // Insert user with role, department, and specialization
    const [result] = await pool.query(
      'INSERT INTO users (name,email,password,role,gender,age,contact,department,specialization) VALUES (?,?,?,?,?,?,?,?,?)',
      [name, email, hash, finalRole, gender || null, age || null, contact || null, department || null, specialization || null]
    )

    let patient_code = null
    if (String(finalRole).toLowerCase() === 'patient') {
      patient_code = await generatePatientCode()
      
      // Strict validation and truncation: ensure code is exactly 15 characters
      if (!patient_code) {
        // Emergency fallback
        const now = new Date()
        const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
        const randomSeq = Math.floor(Math.random() * 9000) + 1000
        patient_code = `P-${ymd}-${String(randomSeq).padStart(4,'0')}`
      }
      
      // Force truncation to exactly 15 characters if longer
      if (patient_code.length > 15) {
        console.error(`Patient code too long: "${patient_code}" (${patient_code.length} chars), truncating to 15`)
        patient_code = patient_code.slice(0, 15)
      }
      
      // Ensure it's exactly 15 characters (pad if somehow shorter)
      if (patient_code.length < 15) {
        console.error(`Patient code too short: "${patient_code}" (${patient_code.length} chars)`)
        const now = new Date()
        const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
        const randomSeq = Math.floor(Math.random() * 9000) + 1000
        patient_code = `P-${ymd}-${String(randomSeq).padStart(4,'0')}`
      }
      
      // Final validation: must be exactly 15 characters
      if (patient_code && patient_code.length === 15) {
        try {
          await pool.query(
            `UPDATE users SET patient_code = ? WHERE id = ?`,
            [patient_code, result.insertId]
          )
        } catch (updateErr) {
          console.error(`Failed to update patient_code: ${updateErr.message}`)
          console.error(`Code: "${patient_code}", Length: ${patient_code.length}`)
          // Don't fail registration, just log the error
        }
      } else {
        console.error(`Failed to generate valid patient_code for user ${result.insertId}. Code: "${patient_code}", Length: ${patient_code?.length || 0}`)
      }
    }

    const responseUser = { id: result.insertId, name, email, role: finalRole, department: department || null, patient_code }
    const token = jwt.sign(
      { sub: result.insertId, role: finalRole, email },
      process.env.JWT_SECRET || 'devsecret',
      { expiresIn: '7d' }
    )

    return res.json({ id: result.insertId, patient_code, role: finalRole, token, user: responseUser })
  } catch (err) {
  console.error("Registration Error:");
  console.error(err);

  res.status(500).json({
    message: err.message,
    code: err.code,
    sqlMessage: err.sqlMessage,
    sqlState: err.sqlState
  });
}
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Missing credentials' })

    // use id (not user_id)
    const [rows] = await pool.query('SELECT id,name,email,password,role,department FROM users WHERE email=?', [email])
    if (!rows.length) return res.status(401).json({ message: 'Invalid credentials' })
    const user = rows[0]

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' })

    const token = jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET || 'devsecret',
      { expiresIn: '7d' }
    )

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /users - Register new user (patient/staff/doctor)
router.post('/users', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      gender,
      age,
      contact,
      role,
      department,
      specialization,
      patient_code
    } = req.body

    // Validate required fields
    if (
      !name ||
      !email ||
      !password ||
      !gender ||
      !age ||
      !contact ||
      !role ||
      typeof department === 'undefined' ||
      typeof specialization === 'undefined' ||
      !patient_code
    ) {
      return res.status(400).json({ success: false, message: 'Missing required fields' })
    }

    // Check for duplicate email
    const [emailRows] = await db.query('SELECT id FROM users WHERE email = ?', [email])
    if (emailRows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already exists' })
    }

    // Check for duplicate patient_code
    const [codeRows] = await db.query('SELECT id FROM users WHERE patient_code = ?', [patient_code])
    if (codeRows.length > 0) {
      return res.status(400).json({ success: false, message: 'Patient code already exists' })
    }

    // Hash password
    const bcrypt = require('bcrypt')
    const hashed = await bcrypt.hash(password, 10)

    // Insert user
    const [result] = await db.query(
      `INSERT INTO users
        (name, email, password, role, gender, age, contact, department, specialization, patient_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        email,
        hashed,
        role,
        gender,
        age,
        contact,
        department,
        specialization,
        patient_code
      ]
    )

    return res.json({ success: true, message: 'Patient created', id: result.insertId })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Duplicate entry' })
    }
    console.error('User registration error:', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
})

module.exports = router