import { useEffect, useState } from 'react';
import axios from '../utils/meditrustApi';
import toast from 'react-hot-toast';
import { AlertTriangle, Clock3, MapPin, ShieldAlert } from 'lucide-react';
import Navbar from '../components/layout/Navbar';

const STATUS_STYLE = {
  genuine: { bg: 'rgba(0, 196, 106, 0.12)', color: 'var(--success)' },
  fake: { bg: 'rgba(255, 59, 92, 0.12)', color: 'var(--danger)' },
  expired: { bg: 'rgba(255, 170, 0, 0.12)', color: 'var(--warning)' },
  unknown: { bg: 'rgba(100, 116, 139, 0.12)', color: '#64748b' },
};

export default function VerificationHistory() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ timeline: [], mapData: [], statusCounts: {}, suspiciousPatterns: [] });

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get('/medicines/history');
        setData(res.data);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load verification history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 1150, margin: '0 auto', padding: '2.4rem 1.2rem' }}>
        <div className="fade-in" style={{ marginBottom: '1.5rem' }}>
          <h1 className="page-title">Verification History</h1>
          <p className="page-sub">Timeline of scans, city map intelligence, and suspicious pattern detection.</p>
        </div>

        {loading ? (
          <div className="card">Loading history...</div>
        ) : (
          <>
            <div className="grid-3" style={{ marginBottom: '1.4rem' }}>
              <div className="stat-card">
                <div>
                  <div className="stat-card-num">{data.timeline.length}</div>
                  <div className="stat-card-label">Total Scans</div>
                </div>
                <div className="stat-card-icon" style={{ background: 'var(--primary-light)' }}>🕒</div>
              </div>
              <div className="stat-card">
                <div>
                  <div className="stat-card-num">{data.statusCounts.fake || 0}</div>
                  <div className="stat-card-label">Fake/Unknown Alerts</div>
                </div>
                <div className="stat-card-icon" style={{ background: 'rgba(255,59,92,0.1)' }}>🚨</div>
              </div>
              <div className="stat-card">
                <div>
                  <div className="stat-card-num">{data.mapData.length}</div>
                  <div className="stat-card-label">Cities Covered</div>
                </div>
                <div className="stat-card-icon" style={{ background: 'rgba(0,212,170,0.1)' }}>📍</div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="flex items-center gap-2" style={{ marginBottom: '1rem' }}>
                  <Clock3 size={18} color="var(--primary)" />
                  <h3 style={{ fontFamily: 'var(--font-display)' }}>Timeline of Scans</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: 460, overflowY: 'auto' }}>
                  {data.timeline.length === 0 && <p className="text-muted">No verification history yet.</p>}
                  {data.timeline.map((item) => {
                    const style = STATUS_STYLE[item.status] || STATUS_STYLE.unknown;
                    return (
                      <div key={item.id} style={{
                        border: '1px solid var(--surface-2)',
                        borderRadius: 12,
                        padding: '10px 12px',
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: 12,
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{item.medicineName}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                            {item.serial} · Batch {item.batchNo}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>
                            {new Date(item.checkedAt).toLocaleString('en-IN')} · {item.city}
                          </div>
                          {item.suspiciousFlags?.length > 0 && (
                            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {item.suspiciousFlags.map((flag) => (
                                <span key={flag} style={{
                                  fontSize: '0.68rem',
                                  background: 'rgba(255,59,92,0.12)',
                                  color: 'var(--danger)',
                                  borderRadius: 100,
                                  padding: '2px 8px',
                                  fontWeight: 700,
                                }}>
                                  {flag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span style={{
                          alignSelf: 'start',
                          background: style.bg,
                          color: style.color,
                          borderRadius: 999,
                          padding: '4px 10px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}>
                          {item.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div className="card">
                  <div className="flex items-center gap-2" style={{ marginBottom: '1rem' }}>
                    <MapPin size={18} color="var(--accent-dark)" />
                    <h3 style={{ fontFamily: 'var(--font-display)' }}>City Map View (Heat List)</h3>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {data.mapData.length === 0 && <p className="text-muted">No city data available yet.</p>}
                    {data.mapData.map((city) => (
                      <div key={city.city} style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 1fr auto',
                        alignItems: 'center',
                        gap: 10,
                      }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{city.city}</span>
                        <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min((city.totalScans / Math.max(data.timeline.length, 1)) * 100, 100)}%`,
                            background: 'linear-gradient(90deg,#00d4aa,#0066ff)',
                          }} />
                        </div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{city.totalScans}</span>
                      </div>
                    ))}
                  </div>
                </div>
                

                
                  
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
