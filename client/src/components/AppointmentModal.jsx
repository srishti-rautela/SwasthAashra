import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import api from '../utils/api'
import { toast } from 'react-toastify'

export default function AppointmentModal({ open, onClose, onBooked }) {
  const [doctors, setDoctors] = useState([])
  const [form, setForm] = useState({ doctorId:'', date:'', time:'', reason:'', files:[] })
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [error, setError] = useState('')
  const [showCal, setShowCal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [suggestions, setSuggestions] = useState([])

  // NEW: alternate doctor suggestion (same department at same time)
  const [altDoc, setAltDoc] = useState(null)
  const [altLoading, setAltLoading] = useState(false)

  const availAbortRef = useRef()
  const overlayRef = useRef(null)
  const firstFieldRef = useRef(null)

  // Today (for min date)
  const todayStr = useMemo(() => {
    const d = new Date()
    const mm = String(d.getMonth()+1).padStart(2,'0')
    const dd = String(d.getDate()).padStart(2,'0')
    return `${d.getFullYear()}-${mm}-${dd}`
  }, [])

  // ---------- Helpers (moved ABOVE any usage to avoid TDZ errors) ----------
  const isToday = useMemo(() => date === todayStr, [date, todayStr])

  const nowHM = useMemo(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  }, [open])

  const toMinutes = (s) => {
    const [hh='0', mm='0'] = String(s).split(':')
    return parseInt(hh, 10) * 60 + parseInt(mm, 10)
  }

  const isPastSlot = (s) => isToday && (toMinutes(s) < nowHM)
  // ------------------------------------------------------------------------

  // Build next 21 days as modern "chips" (no calendar)
  const days = useMemo(() => {
    const out = []
    for (let i = 0; i < 21; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const iso = `${yyyy}-${mm}-${dd}`
      const wd = d.toLocaleDateString('en-US', { weekday: 'short' })
      const mon = d.toLocaleDateString('en-US', { month: 'short' })
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${wd}, ${mon} ${dd}`
      out.push({ iso, label, wd, mon, dd })
    }
    return out
  }, [])

  const dayIndex = useMemo(() => {
    const ix = days.findIndex(d => d.iso === date)
    return ix === -1 ? 0 : ix
  }, [days, date])

  // Generate 30-min slots (chip-based) — now safe to use isPastSlot
  const slotItems = useMemo(() => {
    const arr = []
    for (let h = 0; h < 24; h++) {
      for (let m of [0, 30]) {
        const hh = String(h).padStart(2, '0')
        const mm = String(m).padStart(2, '0')
        const value = `${hh}:${mm}`
        const ampm = h >= 12 ? 'PM' : 'AM'
        const h12 = (h % 12) || 12
        const label = `${h12}:${mm} ${ampm}`
        const disabled = isPastSlot(value)
        arr.push({ value, label, disabled })
      }
    }
    return arr
  }, [isToday, nowHM])

  const timeIndex = useMemo(() => {
    const ix = slotItems.findIndex(s => s.value === time)
    return ix === -1 ? 0 : ix
  }, [slotItems, time])

  // Helpers for compact date/time controls
  const maxDays = 14
  const tomorrowStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate()+1)
    const mm = String(d.getMonth()+1).padStart(2,'0')
    const dd = String(d.getDate()).padStart(2,'0')
    return `${d.getFullYear()}-${mm}-${dd}`
  }, [])
  const endStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate()+maxDays-1)
    const mm = String(d.getMonth()+1).padStart(2,'0')
    const dd = String(d.getDate()).padStart(2,'0')
    return `${d.getFullYear()}-${mm}-${dd}`
  }, [maxDays])

  const isoFromDate = (d) => {
    const mm = String(d.getMonth()+1).padStart(2,'0')
    const dd = String(d.getDate()).padStart(2,'0')
    return `${d.getFullYear()}-${mm}-${dd}`
  }
  const fmtDateLabel = (iso) => {
    if (!iso) return '—'
    if (iso === todayStr) return 'Today'
    if (iso === tomorrowStr) return 'Tomorrow'
    const d = new Date(iso); if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  const stepDay = (dir) => {
    const cur = date ? new Date(date) : new Date(todayStr)
    cur.setDate(cur.getDate() + (dir > 0 ? 1 : -1))
    const nextIso = isoFromDate(cur)
    if (nextIso < todayStr || nextIso > endStr) return
    setDate(nextIso)
  }
  const stepTime = (dir) => {
    let nx = timeIndex + (dir > 0 ? 1 : -1)
    while (nx >= 0 && nx < slotItems.length && slotItems[nx].disabled) {
      nx += (dir > 0 ? 1 : -1)
    }
    if (nx >= 0 && nx < slotItems.length) {
      const val = slotItems[nx].value
      setTime(val)
      // show warning immediately while selecting time
      setTimeout(() => { if (form.doctorId && date) checkAvailability(date, val) }, 0)
    }
  }

  // Automatically check availability when doctor/date/time changes (debounced)
  useEffect(() => {
    if (!open || !form.doctorId || !date || !time) return
    const t = setTimeout(() => { checkAvailability(date, time) }, 120)
    return () => clearTimeout(t)
  }, [open, form.doctorId, date, time])

  // ---------- Busy suggestions helpers ----------
  const normalizeSlot = (s) => String(s).slice(0,5) // "HH:MM"
  const fmt12 = (val) => {
    const [hh='0', mm='00'] = normalizeSlot(val).split(':')
    const h = parseInt(hh,10); const ampm = h>=12?'PM':'AM'
    const h12 = (h%12)||12
    return `${h12}:${mm} ${ampm}`
  }
  const buildSuggestions = (center, take = 1) => {
    const target = normalizeSlot(center)
    let i = slotItems.findIndex(s => s.value === target)
    if (i < 0) i = slotItems.findIndex(s => !s.disabled)
    const res = []
    let left = i - 1, right = i + 1
    while (res.length < take && (left >= 0 || right < slotItems.length)) {
      if (right < slotItems.length) {
        const r = slotItems[right]; if (!r.disabled) res.push(r.value)
        right++
      }
      if (res.length < take && left >= 0) {
        const l = slotItems[left]; if (!l.disabled) res.push(l.value)
        left--
      }
    }
    return Array.from(new Set(res)).map(normalizeSlot)
  }
  // NEW: ordered nearby times around the chosen time (exact, +1, -1, +2, -2, ...)
  const orderedNearbyTimes = (center) => {
    const target = normalizeSlot(center || time || '00:00')
    let i = slotItems.findIndex(s => s.value === target)
    if (i < 0) i = slotItems.findIndex(s => !s.disabled)
    const order = []
    let d = 0
    while (order.length < 8 && (i - d >= 0 || i + d < slotItems.length)) {
      if (d === 0) {
        if (slotItems[i] && !slotItems[i].disabled) order.push(slotItems[i].value)
      } else {
        const r = i + d; if (slotItems[r] && !slotItems[r].disabled) order.push(slotItems[r].value)
        const l = i - d; if (slotItems[l] && !slotItems[l].disabled) order.push(slotItems[l].value)
      }
      d++
    }
    return order.map(normalizeSlot)
  }
  // Find nearest free slot for an alternate doctor (same department)
  const findAltNearest = async (dateIso, fromTime) => {
    try {
      const me = doctors.find(d => String(d.doctor_id) === String(form.doctorId))
      if (!me) return null
      const deptKey = me.department_id ?? me.specialization
      const candidates = doctors.filter(d =>
        String(d.doctor_id) !== String(form.doctorId) &&
        (d.department_id ?? d.specialization) === deptKey
      )
      const times = orderedNearbyTimes(fromTime)
      for (const cand of candidates) {
        // check exact and nearby times in nearest-first order
        for (const t of times) {
          const r = await api.get('/appointments/availability', {
            params: { doctorId: cand.doctor_id, date: dateIso, time: t }
          })
          if (r?.data?.available) return { id: cand.doctor_id, name: cand.name, time: t }
        }
      }
      return null
    } catch {
      return null
    }
  }
  // ------------------------------------------------

  // Fetch doctors when opening
  useEffect(()=>{
    if (!open) return
    (async ()=>{
      try {
        const res = await api.get('/doctors')
        setDoctors(res.data?.rows || [])
      } catch {
        setDoctors([])
      }
    })()
  },[open])

  // Lock body scroll + focus first control + Escape/overlay close
  useEffect(()=>{
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(()=> firstFieldRef.current?.focus(), 60)
    const onKey = (e)=>{ if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return ()=>{
      document.body.style.overflow = prev
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  // Reset error on open
  useEffect(()=>{ if(open){ setError('') } },[open])

  // Ensure defaults on open (today + first valid slot)
  useEffect(() => {
    if (!open) return
    if (!date) setDate(todayStr)
  }, [open, date, todayStr])

  useEffect(() => {
    if (!open) return
    if (!time) {
      const next = slotItems.find(s => !s.disabled)
      if (next) setTime(next.value)
    } else if (isToday && isPastSlot(time)) {
      const ix = slotItems.findIndex(s => s.value === time)
      const next = slotItems.slice(Math.max(ix, 0)).find(s => !s.disabled)
      setTime(next?.value || '')
    }
  }, [open, slotItems, time, isToday])

  // Availability check (doctor/date/time) – keep as-is but cap to single suggestion
  const checkAvailability = async (d = date, t = time) => {
    if (!form.doctorId || !d || !t) return true
    try {
      availAbortRef.current?.abort?.()
      const ctrl = new AbortController()
      availAbortRef.current = ctrl
      const res = await api.get('/appointments/availability', {
        params: { doctorId: form.doctorId, date: d, time: t },
        signal: ctrl.signal
      })
      const ok = res?.data?.available !== false
      setBusy(!ok)
      let sugg = res?.data?.suggestions || []
      if (!ok && (!sugg || !sugg.length)) {
        sugg = buildSuggestions(t, 1) // only one suggestion
      }
      setSuggestions((sugg || []).slice(0,1).map(normalizeSlot))
      return ok
    } catch (err) {
      if (err?.name === 'AbortError' || err?.name === 'CanceledError') return false
      setBusy(false); setSuggestions([])
      return true
    }
  }

  // When slot is busy, find an alternate doctor in same department at nearest slot
  useEffect(() => {
    const run = async () => {
      setAltDoc(null)
      if (!busy || !form.doctorId || !date || !time || !doctors?.length) return
      setAltLoading(true)
      try {
        const nearest = await findAltNearest(date, time)
        if (nearest) setAltDoc(nearest)
      } finally {
        setAltLoading(false)
      }
    }
    run()
  }, [busy, form.doctorId, date, time, doctors])

  // Handlers
  const change = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }
  const changeFiles = (e) => {
    const files = Array.from(e.target.files || [])
    setForm(f => ({ ...f, files }))
  }

  // Validate
  const validate = () => {
    if (!date || !time) { setError('Please choose date and time.'); return false }
    if (date < todayStr) { setError('Appointment date and time cannot be in the past.'); return false }
    if (isPastSlot(time)) { setError('Appointment time cannot be in the past.'); return false }
    if (busy) { setError('Doctor is busy at this time. Please adjust the time.'); return false }
    setError(''); return true
  }

  const isValid = !!(form.doctorId && date && time && date >= todayStr && !isPastSlot(time) && !busy)

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    // Re-check availability before submit
    const ok = await checkAvailability(date, time)
    if (!ok) { setError('Doctor is busy at this time. Please adjust the time.'); return }
    if (!validate()) return
    try {
      const fd = new FormData()
      fd.append('doctorId', form.doctorId)
      fd.append('date', date)
      fd.append('time', time)
      if (form.reason) fd.append('reason', form.reason)
      form.files.forEach(f => fd.append('attachments', f))
      await api.post('/appointments', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Appointment request sent')
      onBooked?.(); onClose?.()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Booking failed')
    }
  }

  // Add this block before: if (!open) return null
  const calDays = useMemo(() => {
    // Show calendar for the month of the selected date (or today)
    const base = date ? new Date(date) : new Date(todayStr)
    const year = base.getFullYear()
    const month = base.getMonth()
    // First and last day of month
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    // Days to show before the 1st (to fill week)
    const startDay = first.getDay()
    // Build all days for the grid
    const days = []
    // Previous month's trailing days
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, 1 - i)
      days.push({ d, iso: isoFromDate(d), isOtherMonth: true })
    }
    // Current month days
    for (let i = 1; i <= last.getDate(); i++) {
      const d = new Date(year, month, i)
      days.push({ d, iso: isoFromDate(d), isOtherMonth: false })
    }
    // Next month's leading days
    for (let i = 1; days.length % 7 !== 0; i++) {
      const d = new Date(year, month + 1, i)
      days.push({ d, iso: isoFromDate(d), isOtherMonth: true })
    }
    // Filter by min/max range
    return days.filter(c => c.iso >= todayStr && c.iso <= endStr)
  }, [date, todayStr, endStr, isoFromDate])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      onMouseDown={(e)=>{ if (e.target===overlayRef.current) onClose?.() }}
      className="modal-backdrop fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm grid place-items-center p-4"
      role="dialog" aria-modal="true" aria-labelledby="appt-title"
    >
      <motion.form initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} onSubmit={handleSubmit} className="modal-panel w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl grid place-items-center text-white text-sm font-semibold bg-brand-gradient">SA</div>
            <div>
              <h3 id="appt-title" className="text-base font-semibold">Book Appointment</h3>
              <p className="text-xs text-slate-500">Choose your doctor, date and a time slot</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="button-outline btn-pill" aria-label="Close">Close</button>
        </div>

        {/* Body */}
        <div className="modal-body ui-form grid gap-6">
          {/* Doctor */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">Doctor</label>
            <select
              ref={firstFieldRef}
              name="doctorId"
              value={form.doctorId}
              onChange={change}
              required
              className="select-soft"
              aria-invalid={!form.doctorId}
            >
              <option value="">Select doctor</option>
              {doctors.map(d => (
                <option key={d.doctor_id} value={d.doctor_id}>
                  {d.name}{d.specialization ? ` — ${d.specialization}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time row (appearance improved, layout unchanged) */}
          <div className="grid gap-2">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5">
              {/* Date */}
              <div className="flex-1 min-w-0">
                <label className="text-sm font-medium">Date</label>
                <div className="mt-1 flex items-center gap-2 relative">
                  <button type="button" onClick={()=>stepDay(-1)} className="w-8 h-8 rounded-full grid place-items-center bg-white/80 border border-slate-200 shadow-sm hover:bg-white disabled:opacity-40" aria-label="Previous day" disabled={(date || todayStr) <= todayStr}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>

                  <motion.div
                    key={`date-${date || todayStr}`}
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 0.35 }}
                    className="px-3 py-2 rounded-full bg-white/80 border border-slate-200 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-transparent hover:ring-cyan-300/40 cursor-pointer select-none"
                    onDoubleClick={()=>setShowCal(v=>!v)}
                    title="Double-click to open calendar"
                  >
                    {fmtDateLabel(date || todayStr)}
                  </motion.div>

                  <button type="button" onClick={()=>stepDay(1)} className="w-8 h-8 rounded-full grid place-items-center bg-white/80 border border-slate-200 shadow-sm hover:bg-white disabled:opacity-40" aria-label="Next day" disabled={(date || todayStr) >= endStr}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>

                  {showCal && (
                    <div className="absolute z-10 top-[115%] left-1 surface-card p-3 w-[300px]">
                      <div className="text-xs font-semibold text-slate-600 mb-2">Select a date</div>
                      <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold text-slate-500 mb-1">
                        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="text-center">{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {calDays.map((c, i) => {
                          const selected = (c.iso === date) || (!date && i === 0)
                          return (
                            <button
                              key={c.iso}
                              type="button"
                              onClick={() => { setDate(c.iso); setShowCal(false) }}
                              className={`px-2 py-2 rounded-xl text-xs font-semibold text-center transition
                                ${selected ? 'bg-brand-gradient text-white shadow' : 'bg-white/80 border border-slate-200 text-slate-700 hover:bg-white'}
                              `}
                              title={fmtDateLabel(c.iso)}
                            >
                              {c.d.getDate()}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Time */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Time (30 min slots)</label>
                  {/* removed: Find a free slot button */}
                </div>

                <div className="mt-1 flex items-center gap-2">
                  <button type="button" onClick={()=>stepTime(-1)} className="w-8 h-8 rounded-full grid place-items-center bg-white/80 border border-slate-200 shadow-sm hover:bg-white disabled:opacity-40" aria-label="Previous time" disabled={timeIndex <= 0}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>

                  <motion.div
                    key={`time-${time || 'none'}`}
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 0.35 }}
                    className={`px-3 py-2 rounded-full bg-white/80 border ${busy ? 'border-rose-300 ring-rose-300/40' : 'border-slate-200'} text-sm font-semibold text-slate-700 shadow-sm min-w-[120px] text-center ring-1 ring-transparent`}
                  >
                    {(() => {
                      const cur = slotItems[timeIndex]
                      return cur ? cur.label : 'Select time'
                    })()}
                  </motion.div>

                  <button type="button" onClick={()=>stepTime(1)} className="w-8 h-8 rounded-full grid place-items-center bg-white/80 border border-slate-200 shadow-sm hover:bg-white disabled:opacity-40" aria-label="Next time" disabled={timeIndex >= slotItems.length - 1}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>

                {/* Single inline row: message + one suggested time + alternate doctor */}
                {busy && (
                  <div className="mt-2 text-xs flex flex-wrap items-center gap-2">
                    <span className="text-rose-600">
                      Doctor is busy at this time — kindly select a different time.
                    </span>

                    {!!suggestions?.[0] && (
                      <button
                        type="button"
                        onClick={() => { setTime(String(suggestions[0]).slice(0,5)); setBusy(false) }}
                        className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                        title={`Use ${fmt12(suggestions[0])}`}
                      >
                        Suggested: {fmt12(suggestions[0])}
                      </button>
                    )}

                    {altLoading && <span className="text-slate-500">Checking alternate doctor…</span>}
                    {!altLoading && altDoc && (
                      <button
                        type="button"
                        onClick={async () => {
                          // switch to alternate doctor and nearest free time, clear warning
                          setForm(f => ({ ...f, doctorId: altDoc.id }))
                          setTime(altDoc.time)
                          setBusy(false)
                          setSuggestions([])
                          setAltDoc(null)
                          setError('')
                          await checkAvailability(date, altDoc.time) // confirm and keep warning cleared
                        }}
                        className="px-2 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100"
                        title={`Switch to ${altDoc.name} at ${fmt12(altDoc.time)}`}
                      >
                        Alternate: {altDoc.name} at {fmt12(altDoc.time)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500">Past slots for today are disabled automatically.</p>
          </div>

          {/* Divider, Reason, Files */}
          <div className="divider-soft" />

          {/* Reason */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">Reason (optional)</label>
            <textarea
              name="reason"
              value={form.reason}
              onChange={change}
              placeholder="Briefly describe your symptoms or context…"
              className="textarea-soft min-h-[120px] resize-y"
            />
          </div>

          {/* Files */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">Upload Past Medical Records</label>
            <input id="attachments" type="file" multiple onChange={changeFiles} className="sr-only" />
            <label htmlFor="attachments" className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 hover:border-cyan-400/70 bg-gradient-to-b from-slate-50 to-white p-6 grid place-items-center text-center transition">
              <div className="flex flex-col items-center gap-2">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="w-10 h-10 text-cyan-500/80"><path fill="currentColor" d="M19 15v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4H3l9-9l9 9zM13 3h-2v6h2z"/></svg>
                <span className="text-sm text-slate-600">Drag & drop or <span className="font-semibold text-cyan-600">Browse files</span></span>
                <span className="text-xs text-slate-400">PDF, JPG, PNG up to 10MB each</span>
              </div>
            </label>

            {form.files?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.files.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4 text-slate-500"><path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16l4-4h8a2 2 0 0 0 2-2V6z"/></svg>
                    <span className="max-w-[220px] truncate">{f.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <div className="form-error mt-1">⚠️ {error}</div>}
        </div>

        {/* Footer */}
        <div className="modal-actions">
          <button type="button" onClick={onClose} className="btn-secondary btn-pill">Cancel</button>
          <button className="btn-primary btn-pill hover:shadow-lg" disabled={!isValid} aria-disabled={!isValid}>
            Book Appointment
          </button>
        </div>
      </motion.form>
    </div>
  )
}