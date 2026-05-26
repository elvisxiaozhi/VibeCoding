import { useEffect } from 'react'
import { ArrowDown, ArrowUp, CircleDollarSign, X } from 'lucide-react'

import { usePrivacy } from '@/context/PrivacyContext'
import { formatMoney, toCNY } from '@/lib/currency'
import { contractMultiplier, costValue, marketValue } from '@/lib/calc'
import { CATEGORY_LABELS, type Asset, type AssetCategory } from '@/lib/types'
import type { PerformanceSummary } from '@/components/dashboard/PerformancePanel'
import { cn } from '@/lib/utils'

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseOrigQty(note: string): number {
  const m = note.match(/orig_qty:([\d.]+)/)
  return m ? parseFloat(m[1]) : 0
}

function pnlClass(v: number) {
  return v > 0 ? 'text-[#ef4444]' : v < 0 ? 'text-[#22c55e]' : 'text-muted-foreground'
}

function fmtPct(v: number) {
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`
}

// ─── timeline ─────────────────────────────────────────────────────────────────

type EventType = 'buy' | 'sell' | 'dividend'

interface TxEvent {
  date: string
  type: EventType
  qty: number
  price: number
  total: number
  currency: string
  runningQty: number
  avgCost: number | null
}

function buildTimeline(
  symHoldings: Asset[],
  symDivs: Asset[],
  symConsumed: Asset[],
  symSells: Asset[],
): TxEvent[] {
  const raw: Omit<TxEvent, 'runningQty' | 'avgCost'>[] = []

  for (const a of symHoldings) {
    const mult = contractMultiplier(a)
    raw.push({ date: a.purchasedAt.slice(0, 10), type: 'buy', qty: a.quantity, price: a.costBasis, total: a.costBasis * a.quantity * mult, currency: a.currency })
  }
  for (const a of symConsumed) {
    const origQty = parseOrigQty(a.note ?? '')
    if (origQty <= 0) continue
    const mult = contractMultiplier(a)
    raw.push({ date: a.purchasedAt.slice(0, 10), type: 'buy', qty: origQty, price: a.costBasis, total: a.costBasis * origQty * mult, currency: a.currency })
  }
  for (const a of symSells) {
    const mult = contractMultiplier(a)
    const qty = Math.abs(a.quantity)
    raw.push({ date: a.purchasedAt.slice(0, 10), type: 'sell', qty, price: a.currentPrice, total: a.currentPrice * qty * mult, currency: a.currency })
  }
  for (const a of symDivs) {
    raw.push({ date: a.purchasedAt.slice(0, 10), type: 'dividend', qty: 0, price: 0, total: a.dividends ?? 0, currency: a.currency })
  }

  raw.sort((a, b) => a.date.localeCompare(b.date))

  // running avg cost (weighted average method)
  let runQty = 0
  let runCost = 0
  return raw.map((e) => {
    if (e.type === 'buy') {
      runQty += e.qty
      runCost += e.total
    } else if (e.type === 'sell') {
      const avg = runQty > 0 ? runCost / runQty : 0
      runCost -= avg * e.qty
      runQty -= e.qty
      if (runQty < 0.0001) { runQty = 0; runCost = 0 }
    }
    return { ...e, runningQty: runQty, avgCost: runQty > 0 ? runCost / runQty : null }
  })
}

// ─── component ────────────────────────────────────────────────────────────────

interface AssetDetailSheetProps {
  symbol: string | null
  open: boolean
  onClose: () => void
  holdings: Asset[]
  divRecords: Asset[]
  consumedRecords: Asset[]
  sellRecords: Asset[]
  summaries: PerformanceSummary[]
  rates: Record<string, number>
}

export function AssetDetailSheet({
  symbol,
  open,
  onClose,
  holdings,
  divRecords,
  consumedRecords,
  sellRecords,
  summaries,
  rates,
}: AssetDetailSheetProps) {
  const { mask } = usePrivacy()
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!symbol) return null

  const symHoldings = holdings.filter((a) => a.symbol === symbol)
  const symDivs = divRecords.filter((a) => a.symbol === symbol)
  const symConsumed = consumedRecords.filter((a) => a.symbol === symbol)
  const symSells = sellRecords.filter((a) => a.symbol === symbol)

  const ref = symHoldings[0] ?? symConsumed[0] ?? symSells[0]
  const currency = ref?.currency ?? 'CNY'
  const category = ref?.category ?? 'stock'
  const summary = summaries.find((s) => s.symbol === symbol)

  const totalMV = symHoldings.reduce((s, a) => s + marketValue(a), 0)
  const totalCost = symHoldings.reduce((s, a) => s + costValue(a), 0)
  const totalDividends = symDivs.reduce((s, a) => s + (a.dividends ?? 0), 0)
  const totalQty = symHoldings.reduce((s, a) => s + a.quantity, 0)
  const pnl = totalMV - totalCost + totalDividends
  const pnlRate = totalCost === 0 ? 0 : pnl / totalCost
  const avgCostPerUnit = totalQty === 0 ? 0 : totalCost / totalQty
  const currentPrice = symHoldings[0]?.currentPrice ?? 0

  const mvCNY = toCNY(totalMV, currency, rates)
  const costCNY = toCNY(totalCost, currency, rates)
  const pnlCNY = toCNY(pnl, currency, rates)

  const timeline = buildTimeline(symHoldings, symDivs, symConsumed, symSells)

  const eventLabel: Record<EventType, string> = { buy: '买入', sell: '卖出', dividend: '分红' }
  const eventColor: Record<EventType, string> = {
    buy: 'text-[#34d399] bg-[#34d399]/10',
    sell: 'text-[#f87171] bg-[#f87171]/10',
    dividend: 'text-[#fbbf24] bg-[#fbbf24]/10',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-[500px] flex-col border-l border-border/50 bg-card shadow-2xl transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/40 px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-white">{symbol}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {CATEGORY_LABELS[category as AssetCategory] ?? category} · {currency}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground transition-colors hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <p className="text-xs text-muted-foreground">持仓市值</p>
              <p className="mt-1 font-mono text-base font-semibold text-white">{mask(formatMoney(totalMV, currency))}</p>
              {currency !== 'CNY' && <p className="mt-0.5 text-xs text-muted-foreground">≈ {mask(formatMoney(mvCNY, 'CNY'))}</p>}
            </div>
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <p className="text-xs text-muted-foreground">投入成本</p>
              <p className="mt-1 font-mono text-base font-semibold text-white">{mask(formatMoney(totalCost, currency))}</p>
              {currency !== 'CNY' && <p className="mt-0.5 text-xs text-muted-foreground">≈ {mask(formatMoney(costCNY, 'CNY'))}</p>}
            </div>
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <p className="text-xs text-muted-foreground">浮动盈亏</p>
              <p className={cn('mt-1 font-mono text-base font-semibold', pnlClass(pnl))}>
                {mask(`${pnl >= 0 ? '+' : ''}${formatMoney(pnl, currency)}`)}
              </p>
              <p className={cn('mt-0.5 text-xs', pnlClass(pnlRate))}>{fmtPct(pnlRate)}{currency !== 'CNY' && ` · ≈ ${mask(`${pnl >= 0 ? '+' : ''}${formatMoney(pnlCNY, 'CNY')}`)}`}</p>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <p className="text-xs text-muted-foreground">XIRR 年化</p>
              <p className={cn('mt-1 font-mono text-base font-semibold', summary?.annReturn != null ? pnlClass(summary.annReturn) : 'text-muted-foreground')}>
                {summary?.annReturn != null ? fmtPct(summary.annReturn) : '—'}
              </p>
              {totalDividends > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">累计分红 {mask(formatMoney(totalDividends, currency))}</p>
              )}
            </div>
          </div>

          {/* Current position */}
          {totalQty > 0 && (
            <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2.5">
              <p className="mb-2 text-xs text-muted-foreground">当前持仓</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <span className="text-muted-foreground">持仓量 <span className="font-mono text-white">{totalQty.toLocaleString()}</span></span>
                <span className="text-muted-foreground">现价 <span className="font-mono text-white">{mask(formatMoney(currentPrice, currency))}</span></span>
                <span className="text-muted-foreground">均价 <span className="font-mono text-white">{mask(formatMoney(avgCostPerUnit, currency))}</span></span>
              </div>
              {symHoldings.length > 1 && (
                <div className="mt-2 space-y-1">
                  {symHoldings.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="w-24 shrink-0">{a.purchasedAt.slice(0, 10)}</span>
                      <span className="font-mono text-white">{a.quantity} 股</span>
                      <span>@ {mask(formatMoney(a.costBasis, currency))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div>
            <p className="mb-2 text-sm font-medium text-white">逐笔时间线</p>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无记录</p>
            ) : (
              <div className="space-y-1">
                {timeline.map((ev, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border border-border/30 bg-background/30 px-3 py-2">
                    {/* Icon */}
                    <div className="mt-0.5 shrink-0">
                      {ev.type === 'buy' && <ArrowDown className="h-3.5 w-3.5 text-[#34d399]" />}
                      {ev.type === 'sell' && <ArrowUp className="h-3.5 w-3.5 text-[#f87171]" />}
                      {ev.type === 'dividend' && <CircleDollarSign className="h-3.5 w-3.5 text-[#fbbf24]" />}
                    </div>
                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-xs text-muted-foreground">{ev.date}</span>
                        <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', eventColor[ev.type])}>
                          {eventLabel[ev.type]}
                        </span>
                        {ev.type !== 'dividend' && (
                          <>
                            <span className="font-mono text-xs text-white">{ev.qty.toLocaleString()} 股</span>
                            <span className="text-xs text-muted-foreground">@ {mask(formatMoney(ev.price, ev.currency))}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span>
                          总额 <span className={cn('font-mono', ev.type === 'sell' ? 'text-[#ef4444]' : ev.type === 'dividend' ? 'text-[#fbbf24]' : 'text-white')}>
                            {mask(`${ev.type === 'sell' ? '+' : ev.type === 'buy' ? '-' : '+'}${formatMoney(ev.total, ev.currency)}`)}
                          </span>
                        </span>
                        {ev.type !== 'dividend' && (
                          <span>
                            持仓 <span className="font-mono text-white">{ev.runningQty.toLocaleString()}</span>
                            {ev.avgCost != null && (
                              <> · 均价 <span className="font-mono text-white">{mask(formatMoney(ev.avgCost, ev.currency))}</span></>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
