import { useState } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'

import { contractMultiplier, costValue } from '@/lib/calc'
import { formatMoney } from '@/lib/currency'
import type { Asset } from '@/lib/types'
import { cn } from '@/lib/utils'

export type SettleOutcome = 'expire' | 'close' | 'exercise'

interface Props {
  open: boolean
  onClose: () => void
  lots: Asset[]
  onConfirm: (outcome: SettleOutcome, closePrice?: number) => Promise<void>
}

function settlePnl(lots: Asset[], closePrice?: number): number {
  return lots.reduce((sum, a) => {
    const mult = contractMultiplier(a)
    const cost = costValue(a)
    const proceeds = closePrice != null ? closePrice * a.quantity * mult : 0
    return sum + proceeds - cost
  }, 0)
}

export function OptionSettleModal({ open, onClose, lots, onConfirm }: Props) {
  const [outcome, setOutcome] = useState<SettleOutcome | null>(null)
  const [closePrice, setClosePrice] = useState('')
  const [loading, setLoading] = useState(false)

  function reset() {
    setOutcome(null)
    setClosePrice('')
    setLoading(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleConfirm() {
    if (!outcome) return
    const price = outcome === 'close' ? parseFloat(closePrice) : undefined
    if (outcome === 'close' && (price == null || isNaN(price) || price < 0)) return
    setLoading(true)
    await onConfirm(outcome, price)
    reset()
  }

  if (!open) return null
  const ref = lots[0]
  if (!ref) return null

  const currency = ref.currency
  const isShort = lots.some((a) => a.direction === 'short' || a.quantity < 0)
  const totalQty = lots.reduce((s, a) => s + Math.abs(a.quantity), 0)
  const mult = contractMultiplier(ref)
  const closePriceValid =
    closePrice !== '' && !isNaN(parseFloat(closePrice)) && parseFloat(closePrice) >= 0

  const pnlPreview =
    outcome === 'close' && closePriceValid
      ? settlePnl(lots, parseFloat(closePrice))
      : outcome === 'expire'
        ? settlePnl(lots)
        : null

  const pnlColor =
    pnlPreview != null ? (pnlPreview >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]') : ''

  const outcomeOptions: { value: SettleOutcome; label: string; desc: string; cls: string }[] = [
    {
      value: 'expire',
      label: '到期作废',
      desc: isShort ? '期权作废，权利金已落袋' : '到期归零，权利金全失',
      cls: 'border-red-500/30 hover:border-red-500/60 hover:bg-red-500/5',
    },
    {
      value: 'close',
      label: '提前平仓',
      desc: isShort ? '买回期权，锁定盈亏' : '卖出期权，锁定盈亏',
      cls: 'border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5',
    },
    {
      value: 'exercise',
      label: '到期行权',
      desc: '期权行权，转为正股持仓',
      cls: 'border-yellow-500/30 hover:border-yellow-500/60 hover:bg-yellow-500/5',
    },
  ]

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/70" onClick={handleClose} />
      <div className="fixed left-1/2 top-1/2 z-[70] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border/50 bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">了结期权</h3>
          <button
            onClick={handleClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!outcome ? (
          <div className="space-y-2">
            <p className="mb-3 text-sm text-muted-foreground">
              {ref.symbol}
              {ref.optionType && <> · {ref.optionType.toUpperCase()}</>}
              {ref.strikePrice != null && <> · ${ref.strikePrice}</>}
              {ref.expiryDate && <> · {ref.expiryDate}</>}
            </p>
            {outcomeOptions.map((o) => (
              <button
                key={o.value}
                onClick={() => setOutcome(o.value)}
                className={cn('w-full rounded-lg border px-4 py-3 text-left transition-colors', o.cls)}
              >
                <p className="text-sm font-medium text-white">{o.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{o.desc}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm">
              <span className="text-white">{ref.symbol}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {outcome === 'expire' ? '到期作废' : outcome === 'close' ? '提前平仓' : '到期行权'}
              </span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {totalQty} 张 × {mult} = {totalQty * mult} 股
              </span>
            </div>

            {outcome === 'close' && (
              <div>
                <label className="mb-1.5 block text-xs text-muted-foreground">
                  平仓价格（{currency}）
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={closePrice}
                  onChange={(e) => setClosePrice(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:border-blue-500/50 focus:outline-none"
                />
              </div>
            )}

            {pnlPreview != null && (
              <div className="flex items-center rounded-lg border border-border/30 bg-background/30 px-3 py-2">
                <span className="text-xs text-muted-foreground">结算盈亏</span>
                <span className={cn('ml-auto font-mono text-sm font-semibold', pnlColor)}>
                  {pnlPreview >= 0 ? '+' : ''}
                  {formatMoney(pnlPreview, currency)}
                </span>
              </div>
            )}

            {outcome === 'exercise' && (
              <div className="flex gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-400" />
                <p className="text-xs text-muted-foreground">
                  行权后请手动新建对应股票仓位
                  {ref.underlyingSymbol && (
                    <>：<span className="text-white">{ref.underlyingSymbol}</span></>
                  )}
                  {ref.strikePrice != null && (
                    <>
                      {' '}
                      · 行权价{' '}
                      <span className="font-mono text-white">
                        {formatMoney(ref.strikePrice, currency)}
                      </span>
                    </>
                  )}
                  {mult > 1 && (
                    <>
                      {' '}
                      · 共{' '}
                      <span className="font-mono text-white">{totalQty * mult} 股</span>
                    </>
                  )}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOutcome(null)}
                disabled={loading}
                className="flex-1 rounded-lg border border-border/50 py-2 text-sm text-muted-foreground transition-colors hover:text-white disabled:opacity-50"
              >
                返回
              </button>
              <button
                disabled={loading || (outcome === 'close' && !closePriceValid)}
                onClick={handleConfirm}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-500/80 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <span>处理中…</span>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    确认了结
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
