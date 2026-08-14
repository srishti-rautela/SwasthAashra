import Navbar from '../components/layout/Navbar';
import { useMediTrustAuth } from '../context/MediTrustAuthContext';

export default function Profile() {
  const { user } = useMediTrustAuth();

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '2.4rem 1.2rem' }}>
        <div className="card fade-in">
          <h1 className="page-title">Profile</h1>
          <p className="page-sub">Account details and role identity.</p>

          <div className="grid-2">
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Name</div>
              <div style={{ marginTop: 4, fontSize: '1rem', fontWeight: 700 }}>{user?.name || 'N/A'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Email</div>
              <div style={{ marginTop: 4, fontSize: '1rem', fontWeight: 700 }}>{user?.email || 'N/A'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Role</div>
              <div style={{ marginTop: 4, fontSize: '1rem', fontWeight: 700, textTransform: 'capitalize' }}>{user?.role || 'N/A'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Phone</div>
              <div style={{ marginTop: 4, fontSize: '1rem', fontWeight: 700 }}>{user?.phone || 'Not provided'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Company</div>
              <div style={{ marginTop: 4, fontSize: '1rem', fontWeight: 700 }}>{user?.company || 'Not applicable'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>License</div>
              <div style={{ marginTop: 4, fontSize: '1rem', fontWeight: 700 }}>{user?.licenseNo || 'Not applicable'}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
