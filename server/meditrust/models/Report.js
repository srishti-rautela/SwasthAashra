const mongoose = require("mongoose");
const reportSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  medicine: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", default: null },
  serial: { type: String, default: "" },
  type: { type: String, default: "suspicious" },
  city: { type: String, default: "Unknown" },
  message: { type: String, required: true },
  status: { type: String, enum: ["open", "reviewing", "closed"], default: "open" },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model("Report", reportSchema);