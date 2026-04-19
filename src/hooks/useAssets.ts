import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  categoryBreakdown,
  totalCostValue,
  totalMarketValue,
  totalPnLValue,
} from '@/lib/calc'
import type { Asset } from '@/lib/types'
import { MOCK_ASSETS } from '@/data/mock'

interface QuoteResult {
  symbol: string
  price: number
  error?: string
}

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
        market: patch.market ?? current.market,
        costBasis: patch.costBasis ?? current.costBasis,
        currentPrice: patch.currentPrice ?? current.currentPrice,
        quantity: patch.quantity ?? current.quantity,
        currency: patch.currency ?? current.currency,
        dividends: patch.dividends ?? current.dividends,
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

  // 页面加载时自动刷新美股实时价格
  const hasRefreshedPrices = useRef(false)
  useEffect(() => {
    if (!isLoggedIn || hasRefreshedPrices.current || loading || assets.length === 0) return
    hasRefreshedPrices.current = true

    const usHoldings = assets.filter(
      (a) => a.market === 'us' && a.quantity > 0 && a.category !== 'cash',
    )
    if (usHoldings.length === 0) return

    // 提取唯一 ticker（symbol 格式 "AAPL Apple"）
    const tickerMap = new Map<string, Asset[]>()
    for (const a of usHoldings) {
      const ticker = a.symbol.split(' ')[0]
      const list = tickerMap.get(ticker)
      if (list) list.push(a)
      else tickerMap.set(ticker, [a])
    }

    const symbols = [...tickerMap.keys()].join(',')

    fetch(`/api/quotes?symbols=${symbols}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((quotes: QuoteResult[]) => {
        const updates: Promise<void>[] = []
        for (const q of quotes) {
          if (q.error || q.price === 0) continue
          const matched = tickerMap.get(q.symbol)
          if (!matched) continue
          for (const a of matched) {
            if (Math.abs(a.currentPrice - q.price) > 0.001) {
              updates.push(
                fetch(`/api/assets/${a.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    symbol: a.symbol,
                    category: a.category,
                    market: a.market,
                    costBasis: a.costBasis,
                    currentPrice: q.price,
                    quantity: a.quantity,
                    currency: a.currency,
                    purchasedAt: a.purchasedAt,
                  }),
                }).then(() => undefined),
              )
            }
          }
        }
        if (updates.length > 0) {
          Promise.all(updates).then(() => fetchAssets())
        }
      })
      .catch((err) => console.error('Stock price refresh failed:', err))
  }, [isLoggedIn, loading, assets, fetchAssets])

  // 只统计持仓（qty > 0），排除卖出记录
  const holdings = useMemo(() => assets.filter((a) => a.quantity > 0), [assets])
  const totalValue = useMemo(() => totalMarketValue(holdings), [holdings])
  const totalCost = useMemo(() => totalCostValue(holdings), [holdings])
  const totalPnL = useMemo(() => totalPnLValue(holdings), [holdings])
  const breakdown = useMemo(() => categoryBreakdown(holdings), [holdings])

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
