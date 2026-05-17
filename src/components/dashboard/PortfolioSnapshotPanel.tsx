import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney } from '@/lib/currency'
import type { PortfolioSnapshot, SnapshotDimension } from '@/lib/types'
import { cn } from '@/lib/utils'

// ─── helpers ──────────────────────────────────────────────────────────────────

type TimeRange = '1M' | '3M' | '1Y' | 'all'

function filterByRange(snapshots: PortfolioSnapshot[], range: TimeRange): PortfolioSnapshot[] {
  if (range === 'all') return snapshots
  const cutoff = new Date()
  if (range === '1M') cutoff.setMonth(cutoff.getMonth() - 1)
  else if (range === '3M') cutoff.setMonth(cutoff.getMonth() - 3)
  else cutoff.setFullYear(cutoff.getFullYear() - 1)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return snapshots.filter((s) => s.snapshotDate >= cutoffStr)
}

function calcDrawdown(snapshots: PortfolioSnapshot[]): Array<{ date: string; drawdown: number }> {
  let peak = 0
  return snapshots.map((s) => {
    if (s.totalValueCNY > peak) peak = s.totalValueCNY
    return { date: s.snapshotDate, drawdown: peak === 0 ? 0 : (s.totalValueCNY - peak) / peak }
  })
}

function buildStackedData(snapshots: PortfolioSnapshot[], dimension: SnapshotDimension) {
  const labelMap = new Map<string, string>()
  for (const s of snapshots) {
    for (const b of s.breakdowns ?? []) {
      if (b.dimension === dimension && !labelMap.has(b.key)) labelMap.set(b.key, b.label)
    }
  }
  const keys = [...labelMap.keys()]
  const data = snapshots.map((s) => {
    const row: Record<string, string | number> = { date: s.snapshotDate }
    for (const k of keys) {
      const b = s.breakdowns?.find((x) => x.dimension === dimension && x.key === k)
      row[k] = b?.valueCNY ?? 0
    }
    return row
  })
  return { data, keys, labelMap }
}

function shortMoney(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${(value / 10_000).toFixed(0)}万`
  return `${Math.round(value)}`
}

function dateTick(date: string, range: TimeRange): string {
  if (range === '1M') return date.slice(5)          // MM-DD
  if (range === '3M' || range === '1Y') return `${date.slice(5, 7)}月`
  return date.slice(0, 7)                           // YYYY-MM
}

const TOOLTIP_STYLE = {
  background: '#111827',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
}

const AREA_COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#f97316', '#2dd4bf', '#e879f9']

// ─── component ────────────────────────────────────────────────────────────────

interface PortfolioSnapshotPanelProps {
  snapshots: PortfolioSnapshot[]
  selectedSnapshot: PortfolioSnapshot | null
  loading: boolean
  creating: boolean
  isLoggedIn: boolean
  compact?: boolean
  onCreateToday: () => void
  onSelectSnapshot: (snapshotDate: string) => void
}

export function PortfolioSnapshotPanel({
  snapshots,
  creating,
  isLoggedIn,
  onCreateToday,
}: PortfolioSnapshotPanelProps) {
  const [tab, setTab] = useState<'trend' | 'structure'>('trend')
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [dimension, setDimension] = useState<SnapshotDimension>('market')

  const filtered = filterByRange(snapshots, timeRange)
  const hasLiabilityData = snapshots.some((s) => (s.totalLiabilityCNY ?? 0) > 0)

  // Trend data
  const trendData = filtered.map((s) => ({
    date: s.snapshotDate,
    totalValueCNY: s.totalValueCNY,
    totalCostCNY: s.totalCostCNY,
    netWorthCNY: s.totalValueCNY - (s.totalLiabilityCNY ?? 0),
  }))

  // Drawdown from filtered range (relative to period high); all-time for stat
  const filteredDrawdowns = calcDrawdown(filtered)
  const allDrawdowns = calcDrawdown(snapshots)
  const maxDrawdown = allDrawdowns.reduce((m, d) => (d.drawdown < m.drawdown ? d : m), { drawdown: 0, date: '' })

  // Structure data
  const { data: stackedData, keys: stackedKeys, labelMap } = buildStackedData(filtered, dimension)

  const timeChips: TimeRange[] = ['1M', '3M', '1Y', 'all']
  const dimLabels: Record<SnapshotDimension, string> = { market: '市场', currency: '币种', owner: '归属人' }

  const xTickFormatter = (v: string) => dateTick(v, timeRange)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-white">净值曲线</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2.5 text-xs"
            disabled={!isLoggedIn || creating}
            onClick={onCreateToday}
          >
            <RefreshCw className={cn('h-3 w-3', creating && 'animate-spin')} />
            快照
          </Button>
        </div>

        {/* Tabs + time range */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            {(['trend', 'structure'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'rounded px-2.5 py-1 text-xs transition-colors',
                  tab === t ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white',
                )}
              >
                {t === 'trend' ? '趋势' : '结构演变'}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {timeChips.map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={cn(
                  'rounded px-2 py-0.5 text-xs transition-colors',
                  timeRange === r ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white',
                )}
              >
                {r === 'all' ? '全部' : r}
              </button>
            ))}
          </div>
        </div>

        {/* Structure tab: dimension selector */}
        {tab === 'structure' && (
          <div className="mt-1 flex gap-1">
            {(['market', 'currency', 'owner'] as SnapshotDimension[]).map((d) => (
              <button
                key={d}
                onClick={() => setDimension(d)}
                className={cn(
                  'rounded px-2.5 py-0.5 text-xs transition-colors',
                  dimension === d ? 'bg-orange-500/20 text-orange-400' : 'text-muted-foreground hover:text-white',
                )}
              >
                {dimLabels[d]}
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {!isLoggedIn ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-border/40 bg-background/40 text-sm text-muted-foreground">
            登录后记录和查看资产快照
          </div>
        ) : snapshots.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-border/40 bg-background/40 text-sm text-muted-foreground">
            暂无快照，点击右上角生成今日快照
          </div>
        ) : tab === 'trend' ? (
          <>
            {/* Main line chart */}
            <div className="h-[220px] rounded-lg border border-border/30 bg-background/30 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 6, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={xTickFormatter}
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    tickFormatter={shortMoney}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => {
                      const labels: Record<string, string> = {
                        totalValueCNY: '总资产',
                        totalCostCNY: '本金',
                        netWorthCNY: '净资产',
                      }
                      return [formatMoney(Number(value ?? 0), 'CNY'), labels[name as string] ?? String(name)]
                    }}
                    labelFormatter={(l) => `日期 ${l}`}
                  />
                  <Line type="monotone" dataKey="totalValueCNY" stroke="#60a5fa" strokeWidth={2} dot={false} name="totalValueCNY" />
                  <Line type="monotone" dataKey="totalCostCNY" stroke="#a78bfa" strokeWidth={1.5} dot={false} name="totalCostCNY" strokeDasharray="4 2" />
                  {hasLiabilityData && (
                    <Line type="monotone" dataKey="netWorthCNY" stroke="#34d399" strokeWidth={2} dot={false} name="netWorthCNY" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded bg-[#60a5fa]" />总资产</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded bg-[#a78bfa] opacity-70" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#a78bfa 0,#a78bfa 4px,transparent 4px,transparent 6px)' }} />本金</span>
              {hasLiabilityData && (
                <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded bg-[#34d399]" />净资产（扣负债）</span>
              )}
            </div>

            {/* Drawdown chart */}
            <div className="h-[90px] rounded-lg border border-border/30 bg-background/30 p-2">
              <div className="mb-1 px-1 text-xs text-muted-foreground">回撤</div>
              <ResponsiveContainer width="100%" height="80%">
                <AreaChart data={filteredDrawdowns} margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis
                    tick={{ fill: '#9ca3af', fontSize: 9 }}
                    tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                    domain={['auto', 0]}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v) => [`${(Number(v) * 100).toFixed(2)}%`, '回撤']}
                    labelFormatter={(l) => `日期 ${l}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="drawdown"
                    stroke="#f87171"
                    strokeWidth={1.5}
                    fill="rgba(239,68,68,0.2)"
                    dot={false}
                    baseValue={0}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Max drawdown stat */}
            {maxDrawdown.drawdown < 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>历史最大回撤</span>
                <span className="font-mono text-[#f87171]">{(maxDrawdown.drawdown * 100).toFixed(2)}%</span>
                <span>（{maxDrawdown.date}）</span>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Structure: stacked area chart */}
            {stackedKeys.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-border/40 bg-background/40 text-sm text-muted-foreground">
                暂无分项数据
              </div>
            ) : (
              <>
                <div className="h-[280px] rounded-lg border border-border/30 bg-background/30 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stackedData} margin={{ top: 6, right: 12, left: 4, bottom: 4 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={xTickFormatter}
                        tick={{ fill: '#9ca3af', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fill: '#9ca3af', fontSize: 10 }}
                        tickFormatter={shortMoney}
                        axisLine={false}
                        tickLine={false}
                        width={44}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value, key) => [
                          formatMoney(Number(value ?? 0), 'CNY'),
                          labelMap.get(String(key)) ?? String(key),
                        ]}
                        labelFormatter={(l) => `日期 ${l}`}
                      />
                      {stackedKeys.map((k, i) => (
                        <Area
                          key={k}
                          type="monotone"
                          dataKey={k}
                          stackId="s"
                          stroke={AREA_COLORS[i % AREA_COLORS.length]}
                          fill={AREA_COLORS[i % AREA_COLORS.length]}
                          fillOpacity={0.75}
                          strokeWidth={1}
                          dot={false}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {stackedKeys.map((k, i) => (
                    <span key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ background: AREA_COLORS[i % AREA_COLORS.length] }}
                      />
                      {labelMap.get(k) ?? k}
                    </span>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
