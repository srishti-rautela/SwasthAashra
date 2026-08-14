const mysql = require('mysql2/promise')

// SSL is required by most cloud MySQL hosts (Railway, Aiven, PlanetScale, etc.)
// but a typical local MySQL install does NOT have SSL enabled, so forcing it
// on breaks local development. Set DB_SSL=true in .env only when connecting
// to a cloud database that requires it.
const useSSL = String(process.env.DB_SSL || '').toLowerCase() === 'true'

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '2025',
  database: process.env.DB_NAME || 'swasthashra',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
})

module.exports = pool
