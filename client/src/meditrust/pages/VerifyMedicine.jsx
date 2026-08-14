import { useState } from 'react';
import { QrCode, Search, CheckCircle2, XCircle, AlertTriangle, HelpCircle, Clock, MapPin } from 'lucide-react';
import axios from '../utils/meditrustApi';
import toast from 'react-hot-toast';
import Navbar from '../components/layout/Navbar';

const STATUS_CONFIG = {
  genuine: {
    icon: <CheckCircle2 size={48} />,
    color: 'var(--success)',
    bg: 'rgba(0,196,106,0.08)',
    border: 'rgba(0,196,106,0.2)',
    label: 'Genuine Medicine',
    msg: 'This medicine has been verified and is authentic.',
  },
  fake: {
    icon: <XCircle size={48} />,
    color: 'var(--danger)',
    bg: 'rgba(255,59,92,0.08)',
    border: 'rgba(255,59,92,0.2)',
    label: 'FAKE MEDICINE',
    msg: 'WARNING: Do not consume this medicine. Report to authorities immediately.',
  },
  expired: {
    icon: <AlertTriangle size={48} />,
    color: 'var(--warning)',
    bg: 'rgba(255,170,0,0.08)',
    border: 'rgba(255,170,0,0.2)',
    label: 'Medicine Expired',
    msg: 'This medicine has passed its expiry date. Do not consume.',
  },
  unknown: {
    icon: <HelpCircle size={48} />,
    color: '#64748b',
    bg: 'rgba(100,116,139,0.08)',
    border: 'rgba(100,116,139,0.2)',
    label: 'Not Found(Unknown)',
    msg: 'This medicine is not registered in our database. Treat with caution.',
  },
};

export default function VerifyMedicine() {
  const [serial, setSerial] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!serial.trim()) { toast.error('Enter a serial number or scan QR'); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.post('/medicines/verify', { serial: serial.trim(), city: city.trim() || 'Unknown' });
      setResult(res.data);
      toast.success('Verification complete');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async () => {
    try {
      await axios.post('/reports', {
        serial: serial.trim(),
        medicineId: result?.medicine?._id,
        type: 'suspicious',
        city: result?.city || city,
        message: `Suspicious medicine reported from verification flow (${serial.trim()})`,
      });
      toast.success('Report submitted. Thank you for keeping medicines safe!');
    } catch {
      toast.error('Could not submit report');
    }
  };

  const handlePrescriptionUpload = async (file) => {
    if (!file) return;
    setOcrLoading(true);
    setOcrResult(null);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result;
        const res = await axios.post('/api/ocr/prescription', { imageBase64: base64 });
        setOcrResult(res.data);
        toast.success('OCR completed');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('OCR failed');
    } finally {
      setOcrLoading(false);
    }
  };

  const status = result ? STATUS_CONFIG[result.status] || STATUS_CONFIG.unknown : null;
  const riskLevel = result?.riskLevel || "safe";
  const RISK_CONFIG = {
    safe: { label: '🟢 Safe', color: 'var(--success)' },
    suspicious: { label: '🟡 Suspicious', color: 'var(--warning)' },
    high: { label: '🔴 High Risk', color: 'var(--danger)' },
  };

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '3rem 1.5rem' }}>
        {/* Header */}
        <div className="fade-in" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{
            width: 72, height: 72, background: 'var(--primary-light)',
            borderRadius: 20, display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 1rem',
            fontSize: '2rem',
          }}>
            💊
          </div>
          <h1 className="page-title">Verify Medicine</h1>
          <p className="page-sub">
            Enter the serial number from the medicine packaging or scan the QR code
          </p>
        </div>

        {/* Search Card */}
        <div className="card fade-in" style={{ marginBottom: '1.5rem' }}>
          <form onSubmit={handleVerify}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%',
                  transform: 'translateY(-50%)', color: '#94a3b8',
                  display: 'flex', alignItems: 'center',
                }}>
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: 42, fontSize: '1rem', height: 52 }}
                  placeholder="e.g. MED-2024-00123"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                />
              </div>
              <input
                type="text"
                className="form-input"
                style={{ width: 150, paddingLeft: 12, height: 52 }}
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <button
                type="submit"
                className={`btn-primary ${loading ? 'loading' : ''}`}
                disabled={loading}
                style={{ width: 'auto', padding: '0 2rem', marginTop: 0, flexShrink: 0 }}
              >
                {!loading && <><Search size={16} /> Verify</>}
              </button>
            </div>
          </form>

          <div className="divider" style={{ color: '#94a3b8', margin: '1.2rem 0' }}>or scan QR code</div>

          <button
            style={{
              width: '100%', padding: '14px', border: '2px dashed var(--surface-2)',
              borderRadius: 'var(--radius-md)', background: 'var(--surface)',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '10px', color: '#64748b',
              fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 500,
            }}
            
            onClick={() => toast('QR Scanner is not connected! Use serial number for now.')}
          >
            <QrCode size={20} />
            Open Camera to Scan QR Code
          </button>
        </div>

        {/* Result Card */}
        {result && status && (
          <div
            className="card fade-in"
            style={{
              background: status.bg,
              border: `2px solid ${status.border}`,
              borderRadius: 'var(--radius-lg)',
            }}
          >
            {/* Status Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ color: status.color }}>{status.icon}</div>
              <div>
                <h2 style={{
                  fontFamily: 'var(--font-display)', fontSize: '1.4rem',
                  fontWeight: 700, color: status.color, letterSpacing: '-0.02em',
                }}>
                  {status.label}
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '2px' }}>
                  {status.msg}
                </p>
              </div>
            </div>

            {/* Medicine Details */}
            {result.medicine && (
              <div style={{
                background: 'white', borderRadius: 'var(--radius-md)',
                padding: '1.2rem', display: 'grid',
                gridTemplateColumns: '1fr 1fr', gap: '1rem',
              }}>
                {[
                  { label: 'Medicine Name', value: result.medicine.name },
                  { label: 'Manufacturer', value: result.medicine.manufacturer },
                  { label: 'Batch No.', value: result.medicine.batchNo },
                  { label: 'Expiry Date', value: new Date(result.medicine.expiryDate).toLocaleDateString('en-IN') },
                  { label: 'Serial No.', value: result.medicine.serialNo },
                  { label: 'Dosage', value: result.medicine.dosage },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 3 }}>
                      {item.label}
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '0.9rem' }}>
                      {item.value || '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Verification Meta */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: '#64748b' }}>
                <Clock size={13} />
                Verified at {new Date(result.checkedAt || Date.now()).toLocaleTimeString('en-IN')}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: '#64748b' }}>
                <MapPin size={13} />
                {result.city || city}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: RISK_CONFIG[riskLevel].color, fontWeight: 700 }}>
                {RISK_CONFIG[riskLevel].label} {result.reportCount ? `• ${result.reportCount} reports` : ''}
              </span>
            </div>

            {result.suspiciousFlags?.length > 0 && (
              <div style={{ marginTop: '0.8rem', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {result.suspiciousFlags.map((flag) => (
                  <span
                    key={flag}
                    style={{
                      fontSize: '0.72rem',
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'rgba(255,59,92,0.12)',
                      color: 'var(--danger)',
                      fontWeight: 700,
                    }}
                  >
                    {flag}
                  </span>
                ))}
              </div>
            )}

            {/* Risk details & manufacturer trust */}
            <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div style={{ padding: '10px', background: 'rgba(0,0,0,0.03)', borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>Risk Summary</div>
                <div style={{ marginTop: 6, fontWeight: 700 }}>{RISK_CONFIG[riskLevel].label}</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 6 }}>
                  Duplicate scans (24h): {result.duplicateScans24h || 0}
                  <br />Reports: {result.reportCount || 0}
                </div>
              </div>
              <div style={{ padding: '10px', background: 'rgba(0,0,0,0.03)', borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>Manufacturer Trust</div>
                {result.manufacturerTrust ? (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontWeight: 700 }}>{result.manufacturerTrust.trustScore}%</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Fake: {result.manufacturerTrust.fakePercent}% • Reports: {result.manufacturerTrust.reportPercent}%</div>
                  </div>
                ) : (
                  <div style={{ marginTop: 6, color: '#64748b' }}>Not available</div>
                )}
              </div>
            </div>

            {/* Actions */}
            {result.status !== 'genuine' && (
              <button
                onClick={handleReport}
                style={{
                  marginTop: '1rem', width: '100%', padding: '12px',
                  background: 'var(--danger)', color: 'white', border: 'none',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  fontFamily: 'var(--font-display)', fontWeight: 600,
                  fontSize: '0.9rem', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '8px',
                }}
              >
                🚨 Report This Medicine as Suspicious
              </button>
            )}
          </div>
        )}

        {/* Info Strip */}
        <div style={{
          marginTop: '2rem', padding: '1rem 1.2rem',
          background: 'var(--primary-light)', borderRadius: 'var(--radius-md)',
          display: 'flex', gap: '10px', alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
          <p style={{ fontSize: '0.82rem', color: 'var(--primary-dark)', lineHeight: 1.6 }}>
            All verification attempts are logged with timestamp and location data for fraud detection analytics.
          </p>
        </div>
      </div>
    </>
  );
}
