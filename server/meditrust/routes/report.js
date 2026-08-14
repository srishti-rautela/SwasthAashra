const express = require("express");
const Report = require("../models/Report.js");
const VerificationLog = require("../models/VerificationLog.js");
const Medicine = require("../models/Medicine.js");
const User = require("../models/User.js");
const { protect, authorizeRoles } = require("../middleware/auth.js");
const router = express.Router();

// Create a report (any authenticated user)
router.post("/", protect, async (req, res) => {
  try {
    const { message, medicineId, serial, type, city } = req.body;
    const report = await Report.create({
      user: req.user.id,
      medicine: medicineId || null,
      serial: serial || "",
      type: type || "suspicious",
      city: city || "Unknown",
      message: message || `Suspicious medicine reported for serial ${serial || "unknown"}`,
    });
    res.status(201).json(report);
  } catch (err) {
    console.error("POST /api/reports failed:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin: list reports with optional status filter
router.get("/", protect, authorizeRoles("admin"), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .populate("user", "name email")
      .populate("medicine", "name batchNo serialNo");
    res.json(reports);
  } catch (err) {
    console.error("GET /api/reports failed:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin analytics: batch risk and manufacturer trust scores
router.get("/analytics", protect, authorizeRoles("admin"), async (req, res) => {
  try {
    // Batch-level aggregation from reports and verification logs
    const batchAgg = await Report.aggregate([
      { $match: { serial: { $ne: "" } } },
      { $group: { _id: "$serial", reports: { $sum: 1 }, lastReport: { $max: "$createdAt" } } },
      { $sort: { reports: -1 } },
      { $limit: 200 },
    ]);

    // Map serial -> verification counts and fake counts
    const serials = batchAgg.map((b) => b._id).slice(0, 200);
    const verifications = serials.length
      ? await VerificationLog.aggregate([
          { $match: { serial: { $in: serials } } },
          { $group: { _id: "$serial", total: { $sum: 1 }, fake: { $sum: { $cond: [{ $in: ["$status", ["fake", "unknown"]] }, 1, 0] } } } },
        ])
      : [];

    const verMap = {};
    verifications.forEach((v) => {
      verMap[v._id] = v;
    });

    // Fetch medicine names for each serial
    const medicineMap = {};
    if (serials.length) {
      const medicines = await Medicine.find({ serialNo: { $in: serials } }).select("serialNo name");
      medicines.forEach((med) => {
        medicineMap[med.serialNo] = med.name;
      });
    }

    const batchRisk = batchAgg.map((b) => {
      const v = verMap[b._id] || { total: 0, fake: 0 };
      const fakePct = v.total ? Math.round((v.fake / v.total) * 100) : 0;
      const risk = b.reports >= 3 || fakePct >= 30 ? "high" : b.reports >= 1 || fakePct >= 10 ? "suspicious" : "safe";
      const riskScore = v.total > 0 ? Math.min(100, ((b.reports + v.fake) / v.total) * 100) : 0;
      return {
        serial: b._id,
        medicineName: medicineMap[b._id] || "Unknown",
        reports: b.reports,
        verifications: v.total || 0,
        fake: v.fake || 0,
        fakePct,
        riskScore,
        risk,
      };
    });

    // Manufacturer trust: compute simple score per manufacturer
    const manufacturers = await User.find({ role: "manufacturer" }).select("name company").limit(200);
    const manStats = [];
    for (const m of manufacturers) {
      const meds = await Medicine.find({ manufacturer: m._id }).select("serialNo");
      const s = meds.map((x) => x.serialNo);
      const totalVer = s.length ? await VerificationLog.countDocuments({ serial: { $in: s } }) : 0;
      const fakeCount = s.length ? await VerificationLog.countDocuments({ serial: { $in: s }, status: { $in: ["fake", "unknown"] } }) : 0;
      const reportsCount = s.length ? await Report.countDocuments({ serial: { $in: s } }) : 0;
      const fakePct = totalVer ? Math.round((fakeCount / Math.max(1, totalVer)) * 100) : 0;
      const reportPct = totalVer ? Math.round((reportsCount / Math.max(1, totalVer)) * 100) : 0;
      const trustScore = 100 - Math.min(80, fakePct + reportPct);
      manStats.push({ manufacturerId: m._id, name: m.name, company: m.company, totalVer, fakeCount, reportsCount, fakePct, reportPct, trustScore });
    }

    res.json({ batchRisk, manufacturerTrust: manStats });
  } catch (err) {
    console.error("GET /api/reports/analytics failed:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;