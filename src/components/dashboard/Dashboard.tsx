import {
  Calendar,
  DollarSign,
  Eye,
  Loader2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart'
import { RiskExposurePanel } from '@/components/dashboard/RiskExposurePanel'
import { ReturnAttributionPanel } from '@/components/dashboard/ReturnAttributionPanel'
import { StatCard } from '@/components/dashboard/StatCard'
import { useAssets } from '@/hooks/useAssets'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { useHistoricalRates } from '@/hooks/useHistoricalRates'
import { calculateReturnAttribution } from '@/lib/attribution'
import { type CategoryBreakdownItem, costValue, dividendValue, hasMinimumAnnualizedHistory, holdingsXIRR, marketValue, totalCostValue, totalMarketValue, totalPnLValue } from '@/lib/calc'
import { formatMoney, toCNY } from '@/lib/currency'
import { calculateRiskExposure } from '@/lib/risk'
import type { Asset, AssetCategory, MarketType, OwnerType } from '@/lib/types'
import { CATEGORY_LABELS, CATEGORY_ORDER, MARKET_LABELS, MARKET_ORDER } from '@/lib/types'

function formatCNY(n: number): string {
  return formatMoney(n, 'CNY')
}

function formatPercent(n: number): string {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
}

interface DashboardProps {
  isLoggedIn: boolean
  ownerFilter?: OwnerType
}

/** 计算资产的人民币市值 */
function assetMVInCNY(a: Asset, rates: Record<string, number>): number {
  return toCNY(marketValue(a), a.currency, rates)
}

/** 计算资产的人民币成本 */
function assetCostInCNY(a: Asset, rates: Record<string, number>): number {
  return toCNY(costValue(a), a.currency, rates)
}

export function Dashboard({ isLoggedIn, ownerFilter }: DashboardProps) {
  const { assets, loading } = useAssets(isLoggedIn, ownerFilter)
  const { rates } = useExchangeRates()
  const { getRate: getHistRate, loading: histLoading } = useHistoricalRates(assets)

  // 只统计持仓（qty > 0），排除卖出和分红记录
  const holdings = assets.filter((a) => a.quantity > 0)
  // 分红记录（qty = 0, dividends > 0）
  const divRecords = assets.filter((a) => a.quantity === 0 && (a.dividends ?? 0) > 0)
  // 已清仓买入记录（qty = 0, div = 0, note 含 orig_qty）
  const consumedRecords = assets.filter((a) => a.quantity === 0 && (a.dividends ?? 0) === 0 && (a.note ?? '').includes('orig_qty:'))
  // 卖出记录（qty < 0）
  const sellRecords = assets.filter((a) => a.quantity < 0)

  // 汇率换算后的总值（人民币），含分红
  const totalValueCNY = holdings.reduce((s, a) => s + assetMVInCNY(a, rates), 0)
  const totalCostCNY = holdings.reduce((s, a) => s + assetCostInCNY(a, rates), 0)
  const totalDivCNY = divRecords.reduce((s, a) => s + toCNY(dividendValue(a), a.currency, rates), 0)
  const totalPnLCNY = totalValueCNY - totalCostCNY + totalDivCNY

  const pnlPercent = totalCostCNY === 0 ? 0 : totalPnLCNY / totalCostCNY
  const pnlVariant = totalPnLCNY >= 0 ? 'profit' : 'loss'
  // 历史汇率未到位前不计算 XIRR，避免缺率时出现失真数字
  const annReturn: number | null = histLoading || !hasMinimumAnnualizedHistory(holdings, consumedRecords)
    ? null
    : holdingsXIRR(holdings, divRecords, consumedRecords, sellRecords, getHistRate)
  const annVariant = annReturn !== null && annReturn >= 0 ? 'profit' : 'loss'

  // 按分类汇总（人民币换算）
  const categoryBreakdownCNY: CategoryBreakdownItem[] = (() => {
    const bucket = new Map<AssetCategory, number>()
    for (const c of CATEGORY_ORDER) bucket.set(c, 0)
    for (const a of holdings) {
      const mvCNY = assetMVInCNY(a, rates)
      bucket.set(a.category, (bucket.get(a.category) ?? 0) + mvCNY)
    }
    return CATEGORY_ORDER.map((category) => {
      const value = bucket.get(category) ?? 0
      return { category, value, ratio: totalValueCNY === 0 ? 0 : value / totalValueCNY }
    })
  })()

  // 按 symbol 汇总持仓（用于排行榜）
  interface SymbolSummary {
    symbol: string
    category: string
    currency: string
    lots: Asset[]
    dividends: number
    totalMV: number
    totalCost: number
    totalPnL: number
    pnlRate: number
    annReturn: number | null
  }

  const symbolSummaries: SymbolSummary[] = (() => {
    const map = new Map<string, Asset[]>()
    for (const a of holdings) {
      const list = map.get(a.symbol)
      if (list) list.push(a)
      else map.set(a.symbol, [a])
    }
    const summaries: SymbolSummary[] = []
    for (const [symbol, lots] of map) {
      const symDivRecords = divRecords.filter((d) => d.symbol === symbol)
      const symConsumed = consumedRecords.filter((d) => d.symbol === symbol)
      const symSells = sellRecords.filter((d) => d.symbol === symbol)
      const symDivs = symDivRecords.reduce((s, d) => s + (d.dividends ?? 0), 0)
      const mv = totalMarketValue(lots)
      const cost = totalCostValue(lots)
      const pnl = totalPnLValue(lots) + symDivs
      summaries.push({
        symbol,
        category: lots[0].category,
        currency: lots[0].currency,
        lots,
        dividends: symDivs,
        totalMV: mv,
        totalCost: cost,
        totalPnL: pnl,
        pnlRate: cost === 0 ? 0 : pnl / cost,
        annReturn: histLoading || !hasMinimumAnnualizedHistory(lots, symConsumed)
          ? null
          : holdingsXIRR(lots, symDivRecords, symConsumed, symSells, getHistRate),
      })
    }
    return summaries
  })()

  // Top 5 涨跌排行（按 symbol 汇总后的盈亏率）
  const top5 = [...symbolSummaries]
    .sort((a, b) => b.pnlRate - a.pnlRate)
    .slice(0, 5)

  // Top 5 年化收益率排行（按 symbol 汇总后的年化，黄金暂时不参与）
  const top5Ann = symbolSummaries
    .filter((s) => s.lots[0].market !== 'gold' && s.annReturn !== null)
    .sort((a, b) => b.annReturn! - a.annReturn!)
    .slice(0, 5)

  // 按板块汇总
  const marketSummary = MARKET_ORDER
    .map((m) => {
      const group = holdings.filter((a) => (a.market || 'cn') === m)
      return { market: m, assets: group }
    })
    .filter(({ assets: g }) => g.length > 0)

  const riskExposure = calculateRiskExposure(holdings, rates, totalValueCNY)
  const returnAttribution = calculateReturnAttribution(holdings, divRecords, sellRecords, rates, getHistRate)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (assets.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-border/50 bg-card">
        <Wallet className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium text-white">暂无资产数据</p>
          <p className="mt-1 text-xs text-muted-foreground">
            请前往「资产」页面添加您的资产
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 游客模式 banner */}
      {!isLoggedIn && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm text-blue-400">
          <Eye className="h-4 w-4 shrink-0" />
          <span>当前为演示模式，登录后管理您的资产</span>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard
          title="总资产"
          value={formatCNY(totalValueCNY)}
          icon={Wallet}
        />
        <StatCard
          title="浮动盈亏"
          value={`${totalPnLCNY >= 0 ? '+' : ''}${formatCNY(totalPnLCNY)}`}
          subtitle={formatPercent(pnlPercent)}
          icon={totalPnLCNY >= 0 ? TrendingUp : TrendingDown}
          variant={pnlVariant}
        />
        <StatCard
          title="投入本金"
          value={formatCNY(totalCostCNY)}
          icon={DollarSign}
        />
        <StatCard
          title="组合年化"
          value={annReturn === null ? '—' : formatPercent(annReturn)}
          icon={Calendar}
          variant={annReturn === null ? 'default' : annVariant}
        />
      </div>

      {/* 板块资产汇总 */}
      {marketSummary.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {marketSummary.map(({ market, assets: group }) => {
            const mvCNY = group.reduce((s, a) => s + assetMVInCNY(a, rates), 0)
            const groupDivs = divRecords.filter((d) => (d.market || 'cn') === market)
            const groupConsumed = consumedRecords.filter((d) => (d.market || 'cn') === market)
            const groupSells = sellRecords.filter((d) => (d.market || 'cn') === market)
            const ann = market === 'gold' || histLoading || !hasMinimumAnnualizedHistory(group, groupConsumed)
              ? null
              : holdingsXIRR(group, groupDivs, groupConsumed, groupSells, getHistRate)
            const isAnnPositive = (ann ?? 0) >= 0
            const ratio = totalValueCNY === 0 ? 0 : mvCNY / totalValueCNY

            return (
              <div
                key={market}
                className="rounded-xl border border-border/50 bg-card p-4 shadow"
              >
                <p className="text-xs text-muted-foreground">
                  {MARKET_LABELS[market as MarketType]}
                </p>
                <p className="mt-1 font-mono text-lg font-semibold text-white">
                  {formatCNY(mvCNY)}
                </p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">
                    占比 {(ratio * 100).toFixed(1)}%
                  </span>
                  {ann !== null && (
                    <span className={`font-mono text-xs ${isAnnPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                      年化 {formatPercent(ann)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <RiskExposurePanel risk={riskExposure} />

      <ReturnAttributionPanel
        attribution={returnAttribution}
        historicalRatesLoading={histLoading}
      />

      {/* 分类占比饼图 + 涨跌排行 */}
      <div className="grid grid-cols-2 gap-6">
        <CategoryPieChart data={categoryBreakdownCNY} />

        {/* Top 5 涨跌排行 */}
        <div className="rounded-xl border border-border/50 bg-card p-6 shadow">
          <h3 className="mb-4 font-semibold text-white">涨跌排行 Top 5</h3>
          <div className="space-y-3">
            {top5.map((s) => {
              const pnlCNY = toCNY(s.totalPnL, s.currency, rates)
              const isPositive = s.totalPnL >= 0
              return (
                <div
                  key={s.symbol}
                  className="flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">
                      {s.symbol}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[s.category as AssetCategory]}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <p
                      className={`font-mono text-sm ${isPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}
                    >
                      {isPositive ? '+' : ''}
                      {formatMoney(s.totalPnL, s.currency)}
                    </p>
                    {s.currency !== 'CNY' && (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        ≈ {isPositive ? '+' : ''}{formatCNY(pnlCNY)}
                      </p>
                    )}
                    <p
                      className={`font-mono text-xs ${isPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}
                    >
                      {formatPercent(s.pnlRate)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 年化收益率排行 */}
      <div className="rounded-xl border border-border/50 bg-card p-6 shadow">
        <h3 className="mb-4 font-semibold text-white">年化收益率排行 Top 5</h3>
        {histLoading ? (
          <p className="text-sm text-muted-foreground">汇率加载中…</p>
        ) : top5Ann.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无持有满 90 天的年化样本</p>
        ) : (
          <div className="grid grid-cols-5 gap-4">
            {top5Ann.map((s) => {
              const isPositive = s.annReturn! >= 0
              return (
                <div
                  key={s.symbol}
                  className="rounded-lg border border-border/30 bg-background/50 p-4"
                >
                  <p className="truncate text-sm font-medium text-white">
                    {s.symbol}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {CATEGORY_LABELS[s.category as AssetCategory]}
                  </p>
                  <p
                    className={`mt-2 font-mono text-lg font-semibold ${isPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}
                  >
                    {formatPercent(s.annReturn!)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
