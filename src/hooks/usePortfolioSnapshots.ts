import { useCallback, useEffect, useState } from 'react'

import type { ExchangeRates } from '@/lib/currency'
import type { PortfolioSnapshot } from '@/lib/types'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

// 模块级缓存：切页面 remount 时立即返回缓存 + 后台 revalidate
let snapshotsCache: PortfolioSnapshot[] | null = null
let selectedSnapshotCache: PortfolioSnapshot | null = null
// "打开 Dashboard 时自动建快照" 在整个会话内只跑一次，避免切回 Dashboard 反复建
let createdTodayThisSession = false

export function usePortfolioSnapshots(isLoggedIn: boolean, rates: ExchangeRates, ratesLoading: boolean) {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>(() => snapshotsCache ?? [])
  const [selectedSnapshot, setSelectedSnapshot] = useState<PortfolioSnapshot | null>(() => selectedSnapshotCache)
  const [loading, setLoading] = useState(() => isLoggedIn && snapshotsCache === null)
  const [creating, setCreating] = useState(false)

  const fetchSnapshots = useCallback(async () => {
    if (!isLoggedIn) {
      snapshotsCache = null
      selectedSnapshotCache = null
      setSnapshots([])
      setSelectedSnapshot(null)
      return
    }

    if (snapshotsCache === null) setLoading(true)
    try {
      const res = await fetch('/api/portfolio-snapshots', { credentials: 'include' })
      if (!res.ok) throw new Error(`snapshots request failed: ${res.status}`)
      const data = (await res.json()) as PortfolioSnapshot[]
      snapshotsCache = data
      setSnapshots(data)
      if (data.length > 0) {
        const latest = data[data.length - 1]
        const detailRes = await fetch(`/api/portfolio-snapshots/${latest.snapshotDate}`, { credentials: 'include' })
        if (detailRes.ok) {
          const detail = (await detailRes.json()) as PortfolioSnapshot
          selectedSnapshotCache = detail
          setSelectedSnapshot(detail)
        }
      } else {
        selectedSnapshotCache = null
        setSelectedSnapshot(null)
      }
    } catch (err) {
      console.error('fetch portfolio snapshots failed:', err)
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn])

  const createTodaySnapshot = useCallback(async () => {
    if (!isLoggedIn || ratesLoading) return
    setCreating(true)
    try {
      const res = await fetch('/api/portfolio-snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          snapshotDate: todayKey(),
          rates,
        }),
      })
      if (!res.ok) throw new Error(`create snapshot failed: ${res.status}`)
      const snapshot = (await res.json()) as PortfolioSnapshot
      snapshotsCache = null // 列表会变化，强制下次 fetch 重新拉
      await fetchSnapshots()
      selectedSnapshotCache = snapshot
      setSelectedSnapshot(snapshot)
    } catch (err) {
      console.error('create portfolio snapshot failed:', err)
    } finally {
      setCreating(false)
    }
  }, [fetchSnapshots, isLoggedIn, rates, ratesLoading])

  const selectSnapshot = useCallback(async (snapshotDate: string) => {
    if (!isLoggedIn) return
    setLoading(true)
    try {
      const res = await fetch(`/api/portfolio-snapshots/${snapshotDate}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`snapshot detail request failed: ${res.status}`)
      const detail = (await res.json()) as PortfolioSnapshot
      selectedSnapshotCache = detail
      setSelectedSnapshot(detail)
    } catch (err) {
      console.error('fetch portfolio snapshot detail failed:', err)
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn])

  useEffect(() => {
    fetchSnapshots()
  }, [fetchSnapshots])

  useEffect(() => {
    if (!isLoggedIn || ratesLoading || createdTodayThisSession) return
    createdTodayThisSession = true
    void createTodaySnapshot()
  }, [createTodaySnapshot, isLoggedIn, ratesLoading])

  return {
    snapshots,
    selectedSnapshot,
    loading,
    creating,
    createTodaySnapshot,
    selectSnapshot,
  }
}
