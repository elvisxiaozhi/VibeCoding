import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  categoryBreakdown,
  totalCostValue,
  totalMarketValue,
  totalPnLValue,
} from '@/lib/calc'
import type { Asset } from '@/lib/types'
import { MOCK_ASSETS } from '@/data/mock'

export type AssetDraft = Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>
export type AssetPatch = Partial<Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>>

export function useAssets(isLoggedIn: boolean) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAssets = useCallback(async () => {
    if (!isLoggedIn) {
      setAssets(MOCK_ASSETS)
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const res = await fetch('/api/assets', { credentials: 'include' })
      const data = (await res.json()) as Asset[]
      setAssets(data)
    } catch (err) {
      console.error('fetchAssets failed:', err)
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn])

  // 初始加载 + 登录态切换时重新加载
  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  const addAsset = useCallback(
    async (draft: AssetDraft) => {
      if (!isLoggedIn) return
      try {
        const res = await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(draft),
        })
        if (!res.ok) {
          const body = (await res.json()) as { error: string }
          console.error('addAsset failed:', body.error)
          return
        }
        await fetchAssets()
      } catch (err) {
        console.error('addAsset failed:', err)
      }
    },
    [isLoggedIn, fetchAssets],
  )

  const updateAsset = useCallback(
    async (id: string, patch: AssetPatch) => {
      if (!isLoggedIn) return
      // 合并 patch 到当前状态，发送完整对象给 PUT
      const current = assets.find((a) => a.id === id)
      if (!current) return

      const merged: AssetDraft = {
        symbol: patch.symbol ?? current.symbol,
        category: patch.category ?? current.category,
        costBasis: patch.costBasis ?? current.costBasis,
        currentPrice: patch.currentPrice ?? current.currentPrice,
        quantity: patch.quantity ?? current.quantity,
        currency: patch.currency ?? current.currency,
      }

      try {
        const res = await fetch(`/api/assets/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(merged),
        })
        if (!res.ok) {
          const body = (await res.json()) as { error: string }
          console.error('updateAsset failed:', body.error)
          return
        }
        await fetchAssets()
      } catch (err) {
        console.error('updateAsset failed:', err)
      }
    },
    [isLoggedIn, assets, fetchAssets],
  )

  const deleteAsset = useCallback(
    async (id: string) => {
      if (!isLoggedIn) return
      try {
        const res = await fetch(`/api/assets/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        if (!res.ok) {
          const body = (await res.json()) as { error: string }
          console.error('deleteAsset failed:', body.error)
          return
        }
        await fetchAssets()
      } catch (err) {
        console.error('deleteAsset failed:', err)
      }
    },
    [isLoggedIn, fetchAssets],
  )

  const totalValue = useMemo(() => totalMarketValue(assets), [assets])
  const totalCost = useMemo(() => totalCostValue(assets), [assets])
  const totalPnL = useMemo(() => totalPnLValue(assets), [assets])
  const breakdown = useMemo(() => categoryBreakdown(assets), [assets])

  return {
    assets,
    loading,
    addAsset,
    updateAsset,
    deleteAsset,
    totalValue,
    totalCost,
    totalPnL,
    categoryBreakdown: breakdown,
  }
}
