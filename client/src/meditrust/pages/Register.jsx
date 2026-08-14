import { useState } from 'react';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, Building2, ShieldCheck, ArrowRight, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMediTrustAuth } from '../context/MediTrustAuthContext';

const ROLES = [
  { id: 'patient', label: 'Patient', icon: '🧑‍⚕️', desc: 'Verify medicines you buy' },
  { id: 'manufacturer', label: 'Pharma Co.', icon: '🏭', desc: 'Register & manage medicines' },
  { id: 'admin', label: 'Admin', icon: '🛡️', desc: 'System oversight & analytics' },
];

const Field = React.memo(({ label, type = 'text', placeholder, icon: Icon, toggle, toggleState, onToggle, value, onChange, error }) => (
  <div className="form-group">
    <label className="form-label">{label}</label>
    <div className="input-wrapper">
      <span className="input-icon"><Icon size={16} /></span>
      <input
        type={toggle ? (toggleState ? 'text' : 'password') : type}
        className={`form-input ${error ? 'error' : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
      {toggle && (
        <button type="button" className="input-toggle" onClick={onToggle}>
          {toggleState ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}
    </div>
    {error && <p className="form-error">⚠ {error}</p>}
  </div>
));

export default function Register() {
  const [role, setRole] = useState('patient');
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    phone: '', company: '', licenseNo: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { register } = useMediTrustAuth();
  const navigate = useNavigate();

  const update = (field) => (e) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email';
    if (form.password.length < 6) errs.password = 'Minimum 6 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (role === 'manufacturer' && !form.company.trim()) errs.company = 'Company name required';
    if (role === 'manufacturer' && !form.licenseNo.trim()) errs.licenseNo = 'License number required';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const user = await register({ ...form, role });
      toast.success(`Account created! Welcome, ${user.name}`);
      if (user.role === 'admin') navigate('/medicine/admin/dashboard');
      else if (user.role === 'manufacturer') navigate('/medicine/manufacturer/dashboard');
      else navigate('/medicine/verify');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      {/* Brand Panel */}
      <div className="auth-brand-panel">
      </div>

      {/* Form Panel */}
      <div className="auth-form-panel">
        <div className="auth-form-inner fade-in">
          <div className="auth-form-header">
            <h2 className="auth-form-title">Create Account</h2>
            <p className="auth-form-sub">Select your role to get started</p>
          </div>

          <div className="role-selector">
            {ROLES.map((r) => (
              <button
                key={r.id}
                className={`role-btn ${role === r.id ? 'active' : ''}`}
                onClick={() => setRole(r.id)}
                type="button"
              >
                <span className="role-icon">{r.icon}</span>
                <span className="role-label">{r.label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <Field label="Full Name" icon={User} value={form.name} onChange={update('name')} error={errors.name} />
            <Field label="Email Address" type="email" icon={Mail} value={form.email} onChange={update('email')} error={errors.email} />
            <Field label="Phone Number" icon={Phone} value={form.phone} onChange={update('phone')} error={errors.phone} />

            {role === 'manufacturer' && (
              <>
                <Field label="Company Name" icon={Building2} value={form.company} onChange={update('company')} error={errors.company} />
                <Field label="Drug License No." icon={ShieldCheck} value={form.licenseNo} onChange={update('licenseNo')} error={errors.licenseNo} />
              </>
            )}

            <Field
              label="Password"
              icon={Lock}
              toggle
              toggleState={showPass}
              onToggle={() => setShowPass(!showPass)}
              value={form.password}
              onChange={update('password')}
              error={errors.password}
            />

            <Field
              label="Confirm Password"
              icon={Lock}
              toggle
              toggleState={showPass}
              onToggle={() => setShowPass(!showPass)}
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              error={errors.confirmPassword}
            />

            <button type="submit" className={`btn-primary ${loading ? 'loading' : ''}`} disabled={loading}>
              {!loading && (
                <>
                  <ShieldCheck size={18} />
                  Create Account
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="auth-switch" style={{ marginTop: '1.5rem' }}>
            Already have an account? <Link to="/medicine/login">Sign in →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}