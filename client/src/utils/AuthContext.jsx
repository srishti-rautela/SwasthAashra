// ================== Imports ==================
import { createContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // hydrate from localStorage on first load
    const t = localStorage.getItem('token')
    const u = localStorage.getItem('user')
    if (t && u) { setToken(t); setUser(JSON.parse(u)) }
    setReady(true)
  }, [])

  useEffect(()=>{
    if(token){
      axios.defaults.headers.common.Authorization = `Bearer ${token}`
    }else{
      delete axios.defaults.headers.common.Authorization
    }
  },[token])

  const login = (t, u) => {
    setToken(t); setUser(u)
    localStorage.setItem('token', t)
    localStorage.setItem('user', JSON.stringify(u))
  }

  const logout = () => {
    setToken(null); setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  const value = useMemo(() => ({ user, token, ready, login, logout }), [user, token, ready])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext