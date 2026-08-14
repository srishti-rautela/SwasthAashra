// ================== Imports ==================

import { useContext } from 'react'
import { Navigate } from 'react-router-dom'
import AuthContext from '../utils/AuthContext'

// Move static map outside component
const roleFieldMap = {
  DOCTOR: [
    { key: 'specialization', label: 'Specialization' },
    { key: 'licenseNo', label: 'License No' },
    { key: 'experienceYears', label: 'Experience (yrs)' },
    { key: 'department', label: 'Department' },
    { key: 'clinic', label: 'Clinic/Hospital' },
    { key: 'availability', label: 'Availability' },
  ],
  PATIENT: [
    { key: 'age', label: 'Age' },
    { key: 'gender', label: 'Gender' },
    { key: 'bloodGroup', label: 'Blood Group' },
    { key: 'allergies', label: 'Allergies' },
    { key: 'chronicConditions', label: 'Chronic Conditions' },
    { key: 'emergencyContact', label: 'Emergency Contact' },
  ],
  STAFF: [
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'department', label: 'Department' },
    { key: 'designation', label: 'Designation' },
    { key: 'shift', label: 'Shift' },
  ],
  ADMIN: [
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'permissions', label: 'Permissions' },
    { key: 'lastLogin', label: 'Last Login' },
  ],
}

// ================== Component Definition ==================

export default function Profile() {
  // ================== State ==================
  const { user } = useContext(AuthContext) || {}

  if (!user) return <Navigate to="/auth" replace />

  // ================== Derived Data / Memos ==================

  const displayName = user.name || 'Your Name'
  const email = user.email || '—'
  const phone = user.phone || '—'
  const role = (user.role || 'USER').toUpperCase()

  // ---------- Initials for avatar ----------
  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const getVal = (k) => {
    const fromDetails = user?.roleDetails?.[k]
    const fromUser = user?.[k]
    return (fromDetails ?? fromUser) ?? '—'
  }

  const fields = roleFieldMap[role] || []

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(String(text ?? '')) } catch {}
  }

  const renderVal = (v) => {
    if (Array.isArray(v)) {
      return (
        <div className="flex flex-wrap gap-1">
          {v.map((it, i) => (
            <span key={i} className="px-2 py-0.5 text-xs rounded-md bg-[#EAF4FF] border border-[#E1E5EC]">
              {String(it)}
            </span>
          ))}
        </div>
      )
    }
    return String(v ?? '—')
  }

  // ================== Rendering ==================

  return (
    <div className="app-page page-container ui-form">
      <div
        className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6 text-[#1A1A1A]"
      >
        {/* Hero Card */}
        <div className="rounded-lg bg-gradient-to-r from-[#1C6DD0] to-[#3ECB8E] text-white p-6 shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 grid place-items-center text-2xl font-semibold ring-2 ring-white/50">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-semibold truncate">{displayName}</div>
              <div className="text-white/90 text-sm truncate">{email}</div>
              <div className="mt-2">
                <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md bg-white/20">
                  {role}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Overview tiles (modern display) */}
        <div className="rounded-lg border border-[#E1E5EC] bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-lg font-semibold mb-4">Overview</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Name */}
            <div className="flex items-start gap-3 p-3 rounded-md border border-[#E1E5EC] bg-[#F8FBFF]">
              <span className="text-xl">🧑</span>
              <div className="min-w-0">
                <div className="text-xs text-gray-500">Full Name</div>
                <div className="font-medium truncate">{displayName || '—'}</div>
              </div>
            </div>
            {/* Role */}
            <div className="flex items-start gap-3 p-3 rounded-md border border-[#E1E5EC] bg-[#F8FBFF]">
              <span className="text-xl">🪪</span>
              <div className="min-w-0">
                <div className="text-xs text-gray-500">Role</div>
                <div className="font-medium">
                  <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md bg-[#EAF4FF] border border-[#E1E5EC]">
                    {role}
                  </span>
                </div>
              </div>
            </div>
            {/* Email */}
            <div className="flex items-start gap-3 p-3 rounded-md border border-[#E1E5EC] bg-[#F8FBFF]">
              <span className="text-xl">✉️</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500">Email</div>
                <div className="font-medium truncate">{email}</div>
              </div>
              {user.email && (
                <button
                  onClick={() => copyText(user.email)}
                  className="text-xs px-2 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  title="Copy"
                >
                  Copy
                </button>
              )}
            </div>
            {/* Phone */}
            <div className="flex items-start gap-3 p-3 rounded-md border border-[#E1E5EC] bg-[#F8FBFF]">
              <span className="text-xl">📞</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500">Phone</div>
                <div className="font-medium truncate">{phone}</div>
              </div>
              {user.phone && (
                <button
                  onClick={() => copyText(user.phone)}
                  className="text-xs px-2 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  title="Copy"
                >
                  Copy
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Role Details */}
        <div className="rounded-lg border border-[#E1E5EC] bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Role Details(Preview--Features Coming Soon)</h3>
          </div>

          {fields.length ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {fields.map(({ key, label }) => {
                const v = getVal(key)
                return (
                  <div key={key} className="p-3 rounded-md border border-[#E1E5EC] bg-white">
                    <div className="text-xs text-gray-500">{label}</div>
                    <div className="font-medium mt-0.5">{renderVal(v)}</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-gray-600">No additional details for this role.</div>
          )}
        </div>
      </div>
    </div>
  )
}