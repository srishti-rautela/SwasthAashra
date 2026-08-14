import { useContext, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import AuthContext from '../utils/AuthContext'
import Profile from '../pages/Profile'

const LOGO_SRC = '/photos/logo_head.png'

export default function DashboardLayout({ role, children }) {
  const { user, logout } = useContext(AuthContext)
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const portalRole = String(user?.role || role || 'User').toLowerCase()
  const initials = (user?.name || 'U').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()
  const menuRef = useRef(null)

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  useEffect(() => {
    const handler = (e) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Daily health thought (rotates by day)
  const healthQuotes = [
    'Drink water, move often, breathe deep.',
    'Small stretches now prevent big pains later.',
    'A short walk boosts mood and circulation.',
    'Consistency beats intensity—choose balance.',
    'Healthy sleep is your silent superpower.'
  ]
  const dailyQuote = healthQuotes[new Date().getDate() % healthQuotes.length]

  return (
    <div className="min-h-screen flex flex-col text-[#1F2937]">
      <motion.header
        initial={{ y:-50, opacity:0 }}
        animate={{ y:0, opacity:1 }}
        transition={{ type:'spring', stiffness:120, damping:16 }}
        className="sticky top-0 z-40 bg-transparent"
      >
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center">
          {/* Logo formatting/layout same as LandingPage */}
          <a href="/" aria-label="SwasthaAshra home" className="shrink-0">
            <img
              src={LOGO_SRC}
              alt="SwasthaAshra logo"
              className="h-16 w-52 object-contain select-none transition-transform duration-200 hover:scale-[1.03]"
              draggable="false"
            />
          </a>

          {/* Centered portal role with blue underline hover */}
          <div className="flex-1 flex justify-center">
            <div
              className="nav-underline text-[18px] font-semibold capitalize text-[#1F2937] hover:text-[#5A6BEB] transition-colors cursor-pointer"
              tabIndex={0}
              style={{ minWidth: 90, textAlign: 'center' }}
            >
              {portalRole} portal
            </div>
          </div>

          {/* Avatar dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={()=>setMenuOpen(v=>!v)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white/80 hover:bg-white shadow-sm transition"
            >
              <span className="grid place-items-center w-8 h-8 rounded-full text-white text-sm font-semibold bg-brand-gradient">
                {initials}
              </span>
              <span className="text-sm font-medium truncate max-w-[140px]">{user?.name || 'User'}</span>
              <motion.span animate={{ rotate: menuOpen ? 180 : 0 }} className="text-slate-500 text-xs">▼</motion.span>
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity:0, y:-6, scale:0.96 }}
                  animate={{ opacity:1, y: 4, scale:1 }}
                  exit={{ opacity:0, y:-6, scale:0.96 }}
                  transition={{ duration:0.16 }}
                  className="absolute right-0 mt-1 w-48 rounded-xl border border-slate-200 bg-white/95 backdrop-blur p-1 shadow-lg ring-1 ring-slate-200/40"
                >
                  <button
                    onClick={()=>{ setProfileOpen(v=>!v); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50"
                  >Profile</button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg text-rose-600 hover:bg-rose-50"
                  >Logout</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {profileOpen && (
          <motion.div
            initial={{ height:0, opacity:0 }}
            animate={{ height:'auto', opacity:1 }}
            exit={{ height:0, opacity:0 }}
            transition={{ duration:0.28 }}
            className="pt-4"
          >
            <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                <h3 className="text-sm font-semibold">Profile</h3>
                <button
                  onClick={() => setProfileOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                >Close</button>
              </div>
              <div className="p-4">
                <Profile />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 py-6">
        <motion.div layout className="grid gap-10">
          {children}
        </motion.div>
      </main>

      <footer className="py-5 text-[11px] text-gray-600 flex flex-col items-center gap-2">
        <div className="text-xs font-medium text-gray-700">{dailyQuote}</div>
      </footer>
    </div>
  )
}

