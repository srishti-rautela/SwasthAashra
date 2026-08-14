// ================== MediTrust Section ==================
// This is the "Medicine Verification" module ported from the standalone
// MediTrust project. It is mounted inside SwasthAashra's router under the
// "/medicine" path prefix (see client/src/App.jsx) and runs on its own
// authentication context (MediTrustAuthContext) so hospital-staff logins
// and MediTrust patient/manufacturer/admin logins never collide.

import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { MediTrustAuthProvider, useMediTrustAuth } from './context/MediTrustAuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import PublicRoute from './components/auth/PublicRoute';
import './meditrust.css';

// Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyMedicine from './pages/VerifyMedicine';
import AdminDashboard from './pages/AdminDashboard';
import Heatmap from './pages/Heatmap';
import ManufacturerDashboard from './pages/ManufacturerDashboard';
import VerificationHistory from './pages/VerificationHistory';
import Profile from './pages/Profile';

const Unauthorized = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', fontFamily: 'var(--font-body)' }}>
    <span style={{ fontSize: '4rem' }}>🚫</span>
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}>Access Denied</h2>
    <p style={{ color: '#64748b' }}>You don't have permission to view this page.</p>
    <a href="/medicine/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Go to Login</a>
  </div>
);

function DefaultRedirect() {
  const { user } = useMediTrustAuth();

  if (!user) return <Navigate to="/medicine/login" replace />;
  if (user.role === 'admin') return <Navigate to="/medicine/admin/dashboard" replace />;
  if (user.role === 'manufacturer') return <Navigate to="/medicine/manufacturer/dashboard" replace />;
  return <Navigate to="/medicine/verify" replace />;
}

function MediTrustRoutes() {
  return (
    <div className="meditrust-app">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: 'var(--font-body)',
            borderRadius: '12px',
            fontSize: '0.88rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          },
          success: { iconTheme: { primary: 'var(--success)', secondary: 'white' } },
          error: { iconTheme: { primary: 'var(--danger)', secondary: 'white' } },
        }}
      />
      <Routes>
        {/* Public Routes */}
        <Route
          path="login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route path="unauthorized" element={<Unauthorized />} />

        {/* Landing Page */}
        <Route path="" element={<LandingPage />} />

        {/* Patient Routes */}
        <Route
          path="verify"
          element={
            <ProtectedRoute allowedRoles={['patient', 'admin', 'manufacturer']}>
              <VerifyMedicine />
            </ProtectedRoute>
          }
        />
        <Route
          path="history"
          element={
            <ProtectedRoute allowedRoles={['patient', 'admin', 'manufacturer']}>
              <VerificationHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute allowedRoles={['patient', 'admin', 'manufacturer']}>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/heatmap"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Heatmap />
            </ProtectedRoute>
          }
        />

        {/* Manufacturer Routes */}
        <Route
          path="manufacturer/dashboard"
          element={
            <ProtectedRoute allowedRoles={['manufacturer', 'admin']}>
              <ManufacturerDashboard />
            </ProtectedRoute>
          }
        />

        {/* Catch all within the /medicine section */}
        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </div>
  );
}

export default function MediTrustApp() {
  return (
    <MediTrustAuthProvider>
      <MediTrustRoutes />
    </MediTrustAuthProvider>
  );
}
