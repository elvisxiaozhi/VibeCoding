import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'vibecoding-theme'
const THEME_CHANGE_EVENT = 'vibecoding-theme-change'

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'system'
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode !== 'system') {
    return mode
  }

  if (typeof window === 'undefined') {
    return 'dark'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.dataset.theme = mode
  document.documentElement.dataset.resolvedTheme = resolved
  return resolved
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => getStoredTheme())
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(getStoredTheme()))

  const setTheme = useCallback((nextMode: ThemeMode) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextMode)
    const nextResolved = applyTheme(nextMode)
    setModeState(nextMode)
    setResolvedTheme(nextResolved)
    window.dispatchEvent(new CustomEvent<ThemeMode>(THEME_CHANGE_EVENT, { detail: nextMode }))
  }, [])

  useEffect(() => {
    const current = getStoredTheme()
    setModeState(current)
    setResolvedTheme(applyTheme(current))

    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const syncFromSystem = () => {
      const latest = getStoredTheme()
      if (latest === 'system') {
        setResolvedTheme(applyTheme(latest))
      }
    }

    const syncFromStorage = () => {
      const latest = getStoredTheme()
      setModeState(latest)
      setResolvedTheme(applyTheme(latest))
    }

    media.addEventListener('change', syncFromSystem)
    window.addEventListener('storage', syncFromStorage)
    window.addEventListener(THEME_CHANGE_EVENT, syncFromStorage)

    return () => {
      media.removeEventListener('change', syncFromSystem)
      window.removeEventListener('storage', syncFromStorage)
      window.removeEventListener(THEME_CHANGE_EVENT, syncFromStorage)
    }
  }, [])

  return { mode, resolvedTheme, setTheme }
}
