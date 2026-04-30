import { useState } from 'react'

import { BarChart3, CircleDollarSign, TrendingUp } from 'lucide-react'

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
import type { AttributionGroupBy, ReturnAttribution, ReturnAttributionItem } from '@/lib/attribution'
import { groupLabel } from '@/lib/attribution'
import { cn } from '@/lib/utils'

const GROUP_OPTIONS: AttributionGroupBy[] = ['asset', 'category', 'currency', 'market']

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
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className={cn('mt-2 truncate font-mono text-lg font-semibold', amountClass(value))}>
        {signedMoney(value)}
      </p>
      {detail ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  )
}

function ContributionBar({ item, maxAbsReturn }: { item: ReturnAttributionItem; maxAbsReturn: number }) {
  const ratio = maxAbsReturn === 0 ? 0 : Math.abs(item.totalReturnCNY) / maxAbsReturn

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-[96px] truncate text-sm text-white" title={item.label}>
        {item.label}
      </div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn('h-full rounded-full', item.totalReturnCNY >= 0 ? 'bg-[#ef4444]' : 'bg-[#22c55e]')}
          style={{ width: `${Math.max(ratio * 100, item.totalReturnCNY === 0 ? 0 : 2)}%` }}
        />
      </div>
      <div className={cn('min-w-[132px] text-right font-mono text-sm', amountClass(item.totalReturnCNY))}>
        {signedMoney(item.totalReturnCNY)}
      </div>
    </div>
  )
}

function itemList(attribution: ReturnAttribution, groupBy: AttributionGroupBy): ReturnAttributionItem[] {
  if (groupBy === 'asset') return attribution.byAsset
  if (groupBy === 'category') return attribution.byCategory
  if (groupBy === 'currency') return attribution.byCurrency
  return attribution.byMarket
}

interface ReturnAttributionPanelProps {
  attribution: ReturnAttribution
  historicalRatesLoading: boolean
}

export function ReturnAttributionPanel({
  attribution,
  historicalRatesLoading,
}: ReturnAttributionPanelProps) {
  const [groupBy, setGroupBy] = useState<AttributionGroupBy>('asset')
  const rows = itemList(attribution, groupBy)
  const topRows = rows.slice(0, 5)
  const maxAbsReturn = topRows.reduce((max, item) => Math.max(max, Math.abs(item.totalReturnCNY)), 0)

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-white">收益归因</CardTitle>
          <div className="flex items-center gap-2 rounded-full border border-border/50 bg-background/40 px-3 py-1 text-xs text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            <span>
              {historicalRatesLoading
                ? '历史汇率加载中'
                : attribution.usedHistoricalRates ? '按历史汇率拆分' : '部分使用当前汇率估算'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Metric
            label="价格涨跌"
            value={attribution.totals.priceReturnCNY}
            detail="按买入日汇率"
            icon={TrendingUp}
          />
          <Metric
            label="分红收益"
            value={attribution.totals.dividendReturnCNY}
            detail="按派息日汇率"
            icon={CircleDollarSign}
          />
          <Metric
            label="汇率收益"
            value={attribution.totals.fxReturnCNY}
            detail="现价敞口折算"
            icon={BarChart3}
          />
          <Metric
            label="已实现收益"
            value={attribution.totals.realizedReturnCNY}
            detail="卖出记录估算"
            icon={CircleDollarSign}
          />
          <Metric
            label="未实现收益"
            value={attribution.totals.unrealizedReturnCNY}
            detail="价格 + 汇率"
            icon={TrendingUp}
          />
          <Metric
            label="总收益"
            value={attribution.totals.totalReturnCNY}
            detail={`成本 ${formatMoney(attribution.totals.costCNY, 'CNY')}`}
            icon={BarChart3}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-white">贡献 Top 5</h3>
              <span className="text-xs text-muted-foreground">按{groupLabel(groupBy)}</span>
            </div>
            {topRows.length === 0 ? (
              <div className="rounded-lg border border-border/40 bg-background/40 p-4 text-sm text-muted-foreground">
                暂无可归因数据
              </div>
            ) : (
              <div className="space-y-3">
                {topRows.map((item) => (
                  <ContributionBar key={item.key} item={item} maxAbsReturn={maxAbsReturn} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1 rounded-lg border border-border/50 bg-background/40 p-1">
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
              <span className="text-xs text-muted-foreground">
                贡献率 = 分组收益 / 总收益
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-border/40">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">{groupLabel(groupBy)}</TableHead>
                    <TableHead className="text-right text-muted-foreground">价格</TableHead>
                    <TableHead className="text-right text-muted-foreground">分红</TableHead>
                    <TableHead className="text-right text-muted-foreground">汇率</TableHead>
                    <TableHead className="text-right text-muted-foreground">已实现</TableHead>
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
                        {signedMoney(item.priceReturnCNY)}
                      </TableCell>
                      <TableCell className={cn('text-right font-mono text-sm', amountClass(item.dividendReturnCNY))}>
                        {signedMoney(item.dividendReturnCNY)}
                      </TableCell>
                      <TableCell className={cn('text-right font-mono text-sm', amountClass(item.fxReturnCNY))}>
                        {signedMoney(item.fxReturnCNY)}
                      </TableCell>
                      <TableCell className={cn('text-right font-mono text-sm', amountClass(item.realizedReturnCNY))}>
                        {signedMoney(item.realizedReturnCNY)}
                      </TableCell>
                      <TableCell className={cn('text-right font-mono text-sm font-medium', amountClass(item.totalReturnCNY))}>
                        {signedMoney(item.totalReturnCNY)}
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
        </div>
      </CardContent>
    </Card>
  )
}
