import { useState } from 'react'
import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AssetDraft } from '@/hooks/useAssets'
import { useEditMode } from '@/hooks/useEditMode'
import type { Asset } from '@/lib/types'

type TxType = 'buy' | 'sell' | 'dividend'

const TAB_LABELS: Record<TxType, string> = {
  buy: '买入/加仓',
  sell: '卖出',
  dividend: '分红',
}
const TABS: TxType[] = ['buy', 'sell', 'dividend']

interface TransactionEntryProps {
  refAsset: Asset
  onAdd: (draft: AssetDraft) => Promise<boolean>
}

export function TransactionEntry({ refAsset, onAdd }: TransactionEntryProps) {
  const { isReadOnly } = useEditMode()
  const [open, setOpen] = useState(false)
  const [txType, setTxType] = useState<TxType>('buy')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isReadOnly) return null

  function reset() {
    setDate(new Date().toISOString().slice(0, 10))
    setQty('')
    setPrice('')
    setAmount('')
    setError(null)
  }

  function close() {
    setOpen(false)
    reset()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const qtyNum = parseFloat(qty)
    const priceNum = parseFloat(price)
    const amountNum = parseFloat(amount)

    if (txType !== 'dividend') {
      if (!qty || isNaN(qtyNum) || qtyNum <= 0) { setError('数量必须大于 0'); return }
      if (!price || isNaN(priceNum) || priceNum <= 0) { setError('价格必须大于 0'); return }
    } else {
      if (!amount || isNaN(amountNum) || amountNum <= 0) { setError('金额必须大于 0'); return }
    }

    const draft: AssetDraft = {
      symbol: refAsset.symbol,
      category: refAsset.category,
      market: refAsset.market,
      currency: refAsset.currency,
      owner: refAsset.owner,
      purchasedAt: date,
      note: '',
      dividends: txType === 'dividend' ? amountNum : 0,
      quantity: txType === 'buy' ? qtyNum : txType === 'sell' ? -qtyNum : 0,
      costBasis: txType === 'buy' ? priceNum : 0,
      currentPrice: txType !== 'dividend' ? priceNum : 0,
      optionType: refAsset.optionType,
      underlyingSymbol: refAsset.underlyingSymbol,
      strikePrice: refAsset.strikePrice,
      expiryDate: refAsset.expiryDate,
      contractMultiplier: refAsset.contractMultiplier ?? 1,
    }

    setSubmitting(true)
    const ok = await onAdd(draft)
    setSubmitting(false)
    if (ok) close()
  }

  return (
    <div className="rounded-lg border border-dashed border-border/40">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          记一笔
        </button>
      ) : (
        <div className="p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTxType(t); setError(null) }}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    txType === t
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:text-white'
                  }`}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={close}
              className="rounded p-0.5 text-muted-foreground hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">日期</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              {txType !== 'dividend' ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {txType === 'sell' ? '卖出数量' : '买入数量'}
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    分红金额（{refAsset.currency}）
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              )}
            </div>

            {txType !== 'dividend' && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {txType === 'sell' ? '卖出价' : '买入价'}（{refAsset.currency}）
                </Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}

            {error && <p className="text-xs text-[#ef4444]">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" disabled={submitting} className="h-8 px-3 text-xs">
                {submitting ? '提交中…' : '确认记录'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={close}
              >
                取消
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
