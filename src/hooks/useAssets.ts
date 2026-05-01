import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  categoryBreakdown,
  totalCostValue,
  totalMarketValue,
  totalPnLValue,
} from '@/lib/calc'
import type { Asset, OwnerType } from '@/lib/types'
import { MOCK_ASSETS } from '@/data/mock'

export type AssetDraft = Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>
export type AssetPatch = Partial<Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>>

// 模块级缓存：按 owner 维度缓存登录态资产，切页面 remount 时立即返回缓存 + 后台 revalidate
const assetsCache = new Map<string, Asset[]>()

function cacheKey(ownerFilter?: OwnerType): string {
  return ownerFilter ?? 'all'
}

export function useAssets(isLoggedIn: boolean, ownerFilter?: OwnerType) {
  const [assets, setAssets] = useState<Asset[]>(() => {
    if (!isLoggedIn) return MOCK_ASSETS
    return assetsCache.get(cacheKey(ownerFilter)) ?? []
  })
  const [loading, setLoading] = useState(() => {
    if (!isLoggedIn) return false
    return !assetsCache.has(cacheKey(ownerFilter))
  })
  // 请求自增 ID，只接受最新一次 fetchAssets 的回包。
  const fetchSeqRef = useRef(0)
  // 始终指向"当前渲染的" ownerFilter，闭包过时的调用据此识别。
  const ownerFilterRef = useRef(ownerFilter)
  ownerFilterRef.current = ownerFilter

  const fetchAssets = useCallback(async () => {
    if (!isLoggedIn) {
      setAssets(MOCK_ASSETS)
      setLoading(false)
      return
    }
    // 闭包过时（如 auto-refresh 链尾用旧 ownerFilter 重拉）：直接放弃，
    // 否则旧 owner 的数据会被 setAssets 覆盖到正在显示的新 owner 视图上。
    if (ownerFilter !== ownerFilterRef.current) return
    const key = cacheKey(ownerFilter)
    const cached = assetsCache.get(key)
    // 命中缓存：立即上屏，loading 不显示；否则显示 spinner
    if (cached) {
      setAssets(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    const seq = ++fetchSeqRef.current
    try {
      const params = ownerFilter ? `?owner=${ownerFilter}` : ''
      const res = await fetch(`/api/assets${params}`, { credentials: 'include' })
      if (!res.ok) {
        // 401 / 5xx 等：不要把错误对象当数组缓存或上屏（否则 .filter 会炸）
        console.error('fetchAssets HTTP error:', res.status)
        return
      }
      const data = (await res.json()) as unknown
      if (!Array.isArray(data)) {
        console.error('fetchAssets returned non-array:', data)
        return
      }
      if (seq !== fetchSeqRef.current) return
      if (ownerFilter !== ownerFilterRef.current) return
      assetsCache.set(key, data as Asset[])
      setAssets(data as Asset[])
    } catch (err) {
      if (seq !== fetchSeqRef.current) return
      console.error('fetchAssets failed:', err)
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false)
    }
  }, [isLoggedIn, ownerFilter])

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
        // 写操作影响所有 owner 视图，清空全部缓存
        assetsCache.clear()
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
        market: patch.market ?? current.market,
        costBasis: patch.costBasis ?? current.costBasis,
        currentPrice: patch.currentPrice ?? current.currentPrice,
        quantity: patch.quantity ?? current.quantity,
        currency: patch.currency ?? current.currency,
        dividends: patch.dividends ?? current.dividends,
        owner: patch.owner ?? current.owner,
        note: patch.note ?? current.note,
        purchasedAt: patch.purchasedAt ?? current.purchasedAt,
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
        assetsCache.clear()
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
        assetsCache.clear()
        await fetchAssets()
      } catch (err) {
        console.error('deleteAsset failed:', err)
      }
    },
    [isLoggedIn, fetchAssets],
  )

  // 只统计持仓（qty > 0），排除卖出记录
  const holdings = useMemo(() => assets.filter((a) => a.quantity > 0), [assets])
  const totalValue = useMemo(() => totalMarketValue(holdings), [holdings])
  const totalCost = useMemo(() => totalCostValue(holdings), [holdings])
  const totalPnL = useMemo(() => totalPnLValue(holdings), [holdings])
  const breakdown = useMemo(() => categoryBreakdown(holdings), [holdings])

  return {
    assets,
    loading,
    refetch: fetchAssets,
    addAsset,
    updateAsset,
    deleteAsset,
    totalValue,
    totalCost,
    totalPnL,
    categoryBreakdown: breakdown,
  }
}
