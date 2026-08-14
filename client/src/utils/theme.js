export const THEME_KEY = 'sa_theme'

export function getInitialTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'light' } catch { return 'light' }
}

export function applyTheme(next = 'light') {
  const t = next === 'dark' ? 'dark' : 'light'
  const root = document.documentElement
  root.classList.toggle('dark', t === 'dark')
  root.dataset.theme = t
  try { localStorage.setItem(THEME_KEY, t) } catch {}
}