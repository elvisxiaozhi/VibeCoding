import { CalendarDays, RefreshCw } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMoney } from '@/lib/currency'
import type { PortfolioSnapshot, SnapshotDimension } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

const DIMENSIONS: SnapshotDimension[] = ['market', 'currency', 'owner']

function dimensionLabel(dimension: SnapshotDimension): string {
  if (dimension === 'market') return '市场'
  if (dimension === 'currency') return '币种'
  return '归属人'
}

function shortMoney(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (abs >= 10000) return `${(value / 10000).toFixed(1)}万`
  return `${Math.round(value)}`
}

function pnlClass(value: number): string {
  if (value > 0) return 'text-[#ef4444]'
  if (value < 0) return 'text-[#22c55e]'
  return 'text-muted-foreground'
}

interface PortfolioSnapshotPanelProps {
  snapshots: PortfolioSnapshot[]
  selectedSnapshot: PortfolioSnapshot | null
  loading: boolean
  creating: boolean
  isLoggedIn: boolean
  onCreateToday: () => void
  onSelectSnapshot: (snapshotDate: string) => void
}

export function PortfolioSnapshotPanel({
  snapshots,
  selectedSnapshot,
  loading,
  creating,
  isLoggedIn,
  onCreateToday,
  onSelectSnapshot,
}: PortfolioSnapshotPanelProps) {
  const chartData = snapshots.map((snapshot) => ({
    date: snapshot.snapshotDate,
    totalValueCNY: snapshot.totalValueCNY,
    totalCostCNY: snapshot.totalCostCNY,
    totalPnLCNY: snapshot.totalPnLCNY,
  }))
  const selectedDate = selectedSnapshot?.snapshotDate ?? snapshots.at(-1)?.snapshotDate ?? ''

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-white">资产快照与净值曲线</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={selectedDate}
              disabled={!isLoggedIn || snapshots.length === 0 || loading}
              onChange={(e) => onSelectSnapshot(e.target.value)}
              className="h-8 rounded-md border border-border/50 bg-background px-2 text-xs text-white"
            >
              {snapshots.map((snapshot) => (
                <option key={snapshot.snapshotDate} value={snapshot.snapshotDate}>
                  {snapshot.snapshotDate}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-2 px-3 text-xs"
              disabled={!isLoggedIn || creating}
              onClick={onCreateToday}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', creating && 'animate-spin')} />
              快照
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!isLoggedIn ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-border/40 bg-background/40 text-sm text-muted-foreground">
            登录后记录和查看资产快照
          </div>
        ) : snapshots.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-border/40 bg-background/40 text-sm text-muted-foreground">
            暂无快照，点击右上角生成今日快照
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-border/40 bg-background/40 p-4">
                <p className="text-xs text-muted-foreground">快照日期</p>
                <p className="mt-2 flex items-center gap-2 font-mono text-lg font-semibold text-white">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  {selectedSnapshot?.snapshotDate ?? '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border/40 bg-background/40 p-4">
                <p className="text-xs text-muted-foreground">总资产</p>
                <p className="mt-2 font-mono text-lg font-semibold text-white">
                  {formatMoney(selectedSnapshot?.totalValueCNY ?? 0, 'CNY')}
                </p>
              </div>
              <div className="rounded-lg border border-border/40 bg-background/40 p-4">
                <p className="text-xs text-muted-foreground">投入本金</p>
                <p className="mt-2 font-mono text-lg font-semibold text-white">
                  {formatMoney(selectedSnapshot?.totalCostCNY ?? 0, 'CNY')}
                </p>
              </div>
              <div className="rounded-lg border border-border/40 bg-background/40 p-4">
                <p className="text-xs text-muted-foreground">累计盈亏</p>
                <p className={cn('mt-2 font-mono text-lg font-semibold', pnlClass(selectedSnapshot?.totalPnLCNY ?? 0))}>
                  {(selectedSnapshot?.totalPnLCNY ?? 0) >= 0 ? '+' : ''}
                  {formatMoney(selectedSnapshot?.totalPnLCNY ?? 0, 'CNY')}
                </p>
              </div>
            </div>

            <div className="h-[280px] rounded-lg border border-border/40 bg-background/40 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    tickFormatter={shortMoney}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#111827',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8,
                      color: '#fff',
                    }}
                    formatter={(value, name) => {
                      const label = name === 'totalValueCNY' ? '总资产' : name === 'totalCostCNY' ? '本金' : '盈亏'
                      return [formatMoney(Number(value ?? 0), 'CNY'), label]
                    }}
                    labelFormatter={(label) => `日期 ${label}`}
                  />
                  <Line type="monotone" dataKey="totalValueCNY" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="totalCostCNY" stroke="#a78bfa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="totalPnLCNY" stroke="#f87171" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <section className="space-y-3">
                <h3 className="text-sm font-medium text-white">拆分明细</h3>
                <div className="space-y-4">
                  {DIMENSIONS.map((dimension) => {
                    const rows = selectedSnapshot?.breakdowns?.filter((item) => item.dimension === dimension) ?? []
                    return (
                      <div key={dimension} className="rounded-lg border border-border/40 bg-background/40 p-3">
                        <p className="mb-2 text-xs text-muted-foreground">{dimensionLabel(dimension)}</p>
                        <div className="space-y-2">
                          {rows.length === 0 ? (
                            <p className="text-xs text-muted-foreground">暂无数据</p>
                          ) : rows.map((item) => (
                            <div key={`${dimension}-${item.key}`} className="flex items-center gap-3">
                              <div className="w-20 truncate text-xs text-white" title={item.label}>{item.label}</div>
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                                <div
                                  className="h-full rounded-full bg-blue-500"
                                  style={{ width: `${Math.min(Math.max(item.ratio, 0) * 100, 100)}%` }}
                                />
                              </div>
                              <div className="w-24 text-right font-mono text-xs text-muted-foreground">
                                {formatMoney(item.valueCNY, 'CNY')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-medium text-white">当日资产状态</h3>
                <div className="max-h-[420px] overflow-auto rounded-lg border border-border/40">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-transparent">
                        <TableHead className="text-muted-foreground">标的</TableHead>
                        <TableHead className="text-muted-foreground">分类</TableHead>
                        <TableHead className="text-right text-muted-foreground">市值</TableHead>
                        <TableHead className="text-right text-muted-foreground">盈亏</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedSnapshot?.assets ?? [])
                        .filter((asset) => asset.quantity > 0)
                        .slice(0, 12)
                        .map((asset) => {
                          const value = asset.currentPrice * asset.quantity
                          const pnl = (asset.currentPrice - asset.costBasis) * asset.quantity
                          return (
                            <TableRow key={asset.id} className="border-border/40 hover:bg-white/5">
                              <TableCell className="max-w-[180px] truncate text-sm text-white" title={asset.symbol}>
                                {asset.symbol}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {CATEGORY_LABELS[asset.category] ?? asset.category}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-white">
                                {formatMoney(value, asset.currency)}
                              </TableCell>
                              <TableCell className={cn('text-right font-mono text-sm', pnlClass(pnl))}>
                                {pnl >= 0 ? '+' : ''}{formatMoney(pnl, asset.currency)}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                    </TableBody>
                  </Table>
                </div>
              </section>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
