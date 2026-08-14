import { Navigate } from 'react-router-dom';
import { useMediTrustAuth } from '../../context/MediTrustAuthContext';

function getDefaultRoute(user) {
  if (user?.role === 'admin') return '/medicine/admin/dashboard';
  if (user?.role === 'manufacturer') return '/medicine/manufacturer/dashboard';
  return '/medicine/verify';
}

export default function PublicRoute({ children }) {
  const { user, loading } = useMediTrustAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: '1rem',
        background: 'var(--surface)',
      }}>
        <div style={{
          width: 48, height: 48, border: '3px solid var(--surface-2)',
          borderTopColor: 'var(--primary)', borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <p style={{ color: '#64748b', fontFamily: 'var(--font-body)' }}>Loading MEDITRUST...</p>
      </div>
    );
  }

  if (user) return <Navigate to={getDefaultRoute(user)} replace />;

  return children;
}
