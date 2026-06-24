import { ASSET_SUBCATEGORY_LABELS, ASSET_SUBCATEGORY_ORDER, classifyAssetSubcategory } from '@/lib/assetClassification'
import type { Asset } from '@/lib/types'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CURRENCY_CODES,
  CURRENCY_LABELS,
  MARKET_LABELS,
  MARKET_ORDER,
  OWNER_LABELS,
  OWNER_OPTIONS,
  isCashLikeCurrencyAsset,
} from '@/lib/types'

export type StructureView = 'category' | 'subcategory' | 'market' | 'currency' | 'owner'

export interface StructureItem {
  key: string
  label: string
  value: number
  ratio: number
  color: string
}

type MarketStructureKey = (typeof MARKET_ORDER)[number] | 'cash' | 'provident_fund'

const MARKET_STRUCTURE_LABELS: Record<MarketStructureKey, string> = {
  ...MARKET_LABELS,
  cash: '现金',
  provident_fund: '公积金',
}

export const STRUCTURE_COLORS = ['#60a5fa', '#f97316', '#22c55e', '#e879f9', '#facc15', '#38bdf8']

export const STRUCTURE_VIEWS: { key: StructureView; label: string }[] = [
  { key: 'category', label: '分类' },
  { key: 'subcategory', label: '细分' },
  { key: 'market', label: '市场' },
  { key: 'currency', label: '币种' },
  { key: 'owner', label: '归属' },
]

/**
 * 按指定维度把持仓聚合为占比明细。返回该维度下的全部定义项（含 value=0 的项），
 * 调用方按需 `.filter(i => i.value > 0)`（结构展示）或保留全部（再平衡对账）。
 */
export function buildItems(
  holdings: Asset[],
  totalValueCNY: number,
  assetValueCNY: (asset: Asset) => number,
  view: StructureView,
): StructureItem[] {
  const definitions =
    view === 'category'
      ? CATEGORY_ORDER.map((key) => ({ key, label: CATEGORY_LABELS[key] }))
      : view === 'subcategory'
        ? ASSET_SUBCATEGORY_ORDER.map((key) => ({ key, label: ASSET_SUBCATEGORY_LABELS[key] }))
      : view === 'market'
        ? ([...MARKET_ORDER, 'cash', 'provident_fund'] as MarketStructureKey[]).map((key) => ({ key, label: MARKET_STRUCTURE_LABELS[key] }))
        : view === 'currency'
          ? CURRENCY_CODES.map((key) => ({ key, label: CURRENCY_LABELS[key] }))
          : OWNER_OPTIONS.map((key) => ({ key, label: OWNER_LABELS[key] }))

  const bucket = new Map<string, number>()
  for (const item of definitions) bucket.set(item.key, 0)

  for (const asset of holdings) {
    const key =
      view === 'category'
        ? asset.category
        : view === 'subcategory'
          ? classifyAssetSubcategory(asset)
        : view === 'market'
          ? asset.category === 'provident_fund'
            ? 'provident_fund'
            : isCashLikeCurrencyAsset(asset)
              ? 'cash'
              : asset.market
          : view === 'currency'
            ? asset.currency
            : asset.owner
    bucket.set(key, (bucket.get(key) ?? 0) + assetValueCNY(asset))
  }

  return definitions.map((item, index) => {
    const value = bucket.get(item.key) ?? 0
    return {
      ...item,
      value,
      ratio: totalValueCNY === 0 ? 0 : value / totalValueCNY,
      color: STRUCTURE_COLORS[index % STRUCTURE_COLORS.length],
    }
  })
}
