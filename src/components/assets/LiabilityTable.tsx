import { useState } from 'react'

import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'

import { LiabilityForm, type LiabilityFormData } from '@/components/assets/LiabilityForm'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useEditMode } from '@/hooks/useEditMode'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { useLiabilities } from '@/hooks/useLiabilities'
import { usePrivacy } from '@/context/PrivacyContext'
import { formatMoney, toCNY } from '@/lib/currency'
import type { Liability, OwnerType } from '@/lib/types'
import { LIABILITY_CATEGORY_LABELS } from '@/lib/types'

interface LiabilityTableProps {
  isLoggedIn: boolean
  ownerFilter?: OwnerType
}

export function LiabilityTable({ isLoggedIn, ownerFilter }: LiabilityTableProps) {
  const { mask } = usePrivacy()
  const { liabilities, loading, addLiability, updateLiability, deleteLiability } = useLiabilities(isLoggedIn, ownerFilter)
  const { rates } = useExchangeRates()
  const { isReadOnly } = useEditMode()
  const canEdit = isLoggedIn && !isReadOnly
  const [formOpen, setFormOpen] = useState(false)
  const [editingLiability, setEditingLiability] = useState<Liability | undefined>()

  const totalCNY = liabilities.reduce((sum, liability) => sum + toCNY(liability.principal, liability.currency, rates), 0)

  function handleAdd() {
    setEditingLiability(undefined)
    setFormOpen(true)
  }

  function handleEdit(liability: Liability) {
    setEditingLiability(liability)
    setFormOpen(true)
  }

  function handleSubmit(data: LiabilityFormData) {
    if (!canEdit) return
    if (editingLiability) updateLiability(editingLiability.id, data)
    else addLiability(data)
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">总负债</p>
          <p className="font-mono text-2xl font-semibold text-white">{mask(formatMoney(totalCNY, 'CNY'))}</p>
        </div>
        {canEdit && (
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            新增负债
          </Button>
        )}
      </div>

      <div className="space-y-3 md:hidden">
        {liabilities.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-card p-6 text-center text-sm text-muted-foreground">
            暂无负债记录
          </div>
        ) : liabilities.map((liability) => (
          <div key={liability.id} className="rounded-xl border border-border/50 bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium text-white">{liability.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{LIABILITY_CATEGORY_LABELS[liability.category]}</div>
              </div>
            <div className="text-right">
              <div className="font-mono text-lg text-white">{mask(formatMoney(liability.principal, liability.currency))}</div>
              {liability.currency !== 'CNY' && (
                  <div className="text-[10px] text-muted-foreground">
                    ≈ {mask(formatMoney(toCNY(liability.principal, liability.currency, rates), 'CNY'))}
                  </div>
                )}
              </div>
            </div>
            {canEdit && (
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(liability)}>编辑</Button>
                <Button variant="ghost" size="sm" className="text-[#22c55e] hover:text-[#22c55e]" onClick={() => deleteLiability(liability.id)}>删除</Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden rounded-xl border border-border/50 bg-card shadow md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead className="text-right">未偿金额</TableHead>
              {canEdit && <TableHead className="text-right">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {liabilities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 4 : 3} className="h-24 text-center text-muted-foreground">
                  暂无负债记录
                </TableCell>
              </TableRow>
            ) : liabilities.map((liability) => (
              <TableRow key={liability.id}>
                <TableCell className="font-medium text-white">{liability.name}</TableCell>
                <TableCell className="text-muted-foreground">{LIABILITY_CATEGORY_LABELS[liability.category]}</TableCell>
                <TableCell className="text-right font-mono text-white">
                  <div>{mask(formatMoney(liability.principal, liability.currency))}</div>
                  {liability.currency !== 'CNY' && (
                    <div className="text-[10px] text-muted-foreground">
                      ≈ {mask(formatMoney(toCNY(liability.principal, liability.currency, rates), 'CNY'))}
                    </div>
                  )}
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(liability)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[#22c55e] hover:text-[#22c55e]" onClick={() => deleteLiability(liability.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canEdit && (
        <LiabilityForm
          open={formOpen}
          onOpenChange={setFormOpen}
          liability={editingLiability}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}
