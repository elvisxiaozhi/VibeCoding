export type AssetCategory = 'stock' | 'etf' | 'crypto' | 'cash' | 'currency'

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  stock: '股票',
  etf: 'ETF',
  crypto: '加密货币',
  cash: '现金',
  currency: '货币',
}

export const CATEGORY_ORDER: AssetCategory[] = ['stock', 'etf', 'crypto', 'cash', 'currency']

export type CurrencyCode = 'CNY' | 'HKD' | 'USD' | 'BTC' | 'USDC' | 'USDT'

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  CNY: '人民币',
  HKD: '港币',
  USD: '美金',
  BTC: '比特币',
  USDC: 'USDC',
  USDT: 'USDT',
}

export const CURRENCY_CODES: CurrencyCode[] = ['CNY', 'HKD', 'USD', 'BTC', 'USDC', 'USDT']

export interface Asset {
  id: string
  symbol: string
  category: AssetCategory
  costBasis: number
  currentPrice: number
  quantity: number
  currency: string
  purchasedAt: string
  createdAt: string
  updatedAt: string
}
