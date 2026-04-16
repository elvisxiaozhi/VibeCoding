import {
  Calendar,
  Coins,
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
import { marketValue, pnlRate, pnlValue, totalAnnualizedReturn } from '@/lib/calc'
import { CATEGORY_LABELS } from '@/lib/types'

function formatCNY(n: number): string {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPercent(n: number): string {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
}

interface DashboardProps {
  isLoggedIn: boolean
}

export function Dashboard({ isLoggedIn }: DashboardProps) {
  const { assets, loading, totalValue, totalCost, totalPnL, categoryBreakdown } =
    useAssets(isLoggedIn)

  const pnlPercent = totalCost === 0 ? 0 : totalPnL / totalCost
  const pnlVariant = totalPnL >= 0 ? 'profit' : 'loss'
  const annReturn = totalAnnualizedReturn(assets)
  const annVariant = annReturn >= 0 ? 'profit' : 'loss'

  // Top 5 涨跌排行（按盈亏率排序）
  const top5 = [...assets]
    .sort((a, b) => pnlRate(b) - pnlRate(a))
    .slice(0, 5)

  // 货币持仓
  const currencyAssets = assets.filter((a) => a.category === 'currency')

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
          value={formatCNY(totalValue)}
          icon={Wallet}
        />
        <StatCard
          title="浮动盈亏"
          value={`${totalPnL >= 0 ? '+' : ''}${formatCNY(totalPnL)}`}
          subtitle={formatPercent(pnlPercent)}
          icon={totalPnL >= 0 ? TrendingUp : TrendingDown}
          variant={pnlVariant}
        />
        <StatCard
          title="投入本金"
          value={formatCNY(totalCost)}
          icon={DollarSign}
        />
        <StatCard
          title="组合年化"
          value={formatPercent(annReturn)}
          icon={Calendar}
          variant={annVariant}
        />
      </div>

      {/* 货币持仓 */}
      {currencyAssets.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-6 shadow">
          <div className="mb-4 flex items-center gap-2">
            <Coins className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-white">货币持仓</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {currencyAssets.map((asset) => {
              const mv = marketValue(asset)
              const pnl = pnlValue(asset)
              const isPositive = pnl >= 0
              return (
                <div
                  key={asset.id}
                  className="rounded-lg border border-border/30 bg-background/50 p-4"
                >
                  <p className="text-sm font-medium text-white">{asset.symbol}</p>
                  <p className="mt-1 font-mono text-lg text-white">
                    {asset.quantity.toLocaleString('zh-CN')}
                  </p>
                  <div className="mt-1 flex items-baseline justify-between">
                    <p className="font-mono text-xs text-muted-foreground">
                      ≈ {formatCNY(mv)}
                    </p>
                    <p className={`font-mono text-xs ${isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {isPositive ? '+' : ''}{formatCNY(pnl)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 分类占比饼图 + 涨跌排行 */}
      <div className="grid grid-cols-2 gap-6">
        <CategoryPieChart data={categoryBreakdown} />

        {/* Top 5 涨跌排行 */}
        <div className="rounded-xl border border-border/50 bg-card p-6 shadow">
          <h3 className="mb-4 font-semibold text-white">涨跌排行 Top 5</h3>
          <div className="space-y-3">
            {top5.map((asset) => {
              const rate = pnlRate(asset)
              const pnl = pnlValue(asset)
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
                      {formatCNY(pnl)}
                    </p>
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
    </div>
  )
}
