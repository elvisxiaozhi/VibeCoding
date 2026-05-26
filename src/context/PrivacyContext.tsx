import { createContext, useContext, useState, type ReactNode } from 'react'

const PRIVACY_KEY = 'privacy_mode'

interface PrivacyContextValue {
  isPrivate: boolean
  toggle: () => void
  mask: (str: string) => string
}

const PrivacyContext = createContext<PrivacyContextValue>({
  isPrivate: false,
  toggle: () => {},
  mask: (s) => s,
})

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isPrivate, setIsPrivate] = useState(() => {
    try { return localStorage.getItem(PRIVACY_KEY) === 'true' } catch { return false }
  })

  function toggle() {
    setIsPrivate((prev) => {
      const next = !prev
      try { localStorage.setItem(PRIVACY_KEY, String(next)) } catch {}
      return next
    })
  }

  const mask = (str: string) => (isPrivate ? '****' : str)

  return (
    <PrivacyContext.Provider value={{ isPrivate, toggle, mask }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  return useContext(PrivacyContext)
}
