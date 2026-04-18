import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Asset, AssetCategory, CurrencyCode, MarketType } from '@/lib/types'
import { CATEGORY_LABELS, CATEGORY_ORDER, CURRENCY_CODES, CURRENCY_LABELS, MARKET_LABELS, MARKET_ORDER } from '@/lib/types'

interface AssetFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 编辑模式时传入现有资产，新增模式传 undefined */
  asset?: Asset
  onSubmit: (data: AssetFormData) => void
}

export interface AssetFormData {
  symbol: string
  category: AssetCategory
  market: MarketType
  costBasis: number
  currentPrice: number
  quantity: number
  currency: string
  purchasedAt: string
}

interface FormErrors {
  symbol?: string
  costBasis?: string
  currentPrice?: string
  quantity?: string
}

const EMPTY_FORM: AssetFormData = {
  symbol: '',
  category: 'stock',
  market: 'cn',
  costBasis: 0,
  currentPrice: 0,
  quantity: 0,
  currency: 'CNY',
  purchasedAt: new Date().toISOString().slice(0, 10),
}

export function AssetForm({
  open,
  onOpenChange,
  asset,
  onSubmit,
}: AssetFormProps) {
  const isEdit = !!asset
  const [form, setForm] = useState<AssetFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})

  const isCurrency = form.category === 'currency'

  // 打开弹窗时：编辑模式预填充，新增模式重置
  useEffect(() => {
    if (!open) return
    if (asset) {
      setForm({
        symbol: asset.symbol,
        category: asset.category as AssetCategory,
        market: asset.market as MarketType,
        costBasis: asset.costBasis,
        currentPrice: asset.currentPrice,
        quantity: asset.quantity,
        currency: asset.currency,
        purchasedAt: asset.purchasedAt ? asset.purchasedAt.slice(0, 10) : asset.createdAt.slice(0, 10),
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setErrors({})
  }, [open, asset])

  function validate(): boolean {
    const e: FormErrors = {}
    if (!form.symbol.trim()) e.symbol = isCurrency ? '请选择货币' : '请输入资产代码/名称'
    if (form.costBasis <= 0) e.costBasis = isCurrency ? '买入汇率必须大于 0' : '成本价必须大于 0'
    if (form.currentPrice <= 0) e.currentPrice = isCurrency ? '当前汇率必须大于 0' : '现价必须大于 0'
    if (form.quantity <= 0) e.quantity = '数量必须大于 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    onSubmit(form)
    onOpenChange(false)
  }

  function setField<K extends keyof AssetFormData>(key: K, value: AssetFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleCategoryChange(cat: AssetCategory) {
    setField('category', cat)
    // 切换到货币分类时，重置 symbol 为第一个货币
    if (cat === 'currency' && form.category !== 'currency') {
      setField('symbol', 'CNY 人民币')
    }
    // 从货币切换到其他分类时，清空 symbol
    if (cat !== 'currency' && form.category === 'currency') {
      setField('symbol', '')
    }
  }

  function handleCurrencySelect(code: CurrencyCode) {
    const label = CURRENCY_LABELS[code]
    setField('symbol', `${code} ${label}`)
  }

  // 从 symbol 中提取当前选中的货币代码
  const selectedCurrencyCode = isCurrency
    ? (CURRENCY_CODES.find((c) => form.symbol.startsWith(c)) ?? 'CNY')
    : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEdit ? '编辑资产' : '新增资产'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? '修改资产信息后点击保存。'
              : '填写资产信息后点击新增。'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 分类 */}
          <div className="space-y-2">
            <Label htmlFor="category">分类</Label>
            <select
              id="category"
              value={form.category}
              onChange={(e) => handleCategoryChange(e.target.value as AssetCategory)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {CATEGORY_ORDER.map((cat) => (
                <option key={cat} value={cat} className="bg-[#1a1a1a]">
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          {/* 板块 */}
          <div className="space-y-2">
            <Label htmlFor="market">板块</Label>
            <select
              id="market"
              value={form.market}
              onChange={(e) => setField('market', e.target.value as MarketType)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {MARKET_ORDER.map((m) => (
                <option key={m} value={m} className="bg-[#1a1a1a]">
                  {MARKET_LABELS[m]}
                </option>
              ))}
            </select>
          </div>

          {/* 代码/名称 或 货币选择 */}
          <div className="space-y-2">
            <Label htmlFor="symbol">{isCurrency ? '货币' : '资产代码/名称'}</Label>
            {isCurrency ? (
              <select
                id="symbol"
                value={selectedCurrencyCode}
                onChange={(e) => handleCurrencySelect(e.target.value as CurrencyCode)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code} className="bg-[#1a1a1a]">
                    {code} {CURRENCY_LABELS[code]}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="symbol"
                placeholder="如 AAPL、BTC 比特币"
                value={form.symbol}
                onChange={(e) => setField('symbol', e.target.value)}
              />
            )}
            {errors.symbol ? (
              <p className="text-xs text-[#ef4444]">{errors.symbol}</p>
            ) : null}
          </div>

          {/* 成本价/买入汇率 + 现价/当前汇率 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="costBasis">{isCurrency ? '买入汇率' : '成本价'}</Label>
              <Input
                id="costBasis"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={form.costBasis || ''}
                onChange={(e) =>
                  setField('costBasis', parseFloat(e.target.value) || 0)
                }
              />
              {errors.costBasis ? (
                <p className="text-xs text-[#ef4444]">{errors.costBasis}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentPrice">{isCurrency ? '当前汇率' : '现价'}</Label>
              <Input
                id="currentPrice"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={form.currentPrice || ''}
                onChange={(e) =>
                  setField('currentPrice', parseFloat(e.target.value) || 0)
                }
              />
              {errors.currentPrice ? (
                <p className="text-xs text-[#ef4444]">{errors.currentPrice}</p>
              ) : null}
            </div>
          </div>

          {/* 数量 */}
          <div className="space-y-2">
            <Label htmlFor="quantity">{isCurrency ? '持有数量' : '数量'}</Label>
            <Input
              id="quantity"
              type="number"
              step="any"
              min="0"
              placeholder="0"
              value={form.quantity || ''}
              onChange={(e) =>
                setField('quantity', parseFloat(e.target.value) || 0)
              }
            />
            {errors.quantity ? (
              <p className="text-xs text-[#ef4444]">{errors.quantity}</p>
            ) : null}
          </div>

          {/* 买入日期 */}
          <div className="space-y-2">
            <Label htmlFor="purchasedAt">买入日期</Label>
            <Input
              id="purchasedAt"
              type="date"
              value={form.purchasedAt}
              onChange={(e) => setField('purchasedAt', e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit">{isEdit ? '保存' : '新增'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
