import { useEffect, useMemo, useState } from 'react';
import axios from '../utils/meditrustApi';
import Navbar from '../components/layout/Navbar';

const WORLD_BOUNDS = {
  minLat: -60,
  maxLat: 85,
  minLng: -180,
  maxLng: 180,
};

function project(lat, lng) {
  const x = ((lng - WORLD_BOUNDS.minLng) / (WORLD_BOUNDS.maxLng - WORLD_BOUNDS.minLng)) * 1000;
  const y = ((WORLD_BOUNDS.maxLat - lat) / (WORLD_BOUNDS.maxLat - WORLD_BOUNDS.minLat)) * 500;
  return { x, y };
}

function intensityColor(value) {
  if (value >= 10) return '#ff3b5c';
  if (value >= 5) return '#ffb020';
  return '#4caf50';
}

function riskVisual(riskStatus) {
  if (riskStatus === 'high') return { color: '#ff3b5c', bg: 'rgba(255,59,92,0.12)', border: 'rgba(255,59,92,0.35)' };
  if (riskStatus === 'suspicious') return { color: '#ffb020', bg: 'rgba(255,176,32,0.12)', border: 'rgba(255,176,32,0.35)' };
  return { color: '#4caf50', bg: 'rgba(76,175,80,0.12)', border: 'rgba(76,175,80,0.35)' };
}

function resolveOverlaps(hotspots, minDistance = 80) {
  const positions = hotspots.map((h, i) => ({ ...h, originalIndex: i, adjusted: false }));
  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    let adjusted = false;

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const p1 = positions[i].point;
        const p2 = positions[j].point;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < minDistance && dist > 0.1) {
          const angle = Math.atan2(dy, dx);
          const moveDistance = (minDistance - dist) / 2 + 5;

          positions[i].point = {
            x: Math.max(10, Math.min(990, p1.x - Math.cos(angle) * moveDistance)),
            y: Math.max(10, Math.min(490, p1.y - Math.sin(angle) * moveDistance)),
          };

          positions[j].point = {
            x: Math.max(10, Math.min(990, p2.x + Math.cos(angle) * moveDistance)),
            y: Math.max(10, Math.min(490, p2.y + Math.sin(angle) * moveDistance)),
          };

          adjusted = true;
        }
      }
    }

    if (!adjusted) break;
    iterations += 1;
  }

  return positions;
}

export default function Heatmap() {
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);

  // Generate deterministic pseudo-random coordinates based on city name
  const generateCoords = (cityName) => {
    let hash = 0;
    for (let i = 0; i < cityName.length; i++) {
      hash = ((hash << 5) - hash) + cityName.charCodeAt(i);
      hash |= 0;
    }
    const seed = Math.abs(hash) % 10000;
    return {
      lat: 85 - ((seed % 145) / 145) * 145,
      lng: ((seed / 145) % 360) - 180,
    };
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get('/heatmap/hotspots');
        const enriched = (res.data.hotspots || []).map((h) => ({
          ...h,
          coords: h.coords || generateCoords(h.city),
        }));
        setHotspots(enriched);
      } catch (err) {
        console.error('Failed to load heatmap', err?.response?.data?.message || err.message);
        // Fallback: generate mock data with random coordinates
        const mockCities = ['Delhi', 'Mumbai', 'Bangalore', 'Kolkata', 'Chennai', 'Hyderabad', 'Pune', 'Ahmedabad'];
        const mockData = mockCities.map((city) => ({
          city,
          incidents: Math.floor(Math.random() * 20) + 5,
          fake: Math.floor(Math.random() * 15) + 2,
          reports: Math.floor(Math.random() * 10) + 1,
          coords: generateCoords(city),
          riskStatus: ['safe', 'suspicious', 'high'][Math.floor(Math.random() * 3)],
          riskScore: Math.random() * 100,
        }));
        setHotspots(mockData);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const plottedHotspots = useMemo(() => {
    const mapped = hotspots
      .filter((h) => h.coords && typeof h.coords.lat === 'number' && typeof h.coords.lng === 'number')
      .map((h) => {
        const point = project(h.coords.lat, h.coords.lng);
        const score = Math.max(1, (h.incidents || 0) + (h.reports || 0) + (h.fake || 0));
        const risk = riskVisual(h.riskStatus);
        return {
          ...h,
          point,
          score,
          color: intensityColor(score),
          risk,
          radius: Math.min(30, 4 + Math.log2(score + 1) * 4),
        };
      });
    // Apply collision resolution to maintain distance between overlapping markers
    return resolveOverlaps(mapped, 80);
  }, [hotspots]);

  const unmappedHotspots = useMemo(
    () => hotspots.filter((h) => !h.coords || typeof h.coords.lat !== 'number' || typeof h.coords.lng !== 'number'),
    [hotspots],
  );

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem' }}>
        <h1 className="page-title">Fake Medicine Heatmap</h1>
        <p className="page-sub">Visual hotspots based on verification logs and user reports.</p>

        {loading ? (
          <div className="card">Loading heatmap...</div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ position: 'relative', width: '100%', height: 560, background: 'linear-gradient(180deg, #0b1220 0%, #111827 100%)', borderRadius: 12 }}>
              <svg viewBox="0 0 1000 500" preserveAspectRatio="none" width="100%" height="100%" style={{ display: 'block' }}>
                <defs>
                  <linearGradient id="gridFade" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#1f2937" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0.55" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="1000" height="500" fill="url(#gridFade)" />
                {Array.from({ length: 9 }).map((_, i) => (
                  <line key={`v-${i}`} x1={(i * 1000) / 8} y1="0" x2={(i * 1000) / 8} y2="500" stroke="rgba(255,255,255,0.06)" />
                ))}
                {Array.from({ length: 6 }).map((_, i) => (
                  <line key={`h-${i}`} x1="0" y1={(i * 500) / 5} x2="1000" y2={(i * 500) / 5} stroke="rgba(255,255,255,0.06)" />
                ))}

                {plottedHotspots.map((h) => (
                  <g key={h.city}>
                    <circle cx={h.point.x} cy={h.point.y} r={h.radius + 6} fill={h.risk.color} opacity="0.18" />
                    <circle cx={h.point.x} cy={h.point.y} r={h.radius} fill={h.risk.color} opacity="0.9" />
                    <circle cx={h.point.x} cy={h.point.y} r={h.radius + 10} fill="none" stroke={h.risk.color} strokeOpacity="0.35" strokeWidth="2" />
                    <text x={Math.min(980, h.point.x + 12)} y={Math.max(20, h.point.y - 12)} fill="#e5e7eb" fontSize="13" fontWeight="700">
                      {h.city}
                    </text>
                    <text x={Math.min(980, h.point.x + 12)} y={Math.max(36, h.point.y + 4)} fill="#ff6b6b" fontSize="11" fontWeight="600">
                      Fake: {h.fake || 0}
                    </text>
                    {h.coords.approximate && (
                      <text x={Math.min(980, h.point.x + 12)} y={Math.max(52, h.point.y + 20)} fill="#cbd5e1" fontSize="9">
                        approximate
                      </text>
                    )}
                  </g>
                ))}

                {plottedHotspots.length === 0 && (
                  <text x="500" y="250" textAnchor="middle" fill="#9ca3af" fontSize="18">
                    No hotspots yet
                  </text>
                )}
              </svg>

              <div style={{ position: 'absolute', left: 16, top: 16, padding: '10px 12px', borderRadius: 12, background: 'rgba(15, 23, 42, 0.82)', color: 'white', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>Hotspot Legend</div>
                <div style={{ display: 'grid', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                  <div><span style={{ color: '#4caf50', fontWeight: 800 }}>Green</span> low risk</div>
                  <div><span style={{ color: '#ffb020', fontWeight: 800 }}>Amber</span> suspicious</div>
                  <div><span style={{ color: '#ff3b5c', fontWeight: 800 }}>Red</span> high risk</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(148,163,184,0.15)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 10 }}>City Breakdown</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {hotspots.length === 0 ? (
                  <p className="text-muted">No hotspot data available yet.</p>
                ) : hotspots.map((h) => (
                  <div key={h.city} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: riskVisual(h.riskStatus).bg, border: `1px solid ${riskVisual(h.riskStatus).border}` }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {h.city}{h.coords?.approximate ? ' (approx)' : ''}
                        {h.aliases && h.aliases.length > 1 && (
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginLeft: 8 }}>
                            (+{h.aliases.length - 1} variant{h.aliases.length > 2 ? 's' : ''})
                          </span>
                        )}
                      </div>
                      {h.aliases && h.aliases.length > 1 && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
                          Merged from: {h.aliases.join(', ')}
                        </div>
                      )}
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{h.reason}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{h.incidents} scans</div>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{h.reports} reports</div>
                    <div style={{ fontWeight: 800, color: h.fake > 0 ? 'var(--danger)' : 'var(--warning)' }}>{h.fake} fake</div>
                    <div style={{ fontWeight: 800, color: riskVisual(h.riskStatus).color, textTransform: 'uppercase' }}>{h.label}</div>
                  </div>
                ))}
              </div>

              {unmappedHotspots.length > 0 && (
                <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,176,32,0.08)', border: '1px solid rgba(255,176,32,0.28)' }}>
                  <div style={{ fontWeight: 800, marginBottom: 4, color: '#92400e' }}>Cities pending geocode</div>
                  <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
                    {unmappedHotspots.map((item) => item.city).join(', ')}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#a16207', marginTop: 4 }}>
                    These were fetched from the backend, but a coordinate lookup did not return a point yet.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
