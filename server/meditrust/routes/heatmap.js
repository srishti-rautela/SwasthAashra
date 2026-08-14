const express = require("express");
const VerificationLog = require("../models/VerificationLog.js");
const Report = require("../models/Report.js");
const { protect, authorizeRoles } = require("../middleware/auth.js");
const router = express.Router();
const CITY_COORDS = {
  "New York": { lat: 40.7128, lng: -74.006 },
  London: { lat: 51.5074, lng: -0.1278 },
  Delhi: { lat: 28.7041, lng: 77.1025 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Karachi: { lat: 24.8607, lng: 67.0011 },
  Lagos: { lat: 6.5244, lng: 3.3792 },
  Unknown: null,
};

const GEOCODE_CACHE = new Map();

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function normalizeCity(city) {
  return (city || "Unknown").replace(/\s+/g, " ").trim() || "Unknown";
}

function canonicalCityKey(city) {
  return normalizeCity(city)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "") || "unknown";
}

function getRiskProfile({ incidents = 0, fake = 0, reports = 0 }) {
  const scanTotal = Math.max(incidents, 1);
  const reportRate = reports / scanTotal;
  const fakeRate = fake / scanTotal;
  const reportPressure = reports * 1.8;
  const fakePressure = fake * 2.5;
  const ratePressure = (reportRate * 100) * 0.6 + (fakeRate * 100) * 0.8;
  const burstPressure = incidents >= 25 ? 3 : incidents >= 10 ? 2 : incidents >= 4 ? 1 : 0;
  const score = Math.round(reportPressure + fakePressure + ratePressure + burstPressure);

  if (reports >= 4 || fakeRate >= 0.5 || score >= 18) {
    return { riskStatus: "high", riskScore: score, label: "High Risk", reason: `High report/fake rate (${Math.round(reportRate * 100)}% reports, ${Math.round(fakeRate * 100)}% fake)` };
  }

  if (reports >= 2 || fakeRate >= 0.25 || score >= 9) {
    return { riskStatus: "suspicious", riskScore: score, label: "Suspicious", reason: `Moderate alerts (${Math.round(reportRate * 100)}% reports, ${Math.round(fakeRate * 100)}% fake)` };
  }

  return { riskStatus: "safe", riskScore: score, label: "Safe", reason: "Low report and fake scan ratio" };
}

function titleCase(city) {
  return normalizeCity(city)
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

async function geocodeCity(city) {
  const normalized = normalizeCity(city);
  if (!normalized || normalized.toLowerCase() === "unknown") return null;

  const cached = GEOCODE_CACHE.get(canonicalCityKey(normalized));
  if (cached) return cached;

  const direct = CITY_COORDS[normalized] || CITY_COORDS[titleCase(normalized)];
  if (direct) {
    GEOCODE_CACHE.set(normalized.toLowerCase(), { ...direct, source: "lookup" });
    return { ...direct, source: "lookup" };
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("q", normalized);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "MediTrust/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) throw new Error(`Geocoding failed with status ${response.status}`);

    const data = await response.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) return null;

    const coords = {
      lat: Number(first.lat),
      lng: Number(first.lon),
      source: "geocoded",
    };

    if (Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
      GEOCODE_CACHE.set(normalized.toLowerCase(), coords);
      return coords;
    }
  } catch (error) {
    console.warn(`Geocoding skipped for ${normalized}:`, error?.message || error);
  }

  return null;
}

function mergeCityStats(targetMap, city, patch) {
  const key = canonicalCityKey(city);
  const current = targetMap.get(key) || {
    city: titleCase(city),
    incidents: 0,
    fake: 0,
    reports: 0,
    aliases: [],
  };

  const displayName = titleCase(city);
  if (!current.aliases.includes(displayName)) {
    current.aliases.push(displayName);
  }
  current.city = current.city === "Unknown" ? displayName : current.city;
  current.incidents += patch.incidents || 0;
  current.fake += patch.fake || 0;
  current.reports += patch.reports || 0;
  targetMap.set(key, current);
}

// Admin hotspot summary by city
router.get("/hotspots", protect, authorizeRoles("admin"), async (req, res) => {
  try {
    const [verificationAgg, reportAgg] = await Promise.all([
      VerificationLog.aggregate([
        { $match: { city: { $nin: [null, ""] } } },
        {
          $group: {
            _id: "$city",
            incidents: { $sum: 1 },
            fake: { $sum: { $cond: [{ $in: ["$status", ["fake", "unknown"]] }, 1, 0] } },
          },
        },
      ]),
      Report.aggregate([
        { $match: { city: { $nin: [null, ""] } } },
        { $group: { _id: "$city", reports: { $sum: 1 } } },
      ]),
    ]);

    const cityMap = new Map();
    verificationAgg.forEach((row) => mergeCityStats(cityMap, row._id, { incidents: row.incidents, fake: row.fake }));
    reportAgg.forEach((row) => mergeCityStats(cityMap, row._id, { reports: row.reports }));

    const hotspotEntries = Array.from(cityMap.values()).sort((a, b) => b.incidents + b.reports + b.fake - (a.incidents + a.reports + a.fake));

    const hotspots = await Promise.all(
      hotspotEntries.map(async (entry) => {
        const coords = await geocodeCity(entry.city);
        const risk = getRiskProfile({ incidents: entry.incidents, fake: entry.fake, reports: entry.reports });
        return {
          city: entry.city,
          aliases: entry.aliases,
          incidents: entry.incidents,
          fake: entry.fake,
          reports: entry.reports,
          coords,
          ...risk,
        };
      }),
    );

    hotspots.sort((a, b) => b.riskScore - a.riskScore || b.reports - a.reports || b.incidents - a.incidents);

    res.json({ hotspots });
  } catch (err) {
    console.error("GET /api/heatmap/hotspots failed:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;