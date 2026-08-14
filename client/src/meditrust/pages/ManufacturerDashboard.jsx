import { useEffect, useMemo, useState } from 'react';
import { Plus, Package, QrCode, Siren, Factory } from 'lucide-react';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import axios from '../utils/meditrustApi';
import Navbar from '../components/layout/Navbar';
import { useMediTrustAuth } from '../context/MediTrustAuthContext';

const emptyForm = { name: '', batchNo: '', expiryDate: '', dosage: '', composition: '' };

export default function ManufacturerDashboard() {
  const { user } = useMediTrustAuth();
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [qrMed, setQrMed] = useState(null);
  const [dashboard, setDashboard] = useState({
    stats: { totalRegistered: 0, totalVerifications: 0, activeBatches: 0, recalledBatches: 0 },
    medicines: [],
    batches: [],
    topCities: [],
    suspiciousAlerts: [],
  });

  const fetchDashboard = async () => {
    try {
      const res = await axios.get('/medicines/manufacturer/dashboard');
      setDashboard(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load manufacturer dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const update = (f) => (e) => setForm((prev) => ({ ...prev, [f]: e.target.value }));

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.name || !form.batchNo || !form.expiryDate) {
      toast.error('Fill in required fields: name, batch, expiry');
      return;
    }

    setSubmitLoading(true);
    try {const payload = { ...form };
      if (!payload.serialNo) {
        delete payload.serialNo;
      }
      const res = await axios.post('/medicines', payload);
      setShowForm(false);
      setForm(emptyForm);
      setQrMed(res.data);
      toast.success('Medicine registered and QR generated');
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to register medicine');
    } finally {
      setSubmitLoading(false);
    }
  };

  const recallBatch = async (batchNo) => {
    const reason = window.prompt(`Enter recall reason for batch ${batchNo}:`) || 'Safety recall initiated';
    try {
      await axios.patch(`/medicines/batches/${batchNo}/recall`, { reason });
      toast.success(`Batch ${batchNo} recalled`);
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to recall batch');
    }
  };

  const statCards = useMemo(() => ([
    { label: 'Total Registered', value: dashboard.stats.totalRegistered, icon: '💊', bg: 'var(--primary-light)' },
    { label: 'Total Scans', value: dashboard.stats.totalVerifications, icon: '🔍', bg: 'rgba(0,196,106,0.1)' },
    { label: 'Active Batches', value: dashboard.stats.activeBatches, icon: '📦', bg: 'rgba(0,212,170,0.1)' },
    { label: 'Recalled Batches', value: dashboard.stats.recalledBatches, icon: '🚨', bg: 'rgba(255,59,92,0.1)' },
  ]), [dashboard.stats]);

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        <div className="flex items-center justify-between fade-in" style={{ marginBottom: '2rem' }}>
          <div>
            <h1 className="page-title">Manufacturer Control Center</h1>
            <p className="text-muted text-sm">{user?.company || user?.name} · Batch intelligence and product security</p>
          </div>
          <button className="btn-primary" style={{ width: 'auto', padding: '12px 20px', marginTop: 0 }} onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> Register Medicine
          </button>
        </div>

        {loading ? (
          <div className="card">Loading dashboard...</div>
        ) : (
          <>
            <div className="grid-4" style={{ marginBottom: '1.2rem' }}>
              {statCards.map((s) => (
                <div className="stat-card" key={s.label}>
                  <div>
                    <div className="stat-card-num">{s.value}</div>
                    <div className="stat-card-label">{s.label}</div>
                  </div>
                  <div className="stat-card-icon" style={{ background: s.bg, fontSize: '1.4rem' }}>{s.icon}</div>
                </div>
              ))}
            </div>

            {showForm && (
              <div className="card" style={{ marginBottom: '1.2rem', border: '2px solid var(--primary-light)' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '1rem' }}>Register New Medicine</h3>
                <form onSubmit={handleRegister}>
                  <div className="grid-2">
                    {[
                      { label: 'Medicine Name *', field: 'name', placeholder: 'e.g. Paracetamol 500mg' },
                      { label: 'Batch Number *', field: 'batchNo', placeholder: 'e.g. B-2026-001' },
                      { label: 'Expiry Date *', field: 'expiryDate', type: 'date' },
                      { label: 'Dosage', field: 'dosage', placeholder: 'e.g. 500mg twice daily' },
                      { label: 'Composition', field: 'composition', placeholder: 'e.g. Paracetamol IP 500mg' },
                    ].map((f) => (
                      <div className="form-group" key={f.field}>
                        <label className="form-label">{f.label}</label>
                        <input
                          type={f.type || 'text'}
                          className="form-input"
                          style={{ paddingLeft: 14 }}
                          placeholder={f.placeholder}
                          value={form[f.field]}
                          onChange={update(f.field)}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" className={`btn-primary ${submitLoading ? 'loading' : ''}`} style={{ width: 'auto', marginTop: 0, padding: '12px 20px' }}>
                      {!submitLoading && <><Package size={16} /> Save and Generate QR</>}
                    </button>
                    <button type="button" onClick={() => setShowForm(false)} style={{
                      padding: '12px 20px',
                      border: '1.5px solid var(--surface-2)',
                      borderRadius: 'var(--radius-md)',
                      background: 'white',
                      cursor: 'pointer',
                    }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid-2" style={{ marginBottom: '1.2rem' }}>
              <div className="card">
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 10 }}>Batch Management</h3>
                <div style={{ display: 'grid', gap: 8 }}>
                  {dashboard.batches.length === 0 && <p className="text-muted">No batches yet.</p>}
                  {dashboard.batches.map((batch) => (
                    <div key={batch.batchNo} style={{
                      border: '1px solid var(--surface-2)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      alignItems: 'center',
                      gap: 10,
                    }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{batch.batchNo}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 3 }}>
                          Units: {batch.totalUnits} · Scans: {batch.totalScans}
                        </div>
                        {batch.recalled && (
                          <div style={{ marginTop: 3, color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 700 }}>
                            Recalled: {batch.recallReason || 'Safety recall'}
                          </div>
                        )}
                      </div>
                      {!batch.recalled ? (
                        <button onClick={() => recallBatch(batch.batchNo)} style={{
                          border: 'none',
                          background: 'var(--danger)',
                          color: 'white',
                          padding: '7px 10px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}>
                          Recall
                        </button>
                      ) : (
                        <span className="status-badge fake">recalled</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div className="card">
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 10 }}>Top Sales/Scan Cities</h3>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {dashboard.topCities.length === 0 && <p className="text-muted">No city analytics yet.</p>}
                    {dashboard.topCities.map((city) => (
                      <div key={city.city} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}><Factory size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />{city.city}</span>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>{city.scans} scans</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card" style={{ border: '1px solid rgba(255,59,92,0.2)', background: 'rgba(255,59,92,0.03)' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 10, color: 'var(--danger)' }}>
                    <Siren size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Suspicious Alerts
                  </h3>
                  <div style={{ display: 'grid', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                    {dashboard.suspiciousAlerts.length === 0 && <p className="text-muted">No suspicious signals detected.</p>}
                    {dashboard.suspiciousAlerts.map((a) => (
                      <div key={a.id} style={{ background: 'white', borderRadius: 8, padding: '8px 10px', border: '1px solid rgba(255,59,92,0.18)' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{a.serial} · {a.city}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                          {a.status} · {new Date(a.checkedAt).toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '1rem' }}>Registered Medicines</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--surface-2)' }}>
                      {['Medicine', 'Batch', 'Serial', 'Expiry', 'Scans', 'Status', 'Actions'].map((h) => (
                        <th key={h} style={{
                          padding: '10px 12px',
                          textAlign: 'left',
                          fontSize: '0.72rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: '#94a3b8',
                          fontWeight: 700,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.medicines.map((m, i) => (
                      <tr key={m._id} style={{ borderBottom: '1px solid var(--surface-2)', background: i % 2 === 0 ? 'white' : 'var(--surface)' }}>
                        <td style={{ padding: 12, fontWeight: 700 }}>{m.name}</td>
                        <td style={{ padding: 12 }}>{m.batchNo}</td>
                        <td style={{ padding: 12, fontFamily: 'monospace', color: 'var(--primary)' }}>{m.serialNo}</td>
                        <td style={{ padding: 12 }}>{new Date(m.expiryDate).toLocaleDateString('en-IN')}</td>
                        <td style={{ padding: 12, fontWeight: 700 }}>{m.verifications}</td>
                        <td style={{ padding: 12 }}>
                          {m.isRecalled ? <span className="status-badge fake">recalled</span> : <span className="status-badge genuine">active</span>}
                        </td>
                        <td style={{ padding: 12 }}>
                          <button onClick={() => setQrMed(m)} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            border: '1.5px solid var(--primary)',
                            borderRadius: 6,
                            background: 'var(--primary-light)',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            padding: '5px 10px',
                          }}>
                            <QrCode size={13} /> QR
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {qrMed && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }} onClick={() => setQrMed(null)}>
            <div className="card" style={{ maxWidth: 340, width: '100%', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{qrMed.name}</h3>
              <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '1rem' }}>Batch: {qrMed.batchNo} · Serial: {qrMed.serialNo}</p>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem', background: 'white', borderRadius: 12 }}>
                <QRCode value={qrMed.serialNo} size={180} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
