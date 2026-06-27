import { useState } from 'react'

import { BarChart3, ChevronDown, ChevronRight, CircleDollarSign, TrendingUp } from 'lucide-react'

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
import { usePrivacy } from '@/context/PrivacyContext'
import type { BenchmarkComparison } from '@/lib/benchmark'
import { formatMoney } from '@/lib/currency'
import type { AttributionGroupBy, ReturnAttribution, ReturnAttributionItem } from '@/lib/attribution'
import { groupLabel } from '@/lib/attribution'
import type { AssetCategory } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

type RankingMode = 'pnl' | 'rate' | 'annualized'

export interface PerformanceSummary {
  symbol: string
  category: string
  currency: string
  totalPnL: number
  totalPnLCNY: number
  pnlRate: number
  annReturn: number | null
}

interface PerformancePanelProps {
  attribution: ReturnAttribution
  historicalRatesLoading: boolean
  summaries: PerformanceSummary[]
  onSymbolClick?: (symbol: string) => void
  /** 人民币本位年化（组合 XIRR），用于 vs 基准对照 */
  portfolioReturn: number | null
  benchmarks: BenchmarkComparison[]
  benchmarksLoading: boolean
}

const GROUP_OPTIONS: AttributionGroupBy[] = ['asset', 'category', 'currency', 'market']

const RANKING_OPTIONS: { key: RankingMode; label: string }[] = [
  { key: 'pnl', label: '总收益' },
  { key: 'rate', label: '收益率' },
  { key: 'annualized', label: '年化' },
]

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

function signedMoney(value: number): string {
  return `${value >= 0 ? '+' : ''}${formatMoney(value, 'CNY')}`
}

function amountClass(value: number): string {
  if (value > 0) return 'text-[#ef4444]'
  if (value < 0) return 'text-[#22c55e]'
  return 'text-muted-foreground'
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string
  value: number
  detail?: string
  icon: typeof TrendingUp
}) {
  const { mask } = usePrivacy()
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className={cn('mt-2 truncate font-mono text-lg font-semibold', amountClass(value))}>
        {mask(signedMoney(value))}
      </p>
      {detail ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  )
}

function itemList(attribution: ReturnAttribution, groupBy: AttributionGroupBy): ReturnAttributionItem[] {
  if (groupBy === 'asset') return attribution.byAsset
  if (groupBy === 'category') return attribution.byCategory
  if (groupBy === 'currency') return attribution.byCurrency
  return attribution.byMarket
}

function rankedSummaries(summaries: PerformanceSummary[], mode: RankingMode): PerformanceSummary[] {
  if (mode === 'annualized') {
    return summaries
      .filter((item) => item.annReturn !== null)
      .sort((a, b) => b.annReturn! - a.annReturn!)
      .slice(0, 5)
  }

  return [...summaries]
    .sort((a, b) => (mode === 'pnl' ? b.totalPnLCNY - a.totalPnLCNY : b.pnlRate - a.pnlRate))
    .slice(0, 5)
}

export function PerformancePanel({
  attribution,
  historicalRatesLoading,
  summaries,
  onSymbolClick,
  portfolioReturn,
  benchmarks,
  benchmarksLoading,
}: PerformancePanelProps) {
  const { mask } = usePrivacy()
  const [groupBy, setGroupBy] = useState<AttributionGroupBy>('asset')
  const [rankingMode, setRankingMode] = useState<RankingMode>('pnl')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const rows = itemList(attribution, groupBy)
  const topRankings = rankedSummaries(summaries, rankingMode)

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-white">收益分析</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {historicalRatesLoading
                ? '历史汇率加载中'
                : attribution.usedHistoricalRates ? '按历史汇率拆分收益来源' : '部分使用当前汇率估算'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {detailsOpen ? (
              <div className="flex gap-1 rounded-md border border-border/40 bg-background/30 p-1">
                {GROUP_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={groupBy === option ? 'default' : 'ghost'}
                    className="h-7 px-3 text-xs"
                    onClick={() => setGroupBy(option)}
                  >
                    {groupLabel(option)}
                  </Button>
                ))}
              </div>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-2 text-xs text-muted-foreground"
              onClick={() => setDetailsOpen((value) => !value)}
            >
              {detailsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              明细
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="价格涨跌"
            value={attribution.totals.priceReturnCNY}
            detail={detailsOpen ? '按买入日汇率' : undefined}
            icon={TrendingUp}
          />
          <Metric
            label="分红收益"
            value={attribution.totals.dividendReturnCNY}
            detail={detailsOpen ? '按派息日汇率' : undefined}
            icon={CircleDollarSign}
          />
          <Metric
            label="汇率收益"
            value={attribution.totals.fxReturnCNY}
            detail={detailsOpen ? '现价敞口折算' : undefined}
            icon={BarChart3}
          />
          <Metric
            label="总收益"
            value={attribution.totals.totalReturnCNY}
            detail={detailsOpen ? `成本 ${mask(formatMoney(attribution.totals.costCNY, 'CNY'))}` : undefined}
            icon={BarChart3}
          />
        </div>

        {portfolioReturn !== null && benchmarks.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-white">vs 基准</h3>
              <span className="text-xs text-muted-foreground">
                {benchmarksLoading ? '基准数据加载中' : '同现金流时点对照年化'}
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                <p className="text-xs text-muted-foreground">本组合</p>
                <p className={cn('mt-1 font-mono text-lg font-semibold', amountClass(portfolioReturn))}>
                  {formatPercent(portfolioReturn)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">人民币本位年化</p>
              </div>
              {benchmarks.map((b) => {
                const excess = b.value === null ? null : portfolioReturn - b.value
                return (
                  <div key={b.symbol} className="rounded-lg border border-border/30 bg-background/30 p-3">
                    <p className="text-xs text-muted-foreground">{b.label}</p>
                    <p
                      className={cn(
                        'mt-1 font-mono text-lg font-semibold',
                        b.value === null ? 'text-muted-foreground' : amountClass(b.value),
                      )}
                    >
                      {b.value === null ? '—' : formatPercent(b.value)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {excess === null ? (
                        benchmarksLoading ? '加载中' : '暂无数据'
                      ) : (
                        <>超额 <span className={amountClass(excess)}>{formatPercent(excess)}</span></>
                      )}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-white">Top 5</h3>
            <div className="flex gap-1 rounded-md border border-border/40 bg-background/30 p-1">
              {RANKING_OPTIONS.map((option) => (
                <Button
                  key={option.key}
                  type="button"
                  size="sm"
                  variant={rankingMode === option.key ? 'default' : 'ghost'}
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setRankingMode(option.key)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {topRankings.length === 0 ? (
              <div className="rounded-lg border border-border/40 bg-background/30 p-4 text-sm text-muted-foreground">
                暂无可用排行数据
              </div>
            ) : topRankings.map((item) => {
              const value =
                rankingMode === 'annualized'
                  ? formatPercent(item.annReturn ?? 0)
                  : rankingMode === 'rate'
                    ? formatPercent(item.pnlRate)
                    : mask(signedMoney(item.totalPnLCNY))
              const signValue =
                rankingMode === 'annualized'
                  ? item.annReturn ?? 0
                  : rankingMode === 'rate'
                    ? item.pnlRate
                    : item.totalPnLCNY

              return (
                <div
                  key={`${rankingMode}-${item.symbol}`}
                  className={cn(
                    'flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/30 bg-background/30 px-3 py-2.5',
                    onSymbolClick && 'cursor-pointer hover:border-border/60 hover:bg-white/5 transition-colors',
                  )}
                  onClick={() => onSymbolClick?.(item.symbol)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{item.symbol}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {CATEGORY_LABELS[item.category as AssetCategory]}
                    </p>
                  </div>
                  <p className={cn('shrink-0 font-mono text-sm font-semibold', amountClass(signValue))}>
                    {value}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {detailsOpen ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-white">归因明细</h3>
              <span className="text-xs text-muted-foreground">按{groupLabel(groupBy)}，显示前 8 项</span>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/40">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">{groupLabel(groupBy)}</TableHead>
                    <TableHead className="text-right text-muted-foreground">价格</TableHead>
                    <TableHead className="text-right text-muted-foreground">分红</TableHead>
                    <TableHead className="text-right text-muted-foreground">汇率</TableHead>
                    <TableHead className="text-right text-muted-foreground">总收益</TableHead>
                    <TableHead className="text-right text-muted-foreground">贡献率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 8).map((item) => (
                    <TableRow key={item.key} className="border-border/40 hover:bg-white/5">
                      <TableCell className="max-w-[180px] truncate text-sm font-medium text-white" title={item.label}>
                        {item.label}
                      </TableCell>
                      <TableCell className={cn('text-right font-mono text-sm', amountClass(item.priceReturnCNY))}>
                        {mask(signedMoney(item.priceReturnCNY))}
                      </TableCell>
                      <TableCell className={cn('text-right font-mono text-sm', amountClass(item.dividendReturnCNY))}>
                        {mask(signedMoney(item.dividendReturnCNY))}
                      </TableCell>
                      <TableCell className={cn('text-right font-mono text-sm', amountClass(item.fxReturnCNY))}>
                        {mask(signedMoney(item.fxReturnCNY))}
                      </TableCell>
                      <TableCell className={cn('text-right font-mono text-sm font-medium', amountClass(item.totalReturnCNY))}>
                        {mask(signedMoney(item.totalReturnCNY))}
                      </TableCell>
                      <TableCell className={cn('text-right font-mono text-sm', amountClass(item.contributionRatio))}>
                        {formatPercent(item.contributionRatio)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  )
}
