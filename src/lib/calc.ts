import type { Asset, AssetCategory } from '@/lib/types'
import { CATEGORY_ORDER } from '@/lib/types'

/** 单条资产市值 = 现价 × 数量 */
export function marketValue(asset: Asset): number {
  return asset.currentPrice * asset.quantity
}

/** 单条资产成本 = 成本价 × 数量 */
export function costValue(asset: Asset): number {
  return asset.costBasis * asset.quantity
}

/** 单条资产盈亏额 = 市值 - 成本 */
export function pnlValue(asset: Asset): number {
  return marketValue(asset) - costValue(asset)
}

/** 单条资产盈亏率 = 盈亏额 / 成本；成本为 0 返回 0 */
export function pnlRate(asset: Asset): number {
  const cost = costValue(asset)
  return cost === 0 ? 0 : pnlValue(asset) / cost
}

/** 组合总市值 */
export function totalMarketValue(assets: Asset[]): number {
  return assets.reduce((sum, a) => sum + marketValue(a), 0)
}

/** 组合总成本 */
export function totalCostValue(assets: Asset[]): number {
  return assets.reduce((sum, a) => sum + costValue(a), 0)
}

/** 组合总盈亏额 */
export function totalPnLValue(assets: Asset[]): number {
  return totalMarketValue(assets) - totalCostValue(assets)
}

/** 组合总盈亏率 */
export function totalPnLRate(assets: Asset[]): number {
  const cost = totalCostValue(assets)
  return cost === 0 ? 0 : totalPnLValue(assets) / cost
}

export interface CategoryBreakdownItem {
  category: AssetCategory
  value: number
  /** 0 ~ 1 之间的占比 */
  ratio: number
}

/** 按分类汇总市值及占比，始终返回全部 4 个分类（顺序固定） */
export function categoryBreakdown(assets: Asset[]): CategoryBreakdownItem[] {
  const total = totalMarketValue(assets)
  const bucket = new Map<AssetCategory, number>()
  for (const c of CATEGORY_ORDER) bucket.set(c, 0)
  for (const a of assets) {
    bucket.set(a.category, (bucket.get(a.category) ?? 0) + marketValue(a))
  }
  return CATEGORY_ORDER.map((category) => {
    const value = bucket.get(category) ?? 0
    return {
      category,
      value,
      ratio: total === 0 ? 0 : value / total,
    }
  })
}
