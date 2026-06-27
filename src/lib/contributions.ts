import type { Asset } from './types'
import type { ExchangeRates } from './currency'
import { toCNY } from './currency'
import type { PortfolioSnapshot } from './types'

export type ContributionPeriod = 'month' | 'year' | 'inception'

export interface ContributionBreakdown {
  netContributed: number
  marketGain: number
  totalGrowth: number
  currentValueCNY: number
  startValueCNY: number
  hasBaseline: boolean
}

function periodStart(period: ContributionPeriod): Date {
  const now = new Date()
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
  if (period === 'year') return new Date(now.getFullYear(), 0, 1)
  return new Date(0)
}

function findBaselineSnapshot(snapshots: PortfolioSnapshot[], cutoff: Date): PortfolioSnapshot | null {
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const candidates = snapshots.filter((s) => s.snapshotDate < cutoffStr)
  if (candidates.length === 0) return null
  return candidates[candidates.length - 1]
}

export function calcContributionBreakdown(
  period: ContributionPeriod,
  assets: Asset[],
  snapshots: PortfolioSnapshot[],
  rates: ExchangeRates,
  currentValueCNY: number,
  currentDividendCNY: number,
): ContributionBreakdown {
  if (period === 'inception') {
    // 全部买入成本 - 卖出收回 = 净投入
    let netContributed = 0
    for (const a of assets) {
      if (a.quantity > 0) {
        netContributed += toCNY(a.costBasis * a.quantity, a.currency, rates)
      } else if (a.quantity < 0) {
        netContributed -= toCNY(a.currentPrice * Math.abs(a.quantity), a.currency, rates)
      }
    }
    const marketGain = currentValueCNY + currentDividendCNY - netContributed
    return {
      netContributed,
      marketGain,
      totalGrowth: marketGain,
      currentValueCNY,
      startValueCNY: 0,
      hasBaseline: true,
    }
  }

  const start = periodStart(period)
  const startStr = start.toISOString().slice(0, 10)
  const baseline = findBaselineSnapshot(snapshots, start)

  // 期间内的净买入（买入成本 - 卖出收益），按当前汇率折算 CNY
  let netContributedInPeriod = 0
  let dividendsInPeriod = 0
  for (const a of assets) {
    const recordDate = (a.purchasedAt ?? '').slice(0, 10)
    if (recordDate < startStr) continue
    if (a.quantity > 0) {
      netContributedInPeriod += toCNY(a.costBasis * a.quantity, a.currency, rates)
    } else if (a.quantity < 0) {
      netContributedInPeriod -= toCNY(a.currentPrice * Math.abs(a.quantity), a.currency, rates)
    } else if ((a.dividends ?? 0) > 0) {
      dividendsInPeriod += toCNY(a.dividends ?? 0, a.currency, rates)
    }
  }

  const startValueCNY = baseline?.totalValueCNY ?? 0
  const startDividendCNY = baseline?.totalDividendCNY ?? 0
  const dividendGainInPeriod = currentDividendCNY - startDividendCNY - dividendsInPeriod
  const valueGain = currentValueCNY - startValueCNY
  const marketGain = valueGain - netContributedInPeriod + dividendsInPeriod + dividendGainInPeriod
  const totalGrowth = valueGain + dividendsInPeriod + dividendGainInPeriod

  return {
    netContributed: netContributedInPeriod,
    marketGain,
    totalGrowth,
    currentValueCNY,
    startValueCNY,
    hasBaseline: baseline !== null,
  }
}
