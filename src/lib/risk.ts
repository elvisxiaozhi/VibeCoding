import { marketValue } from '@/lib/calc'
import { toCNY, type ExchangeRates } from '@/lib/currency'
import type { Asset, MarketType } from '@/lib/types'
import { CURRENCY_CODES, MARKET_ORDER } from '@/lib/types'

export type RiskSeverity = 'normal' | 'warning' | 'danger'

export interface ExposureItem {
  key: string
  label: string
  valueCNY: number
  ratio: number
  severity: RiskSeverity
  threshold?: number
  alert?: string
}

export interface ConcentrationItem {
  symbol: string
  valueCNY: number
  ratio: number
  severity: RiskSeverity
}

export interface RiskAlert {
  id: string
  severity: Exclude<RiskSeverity, 'normal'>
  message: string
}

export interface RiskExposure {
  currency: ExposureItem[]
  market: ExposureItem[]
  largestHolding: ConcentrationItem | null
  top5Holdings: ConcentrationItem[]
  top5Ratio: number
  top5Severity: RiskSeverity
  holdingCount: number
  alerts: RiskAlert[]
}

const MARKET_EXPOSURE_LABELS: Record<MarketType, string> = {
  cn: 'A股',
  hk: '港股',
  us: '美股',
  crypto: '加密',
  gold: '黄金',
}

const DEFAULT_CURRENCY_THRESHOLDS: Record<string, { warning: number; danger?: number }> = {
  CNY: { warning: 0.75 },
  USD: { warning: 0.6, danger: 0.75 },
  HKD: { warning: 0.5, danger: 0.65 },
  BTC: { warning: 0.25, danger: 0.4 },
  USDT: { warning: 0.25, danger: 0.4 },
  USDC: { warning: 0.25, danger: 0.4 },
}

const MARKET_THRESHOLDS: Record<MarketType, { warning: number; danger?: number }> = {
  cn: { warning: 0.6, danger: 0.75 },
  hk: { warning: 0.6, danger: 0.75 },
  us: { warning: 0.6, danger: 0.75 },
  crypto: { warning: 0.25, danger: 0.4 },
  gold: { warning: 0.3, danger: 0.45 },
}

const SINGLE_HOLDING_WARNING = 0.15
const SINGLE_HOLDING_DANGER = 0.25
const TOP5_WARNING = 0.6
const TOP5_DANGER = 0.75
const STABLECOIN_WARNING = 0.25
const STABLECOIN_DANGER = 0.4

function severityForRatio(
  ratio: number,
  warning: number,
  danger = Number.POSITIVE_INFINITY,
): RiskSeverity {
  if (ratio >= danger) return 'danger'
  if (ratio >= warning) return 'warning'
  return 'normal'
}

function formatRatio(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`
}

function holdingValueCNY(asset: Asset, rates: ExchangeRates): number {
  return toCNY(marketValue(asset), asset.currency, rates)
}

function pushAlert(
  alerts: RiskAlert[],
  id: string,
  severity: RiskSeverity,
  message: string,
) {
  if (severity === 'normal') return
  alerts.push({ id, severity, message })
}

export function calculateRiskExposure(
  holdings: Asset[],
  rates: ExchangeRates,
  totalValueCNY?: number,
): RiskExposure {
  const portfolioValue = totalValueCNY ?? holdings.reduce((sum, asset) => (
    sum + holdingValueCNY(asset, rates)
  ), 0)
  const alerts: RiskAlert[] = []

  const currencyValues = new Map<string, number>()
  const marketValues = new Map<MarketType, number>()
  const symbolValues = new Map<string, number>()

  for (const asset of holdings) {
    const valueCNY = holdingValueCNY(asset, rates)
    currencyValues.set(asset.currency, (currencyValues.get(asset.currency) ?? 0) + valueCNY)
    marketValues.set(asset.market, (marketValues.get(asset.market) ?? 0) + valueCNY)
    symbolValues.set(asset.symbol, (symbolValues.get(asset.symbol) ?? 0) + valueCNY)
  }

  const currencyOrder = [
    ...CURRENCY_CODES,
    ...[...currencyValues.keys()].filter((currency) => !CURRENCY_CODES.includes(currency as never)).sort(),
  ]
  const currency = currencyOrder
    .map((code) => {
      const valueCNY = currencyValues.get(code) ?? 0
      const ratio = portfolioValue === 0 ? 0 : valueCNY / portfolioValue
      const threshold = DEFAULT_CURRENCY_THRESHOLDS[code]
      const severity = threshold
        ? severityForRatio(ratio, threshold.warning, threshold.danger)
        : 'normal'
      const item: ExposureItem = {
        key: code,
        label: code,
        valueCNY,
        ratio,
        severity,
        threshold: threshold?.warning,
      }
      if (severity !== 'normal' && threshold) {
        item.alert = `${code} 暴露 ${formatRatio(ratio)}，超过 ${formatRatio(threshold.warning)} 阈值`
      }
      return item
    })
    .filter((item) => item.valueCNY > 0)

  for (const item of currency) {
    if (item.alert) pushAlert(alerts, `currency-${item.key}`, item.severity, item.alert)
  }

  const stablecoinValue = (currencyValues.get('USDT') ?? 0) + (currencyValues.get('USDC') ?? 0)
  const stablecoinRatio = portfolioValue === 0 ? 0 : stablecoinValue / portfolioValue
  const stablecoinSeverity = severityForRatio(stablecoinRatio, STABLECOIN_WARNING, STABLECOIN_DANGER)
  pushAlert(
    alerts,
    'currency-stablecoin',
    stablecoinSeverity,
    `稳定币暴露 ${formatRatio(stablecoinRatio)}，超过 ${formatRatio(STABLECOIN_WARNING)} 阈值`,
  )

  const market = MARKET_ORDER
    .map((marketKey) => {
      const valueCNY = marketValues.get(marketKey) ?? 0
      const ratio = portfolioValue === 0 ? 0 : valueCNY / portfolioValue
      const threshold = MARKET_THRESHOLDS[marketKey]
      const severity = severityForRatio(ratio, threshold.warning, threshold.danger)
      const item: ExposureItem = {
        key: marketKey,
        label: MARKET_EXPOSURE_LABELS[marketKey],
        valueCNY,
        ratio,
        severity,
        threshold: threshold.warning,
      }
      if (severity !== 'normal') {
        item.alert = `${item.label} 暴露 ${formatRatio(ratio)}，超过 ${formatRatio(threshold.warning)} 阈值`
      }
      return item
    })
    .filter((item) => item.valueCNY > 0)

  for (const item of market) {
    if (item.alert) pushAlert(alerts, `market-${item.key}`, item.severity, item.alert)
  }

  const holdingsBySymbol = [...symbolValues.entries()]
    .map(([symbol, valueCNY]) => {
      const ratio = portfolioValue === 0 ? 0 : valueCNY / portfolioValue
      return {
        symbol,
        valueCNY,
        ratio,
        severity: severityForRatio(ratio, SINGLE_HOLDING_WARNING, SINGLE_HOLDING_DANGER),
      }
    })
    .sort((a, b) => b.valueCNY - a.valueCNY)

  const largestHolding = holdingsBySymbol[0] ?? null
  if (largestHolding) {
    pushAlert(
      alerts,
      `holding-${largestHolding.symbol}`,
      largestHolding.severity,
      `${largestHolding.symbol} 单一标的占比 ${formatRatio(largestHolding.ratio)}，超过 ${formatRatio(SINGLE_HOLDING_WARNING)} 阈值`,
    )
  }

  const top5Holdings = holdingsBySymbol.slice(0, 5)
  const top5Value = top5Holdings.reduce((sum, item) => sum + item.valueCNY, 0)
  const top5Ratio = portfolioValue === 0 ? 0 : top5Value / portfolioValue
  const top5Severity = severityForRatio(top5Ratio, TOP5_WARNING, TOP5_DANGER)
  pushAlert(
    alerts,
    'holding-top5',
    top5Severity,
    `Top 5 持仓占比 ${formatRatio(top5Ratio)}，超过 ${formatRatio(TOP5_WARNING)} 阈值`,
  )

  return {
    currency,
    market,
    largestHolding,
    top5Holdings,
    top5Ratio,
    top5Severity,
    holdingCount: holdingsBySymbol.length,
    alerts,
  }
}
