import { ref, readonly } from 'vue'

export type Theme = 'light' | 'dark'

// keep in sync with the pre-paint script in index.html
const STORAGE_KEY = 'bcmr-generator-theme'

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'dark' || value === 'light' ? value : null
  } catch {
    return null // private mode / blocked storage
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

// module-level so every component shares one source of truth
const theme = ref<Theme>(storedTheme() ?? systemTheme())
applyTheme(theme.value)

// follow the OS as long as the visitor hasn't picked a side themselves
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (storedTheme()) return
  theme.value = e.matches ? 'dark' : 'light'
  applyTheme(theme.value)
})

export function useTheme() {
  function setTheme(next: Theme) {
    theme.value = next
    applyTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // preference just won't persist
    }
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return { theme: readonly(theme), setTheme, toggleTheme }
}
