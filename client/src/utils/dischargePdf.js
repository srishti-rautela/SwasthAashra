// ================== Imports ==================
import api from '../utils/api'
import { toast } from 'react-toastify'

// ================== jsPDF Loader ==================
const ensureJsPDF = () =>
  new Promise((resolve, reject) => {
    if (window.jspdf?.jsPDF) return resolve(window.jspdf.jsPDF);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    s.onload = () => resolve(window.jspdf.jsPDF);
    s.onerror = reject;
    document.body.appendChild(s);
  });

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ================== Download Helpers ==================
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ================== Server Summary/PDF Fetchers ==================
const tryServerPdf = async (id) => {
  // Remove all .pdf endpoints, since they don't exist
  return null;
};

const trySummaryJson = async (id) => {
  const jsonPaths = [
    `/discharges/${id}/summary`
  ];
  for (const path of jsonPaths) {
    try {
      const res = await fetch(`/api${path}`);
      if (res.ok) return await res.json();
    } catch {}
  }
  return null;
}

// ================== Fallback Summary Builder ==================
const toSummaryFromRequest = (req) => {
  if (!req || typeof req !== 'object') return null

  const approvals = Array.isArray(req.approvals) ? req.approvals : []
  const department_remarks = approvals.map(a => ({
    department: a.department || a.dept || a.name,
    remark: a.details || a.remark || a.notes || a.comment || a.status,
    status: a.status
  }))

  const pharmacy = req.pharmacy || req.pharmacy_details || {}
  const pharmacyItems =
    pharmacy.items ||
    req.pharmacy_items ||
    req.medicineItems ||
    req.items ||
    []

  const bill = req.bill || req.billing || {}
  const charges = bill.charges || req.charges || []
  const total_amount =
    bill.total ||
    bill.total_amount ||
    req.total_amount ||
    req.bill_total_amount ||
    (Array.isArray(charges) ? charges.reduce((s, c) => s + Number(c.amount || 0), 0) : 0)

  return {
    id: req.id,
    type: req.type || req.discharge_type,
    patient_name: req.patient_name,
    patient_code: req.patient_code || req.patient_id,
    admission_no: req.admission_no,
    admission_date: req.admission_date,
    doctor_name: req.doctor_name,
    diagnosis: req.diagnosis,
    follow_up_date: req.follow_up_date,
    medications: req.prescribed_medicines || req.medicines || req.meds || [],
    pharmacy: { items: pharmacyItems },
    department_remarks,
    bill: { charges, total: total_amount },
    total_amount
  }
}

// ================== PDF Builder ==================
export const buildPdfFromSummary = async (summary, filename) => {
  const jsPDF = await ensureJsPDF();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  // Load images
  const logoImg = await loadImage('/photos/logo.png');
  console.log("Logo loaded");
  const stampImg = await loadImage('/photos/verified_stamp.png');
  console.log("Stamp loaded");

  // Header: Logo
  doc.addImage(logoImg, 'PNG', pageWidth/2 - 60, y, 120, 60);
  y += 80;

  // Watermark
  doc.setGState(new doc.GState({ opacity: 0.10 }));
  doc.addImage(logoImg, 'PNG', pageWidth/2 - 150, 250, 300, 180);
  doc.setGState(new doc.GState({ opacity: 1 }));

  // Title
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('FINAL DISCHARGE SUMMARY', pageWidth/2, y, { align: 'center' });
  y += 36;

  // Section: Patient Details
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Patient Details', margin, y); y += 20;
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  const labelX = margin;
  const valueX = margin + 170; // Increased spacing
  const rowGap = 22;

  doc.text(`Name:`, labelX, y); doc.text(`${summary.patient_name || ''}`, valueX, y); y += rowGap;
  doc.text(`Patient Code / ID:`, labelX, y); doc.text(`${summary.patient_code || summary.patient_id || ''}`, valueX, y); y += rowGap;
  doc.text(`Admission Number:`, labelX, y); doc.text(`${summary.patient_id || ''}`, valueX, y); y += rowGap;
  doc.text(`Admission Date:`, labelX, y); doc.text(`${summary.admission_date ? summary.admission_date.toString().slice(0,10) : ''}`, valueX, y); y += rowGap;
  doc.text(`Discharge / Transfer Type:`, labelX, y); doc.text(`${summary.discharge_type || ''}`, valueX, y); y += rowGap + 6;

  // Section: Doctor & Diagnosis
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('2. Doctor & Diagnosis', margin, y); y += 20;
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text(`Attending Doctor:`, margin, y); doc.text(`${summary.doctor_name || ''}`, margin+120, y); y += 18;
  doc.text(`Final Diagnosis:`, margin, y); doc.text(`${summary.diagnosis || ''}`, margin+120, y); y += 18;
  doc.text(`Follow-Up Date & Time:`, margin, y); doc.text(`${summary.follow_up_date || ''}`, margin+120, y); y += 28;

  // Section: Department Clearance Remarks
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('3. Department Clearance Remarks', margin, y); y += 20;
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text('Department', margin, y);
  doc.text('Remarks', margin+120, y);
  doc.text('Status', margin+320, y); y += 16;
  doc.setDrawColor(200); doc.line(margin, y, pageWidth-margin, y); y += 8;
  (summary.approvals || []).forEach(a => {
    doc.text(`${a.department}`, margin, y);
    doc.text(`${a.remarks || ''}`, margin+120, y, { maxWidth: 180 });
    doc.text(`${a.status}`, margin+320, y);
    y += 16;
  });
  y += 12;

  // Section: Billing Summary
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('4. Billing Summary', margin, y); y += 20;
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  const admissionFee = parseFloat(summary.admission_fee || 0);
  const pharmacyBill = parseFloat(summary.pharmacy_total || 0);
  // If you have a hospital bill, add it here
  // const hospitalBill = parseFloat(summary.hospital_bill || 0);
  // const totalBill = admissionFee + pharmacyBill + hospitalBill;
  const totalBill = admissionFee + pharmacyBill;

  doc.text(`Admission Fee:`, margin, y); doc.text(`₹${admissionFee.toFixed(2)}`, margin+120, y); y += 16;
  doc.text(`Pharmacy Bill:`, margin, y); doc.text(`₹${pharmacyBill.toFixed(2)}`, margin+120, y); y += 16;
  // doc.text(`Hospital Bill:`, margin, y); doc.text(`₹${hospitalBill.toFixed(2)}`, margin+120, y); y += 16;
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Bill:`, margin, y); doc.text(`₹${totalBill.toFixed(2)}`, margin+120, y); y += 24;
  doc.setFont('helvetica', 'normal');

  // Section: Final Notes / Instructions
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('5. Final Notes / Instructions', margin, y); y += 20;
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text(summary.final_notes || '-', margin, y, { maxWidth: pageWidth - 2*margin }); y += 32;

  // Signatures section
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('6. Signatures', margin, y); y += 24;

  // Patient sign (left), Doctor sign+stamp (right)
  const signY = y + 40;
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text('Patient / Family Signature:', margin, signY);

  // Doctor stamp image above signature (right)
  const doctorSignX = pageWidth - margin - 180;
  doc.addImage(stampImg, 'PNG', doctorSignX + 60, signY - 50, 80, 80); // Stamp above name
  doc.text('Doctor’s Signature & Stamp:', doctorSignX, signY + 40);

  y = signY + 80;

  // Well message at the end
  doc.setFontSize(13); doc.setFont('helvetica', 'bolditalic');
  doc.setTextColor(34, 139, 34);
  doc.text('We wish you a speedy recovery and good health. — Team SwasthAshra', pageWidth/2, y, { align: 'center' });

  // Build filename if not provided
  // Always build filename as NAME_TYPE_clearance_pdf.pdf
  const name = (summary.patient_name || 'patient').replace(/\s+/g, '_');
  const type = (summary.discharge_type || 'discharge').replace(/\s+/g, '_');
  filename = `${name}_${type}_clearance_pdf.pdf`;

  doc.save(filename);
};

// ================== Public API ==================
export const downloadDischargePdf = async (reqOrId) => {
  const id = typeof reqOrId === 'object' ? reqOrId.id : reqOrId
  const reqObj = typeof reqOrId === 'object' ? reqOrId : null
  try {
    const blob = await tryServerPdf(id)
    if (blob) {
      downloadBlob(blob, `Discharge-${id}.pdf`)
      return
    }
    const summary = await trySummaryJson(id)
    if (summary) {
      await buildPdfFromSummary(summary, `Discharge-${id}.pdf`)
      return
    }
    const baked = toSummaryFromRequest(reqObj)
    if (baked) {
      await buildPdfFromSummary(baked, `Discharge-${id}.pdf`)
      return
    }
    toast.error('No discharge summary available')
  } catch {
    toast.error('Failed to download discharge PDF')
  }
}