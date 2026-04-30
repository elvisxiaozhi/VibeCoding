import { costValue, dividendValue, marketValue, type FXRateLookup } from '@/lib/calc'
import { toCNY, type ExchangeRates } from '@/lib/currency'
import type { Asset } from '@/lib/types'
import { CATEGORY_LABELS, CATEGORY_ORDER, CURRENCY_CODES, CURRENCY_LABELS, MARKET_LABELS, MARKET_ORDER } from '@/lib/types'

export type AttributionGroupBy = 'asset' | 'category' | 'currency' | 'market'

export interface ReturnAttributionTotals {
  costCNY: number
  marketValueCNY: number
  priceReturnCNY: number
  dividendReturnCNY: number
  fxReturnCNY: number
  realizedReturnCNY: number
  unrealizedReturnCNY: number
  totalReturnCNY: number
}

export interface ReturnAttributionItem extends ReturnAttributionTotals {
  key: string
  label: string
  contributionRatio: number
}

export interface ReturnAttribution {
  totals: ReturnAttributionTotals
  byAsset: ReturnAttributionItem[]
  byCategory: ReturnAttributionItem[]
  byCurrency: ReturnAttributionItem[]
  byMarket: ReturnAttributionItem[]
  usedHistoricalRates: boolean
}

function zeroTotals(): ReturnAttributionTotals {
  return {
    costCNY: 0,
    marketValueCNY: 0,
    priceReturnCNY: 0,
    dividendReturnCNY: 0,
    fxReturnCNY: 0,
    realizedReturnCNY: 0,
    unrealizedReturnCNY: 0,
    totalReturnCNY: 0,
  }
}

function addTotals(target: ReturnAttributionTotals, source: ReturnAttributionTotals) {
  target.costCNY += source.costCNY
  target.marketValueCNY += source.marketValueCNY
  target.priceReturnCNY += source.priceReturnCNY
  target.dividendReturnCNY += source.dividendReturnCNY
  target.fxReturnCNY += source.fxReturnCNY
  target.realizedReturnCNY += source.realizedReturnCNY
  target.unrealizedReturnCNY += source.unrealizedReturnCNY
  target.totalReturnCNY += source.totalReturnCNY
}

function currentCNYRate(currency: string, rates: ExchangeRates): number {
  return toCNY(1, currency, rates)
}

function validDate(value: string): Date | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function historicalCNYRate(
  asset: Asset,
  rates: ExchangeRates,
  getRate: FXRateLookup,
): { rate: number; historical: boolean } {
  if (asset.currency === 'CNY') return { rate: 1, historical: true }

  const date = validDate(asset.purchasedAt)
  const rate = date ? getRate(asset.currency, date) : 0
  if (rate > 0) return { rate, historical: true }

  return { rate: currentCNYRate(asset.currency, rates), historical: false }
}

function contributionRatio(value: number, total: number): number {
  return total === 0 ? 0 : value / total
}

function toItems(
  map: Map<string, ReturnAttributionTotals>,
  labels: Map<string, string>,
  totalReturnCNY: number,
  order: string[] = [],
): ReturnAttributionItem[] {
  const orderedKeys = [
    ...order.filter((key) => map.has(key)),
    ...[...map.keys()].filter((key) => !order.includes(key)).sort((a, b) => a.localeCompare(b, 'zh-CN')),
  ]

  return orderedKeys
    .map((key) => {
      const totals = map.get(key) ?? zeroTotals()
      return {
        key,
        label: labels.get(key) ?? key,
        ...totals,
        contributionRatio: contributionRatio(totals.totalReturnCNY, totalReturnCNY),
      }
    })
    .filter((item) => (
      item.costCNY !== 0
      || item.marketValueCNY !== 0
      || item.totalReturnCNY !== 0
      || item.dividendReturnCNY !== 0
      || item.realizedReturnCNY !== 0
    ))
    .sort((a, b) => Math.abs(b.totalReturnCNY) - Math.abs(a.totalReturnCNY))
}

function addToBucket(
  map: Map<string, ReturnAttributionTotals>,
  key: string,
  totals: ReturnAttributionTotals,
) {
  if (!map.has(key)) map.set(key, zeroTotals())
  addTotals(map.get(key)!, totals)
}

export function calculateReturnAttribution(
  holdings: Asset[],
  dividendRecords: Asset[],
  sellRecords: Asset[],
  rates: ExchangeRates,
  getRate: FXRateLookup,
): ReturnAttribution {
  const totals = zeroTotals()
  const byAsset = new Map<string, ReturnAttributionTotals>()
  const byCategory = new Map<string, ReturnAttributionTotals>()
  const byCurrency = new Map<string, ReturnAttributionTotals>()
  const byMarket = new Map<string, ReturnAttributionTotals>()
  const labels = new Map<string, string>()
  let usedHistoricalRates = true

  function addAssetAttribution(asset: Asset, itemTotals: ReturnAttributionTotals) {
    labels.set(asset.symbol, asset.symbol)
    addToBucket(byAsset, asset.symbol, itemTotals)
    addToBucket(byCategory, asset.category, itemTotals)
    addToBucket(byCurrency, asset.currency, itemTotals)
    addToBucket(byMarket, asset.market, itemTotals)
    addTotals(totals, itemTotals)
  }

  for (const asset of holdings) {
    const purchase = historicalCNYRate(asset, rates, getRate)
    const currentRate = currentCNYRate(asset.currency, rates)
    if (!purchase.historical) usedHistoricalRates = false

    const costCNY = costValue(asset) * purchase.rate
    const marketValueCNY = marketValue(asset) * currentRate
    const priceReturnCNY = (asset.currentPrice - asset.costBasis) * asset.quantity * purchase.rate
    const fxReturnCNY = asset.currentPrice * asset.quantity * (currentRate - purchase.rate)
    const unrealizedReturnCNY = priceReturnCNY + fxReturnCNY

    addAssetAttribution(asset, {
      costCNY,
      marketValueCNY,
      priceReturnCNY,
      dividendReturnCNY: 0,
      fxReturnCNY,
      realizedReturnCNY: 0,
      unrealizedReturnCNY,
      totalReturnCNY: unrealizedReturnCNY,
    })
  }

  for (const asset of dividendRecords) {
    const dividend = dividendValue(asset)
    if (dividend === 0) continue
    const purchase = historicalCNYRate(asset, rates, getRate)
    if (!purchase.historical) usedHistoricalRates = false
    const dividendReturnCNY = dividend * purchase.rate

    addAssetAttribution(asset, {
      ...zeroTotals(),
      dividendReturnCNY,
      totalReturnCNY: dividendReturnCNY,
    })
  }

  for (const asset of sellRecords) {
    const quantity = Math.abs(asset.quantity)
    if (quantity === 0) continue
    const sale = historicalCNYRate(asset, rates, getRate)
    if (!sale.historical) usedHistoricalRates = false
    const realizedReturnCNY = (asset.currentPrice - asset.costBasis) * quantity * sale.rate

    addAssetAttribution(asset, {
      ...zeroTotals(),
      realizedReturnCNY,
      totalReturnCNY: realizedReturnCNY,
    })
  }

  const categoryLabels = new Map(CATEGORY_ORDER.map((category) => [category, CATEGORY_LABELS[category]]))
  const currencyLabels = new Map(CURRENCY_CODES.map((currency) => [currency, CURRENCY_LABELS[currency]]))
  const marketLabels = new Map(MARKET_ORDER.map((market) => [market, MARKET_LABELS[market]]))

  return {
    totals,
    byAsset: toItems(byAsset, labels, totals.totalReturnCNY),
    byCategory: toItems(byCategory, categoryLabels as Map<string, string>, totals.totalReturnCNY, CATEGORY_ORDER),
    byCurrency: toItems(byCurrency, currencyLabels as Map<string, string>, totals.totalReturnCNY, CURRENCY_CODES),
    byMarket: toItems(byMarket, marketLabels as Map<string, string>, totals.totalReturnCNY, MARKET_ORDER),
    usedHistoricalRates,
  }
}

export function groupLabel(groupBy: AttributionGroupBy): string {
  if (groupBy === 'asset') return '资产'
  if (groupBy === 'category') return '板块'
  if (groupBy === 'currency') return '币种'
  return '市场'
}
