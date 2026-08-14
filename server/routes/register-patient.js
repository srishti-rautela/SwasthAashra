const express = require('express')
const router = express.Router()

// Example POST endpoint for registering a patient
router.post('/', (req, res) => {
  // TODO: Add registration logic here
  res.json({ message: 'Patient registered!' })
})

module.exports = router