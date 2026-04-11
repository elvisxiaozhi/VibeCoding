export type AssetCategory = 'stock' | 'etf' | 'crypto' | 'cash'

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  stock: '股票',
  etf: 'ETF',
  crypto: '加密货币',
  cash: '现金',
}

export const CATEGORY_ORDER: AssetCategory[] = ['stock', 'etf', 'crypto', 'cash']

export interface Asset {
  id: string
  symbol: string
  category: AssetCategory
  costBasis: number
  currentPrice: number
  quantity: number
  currency: string
  createdAt: string
  updatedAt: string
}
