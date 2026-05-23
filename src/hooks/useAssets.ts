import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

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
  const [error, setError] = useState<string | null>(null)
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
        if (seq !== fetchSeqRef.current) return
        setError(`加载失败 (${res.status})`)
        console.error('fetchAssets HTTP error:', res.status)
        return
      }
      const data = (await res.json()) as unknown
      if (!Array.isArray(data)) {
        if (seq !== fetchSeqRef.current) return
        setError('加载失败：数据格式异常')
        console.error('fetchAssets returned non-array:', data)
        return
      }
      if (seq !== fetchSeqRef.current) return
      if (ownerFilter !== ownerFilterRef.current) return
      setError(null)
      assetsCache.set(key, data as Asset[])
      setAssets(data as Asset[])
    } catch (err) {
      if (seq !== fetchSeqRef.current) return
      setError('加载失败：网络错误')
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
    async (draft: AssetDraft): Promise<boolean> => {
      if (!isLoggedIn) return false
      try {
        const res = await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(draft),
        })
        if (!res.ok) {
          const body = (await res.json()) as { error: string }
          toast.error(`新增失败：${body.error}`)
          return false
        }
        assetsCache.clear()
        await fetchAssets()
        toast.success('新增成功')
        return true
      } catch (err) {
        toast.error('新增失败：网络错误')
        console.error('addAsset failed:', err)
        return false
      }
    },
    [isLoggedIn, fetchAssets],
  )

  const updateAsset = useCallback(
    async (id: string, patch: AssetPatch): Promise<boolean> => {
      if (!isLoggedIn) return false
      // 合并 patch 到当前状态，发送完整对象给 PUT
      const current = assets.find((a) => a.id === id)
      if (!current) return false

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
        optionType: patch.optionType ?? current.optionType,
        underlyingSymbol: patch.underlyingSymbol ?? current.underlyingSymbol,
        strikePrice: patch.strikePrice ?? current.strikePrice,
        expiryDate: patch.expiryDate ?? current.expiryDate,
        contractMultiplier: patch.contractMultiplier ?? current.contractMultiplier,
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
          toast.error(`保存失败：${body.error}`)
          return false
        }
        assetsCache.clear()
        await fetchAssets()
        toast.success('保存成功')
        return true
      } catch (err) {
        toast.error('保存失败：网络错误')
        console.error('updateAsset failed:', err)
        return false
      }
    },
    [isLoggedIn, assets, fetchAssets],
  )

  const deleteAsset = useCallback(
    async (id: string): Promise<boolean> => {
      if (!isLoggedIn) return false
      try {
        const res = await fetch(`/api/assets/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        if (!res.ok) {
          const body = (await res.json()) as { error: string }
          toast.error(`删除失败：${body.error}`)
          return false
        }
        assetsCache.clear()
        await fetchAssets()
        toast.success('已删除')
        return true
      } catch (err) {
        toast.error('删除失败：网络错误')
        console.error('deleteAsset failed:', err)
        return false
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
    error,
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
