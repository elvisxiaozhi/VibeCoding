import { Loader2 } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useClearedAssets } from '@/hooks/useClearedAssets'
import { daysBetween, formatHoldingDays } from '@/lib/calc'
import { formatMoney } from '@/lib/currency'
import { CATEGORY_LABELS } from '@/lib/types'

function holdPeriod(first: string, last: string): string {
  if (!first || !last) return '—'
  return formatHoldingDays(daysBetween(first, last))
}

interface Props {
  isLoggedIn: boolean
}

export function ClearedAssetsTable({ isLoggedIn }: Props) {
  const { assets, loading } = useClearedAssets(isLoggedIn)

  if (!isLoggedIn) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
        登录后查看已清仓记录
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (assets.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
        暂无已清仓记录
      </div>
    )
  }

  const totalPnL = assets.reduce((s, a) => s + a.pnl, 0)

  return (
    <div className="rounded-lg border border-white/10 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-muted-foreground">标的</TableHead>
            <TableHead className="text-muted-foreground">类型</TableHead>
            <TableHead className="text-muted-foreground text-right">投入成本</TableHead>
            <TableHead className="text-muted-foreground text-right">卖出所得</TableHead>
            <TableHead className="text-muted-foreground text-right">分红</TableHead>
            <TableHead className="text-muted-foreground text-right">已实现盈亏</TableHead>
            <TableHead className="text-muted-foreground text-right">盈亏率</TableHead>
            <TableHead className="text-muted-foreground text-right">持有期</TableHead>
            <TableHead className="text-muted-foreground text-right">清仓日期</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((a) => {
            const pnlPct = a.totalCost > 0 ? a.pnl / a.totalCost : 0
            const pnlColor = a.pnl >= 0 ? 'text-red-400' : 'text-green-400'
            const ticker = a.symbol.split(' ')[0]
            const name = a.symbol.slice(ticker.length + 1)
            return (
              <TableRow key={a.symbol} className="border-white/10 hover:bg-white/5">
                <TableCell>
                  <div className="font-mono text-sm text-white">{ticker}</div>
                  <div className="text-xs text-muted-foreground">{name}</div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {CATEGORY_LABELS[a.category] ?? a.category}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatMoney(a.totalCost, a.currency)}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatMoney(a.totalProceeds, a.currency)}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {a.totalDividends > 0 ? formatMoney(a.totalDividends, a.currency) : '—'}
                </TableCell>
                <TableCell className={`text-right text-sm font-medium ${pnlColor}`}>
                  {a.pnl >= 0 ? '+' : ''}{formatMoney(a.pnl, a.currency)}
                </TableCell>
                <TableCell className={`text-right text-sm font-medium ${pnlColor}`}>
                  {a.pnl >= 0 ? '+' : ''}{(pnlPct * 100).toFixed(2)}%
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {holdPeriod(a.firstBuyDate, a.lastSellDate)}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {a.lastSellDate}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <div className="flex items-center justify-end gap-6 border-t border-white/10 px-4 py-3 text-sm">
        <span className="text-muted-foreground">合计已实现盈亏</span>
        <span className={`font-semibold ${totalPnL >= 0 ? 'text-red-400' : 'text-green-400'}`}>
          {totalPnL >= 0 ? '+' : ''}{formatMoney(totalPnL, 'USD')}
        </span>
      </div>
    </div>
  )
}
