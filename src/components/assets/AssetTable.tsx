import { useMemo, useState } from 'react'

import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2 } from 'lucide-react'

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
import { marketValue, pnlRate, pnlValue } from '@/lib/calc'
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
]

function SortIcon({
  active,
  dir,
}: {
  active: boolean
  dir: SortDir
}) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 text-muted-foreground" />
  return dir === 'asc' ? (
    <ArrowUp className="ml-1 inline h-3.5 w-3.5" />
  ) : (
    <ArrowDown className="ml-1 inline h-3.5 w-3.5" />
  )
}

export function AssetTable() {
  const { assets } = useAssets()
  const [sortKey, setSortKey] = useState<SortKey>('symbol')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

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

  return (
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
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((asset) => {
            const mv = marketValue(asset)
            const pnl = pnlValue(asset)
            const rate = pnlRate(asset)
            const isPositive = pnl >= 0
            const pnlColor = isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'

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
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[#ef4444] hover:text-[#ef4444]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
