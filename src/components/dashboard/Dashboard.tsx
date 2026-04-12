import { DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react'

import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart'
import { StatCard } from '@/components/dashboard/StatCard'
import { useAssets } from '@/hooks/useAssets'
import { pnlRate, pnlValue } from '@/lib/calc'
import { CATEGORY_LABELS } from '@/lib/types'

function formatCNY(n: number): string {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPercent(n: number): string {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
}

export function Dashboard() {
  const { assets, totalValue, totalCost, totalPnL, categoryBreakdown } =
    useAssets()

  const pnlPercent = totalCost === 0 ? 0 : totalPnL / totalCost
  const pnlVariant = totalPnL >= 0 ? 'profit' : 'loss'

  // Top 5 涨跌排行（按盈亏率排序）
  const top5 = [...assets]
    .sort((a, b) => pnlRate(b) - pnlRate(a))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-6">
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
      </div>

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
