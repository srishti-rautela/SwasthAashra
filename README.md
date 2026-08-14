# SwasthAashra 🏥 + MediTrust 💊 (Merged)

This project merges the **MediTrust** counterfeit-medicine detection
platform into **SwasthAashra**, so hospital staff and patients can verify
medicine authenticity without leaving the SwasthAashra app.

Both original apps are fully preserved and working — this integration adds
MediTrust's Medicine Verification module as a self-contained section at
`/medicine`, reachable from the SwasthAashra landing page nav, the Patient
dashboard, and the Pharmacy dashboard.

---

## What changed vs. the two original repos

**Nothing in the original SwasthAashra hospital features was removed or
rewritten.** Appointments, records, billing, doctor/patient/staff/pharmacy
dashboards — all unchanged and still run on MySQL exactly as before.

MediTrust was ported in as an additional module, **not merged into the same
database**, because the two apps model completely different things (hospital
staff/patients in MySQL vs. patients/manufacturers/admins verifying medicine
serials in MongoDB). Forcing them into one schema would have meant rewriting
MediTrust's data model from scratch and was more likely to break things than
help. Instead:

- **One Express server, two databases.** `server/index.js` still connects to
  MySQL for all the original SwasthAashra routes. It now *also* connects to
  MongoDB (via `server/meditrust/db.js`) and mounts MediTrust's routes under
  `/api/meditrust/*`. If MongoDB isn't configured/running, only the
  `/medicine` section is affected — the rest of the hospital app keeps
  working normally (this is enforced by a `requireMediTrustDB` guard).
- **One React app, one router, two auth systems.** The MediTrust pages live
  in `client/src/meditrust/` and are mounted at `/medicine/*` inside the
  existing SwasthAashra router (`client/src/App.jsx`). MediTrust keeps its
  own login (`/medicine/login`) and its own token (stored as
  `meditrust_token`, separate from SwasthAashra's `token`), because a
  hospital "doctor" or "patient" account and a MediTrust "manufacturer"
  account are not the same kind of user. A "← SwasthAashra" link inside the
  MediTrust navbar and a "Verify Medicine" link in the main app's nav/dashboards
  tie the two together for a seamless user experience.
- **Fully responsive.** Both the SwasthAashra landing page (which previously
  had a non-functional mobile menu button) and the MediTrust pages now work
  correctly on mobile, tablet, and desktop widths.

See `server/meditrust/`, `client/src/meditrust/` for all the new code, and
search for `MediTrust` in `client/src/App.jsx` / `server/index.js` to see
exactly how it's wired in.

---

## Project structure

```
swasthashra/
├── client/                  # React + Vite frontend (single app)
│   └── src/
│       ├── pages/           # Original SwasthAashra pages
│       ├── meditrust/       # Ported MediTrust module (mounted at /medicine)
│       └── App.jsx          # Router — mounts /medicine/* here
└── server/                  # Express backend (single server, two DBs)
    ├── routes/              # Original SwasthAashra routes (MySQL)
    ├── meditrust/           # Ported MediTrust routes/models (MongoDB)
    ├── db.js                # MySQL connection
    └── index.js             # Mounts both API surfaces
```

---

## Getting started

### Prerequisites
- Node.js v18+
- MySQL (for the hospital features — appointments, billing, records, etc.)
- MongoDB — local `mongod` or a free [MongoDB Atlas](https://www.mongodb.com/atlas)
  cluster (for the Medicine Verification / MediTrust features)

### 1. Install dependencies

```bash
cd server
npm install

cd ../client
npm install
```

### 2. Configure environment variables

**`server/.env`** (already present, edit as needed):

```env
PORT=4000
DB_HOST=localhost
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=swasthashra
DB_PORT=3306
JWT_SECRET=replace_with_secure_secret

# MediTrust (Medicine Verification) module
MONGO_URI=mongodb://127.0.0.1:27017/meditrust
MEDITRUST_JWT_SECRET=replace_with_a_different_secure_secret
```

If `MONGO_URI` is unreachable, the server still starts and the hospital
features work fine — only `/api/meditrust/*` (and the `/medicine` pages)
will return a "temporarily unavailable" message until MongoDB is reachable.

**`client/.env`** (optional, only needed for the AI MediBot chat widget):

```env
VITE_GROQ_API_KEY=your_groq_api_key_here
```

### 3. Set up the databases

**MySQL** — run the existing SwasthAashra schema:
```bash
mysql -u root -p swasthashra < server/sql/init_all.sql
```

**MongoDB** — no manual schema setup needed; Mongoose creates collections
automatically on first use.

### 4. Run the app

Two terminals:

```bash
# Terminal 1 — backend (serves both APIs on port 4000)
cd server
npm run dev

# Terminal 2 — frontend
cd client
npm run dev
```

Open **http://localhost:5173**.

- Hospital app: `/`, `/auth`, `/dashboard/:role`, etc. (unchanged)
- Medicine Verification: `/medicine` — register/login as a `patient`,
  `manufacturer`, or `admin` to try batch registration, QR verification,
  fake-medicine reporting, the admin risk heatmap, and manufacturer
  analytics.

### 5. Build for production

```bash
cd client
npm run build   # outputs client/dist
```

Serve `client/dist` with any static host, pointed at the running
`server` API (update `VITE_MEDITRUST_API_URL` / the hospital API base URL
in `client/src/utils/api.js` if the API isn't on `localhost:4000`).

---

## Known limitations

- The MediTrust "prescription OCR" upload button (in Verify Medicine) calls
  an endpoint (`/api/ocr/prescription`) that was never implemented in the
  original MediTrust backend either — it fails gracefully with a toast, same
  as in the standalone MediTrust project. Wiring up real OCR is out of scope
  for this integration.
- Hospital accounts and MediTrust accounts are intentionally separate logins.
  A patient who wants to use both needs to register once in each system.
