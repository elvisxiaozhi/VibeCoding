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

/** 单条资产分红 */
export function dividendValue(asset: Asset): number {
  return asset.dividends ?? 0
}

/** 单条资产盈亏额 = 市值 - 成本 + 分红 */
export function pnlValue(asset: Asset): number {
  return marketValue(asset) - costValue(asset) + dividendValue(asset)
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

/** 组合总分红 */
export function totalDividendValue(assets: Asset[]): number {
  return assets.reduce((sum, a) => sum + dividendValue(a), 0)
}

/** 组合总盈亏额 = 总市值 - 总成本 + 总分红 */
export function totalPnLValue(assets: Asset[]): number {
  return totalMarketValue(assets) - totalCostValue(assets) + totalDividendValue(assets)
}

/** 组合总盈亏率 */
export function totalPnLRate(assets: Asset[]): number {
  const cost = totalCostValue(assets)
  return cost === 0 ? 0 : totalPnLValue(assets) / cost
}

/** 单条资产持有天数 */
export function holdingDays(asset: Asset): number {
  const purchased = new Date(asset.purchasedAt)
  const today = new Date()
  const diffMs = today.getTime() - purchased.getTime()
  return Math.max(Math.floor(diffMs / (1000 * 60 * 60 * 24)), 1)
}

/** 单条资产年化收益率（含分红）= ((1 + 总收益率) ^ (365 / 持有天数)) - 1 */
export function annualizedReturn(asset: Asset): number {
  const rate = pnlRate(asset)
  const days = holdingDays(asset)
  if (days <= 0) return 0
  return Math.pow(1 + rate, 365 / days) - 1
}

/** 单笔现金流 */
interface Cashflow {
  amount: number  // 负 = 流出（买入），正 = 流入（卖出/分红/当前市值）
  date: Date
}

/**
 * XIRR：用 Newton-Raphson 求使 NPV=0 的年化收益率
 * NPV = Σ CF_i / (1 + r)^((d_i - d_0) / 365)
 */
export function xirrRate(cashflows: Cashflow[], guess = 0.1): number {
  if (cashflows.length < 2) return 0

  const sorted = [...cashflows].sort((a, b) => a.date.getTime() - b.date.getTime())
  const d0 = sorted[0].date.getTime()
  const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000

  function npv(r: number): number {
    let sum = 0
    for (const cf of sorted) {
      const years = (cf.date.getTime() - d0) / MS_PER_YEAR
      sum += cf.amount / Math.pow(1 + r, years)
    }
    return sum
  }

  function dnpv(r: number): number {
    let sum = 0
    for (const cf of sorted) {
      const years = (cf.date.getTime() - d0) / MS_PER_YEAR
      sum -= years * cf.amount / Math.pow(1 + r, years + 1)
    }
    return sum
  }

  let rate = guess
  for (let i = 0; i < 200; i++) {
    const f = npv(rate)
    if (Math.abs(f) < 1e-6) return rate
    const df = dnpv(rate)
    if (Math.abs(df) < 1e-12) break
    let next = rate - f / df
    // 防止发散
    if (next < -0.99) next = (rate - 0.99) / 2
    if (next > 10) next = (rate + 10) / 2
    rate = next
  }
  return rate
}

/**
 * 基于 XIRR 计算一组持仓 + 分红记录的年化收益率
 * @param buyLots 持仓记录（qty > 0）
 * @param divRecords 分红记录（qty = 0, div > 0），可选
 */
export function holdingsXIRR(buyLots: Asset[], divRecords: Asset[] = []): number {
  if (buyLots.length === 0) return 0

  const cashflows: Cashflow[] = []

  // 买入 = 资金流出（负）
  for (const a of buyLots) {
    cashflows.push({
      amount: -(a.costBasis * a.quantity),
      date: new Date(a.purchasedAt),
    })
  }

  // 分红 = 资金流入（正）
  for (const a of divRecords) {
    const div = a.dividends ?? 0
    if (div > 0) {
      cashflows.push({
        amount: div,
        date: new Date(a.purchasedAt),
      })
    }
  }

  // 当前总市值 = 资金流入（正），日期为今天
  const totalMV = buyLots.reduce((s, a) => s + a.currentPrice * a.quantity, 0)
  cashflows.push({
    amount: totalMV,
    date: new Date(),
  })

  return xirrRate(cashflows)
}

/** 组合年化收益率 — XIRR（含分红） */
export function totalAnnualizedReturn(assets: Asset[], _extraDividends = 0, divRecords: Asset[] = []): number {
  if (assets.length === 0) return 0
  return holdingsXIRR(assets, divRecords)
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
