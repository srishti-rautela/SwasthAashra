// ================== Imports ==================

import { useContext } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import AuthContext from './AuthContext'

// ================== Component Definition ==================

export default function ProtectedRoute({ children }) {
  // ================== State ==================

  const { token, ready } = useContext(AuthContext)
  const location = useLocation()

  // ================== Rendering ==================

  // ---------- Loading Guard ----------
  // @@AUTH_GUARD_LOADING_SPINNER
  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
      </div>
    )
  }
  // ---------- Access Guard ----------
  // @@AUTH_REDIRECT_TO_AUTH
  if (!token) return <Navigate to="/auth" state={{ from: location }} replace />

  // ---------- Authorized Render ----------
  return children
}