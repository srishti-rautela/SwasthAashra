// ================== Imports ==================

import { useContext, useMemo } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import AuthContext from '../utils/AuthContext'
import DashboardLayout from '../layouts/DashboardLayout'
import PatientDashboard from './PatientDashboard'
import DoctorDashboard from './DoctorDashboard'
import StaffDashboard from './StaffDashboard'
import PharmacyDashboard from './PharmacyDashboard'

// ================== Component Definition ==================

export default function DashboardRouter() {
  // ================== State ==================

  const { role: paramRole } = useParams()
  const { user } = useContext(AuthContext)

  // ================== Derived Data / Memos ==================

  // ---------- Normalize helper ----------
  const normalize = (r) => (r || '').toLowerCase()
  const target = useMemo(() => normalize(paramRole), [paramRole])
  const userRole = normalize(user?.role)
  const userDept = String(user?.department || '').toLowerCase()
  const valid = ['patient', 'doctor', 'staff', 'pharmacy', 'insurance']

  if (!valid.includes(target)) return <Navigate to="/auth" replace />
  
  // ---------- Routing resolution ----------
  // Determine the correct dashboard based on role and department
  let correctPath = null
  
  // Handle staff based on department
  if (userRole === 'staff') {
    if (userDept === 'pharmacy') correctPath = '/dashboard/pharmacy'
    else if (userDept === 'insurance') correctPath = '/dashboard/insurance'
    else if (userDept === 'staff') correctPath = '/dashboard/staff'
    else correctPath = '/dashboard/staff' // Reception or default
  }
  // Handle direct role-based routing
  else if (userRole === 'pharmacy') {
    correctPath = '/dashboard/pharmacy'
  }
  else if (userRole === 'insurance') {
    correctPath = '/dashboard/insurance'
  }
  // Handle other roles
  else if (userRole) {
    correctPath = `/dashboard/${userRole}`
  }
  
  // Redirect if current path doesn't match the correct path
  if (correctPath && target !== correctPath.split('/').pop()) {
    return <Navigate to={correctPath} replace />
  }

  // ---------- Role to component map ----------
  const map = {
    patient: <PatientDashboard />,
    doctor: <DoctorDashboard />,
    staff: <StaffDashboard />,
    pharmacy: <PharmacyDashboard />,
    insurance: <StaffDashboard />,
  }

  // ================== Rendering ==================

  return (
    <div className="app-page page-container">
      <DashboardLayout role={target}>{map[target] || <StaffDashboard />}</DashboardLayout>
    </div>
  )
}