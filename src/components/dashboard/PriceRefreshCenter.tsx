import { useState } from 'react'

import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatMoney } from '@/lib/currency'
import type { PriceRefreshStatus } from '@/lib/types'
import { MARKET_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

type DisplayStatus = 'success' | 'failed' | 'skipped' | 'manual'

interface GroupedPriceRefreshStatus extends PriceRefreshStatus {
  count: number
  assetIds: string[]
}

function normalizedStatus(item: PriceRefreshStatus): DisplayStatus {
  if (item.status === 'failed' && item.errorMessage === 'unsupported refresh source') return 'skipped'
  return item.status
}

function normalizedError(item: PriceRefreshStatus): string {
  if (item.errorMessage === 'unsupported refresh source' || item.errorMessage === 'no refresh source') {
    return '暂无自动刷新源'
  }
  return item.errorMessage || ''
}

function statusClass(status: string): string {
  if (status === 'success') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
  if (status === 'failed') return 'border-red-500/50 bg-red-500/10 text-red-300'
  return 'border-border/50 bg-background/60 text-muted-foreground'
}

function statusLabel(status: string): string {
  if (status === 'success') return '成功'
  if (status === 'failed') return '失败'
  if (status === 'manual') return '手动'
  return '跳过'
}

function formatTime(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusDotClass(status: string): string {
  if (status === 'success') return 'bg-emerald-400'
  if (status === 'failed') return 'bg-red-400'
  return 'bg-muted-foreground'
}

function groupStatuses(statuses: PriceRefreshStatus[]): GroupedPriceRefreshStatus[] {
  const groups = new Map<string, GroupedPriceRefreshStatus>()
  for (const item of statuses) {
    const status = normalizedStatus(item)
    const errorMessage = normalizedError(item)
    const key = [
      item.symbol,
      item.market,
      item.category,
      item.currency,
      item.owner,
      item.source,
      status,
      errorMessage,
    ].join('|')
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
      existing.quantity += item.quantity
      existing.assetIds.push(item.assetId)
      if (item.lastSuccessAt > existing.lastSuccessAt) existing.lastSuccessAt = item.lastSuccessAt
      if (item.lastAttemptAt > existing.lastAttemptAt) existing.lastAttemptAt = item.lastAttemptAt
      if (item.updatedAt > existing.updatedAt) existing.updatedAt = item.updatedAt
      continue
    }
    groups.set(key, {
      ...item,
      status,
      errorMessage,
      count: 1,
      assetIds: [item.assetId],
    })
  }
  return [...groups.values()]
}

interface PriceRefreshCenterProps {
  statuses: PriceRefreshStatus[]
  loading: boolean
  refreshing: boolean
  onRefreshAll: () => void
  onRefreshOne: (assetId: string) => void
}

export function PriceRefreshCenter({
  statuses,
  loading,
  refreshing,
  onRefreshAll,
  onRefreshOne,
}: PriceRefreshCenterProps) {
  const [expanded, setExpanded] = useState(false)
  const groupedStatuses = groupStatuses(statuses)
  const success = groupedStatuses.filter((item) => item.status === 'success').length
  const failed = groupedStatuses.filter((item) => item.status === 'failed').length
  const skipped = groupedStatuses.filter((item) => item.status === 'skipped').length
  const failedItems = groupedStatuses.filter((item) => item.status === 'failed')
  const latestSuccess = groupedStatuses
    .map((item) => item.lastSuccessAt)
    .filter(Boolean)
    .sort()
    .at(-1)
  const detailRows = [
    ...failedItems,
    ...groupedStatuses.filter((item) => item.status !== 'failed'),
  ]

  return (
    <Card className={failed > 0 || expanded ? undefined : 'bg-card/70'}>
      <CardContent className={failed > 0 || expanded ? 'p-4' : 'p-3'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={cn(
              'flex shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background/50',
              failed > 0 || expanded ? 'h-9 w-9' : 'h-8 w-8',
            )}>
              <RefreshCw className={cn('h-4 w-4 text-muted-foreground', refreshing && 'animate-spin')} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-white">价格刷新</h3>
                <span className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px]',
                  failed > 0
                    ? 'border-red-500/50 bg-red-500/10 text-red-300'
                    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
                )}>
                  {failed > 0 ? `${failed} 个标的失败` : '状态正常'}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {loading
                  ? '加载刷新状态中…'
                  : failed > 0
                    ? `${success} 个标的成功 / ${failed} 失败 / ${skipped} 跳过${latestSuccess ? ` · 最近 ${formatTime(latestSuccess)}` : ''}`
                    : `${success} 个标的已同步${skipped > 0 ? ` / ${skipped} 个跳过` : ''}${latestSuccess ? ` · 最近 ${formatTime(latestSuccess)}` : ''}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-xs text-muted-foreground"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              明细
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-2 px-3 text-xs"
              disabled={refreshing}
              onClick={onRefreshAll}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              全部刷新
            </Button>
          </div>
        </div>

        {failedItems.length > 0 && !expanded ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {failedItems.slice(0, 3).map((item) => (
              <div
                key={item.assetId}
                className="max-w-full truncate rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs text-red-200"
                title={`${item.symbol}: ${item.errorMessage || '刷新失败'}`}
              >
                {item.symbol}{item.count > 1 ? ` × ${item.count}` : ''}：{item.errorMessage || '刷新失败，已保留旧价格'}
              </div>
            ))}
            {failedItems.length > 3 ? (
              <div className="rounded-md border border-border/40 px-2.5 py-1 text-xs text-muted-foreground">
                另 {failedItems.length - 3} 项
              </div>
            ) : null}
          </div>
        ) : null}

        {expanded ? (
          <div className="mt-4 max-h-[300px] overflow-auto rounded-lg border border-border/40">
            {detailRows.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                {loading ? '加载中…' : '暂无价格刷新状态'}
              </div>
            ) : detailRows.map((item) => (
              <div
                key={`${item.assetId}-${item.status}-${item.errorMessage}`}
                className="grid grid-cols-[minmax(0,1.4fr)_96px_92px_112px_72px] items-center gap-3 border-b border-border/30 px-3 py-2.5 last:border-b-0 hover:bg-white/5"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', statusDotClass(item.status))} />
                    <p className="truncate text-sm font-medium text-white" title={item.symbol}>
                      {item.symbol}
                    </p>
                    {item.count > 1 ? (
                      <span className="shrink-0 rounded-full border border-border/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        × {item.count}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground" title={item.errorMessage || item.source}>
                    {item.status === 'failed' || item.status === 'skipped'
                      ? item.errorMessage || `${MARKET_LABELS[item.market] ?? item.market} · ${item.source || '—'}`
                      : `${MARKET_LABELS[item.market] ?? item.market} · ${item.source || '—'}`}
                  </p>
                </div>
                <div className="font-mono text-xs text-white">
                  {formatMoney(item.currentPrice, item.currency)}
                </div>
                <div>
                  <span className={cn('rounded-full border px-2 py-0.5 text-xs', statusClass(item.status))}>
                    {statusLabel(item.status)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatTime(item.lastSuccessAt)}
                </div>
                <div className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={refreshing}
                    onClick={() => onRefreshOne(item.assetIds[0])}
                  >
                    刷新
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
