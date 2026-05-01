import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { PriceRefreshSettings, PriceRefreshStatus } from '@/lib/types'

const DEFAULT_SETTINGS: PriceRefreshSettings = {
  autoRefreshEnabled: true,
  refreshIntervalMinutes: 30,
  refreshOnDashboardOpen: true,
  updatedAt: '',
}

interface RefreshResponse {
  updated: number
  failed: number
  skipped: number
  statuses: PriceRefreshStatus[]
}

export function usePriceRefresh(
  isLoggedIn: boolean,
  onPricesChanged?: () => Promise<void> | void,
  options: { autoRun?: boolean } = {},
) {
  const [statuses, setStatuses] = useState<PriceRefreshStatus[]>([])
  const [settings, setSettingsState] = useState<PriceRefreshSettings>(DEFAULT_SETTINGS)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const openedRefreshRef = useRef(false)

  const summary = useMemo(() => ({
    success: statuses.filter((item) => item.status === 'success').length,
    failed: statuses.filter((item) => item.status === 'failed').length,
    skipped: statuses.filter((item) => item.status === 'skipped').length,
    total: statuses.length,
  }), [statuses])

  const fetchStatus = useCallback(async () => {
    if (!isLoggedIn) {
      setStatuses([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/price-refresh/status', { credentials: 'include' })
      if (!res.ok) throw new Error(`price refresh status failed: ${res.status}`)
      setStatuses((await res.json()) as PriceRefreshStatus[])
    } catch (err) {
      console.error('fetch price refresh status failed:', err)
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn])

  const fetchSettings = useCallback(async () => {
    if (!isLoggedIn) {
      setSettingsLoaded(false)
      return
    }
    try {
      const res = await fetch('/api/price-refresh/settings', { credentials: 'include' })
      if (!res.ok) throw new Error(`price refresh settings failed: ${res.status}`)
      setSettingsState((await res.json()) as PriceRefreshSettings)
    } catch (err) {
      console.error('fetch price refresh settings failed:', err)
    } finally {
      setSettingsLoaded(true)
    }
  }, [isLoggedIn])

  const refreshAll = useCallback(async () => {
    if (!isLoggedIn || refreshing) return
    setRefreshing(true)
    try {
      const res = await fetch('/api/price-refresh/all', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`refresh all failed: ${res.status}`)
      const data = (await res.json()) as RefreshResponse
      setStatuses(data.statuses)
      await onPricesChanged?.()
    } catch (err) {
      console.error('refresh all prices failed:', err)
    } finally {
      setRefreshing(false)
    }
  }, [isLoggedIn, onPricesChanged, refreshing])

  const refreshOne = useCallback(async (assetId: string) => {
    if (!isLoggedIn || refreshing) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/price-refresh/assets/${assetId}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`refresh asset failed: ${res.status}`)
      const data = (await res.json()) as RefreshResponse
      setStatuses(data.statuses)
      await onPricesChanged?.()
    } catch (err) {
      console.error('refresh asset price failed:', err)
    } finally {
      setRefreshing(false)
    }
  }, [isLoggedIn, onPricesChanged, refreshing])

  const saveSettings = useCallback(async (next: PriceRefreshSettings) => {
    if (!isLoggedIn) return
    try {
      const res = await fetch('/api/price-refresh/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error(`save price refresh settings failed: ${res.status}`)
      setSettingsState((await res.json()) as PriceRefreshSettings)
    } catch (err) {
      console.error('save price refresh settings failed:', err)
    }
  }, [isLoggedIn])

  useEffect(() => {
    void fetchStatus()
    void fetchSettings()
  }, [fetchSettings, fetchStatus])

  useEffect(() => {
    if (options.autoRun === false) return
    if (!settingsLoaded) return
    if (!isLoggedIn || openedRefreshRef.current) return
    if (!settings.autoRefreshEnabled || !settings.refreshOnDashboardOpen) return
    openedRefreshRef.current = true
    void refreshAll()
  }, [isLoggedIn, options.autoRun, refreshAll, settings.autoRefreshEnabled, settings.refreshOnDashboardOpen, settingsLoaded])

  useEffect(() => {
    if (options.autoRun === false) return
    if (!settingsLoaded) return
    if (!isLoggedIn || !settings.autoRefreshEnabled || settings.refreshIntervalMinutes <= 0) return
    const id = window.setInterval(() => {
      void refreshAll()
    }, settings.refreshIntervalMinutes * 60 * 1000)
    return () => window.clearInterval(id)
  }, [isLoggedIn, options.autoRun, refreshAll, settings.autoRefreshEnabled, settings.refreshIntervalMinutes, settingsLoaded])

  return {
    statuses,
    settings,
    summary,
    loading,
    refreshing,
    fetchStatus,
    refreshAll,
    refreshOne,
    saveSettings,
  }
}
