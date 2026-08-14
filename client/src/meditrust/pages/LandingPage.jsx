import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { UserCircle2, Bot } from 'lucide-react';
import { useMediTrustAuth } from '../context/MediTrustAuthContext';
import MediBotChat from '../components/layout/MediBotChat';

const sectionPaddingStyle = { padding: '6rem 5%' };
const sectionTagStyle = {
  padding: '5px 14px',
  borderRadius: 100,
  fontSize: '0.78rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
};
const sectionHeadingStyle = {
  fontSize: 'clamp(1.8rem,4vw,3rem)',
  fontWeight: 800,
  marginTop: '1rem',
  letterSpacing: '-0.03em',
};
const howSteps = [
  {
    step: "01",
    title: "Register Medicine",
    desc: "Add medicine details into the system.",
    img: "/meditrust/reg_med_ss.png",
    fit: "contain"
  },
  {
    step: "02",
    title: "Scan Medicine",
    desc: "Scan QR or serial number instantly.",
    img: "/meditrust/scan_ss.png",
    fit: "contain"
  },
  {
    step: "03",
    title: " Verification",
    desc: "System validates authenticity.",
    img: "/meditrust/admin_ss.png",
    fit: "contain"
  },
  {
    step: "04",
    title: "Result Displayed",
    desc: "See Genuine, Fake, Expired or Unknown.",
    img: "/meditrust/result_ss.png",
    fit: "contain"
  }
];
const bodyTextStyle = { color: '#374151', lineHeight: 1.7 };
const cardTitleStyle = { fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem' };
const cardTextStyle = { color: '#374151', lineHeight: 1.7 };

export default function LandingPage() {
  const { user } = useMediTrustAuth();
  const [scrollY, setScrollY] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPulse, setChatPulse] = useState(true);
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
const sectionRef = useRef(null);
const isScrolled = scrollY > 50;
const [currentStep, setCurrentStep] = useState(0);
const timerRef = useRef(null);
const startAuto = (delay = 3000) => {
  if (timerRef.current) clearInterval(timerRef.current);
  timerRef.current = setInterval(() => setCurrentStep(s => (s + 1) % howSteps.length), delay);
};
const stopAuto = () => {
  if (timerRef.current) {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }
};
useEffect(() => {
  startAuto(3000);
  return () => stopAuto();
}, []);
useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        setCurrentStep(0);   // 🔥 FORCE STEP 1
        startAuto(3000);     // restart autoplay cleanly
      }
    },
    { threshold: 0.6 }
  );

  if (sectionRef.current) {
    observer.observe(sectionRef.current);
  }

  return () => {
    if (sectionRef.current) observer.unobserve(sectionRef.current);
  };
}, []);

const goNext = () => { stopAuto(); setCurrentStep(s => (s + 1) % howSteps.length); startAuto(3000); };
const goPrev = () => { stopAuto(); setCurrentStep(s => (s - 1 + howSteps.length) % howSteps.length); startAuto(3000); };

const navStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
  background: isScrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
  backdropFilter: isScrolled ? 'blur(20px)' : 'none',
  borderBottom: isScrolled ? '1px solid rgba(0,102,255,0.08)' : 'none',
  transition: 'all 0.3s ease',
  padding: '0 5%', height: 70,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};

const linkColor = isScrolled ? '#64748b' : 'rgba(255,255,255,0.8)';
const textColor = isScrolled ? '#0a0f1e' : '#18181b';
const dashboardRoute = user?.role === 'admin' ? '/medicine/admin/dashboard' : user?.role === 'manufacturer' ? '/medicine/manufacturer/dashboard' : '/medicine/verify';
  return (
    <div
      style={{
        minHeight: '100vh',background: `
  radial-gradient(circle at 20% 20%, rgba(79,70,229,0.06), transparent 40%),
  radial-gradient(circle at 80% 0%, rgba(79,70,229,0.05), transparent 40%),
  #f9fafb
`,
        color: '#18181b',overflowX: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >

      {/* ── NAVBAR ── */}
      <nav style={navStyle}>
  
      {/* LOGO */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38,          background: 'linear-gradient(135deg,#0066ff,#00d4aa)',
          borderRadius: 10,          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <img
            src={'/meditrust/logo.png'}
            alt="MediTrust Logo"
            style={{ width: 28, height: 28, objectFit: 'contain', display: 'block' }}
          />
        </div>

        <span style={{
          fontWeight: 800, fontSize: '1.3rem',          color: textColor,          letterSpacing: '-0.03em',
        }}>
          MEDI<span style={{ color: '#00d4aa' }}>TRUST</span>
        </span>
      </div>

  {/* NAV LINKS */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
    {['Features', 'How it Works'].map(item => (
      <a
        key={item}
        href={`#${item.toLowerCase().replace(/[' ]/g, '-')}`}
        style={{
          color: linkColor,          textDecoration: 'none',          fontSize: '0.9rem',          fontWeight: 500,          transition: 'color 0.2s',
        }}
        onMouseEnter={e => e.target.style.color = '#0066ff'}
        onMouseLeave={e => e.target.style.color = linkColor}>
        {item}
      </a>
    ))}
    <a
      href="/"
      style={{
        color: linkColor, textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s',
      }}
      onMouseEnter={e => e.target.style.color = '#0066ff'}
      onMouseLeave={e => e.target.style.color = linkColor}
      title="Back to SwasthAashra hospital portal"
    >
      ← SwasthAashra
    </a>
  </div>

  {/* ACTIONS */}
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

    {/* ── AI MediBot Button ── */}
    <button
      onClick={() => { setChatOpen(true); setChatPulse(false); }}
      title="Ask MediBot — AI Health Assistant"
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '8px 15px', borderRadius: 10, border: 'none',
        background: 'linear-gradient(135deg, #0047cc 0%, #0066ff 100%)',
        color: 'white', fontWeight: 600, fontSize: '0.855rem',
        cursor: 'pointer', position: 'relative',
        boxShadow: '0 4px 14px rgba(0,102,255,0.35)',
        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,102,255,0.45)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,102,255,0.35)'; }}
    >
      {chatPulse && (
        <span style={{
          position: 'absolute', inset: -3, borderRadius: 13,
          border: '2px solid rgba(0,102,255,0.5)',
          animation: 'navPulse 1.8s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}
      <Bot size={16} />
      <span>AI Health Chat</span>
      <span style={{
        background: 'rgba(255,255,255,0.25)', borderRadius: 6,
        padding: '1px 6px', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
      }}>NEW</span>
    </button>

    {user ? (
      <>
        <Link to={dashboardRoute} style={{
          padding: '9px 18px', borderRadius: 10, border: `1.5px solid ${isScrolled ? '#e2e8f0' : 'rgba(255,255,255,0.3)'}`,
          color: textColor, textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600, transition: 'all 0.2s',
        }}>
          Dashboard
        </Link>
        <Link to="/medicine/profile" style={{
          width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#0066ff,#00d4aa)',
          color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(0,102,255,0.28)',
        }} title="Profile">
          <UserCircle2 size={20} />
        </Link>
      </>
    ) : (
      <>
        <Link to="/medicine/login" style={{
          padding: '9px 20px', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,102,255,0.3)', color: textColor,
          textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600, transition: 'all 0.2s',
        }}>
          Sign In
        </Link>
        <Link to="/medicine/register" style={{
          padding: '9px 20px', borderRadius: 10, background: 'linear-gradient(135deg,#0066ff,#0047cc)', color: 'white',
          textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,102,255,0.3)',
        }}>
          Get Started →
        </Link>
      </>
    )}
  </div>
</nav>

{/* ── AI Chatbot Widget ── */}
<MediBotChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />

      {/* ── HERO ── */}
      <section style={{
        minHeight: '100vh',        background: '#f9fafb',        display: 'flex', flexDirection: 'column',        alignItems: 'center', justifyContent: 'center',        textAlign: 'center', padding: '120px 5% 80px',        position: 'relative', overflow: 'hidden',
      }}>
        
        <div style={{
          position: 'absolute', width: 400, height: 400,          background: 'radial-gradient(circle, rgba(0,212,170,0.12) 0%, transparent 70%)',
          bottom: 0, right: 0, borderRadius: '50%', pointerEvents: 'none',        }} />

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.25)',
          borderRadius: 100, padding: '6px 16px', marginBottom: '2rem',
          animation: 'fadeInDown 0.6s ease',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00d4aa', boxShadow: '0 0 8px #00d4aa', display: 'inline-block' }} />
          <span style={{ color: '#00d4aa', fontSize: '0.8rem', fontWeight: 600 }}>
            India's First Unified Medicine Authenticity Platform
          </span>
        </div>

        <h1 style={{
          fontSize: 'clamp(2.8rem, 7vw, 5.5rem)',
          fontWeight: 800, color: '#18181b', lineHeight: 1.08,
          letterSpacing: '-0.04em', marginBottom: '1.5rem',
          animation: 'fadeInUp 0.7s ease 0.1s both',
        }}>
          Every Medicine.<br />
          <span style={{
            background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Verified. Trusted.</span>
        </h1>

        <p style={{
          color: '#374151', fontSize: 'clamp(1rem,2vw,1.2rem)',
          maxWidth: 580, lineHeight: 1.75, marginBottom: '2.5rem',
          animation: 'fadeInUp 0.7s ease 0.2s both',
        }}>
          MEDITRUST uses QR codes and secure serial verification to instantly
          detect counterfeit, expired, or unregistered medicines — protecting
          patients across India.
        </p>

        {/* Product Preview Image */}
        <div style={{
          marginTop: '4rem', position: 'relative',width: '100%',
          maxWidth: 900,
          display: 'flex',
          justifyContent: 'center',
          perspective: '1200px'
        }}>
          <img
            src="/meditrust/preview.png"
            alt="MediTrust Preview"
            style={{
              width: '100%',
              borderRadius: 20,
              border: '1px solid #e5e7eb',
              boxShadow: '0 25px 80px rgba(0,0,0,0.1)',

              transform: `
                translateY(${Math.max(0, 80 - scrollY * 0.2)}px)
                rotateX(${Math.max(0, 8 - scrollY * 0.02)}deg)
                scale(${Math.min(1, 0.9 + scrollY * 0.0005)})
              `,
              opacity: Math.min(1, scrollY / 200),

              transition: 'transform 0.1s linear, opacity 0.2s ease'
            }}
          />
        </div>

        

        
      </section>

      {/* ── real cases ── */}
              {/* ── REAL CASES ── */}
              <section style={sectionPaddingStyle}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                  <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <span style={{
                      ...sectionTagStyle,
                      background: 'rgba(255,59,92,0.1)', color: '#ff3b5c',
                    }}>Real Cases</span>
                    <h2 style={sectionHeadingStyle}>Why this matters:<br /><span style={{ color: '#ff3b5c' }}>Real incidents, real impact</span></h2>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '3rem',
                    alignItems: 'center',
                    '@media (max-width: 768px)': { gridTemplateColumns: '1fr' }
                  }}>
                    {/* Left: Image */}
                    <div>
                      <img
                        src="/meditrust/fake_cough.png"
                        alt="Madhya Pradesh fake medicine case"
                        style={{
                          width: '100%',
                          borderRadius: 12,
                          marginBottom: '12px',
                          boxShadow: '0 12px 40px rgba(255,59,92,0.15)',
                          border: '1px solid #ffeaea',
                        }}
                      />
                    </div>

                    {/* Right: Text Content */}
                    <div>
                      <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: '1.3rem', color: '#0a0f1e' }}>
                        Madhya Pradesh Case
                      </h3>

                      <p style={{ fontSize: '0.95rem', color: '#374151', lineHeight: 1.8, marginBottom: '1.5rem' }}>
                        Fake antibiotics and life-saving drugs worth lakhs were seized from illegal distribution units. Patients unknowingly consumed ineffective medicines, putting lives at risk.
                      </p>

                      <div style={{
                        background: '#fff5f5',
                        border: '1px solid #ffeaea',
                        borderRadius: 12,
                        padding: '1.2rem',
                        marginBottom: '1.5rem'
                      }}>
                        <p style={{ fontSize: '0.9rem', color: '#374151', lineHeight: 1.7, margin: 0 }}>
                          <strong>Impact:</strong> Over 500+ patients affected • Anti-tuberculosis drugs compromised • Multiple deaths reported • Regulatory action initiated
                        </p>
                      </div>

                      <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6 }}>
                        This is why instant, accessible verification at point of sale is critical. MEDITRUST prevents such tragedies by giving patients and healthcare providers real-time confidence.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── HOW IT WORKS ── */}
       
      <section ref={sectionRef} id="how-it-works" style={sectionPaddingStyle}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <span style={{
            ...sectionTagStyle,
            background: 'var(--primary-light,#e8f0ff)', color: '#0066ff',
          }}>How It Works</span>
          <h2 style={{ ...sectionHeadingStyle, marginBottom: '3.5rem' }}>Verify any medicine in <span style={{ color: '#0066ff' }}>3 seconds</span></h2>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', position: 'relative' }}>
            <button
              onClick={goPrev}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.6rem',
                cursor: 'pointer',
                color: '#64748b'
              }}
              aria-label="Previous"
            >
              ‹
            </button>

            <div style={{ width: 1000, maxWidth: '90%', textAlign: 'center', padding: '1.5rem', borderRadius: 16, border: '1px solid #e6eefc', background: 'white', boxShadow: '0 18px 60px rgba(2,6,23,0.06)' }}>
              <div
                onClick={goNext}
                onTouchEnd={goNext}
                style={{
                  width: '100%',
                  aspectRatio: '3 / 2',
                  overflow: 'hidden',
                  borderRadius: 12,
                  marginBottom: 12,
                  background: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img
                    src={howSteps[currentStep].img}
                    alt={howSteps[currentStep].title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: howSteps[currentStep].fit,
                      objectPosition: 'center'
                    }}
                  />
                </div>

              <div style={{ fontWeight: 700, color: '#0066ff', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Step {howSteps[currentStep].step}</div>
              <h3 style={cardTitleStyle}>{howSteps[currentStep].title}</h3>
              <p style={{ ...cardTextStyle, fontSize: '0.95rem' }}>{howSteps[currentStep].desc}</p>
            </div>

            <button
              onClick={() => goNext()}
              style={{
                background: 'transparent', border: 'none', fontSize: '1.6rem', cursor: 'pointer', color: '#64748b'
              }}
              aria-label="Next"
            >
              ›
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14 }}>
            {howSteps.map((s, idx) => (
              <button
                key={s.step}
                onClick={() => setCurrentStep(idx)}
                style={{
                  width: 10, height: 10, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: idx === currentStep ? '#0066ff' : '#e6eefc'
                }}
                aria-label={`Go to step ${s.step}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={sectionPaddingStyle}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span style={{
              ...sectionTagStyle,
              background: 'rgba(0,212,170,0.1)', color: '#00a882',
            }}>Features</span>
            <h2 style={sectionHeadingStyle}>Everything you need to<br /><span style={{ color: '#00d4aa' }}>fight fake medicines</span></h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '1.5rem' }}>
            {[
              { icon: '🔍', title: 'Instant QR Verification', desc: 'Scan any medicine QR code with your phone camera and get results in under 3 seconds.', color: '#0066ff' },
              { icon: '🛡️', title: 'JWT Secured Auth', desc: 'Role-based access for patients, manufacturers, and regulators with bank-grade security.', color: '#6c63ff' },
              { icon: '📊', title: 'Admin Analytics', desc: 'Real-time dashboards showing verification patterns, fake hotspots, and suspicious activity.', color: '#ff6b35' },
              { icon: '🏭', title: 'Manufacturer Portal', desc: 'Register medicines, generate QR codes, and monitor your products across the supply chain.', color: '#00d4aa' },
              { icon: '🚨', title: 'Crowdsourced Reporting', desc: 'Patients and pharmacists can flag suspicious medicines for review by regulators.', color: '#ff3b5c' },
            ].map((f, i) => (
              <div key={i} style={{
                padding: '2rem', borderRadius: 20,
                border: '1.5px solid #f1f5f9',
                transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 20px 50px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = f.color + '44';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = '#f1f5f9';
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: f.color + '15', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', marginBottom: '1rem',
                }}>{f.icon}</div>
                <h3 style={cardTitleStyle}>{f.title}</h3>
                <p style={{ ...cardTextStyle, fontSize: '0.85rem' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        background: '#0a0f1e', padding: '3rem 5%',        display: 'flex', alignItems: 'center', justifyContent: 'space-between',        flexWrap: 'wrap', gap: '1rem',        borderTop: '1px solid rgba(255,255,255,0.06)',      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{fontWeight: 800, color: 'white', fontSize: '1rem' }}>
            MEDI<span style={{ color: '#00d4aa' }}>TRUST</span>
          </span>
        </div>
        <p style={{ color: '#a1a1aa', fontSize: '0.9rem', textAlign: 'center' }}>
          B.Tech CSE PBL Project · Graphic Era Hill University, Bhimtal · 2026
        </p>
      </footer>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes navPulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 0; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
