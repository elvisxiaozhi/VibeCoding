import { useCallback, useEffect, useMemo, useState } from 'react'

import { MOCK_ASSETS } from '@/data/mock'
import {
  categoryBreakdown,
  totalCostValue,
  totalMarketValue,
  totalPnLValue,
} from '@/lib/calc'
import type { Asset } from '@/lib/types'

const STORAGE_KEY = 'vibecoding:assets:v1'

/** 从 localStorage 读取资产列表；首次加载无数据则返回 Mock */
function loadFromStorage(): Asset[] {
  if (typeof window === 'undefined') return MOCK_ASSETS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return MOCK_ASSETS
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return MOCK_ASSETS
    return parsed as Asset[]
  } catch {
    return MOCK_ASSETS
  }
}

function saveToStorage(assets: Asset[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assets))
  } catch {
    // 存储失败（如隐私模式）静默忽略
  }
}

export type AssetDraft = Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>
export type AssetPatch = Partial<Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>>

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>(() => loadFromStorage())

  // 状态变化即同步回 localStorage；首次挂载也会写入一次，从而完成 Mock 初始化
  useEffect(() => {
    saveToStorage(assets)
  }, [assets])

  const addAsset = useCallback((draft: AssetDraft) => {
    const now = new Date().toISOString()
    const asset: Asset = {
      ...draft,
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    }
    setAssets((prev) => [...prev, asset])
  }, [])

  const updateAsset = useCallback((id: string, patch: AssetPatch) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, ...patch, updatedAt: new Date().toISOString() }
          : a,
      ),
    )
  }, [])

  const deleteAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const totalValue = useMemo(() => totalMarketValue(assets), [assets])
  const totalCost = useMemo(() => totalCostValue(assets), [assets])
  const totalPnL = useMemo(() => totalPnLValue(assets), [assets])
  const breakdown = useMemo(() => categoryBreakdown(assets), [assets])

  return {
    assets,
    addAsset,
    updateAsset,
    deleteAsset,
    totalValue,
    totalCost,
    totalPnL,
    categoryBreakdown: breakdown,
  }
}
