// ================== Imports ==================

// ---------- Environment ----------
require('dotenv').config()

// ---------- Core and App Setup ----------
const path = require('path')
const express = require('express')
const cors = require('cors')
const app = express()
const pool = require('./db')

// ---------- Route Modules ----------
const authRoutes = require('./routes/auth')
const doctorsRoutes = require('./routes/doctors')
const doctorRoutes = require('./routes/doctor')
const appointmentsRoutes = require('./routes/appointments')
const dischargesRoutes = require('./routes/discharges')
const prescriptionsRoutes = require('./routes/prescriptions')
const pharmacyRoutes = require('./routes/pharmacy')
const billingRoutes = require('./routes/billing')
const soloSalesRoutes = require('./routes/solo-sales')
const notificationsRoutes = require('./routes/notifications')
const documentsRouter = require('./routes/documents')
const registerPatientRoute = require('./routes/register-patient')
const patientsRoutes = require('./routes/patients')

// ---------- MediTrust (Counterfeit Medicine Detection) Module ----------
const { connectMediTrustDB, requireMediTrustDB } = require('./meditrust/db')
const meditrustAuthRoutes = require('./meditrust/routes/auth')
const meditrustMedicineRoutes = require('./meditrust/routes/medicine')
const meditrustReportRoutes = require('./meditrust/routes/report')
const meditrustHeatmapRoutes = require('./meditrust/routes/heatmap')


// ================== Middleware ==================
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
app.use('/api', documentsRouter)


// ================== Routes ==================
app.use('/api/auth', authRoutes)
app.use('/api/doctors', doctorsRoutes)
app.use('/api/doctor', doctorRoutes)
app.use('/api/appointments', appointmentsRoutes)
app.use('/api/discharges', dischargesRoutes)
app.use('/api/prescriptions', prescriptionsRoutes)
app.use('/api/pharmacy', pharmacyRoutes)
app.use('/api/solo-sales', soloSalesRoutes)
app.use('/api/billing', billingRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/register-patient', registerPatientRoute)
app.use('/api/patients', patientsRoutes)

// ---------- MediTrust Routes (Medicine Verification / Anti-Counterfeit) ----------
// Mounted under /api/meditrust/* and backed by MongoDB (separate from the
// MySQL hospital database). See server/meditrust/README.md for details.
app.use('/api/meditrust/auth', requireMediTrustDB, meditrustAuthRoutes)
app.use('/api/meditrust/medicines', requireMediTrustDB, meditrustMedicineRoutes)
app.use('/api/meditrust/reports', requireMediTrustDB, meditrustReportRoutes)
app.use('/api/meditrust/heatmap', requireMediTrustDB, meditrustHeatmapRoutes)


// ================== Health Check ==================
app.get('/health', async (req, res) => {
  const { isMediTrustDBConnected } = require('./meditrust/db')
  let mysqlOk = true
  let mysqlError = null
  try {
    // @@TEST_DB_CONNECTION
    await pool.query('SELECT 1')
  } catch (err) {
    mysqlOk = false
    mysqlError = err.message
  }
  const mongoOk = isMediTrustDBConnected()
  res.status(mysqlOk ? 200 : 503).json({
    status: mysqlOk ? 'ok' : 'error',
    database: mysqlOk ? 'connected' : 'disconnected',
    error: mysqlError || undefined,
    meditrust: { database: mongoOk ? 'connected' : 'disconnected' }
  })
})


// ================== Error Handling ==================

// ---------- Global Error Middleware ----------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ message: 'Internal server error', error: process.env.NODE_ENV === 'development' ? err.message : undefined })
})


// ================== Process Event Handlers ==================

// ---------- Unhandled Promise Rejections ----------
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// ---------- Uncaught Exceptions ----------
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
  process.exit(1)
})


// ================== Graceful Shutdown ==================
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...')
  pool.end()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...')
  pool.end()
  process.exit(0)
})


// ================== Startup ==================
async function startServer() {
  try {
    // @@TEST_DB_CONNECTION
    await pool.query('SELECT 1')
    console.log('DB connection successful')

    // Connect to MongoDB for the MediTrust module. This runs in the
    // background and never blocks the hospital (MySQL) API from starting -
    // if MongoDB isn't reachable, only /api/meditrust/* routes are affected.
    connectMediTrustDB()

    // @@START_SERVER
    const PORT = process.env.PORT || 4000
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`API running on http://0.0.0.0:${PORT} (all network interfaces)`);
    })
    
    // @@HANDLE_SERVER_ERROR
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please use a different port.`)
        process.exit(1)
      } else {
        console.error('Server error:', err)
        process.exit(1)
      }
    })
    
  } catch (err) {
    console.error('Failed to start server:', err.message)
    console.error('Check your database connection and .env file')
    process.exit(1)
  }
}

startServer()