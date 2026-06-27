import { useState } from 'react'

export const PANEL_IDS = ['fire', 'currency_ann', 'contribution', 'option', 'snapshot_structure', 'rebalance', 'performance', 'risk', 'dividend'] as const
export type PanelId = typeof PANEL_IDS[number]

export const PANEL_LABELS: Record<PanelId, string> = {
  fire: 'FIRE 目标',
  currency_ann: '分币种年化',
  contribution: '出入金 vs 市场收益',
  option: '期权表现',
  snapshot_structure: '净值曲线 & 资产结构',
  rebalance: '目标配置 / 再平衡',
  performance: '收益排行',
  risk: '风险敞口',
  dividend: '分红收入',
}

const STORAGE_KEY = 'dashboard-panel-order'

function loadOrder(): PanelId[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return [...PANEL_IDS]
    const parsed = JSON.parse(saved) as string[]
    const valid = parsed.filter((id): id is PanelId => (PANEL_IDS as readonly string[]).includes(id))
    const missing = PANEL_IDS.filter(id => !valid.includes(id))
    return [...valid, ...missing]
  } catch {
    return [...PANEL_IDS]
  }
}

export function usePanelOrder() {
  const [order, setOrder] = useState<PanelId[]>(loadOrder)

  function updateOrder(newOrder: PanelId[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder))
    setOrder(newOrder)
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY)
    setOrder([...PANEL_IDS])
  }

  return { order, updateOrder, reset }
}
