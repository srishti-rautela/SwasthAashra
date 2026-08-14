// ================== Imports ==================

import { useContext, useState } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { toast } from 'react-toastify'
import { Link, useNavigate } from 'react-router-dom'
import AuthContext from '../utils/AuthContext'
import { HiMail, HiLockClosed, HiUserCircle, HiPhone, HiOfficeBuilding } from 'react-icons/hi'

// ================== Component Definition ==================

const LOGO_SRC = '/photos/logo_head.png'

export default function RegisterPatient() {
  const { login } = useContext(AuthContext)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('patient')
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
    gender: '',
    age: '',
    contact: '',
    role: '',
    department: '',
    specialization: ''
  })
  const navigate = useNavigate()

  // ================== Actions / Handlers ==================

  // ---------- @@HANDLE_INPUT_CHANGE ----------
  function onChange(e) {
    const { name, value } = e.target
    let updates = { [name]: value }
    if (name === 'department' && value) {
      const deptLower = value.toLowerCase()
      if (['pharmacy', 'insurance'].includes(deptLower)) {
        updates.role = deptLower
      }
      updates.department = value
    }
    setForm(s => ({ ...s, ...updates }))
  }

  // ---------- @@SUBMIT_REGISTRATION ----------
  async function onSubmit(e) {
    e.preventDefault()
    if (activeTab === 'patient') {
      if (!form.name || !form.email || !form.password || !form.confirm) {
        toast.error('Please fill all required fields')
        return
      }
      if (form.password.length < 6) {
        toast.error('Password must be at least 6 characters')
        return
      }
      if (form.password !== form.confirm) {
        toast.error('Passwords do not match')
        return
      }
    }
    if (activeTab === 'hospital') {
      if (!form.name || !form.email || !form.password || !form.role) {
        toast.error('Please fill all required fields')
        return
      }
      if (form.password.length < 6) {
        toast.error('Password must be at least 6 characters')
        return
      }
      if (form.department) {
        const deptLower = form.department.toLowerCase()
        if (['pharmacy', 'insurance'].includes(deptLower)) {
          form.role = deptLower
        }
      }
    }
    setLoading(true)
    try {
      const registrationData = {
        name: form.name,
        email: form.email,
        password: form.password,
        gender: form.gender || null,
        age: form.age || null,
        contact: form.contact || null,
        role: activeTab === 'patient' ? 'patient' : form.role,
        department: activeTab === 'hospital' ? form.department || null : null,
        specialization: activeTab === 'hospital' ? form.specialization || null : null
      }
      if (activeTab === 'patient') {
        const res = await axios.post('/api/auth/register', registrationData)
        const usr = res.data?.user
        const tkn = res.data?.token
        login(tkn, usr)
        navigate('/dashboard/patient', { replace: true })
      } else {
        await axios.post('/api/auth/register', registrationData)
        toast.success('Account created successfully! Please sign in.')
        navigate('/auth', { replace: true })
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  // ================== Rendering ==================

  return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        className="relative w-full max-w-xl bg-white/80 backdrop-blur-xl border border-slate-200 rounded-3xl shadow-2xl ring-1 ring-black/10 p-10"
      >
        <div className="flex justify-center mb-6">
          <img
            src={LOGO_SRC}
            alt="SwasthaAshra logo"
            className="h-14 w-40 object-contain"
            draggable="false"
          />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2 text-center">Sign up</h2>
        <p className="text-base text-slate-600 mb-6 text-center">Create your account</p>

        {/* Tabs */}
        <div className="flex gap-2 bg-white/60 rounded-full p-1 mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('patient')
              setForm({
                name: '',
                email: '',
                password: '',
                confirm: '',
                gender: '',
                age: '',
                contact: '',
                role: '',
                department: '',
                specialization: ''
              })
            }}
            className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition ${
              activeTab === 'patient'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                : 'text-slate-700 hover:bg-white/50'
            }`}
          >
            Patient
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('hospital')
              setForm({
                name: '',
                email: '',
                password: '',
                confirm: '',
                gender: '',
                age: '',
                contact: '',
                role: '',
                department: '',
                specialization: ''
              })
            }}
            className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition ${
              activeTab === 'hospital'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                : 'text-slate-700 hover:bg-white/50'
            }`}
          >
            Hospital
          </button>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4">
          {activeTab === 'patient' ? (
            <>
              <div className="relative sm:col-span-2">
                <HiUserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  placeholder="Full name"
                  required
                  className="w-full pl-14 pr-4 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition text-center placeholder:text-left"
                />
              </div>
              <div className="relative sm:col-span-2">
                <HiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  name="email"
                  value={form.email}
                  onChange={onChange}
                  placeholder="Email"
                  type="email"
                  required
                  className="w-full pl-14 pr-4 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition text-center placeholder:text-left"
                />
              </div>
              <div className="relative">
                <HiLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  name="password"
                  value={form.password}
                  onChange={onChange}
                  placeholder="Password (min 6 chars)"
                  type="password"
                  required
                  className="w-full pl-14 pr-4 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition text-center placeholder:text-left"
                />
              </div>
              <div className="relative">
                <HiLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  name="confirm"
                  value={form.confirm}
                  onChange={onChange}
                  placeholder="Confirm password"
                  type="password"
                  required
                  className="w-full pl-14 pr-4 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition text-center placeholder:text-center"
                />
              </div>
              <select
                name="gender"
                value={form.gender}
                onChange={onChange}
                className="px-4 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition"
              >
                <option value="">Gender</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
              <input
                name="age"
                value={form.age}
                onChange={onChange}
                placeholder="Age"
                type="number"
                min="0"
                max="150"
                className="px-4 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition"
              />
              <div className="relative sm:col-span-2">
                <HiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  name="contact"
                  value={form.contact}
                  onChange={onChange}
                  placeholder="Contact number"
                  type="tel"
                  className="w-full pl-14 pr-4 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition"
                />
              </div>
            </>
          ) : (
            <>
              <div className="relative sm:col-span-2">
                <HiUserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  placeholder="Name"
                  required
                  className="w-full pl-14 pr-4 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition text-center placeholder:text-left"
                />
              </div>
              <div className="relative sm:col-span-2">
                <HiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  name="email"
                  value={form.email}
                  onChange={onChange}
                  placeholder="Email"
                  type="email"
                  required
                  className="w-full pl-14 pr-4 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition text-center placeholder:text-left"
                />
              </div>
              <div className="relative sm:col-span-2">
                <HiLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  name="password"
                  value={form.password}
                  onChange={onChange}
                  placeholder="Password (min 6 chars)"
                  type="password"
                  required
                  className="w-full pl-14 pr-4 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition text-center placeholder:text-left"
                />
              </div>
              <div>
                <select
                  name="role"
                  value={form.role}
                  onChange={onChange}
                  required
                  disabled={form.department && ['Pharmacy', 'Insurance'].includes(form.department)}
                  className={`w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition ${
                    form.department && ['Pharmacy', 'Insurance'].includes(form.department) 
                      ? 'bg-slate-100 cursor-not-allowed' 
                      : ''
                  }`}
                >
                  <option value="">Select Role</option>
                  <option value="doctor">Doctor</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
                {form.department && ['Pharmacy', 'Insurance'].includes(form.department) && (
                  <p className="text-xs text-slate-500 mt-1">Role auto-set to: {form.department.toLowerCase()}</p>
                )}
              </div>
              <select
                name="gender"
                value={form.gender}
                onChange={onChange}
                className="px-4 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition"
              >
                <option value="">Gender</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
              <input
                name="age"
                value={form.age}
                onChange={onChange}
                placeholder="Age"
                type="number"
                min="0"
                max="150"
                className="px-4 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition"
              />
              <div className="relative sm:col-span-2">
                <HiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  name="contact"
                  value={form.contact}
                  onChange={onChange}
                  placeholder="Contact number"
                  type="tel"
                  className="w-full pl-14 pr-4 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition"
                />
              </div>
              <select
                name="department"
                value={form.department}
                onChange={onChange}
                className="px-4 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition"
              >
                <option value="">Select Department (Optional)</option>
                <option value="Reception">Reception</option>
                <option value="Pharmacy">Pharmacy</option>
                <option value="Insurance">Insurance</option>
                <option value="Staff">Staff</option>
                <option value="Doctor">Doctor</option>
              </select>
              <div className="relative">
                <HiOfficeBuilding className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  name="specialization"
                  value={form.specialization}
                  onChange={onChange}
                  placeholder="Specialization"
                  className="w-full pl-14 pr-4 py-3 rounded-lg border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition text-center placeholder:text-left"
                />
              </div>
            </>
          )}
          <div className="flex justify-center mt-6">
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02, boxShadow: '0 0 15px #06B6D4' }}
              whileTap={{ scale: 0.98 }}
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold transition disabled:opacity-50"
              style={{ minWidth: 180 }}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </motion.button>
          </div>
        </form>

        <p className="mt-6 text-sm text-slate-700 text-center">
          Already have an account?{' '}
          <Link to="/auth" className="text-cyan-600 hover:text-blue-600 font-medium">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
