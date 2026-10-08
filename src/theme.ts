// Light/dark preference. Dark is the default; the choice is a per-device convenience.

export type Theme = 'dark' | 'light'
const KEY = 'greenlit.theme'

export function loadTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f4f5f7' : '#0e0f13')
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Not saved; it still applies for this visit.
  }
}
