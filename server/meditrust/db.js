// ================== MediTrust MongoDB Connection ==================
// Separate database connection for the MediTrust (counterfeit medicine
// detection) module. This keeps the MongoDB-based MediTrust data model
// isolated from the MySQL-based SwasthAashra hospital data model, while
// both run inside the same Express server/process.

const mongoose = require('mongoose')

const MONGO_URI = process.env.MEDITRUST_MONGO_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/meditrust'

let connected = false

async function connectMediTrustDB() {
  if (connected) return mongoose.connection
  try {
    await mongoose.connect(MONGO_URI)
    connected = true
    console.log('MediTrust MongoDB connected:', MONGO_URI)
  } catch (err) {
    console.error('MediTrust MongoDB connection failed:', err.message)
    console.error('The Medicine Verification module will be unavailable until MongoDB is reachable.')
  }
  return mongoose.connection
}

function isMediTrustDBConnected() {
  return mongoose.connection.readyState === 1
}

// Express middleware: guards MediTrust routes so they fail with a clean
// 503 (instead of hanging/crashing) if MongoDB isn't reachable.
function requireMediTrustDB(req, res, next) {
  if (!isMediTrustDBConnected()) {
    return res.status(503).json({
      message: 'Medicine Verification service is temporarily unavailable (database not connected).'
    })
  }
  next()
}

module.exports = { connectMediTrustDB, isMediTrustDBConnected, requireMediTrustDB, mongoose }
