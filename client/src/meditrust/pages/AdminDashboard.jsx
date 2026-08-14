import { useEffect, useMemo, useState } from 'react';
import axios from '../utils/meditrustApi';
import toast from 'react-hot-toast';
import { MapPinned, Radio, TrendingUp, TrendingDown } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import { useMediTrustAuth } from '../context/MediTrustAuthContext';

const styles = `
  @keyframes pulse-live {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .pulse-live {
    animation: pulse-live 2s infinite;
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .feed-item-new {
    animation: slideIn 0.3s ease-out;
  }
`;

export default function AdminDashboard() {
  const { user } = useMediTrustAuth();
  const [loading, setLoading] = useState(true);
  const [batchSort, setBatchSort] = useState('risk'); // 'risk', 'reports', 'recent'
  const [dashboard, setDashboard] = useState({
    stats: {
      totalMedicines: 0,
      verifiedToday: 0,
      fakeDetected: 0,
      totalUsers: 0,
      pendingReports: 0,
    },
    liveFeed: [],
    fakeHotspots: [],
    dailyTrends: [],
    batchRisk: [],
    manufacturerTrust: [],
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get('/medicines/admin/dashboard');
        setDashboard((prev) => ({ ...prev, ...res.data }));
        // fetch analytics
        try {
          const a = await axios.get('/reports/analytics');
          setDashboard((prev) => ({ ...prev, batchRisk: a.data.batchRisk || [], manufacturerTrust: a.data.manufacturerTrust || [] }));
        } catch (err) {
          console.warn('Failed loading analytics', err?.response?.data?.message || err.message);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load admin dashboard');
      } finally {
        setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  const statCards = useMemo(() => ([
    { label: 'Total Medicines', value: dashboard.stats.totalMedicines, icon: '💊', bg: 'var(--primary-light)' },
    { label: 'Verified Today', value: dashboard.stats.verifiedToday, icon: '✅', bg: 'rgba(0,196,106,0.1)' },
    { label: 'Fakes Detected', value: dashboard.stats.fakeDetected, icon: '🚨', bg: 'rgba(255,59,92,0.1)' },
    { label: 'Total Users', value: dashboard.stats.totalUsers, icon: '👥', bg: '#f0eeff' },
  ]), [dashboard.stats]);

  const sortedBatches = useMemo(() => {
    const batches = dashboard.batchRisk.map((b) => {
      // Calculate risk score if not provided
      let riskScore = b.riskScore;
      if (!riskScore && b.verifications > 0) {
        // Risk = (reports + fakes) / verifications * 100
        const reportFactor = (b.reports || 0) / b.verifications;
        const fakeFactor = (b.fake || 0) / b.verifications;
        riskScore = Math.min(100, (reportFactor + fakeFactor) * 100);
      }
      return { ...b, computedRiskScore: riskScore || 0 };
    });

    if (batchSort === 'reports') {
      return batches.sort((a, b) => (b.reports || 0) - (a.reports || 0));
    } else if (batchSort === 'recent') {
      return batches.sort((a, b) => (b.id || 0) - (a.id || 0));
    }
    return batches.sort((a, b) => (b.computedRiskScore || 0) - (a.computedRiskScore || 0));
  }, [dashboard.batchRisk, batchSort]);

  return (
    <>
      <style>{styles}</style>
      <Navbar />
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        <div className="fade-in" style={{ marginBottom: '2rem' }}>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-sub">
            Welcome back, <strong>{user?.name}</strong>. Real-time verification intelligence is active.
          </p>
        </div>

        {loading ? (
          <div className="card">Loading dashboard...</div>
        ) : (
          <>
            <div className="grid-4" style={{ marginBottom: '2rem' }}>
              {statCards.map((s) => (
                <div className="stat-card" key={s.label}>
                  <div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                      {Number(s.value).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#64748b' }}>{s.label}</div>
                  </div>
                  <div style={{ background: s.bg, fontSize: '1.8rem', width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}>
                    {s.icon}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid-2" style={{ marginBottom: '2rem' }}>
              <div className="card" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)', transition: 'all 0.3s ease', padding: '1.5rem' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>Live Verification Feed</h3>
                  <span className="pulse-live" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: 'var(--success)',
                    fontWeight: 700,
                    fontSize: '0.74rem',
                    textTransform: 'uppercase',
                  }}>
                    <Radio size={13} /> live
                  </span>
                </div>

                <div style={{ display: 'grid', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
                  {dashboard.liveFeed.length === 0 && <p className="text-muted">No verification logs found.</p>}
                  {dashboard.liveFeed.map((log, idx) => (
                    <div key={log.id} className="feed-item-new" style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      alignItems: 'start',
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: 'var(--surface)',
                      border: '1px solid rgba(148,163,184,0.1)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(99,102,241,0.04)';
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'var(--surface)';
                      e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)';
                    }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{log.medicine}</div>
                        <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 4 }}>
                          {log.serial} · {log.user} · {log.city}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={`status-badge ${log.status}`}>{log.status}</span>
                        <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: 4 }}>
                          {new Date(log.checkedAt).toLocaleTimeString('en-IN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div className="card" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)', transition: 'all 0.3s ease', padding: '1.5rem' }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: '1.5rem' }}>
                    <MapPinned size={18} color="var(--danger)" />
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>Geographic Risk Analysis</h3>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Hotspots
                    </div>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {dashboard.fakeHotspots.length === 0 ? (
                        <p className="text-muted">No hotspot alerts yet.</p>
                      ) : (
                        dashboard.fakeHotspots.map((spot) => (
                          <div key={spot.city} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: 'rgba(255,59,92,0.04)', transition: 'all 0.2s ease', cursor: 'pointer' }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = 'rgba(255,59,92,0.08)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = 'rgba(255,59,92,0.04)';
                            }}
                          >
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{spot.city}</span>
                            <span style={{
                              background: 'rgba(255,59,92,0.12)',
                              color: 'var(--danger)',
                              fontWeight: 800,
                              padding: '4px 10px',
                              borderRadius: 999,
                              fontSize: '0.75rem',
                            }}>
                              {spot.incidents}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(148,163,184,0.15)', paddingTop: '1.5rem' }}>          
                    <button
                      onClick={() => window.location.href = '/admin/heatmap'}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseOver={(e) => {
                        e.target.style.background = '#0052cc';
                        e.target.style.transform = 'translateY(-1px)';
                        e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.background = 'var(--primary)';
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      → Open Heatmap Analytics
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
              <div className="card" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>Top Risky Batches</h3>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['risk', 'reports', 'recent'].map((sort) => (
                      <button
                        key={sort}
                        onClick={() => setBatchSort(sort)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: `1px solid ${batchSort === sort ? 'var(--primary)' : 'rgba(148,163,184,0.2)'}`,
                          background: batchSort === sort ? 'rgba(99,102,241,0.1)' : 'transparent',
                          color: batchSort === sort ? 'var(--primary)' : '#64748b',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          textTransform: 'capitalize',
                        }}
                        onMouseOver={(e) => {
                          if (batchSort !== sort) {
                            e.target.style.borderColor = 'rgba(99,102,241,0.4)';
                            e.target.style.color = 'var(--primary)';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (batchSort !== sort) {
                            e.target.style.borderColor = 'rgba(148,163,184,0.2)';
                            e.target.style.color = '#64748b';
                          }
                        }}
                      >
                        {sort === 'risk' ? 'Highest Risk' : sort === 'reports' ? 'Most Reports' : 'Most Recent'}
                      </button>
                    ))}
                  </div>
                </div>
                {dashboard.batchRisk.length === 0 ? (
                  <p className="text-muted">No risky batches identified yet.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {sortedBatches.slice(0, 8).map((b) => (
                      <div key={b.serial} style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        alignItems: 'start',
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: 'var(--surface)',
                        border: '1px solid rgba(148,163,184,0.1)',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(255,59,92,0.04)';
                        e.currentTarget.style.borderColor = 'rgba(255,59,92,0.2)';
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'var(--surface)';
                        e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                            {b.medicineName || 'Unknown Medicine'}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4, fontFamily: 'monospace' }}>
                            {b.serial}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 6 }}>
                            <span style={{ display: 'inline-block', marginRight: 12 }}>
                              <span style={{ color: '#0f172a', fontWeight: 600 }}>{b.reports}</span> reports
                            </span>
                            <span style={{ display: 'inline-block' }}>
                              <span style={{ color: '#0f172a', fontWeight: 600 }}>{b.verifications}</span> checks
                            </span>
                          </div>
                          <div style={{
                            fontSize: '0.8rem',
                            marginTop: 6,
                            padding: '4px 8px',
                            borderRadius: 6,
                            background: 'rgba(99,102,241,0.1)',
                            color: 'var(--primary)',
                            fontWeight: 600,
                            width: 'fit-content',
                          }}>
                            Risk Score: {b.computedRiskScore > 0 ? `${b.computedRiskScore.toFixed(1)}%` : 'Critical'}
                          </div>
                        </div>
                        <div style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          textTransform: 'uppercase',
                          color: b.risk === 'high' ? '#fff' : b.risk === 'suspicious' ? '#92400e' : '#064e3b',
                          background: b.risk === 'high' ? 'rgba(255,59,92,0.2)' : b.risk === 'suspicious' ? 'rgba(255,176,32,0.2)' : 'rgba(76,175,80,0.2)',
                        }}>
                          {b.risk}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.5rem' }}>Manufacturer Trust</h3>
                {dashboard.manufacturerTrust.length === 0 ? (
                  <p className="text-muted">No manufacturer stats available.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {dashboard.manufacturerTrust.slice(0, 8).map((m, idx) => {
                      const prevScore = idx > 0 ? dashboard.manufacturerTrust[idx - 1].trustScore : m.trustScore;
                      const trend = m.trustScore >= prevScore ? 'up' : 'down';
                      return (
                        <div key={m.manufacturerId} style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          alignItems: 'start',
                          padding: '12px 14px',
                          borderRadius: 10,
                          background: 'var(--surface)',
                          border: '1px solid rgba(148,163,184,0.1)',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'rgba(76,175,80,0.04)';
                          e.currentTarget.style.borderColor = 'rgba(76,175,80,0.2)';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'var(--surface)';
                          e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{m.name || m.company || 'Manufacturer'}</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 6 }}>
                              <span style={{ display: 'block' }}>{m.totalVer || 0} checks • {m.reportsCount || 0} reports</span>
                              <span style={{ display: 'block', marginTop: 4, fontSize: '0.75rem', color: '#94a3b8' }}>Last 30 days</span>
                            </div>
                          </div>
                          <div style={{ display: 'grid', alignItems: 'center', textAlign: 'right', gap: 6 }}>
                            <div style={{
                              fontWeight: 800,
                              fontSize: '1rem',
                              color: m.trustScore >= 80 ? 'var(--success)' : m.trustScore >= 60 ? 'var(--warning)' : 'var(--danger)',
                            }}>
                              {m.trustScore || 0}%
                            </div>
                            <div style={{ fontSize: '0.7rem', color: trend === 'up' ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                              {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                              {trend === 'up' ? 'Improving' : 'Declining'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
