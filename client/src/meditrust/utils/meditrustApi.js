// ================== MediTrust API client ==================
// A dedicated axios instance for the Medicine Verification (MediTrust)
// module. Using its own instance (instead of mutating the global `axios`
// defaults) means it can never collide with the hospital app's own
// axios-based `api` client in `utils/api.js` - each keeps its own
// baseURL and its own Authorization header.

import axios from 'axios'

// The MediTrust backend routes are mounted on the same Express server as
// the rest of SwasthAashra, under the /api/meditrust prefix.
const API_BASE_URL = import.meta.env.VITE_MEDITRUST_API_URL || 'http://localhost:4000/api/meditrust'

const meditrustApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
})

meditrustApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('meditrust_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

meditrustApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('meditrust_token')
      localStorage.removeItem('meditrust_user')
    }
    return Promise.reject(err)
  }
)

export default meditrustApi
