const express = require("express");
const Medicine = require("../models/Medicine.js");
const VerificationLog = require("../models/VerificationLog.js");
const User = require("../models/User.js");
const Report = require("../models/Report.js");
const { generateSerial } = require("../models/generateSerial.js");
const { protect, authorizeRoles } = require("../middleware/auth.js");
const router = express.Router();

function formatMedicine(medicine) {
  if (!medicine) return null;
  return {
    _id: medicine._id,
    name: medicine.name,
    manufacturer: medicine.manufacturer?.name || medicine.manufacturer || "Unknown",
    manufacturerId: medicine.manufacturer?._id || medicine.manufacturer,
    batchNo: medicine.batchNo || "LEGACY-BATCH",
    serialNo: medicine.serialNo || medicine.serial,
    expiryDate: medicine.expiryDate || medicine.expiry,
    dosage: medicine.dosage,
    composition: medicine.composition,
    isRecalled: medicine.isRecalled,
    recallReason: medicine.recallReason,
  };
}

async function detectSuspiciousFlags({ serial, city, status }) {
  const flags = [];

  if (["fake", "unknown"].includes(status)) {
    flags.push("counterfeit-signal");
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [serialScans24h, cityRisk24h, serialCities, recentBurst] = await Promise.all([
    VerificationLog.countDocuments({ serial, checkedAt: { $gte: oneDayAgo } }),
    VerificationLog.countDocuments({ city, status: { $in: ["fake", "unknown"] }, checkedAt: { $gte: oneDayAgo } }),
    VerificationLog.distinct("city", { serial, checkedAt: { $gte: oneDayAgo } }),
    VerificationLog.countDocuments({ serial, checkedAt: { $gte: oneHourAgo } }),
  ]);

  if (serialScans24h >= 10 || recentBurst >= 6) {
    flags.push("high-frequency-scan");
  }

  if (cityRisk24h >= 3 && city !== "Unknown") {
    flags.push("city-cluster-alert");
  }

  if (serialCities.length >= 4) {
    flags.push("geo-anomaly");
  }

  return flags;
}
// Add medicine (manufacturer only)
router.post("/", protect, authorizeRoles("manufacturer", "admin"), async (req, res) => {
  try {
    const { name, batchNo, expiryDate, dosage, composition } = req.body;

    // validation
    if (!name || !batchNo || !expiryDate) {
      return res.status(400).json({ message: "name, batchNo and expiryDate are required" });
    }

    const medicine = await Medicine.create({
      name,
      manufacturer: req.user.id,
      batchNo,
      serialNo: generateSerial(batchNo),
      expiryDate,
      dosage: dosage || "",
      composition: composition || "",
    });

    res.status(201).json(formatMedicine(medicine));

  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Serial number already exists" });
    }
    if (err?.name === "ValidationError" || err?.name === "CastError") {
      return res.status(400).json({ message: err.message || "Invalid medicine payload" });
    }

    console.error("POST /api/medicines failed:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Verify medicine
router.post("/verify", protect, async (req, res) => {
  try {
    const serial = (req.body.serial || "").trim();
    const city = (req.body.city || "Unknown").trim() || "Unknown";

    if (!serial) {
      return res.status(400).json({ message: "Serial number is required" });
    }

    const medicine = await Medicine.findOne({
      $or: [{ serialNo: serial }, { serial }],
    }).populate("manufacturer", "name");

    let status = "fake";
    if (medicine) {
      const expiryDate = medicine.expiryDate || medicine.expiry;
      if (medicine.isRecalled) {
        status = "fake";
      } else if (expiryDate && new Date(expiryDate) < new Date()) {
        status = "expired";
      } else {
        status = "genuine";
      }
    }

    const suspiciousFlags = await detectSuspiciousFlags({ serial, city, status });

    // Reports and duplicate-scan metrics
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const reportCount = await Report.countDocuments({ serial });
    const serialScans24h = await VerificationLog.countDocuments({ serial, checkedAt: { $gte: oneDayAgo } });

    // Risk scoring heuristic
    let riskScore = 0;
    if (reportCount >= 1) riskScore += 2;
    if (reportCount >= 3) riskScore += 2;
    if ((suspiciousFlags || []).length > 0) riskScore += 1;
    if (serialScans24h >= 10) riskScore += 2;
    if (serialScans24h >= 25) riskScore += 2; // very high scan volume
    // city-level fake signals handled inside suspiciousFlags

    const riskLevel = riskScore >= 5 ? "high" : riskScore >= 2 ? "suspicious" : "safe";

    const verification = await VerificationLog.create({
      serial,
      medicine: medicine?._id || null,
      status,
      checkedBy: req.user.id,
      city,
      ipAddress: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "",
      suspiciousFlags,
    });

    // Compute basic pharmacy/manufacturer trust metrics (best-effort)
    let manufacturerTrust = null;
    if (medicine && medicine.manufacturer) {
      const manufacturerId = medicine.manufacturer._id || medicine.manufacturer;
      const manufacturerMedicines = await Medicine.find({ manufacturer: manufacturerId }).select("serialNo");
      const serials = manufacturerMedicines.map((m) => m.serialNo);
      const manufacturerVerifications = serials.length ? await VerificationLog.countDocuments({ serial: { $in: serials } }) : 0;
      const manufacturerFake = serials.length ? await VerificationLog.countDocuments({ serial: { $in: serials }, status: { $in: ["fake", "unknown"] } }) : 0;
      const manufacturerReports = serials.length ? await Report.countDocuments({ serial: { $in: serials } }) : 0;

      const fakeReportPct = manufacturerVerifications ? Math.round((manufacturerFake / Math.max(1, manufacturerVerifications)) * 100) : 0;
      const fakeReportRatio = manufacturerReports ? Math.round((manufacturerReports / Math.max(1, manufacturerVerifications)) * 100) : 0;
      const trustScore = 100 - Math.min(80, fakeReportPct + fakeReportRatio);

      manufacturerTrust = {
        manufacturerId,
        verifications: manufacturerVerifications,
        fakeDetections: manufacturerFake,
        reports: manufacturerReports,
        fakePercent: fakeReportPct,
        reportPercent: fakeReportRatio,
        trustScore,
      };
    }

    res.json({
      status,
      medicine: formatMedicine(medicine),
      city,
      checkedAt: verification.checkedAt,
      suspiciousFlags,
      reportCount,
      duplicateScans24h: serialScans24h,
      riskLevel,
      manufacturerTrust,
    });
  } catch (err) {
    console.error("POST /api/medicines/verify failed:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// User verification history with timeline, map and suspicious pattern detection
router.get("/history", protect, async (req, res) => {
  try {
    const logs = await VerificationLog.find({ checkedBy: req.user.id })
      .sort({ checkedAt: -1 })
      .limit(200)
      .populate("medicine", "name batchNo serialNo");

    const timeline = logs.map((log) => ({
      id: log._id,
      serial: log.serial,
      status: log.status,
      city: log.city || "Unknown",
      checkedAt: log.checkedAt,
      suspiciousFlags: log.suspiciousFlags || [],
      medicineName: log.medicine?.name || "Unknown medicine",
      batchNo: log.medicine?.batchNo || "N/A",
    }));

    const cityCounts = {};
    const statusCounts = { genuine: 0, fake: 0, expired: 0, unknown: 0 };
    let suspiciousEvents = 0;

    timeline.forEach((item) => {
      cityCounts[item.city] = (cityCounts[item.city] || 0) + 1;
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      if ((item.suspiciousFlags || []).length > 0) {
        suspiciousEvents += 1;
      }
    });

    const suspiciousPatterns = [];
    if (statusCounts.fake + statusCounts.unknown >= 3) {
      suspiciousPatterns.push({ type: "repeat-counterfeit-risk", message: "Multiple fake/unknown scans detected in your history." });
    }
    if (suspiciousEvents >= 2) {
      suspiciousPatterns.push({ type: "flagged-scan-pattern", message: "Repeated suspicious flags were detected across your scans." });
    }

    res.json({
      timeline,
      mapData: Object.entries(cityCounts)
        .map(([city, totalScans]) => ({ city, totalScans }))
        .sort((a, b) => b.totalScans - a.totalScans),
      statusCounts,
      suspiciousPatterns,
    });
  } catch (err) {
    console.error("GET /api/medicines/history failed:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin realtime dashboard
router.get("/admin/dashboard", protect, authorizeRoles("admin"), async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalMedicines,
      totalUsers,
      pendingReports,
      todayVerifications,
      todayFakes,
      liveFeed,
      fakeHotspotsAgg,
      dailyAgg,
    ] = await Promise.all([
      Medicine.countDocuments(),
      User.countDocuments(),
      Report.countDocuments({ status: "open" }),
      VerificationLog.countDocuments({ checkedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
      VerificationLog.countDocuments({
        status: { $in: ["fake", "unknown"] },
        checkedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
      VerificationLog.find({})
        .sort({ checkedAt: -1 })
        .limit(20)
        .populate("checkedBy", "name role")
        .populate("medicine", "name"),
      VerificationLog.aggregate([
        { $match: { status: { $in: ["fake", "unknown"] }, city: { $ne: "Unknown" } } },
        { $group: { _id: "$city", incidents: { $sum: 1 } } },
        { $sort: { incidents: -1 } },
        { $limit: 8 },
      ]),
      VerificationLog.aggregate([
        { $match: { checkedAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$checkedAt" } },
            total: { $sum: 1 },
            fake: {
              $sum: {
                $cond: [{ $in: ["$status", ["fake", "unknown"]] }, 1, 0],
              },
            },
            genuine: {
              $sum: {
                $cond: [{ $eq: ["$status", "genuine"] }, 1, 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const dailyTrends = dailyAgg.map((day) => ({
      date: day._id,
      total: day.total,
      fake: day.fake,
      genuine: day.genuine,
    }));

    res.json({
      stats: {
        totalMedicines,
        totalUsers,
        pendingReports,
        verifiedToday: todayVerifications,
        fakeDetected: todayFakes,
      },
      liveFeed: liveFeed.map((log) => ({
        id: log._id,
        serial: log.serial,
        status: log.status,
        city: log.city,
        checkedAt: log.checkedAt,
        medicine: log.medicine?.name || "Unknown",
        user: log.checkedBy?.name || "Unknown user",
      })),
      fakeHotspots: fakeHotspotsAgg.map((h) => ({ city: h._id, incidents: h.incidents })),
      dailyTrends,
    });
  } catch (err) {
    console.error("GET /api/medicines/admin/dashboard failed:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Manufacturer analytics dashboard
router.get("/manufacturer/dashboard", protect, authorizeRoles("manufacturer", "admin"), async (req, res) => {
  try {
    const manufacturerId = req.user.id;

    const medicines = await Medicine.find({ manufacturer: manufacturerId }).sort({ createdAt: -1 });
    const serials = medicines.map((m) => m.serialNo);

    const logs = serials.length
      ? await VerificationLog.find({ serial: { $in: serials } }).sort({ checkedAt: -1 }).limit(400)
      : [];

    const scansBySerial = {};
    const cityScans = {};
    const suspiciousAlerts = [];

    logs.forEach((log) => {
      scansBySerial[log.serial] = (scansBySerial[log.serial] || 0) + 1;
      cityScans[log.city || "Unknown"] = (cityScans[log.city || "Unknown"] || 0) + 1;
      if ((log.suspiciousFlags || []).length > 0 || ["fake", "unknown"].includes(log.status)) {
        suspiciousAlerts.push({
          id: log._id,
          serial: log.serial,
          city: log.city || "Unknown",
          status: log.status,
          checkedAt: log.checkedAt,
          flags: log.suspiciousFlags || [],
        });
      }
    });

    const medicineRows = medicines.map((m) => ({
      _id: m._id,
      name: m.name,
      batchNo: m.batchNo,
      serialNo: m.serialNo,
      expiryDate: m.expiryDate,
      dosage: m.dosage,
      composition: m.composition,
      isRecalled: m.isRecalled,
      recallReason: m.recallReason,
      verifications: scansBySerial[m.serialNo] || 0,
    }));

    const batchesMap = {};
    medicineRows.forEach((m) => {
      if (!batchesMap[m.batchNo]) {
        batchesMap[m.batchNo] = {
          batchNo: m.batchNo,
          totalUnits: 0,
          recalled: false,
          recallReason: "",
          totalScans: 0,
        };
      }
      batchesMap[m.batchNo].totalUnits += 1;
      batchesMap[m.batchNo].totalScans += m.verifications;
      if (m.isRecalled) {
        batchesMap[m.batchNo].recalled = true;
        batchesMap[m.batchNo].recallReason = m.recallReason;
      }
    });

    const batches = Object.values(batchesMap).sort((a, b) => b.totalScans - a.totalScans);

    res.json({
      stats: {
        totalRegistered: medicineRows.length,
        totalVerifications: logs.length,
        activeBatches: batches.filter((b) => !b.recalled).length,
        recalledBatches: batches.filter((b) => b.recalled).length,
      },
      medicines: medicineRows,
      batches,
      topCities: Object.entries(cityScans)
        .map(([city, scans]) => ({ city, scans }))
        .sort((a, b) => b.scans - a.scans)
        .slice(0, 8),
      suspiciousAlerts: suspiciousAlerts.slice(0, 20),
    });
  } catch (err) {
    console.error("GET /api/medicines/manufacturer/dashboard failed:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Recall entire batch
router.patch("/batches/:batchNo/recall", protect, authorizeRoles("manufacturer", "admin"), async (req, res) => {
  try {
    const { batchNo } = req.params;
    const { reason } = req.body;

    const filter = { batchNo };
    if (req.user.role === "manufacturer") {
      filter.manufacturer = req.user.id;
    }

    const result = await Medicine.updateMany(filter, {
      $set: {
        isRecalled: true,
        recallReason: reason || "Marked recalled by manufacturer",
        recalledAt: new Date(),
      },
    });

    if (!result.matchedCount) {
      return res.status(404).json({ message: "Batch not found" });
    }

    res.json({ message: `Batch ${batchNo} recalled successfully` });
  } catch (err) {
    console.error("PATCH /api/medicines/batches/:batchNo/recall failed:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;