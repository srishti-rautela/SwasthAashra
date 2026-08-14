// ================== Imports ==================

import { useContext, useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import AuthContext from '../utils/AuthContext'
import { motion } from 'framer-motion'

const LOGO_SRC = '/photos/logo_head.png'

// ---------- Route resolution ----------
const roleToPath = (role, department) => {
  const r = String(role || '').toLowerCase()
  const dept = String(department || '').toLowerCase()
  
  // Handle staff based on department - priority routing
  if (r === 'staff') {
    if (dept === 'pharmacy') return '/dashboard/pharmacy'
    if (dept === 'insurance') return '/dashboard/insurance'
    if (dept === 'staff') return '/dashboard/staff'
    if (dept === 'reception') return '/dashboard/staff'
    return '/dashboard/staff' // Default fallback
  }
  
  // Handle direct role-based routing
  if (r === 'pharmacy') return '/dashboard/pharmacy'
  if (r === 'insurance') return '/dashboard/insurance'
  
  const map = {
    patient: '/dashboard/patient',
    doctor: '/dashboard/doctor',
    admin: '/dashboard/staff',
  }
  return map[r] || '/dashboard/patient'
}

// ================== Component Definition ==================

export default function AuthPage(props) {
  // ================== State ==================

  const { user, token, login } = useContext(AuthContext)
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // ================== Effects ==================

  // ---------- Auth redirect on token ----------
  useEffect(() => {
    if (token && user?.role) {
      const target = roleToPath(user.role, user.department)
      navigate(target, { replace: true })
    }
  }, [token, user, navigate])

  // ================== Actions / Handlers ==================

  const onChange = (e) => setForm(s => ({ ...s, [e.target.name]: e.target.value }))

  // ---------- @@SUBMIT_LOGIN ----------
  const onSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { toast.error('Enter email and password'); return }
    setLoading(true)
    try {
      const res = await axios.post('/api/auth/login', { email: form.email, password: form.password })
      const usr = res.data?.user
      const tkn = res.data?.token
      login(tkn, usr)
      const target = roleToPath(usr?.role, usr?.department)
      navigate(target, { replace: true })
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Sign in failed')
    } finally { setLoading(false) }
  }

  // ================== Rendering ==================

  return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        className="relative w-full max-w-md bg-white/80 backdrop-blur-xl border border-slate-200 rounded-3xl shadow-2xl ring-1 ring-black/10 p-10"
      >
        <div className="flex justify-center mb-6">
          <img src={LOGO_SRC} alt="SwasthaAshra logo" className="h-14 w-40 object-contain" draggable="false" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2 text-center">Sign in</h2>
        <p className="text-base text-slate-600 mb-6 text-center">Log in to continue</p>

        <form onSubmit={onSubmit} className="grid gap-4">
          <input
            name="email"
            value={form.email}
            onChange={onChange}
            placeholder="Email"
            type="email"
            className="w-full px-3 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
          />
          <input
            name="password"
            value={form.password}
            onChange={onChange}
            placeholder="Password"
            type="password"
            className="w-full px-3 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:brightness-110 disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-700 text-center">
          Don’t have an account?{' '}
          <Link to="/register" className="text-cyan-600 hover:text-blue-600 font-medium">Sign up</Link>
        </p>
      </motion.div>
    </div>
  )
}