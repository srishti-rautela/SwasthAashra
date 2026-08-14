// ================== Imports ==================

import { useEffect, useState } from 'react'
import api from '../utils/api'
import { toast } from 'react-toastify'
import { motion } from 'framer-motion'

// ================== Component Definition ==================

export default function StaffDashboard() {
  // ================== State ==================

  const [loading, setLoading] = useState(true)
  const [dischargeReqs, setDischargeReqs] = useState([])
  const [history, setHistory] = useState([])
  const [detail, setDetail] = useState({})

  // Local persistence for history
  const HISTORY_KEY = 'swasthashra:staff:dischargeHistory'
  const loadLocalHistory = () => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
  }
  const saveLocalHistory = (list) => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)) } catch {}
  }
  const norm = (s)=> String(s || 'pending').toLowerCase()
  const mergeHistory = (stored, server) => {
    // Prefer server values; keep stored ones not returned by server
    const ids = new Set((server || []).map(x => x?.id))
    const rest = (stored || []).filter(x => x && !ids.has(x.id))
    return [...server, ...rest]
  }

  // Load and split data; merge server history with locally stored history
  const load = async ()=>{
    setLoading(true)
    try{
      const res = await api.get('/discharges/requests')
      const rows = res.data?.rows || res.data || []
      const pending = rows.filter(r => norm(r.status) === 'pending')
      const serverHistory = rows.filter(r => norm(r.status) !== 'pending')

      const stored = loadLocalHistory()
      const merged = mergeHistory(stored, serverHistory)

      setDischargeReqs(pending)
      setHistory(merged)
      saveLocalHistory(merged)
    } finally { setLoading(false) }
  }

  // ---------- @@APPROVAL_ACTION ----------
  // Approve or reject discharge/transfer with department details
  const act = async (id, action)=>{
    try{
      await api.patch(`/discharges/${id}/approve`, { action, details: detail[id] || '' })
      toast.success(action==='approve'?'Approved':'Rejected')

      setDischargeReqs(list => list.filter(x => x.id !== id))
      setHistory(h => {
        const updated = {
          ...(dischargeReqs.find(x => x.id === id) || h.find(x => x.id === id) || { id }),
          status: action === 'approve' ? 'approved' : 'rejected',
          details: detail[id] || ''
        }
        const next = [updated, ...h.filter(x => x.id !== id)]
        saveLocalHistory(next)
        return next
      })
      // Clear remark for this id
      setDetail(d => {
        const { [id]: _, ...rest } = d
        return rest
      })
    } catch { toast.error('Failed') }
  }

  // ================== Effects ==================

  // ---------- Initial Load ----------
  useEffect(()=>{ load() },[])

  // ================== Rendering ==================

  // ---------- Loading State ----------
  if(loading){
    return <div className="min-h-[60vh] grid place-items-center"><div className="w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" /></div>
  }

  // ---------- Main Render ----------
  return (
    <div className="app-page w-full"> {/* Removed page-container for full width */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, type: 'spring', stiffness: 80 }}
        className="space-y-6"
      >
        {/* Discharge/Transfer Requests (Active) */}
        <section className="rounded-2xl border border-slate-200 p-5 bg-white overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">Discharge/Transfer Requests</h3>
            <button onClick={load} className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50">Refresh</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500">
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
              {dischargeReqs.map(r=>(

                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-2 px-4">{r.patient_name}</td>
                  <td className="px-4">{r.doctor_name}</td>
                  <td className="px-4">{r.type}</td>
                  <td className="px-4">{r.diagnosis}</td>
                  <td className="capitalize px-4">{r.status || 'pending'}</td>
                  <td className="px-4">
                    <input
                      value={detail[r.id]||''}
                      onChange={e=>setDetail(s=>({ ...s, [r.id]: e.target.value }))}
                      placeholder="Your department remarks"
                      className="p-2 rounded-md border border-slate-200 w-64"
                    />
                  </td>
                  <td className="space-x-2 px-4">
                    <button
                      onClick={()=>act(r.id,'approve')}
                      className="px-3 py-1 rounded-md bg-emerald-600 text-white"
                    >Approve</button>
                    <button
                      onClick={()=>act(r.id,'reject')}
                      className="px-3 py-1 rounded-md bg-rose-600 text-white"
                    >Reject</button>
                  </td>
                </tr>
              ))}
              {dischargeReqs.length === 0 && (
                <tr><td colSpan={7} className="text-center text-slate-500 py-6 px-4">No pending requests</td></tr>
              )}
            </tbody>
          </table>
        </section>

        {/* History (persistent) */}
        <section className="rounded-2xl border border-slate-200 p-5 bg-white overflow-x-auto">
          <h3 className="font-semibold text-slate-900 mb-3">Discharge/Transfer History</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left py-2 px-4">Patient</th>
                <th className="text-left px-4">Doctor</th>
                <th className="text-left px-4">Type</th>
                <th className="text-left px-4">Diagnosis</th>
                <th className="text-left px-4">Status</th>
                <th className="text-left px-4">Details</th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              {history.map(r=>(

                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-2 px-4">{r.patient_name}</td>
                  <td className="px-4">{r.doctor_name}</td>
                  <td className="px-4">{r.type}</td>
                  <td className="px-4">{r.diagnosis}</td>
                  <td className="capitalize px-4">{r.status}</td>
                  <td className="px-4">{r.details || r.department_remarks || '-'}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={6} className="text-center text-slate-500 py-6 px-4">No history yet</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </motion.div>
    </div>
  )
}