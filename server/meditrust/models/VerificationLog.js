const mongoose = require("mongoose");
const verificationLogSchema = new mongoose.Schema({
  serial: { type: String, required: true },
  medicine: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", default: null },
  status: { type: String, enum: ["genuine", "expired", "fake", "unknown"], required: true },
  checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  city: { type: String, default: "Unknown" },
  ipAddress: { type: String, default: "" },
  suspiciousFlags: [{ type: String }],
  checkedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model("VerificationLog", verificationLogSchema);