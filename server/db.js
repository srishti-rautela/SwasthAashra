const mysql = require('mysql2/promise')

const databaseUrl = process.env.DATABASE_URL

// SSL is required by most cloud MySQL hosts (Railway, Aiven, PlanetScale, etc.)
// but a typical local MySQL install does NOT have SSL enabled, so forcing it
// on breaks local development. Set DB_SSL=true in .env only when connecting
// to a cloud database that requires it.
const useSSL = String(process.env.DB_SSL || '').toLowerCase() === 'true'

let pool

if (databaseUrl) {
  const url = new URL(databaseUrl)

  pool = mysql.createPool({
    host: url.hostname,
    port: Number(url.port) || 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    waitForConnections: true,
    connectionLimit: 10,
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
  })
} else {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '2025',
    database: process.env.DB_NAME || 'swasthashra',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
  })
}

module.exports = pool
