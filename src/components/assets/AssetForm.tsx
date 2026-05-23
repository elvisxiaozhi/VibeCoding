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
import type { Asset, AssetCategory, CurrencyCode, MarketType, OwnerType } from '@/lib/types'
import { CATEGORY_LABELS, CATEGORY_ORDER, CURRENCY_CODES, CURRENCY_LABELS, MARKET_LABELS, MARKET_ORDER, OWNER_LABELS, OWNER_OPTIONS } from '@/lib/types'

interface AssetFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 编辑模式时传入现有资产，新增模式传 undefined */
  asset?: Asset
  onSubmit: (data: AssetFormData) => Promise<boolean>
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
  dividends: number
  owner: OwnerType
  note: string
  optionType: '' | 'call' | 'put'
  underlyingSymbol: string
  strikePrice: number
  expiryDate: string
  contractMultiplier: number
}

interface FormErrors {
  symbol?: string
  costBasis?: string
  currentPrice?: string
  quantity?: string
  underlyingSymbol?: string
  strikePrice?: string
  expiryDate?: string
  contractMultiplier?: string
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
  dividends: 0,
  owner: 'me',
  note: '',
  optionType: '',
  underlyingSymbol: '',
  strikePrice: 0,
  expiryDate: '',
  contractMultiplier: 1,
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
  const [submitting, setSubmitting] = useState(false)

  const isCurrency = form.category === 'currency'
  const isOption = form.category === 'option'
  const isBalanceAsset = form.category === 'cash' || form.category === 'currency' || form.category === 'provident_fund'

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
        dividends: asset.dividends ?? 0,
        owner: (asset.owner as OwnerType) || 'me',
        note: asset.note ?? '',
        optionType: asset.optionType ?? '',
        underlyingSymbol: asset.underlyingSymbol ?? '',
        strikePrice: asset.strikePrice ?? 0,
        expiryDate: asset.expiryDate ?? '',
        contractMultiplier: asset.contractMultiplier ?? 1,
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setErrors({})
  }, [open, asset])

  function validate(): boolean {
    const e: FormErrors = {}
    if (!isOption && !form.symbol.trim()) e.symbol = isCurrency ? '请选择货币' : '请输入资产代码/名称'
    if (!isBalanceAsset && form.costBasis <= 0) e.costBasis = '成本价必须大于 0'
    if (!isBalanceAsset && form.currentPrice <= 0) e.currentPrice = '现价必须大于 0'
    if (isOption && form.quantity === 0) e.quantity = '合约数量不能为 0'
    if (!isOption && form.quantity <= 0) e.quantity = isBalanceAsset ? '余额必须大于 0' : '数量必须大于 0'
    if (isOption && !form.underlyingSymbol.trim()) e.underlyingSymbol = '请输入期权标的'
    if (isOption && form.strikePrice <= 0) e.strikePrice = '行权价必须大于 0'
    if (isOption && !form.expiryDate) e.expiryDate = '请选择到期日'
    if (isOption && form.contractMultiplier <= 0) e.contractMultiplier = '合约乘数必须大于 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    const ok = await onSubmit({
      ...form,
      costBasis: isBalanceAsset && form.costBasis <= 0 ? 1 : form.costBasis,
      currentPrice: isBalanceAsset && form.currentPrice <= 0 ? 1 : form.currentPrice,
      symbol: isOption
        ? `${form.underlyingSymbol.trim()} ${form.expiryDate} ${form.optionType === 'put' ? 'P' : 'C'} ${form.strikePrice}`
        : form.symbol,
      optionType: isOption ? (form.optionType || 'call') : '',
      underlyingSymbol: isOption ? form.underlyingSymbol.trim() : '',
      strikePrice: isOption ? form.strikePrice : 0,
      expiryDate: isOption ? form.expiryDate : '',
      contractMultiplier: isOption ? form.contractMultiplier : 1,
    })
    setSubmitting(false)
    if (ok) onOpenChange(false)
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
    if (cat === 'option') {
      setForm((prev) => ({
        ...prev,
        category: cat,
        symbol: '',
        market: prev.market === 'hk' ? 'hk' : 'us',
        currency: prev.market === 'hk' ? 'HKD' : 'USD',
        optionType: prev.optionType || 'call',
        contractMultiplier: prev.contractMultiplier > 1 ? prev.contractMultiplier : 100,
      }))
    }
    if (cat === 'cash' || cat === 'currency' || cat === 'provident_fund') {
      setForm((prev) => ({
        ...prev,
        category: cat,
        costBasis: prev.costBasis > 0 ? prev.costBasis : 1,
        currentPrice: prev.currentPrice > 0 ? prev.currentPrice : 1,
      }))
    }
  }

  function handleMarketChange(market: MarketType) {
    setForm((prev) => ({
      ...prev,
      market,
      currency: prev.category === 'option'
        ? market === 'hk' ? 'HKD' : 'USD'
        : prev.currency,
      contractMultiplier: prev.category === 'option' && prev.contractMultiplier <= 1 ? 100 : prev.contractMultiplier,
    }))
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
          <DialogTitle className="text-foreground">
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
                <option key={cat} value={cat} className="bg-popover text-popover-foreground">
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
              onChange={(e) => handleMarketChange(e.target.value as MarketType)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {(isOption ? MARKET_ORDER.filter((m) => m === 'us' || m === 'hk') : MARKET_ORDER).map((m) => (
                <option key={m} value={m} className="bg-popover text-popover-foreground">
                  {MARKET_LABELS[m]}
                </option>
              ))}
            </select>
          </div>

          {/* 代码/名称 或 货币选择 */}
          <div className="space-y-2">
            <Label htmlFor="symbol">
              {isCurrency ? '货币' : isOption ? '合约名称' : form.category === 'provident_fund' ? '账户名称' : form.category === 'cash' ? '现金账户名称' : '资产代码/名称'}
            </Label>
            {isCurrency ? (
              <select
                id="symbol"
                value={selectedCurrencyCode}
                onChange={(e) => handleCurrencySelect(e.target.value as CurrencyCode)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code} className="bg-popover text-popover-foreground">
                    {code} {CURRENCY_LABELS[code]}
                  </option>
                ))}
              </select>
            ) : isOption ? (
              <Input
                id="symbol"
                value={form.underlyingSymbol && form.expiryDate && form.strikePrice > 0
                  ? `${form.underlyingSymbol.trim()} ${form.expiryDate} ${form.optionType === 'put' ? 'P' : 'C'} ${form.strikePrice}`
                  : ''}
                placeholder="会根据下方期权字段自动生成"
                readOnly
              />
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

          {isOption && (
            <div className="space-y-4 rounded-lg border border-border/40 bg-background/40 p-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="underlyingSymbol">期权标的</Label>
                  <Input
                    id="underlyingSymbol"
                    placeholder={form.market === 'hk' ? '如 0700' : '如 AAPL'}
                    value={form.underlyingSymbol}
                    onChange={(e) => setField('underlyingSymbol', e.target.value.toUpperCase())}
                  />
                  {errors.underlyingSymbol ? <p className="text-xs text-[#ef4444]">{errors.underlyingSymbol}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="optionType">方向</Label>
                  <select
                    id="optionType"
                    value={form.optionType || 'call'}
                    onChange={(e) => setField('optionType', e.target.value as 'call' | 'put')}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="call" className="bg-popover text-popover-foreground">Call 看涨</option>
                    <option value="put" className="bg-popover text-popover-foreground">Put 看跌</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="strikePrice">行权价</Label>
                  <Input id="strikePrice" type="number" step="any" min="0" value={form.strikePrice || ''} onChange={(e) => setField('strikePrice', parseFloat(e.target.value) || 0)} />
                  {errors.strikePrice ? <p className="text-xs text-[#ef4444]">{errors.strikePrice}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">到期日</Label>
                  <Input id="expiryDate" type="date" value={form.expiryDate} onChange={(e) => setField('expiryDate', e.target.value)} />
                  {errors.expiryDate ? <p className="text-xs text-[#ef4444]">{errors.expiryDate}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contractMultiplier">合约乘数</Label>
                  <Input id="contractMultiplier" type="number" step="any" min="0" value={form.contractMultiplier || ''} onChange={(e) => setField('contractMultiplier', parseFloat(e.target.value) || 0)} />
                  {errors.contractMultiplier ? <p className="text-xs text-[#ef4444]">{errors.contractMultiplier}</p> : null}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">美股标准合约通常为 100；港股期权请按实际合约乘数填写。</p>
            </div>
          )}

          {!isBalanceAsset && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="costBasis">成本价</Label>
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
                <Label htmlFor="currentPrice">现价</Label>
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
          )}

          {isBalanceAsset && (
            <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
              现金和公积金按账户余额管理，不显示成本价、现价和收益率字段。
            </div>
          )}

          {/* 数量 */}
          <div className="space-y-2">
            <Label htmlFor="quantity">{isBalanceAsset ? '账户余额' : isOption ? '合约数量' : '数量'}</Label>
            <Input
              id="quantity"
              type="number"
              step="any"
              min={isOption ? undefined : '0'}
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

          {/* 买入日期 / 记录日期 */}
          <div className="space-y-2">
            <Label htmlFor="purchasedAt">{isBalanceAsset ? '记录日期' : '买入日期'}</Label>
            <Input
              id="purchasedAt"
              type="date"
              value={form.purchasedAt}
              onChange={(e) => setField('purchasedAt', e.target.value)}
            />
          </div>

          {/* 归属人 */}
          <div className="space-y-2">
            <Label htmlFor="owner">归属人</Label>
            <select
              id="owner"
              value={form.owner}
              onChange={(e) => setField('owner', e.target.value as OwnerType)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {OWNER_OPTIONS.map((o) => (
                <option key={o} value={o} className="bg-popover text-popover-foreground">
                  {OWNER_LABELS[o]}
                </option>
              ))}
            </select>
          </div>

          {/* 备注 */}
          <div className="space-y-2">
            <Label htmlFor="note">备注</Label>
            <Input
              id="note"
              placeholder="可选备注"
              value={form.note}
              onChange={(e) => setField('note', e.target.value)}
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
            <Button type="submit" disabled={submitting}>
              {submitting ? '提交中…' : isEdit ? '保存' : '新增'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
