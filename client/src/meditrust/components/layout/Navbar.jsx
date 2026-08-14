import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, LogOut, QrCode, LayoutDashboard, FileBarChart, UserCircle2, Bot, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMediTrustAuth } from '../../context/MediTrustAuthContext';
import MediBotChat from './MediBotChat';

const NAV_LINKS = {
  patient: [
    { to: '/medicine/verify', icon: <QrCode size={15} />, label: 'Verify Medicine' },
    { to: '/medicine/history', icon: <FileBarChart size={15} />, label: 'My History' },
  ],
  manufacturer: [
    { to: '/medicine/manufacturer/dashboard', icon: <LayoutDashboard size={15} />, label: 'Dashboard' },
    { to: '/medicine/history', icon: <FileBarChart size={15} />, label: 'Scan History' },
    { to: '/medicine/verify', icon: <QrCode size={15} />, label: 'Verify' },
  ],
  admin: [
    { to: '/medicine/admin/dashboard', icon: <LayoutDashboard size={15} />, label: 'Dashboard' },
    { to: '/medicine/history', icon: <FileBarChart size={15} />, label: 'History' },
    { to: '/medicine/verify', icon: <QrCode size={15} />, label: 'Verify' },
  ],
};

export default function Navbar() {
  const { user, logout } = useMediTrustAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPulse, setChatPulse] = useState(true);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/medicine/login');
  };

  const handleChatOpen = () => {
    setChatOpen(true);
    setChatPulse(false); // Stop pulse after first open
  };

  const roleLinks = NAV_LINKS[user?.role] || NAV_LINKS.patient;
  const links = [{ to: '/medicine', icon: <Home size={15} />, label: 'Home' }, ...roleLinks];
  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <>
      <nav className="navbar" style={{
        background: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 2px 8px rgba(79,70,229,0.04)',
        padding: '0 5%',
        height: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
      }}>
        <NavLink to="/medicine" className="nav-logo" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 38,
            height: 38,
            background: 'linear-gradient(135deg,#4f46e5,#6366f1)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <img
              src={'/meditrust/logo.png'}
              alt="MediTrust Logo"
              style={{ width: 28, height: 28, objectFit: 'contain', display: 'block' }}
            />
          </div>
          <span style={{
            fontWeight: 800,
            fontSize: '1.3rem',
            color: '#4f46e5',
            letterSpacing: '-0.03em',
          }}>
            MEDI<span style={{ color: '#111827' }}>TRUST</span>
          </span>
        </NavLink>

        <a
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#6b7280',
            textDecoration: 'none',
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
          }}
          title="Back to SwasthAashra hospital portal"
        >
          ← SwasthAashra
        </a>

        <ul className="nav-links" style={{ display: 'flex', gap: 14 }}>
          {links.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                className={({ isActive }) => isActive ? 'active' : ''}
                style={({ isActive }) => ({
                  color: isActive ? '#4f46e5' : '#6b7280',
                  fontWeight: 500,
                  fontSize: 15,
                  textDecoration: 'none',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: isActive ? '#eef2ff' : 'transparent',
                  transition: 'var(--transition)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                })}
              >
                {l.icon}
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

          {/* ── AI MediBot Button ── */}
          <button
            onClick={handleChatOpen}
            title="Ask MediBot — AI Health Assistant"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 15px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #0047cc 0%, #0066ff 100%)',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.855rem',
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
              position: 'relative',
              boxShadow: '0 4px 14px rgba(0,102,255,0.35)',
              transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,102,255,0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,102,255,0.35)';
            }}
          >
            {/* Pulse ring when not yet opened */}
            {chatPulse && (
              <span style={{
                position: 'absolute',
                inset: -3,
                borderRadius: 13,
                border: '2px solid rgba(0,102,255,0.5)',
                animation: 'navPulse 1.8s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
            )}

            <Bot size={16} />
            <span>AI Health Chat</span>
            <span style={{
              background: 'rgba(255,255,255,0.25)',
              borderRadius: 6,
              padding: '1px 6px',
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}>
              NEW
            </span>
          </button>

          {/* Avatar / Profile */}
          <div className="nav-right" style={{ position: 'relative' }}>
            <span className={`nav-role-badge ${user?.role}`}>
              {user?.role}
            </span>

            <button
              className="nav-avatar"
              title={user?.name}
              onClick={() => setMenuOpen((v) => !v)}
              style={{ border: menuOpen ? '2px solid var(--primary)' : undefined }}
            >
              {initials}
            </button>

            {menuOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: 48,
                width: 180,
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
                overflow: 'hidden',
              }}>
                <NavLink
                  to="/medicine/profile"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    textDecoration: 'none',
                    color: '#374151',
                    padding: '10px 12px',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                  }}
                >
                  <UserCircle2 size={16} />
                  Profile
                </NavLink>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: 'none',
                    borderTop: '1px solid #f1f5f9',
                    background: 'white',
                    color: '#ef4444',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                  }}
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Floating Chat Widget */}
      <MediBotChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />

      <style>{`
        @keyframes navPulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 0; transform: scale(1.15); }
        }
      `}</style>
    </>
  );
}
