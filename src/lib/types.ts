export type AssetCategory = 'stock' | 'etf' | 'gold' | 'crypto' | 'cash' | 'currency'

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  stock: '股票',
  etf: 'ETF',
  gold: '黄金',
  crypto: '加密货币',
  cash: '现金',
  currency: '货币',
}

export const CATEGORY_ORDER: AssetCategory[] = ['stock', 'etf', 'gold', 'crypto', 'cash', 'currency']

export type MarketType = 'cn' | 'hk' | 'us' | 'crypto' | 'gold'

export const MARKET_LABELS: Record<MarketType, string> = {
  cn: '人民币资产',
  hk: '港股资产',
  us: '美股资产',
  crypto: '加密货币资产',
  gold: '黄金资产',
}

export const MARKET_ORDER: MarketType[] = ['cn', 'hk', 'us', 'crypto', 'gold']

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

export type OwnerType = 'me' | 'wife'

export const OWNER_LABELS: Record<OwnerType, string> = {
  me: '我的',
  wife: '老婆的',
}

export const OWNER_OPTIONS: OwnerType[] = ['me', 'wife']

export interface ClearedAsset {
  symbol: string
  category: AssetCategory
  market: MarketType
  currency: string
  totalCost: number
  totalProceeds: number
  totalDividends: number
  pnl: number
  firstBuyDate: string
  lastSellDate: string
}

export interface Asset {
  id: string
  symbol: string
  category: AssetCategory
  market: MarketType
  costBasis: number
  currentPrice: number
  quantity: number
  currency: string
  dividends: number
  owner: OwnerType
  note: string
  purchasedAt: string
  createdAt: string
  updatedAt: string
}

export type SnapshotDimension = 'market' | 'currency' | 'owner'

export interface PortfolioSnapshotBreakdown {
  dimension: SnapshotDimension
  key: string
  label: string
  valueCNY: number
  costCNY: number
  pnlCNY: number
  ratio: number
}

export interface PortfolioSnapshot {
  id: string
  snapshotDate: string
  totalValueCNY: number
  totalCostCNY: number
  totalPnLCNY: number
  totalDividendCNY: number
  assetCount: number
  breakdowns?: PortfolioSnapshotBreakdown[]
  assets?: Asset[]
  rates?: Record<string, number>
  createdAt: string
  updatedAt: string
}
