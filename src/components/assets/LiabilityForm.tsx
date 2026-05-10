import { type FormEvent, useEffect, useState } from 'react'

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
import type { Liability, LiabilityCategory, OwnerType } from '@/lib/types'
import { LIABILITY_CATEGORY_LABELS, LIABILITY_CATEGORY_ORDER, OWNER_LABELS, OWNER_OPTIONS } from '@/lib/types'

export interface LiabilityFormData {
  name: string
  category: LiabilityCategory
  principal: number
  currency: string
  interestRate: number
  dueDate: string
  owner: OwnerType
  note: string
}

const DEFAULT_FORM: LiabilityFormData = {
  name: '',
  category: 'other',
  principal: 0,
  currency: 'CNY',
  interestRate: 0,
  dueDate: '',
  owner: 'me',
  note: '',
}

interface LiabilityFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  liability?: Liability
  onSubmit: (data: LiabilityFormData) => void
}

export function LiabilityForm({ open, onOpenChange, liability, onSubmit }: LiabilityFormProps) {
  const [form, setForm] = useState<LiabilityFormData>(DEFAULT_FORM)
  const [error, setError] = useState('')
  const isEdit = Boolean(liability)

  useEffect(() => {
    if (!open) return
    if (liability) {
      setForm({
        name: liability.name,
        category: liability.category,
        principal: liability.principal,
        currency: liability.currency,
        interestRate: liability.interestRate,
        dueDate: liability.dueDate,
        owner: liability.owner,
        note: liability.note,
      })
    } else {
      setForm(DEFAULT_FORM)
    }
    setError('')
  }, [liability, open])

  function setField<K extends keyof LiabilityFormData>(key: K, value: LiabilityFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('名称不能为空')
      return
    }
    if (form.principal < 0) {
      setError('未偿金额不能小于 0')
      return
    }
    onSubmit({
      ...form,
      name: form.name.trim(),
      interestRate: 0,
      dueDate: '',
      note: '',
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">{isEdit ? '编辑负债' : '新增负债'}</DialogTitle>
          <DialogDescription>记录当前尚未偿还的金额，不追溯还款流水。</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="liability-name">名称</Label>
            <Input id="liability-name" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="如 房贷、信用卡" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="liability-category">类型</Label>
              <select
                id="liability-category"
                value={form.category}
                onChange={(e) => setField('category', e.target.value as LiabilityCategory)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {LIABILITY_CATEGORY_ORDER.map((category) => (
                  <option key={category} value={category} className="bg-popover text-popover-foreground">
                    {LIABILITY_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="liability-owner">归属</Label>
              <select
                id="liability-owner"
                value={form.owner}
                onChange={(e) => setField('owner', e.target.value as OwnerType)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {OWNER_OPTIONS.map((owner) => (
                  <option key={owner} value={owner} className="bg-popover text-popover-foreground">
                    {OWNER_LABELS[owner]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="liability-principal">未偿金额</Label>
              <Input id="liability-principal" type="number" step="any" min="0" value={form.principal || ''} onChange={(e) => setField('principal', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="liability-currency">币种</Label>
              <Input id="liability-currency" value={form.currency} onChange={(e) => setField('currency', e.target.value.toUpperCase())} />
            </div>
          </div>

          {error && <p className="text-xs text-[#ef4444]">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit">{isEdit ? '保存' : '新增'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
