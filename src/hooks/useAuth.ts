import { useCallback, useEffect, useState } from 'react'

export interface User {
  id: string
  username: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // 启动时检查登录态
  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((res) => {
        if (res.ok) return res.json()
        return null
      })
      .then((data) => {
        if (data && data.id) setUser(data as User)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        const data = (await res.json()) as User
        setUser(data)
        return null
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      return body?.error || '登录失败'
    } catch {
      return '无法连接本地后端，请确认 API 服务已启动'
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {})
    setUser(null)
  }, [])

  return {
    user,
    loading,
    isLoggedIn: user !== null,
    login,
    logout,
  }
}
