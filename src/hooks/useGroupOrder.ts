import { useState } from 'react'

export const GROUP_IDS = ['cn', 'hk', 'us', 'crypto', 'gold', 'cash', 'provident_fund'] as const
export type GroupId = typeof GROUP_IDS[number]

export const GROUP_LABELS: Record<GroupId, string> = {
  cn: '人民币资产',
  hk: '港股资产',
  us: '美股资产',
  crypto: '加密货币资产',
  gold: '黄金资产',
  cash: '现金',
  provident_fund: '公积金',
}

const STORAGE_KEY = 'asset-group-order'

function loadOrder(): GroupId[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return [...GROUP_IDS]
    const parsed = JSON.parse(saved) as string[]
    const valid = parsed.filter((id): id is GroupId => (GROUP_IDS as readonly string[]).includes(id))
    const missing = GROUP_IDS.filter(id => !valid.includes(id))
    return [...valid, ...missing]
  } catch {
    return [...GROUP_IDS]
  }
}

export function useGroupOrder() {
  const [order, setOrder] = useState<GroupId[]>(loadOrder)

  function updateOrder(newOrder: GroupId[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder))
    setOrder(newOrder)
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY)
    setOrder([...GROUP_IDS])
  }

  return { order, updateOrder, reset }
}
