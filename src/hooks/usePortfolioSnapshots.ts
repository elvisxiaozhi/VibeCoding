import { useCallback, useEffect, useRef, useState } from 'react'

import type { ExchangeRates } from '@/lib/currency'
import type { PortfolioSnapshot } from '@/lib/types'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function usePortfolioSnapshots(isLoggedIn: boolean, rates: ExchangeRates, ratesLoading: boolean) {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([])
  const [selectedSnapshot, setSelectedSnapshot] = useState<PortfolioSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const createdTodayRef = useRef(false)

  const fetchSnapshots = useCallback(async () => {
    if (!isLoggedIn) {
      setSnapshots([])
      setSelectedSnapshot(null)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/portfolio-snapshots', { credentials: 'include' })
      if (!res.ok) throw new Error(`snapshots request failed: ${res.status}`)
      const data = (await res.json()) as PortfolioSnapshot[]
      setSnapshots(data)
      if (data.length > 0) {
        const latest = data[data.length - 1]
        const detailRes = await fetch(`/api/portfolio-snapshots/${latest.snapshotDate}`, { credentials: 'include' })
        if (detailRes.ok) {
          setSelectedSnapshot((await detailRes.json()) as PortfolioSnapshot)
        }
      } else {
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
      await fetchSnapshots()
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
      setSelectedSnapshot((await res.json()) as PortfolioSnapshot)
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
    if (!isLoggedIn || ratesLoading || createdTodayRef.current) return
    createdTodayRef.current = true
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
