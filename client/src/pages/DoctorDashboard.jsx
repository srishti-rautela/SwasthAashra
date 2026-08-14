// ================== Imports ==================

import { useContext, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../utils/api'
import { toast } from 'react-toastify'
import { downloadDischargePdf } from '../utils/dischargePdf'
import AuthContext from '../utils/AuthContext'
import { motion } from 'framer-motion'

// ================== Constants ==================
const TABS = ['today', 'appointments', 'discharges', 'prescriptions']

// ================== Component Definition ==================

export default function DoctorDashboard() {
  // ================== State ==================
  const { user } = useContext(AuthContext)
  const [loading,setLoading] = useState(true)
  const [stats,setStats] = useState({ total:0, pending:0, today:0 })
  const [appointments,setAppointments] = useState([])
  const [patients,setPatients] = useState([])
  const [modal,setModal] = useState({ open:false, patient:null })
  const [liveDischarges, setLiveDischarges] = useState([])
  const [completedFromDischarge, setCompletedFromDischarge] = useState([])

  // ---------- Discharge initiation check ----------
  const isDischargeInitiated = (pid) => {
    if (!pid) return false
    const idStr = String(pid)
    const inLocal = (completedFromDischarge || []).some(
      d => String(d.id) === idStr || String(d.patientId) === idStr
    )
    const inLive = (liveDischarges || []).some(d => {
      const did = d.patient_user_id ?? d.patient_id ?? d.patientId
      return String(did) === idStr
    })
    return inLocal || inLive
  }

  // ================== State ==================
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [patientHistory, setPatientHistory] = useState({ loading:false, items:[], error:null })

  // ================== Derived Data / Memos ==================
  const [params, setParams] = useSearchParams()
  const rawTab = (params.get('tab') || 'today').toLowerCase()
  const tabParam = rawTab === 'patients' ? 'appointments' : rawTab
  const activeTab = TABS.includes(tabParam) ? tabParam : 'today'
  const setTab = (t) => setParams({ tab: t })

  // ================== Actions / Handlers ==================
  // ---------- @@LOAD_DASHBOARD ----------
  const load = async ()=>{
    setLoading(true)
    try{
      const [s, a, p] = await Promise.all([
        api.get('/doctor/dashboard'),
        api.get('/appointments?scope=doctor&when=upcoming'),
        api.get('/doctor/patients')
      ])
      setStats(s.data?.stats || { total:0, pending:0, today:0 })
      setAppointments(a.data?.rows || [])
      setPatients(p.data?.rows || [])
    }finally{ setLoading(false) }
  }

  // ---------- @@LOAD_DISCHARGES ----------
  const loadDischarges = async ()=>{
    try{
      const res = await api.get('/discharges/my')
      setLiveDischarges(res.data?.rows || [])
    }catch{ /* ignore */ }
  }

  // ================== Effects ==================
  useEffect(()=>{ load(); loadDischarges(); const t=setInterval(loadDischarges, 6000); return ()=>clearInterval(t) },[])
  // ---------- Window focus refresh ----------
  useEffect(() => {
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // ================== Actions / Handlers ==================

  // ---------- @@SEND_PRESCRIPTION ----------
 const sendPrescription = async (form)=>{
    try{
      await api.post('/prescriptions', { patientId: form.patientId, medicines: form.medicines })
      toast.success('Prescription Sent')
    }catch{ toast.error('Failed to send prescription') }
  }
  // ---------- @@TOGGLE_STATUS ----------
  const toggleStatus = async (id, current)=>{
    try{
      const res = await api.patch(`/appointments/${id}`, { action:'toggle' })
      const newStatus = res.data?.status || (current==='Confirmed' ? 'Completed' : 'Confirmed')
      setAppointments(prev => prev.map(x => x.id===id ? { ...x, status: newStatus } : x))
      toast.success(`Status: ${newStatus}`)
    }catch{ toast.error('Failed to update status') }
  }

  // ---------- @@INITIATE_DISCHARGE ----------
  const initiateDischarge = async (payload)=>{
    try{
      const mPatient = modal.patient
      await api.post('/discharges/initiate', payload)
      toast.success('Request sent to Staff, Pharmacy, Insurance')
      setModal({ open:false, patient:null })
      if (mPatient?.id) {
        setCompletedFromDischarge(prev => {
          if (prev.some(p => p.id === mPatient.id)) return prev
          const now = new Date()
          return [
            ...prev,
            {
              id: mPatient.id,
              name: mPatient.name,
              patientId: mPatient.id,
              date: now.toLocaleDateString(),
              time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          ]
        })
      }
    }catch(e){
      toast.error(e?.response?.data?.message || 'Failed to initiate')
    }
  }

  // ---------- View patient ----------
  const viewPatient = (patient) => {
    if (!patient?.id) return
    setSelectedPatient(patient)
    fetchPatientHistory(patient.id)
  }

  // ---------- Completed patients union ----------
  const completedPatients = (() => {
    const fromAppt = (appointments || [])
      .filter(a => String(a.status || '').toLowerCase() === 'completed')
      .map(a => ({
        key: (a.patient_user_id || a.patient_id) ?? a.id,
        id: a.patient_user_id || a.patient_id,
        patientId: a.patient_id,
        name: a.patient_name,
        date: a.appointment_date ?? a.appt_date,
        time: a.appointment_time ?? a.appt_time,
      }))
    const fromDischarge = (completedFromDischarge || []).map(d => ({
      key: d.id || d.patientId || d.name,
      id: d.id,
      patientId: d.patientId ?? d.id,
      name: d.name,
      date: d.date,
      time: d.time,
    }))
    const fromLive = (liveDischarges || []).map(d => {
      const pid = d.patient_user_id ?? d.patient_id ?? d.patientId
      const dt = d.created_at || d.requested_at
      const date = dt ? new Date(dt).toLocaleDateString() : undefined
      const time = dt ? new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
      return {
        key: String(pid ?? d.id ?? d.patient_name),
        id: pid,
        patientId: d.patient_id ?? d.patientId ?? pid,
        name: d.patient_name ?? d.name ?? 'Patient',
        date,
        time,
      }
    })
    const uniq = new Map()
    for (const p of [...fromAppt, ...fromDischarge, ...fromLive]) {
      if (!uniq.has(p.key)) uniq.set(p.key, p)
    }
    return Array.from(uniq.values())
  })()

  // ---------- @@LOAD_PATIENT_HISTORY ----------
  const fetchPatientHistory = async (patientId)=>{
    setPatientHistory(s => ({ ...s, loading:true, error:null }))
    try{
      const res = await api.get(`/patients/${patientId}/history`)
      setPatientHistory({ loading:false, items: res.data?.rows || [], error:null })
    }catch(e){
      setPatientHistory({ loading:false, items: [], error: e?.response?.data?.message || 'Failed to load history' })
    }
  }

  // ---------- Discharge helpers (reuse in table) ----------
  const dischargeBtnClasses = (disabled) =>
    'px-3 py-2 rounded-xl shadow-sm transition-all ' +
    (disabled
      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
      : 'bg-gradient-to-r from-[#457B9D] to-[#1D3557] text-white hover:shadow-md hover:-translate-y-0.5')

  // ---------- Rendering ----------
  if(loading){
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="app-page w-full"> {/* Removed page-container for full width */}
      <div className="space-y-6">
        {/* Tab Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap gap-2">
            <TabButton active={activeTab==='today'} onClick={()=>setTab('today')}>Today</TabButton>
            <TabButton active={activeTab==='prescriptions'} onClick={()=>setTab('prescriptions')}>Prescriptions</TabButton>
            <TabButton active={activeTab==='appointments'} onClick={()=>setTab('appointments')}>Patient</TabButton>
            <TabButton active={activeTab==='discharges'} onClick={()=>setTab('discharges')}>Discharges</TabButton>
          </div>
        </div>

        {/* Welcome card */}
        <div className="surface-card p-6 mb-6 rounded-2xl border border-slate-200 bg-white/80 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Welcome, {user?.name || 'Doctor'}</h1>
          <p className="text-sm text-slate-600">Track today’s consults, manage appointments, initiate discharges, and send prescriptions</p>
        </div>

        {/* Animated main content */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, type: 'spring', stiffness: 80 }}
          className="space-y-6"
        >
          {/* Today */}
          {activeTab === 'today' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Card title="Total Appointments" value={stats.total} />
                <Card title="Consults Today" value={stats.today} />
              </div>

              <section id="appointments" className="surface-card p-5 rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Upcoming Appointments</h3>
                  <button onClick={load} className="px-3 py-1.5 rounded-md border border-slate-200">Refresh</button>
                </div>
                <AppointmentsTable
                  rows={appointments}
                  isDischargeInitiated={isDischargeInitiated}
                  onToggle={toggleStatus}
                  onInitiate={(pid, name)=>setModal({ open:true, patient:{ id:pid, name } })}
                  onView={(pid, name)=>openPatientDocumentById(pid, name)}
                  dischargeBtnClasses={dischargeBtnClasses}
                />
              </section>
            </>
          )}

          {/* Appointments + Patients merged */}
          {activeTab === 'appointments' && (
            <section id="appointments-merged" className="space-y-5">
              <div className="grid lg:grid-cols-2 gap-5">
                {/* Left: Appointments */}
                <div className="rounded-2xl border border-slate-200 p-5 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-900">Upcoming Appointments</h3>
                    <button onClick={load} className="px-3 py-1.5 rounded-md border border-slate-200">Refresh</button>
                  </div>
                  <AppointmentsTable
                    rows={appointments}
                    isDischargeInitiated={isDischargeInitiated}
                    onToggle={toggleStatus}
                    onInitiate={(pid, name)=>setModal({ open:true, patient:{ id:pid, name } })}
                    onView={(pid, name)=>openPatientDocumentById(pid, name)}
                    dischargeBtnClasses={dischargeBtnClasses}
                  />
                </div>

                {/* Right: Patients */}
                <div className="rounded-2xl border border-slate-200 p-5 bg-white">
                  <h3 className="font-semibold text-slate-900 mb-3">Patients</h3>
                  <ul className="grid gap-2 text-sm text-slate-700">
                    {patients.map(p => {
                      const initiated = isDischargeInitiated(p.id)
                      return (
                        <li key={p.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                          <span>{p.name} (ID: {p.id})</span>
                          <div className="space-x-2">
                            <button
                              disabled={initiated}
                              onClick={()=>!initiated && setModal({ open:true, patient:{ id:p.id, name:p.name } })}
                              className={
                                'px-3 py-1 rounded-md ' +
                                (initiated
                                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                  : 'bg-cyan-500 text-white')
                              }
                            >
                              {initiated ? 'Discharge/Transfer Initiated' : 'Create Discharge'}
                            </button>
                            <button onClick={()=>viewPatient({ id:p.id, name:p.name })} className="px-3 py-1 rounded-md border border-slate-200">View History</button>
                          </div>
                        </li>
                      )
                    })}
                    {patients.length === 0 && (
                      <li className="text-slate-500">No patients found.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Completed Patients */}
              <section id="completed-patients" className="rounded-2xl border border-slate-200 p-5 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Completed Patients</h3>
                  <div className="text-sm text-slate-600">{completedPatients.length} total</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="text-left py-2">Patient</th>
                        <th className="text-left">Patient ID</th>
                        <th className="text-left">Last Visit</th>
                        <th className="text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-800">
                      {completedPatients.length === 0 ? (
                        <tr>
                          <td className="py-4 text-slate-500" colSpan={4}>No completed patients yet.</td>
                        </tr>
                      ) : completedPatients.map(p => {
                          const initiated = isDischargeInitiated(p.id)
                          return (
                            <tr key={p.key} className="border-t border-slate-100">
                              <td className="py-2">{p.name}</td>
                              <td>{p.patientId || '-'}</td>
                              <td>{[p.date, p.time].filter(Boolean).join(' ') || '-'}</td>
                              <td className="space-x-2">
                                <button
                                  onClick={()=>viewPatient({ id:p.id, name:p.name })}
                                  className="px-3 py-1 rounded-md border border-slate-200"
                                >
                                  View History
                                </button>
                                <button
                                  disabled={initiated}
                                  onClick={()=>!initiated && setModal({ open:true, patient:{ id:p.id, name:p.name } })}
                                  className={
                                    'px-3 py-1 rounded-md ' +
                                    (initiated
                                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                      : 'bg-cyan-600 text-white')
                                  }
                                >
                                  {initiated ? 'Discharge/Transfer Initiated' : 'Create Discharge'}
                                </button>
                                <button
                                  onClick={() => downloadDischargePdf(p)}
                                  className="px-3 py-1 rounded-md bg-indigo-600 text-white"
                                  title="Download Final Discharge PDF"
                                >
                                  Download PDF
                                </button>
                                <button
                                  onClick={()=>openPatientDocumentById(p.id, p.name)}
                                  className="px-3 py-1 rounded-md border border-slate-200"
                                >
                                  View Document
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Viewed Patient (History) */}
              <div>
                {selectedPatient && (
                  <ViewedPatientHistory
                    patient={selectedPatient}
                    state={patientHistory}
                    onRefresh={()=>fetchPatientHistory(selectedPatient.id)}
                    onClear={()=>{ setSelectedPatient(null); setPatientHistory({ loading:false, items:[], error:null }) }}
                  />
                )}
              </div>
            </section>
          )}

          {/* Prescriptions */}
          {activeTab === 'prescriptions' && (
            <section id="prescriptions" className="rounded-2xl border border-slate-200 p-5 bg-white">
              <h3 className="font-semibold text-slate-900 mb-3">Quick Prescription</h3>
              <PrescriptionForm onSubmit={sendPrescription} />
            </section>
          )}

          {/* Discharges */}
          {activeTab === 'discharges' && (
            <section className="rounded-2xl border border-slate-200 p-5 bg-white overflow-x-auto">
              <h3 className="font-semibold text-slate-900 mb-3">Live Discharge/Transfer Approvals</h3>
              <table className="w-full text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="text-left py-2">Patient</th>
                    <th className="text-left">Type</th>
                    <th className="text-left">Diagnosis</th>
                    <th className="text-left">Follow-up</th>
                    <th className="text-left">Staff</th>
                    <th className="text-left">Pharmacy</th>
                    <th className="text-left">Insurance</th>
                    <th className="text-left">Overall</th>
                  </tr>
                </thead>
                <tbody className="text-slate-800">
                  {liveDischarges.map(d=>{
                    const byDept = Object.fromEntries((d.approvals||[]).map(a=>[a.department, a]))
                    const badge = (s)=>(
                      <span className={
                        'px-2 py-0.5 rounded-full text-xs ' +
                        (s==='Approved' ? 'bg-emerald-100 text-emerald-800' :
                         s==='Rejected' ? 'bg-rose-100 text-rose-800' :
                         'bg-amber-100 text-amber-800')
                      }>{s||'Pending'}</span>
                    )
                    const fmtDate = (dt)=> dt ? new Date(dt).toLocaleDateString('en-GB') : '-'
                    const overall = d.overall_status
                    return (
                      <tr key={d.id} className="border-t border-slate-100 odd:bg-slate-50 hover:bg-slate-50">
                        <td className="py-2">{d.patient_name}</td>
                        <td>{d.type}</td>
                        <td className="max-w-[280px] truncate" title={d.diagnosis}>{d.diagnosis}</td>
                        <td>{fmtDate(d.follow_up_date)}</td>
                        <td>{badge(byDept.Staff?.status || 'Pending')}</td>
                        <td>{badge(byDept.Pharmacy?.status || 'Pending')}</td>
                        <td>{badge(byDept.Insurance?.status || 'Pending')}</td>
                        <td>{badge(overall)}</td>
                      </tr>
                    )
                  })}
                  {liveDischarges.length===0 && (
                    <tr><td className="py-4 text-slate-500" colSpan={8}>No discharge/transfer requests yet.</td></tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          {/* Viewed Patient (History) */}
          <div>
            {selectedPatient && (
              <ViewedPatientHistory
                patient={selectedPatient}
                state={patientHistory}
                onRefresh={()=>fetchPatientHistory(selectedPatient.id)}
                onClear={()=>{ setSelectedPatient(null); setPatientHistory({ loading:false, items:[], error:null }) }}
              />
            )}
          </div>
        </motion.div>
      </div>

      {modal.open && (
        <DischargeModal
          patient={modal.patient}
          onClose={()=>setModal({ open:false, patient:null })}
          onSubmit={initiateDischarge}
        />
      )}
    </div>
  )
}

// ================== Presentational Components ==================
function Card({ title, value }){
  return (
    <div className="rounded-2xl border border-slate-200 p-5 bg-white">
      <div className="text-sm text-slate-600">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  const base = 'px-4 py-2 rounded-xl font-medium shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5'
  const activeCls = 'ring-2 ring-[#457B9D]/30'
  const solid = 'bg-gradient-to-r from-[#457B9D] to-[#1D3557] text-white'
  const muted = 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
  return (
    <button onClick={onClick} className={`${base} ${active ? `${solid} ${activeCls}` : muted}`}>
      {children}
    </button>
  )
}

// DRY: shared appointments table used in Today and Appointments tabs
function AppointmentsTable({ rows, isDischargeInitiated, onToggle, onInitiate, onView, dischargeBtnClasses }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="text-left py-2 px-4">Patient</th>
            <th className="text-left px-4">Patient ID</th>
            <th className="text-left px-4">Date</th>
            <th className="text-left px-4">Time</th>
            <th className="text-left px-4">Status</th>
            <th className="text-left px-4">Actions</th>
          </tr>
        </thead>
        <tbody className="text-slate-800">
          {rows.map(r=>{
            const pid = r.patient_user_id || r.patient_id
            const initiated = isDischargeInitiated(pid)
            return (
              <tr key={r.id} className="border-t border-slate-100 odd:bg-slate-50 hover:bg-slate-50">
                <td className="py-3 px-4">{r.patient_name}</td>
                <td className="px-4">{r.patient_id}</td>
                <td className="px-4">{r.appointment_date ?? r.appt_date}</td>
                <td className="px-4">{r.appointment_time ?? r.appt_time}</td>
                <td className="px-4">{r.status}</td>
                <td className="space-x-2 px-4">
                  <button
                    onClick={()=>onToggle(r.id, r.status)}
                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    {r.status === 'Confirmed' ? 'Mark Completed' : 'Revert to Confirmed'}
                  </button>
                  <button
                    disabled={initiated}
                    onClick={()=>!initiated && onInitiate(pid, r.patient_name)}
                    className={dischargeBtnClasses(initiated)}
                  >
                    {initiated ? 'Discharge/Transfer Initiated' : 'Initiate Discharge/Transfer'}
                  </button>
                  <button
                    onClick={()=>onView(pid, r.patient_name)}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
                  >
                    View Document
                  </button>
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr><td className="py-4 text-slate-500 px-4" colSpan={6}>No upcoming appointments.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function ViewedPatientHistory({ patient, state, onRefresh, onClear }) {
  const { loading, items, error } = state
  const cols = ['Date', 'Type', 'Notes']
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '-'

  return (
    <section className="rounded-2xl border border-slate-200 p-5 bg-white">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="font-semibold text-slate-900">Viewed Patient — {patient?.name} (ID: {patient?.id})</h3>
        <button onClick={onRefresh} className="ml-auto px-3 py-1.5 rounded-md border border-slate-200">Refresh</button>
        <button onClick={onClear} className="px-3 py-1.5 rounded-md border border-slate-200">Clear</button>
      </div>
      {loading && <div className="text-slate-500">Loading history…</div>}
      {error && <div className="text-rose-600 text-sm mb-2">{error}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500">
              <tr>
                {cols.map(c => <th key={c} className="text-left py-2">{c}</th>)}
              </tr>
            </thead>
            <tbody className="text-slate-800">
              {items.length === 0 ? (
                <tr><td className="py-4 text-slate-500" colSpan={cols.length}>No history available.</td></tr>
              ) : items.map((h, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-2">{fmtDate(h.date || h.visit_date || h.created_at)}</td>
                  <td>{h.type || h.category || h.kind || '-'}</td>
                  <td className="max-w=[600px]">
                    {h.notes || h.summary || h.diagnosis || h.description || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function DischargeModal({ patient, onClose, onSubmit }){
  const [form, setForm] = useState({ type:'Discharge', diagnosis:'', treatment:'', remarks:'', followUpDate:'' })
  const change = e => setForm(s => ({ ...s, [e.target.name]: e.target.value }))
  const submit = e => {
    e.preventDefault()
    if (!form.diagnosis.trim()) return toast.error('Diagnosis is required')
    onSubmit({
      patientId: patient.id,
      type: form.type,
      diagnosis: form.diagnosis.trim(),
      treatment: form.treatment || null,
      remarks: form.remarks || null,
      followUpDate: form.followUpDate
    })
  }
  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <form onSubmit={submit} className="w-full max-w-lg bg-white rounded-xl p-6 grid gap-3">
        <h3 className="text-lg font-semibold">Create Discharge — {patient?.name}</h3>
        <select name="type" value={form.type} onChange={change} className="p-3 rounded-lg border border-slate-200">
          <option>Discharge</option>
          <option>Transfer</option>
        </select>
        <input required name="diagnosis" value={form.diagnosis} onChange={change} placeholder="Diagnosis" className="p-3 rounded-lg border border-slate-200" />
        <textarea name="treatment" value={form.treatment} onChange={change} placeholder="Treatment" className="p-3 rounded-lg border border-slate-200 h-20" />
        <textarea name="remarks" value={form.remarks} onChange={change} placeholder="Remarks" className="p-3 rounded-lg border border-slate-200 h-20" />
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm text-slate-600 self-center">Follow-up date (dd-mm-yyyy)</label>
          <input name="followUpDate" value={form.followUpDate} onChange={change} placeholder="dd-mm-yyyy" className="p-3 rounded-lg border border-slate-200" />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-slate-200">Cancel</button>
          <button className="px-4 py-2 rounded-lg bg-cyan-600 text-white">Initiate Discharge/Transfer</button>
        </div>
      </form>
    </div>
  )
}

// ================== Local Prescription Form (inlined) ==================
function PrescriptionForm({ onSubmit }) {
  const [patients, setPatients] = useState([])
  const [form, setForm] = useState({ patientId: '', medicines: '' })

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/doctor/patients')
        setPatients(res.data?.rows || [])
      } catch {
        setPatients([])
      }
    })()
  }, [])

  const change = e => setForm(s => ({ ...s, [e.target.name]: e.target.value }))
  const submit = e => {
    e.preventDefault()
    if (!form.patientId || !form.medicines) return toast.error('Select patient and enter medicines')
    onSubmit?.({ patientId: Number(form.patientId), medicines: form.medicines })
    setForm({ patientId: '', medicines: '' })
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <select
        name="patientId"
        value={form.patientId}
        onChange={change}
        className="p-3 rounded-lg border border-slate-200"
      >
        <option value="">Select patient</option>
        {patients.map(p => (
          <option key={p.id} value={p.id}>
            {p.name} (ID: {p.id})
          </option>
        ))}
      </select>
      <textarea
        name="medicines"
        value={form.medicines}
        onChange={change}
        placeholder="Medicines (name - dosage; one per line)"
        className="p-3 rounded-lg border border-slate-200 h-24"
      />
      <button className="justify-self-start px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
        Send to Pharmacy
      </button>
    </form>
  )
}

// Open latest uploaded patient document from /uploads via API
const openPatientDocumentById = async (patientId, name)=> {
  try{
    const r = await api.get('/documents/latest', { params: { patientId } })
    const url = r.data?.url
    if (url) {
      const abs = new URL(url, api.defaults?.baseURL || window.location.origin).toString()
      window.open(abs, '_blank', 'noopener,noreferrer')
    } else {
      toast.info(`No document found for ${name || 'patient'}`)
    }
  }catch(e){
    toast.error(e?.response?.data?.message || 'Unable to open document')
  }
}