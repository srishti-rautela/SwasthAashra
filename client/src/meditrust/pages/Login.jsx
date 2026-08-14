import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMediTrustAuth } from '../context/MediTrustAuthContext';

const ROLES = [
  { id: 'patient', label: 'Patient', icon: '🧑‍⚕️' },
  { id: 'manufacturer', label: 'Pharma', icon: '🏭' },
  { id: 'admin', label: 'Admin', icon: '🛡️' },
];

export default function Login() {
  const [role, setRole] = useState('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useMediTrustAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const user = await login(email, password, role);
      toast.success(`Welcome back, ${user.name}!`);
      if (user.role === 'admin') navigate('/medicine/admin/dashboard');
      else if (user.role === 'manufacturer') navigate('/medicine/manufacturer/dashboard');
      else navigate('/medicine/verify');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      {/* Brand Panel */}
      <div className="auth-brand-panel">
        <div className="brand-grid" />
      </div>

      {/* Form Panel */}
      <div className="auth-form-panel">
        <div className="auth-form-inner fade-in">
          <div className="auth-form-header">
            <h2 className="auth-form-title">Sign in</h2>
            <p className="auth-form-sub">Choose your Role and Enter Credentials</p>
          </div>

          {/* Role Selector */}
          <div className="role-selector">
            {ROLES.map((r) => (
              <button
                key={r.id}
                className={`role-btn ${role === r.id ? 'active' : ''}`}
                data-role={r.id}
                onClick={() => setRole(r.id)}
                type="button"
              >
                <span className="role-icon">{r.icon}</span>
                <span className="role-label">{r.label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <span className="input-icon"><Mail size={16} /></span>
                <input
                  type="email"
                  className="form-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <span className="input-icon"><Lock size={16} /></span>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="input-toggle"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={`btn-primary ${loading ? 'loading' : ''}`}
              disabled={loading}
            >
              {!loading && (
                <>
                  <ShieldCheck size={18} />
                  Sign In Securely
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="divider">or</div>

          <div className="auth-switch">
            Don't have an account?{' '}
            <Link to="/medicine/register">Create one →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
