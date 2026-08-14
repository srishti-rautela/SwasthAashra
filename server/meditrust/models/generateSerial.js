const { randomBytes } = require("crypto");
function normalizeBatchNo(batchNo) {
  return String(batchNo || "B")
    .trim()
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase() || "B";
}

function getDatePart() {
  const d = new Date();
  return (
    d.getFullYear().toString().slice(-2) +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  );
}

function getTimePart() {
  const d = new Date();
  return (
    String(d.getHours()).padStart(2, "0") +
    String(d.getMinutes()).padStart(2, "0")
  );
}

function getRandomPart() {
  // base36 
  return parseInt(randomBytes(2).toString("hex"), 16)
    .toString(36)
    .toUpperCase()
    .slice(0, 3);
}

function generateSerial(batchNo) {
  const batch = normalizeBatchNo(batchNo);

  return `${batch}-${getDatePart()}-${getTimePart()}-${getRandomPart()}`;
}

module.exports = { generateSerial };