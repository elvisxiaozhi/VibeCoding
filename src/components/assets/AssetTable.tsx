import { useMemo, useState } from 'react'

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react'

import { AssetForm, type AssetFormData } from '@/components/assets/AssetForm'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAssets } from '@/hooks/useAssets'
import { annualizedReturn, marketValue, pnlRate, pnlValue } from '@/lib/calc'
import type { Asset } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/types'

type SortKey =
  | 'symbol'
  | 'category'
  | 'quantity'
  | 'costBasis'
  | 'currentPrice'
  | 'marketValue'
  | 'pnl'
  | 'pnlRate'
  | 'annualized'
type SortDir = 'asc' | 'desc'

function formatCNY(n: number): string {
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPercent(n: number): string {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
}

function getSortValue(asset: Asset, key: SortKey): number | string {
  switch (key) {
    case 'symbol':
      return asset.symbol
    case 'category':
      return asset.category
    case 'quantity':
      return asset.quantity
    case 'costBasis':
      return asset.costBasis
    case 'currentPrice':
      return asset.currentPrice
    case 'marketValue':
      return marketValue(asset)
    case 'pnl':
      return pnlValue(asset)
    case 'pnlRate':
      return pnlRate(asset)
    case 'annualized':
      return annualizedReturn(asset)
  }
}

interface ColumnDef {
  key: SortKey
  label: string
  align?: 'left' | 'right'
}

const COLUMNS: ColumnDef[] = [
  { key: 'symbol', label: '名称/代码', align: 'left' },
  { key: 'category', label: '分类', align: 'left' },
  { key: 'quantity', label: '数量', align: 'right' },
  { key: 'costBasis', label: '成本价', align: 'right' },
  { key: 'currentPrice', label: '现价', align: 'right' },
  { key: 'marketValue', label: '市值', align: 'right' },
  { key: 'pnl', label: '盈亏额', align: 'right' },
  { key: 'pnlRate', label: '盈亏率', align: 'right' },
  { key: 'annualized', label: '年化收益率', align: 'right' },
]

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active)
    return (
      <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 text-muted-foreground" />
    )
  return dir === 'asc' ? (
    <ArrowUp className="ml-1 inline h-3.5 w-3.5" />
  ) : (
    <ArrowDown className="ml-1 inline h-3.5 w-3.5" />
  )
}

interface AssetTableProps {
  isLoggedIn: boolean
}

export function AssetTable({ isLoggedIn }: AssetTableProps) {
  const { assets, loading, addAsset, updateAsset, deleteAsset } = useAssets(isLoggedIn)
  const [sortKey, setSortKey] = useState<SortKey>('symbol')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // 表单弹窗状态
  const [formOpen, setFormOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | undefined>(undefined)

  // 删除确认弹窗状态
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingAsset, setDeletingAsset] = useState<Asset | undefined>(
    undefined,
  )

  const sorted = useMemo(() => {
    const list = [...assets]
    list.sort((a, b) => {
      const va = getSortValue(a, sortKey)
      const vb = getSortValue(b, sortKey)
      let cmp: number
      if (typeof va === 'string' && typeof vb === 'string') {
        cmp = va.localeCompare(vb, 'zh-CN')
      } else {
        cmp = (va as number) - (vb as number)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [assets, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function handleAdd() {
    setEditingAsset(undefined)
    setFormOpen(true)
  }

  function handleEdit(asset: Asset) {
    setEditingAsset(asset)
    setFormOpen(true)
  }

  function handleFormSubmit(data: AssetFormData) {
    if (editingAsset) {
      updateAsset(editingAsset.id, data)
    } else {
      addAsset(data)
    }
  }

  function handleDeleteClick(asset: Asset) {
    setDeletingAsset(asset)
    setDeleteOpen(true)
  }

  function handleDeleteConfirm() {
    if (deletingAsset) {
      deleteAsset(deletingAsset.id)
    }
    setDeleteOpen(false)
    setDeletingAsset(undefined)
  }

  // 加载状态
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // 空状态
  if (assets.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-border/50 bg-card">
        <Wallet className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium text-white">暂无资产数据</p>
          <p className="mt-1 text-xs text-muted-foreground">
            点击下方按钮添加您的第一笔资产
          </p>
        </div>
        {isLoggedIn && (
          <>
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              新增资产
            </Button>
            <AssetForm
              open={formOpen}
              onOpenChange={setFormOpen}
              asset={editingAsset}
              onSubmit={handleFormSubmit}
            />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 游客模式 banner */}
      {!isLoggedIn && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm text-blue-400">
          <Eye className="h-4 w-4 shrink-0" />
          <span>当前为演示模式，登录后管理您的资产</span>
        </div>
      )}

      {/* 顶部操作栏 */}
      {isLoggedIn && (
        <div className="flex justify-end">
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            新增资产
          </Button>
        </div>
      )}

      {/* 表格 */}
      <div className="rounded-xl border border-border/50 bg-card shadow">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  className={`cursor-pointer select-none ${col.align === 'right' ? 'text-right' : ''}`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  <SortIcon active={sortKey === col.key} dir={sortDir} />
                </TableHead>
              ))}
              {isLoggedIn && <TableHead className="text-right">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((asset) => {
              const mv = marketValue(asset)
              const pnl = pnlValue(asset)
              const rate = pnlRate(asset)
              const ann = annualizedReturn(asset)
              const isPositive = pnl >= 0
              const isAnnPositive = ann >= 0
              const pnlColor = isPositive
                ? 'text-[#22c55e]'
                : 'text-[#ef4444]'
              const annColor = isAnnPositive
                ? 'text-[#22c55e]'
                : 'text-[#ef4444]'

              return (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium text-white">
                    {asset.symbol}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {CATEGORY_LABELS[asset.category]}
                  </TableCell>
                  <TableCell className="text-right font-mono text-white">
                    {asset.quantity}
                  </TableCell>
                  <TableCell className="text-right font-mono text-white">
                    {formatCNY(asset.costBasis)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-white">
                    {formatCNY(asset.currentPrice)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-white">
                    {formatCNY(mv)}
                  </TableCell>
                  <TableCell className={`text-right font-mono ${pnlColor}`}>
                    {isPositive ? '+' : ''}
                    {formatCNY(pnl)}
                  </TableCell>
                  <TableCell className={`text-right font-mono ${pnlColor}`}>
                    {formatPercent(rate)}
                  </TableCell>
                  <TableCell className={`text-right font-mono ${annColor}`}>
                    {formatPercent(ann)}
                  </TableCell>
                  {isLoggedIn && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(asset)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#ef4444] hover:text-[#ef4444]"
                          onClick={() => handleDeleteClick(asset)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* 新增/编辑表单弹窗 */}
      {isLoggedIn && (
        <AssetForm
          open={formOpen}
          onOpenChange={setFormOpen}
          asset={editingAsset}
          onSubmit={handleFormSubmit}
        />
      )}

      {/* 删除确认弹窗 */}
      {isLoggedIn && (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                确认删除
              </AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除资产「{deletingAsset?.symbol}」吗？此操作无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                className="bg-[#ef4444] text-white hover:bg-[#dc2626]"
                onClick={handleDeleteConfirm}
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
