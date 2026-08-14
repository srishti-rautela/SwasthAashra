import { createContext, useContext, useState, useEffect } from 'react';
import meditrustApi from '../utils/meditrustApi';

const MediTrustAuthContext = createContext(null);

export const MediTrustAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('meditrust_token');
    const savedUser = localStorage.getItem('meditrust_user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('meditrust_token');
        localStorage.removeItem('meditrust_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password, role) => {
    const res = await meditrustApi.post('/auth/login', { email, password, role });
    const { token, user: userData } = res.data;
    localStorage.setItem('meditrust_token', token);
    localStorage.setItem('meditrust_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const register = async (formData) => {
    const res = await meditrustApi.post('/auth/register', formData);
    const { token, user: userData } = res.data;
    localStorage.setItem('meditrust_token', token);
    localStorage.setItem('meditrust_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('meditrust_token');
    localStorage.removeItem('meditrust_user');
    setUser(null);
  };

  return (
    <MediTrustAuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </MediTrustAuthContext.Provider>
  );
};

export const useMediTrustAuth = () => {
  const ctx = useContext(MediTrustAuthContext);
  if (!ctx) throw new Error('useMediTrustAuth must be used inside MediTrustAuthProvider');
  return ctx;
};
