import { xirrRate, type Cashflow, type FXRateLookup } from '@/lib/calc'
import { BENCHMARKS, type BenchmarkPrice, type CurrencyCode } from '@/lib/types'

/**
 * 基准对照（dollar-matched benchmark）：把组合真实的每一笔现金流（买入流出、
 * 分红/卖出流入）原封不动地"假装"投进基准指数，用相同时点、相同金额，算出基准组合
 * 的期末值，再跑同一个 XIRR。这样组合年化与基准年化用的是完全相同的资金时点，可比。
 *
 * 标普500 用 USD 计价：投入时按当日历史汇率折 USD 买份额，期末按今日汇率折回 CNY，
 * 因此对照自动包含汇率收益/损失，与组合 XIRR 的口径一致。
 */

export interface BenchmarkComparison {
  symbol: string
  label: string
  /** 对照组合 XIRR；数据缺失（无日线 / 缺汇率）时为 null */
  value: number | null
}

/** 二分查找：序列中日期 <= target 的最后一条下标（序列按日期升序） */
function lastIndexLE(series: BenchmarkPrice[], target: string): number {
  let lo = 0
  let hi = series.length - 1
  let result = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (series[mid].date <= target) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return result
}

/** 构建「某日期 → 指数 CNY 价」查询：取最近交易日收盘 × 当日汇率 */
function makeBenchmarkPriceLookup(
  series: BenchmarkPrice[],
  currency: CurrencyCode,
  getRate: FXRateLookup,
): (date: Date) => number {
  return (date: Date) => {
    const target = date.toISOString().slice(0, 10)
    const idx = lastIndexLE(series, target)
    // 早于首个交易日的现金流退到首条收盘（尽力而为）
    const close = idx >= 0 ? series[idx].close : series[0]?.close ?? 0
    if (close <= 0) return 0
    const fx = getRate(currency, date)
    if (fx <= 0) return 0
    return close * fx
  }
}

/**
 * 用组合现金流在某基准上模拟份额，得到基准对照 XIRR。
 * 任意现金流日缺价 / 缺汇率即返回 null，避免给出失真数字。
 */
export function benchmarkXIRR(
  contributions: Cashflow[],
  terminalDate: Date,
  priceCNYAt: (date: Date) => number,
): number | null {
  if (contributions.length === 0) return null

  let units = 0
  for (const cf of contributions) {
    const price = priceCNYAt(cf.date)
    if (price <= 0) return null
    // 买入（amount 负）→ 加仓；分红/卖出（amount 正）→ 减仓
    units += -cf.amount / price
  }

  const terminalPrice = priceCNYAt(terminalDate)
  if (terminalPrice <= 0) return null
  const terminalValue = units * terminalPrice
  if (terminalValue <= 0) return null

  const flows: Cashflow[] = [...contributions, { amount: terminalValue, date: terminalDate }]
  if (flows.length < 2) return null
  const rate = xirrRate(flows)
  // xirrRate 对无解现金流返回 NaN，对照展示时降级为「暂无数据」
  return Number.isFinite(rate) ? rate : null
}

/** 对所有基准计算对照组合 XIRR */
export function computeBenchmarkReturns(
  contributions: Cashflow[],
  terminalDate: Date,
  getSeries: (symbol: string) => BenchmarkPrice[],
  getRate: FXRateLookup,
): BenchmarkComparison[] {
  return BENCHMARKS.map((b) => {
    const series = getSeries(b.symbol)
    if (series.length === 0) return { symbol: b.symbol, label: b.label, value: null }
    const priceCNYAt = makeBenchmarkPriceLookup(series, b.currency, getRate)
    return {
      symbol: b.symbol,
      label: b.label,
      value: benchmarkXIRR(contributions, terminalDate, priceCNYAt),
    }
  })
}
