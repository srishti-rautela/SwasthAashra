// ================== Imports ==================
import { useEffect, useState } from 'react'
import api from '../utils/api'
import { toast } from 'react-toastify'
import { motion } from 'framer-motion' // Add this import at the top

// ================== Helpers ==================

const rowsOf = (res) => {
  const pick = (obj) => {
    if (!obj || typeof obj !== 'object') return []
    if (Array.isArray(obj)) return obj
    const keys = ['rows', 'data', 'items', 'results', 'list']
    for (const k of keys) {
      const v = obj[k]
      if (Array.isArray(v)) return v
    }
    // check one level deeper in common wrappers
    for (const k of ['data', 'result', 'payload', 'body', 'response']) {
      const arr = pick(obj[k])
      if (arr.length) return arr
    }
    return []
  }
  return pick(res?.data ?? res)
}

// ================== Config ==================
// Turn off noisy logs by default
const DEBUG_ENDPOINTS = false

// Read candidate paths from localStorage or env (Vite or CRA), else use defaults
const readPaths = (storageKey, envKeys, defaults) => {
  try {
    const ls = localStorage.getItem(storageKey)
    if (ls) {
      const arr = JSON.parse(ls)
      if (Array.isArray(arr) && arr.length) return arr
    }
  } catch {}
  try {
    const viteVal = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[envKeys[0]]
    const craVal = typeof process !== 'undefined' && process.env && process.env[envKeys[1]]
    const raw = viteVal || craVal
    if (raw) {
      const arr = String(raw).split(',').map(s => s.trim()).filter(Boolean)
      if (arr.length) return arr
    }
  } catch {}
  return defaults
}

const getFirstAvailable = async (paths) => {
  for (const path of paths) {
    try {
      const res = await api.get(path)
      return res
    } catch (e) {
      if (e?.response?.status === 404) continue
      // swallow other errors for non-critical widgets like solo-sales
      continue
    }
  }
  return { data: { rows: [] } }
}

// ================== Candidate Endpoints ==================
// Candidate endpoints with override capability
const REFERRAL_PATHS = readPaths(
  'REFERRAL_PATHS',
  ['VITE_REFERRAL_PATHS', 'REACT_APP_REFERRAL_PATHS'],
  [
    // Prefer prescriptions table with pharmacy scope
    '/prescriptions?scope=pharmacy',
    '/api/prescriptions?scope=pharmacy',
    // Fallbacks
    '/prescriptions',
    '/api/prescriptions',
    '/pharmacy/prescriptions',
    '/pharmacy/referrals',
    '/referrals',
    '/doctor/referrals',
    '/opd/prescriptions'
  ]
)

const SALES_PATHS = readPaths(
  'SALES_PATHS',
  ['VITE_SALES_PATHS', 'REACT_APP_SALES_PATHS'],
  ['/pharmacy/solo-sales', '/solo-sales', '/sales']
)

// ================== Normalizers ==================
// Normalize referrals from various backend shapes
const normalizeReferral = (r) => {
  const isQuick =
    String(r.type || '').toLowerCase() === 'quick' ||
    r.is_quick === true ||
    (!!r.medicine_name && !r.medicines && !r.items);

  return {
    id: r.id ?? r.prescription_id ?? r.rx_id,

    type: isQuick ? 'quick' : (r.type ?? 'regular'),

    patient_name:
      r.patient_name ||
      r.patientName ||
      r.patient?.name ||
      `${r.patient?.first_name || ''} ${r.patient?.last_name || ''}`.trim(),

    doctor_name:
      r.doctor_name ||
      r.doctorName ||
      r.doctor?.name,

    medicines:
      r.medicines ??
      r.meds ??
      (Array.isArray(r.items) ? r.items.map(i => i.name || i.medicine_name).join(', ') : ''),

    medicine_name: r.medicine_name, // for quick

    dosage: r.dosage,
    course_duration: r.course_duration,

    status: (r.status ?? r.bill_status ?? 'Pending').toString().replace(/^\w/, c => c.toUpperCase()),

    bill_total_amount:
      r.bill_total_amount ||
      r.total_amount ||
      r.bill?.total,

    bill_id: r.bill_id ?? r.bill?.id,
    rx: r.rx ?? r.rx_no ?? r.prescription_code,
    created_at: r.created_at ?? r.date ?? r.createdAt
  }
}

// ================== Component ==================
export default function PharmacyDashboard() {
  // ================== State ==================
  const [loading, setLoading] = useState(true)
  const [referrals, setReferrals] = useState([])
  const [soloSales, setSoloSales] = useState([])
  const [processingReferral, setProcessingReferral] = useState(null)
  const [medicineItems, setMedicineItems] = useState([{ batch_number: '', expiry_date: '', rate: '', quantity: '' }])
  const [paymentReceived, setPaymentReceived] = useState(false)

  // MATCH StaffDashboard logic
  const [dischargeReqs, setDischargeReqs] = useState([])
  const [detail, setDetail] = useState({})

  const [soloSaleForm, setSoloSaleForm] = useState({
    customerName: '',
    customerContact: '',
    items: [{ medicine_name: '', batch_number: '', expiry_date: '', rate: '', quantity: '' }]
  })
  const [showSoloSaleModal, setShowSoloSaleModal] = useState(false)

  // ================== Data Loaders & Effects ==================
  const loadData = async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const refsP = getFirstAvailable(REFERRAL_PATHS)
      const salesP = getFirstAvailable(SALES_PATHS)
      // fetch all, not only pending
      const dischargeP = api.get('/discharges/requests')

      const [refsRes, salesRes, dischargeRes] = await Promise.all([refsP, salesP, dischargeP])

      const rawRefs = rowsOf(refsRes)
      const normalized = rawRefs
        .map(normalizeReferral)
        // hide completed/dispensed from the main list
        .filter(r => r.status !== 'Completed' && r.status !== 'Dispensed')
        // newest first if timestamp present
        .sort((a, b) => (new Date(b.created_at || 0)) - (new Date(a.created_at || 0)))

      setReferrals(normalized)
      setSoloSales(rowsOf(salesRes))
      setDischargeReqs(dischargeRes?.data?.rows || dischargeRes?.data || [])
    } catch (err) {
      if (showLoading) toast.error('Failed to load data')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    loadData(true)
    // Auto-refresh every 10 seconds for real-time updates
    const interval = setInterval(() => loadData(false), 10000)
    return () => clearInterval(interval)
  }, [])

  // ================== Discharge Approvals ==================
  const act = async (id, action) => {
    try {
      await api.patch(`/discharges/${id}/approve`, { action, details: detail[id] || '' })
      toast.success(action === 'approve' ? 'Approved' : 'Rejected')
      // Update in-place so row stays visible
      setDischargeReqs(list =>
        list.map(r => r.id === id ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r)
      )
    } catch {
      toast.error('Failed')
    }
  }

  const isFullyApproved = (r) => {
    const status = String(r.status || '').toLowerCase()
    if (status === 'approved') return true
    if (r.allApproved === true) return true
    if (Array.isArray(r.approvals)) {
      return r.approvals.every(a =>
        String(a?.status ?? a).toLowerCase() === 'approved'
      )
    }
    return false
  }

  // ================== Discharge PDF ==================
  const ensureJsPDF = () =>
    new Promise((resolve, reject) => {
      if (window.jspdf?.jsPDF) return resolve(window.jspdf.jsPDF)
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
      s.onload = () => resolve(window.jspdf.jsPDF)
      s.onerror = reject
      document.body.appendChild(s)
    })

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

  const tryServerPdf = async (id) => {
    const pdfPaths = [
      `/discharges/${id}/summary.pdf`,
      `/discharges/${id}/pdf`,
      `/discharge/${id}/pdf`
    ]
    for (const path of pdfPaths) {
      try {
        const res = await api.get(path, { responseType: 'blob' })
        const ct = String(res?.headers?.['content-type'] || '')
        if (ct.includes('pdf') || path.endsWith('.pdf')) return res.data
      } catch (e) {
        if (e?.response?.status === 404) continue
      }
    }
    return null
  }

  const trySummaryJson = async (id) => {
    const jsonPaths = [
      `/discharges/${id}/summary`,
      `/discharges/${id}/details`,
      `/discharge/${id}/summary`
    ]
    for (const path of jsonPaths) {
      try {
        const res = await api.get(path)
        if (res?.data) return res.data
      } catch (e) {
        if (e?.response?.status === 404) continue
      }
    }
    return null
  }

  const buildPdfFromSummary = async (summary, filename = 'Discharge-Summary.pdf') => {
    try {
      const jsPDF = await ensureJsPDF()
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const margin = 40
      let y = margin

      const addText = (text, size = 11, bold = false) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal')
        doc.setFontSize(size)
        const lines = doc.splitTextToSize(String(text || ''), doc.internal.pageSize.getWidth() - margin * 2)
        lines.forEach(line => {
          if (y > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage()
            y = margin
          }
          doc.text(line, margin, y)
          y += 16
        })
      }

      const hline = () => {
        doc.setDrawColor(200)
        doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y)
        y += 12
      }

      // Extract with fallbacks
      const patient = summary.patient || summary.patient_details || {}
      const doctor = summary.doctor || summary.doctor_details || {}
      const diagnosis = summary.diagnosis || summary.doctor_diagnosis || ''
      const medications =
        summary.medications ||
        summary.prescribed_medicines ||
        summary.prescriptions ||
        summary.meds ||
        []
      const pharmacy =
        summary.pharmacy || summary.pharmacy_details || { items: summary.medicineItems || summary.items || [] }
      const remarks =
        summary.department_remarks ||
        summary.remarks ||
        summary.notes ||
        []
      const bill = summary.bill || summary.billing || {}
      const total =
        bill.total ||
        bill.total_amount ||
        summary.total_amount ||
        summary.bill_total ||
        0

      // Header
      addText('Final Discharge Summary', 18, true)
      hline()

      // Patient block
      addText('Patient Details', 14, true)
      addText(`Name: ${patient.name || summary.patient_name || ''}`)
      addText(`Patient Code: ${patient.code || patient.patient_code || summary.patient_code || summary.patient_id || ''}`)
      addText(`Age/Sex: ${patient.age ?? ''} ${patient.gender ? `/ ${patient.gender}` : ''}`)
      addText(`Admission No: ${patient.admission_no || summary.admission_no || ''}`)
      addText(`Admission Date: ${patient.admission_date || summary.admission_date || ''}`)
      addText(`Discharge/Transfer Type: ${summary.type || summary.discharge_type || ''}`)
      hline()

      // Doctor + diagnosis
      addText('Doctor & Diagnosis', 14, true)
      addText(`Doctor: ${doctor.name || summary.doctor_name || ''}`)
      addText(`Diagnosis: ${diagnosis}`)
      hline()

      // Prescribed medications (from doctor)
      if (Array.isArray(medications) ? medications.length : medications) {
        addText('Prescribed Medications', 14, true)
        if (Array.isArray(medications)) {
          medications.forEach((m, i) => addText(`${i + 1}. ${m.name || m.medicine_name || m}`))
        } else {
          addText(String(medications))
        }
        hline()
      }

      // Remarks from every department
      const remarksArr = Array.isArray(remarks)
        ? remarks
        : Object.entries(remarks || {}).map(([dept, val]) => ({ department: dept, remark: val?.remark || val }))
      if (remarksArr.length) {
        addText('Department Remarks', 14, true)
        remarksArr.forEach((r, i) => {
          const dept = r.department || r.dept || r.name || `Dept ${i + 1}`
          const text = r.remark || r.notes || r.comment || r.details || r
          addText(`${dept}: ${text}`)
        })
        hline()
      }

      // Pharmacy details
      const pItems = pharmacy.items || []
      if (pItems.length) {
        addText('Pharmacy Details', 14, true)
        pItems.forEach((it, i) => {
          const name = it.medicine_name || it.name || it.title || `Medicine ${i + 1}`
          const qty = it.quantity ?? it.qty ?? ''
          const rate = it.rate ?? it.price ?? ''
          addText(`${i + 1}. ${name}  Qty: ${qty}  Rate: ${rate ? `₹${rate}` : ''}`)
        })
        hline()
      }

      // Billing summary
      addText('Billing Summary', 14, true)
      const charges = summary.charges || bill.charges || []
      if (Array.isArray(charges) && charges.length) {
        charges.forEach((c) => {
          addText(`${c.head || c.name || 'Charge'}: ₹${Number(c.amount || 0).toFixed(2)}`)
        })
      }
      addText(`Total: ₹${Number(total || 0).toFixed(2)}`, 12, true)

      doc.save(filename)
    } catch {
      toast.error('Failed to generate PDF')
    }
  }

  const downloadDischargePdf = async (req) => {
    const id = req.id
    try {
      // 1) Try server-provided PDF
      const blob = await tryServerPdf(id)
      if (blob) {
        downloadBlob(blob, `Discharge-${id}.pdf`)
        return
      }
      // 2) Try summary JSON and build client-side PDF
      const summary = await trySummaryJson(id)
      if (summary) {
        await buildPdfFromSummary(summary, `Discharge-${id}.pdf`)
        return
      }
      toast.error('No discharge summary available')
    } catch {
      toast.error('Failed to download discharge PDF')
    }
  }

  // ================== Prescription Processing ==================
  // Helper: parse medicine names from a prescription (regular prescriptions)
  const parseMedicines = (ref) => {
    const source = ref?.medicines ?? ref?.meds
    if (!source) return []
    try {
      if (Array.isArray(source)) return source
      const maybeJson = JSON.parse(source)
      if (Array.isArray(maybeJson)) return maybeJson
      if (typeof maybeJson === 'string') {
        return maybeJson.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
      }
    } catch (_) {
      // fall back to splitting by comma/newline
    }
    return String(source)
      .split(/[\n,]/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.replace(/\s*[-(].*$/, '').trim())
  }

  useEffect(() => {
    if (!processingReferral) return
    setPaymentReceived(false)
    if (processingReferral.type === 'quick') {
      setMedicineItems([{
        medicine_name: processingReferral.medicine_name,
        batch_number: '',
        expiry_date: '',
        rate: '',
        quantity: ''
      }])
    } else {
      const names = parseMedicines(processingReferral)
      if (names.length) {
        setMedicineItems(
          names.map(name => ({
            medicine_name: name,
            batch_number: '',
            expiry_date: '',
            rate: '',
            quantity: ''
          }))
        )
      } else {
        setMedicineItems([{ batch_number: '', expiry_date: '', rate: '', quantity: '' }])
      }
    }
  }, [processingReferral])


  const handleProcessReferral = async () => {
    if (!processingReferral) return

    const validItems = medicineItems.filter(
      item => item.batch_number && item.expiry_date && item.rate && item.quantity
    )
    if (validItems.length === 0) {
      toast.error('Please add at least one medicine item with all details')
      return
    }

    try {
      const medicineData = validItems.map(item => ({
        medicine_name: item.medicine_name || 'Medicine',
        batch_number: item.batch_number,
        expiry_date: item.expiry_date,
        rate: parseFloat(item.rate),
        quantity: parseInt(item.quantity)
      }))

      await api.post(`/prescriptions/${processingReferral.id}/process`, {
        medicineItems: medicineData
      })

      const total = medicineData.reduce((sum, i) => sum + i.rate * i.quantity, 0)
      toast.success('Prescription processed successfully! Total: ₹' + total.toFixed(2))

      if (paymentReceived) {
        try {
          await api.post(`/prescriptions/${processingReferral.id}/complete`)
          toast.success('Payment confirmed. Status set to Completed.')
        } catch {
          toast.error('Processed, but failed to set Completed.')
        }
      }

      setProcessingReferral(null)
      setPaymentReceived(false)
      setMedicineItems([{ batch_number: '', expiry_date: '', rate: '', quantity: '' }])
      loadData(false)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to process prescription')
    }
  }

  const handleCompleteReferral = async (referral) => {
    try {
      await api.post(`/prescriptions/${referral.id}/complete`)
      toast.success('Prescription marked as completed')
      loadData(false)
    } catch (err) {
      toast.error('Failed to complete prescription')
    }
  }

  const handleSoloSaleSubmit = async () => {
    if (!soloSaleForm.customerName) {
      toast.error('Customer name is required')
      return
    }

    const validItems = soloSaleForm.items.filter(
      item => item.medicine_name && item.batch_number && item.expiry_date && item.rate && item.quantity
    )

    if (validItems.length === 0) {
      toast.error('Please add at least one medicine item')
      return
    }

    try {
      const medicineData = validItems.map(item => ({
        medicine_name: item.medicine_name,
        batch_number: item.batch_number,
        expiry_date: item.expiry_date,
        rate: parseFloat(item.rate),
        quantity: parseInt(item.quantity)
      }))

      await api.post('/solo-sales', {
        customerName: soloSaleForm.customerName,
        customerContact: soloSaleForm.customerContact,
        medicineItems: medicineData
      })

      const total = medicineData.reduce((sum, item) => sum + item.rate * item.quantity, 0)
      toast.success(`Solo sale created! Total: ₹${total.toFixed(2)}`)
      setShowSoloSaleModal(false)
      setSoloSaleForm({
        customerName: '',
        customerContact: '',
        items: [{ medicine_name: '', batch_number: '', expiry_date: '', rate: '', quantity: '' }]
      })
      loadData(false)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create solo sale')
    }
  }

  const calculateSoloTotal = () => {
    return soloSaleForm.items.reduce((sum, item) => {
      const rate = parseFloat(item.rate) || 0
      const qty = parseInt(item.quantity) || 0
      return sum + rate * qty
    }, 0)
  }

  // ================== Loading ==================
  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  // ================== Render ==================
  return (
    <div className="app-page w-full"> {/* Removed page-container for full width */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, type: 'spring', stiffness: 80 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Pharmacy Dashboard</h2>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1.5">
              <span className="new-web-badge">Try our new web</span>
              <a
                href="/medicine/verify"
                className="px-4 py-2 rounded-lg text-white text-sm font-semibold bg-brand-gradient hover:-translate-y-0.5 transition"
                title="Check a medicine's serial number for authenticity before dispensing"
              >
                Verify Medicine Authenticity
              </a>
            </div>
            <button
              onClick={() => loadData(true)}
              className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Panel: Doctor Referral */}
          <section className="rounded-2xl border border-slate-200 p-5 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Doctor Referral</h3>
              <span className="text-sm text-slate-600">
                {referrals.filter(r => r.status !== 'Completed' && r.status !== 'Dispensed').length} pending
              </span>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {referrals.length === 0 ? (
                <p className="text-slate-500 text-sm">No doctor referrals</p>
              ) : (
                referrals.map((referral) => (
                  <div
                    key={`${referral.type}-${referral.id}`}
                    className="border border-slate-200 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{referral.patient_name}</span>
                          {referral.rx && (
                            <span className="text-xs text-slate-500">({referral.rx})</span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded bg-cyan-100 text-cyan-700">
                            {referral.type === 'quick' ? 'Quick' : 'Regular'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Dr. {referral.doctor_name}
                        </div>
                        {referral.type === 'quick' ? (
                          <div className="text-xs text-slate-600 mt-1">
                            {referral.medicine_name} - {referral.dosage} ({referral.course_duration})
                          </div>
                        ) : (
                          <div className="text-xs text-slate-600 mt-1 truncate">
                            {referral.medicines || referral.meds}
                          </div>
                        )}
                        {referral.bill_total_amount && (
                          <div className="text-xs font-medium text-emerald-600 mt-1">
                            Total: ₹{parseFloat(referral.bill_total_amount || referral.total_amount || 0).toFixed(2)}
                          </div>
                        )}
                      </div>
                      <StatusBadge status={referral.status || referral.bill_status || 'Pending'} />
                    </div>
                    <div className="flex gap-2">
                      {(referral.status === 'Pending' || referral.status === 'Processing') && (
                        <button
                          onClick={() => setProcessingReferral(referral)}
                          className="px-3 py-1 text-xs rounded-md bg-cyan-500 text-white"
                        >
                          {referral.bill_id ? 'View/Edit' : 'Add Details'}
                        </button>
                      )}
                      {(referral.status === 'Processing' || referral.bill_status === 'Pending') && (
                        <button
                          onClick={() => handleCompleteReferral(referral)}
                          className="px-3 py-1 text-xs rounded-md bg-emerald-500 text-white"
                        >
                          Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Right Panel: Solo Sale */}
          <section className="rounded-2xl border border-slate-200 p-5 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Solo Sale</h3>
              <button
                onClick={() => setShowSoloSaleModal(true)}
                className="px-3 py-1.5 text-sm rounded-md bg-blue-500 text-white"
              >
                + New Sale
              </button>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {soloSales.length === 0 ? (
                <p className="text-slate-500 text-sm">No solo sales</p>
              ) : (
                soloSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="border border-slate-200 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{sale.customer_name}</div>
                        {sale.customer_contact && (
                          <div className="text-xs text-slate-600">{sale.customer_contact}</div>
                        )}
                        <div className="text-xs font-medium text-emerald-600 mt-1">
                          Total: ₹{parseFloat(sale.total_amount || 0).toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {new Date(sale.created_at).toLocaleString()}
                        </div>
                      </div>
                      <StatusBadge status={sale.status} />
                    </div>
                    {sale.status === 'Pending' && (
                      <button
                        onClick={async () => {
                          try {
                            await api.post(`/solo-sales/${sale.id}/complete`)
                            toast.success('Sale completed. Receipt generated.')
                            loadData(false)
                          } catch (err) {
                            toast.error('Failed to complete sale')
                          }
                        }}
                        className="px-3 py-1 text-xs rounded-md bg-emerald-500 text-white"
                      >
                        Generate Receipt
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* MATCH StaffDashboard: Discharge/Transfer Requests section */}
        <section className="rounded-2xl border border-slate-200 p-5 bg-white overflow-x-auto">
          <h3 className="font-semibold text-slate-900 mb-3">Discharge/Transfer Requests</h3>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2 px-4">Patient</th>
                <th className="text-left px-4">Doctor</th>
                <th className="text-left px-4">Type</th>
                <th className="text-left px-4">Diagnosis</th>
                <th className="text-left px-4">Status</th>
                <th className="text-left px-4">Details</th>
                <th className="text-left px-4">Action</th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              {dischargeReqs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-500 px-4">No discharge/transfer requests</td>
                </tr>
              ) : (
                dischargeReqs.map(r => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-2 px-4">{r.patient_name}</td>
                    <td className="px-4">{r.doctor_name}</td>
                    <td className="px-4">{r.type}</td>
                    <td className="px-4">{r.diagnosis}</td>
                    <td className="capitalize px-4">{r.status || 'pending'}</td>
                    <td className="px-4">
                      <input
                        value={detail[r.id] || ''}
                        onChange={e => setDetail(s => ({ ...s, [r.id]: e.target.value }))}
                        placeholder="Your department remarks"
                        className="p-2 rounded-md border border-slate-200 w-64 disabled:bg-slate-50 disabled:text-slate-400"
                        disabled={(r.status && r.status !== 'pending')}
                      />
                    </td>
                    <td className="space-x-2 px-4">
                      <button
                        onClick={() => act(r.id, 'approve')}
                        className="px-3 py-1 rounded-md bg-emerald-600 text-white disabled:opacity-50"
                        disabled={(r.status && r.status !== 'pending')}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => act(r.id, 'reject')}
                        className="px-3 py-1 rounded-md bg-rose-600 text-white disabled:opacity-50"
                        disabled={(r.status && r.status !== 'pending')}
                      >
                        Reject
                      </button>
                      {isFullyApproved(r) && (
                        <button
                          onClick={() => downloadDischargePdf(r)}
                          className="px-3 py-1 rounded-md bg-indigo-600 text-white"
                          title="Download Final Discharge PDF"
                        >
                          Download PDF
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* Process Referral Modal */}
        {processingReferral && (
          <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
            <div className="w-full max-w-2xl bg-white rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold">
                Process Prescription - {processingReferral.patient_name}
              </h3>
              {processingReferral.type === 'quick' && (
                <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                  <p>
                    <strong>Medicine:</strong> {processingReferral.medicine_name}
                  </p>
                  <p>
                    <strong>Dosage:</strong> {processingReferral.dosage}
                  </p>
                  <p>
                    <strong>Course:</strong> {processingReferral.course_duration}
                  </p>
                </div>
              )}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-sm">Medicine Items</label>
                  <button
                    onClick={() => setMedicineItems([
                      ...medicineItems,
                      { medicine_name: processingReferral.type === 'quick' ? processingReferral.medicine_name : undefined, batch_number: '', expiry_date: '', rate: '', quantity: '' }
                    ])}
                    className="px-2 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200"
                  >
                    + Add Item
                  </button>
                </div>
                {medicineItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end">
                    {/* NEW: show medicine name (read-only if available) */}
                    <input
                      type="text"
                      placeholder="Medicine"
                      value={item.medicine_name || (processingReferral.type === 'quick' ? processingReferral.medicine_name : '')}
                      onChange={(e) => {
                        // allow manual entry only if not provided from prescription
                        if (processingReferral.type !== 'quick') {
                          const updated = [...medicineItems]
                          updated[index] = { ...updated[index], medicine_name: e.target.value }
                          setMedicineItems(updated)
                        }
                      }}
                      className="col-span-3 px-2 py-1.5 text-sm rounded border border-slate-200"
                      readOnly={!!(processingReferral.type === 'quick')}
                    />
                    <input
                      type="text"
                      placeholder="Batch Number"
                      value={item.batch_number}
                      onChange={(e) => {
                        const updated = [...medicineItems]
                        updated[index] = { ...updated[index], batch_number: e.target.value }
                        setMedicineItems(updated)
                      }}
                      className="col-span-2 px-2 py-1.5 text-sm rounded border border-slate-200"
                    />
                    <input
                      type="date"
                      value={item.expiry_date}
                      onChange={(e) => {
                        const updated = [...medicineItems]
                        updated[index] = { ...updated[index], expiry_date: e.target.value }
                        setMedicineItems(updated)
                      }}
                      className="col-span-2 px-2 py-1.5 text-sm rounded border border-slate-200"
                    />
                    <input
                      type="number"
                      placeholder="Rate"
                      value={item.rate}
                      onChange={(e) => {
                        const updated = [...medicineItems]
                        updated[index] = { ...updated[index], rate: e.target.value }
                        setMedicineItems(updated)
                      }}
                      className="col-span-2 px-2 py-1.5 text-sm rounded border border-slate-200"
                      step="0.01"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...medicineItems]
                        updated[index] = { ...updated[index], quantity: e.target.value }
                        setMedicineItems(updated)
                      }}
                      className="col-span-1 px-2 py-1.5 text-sm rounded border border-slate-200"
                    />
                    <div className="col-span-2 flex gap-1 justify-end">
                      <span className="text-xs self-center text-slate-600">
                        ₹{((parseFloat(item.rate) || 0) * (parseInt(item.quantity) || 0)).toFixed(2)}
                      </span>
                      {medicineItems.length > 1 && (
                        <button
                          onClick={() => setMedicineItems(medicineItems.filter((_, i) => i !== index))}
                          className="px-2 py-1 text-xs rounded-md bg-rose-100 text-rose-700"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-semibold">Total Bill:</span>
                  <span className="text-lg font-bold text-emerald-600">
                    ₹{medicineItems.reduce((sum, it) => sum + ((parseFloat(it.rate) || 0) * (parseInt(it.quantity) || 0)), 0).toFixed(2)}
                  </span>
                </div>

                {/* NEW: payment confirmation toggle */}
                <label className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={paymentReceived}
                    onChange={(e) => setPaymentReceived(e.target.checked)}
                  />
                  <span className="text-sm text-slate-700">Payment received (auto set status to Completed)</span>
                </label>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => {
                    setProcessingReferral(null)
                    setPaymentReceived(false)
                    setMedicineItems([{ batch_number: '', expiry_date: '', rate: '', quantity: '' }])
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcessReferral}
                  className="px-4 py-2 rounded-lg bg-cyan-600 text-white"
                >
                  Process
                </button>
              </div>
            </div>
          </div>
        )}

        {showSoloSaleModal && (
          <SoloSaleModal
            form={soloSaleForm}
            setForm={setSoloSaleForm}
            onSubmit={handleSoloSaleSubmit}
            onClose={() => setShowSoloSaleModal(false)}
            total={calculateSoloTotal()}
          />
        )}
      </motion.div>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    Pending: 'bg-amber-100 text-amber-800',
    Processing: 'bg-blue-100 text-blue-800',
    Ready: 'bg-cyan-100 text-cyan-800',
    Completed: 'bg-emerald-100 text-emerald-800',
    Dispensed: 'bg-emerald-100 text-emerald-800'
  }
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${
        styles[status] || styles.Pending
      }`}
    >
      {status}
    </span>
  )
}

function SoloSaleModal({ form, setForm, onSubmit, onClose, total }) {
  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { medicine_name: '', batch_number: '', expiry_date: '', rate: '', quantity: '' }]
    })
  }

  const updateItem = (index, field, value) => {
    const updated = [...form.items]
    updated[index] = { ...updated[index], [field]: value }
    setForm({ ...form, items: updated })
  }

  const removeItem = (index) => {
    if (form.items.length > 1) {
      setForm({ ...form, items: form.items.filter((_, i) => i !== index) })
    }
  }
  

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <div className="w-full max-w-3xl bg-white rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold">New Solo Sale</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Customer Name *</label>
            <input
              type="text"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contact</label>
            <input
              type="text"
              value={form.customerContact}
              onChange={(e) => setForm({ ...form, customerContact: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
            />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-medium text-sm">Medicine Items</label>
            <button
              onClick={addItem}
              className="px-2 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200"
            >
              + Add Item
            </button>
          </div>
          {form.items.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-end">
              <input
                type="text"
                placeholder="Medicine Name"
                value={item.medicine_name}
                onChange={(e) => updateItem(index, 'medicine_name', e.target.value)}
                className="col-span-3 px-2 py-1.5 text-sm rounded border border-slate-200"
              />
              <input
                type="text"
                placeholder="Batch"
                value={item.batch_number}
                onChange={(e) => updateItem(index, 'batch_number', e.target.value)}
                className="col-span-2 px-2 py-1.5 text-sm rounded border border-slate-200"
              />
              <input
                type="date"
                value={item.expiry_date}
                onChange={(e) => updateItem(index, 'expiry_date', e.target.value)}
                className="col-span-2 px-2 py-1.5 text-sm rounded border border-slate-200"
              />
              <input
                type="number"
                placeholder="Rate"
                value={item.rate}
                onChange={(e) => updateItem(index, 'rate', e.target.value)}
                className="col-span-2 px-2 py-1.5 text-sm rounded border border-slate-200"
                step="0.01"
              />
              <input
                type="number"
                placeholder="Qty"
                value={item.quantity}
                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                className="col-span-2 px-2 py-1.5 text-sm rounded border border-slate-200"
              />
              <div className="col-span-1 flex justify-end">
                {form.items.length > 1 && (
                  <button
                    onClick={() => removeItem(index)}
                    className="px-2 py-1 text-xs rounded-md bg-rose-100 text-rose-700"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="font-semibold">Total Amount:</span>
            <span className="text-lg font-bold text-emerald-600">₹{total.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white"
          >
            Create Sale
          </button>
        </div>
      </div>
    </div>
  )
}