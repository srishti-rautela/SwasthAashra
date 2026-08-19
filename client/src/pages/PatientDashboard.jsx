// ================== Imports ==================

import { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import api from '../utils/api'
import AuthContext from '../utils/AuthContext'
import AppointmentModal from '../components/AppointmentModal'
import PayBillButton from '../components/PayBillButton'
import { downloadDischargePdf } from '../utils/dischargePdf'

// ================== Component Definition ==================

export default function PatientDashboard() {
  // ================== State ==================

  const { user } = useContext(AuthContext)
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [liveDischarges, setLiveDischarges] = useState([])
  const [bills, setBills] = useState([])

  // ================== Actions / Handlers ==================

  // ---------- @@LOAD_APPOINTMENTS ----------
  const load = async ()=>{
    setLoading(true)
    try{
      const res = await api.get('/appointments?scope=patient&when=all')
      setAppointments(res.data?.rows || [])
    }catch{
      setAppointments([])
    }finally{ setLoading(false) }
  }

  // ================== Effects ==================

  // ---------- Initial load ----------
  useEffect(()=>{ load() },[])

  // ================== Actions / Handlers ==================

  // ---------- @@CANCEL_APPOINTMENT ----------
  const cancel = async (id)=>{
    try{
      await api.patch(`/appointments/${id}`, { action:'cancel' })
      toast.success('Appointment cancelled')
      setAppointments(prev => prev.map(a => a.id===id ? { ...a, status:'Cancelled' } : a))
    }catch{ toast.error('Failed to cancel') }
  }

  // ---------- @@LOAD_DISCHARGES ----------
  const loadDischarges = async ()=>{
    try{
      const res = await api.get('/discharges/my')
      setLiveDischarges(res.data?.rows || [])
    }catch{ /* ignore */ }
  }

  // ---------- @@LOAD_BILLS ----------
  const loadBills = async ()=>{
    try{
      const res = await api.get('/billing/my')
      setBills(res.data?.rows || [])
    }catch{ /* ignore */ }
  }

  // ================== Effects ==================

  // ---------- Polling: live discharges ----------
  useEffect(()=>{ loadDischarges(); const t=setInterval(loadDischarges, 6000); return ()=>clearInterval(t) },[])
  useEffect(()=>{ loadBills() },[])

  // ================== Helpers (UI) ==================

  // Human-friendly date like "Nov 2, 2025"
  const fmtDate = (dt) => {
    if (!dt) return '-'
    const d = new Date(dt)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // "22:50:00" -> "10:50 PM"
  const fmtTime12 = (t) => {
    if (!t) return '-'
    const [hh='0', mm='00'] = String(t).split(':')
    let h = parseInt(hh, 10)
    if (Number.isNaN(h)) return t
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12 || 12
    return `${h}:${mm} ${ampm}`
  }

  // Status badges (uniform palette)
  const pill = 'badge '
  const statusBadge = (s)=>(
    <span className={
      pill + (s==='Approved' ? 'badge-success' :
             s==='Rejected' ? 'badge-danger' :
             'badge-warning')
    }>{s || 'Pending'}</span>
  )
  const overallBadge = (s)=>(
    <span className={
      pill + (s==='Completed' ? 'badge-success' :
             s==='Rejected' ? 'badge-danger' :
             'badge-warning')
    }>{s}</span>
  )

  // Appointments badge
  const apptBadge = (s)=>{
    if (s==='Completed') return <span className="badge badge-success">Completed</span>
    if (s==='Cancelled') return <span className="badge badge-danger">Cancelled</span>
    if (s==='Confirmed') return <span className="badge badge-success">Confirmed</span>
    // Scheduled/Upcoming/Pending
    return <span className="badge badge-neutral">{s || 'Scheduled'}</span>
  }

  // ================== Rendering ==================

  // ---------- Loading State ----------
  if(loading){
    return <div className="min-h-[60vh] grid place-items-center"><div className="spinner-brand" /></div>
  }

  // ---------- Main Render ----------
  return (
    <div className="app-page page-container">
      <div className="space-y-6">

        {/* Welcome card */}
        <div className="surface-card p-5">
          <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
          <p className="text-sm text-muted">Manage appointments and view live discharges</p>
        </div>

        {/* Medicine Verification quick action */}
        <Link
          to="/medicine/verify"
          className="surface-card p-5 flex items-center justify-between gap-4 hover:-translate-y-0.5 transition group"
        >
          <div>
            <h2 className="text-lg font-semibold">Verify a Medicine</h2>
            <p className="text-sm text-muted">Scan or enter a serial number to check if a medicine is genuine, expired, or counterfeit.</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="new-web-badge">Try our new web</span>
            <span className="btn-cta px-4 py-2 rounded-full text-sm font-semibold group-hover:translate-x-0.5 transition">
              Open →
            </span>
          </div>
        </Link>

        {/* Billing & Payments */}
        {bills.length > 0 && (
          <section className="surface-card p-5">
            <h2 className="text-lg font-semibold mb-3">Billing & Payments</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2 pr-4">Bill</th>
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">#{b.id}</td>
                      <td className="py-2 pr-4">{b.diagnosis || b.type || '—'}</td>
                      <td className="py-2 pr-4">₹{b.amount}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          b.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        {b.status === 'Pending' ? (
                          <PayBillButton
                            billId={b.id}
                            amount={b.amount}
                            patientName={user?.name}
                            patientEmail={user?.email}
                            onPaid={loadBills}
                          />
                        ) : (
                          <span className="text-xs text-slate-400">
                            {b.paid_at ? `Paid ${new Date(b.paid_at).toLocaleDateString()}` : 'Paid'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Appointments */}
        <section id="appointments" className="surface-card p-5">
          <div className="appointments-header flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">Appointments</h3>

            <button
              onClick={()=>setOpen(true)}
              className="appointment-book-button btn-primary btn-pill"
            >
              Book Appointment
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {appointments.map(a=>(

                  <tr key={a.id}>
                    <td>{a.doctor_name}</td>
                    <td>{fmtDate(a.appointment_date)}</td>
                    <td>{fmtTime12(a.appointment_time)}</td>
                    <td>{apptBadge(a.status)}</td>
                    <td>
                      {['Pending','Confirmed','Scheduled'].includes(a.status) && (
                        <button
                          onClick={()=>cancel(a.id)}
                          className="btn-danger-outline"
                          title="Cancel this appointment"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <AppointmentModal open={open} onClose={()=>setOpen(false)} onBooked={load} />

        {/* Live Discharge/Transfer Approvals */}
        <section className="surface-card p-5 overflow-x-auto">
          <h3 className="font-semibold mb-3">Live Discharge / Transfer Approvals</h3>
          <table className="ui-table">
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Type</th>
                <th>Diagnosis</th>
                <th>Follow-up Date</th>
                <th>Staff Approved</th>
                <th>Pharmacy Approved</th>
                <th>Insurance Approved</th>
                <th>Overall</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {liveDischarges.map(d=>{
                const byDept = Object.fromEntries((d.approvals||[]).map(a=>[a.department, a]))
                return (
                  <tr key={d.id}>
                    <td>{d.doctor_name}</td>
                    <td>{d.type}</td>
                    <td className="max-w-[280px] truncate" title={d.diagnosis}>{d.diagnosis}</td>
                    <td>{fmtDate(d.follow_up_date)}</td>
                    <td>{statusBadge(byDept.Staff?.status)}</td>
                    <td>{statusBadge(byDept.Pharmacy?.status)}</td>
                    <td>{statusBadge(byDept.Insurance?.status)}</td>
                    <td>{overallBadge(d.overall_status)}</td>
                    <td>
                      <button
                        onClick={() => downloadDischargePdf(d)}
                        className="btn-primary btn-pill"
                        title="Download Final Discharge PDF"
                      >
                        Download PDF
                      </button>
                    </td>
                  </tr>
                )
              })}
              {liveDischarges.length===0 && (
                <tr><td className="py-4 text-slate-500" colSpan={9}>No discharge/transfer requests yet.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}

