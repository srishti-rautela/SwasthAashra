// ================== Imports ==================
import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

// ================== Constants ==================
const HERO_IMG = '/photos/hero_img.png'
const HERO_IMG_ALT = 'Healthcare hero visual'
const ABOUT_VIDEO = '/photos/down.mp4' 
const LOGO_SRC = '/photos/logo_head.png'

// ================== Feature card reusable component ==================
function FeatureCard({ label, title, children, visual, rightAlign }) {
  return (
    <div className="relative rounded-[32px] feature-surface overflow-hidden flex flex-col md:flex-row items-stretch mb-10 shadow-2xl ring-1 ring-black/5 bg-white">
      {/* Visual (left or right) */}
      {visual && !rightAlign && (
        <div className="flex-1 flex items-center justify-center p-8 md:p-10">{visual}</div>
      )}
      {/* Text */}
      <div className={`flex-1 p-8 md:p-12 flex flex-col justify-center ${rightAlign ? 'order-first md:order-last' : ''}`}>
        <span className="text-sm font-medium text-[#5E5CE6]">{label}</span>
        <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
        <p className="mt-5 text-gray-600 leading-relaxed">{children}</p>
      </div>
      {visual && rightAlign && (
        <div className="flex-1 flex items-center justify-center p-8 md:p-10">{visual}</div>
      )}
    </div>
  );
}

// ================== Landing Page Component ==================
export default function LandingPage() {
  const [, setScrolled] = useState(false)
  const [hideNav, setHideNav] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const lastY = useRef(0)

  // Handle navbar hide/show on scroll
  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      const y = window.scrollY
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(y > 24)
          setHideNav(y > 80 && y > lastY.current)
          lastY.current = y
          ticking = false
        })
        ticking = true
      }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Animation variants
  const heroText = {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  }
  const slideLeft = {
    hidden: { opacity: 0, x: -60 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  }
  const slideRight = {
    hidden: { opacity: 0, x: 60 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  }

  return (
    <div className="min-h-screen text-[#1F2937] antialiased">
      {/* Navbar */}
      <header
        className={`fixed top-0 left-0 w-full z-40 bg-transparent backdrop-blur-0 border-0 shadow-none transition-transform duration-300 ${
          hideNav ? '-translate-y-full' : 'translate-y-0'
        }`}
        style={{ willChange: 'transform' }}
      >
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center">
          {/* Logo */}
          <a href="#home" aria-label="SwasthaAshra home" className="shrink-0">
            <img
              src={LOGO_SRC}
              alt="SwasthaAshra logo"
              className="h-16 w-52 object-contain select-none transition-transform duration-200 hover:scale-[1.03]"
              draggable="false"
            />
          </a>
          {/* Navigation */}
          <div className="flex-1 flex justify-center">
            <nav className="hidden md:flex items-center gap-14">
              <a href="#features" className="nav-underline text-[18px] font-semibold tracking-tight text-[#111] hover:text-[#5A6BEB] transition-colors">Features</a>
              <a href="#about" className="nav-underline text-[18px] font-semibold tracking-tight text-[#111] hover:text-[#5A6BEB] transition-colors">About</a>
              <a href="#contact" className="nav-underline text-[18px] font-semibold tracking-tight text-[#111] hover:text-[#5A6BEB] transition-colors">Contact</a>
              <Link to="/medicine" className="nav-underline text-[18px] font-semibold tracking-tight text-[#111] hover:text-[#5A6BEB] transition-colors">Verify Medicine</Link>
            </nav>
          </div>
          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link to="/auth" className="text-[16px] font-semibold tracking-tight text-[#111] hover:text-[#5A6BEB] transition-colors">Sign in</Link>
            <Link
              to="/register"
              className="inline-flex items-center px-6 py-2.5 rounded-full text-white text-[16px] font-semibold shadow-lg shadow-indigo-200/50 bg-brand-gradient hover:-translate-y-0.5 transition"
            >
              Get started
            </Link>
          </div>
          {/* Mobile Menu Button */}
          <button
            aria-label="menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden ml-auto p-2 text-gray-700"
          >
            {mobileMenuOpen ? (
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu Panel */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-black/5 shadow-lg">
            <nav className="flex flex-col px-6 py-4 gap-4">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-[17px] font-semibold text-[#111]">Features</a>
              <a href="#about" onClick={() => setMobileMenuOpen(false)} className="text-[17px] font-semibold text-[#111]">About</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="text-[17px] font-semibold text-[#111]">Contact</a>
              <Link to="/medicine" onClick={() => setMobileMenuOpen(false)} className="text-[17px] font-semibold text-[#111]">Verify Medicine</Link>
              <div className="h-px bg-black/10 my-1" />
              <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="text-[17px] font-semibold text-[#111]">Sign in</Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-full text-white text-[16px] font-semibold shadow-lg shadow-indigo-200/50 bg-brand-gradient"
              >
                Get started
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-32">
        {/* Hero Section */}
        <section id="home" className="pt-16 md:pt-24 pb-12">
          <div className="text-center max-w-4xl mx-auto">
            <motion.h1
              initial="hidden"
              animate="visible"
              variants={heroText}
              className="text-4xl sm:text-6xl heading-xl leading-tight tracking-tight"
            >
              <span className="block">Intelligent Discharge.</span>
              <span className="block text-brand-gradient">
                Better Patient Outcomes.
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.12 }}
              className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mt-5"
            >
              Reduce delays and readmissions with a secure, workflow-driven platform that streamlines discharge and keeps patient data safe.
            </motion.p>
            {/* Hero Call-to-Actions */}
            <div className="mt-8 flex items-center justify-center gap-3">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="inline-flex">
                <Link
                  to="/register"
                  className="inline-flex items-center px-6 py-3 rounded-full text-white font-semibold shadow-lg shadow-indigo-200/50 transition transform hover:-translate-y-0.5 focus:outline-none bg-brand-gradient"
                >
                  Get Started
                </Link>
              </motion.div>
              <a href="#features" className="btn-nav-outline">Explore features</a>
              <Link to="/medicine" className="btn-nav-outline relative">
                Verify a Medicine
                <span className="new-web-badge new-web-badge-floating">Try our new web</span>
              </Link>
            </div>
            {/* Hero Visual */}
            <div className="mt-12 md:mt-16">
              <div className="relative mx-auto max-w-5xl rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/5 bg-white">
                <video
                  src={ABOUT_VIDEO}
                  poster={HERO_IMG}
                  className="w-full h-[360px] md:h-[460px] object-cover outline-none"
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls={false}
                  controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
                  disablePictureInPicture
                  onContextMenu={(e)=>e.preventDefault()}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-12 md:py-16 scroll-mt-24">
          {/* Feature 1: Accelerated Discharge (image left) */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, amount: 0.35 }}
            variants={slideLeft}
            className="mb-24" // Increased gap
          >
            <FeatureCard
              label="Workflow"
              title="Accelerated Discharges"
              visual={
                <div className="relative w-full max-w-md">
                  <div className="rounded-2xl bg-[#111014] px-8 py-10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]">
                    <div className="flex flex-col gap-6">
                      <div className="flex gap-6">
                        <div className="flex-1 rounded-xl bg-[#1D1C21] p-6 text-center">
                          <div className="text-xs text-gray-400">Pending</div>
                          <div className="mt-2 text-2xl font-semibold text-gray-200">8</div>
                        </div>
                        <div className="flex-1 rounded-xl bg-[#1D1C21] p-6 text-center">
                          <div className="text-xs text-gray-400">Completed</div>
                          <div className="mt-2 text-2xl font-semibold text-gray-200">31</div>
                        </div>
                      </div>
                      <div className="rounded-xl bg-[#1D1C21] p-6 mt-2">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-gray-400 text-xs">Today Workflow</span>
                          <span className="text-xs px-2 py-1 rounded-full bg-[#5E5CE6] text-white">Live</span>
                        </div>
                        <div className="space-y-2 text-sm text-gray-300">
                          <div className="flex justify-between">
                            <span>Checklist build</span>
                            <span className="text-[#5E5CE6]">Done</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Physician sign-off</span>
                            <span className="text-yellow-400">Pending</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Pharmacy release</span>
                            <span className="text-green-400">Queued</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -top-6 -left-6 w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-lg bg-brand-gradient">
                    <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                      <path d="M6 12h12M6 8h12M6 16h8" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8 16l1.5 1.5L12 15" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              }
            >
              Automated tasks, approvals, and clear checklists reduce friction so patients go home sooner with complete follow-up instructions and medication support.
            </FeatureCard>
          </motion.div>

          {/* Feature 2: Quick Appointment (image right) */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, amount: 0.35 }}
            variants={slideRight}
            className="mb-24" // Increased gap
          >
            <FeatureCard
              label="Scheduling"
              title="Quick Appointment"
              rightAlign
              visual={
                <div className="relative w-full max-w-md">
                  <div className="rounded-2xl bg-[#111014] px-8 py-10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex flex-col items-center">
                    <div className="rounded-xl bg-[#1D1C21] p-6 w-full text-center mb-4">
                      <div className="text-xs text-gray-400 mb-2">Next Available</div>
                      <div className="text-2xl font-semibold text-gray-200">10:30 AM</div>
                    </div>
                    <div className="rounded-xl bg-[#1D1C21] p-6 w-full text-center">
                      <div className="text-xs text-gray-400 mb-2">Total Appointments Today</div>
                      <div className="text-2xl font-semibold text-gray-200">24</div>
                    </div>
                  </div>
                  <div className="absolute -top-6 -right-6 w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-lg bg-brand-gradient">
                    <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                      <path d="M12 8v4l3 3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              }
            >
              Effortlessly schedule and manage appointments, minimizing wait times and ensuring timely care for every patient.
            </FeatureCard>
          </motion.div>

          {/* Feature 3: Instant Medical Referral & Consent Sharing (image left) */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, amount: 0.35 }}
            variants={slideLeft}
            className="mb-24" // Increased gap
          >
            <FeatureCard
              label="Receipts"
              title="Instant Medical Referral & Consent Sharing"
              visual={
                <div className="relative w-full max-w-md">
                  <div className="rounded-2xl bg-[#111014] px-8 py-10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex flex-col items-center">
                    <div className="rounded-xl bg-[#1D1C21] p-6 w-full text-center mb-4">
                      <div className="text-xs text-gray-400 mb-2">Referral Sent</div>
                      <div className="text-2xl font-semibold text-[#5E5CE6]">Medicine</div>
                    </div>
                    <div className="rounded-xl bg-[#1D1C21] p-6 w-full text-center">
                      <div className="text-xs text-gray-400 mb-2">Consent Linked</div>
                      <div className="text-2xl font-semibold text-green-400">Authorized</div>
                    </div>
                  </div>
                  <div className="absolute -top-6 -left-6 w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-lg bg-brand-gradient">
                    <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                      <path d="M12 3l5 3v4c0 4.418-3.582 8-8 8-1.657 0-3-1.343-3-3v-9l6-3z" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9 14l2 2 4-4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              }
            >
              Effortlessly send medicine referrals and consent-linked medical receipts to patients and departments. Everything moves instantly, securely, and without the paper-mess — keeping the process smooth, transparent, and properly authorized.
            </FeatureCard>
          </motion.div>

          {/* Feature 4: Always-On Access (image right) */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, amount: 0.35 }}
            variants={slideRight}
            className="mb-24" // Increased gap
          >
            <FeatureCard
              label="Availability"
              title="Always-On Access"
              rightAlign
              visual={
                <div className="relative w-full max-w-md">
                  <div className="rounded-2xl bg-[#111014] px-8 py-10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]">
                    <div className="rounded-xl bg-[#1D1C21] p-6 text-gray-300">
                      <div className="text-xs text-gray-400 mb-2">Sessions</div>
                      <div className="flex justify-between text-sm">
                        <span>Doctor Portal</span><span className="text-green-400">Active</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span>Nurse Station</span><span className="text-green-400">Active</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span>Pharmacy</span><span className="text-yellow-400">Idle</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-6">
                      <div className="rounded-lg bg-[#1D1C21] p-4 text-center text-gray-300">
                        <div className="text-xs text-gray-400">Latency</div>
                        <div className="mt-2 text-lg font-semibold">34ms</div>
                      </div>
                      <div className="rounded-lg bg-[#1D1C21] p-4 text-center text-gray-300">
                        <div className="text-xs text-gray-400">Uptime</div>
                        <div className="mt-2 text-lg font-semibold">99.9%</div>
                      </div>
                      <div className="rounded-lg bg-[#1D1C21] p-4 text-center text-gray-300">
                        <div className="text-xs text-gray-400">Nodes</div>
                        <div className="mt-2 text-lg font-semibold">12</div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -top-6 -right-6 w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-lg bg-brand-gradient">
                    <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                      <path d="M12 8v4l3 3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              }
            >
              Authorized staff reach critical information anytime—reducing delays, eliminating duplicate requests, and supporting continuous, coordinated care.
            </FeatureCard>
          </motion.div>

          {/* Feature 5: Instant Discharge Slip / Clearance (image left) */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, amount: 0.35 }}
            variants={slideLeft}
            className="mb-24" // Increased gap
          >
            <FeatureCard
              label="Clearance"
              title="Instant Discharge Slip / Clearance"
              visual={
                <div className="relative w-full max-w-md">
                  <div className="rounded-2xl bg-[#111014] px-8 py-10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex flex-col items-center">
                    <div className="rounded-xl bg-[#1D1C21] p-6 w-full text-center mb-4">
                      <div className="text-xs text-gray-400 mb-2">Slip Generated</div>
                      <div className="text-2xl font-semibold text-[#5E5CE6]">#DS20251119</div>
                    </div>
                    <div className="rounded-xl bg-[#1D1C21] p-6 w-full text-center">
                      <div className="text-xs text-gray-400 mb-2">Status</div>
                      <div className="text-2xl font-semibold text-green-400">Cleared</div>
                    </div>
                  </div>
                  <div className="absolute -top-6 -left-6 w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-lg bg-brand-gradient">
                    <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                      <path d="M15 17h5l-1.4-1.4A8 8 0 1 0 4 12" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="18" cy="18" r="3" fill="white"/>
                    </svg>
                  </div>
                </div>
              }
            >
              Instantly generate and share discharge slips and clearance certificates with patients and departments. Ensure every discharge is documented, accessible, and authorized in real time—no waiting, no paperwork bottlenecks.
            </FeatureCard>
          </motion.div>

          {/* Feature 6: Seamless Patient Handover (image right) */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, amount: 0.35 }}
            variants={slideRight}
            className="mb-24"
          >
            <FeatureCard
              label="Coordination"
              title="Seamless Patient Handover"
              rightAlign
              visual={
                <div className="relative w-full max-w-md">
                  <div className="rounded-2xl bg-[#111014] px-8 py-10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex flex-col items-center">
                    <div className="rounded-xl bg-[#1D1C21] p-6 w-full text-center mb-4">
                      <div className="text-xs text-gray-400 mb-2">Next Care Team</div>
                      <div className="text-2xl font-semibold text-[#5E5CE6]">Ward 3B</div>
                    </div>
                    <div className="rounded-xl bg-[#1D1C21] p-6 w-full text-center">
                      <div className="text-xs text-gray-400 mb-2">Status</div>
                      <div className="text-2xl font-semibold text-green-400">Ready</div>
                    </div>
                  </div>
                  <div className="absolute -top-6 -right-6 w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-lg bg-brand-gradient">
                    <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                      <path d="M17 17l-5-5-5 5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 12V3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              }
            >
              Instantly notify and transfer all relevant patient information to the next care team, ensuring a smooth, error-free handover and continuous care.
            </FeatureCard>
          </motion.div>

          {/* Feature 7: Analytics & Insights (image left) */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, amount: 0.35 }}
            variants={slideLeft}
            className="mb-24"
          >
            <FeatureCard
              label="Analytics"
              title="Actionable Insights"
              visual={
                <div className="relative w-full max-w-md">
                  <div className="rounded-2xl bg-[#111014] px-8 py-10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex flex-col items-center">
                    <div className="rounded-xl bg-[#1D1C21] p-6 w-full text-center mb-4">
                      <div className="text-xs text-gray-400 mb-2">Avg. Discharge Time</div>
                      <div className="text-2xl font-semibold text-[#5E5CE6]">2h 15m</div>
                    </div>
                    <div className="rounded-xl bg-[#1D1C21] p-6 w-full text-center">
                      <div className="text-xs text-gray-400 mb-2">Readmission Rate</div>
                      <div className="text-2xl font-semibold text-yellow-400">3.2%</div>
                    </div>
                  </div>
                  <div className="absolute -top-6 -left-6 w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-lg bg-brand-gradient">
                    <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                      <path d="M4 17v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="7" r="4" stroke="white" strokeWidth="1.4"/>
                    </svg>
                  </div>
                </div>
              }
            >
              Visualize key metrics and trends to optimize discharge processes, reduce delays, and improve patient outcomes with real-time analytics.
            </FeatureCard>
          </motion.div>
        </section>

        {/* ABOUT */}
        <section id="about" className="py-24 scroll-mt-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="rounded-3xl overflow-hidden shadow-xl ring-1 ring-black/5 bg-white">
              <div className="w-full h-64 md:h-[320px] flex items-center justify-center">
                <img
                  src={HERO_IMG}
                  alt={HERO_IMG_ALT}
                  className="max-w-full max-h-full object-contain"
                  onError={(e)=>{ e.currentTarget.src='/photos/placeholder.jpg' }}
                />
              </div>
            </div>

            <div>
              <h3 className="text-2xl md:text-3xl font-bold tracking-tight">About SwasthaAshra</h3>
              <p className="mt-4 text-gray-600">
                SwasthaAshra helps hospitals digitize discharge workflows to cut administrative delays, reduce readmissions,
                and improve patient communication through secure, auditable records and actionable analytics.
              </p>
              <ul className="mt-6 text-gray-700 space-y-2 text-sm">
                <li>• Faster, safer patient transitions</li>
                <li>• Built for compliance and security</li>
                <li>• Insights to optimize operations</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CONTACT / CTA */}
        <section id="contact" className="py-24 scroll-mt-24">
          <div className="max-w-3xl mx-auto rounded-3xl bg-white p-8 shadow-xl ring-1 ring-black/5">
            <h3 className="text-xl md:text-2xl font-bold tracking-tight">Reach out</h3>
            <p className="text-gray-600 mt-2">
              Schedule a demo or ask about integrations — our team will reply within one business day.
            </p>

            <form className="mt-6 grid gap-4 sm:grid-cols-2">
              <input className="p-3.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/50 outline-none" placeholder="Name" />
              <input className="p-3.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/50 outline-none" placeholder="Email" type="email" />
              <textarea className="sm:col-span-2 p-3.5 rounded-xl border border-gray-200 h-32 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/50 outline-none" placeholder="How can we help?" />
              <div className="sm:col-span-2">
                <button
                  type="button"
                  className="inline-flex items-center px-6 py-3 rounded-full text-white font-semibold shadow-lg shadow-indigo-200/50 transition transform hover:-translate-y-0.5 focus:outline-none bg-brand-gradient"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={LOGO_SRC} alt="SwasthaAshra logo" className="w-10 h-10 rounded object-contain" />
            <div>
              <div className="font-semibold">SwasthaAshra</div>
              <div className="text-sm text-gray-600">Discharge & Health Record System</div>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            © {new Date().getFullYear()} SwasthaAshra. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}