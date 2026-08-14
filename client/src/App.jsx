import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import RegisterPatient from './pages/RegisterPatient'
import ProtectedRoute from './utils/ProtectedRoute'
import DashboardRouter from './pages/DashboardRouter'
import Profile from './pages/Profile'
import MediTrustApp from './meditrust/MediTrustApp'
import './index.css'
import 'react-toastify/dist/ReactToastify.css'

export default function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/login" element={<Navigate to="/auth" replace />} />
          <Route path="/register" element={<RegisterPatient />} />

          <Route
            path="/dashboard/:role"
            element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            }
          />
          <Route path="/profile" element={<Profile />} />

          {/* Medicine Verification module (from MediTrust) — has its own
              auth, layout, and CSS scope; see client/src/meditrust/ */}
          <Route path="/medicine/*" element={<MediTrustApp />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer position="top-right" autoClose={2500} />
    </>
  )
}
