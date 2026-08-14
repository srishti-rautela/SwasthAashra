# MediTrust module (server-side)

Ported from the standalone MediTrust project. Uses MongoDB (via Mongoose)
independently of the main SwasthAashra MySQL database — see the root
`README.md` for the reasoning and how the two databases coexist.

- `db.js` — MongoDB connection + `requireMediTrustDB` guard middleware
- `models/` — Mongoose schemas (User, Medicine, Report, VerificationLog)
- `routes/` — Express routers, mounted in `../index.js` under `/api/meditrust`:
  - `auth.js` → `/api/meditrust/auth` (register/login)
  - `medicine.js` → `/api/meditrust/medicines` (register, verify, history, dashboards, recall)
  - `report.js` → `/api/meditrust/reports` (crowdsourced reports, admin analytics)
  - `heatmap.js` → `/api/meditrust/heatmap` (admin geo hotspots)
- `middleware/auth.js` — JWT auth (`protect`, `authorizeRoles`), using its
  own `MEDITRUST_JWT_SECRET` so tokens issued here are never valid on the
  hospital (`/api/auth`) routes and vice versa.

All business logic (risk scoring, suspicious-flag detection, trust scores,
etc.) is unchanged from the original MediTrust project — only the module
system (ES modules → CommonJS, to match the rest of the SwasthAashra
server) and import paths were changed.
