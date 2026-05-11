import { isCashLikeCurrencyAsset, type Asset } from '@/lib/types'

export type AssetSubcategory =
  | 'cash_like'
  | 'provident_fund'
  | 'fixed_income'
  | 'fund'
  | 'stock'
  | 'gold'
  | 'crypto'

export const ASSET_SUBCATEGORY_LABELS: Record<AssetSubcategory, string> = {
  cash_like: '现金类',
  provident_fund: '公积金',
  fixed_income: '债券 / 固收',
  fund: 'ETF / 基金',
  stock: '股票',
  gold: '黄金',
  crypto: '加密货币',
}

export const ASSET_SUBCATEGORY_ORDER: AssetSubcategory[] = [
  'cash_like',
  'fixed_income',
  'fund',
  'stock',
  'gold',
  'crypto',
  'provident_fund',
]

const FIXED_INCOME_KEYWORDS = [
  '债',
  '短债',
  '中短债',
  '纯债',
  '固收',
  '丰禄',
  '鼎茂',
  '臻宝',
  '聚源',
  '崇元',
  '惠安',
  'BOXX',
  'SGOV',
  'TLT',
]

export function classifyAssetSubcategory(asset: Pick<Asset, 'category' | 'market' | 'symbol' | 'currency'>): AssetSubcategory {
  if (asset.category === 'provident_fund') return 'provident_fund'
  if (isCashLikeCurrencyAsset(asset)) return 'cash_like'
  if (asset.category === 'gold') return 'gold'
  if (asset.category === 'crypto') return 'crypto'
  if (asset.category === 'stock') return 'stock'

  if (asset.category === 'etf') {
    const symbol = asset.symbol.trim().toUpperCase()
    if (FIXED_INCOME_KEYWORDS.some((keyword) => symbol.includes(keyword.toUpperCase()))) {
      return 'fixed_income'
    }
    return 'fund'
  }

  return 'fund'
}
