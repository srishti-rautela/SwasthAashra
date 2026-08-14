const mongoose = require("mongoose");
const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  manufacturer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  batchNo: { type: String, required: true, index: true },
  serialNo: { type: String, required: true, index: true },
  expiryDate: { type: Date, required: true },
  dosage: { type: String, default: "" },
  composition: { type: String, default: "" },
  isRecalled: { type: Boolean, default: false },
  recallReason: { type: String, default: "" },
  recalledAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });


medicineSchema.virtual("expiry").get(function getExpiry() {
  return this.expiryDate;
});

medicineSchema.set("toJSON", { virtuals: true });
medicineSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Medicine", medicineSchema);