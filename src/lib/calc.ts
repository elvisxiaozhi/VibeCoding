import type { Asset, AssetCategory } from '@/lib/types'
import { CATEGORY_ORDER } from '@/lib/types'

export const MIN_ANNUALIZED_HOLDING_DAYS = 90

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

/** 任意起止日期之间的天数（不强制最小值，用于已售资产持有期） */
export function daysBetween(start: string | Date, end: string | Date): number {
  const s = typeof start === 'string' ? new Date(start) : start
  const e = typeof end === 'string' ? new Date(end) : end
  const diffMs = e.getTime() - s.getTime()
  return Math.max(Math.floor(diffMs / (1000 * 60 * 60 * 24)), 0)
}

/** 持有天数格式化：< 365 → "X 天"；≥ 365 → "X 年 Y 天"（Y=0 时省略） */
export function formatHoldingDays(days: number): string {
  if (days < 365) return `${days} 天`
  const years = Math.floor(days / 365)
  const remDays = days - years * 365
  return remDays === 0 ? `${years} 年` : `${years} 年 ${remDays} 天`
}

/** 单条资产年化收益率（含分红）= ((1 + 总收益率) ^ (365 / 持有天数)) - 1 */
export function annualizedReturn(asset: Asset): number {
  const rate = pnlRate(asset)
  const days = holdingDays(asset)
  if (days <= 0) return 0
  return Math.pow(1 + rate, 365 / days) - 1
}

/** 单条资产年化收益率；持有不足阈值时不展示 */
export function annualizedReturnIfReady(asset: Asset, minDays = MIN_ANNUALIZED_HOLDING_DAYS): number | null {
  if (holdingDays(asset) < minDays) return null
  return annualizedReturn(asset)
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

/** 从 note 中解析 orig_qty:123.45 格式的原始份额 */
function parseOrigQty(note: string): number {
  const m = note.match(/orig_qty:([\d.]+)/)
  return m ? parseFloat(m[1]) : 0
}

function validDate(value: string): Date | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** XIRR 有效起点：当前持仓买入日 + 可成对识别的已清仓买入日中的最早日期 */
export function annualizedStartDate(buyLots: Asset[], consumedRecords: Asset[] = []): Date | null {
  const dates: Date[] = []

  for (const a of buyLots) {
    if (a.category === 'gold') continue
    const date = validDate(a.purchasedAt)
    if (date) dates.push(date)
  }

  for (const a of consumedRecords) {
    if (a.category === 'gold') continue
    if (parseOrigQty(a.note ?? '') <= 0) continue
    const date = validDate(a.purchasedAt)
    if (date) dates.push(date)
  }

  if (dates.length === 0) return null
  return dates.reduce((min, date) => (date.getTime() < min.getTime() ? date : min), dates[0])
}

/** 持有期达到阈值后才展示年化，避免短期收益被年化放大 */
export function hasMinimumAnnualizedHistory(
  buyLots: Asset[],
  consumedRecords: Asset[] = [],
  minDays = MIN_ANNUALIZED_HOLDING_DAYS,
): boolean {
  const start = annualizedStartDate(buyLots, consumedRecords)
  if (!start) return false
  const diffMs = Date.now() - start.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return days >= minDays
}

/** (currency, date) → 1 单位 currency 等于多少 CNY 的查询函数 */
export type FXRateLookup = (currency: string, date: Date) => number

/**
 * 计算一组资产记录的年化收益率 — 全部使用 XIRR
 *
 * 现金流构建规则：
 * - 活跃买入、分红、当前总市值：始终纳入
 * - 已清仓买入（仅当 note 含 orig_qty）+ 卖出：仅在有 orig_qty 时成对纳入
 *   （否则卖出是没有对应买入流出的"无主"流入，会严重高估 XIRR）
 * - 黄金类资产（实物黄金无法回溯买入日期）整体从 XIRR 排除
 *
 * 多币种处理：每条 cashflow 用「事件发生日的 CNY 汇率」换算成 CNY 后再做 XIRR，
 * 这样持有期内的汇率波动也作为收益的一部分。getRate 由调用方注入；缺省 1 等价于
 * 「假设所有币种 = CNY」，仅用于无外汇环境的兜底。
 */
export function holdingsXIRR(
  buyLots: Asset[],
  divRecords: Asset[] = [],
  consumedRecords: Asset[] = [],
  sellRecords: Asset[] = [],
  getRate: FXRateLookup = () => 1,
): number {
  const eligible = (a: Asset) => a.category !== 'gold'
  buyLots = buyLots.filter(eligible)
  divRecords = divRecords.filter(eligible)
  consumedRecords = consumedRecords.filter(eligible)
  sellRecords = sellRecords.filter(eligible)

  if (buyLots.length === 0 && consumedRecords.length === 0) return 0

  const validConsumed = consumedRecords.filter((a) => parseOrigQty(a.note ?? '') > 0)
  const includeHistorical = validConsumed.length > 0

  const cashflows: Cashflow[] = []

  // 活跃持仓买入 = 资金流出（负），按买入日汇率换算
  for (const a of buyLots) {
    const date = new Date(a.purchasedAt)
    const rate = getRate(a.currency, date)
    if (rate <= 0) continue
    cashflows.push({
      amount: -(a.costBasis * a.quantity) * rate,
      date,
    })
  }

  // 分红 = 资金流入（正），按派息日汇率换算
  for (const a of divRecords) {
    const div = a.dividends ?? 0
    if (div <= 0) continue
    const date = new Date(a.purchasedAt)
    const rate = getRate(a.currency, date)
    if (rate <= 0) continue
    cashflows.push({
      amount: div * rate,
      date,
    })
  }

  // 已清仓买入 + 卖出仅在有原始份额数据时成对纳入
  if (includeHistorical) {
    for (const a of validConsumed) {
      const origQty = parseOrigQty(a.note ?? '')
      const date = new Date(a.purchasedAt)
      const rate = getRate(a.currency, date)
      if (rate <= 0) continue
      cashflows.push({
        amount: -(a.costBasis * origQty) * rate,
        date,
      })
    }
    for (const a of sellRecords) {
      const date = new Date(a.purchasedAt)
      const rate = getRate(a.currency, date)
      if (rate <= 0) continue
      cashflows.push({
        amount: a.currentPrice * Math.abs(a.quantity) * rate,
        date,
      })
    }
  }

  // 当前总市值 = 资金流入（正），日期为今天，用今日汇率换算
  const today = new Date()
  let totalMV_CNY = 0
  for (const a of buyLots) {
    const rate = getRate(a.currency, today)
    if (rate <= 0) continue
    totalMV_CNY += a.currentPrice * a.quantity * rate
  }
  if (totalMV_CNY > 0) {
    cashflows.push({
      amount: totalMV_CNY,
      date: today,
    })
  }

  if (cashflows.length < 2) return 0
  return xirrRate(cashflows)
}

/** 组合年化收益率 — XIRR（含分红） */
export function totalAnnualizedReturn(
  assets: Asset[],
  _extraDividends = 0,
  divRecords: Asset[] = [],
  getRate: FXRateLookup = () => 1,
): number {
  if (assets.length === 0) return 0
  return holdingsXIRR(assets, divRecords, [], [], getRate)
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
