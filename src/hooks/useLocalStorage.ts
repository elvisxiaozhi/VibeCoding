import { useState } from 'react'

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (val: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key)
      if (saved !== null) return JSON.parse(saved) as T
    } catch { /**/ }
    return defaultValue
  })

  function set(val: T) {
    setValue(val)
    try { localStorage.setItem(key, JSON.stringify(val)) } catch { /**/ }
  }

  return [value, set]
}
