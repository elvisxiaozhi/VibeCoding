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
import { StatCard } from '@/components/dashboard/StatCard'
import { useAssets } from '@/hooks/useAssets'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { annualizedReturn, type CategoryBreakdownItem, costValue, marketValue, pnlRate, pnlValue, totalAnnualizedReturn } from '@/lib/calc'
import { formatMoney, toCNY } from '@/lib/currency'
import type { Asset, AssetCategory, MarketType } from '@/lib/types'
import { CATEGORY_LABELS, CATEGORY_ORDER, MARKET_LABELS, MARKET_ORDER } from '@/lib/types'

function formatCNY(n: number): string {
  return formatMoney(n, 'CNY')
}

function formatPercent(n: number): string {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
}

interface DashboardProps {
  isLoggedIn: boolean
}

/** 计算资产的人民币市值 */
function assetMVInCNY(a: Asset, rates: Record<string, number>): number {
  return toCNY(marketValue(a), a.currency, rates)
}

/** 计算资产的人民币成本 */
function assetCostInCNY(a: Asset, rates: Record<string, number>): number {
  return toCNY(costValue(a), a.currency, rates)
}

export function Dashboard({ isLoggedIn }: DashboardProps) {
  const { assets, loading } = useAssets(isLoggedIn)
  const { rates } = useExchangeRates()

  // 只统计持仓（qty > 0），排除卖出记录
  const holdings = assets.filter((a) => a.quantity > 0)

  // 汇率换算后的总值（人民币）
  const totalValueCNY = holdings.reduce((s, a) => s + assetMVInCNY(a, rates), 0)
  const totalCostCNY = holdings.reduce((s, a) => s + assetCostInCNY(a, rates), 0)
  const totalPnLCNY = totalValueCNY - totalCostCNY

  const pnlPercent = totalCostCNY === 0 ? 0 : totalPnLCNY / totalCostCNY
  const pnlVariant = totalPnLCNY >= 0 ? 'profit' : 'loss'
  const annReturn = totalAnnualizedReturn(holdings)
  const annVariant = annReturn >= 0 ? 'profit' : 'loss'

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

  // Top 5 涨跌排行（按盈亏率排序，盈亏率与币种无关）
  const top5 = [...holdings]
    .sort((a, b) => pnlRate(b) - pnlRate(a))
    .slice(0, 5)

  // Top 5 年化收益率排行
  const top5Ann = [...holdings]
    .sort((a, b) => annualizedReturn(b) - annualizedReturn(a))
    .slice(0, 5)

  // 按板块汇总
  const marketSummary = MARKET_ORDER
    .map((m) => {
      const group = holdings.filter((a) => (a.market || 'cn') === m)
      return { market: m, assets: group }
    })
    .filter(({ assets: g }) => g.length > 0)

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
          value={formatPercent(annReturn)}
          icon={Calendar}
          variant={annVariant}
        />
      </div>

      {/* 板块资产汇总 */}
      {marketSummary.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {marketSummary.map(({ market, assets: group }) => {
            const mvCNY = group.reduce((s, a) => s + assetMVInCNY(a, rates), 0)
            const ann = totalAnnualizedReturn(group)
            const isAnnPositive = ann >= 0
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
                  <span className={`font-mono text-xs ${isAnnPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    年化 {formatPercent(ann)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 分类占比饼图 + 涨跌排行 */}
      <div className="grid grid-cols-2 gap-6">
        <CategoryPieChart data={categoryBreakdownCNY} />

        {/* Top 5 涨跌排行 */}
        <div className="rounded-xl border border-border/50 bg-card p-6 shadow">
          <h3 className="mb-4 font-semibold text-white">涨跌排行 Top 5</h3>
          <div className="space-y-3">
            {top5.map((asset) => {
              const rate = pnlRate(asset)
              const pnl = pnlValue(asset)
              const pnlCNY = toCNY(pnl, asset.currency, rates)
              const isPositive = pnl >= 0
              return (
                <div
                  key={asset.id}
                  className="flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">
                      {asset.symbol}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[asset.category]}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <p
                      className={`font-mono text-sm ${isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}
                    >
                      {isPositive ? '+' : ''}
                      {formatMoney(pnl, asset.currency)}
                    </p>
                    {asset.currency !== 'CNY' && (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        ≈ {isPositive ? '+' : ''}{formatCNY(pnlCNY)}
                      </p>
                    )}
                    <p
                      className={`font-mono text-xs ${isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}
                    >
                      {formatPercent(rate)}
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
        <div className="grid grid-cols-5 gap-4">
          {top5Ann.map((asset) => {
            const ann = annualizedReturn(asset)
            const isPositive = ann >= 0
            return (
              <div
                key={asset.id}
                className="rounded-lg border border-border/30 bg-background/50 p-4"
              >
                <p className="truncate text-sm font-medium text-white">
                  {asset.symbol}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {CATEGORY_LABELS[asset.category]}
                </p>
                <p
                  className={`mt-2 font-mono text-lg font-semibold ${isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}
                >
                  {formatPercent(ann)}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
