import { useMemo, useState } from 'react'

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react'

import { AssetForm, type AssetFormData } from '@/components/assets/AssetForm'
import { ClearedAssetsTable } from '@/components/assets/ClearedAssetsTable'
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
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { annualizedReturn, costValue, holdingsXIRR, marketValue, pnlValue, totalMarketValue, totalPnLValue } from '@/lib/calc'
import { formatMoney, toCNY } from '@/lib/currency'
import type { Asset, AssetCategory, MarketType, OwnerType } from '@/lib/types'
import { CATEGORY_LABELS, MARKET_LABELS, MARKET_ORDER } from '@/lib/types'

type SortKey =
  | 'symbol'
  | 'category'
  | 'totalCost'
  | 'quantity'
  | 'costBasis'
  | 'currentPrice'
  | 'marketValue'
  | 'dividends'
  | 'pnl'
  | 'annualized'
type SortDir = 'asc' | 'desc'

/** 按 symbol 合并后的标的组 */
interface SymbolGroup {
  symbol: string
  category: string
  currency: string
  currentPrice: number
  /** 当前持仓 lots (qty > 0) */
  openLots: Asset[]
  /** 卖出记录 (qty < 0) */
  sellRecords: Asset[]
  /** 分红记录 (qty = 0) */
  dividendRecords: Asset[]
  /** 全部记录（用于展开明细，按日期排序） */
  allRecords: Asset[]
  totalQuantity: number
  totalCost: number
  weightedCostBasis: number
  totalMV: number
  totalDividends: number
  totalPnL: number
  annReturn: number
}

function formatPercent(n: number): string {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
}

function formatQty(qty: number, category: string): string {
  if (category === 'crypto') return String(qty)
  return parseFloat(qty.toFixed(2)).toString()
}

function getGroupSortValue(group: SymbolGroup, key: SortKey): number | string {
  switch (key) {
    case 'symbol':
      return group.symbol
    case 'category':
      return group.category
    case 'totalCost':
      return group.totalCost
    case 'quantity':
      return group.totalQuantity
    case 'costBasis':
      return group.weightedCostBasis
    case 'currentPrice':
      return group.currentPrice
    case 'marketValue':
      return group.totalMV
    case 'dividends':
      return group.totalDividends
    case 'pnl':
      return group.totalPnL
    case 'annualized':
      return group.annReturn
  }
}

/** 将 assets 按 symbol 合并为 SymbolGroup（聚合只算持仓） */
function groupBySymbol(assets: Asset[]): SymbolGroup[] {
  const map = new Map<string, Asset[]>()
  for (const a of assets) {
    const list = map.get(a.symbol)
    if (list) list.push(a)
    else map.set(a.symbol, [a])
  }

  const groups: SymbolGroup[] = []
  for (const [symbol, allRecords] of map) {
    // 按日期排序
    allRecords.sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))

    const openLots = allRecords.filter((a) => a.quantity > 0)
    const sellRecords = allRecords.filter((a) => a.quantity < 0)
    const dividendRecords = allRecords.filter((a) => a.quantity === 0 && (a.dividends ?? 0) > 0)

    // 聚合只算持仓；分红从 dividendRecords 汇总
    const totalQty = openLots.reduce((s, a) => s + a.quantity, 0)
    const totalCost = openLots.reduce((s, a) => s + costValue(a), 0)
    const totalMV = totalMarketValue(openLots)
    const totalDiv = dividendRecords.reduce((s, a) => s + (a.dividends ?? 0), 0)
    const totalPnL = totalPnLValue(openLots) + totalDiv
    const consumedRecords = allRecords.filter((a) => a.quantity === 0 && (a.dividends ?? 0) === 0 && (a.note ?? '').includes('orig_qty:'))
    const annReturn = holdingsXIRR(openLots, dividendRecords, consumedRecords, sellRecords)

    // 取第一条记录作为代表（优先 openLots，没有则取 sellRecords）
    const representative = openLots[0] ?? sellRecords[0] ?? dividendRecords[0]

    groups.push({
      symbol,
      category: representative.category,
      currency: representative.currency,
      currentPrice: openLots.length > 0 ? representative.currentPrice : 0,
      openLots,
      sellRecords,
      dividendRecords,
      allRecords,
      totalQuantity: totalQty,
      totalCost,
      weightedCostBasis: totalQty === 0 ? 0 : totalCost / totalQty,
      totalMV,
      totalDividends: totalDiv,
      totalPnL,
      annReturn,
    })
  }
  return groups
}

interface ColumnDef {
  key: SortKey
  label: string
  align?: 'left' | 'right'
}

const COLUMNS: ColumnDef[] = [
  { key: 'symbol', label: '名称/代码', align: 'left' },
  { key: 'category', label: '分类', align: 'left' },
  { key: 'totalCost', label: '买入金额', align: 'right' },
  { key: 'quantity', label: '数量', align: 'right' },
  { key: 'costBasis', label: '成本价', align: 'right' },
  { key: 'currentPrice', label: '现价', align: 'right' },
  { key: 'marketValue', label: '市值', align: 'right' },
  { key: 'dividends', label: '分红', align: 'right' },
  { key: 'pnl', label: '盈亏额', align: 'right' },
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
  ownerFilter?: OwnerType
}

export function AssetTable({ isLoggedIn, ownerFilter }: AssetTableProps) {
  const { assets, loading, addAsset, updateAsset, deleteAsset } = useAssets(isLoggedIn, ownerFilter)
  const { rates } = useExchangeRates()
  const [sortKey, setSortKey] = useState<SortKey>('symbol')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [viewMode, setViewMode] = useState<'holding' | 'cleared'>('holding')

  // 展开状态：记录已展开的 symbol
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // 表单弹窗状态
  const [formOpen, setFormOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | undefined>(undefined)

  // 删除确认弹窗状态
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingAsset, setDeletingAsset] = useState<Asset | undefined>(
    undefined,
  )

  // 按板块分组，板块内按 symbol 合并，再排序
  const groupedByMarket = useMemo(() => {
    const marketMap = new Map<MarketType, Asset[]>()
    for (const m of MARKET_ORDER) marketMap.set(m, [])
    for (const a of assets) {
      const market = (a.market || 'cn') as MarketType
      const list = marketMap.get(market)
      if (list) list.push(a)
      else marketMap.set(market, [a])
    }

    return MARKET_ORDER
      .filter((m) => (marketMap.get(m)?.length ?? 0) > 0)
      .map((m) => {
        const symbolGroups = groupBySymbol(marketMap.get(m)!)
        symbolGroups.sort((a, b) => {
          const va = getGroupSortValue(a, sortKey)
          const vb = getGroupSortValue(b, sortKey)
          let cmp: number
          if (typeof va === 'string' && typeof vb === 'string') {
            cmp = va.localeCompare(vb, 'zh-CN')
          } else {
            cmp = (va as number) - (vb as number)
          }
          return sortDir === 'asc' ? cmp : -cmp
        })
        return { market: m, groups: symbolGroups }
      })
  }, [assets, sortKey, sortDir])

  function toggleExpand(symbol: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) next.delete(symbol)
      else next.add(symbol)
      return next
    })
  }

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

      {/* 持仓 / 已清仓 切换 */}
      <div className="flex gap-1 rounded-lg bg-muted/30 p-1 w-fit">
        {(['holding', 'cleared'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              viewMode === mode
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            {mode === 'holding' ? '持仓' : '已清仓'}
          </button>
        ))}
      </div>

      {viewMode === 'cleared' && <ClearedAssetsTable isLoggedIn={isLoggedIn} />}

      {viewMode === 'holding' && (
        <>
          {isLoggedIn && (
            <div className="flex justify-end">
              <Button onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" />
                新增资产
              </Button>
            </div>
          )}

          {/* 按板块分组的表格 */}
          {groupedByMarket.map(({ market, groups: symbolGroups }) => {
        const allOpenLots = symbolGroups.flatMap((g) => g.openLots)
        const groupMVCNY = allOpenLots.reduce((s, a) => s + toCNY(marketValue(a), a.currency, rates), 0)
        const groupCostCNY = allOpenLots.reduce((s, a) => s + toCNY(costValue(a), a.currency, rates), 0)
        const groupPnLCNY = groupMVCNY - groupCostCNY
        const allGroupDivs = symbolGroups.flatMap((g) => g.dividendRecords)
        const allGroupConsumed = symbolGroups.flatMap((g) => g.allRecords.filter((a) => a.quantity === 0 && (a.dividends ?? 0) === 0 && (a.note ?? '').includes('orig_qty:')))
        const allGroupSells = symbolGroups.flatMap((g) => g.sellRecords)
        const groupAnn = holdingsXIRR(allOpenLots, allGroupDivs, allGroupConsumed, allGroupSells)
        const isGroupPositive = groupPnLCNY >= 0
        const isGroupAnnPositive = groupAnn >= 0

        return (
          <div key={market} className="space-y-2">
            {/* 板块标题 + 汇总 */}
            <div className="flex items-baseline justify-between px-1">
              <h3 className="text-sm font-semibold text-white">
                {MARKET_LABELS[market]}
              </h3>
              <div className="flex items-baseline gap-4 text-xs">
                <span className="text-muted-foreground">
                  市值 <span className="font-mono text-white">{formatMoney(groupMVCNY, 'CNY')}</span>
                </span>
                <span className="text-muted-foreground">
                  盈亏{' '}
                  <span className={`font-mono ${isGroupPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                    {isGroupPositive ? '+' : ''}{formatMoney(groupPnLCNY, 'CNY')}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  年化{' '}
                  <span className={`font-mono ${isGroupAnnPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                    {formatPercent(groupAnn)}
                  </span>
                </span>
              </div>
            </div>

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
                  {symbolGroups.map((group) => {
                    const isClosed = group.openLots.length === 0
                    const isPositive = group.totalPnL >= 0
                    const isAnnPositive = group.annReturn >= 0
                    const pnlColor = isPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'
                    const annColor = isAnnPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'
                    const totalRecords = group.allRecords.length
                    const hasMultiple = totalRecords > 1
                    const isExpanded = expanded.has(group.symbol)

                    // 已清仓标的：计算已实现盈亏
                    const realizedPnL = isClosed
                      ? group.sellRecords.reduce((s, r) => s + (r.currentPrice - r.costBasis) * Math.abs(r.quantity), 0)
                      : 0
                    const isRealizedPositive = realizedPnL >= 0

                    return (
                      <>
                        {/* 合并行 */}
                        <TableRow
                          key={group.symbol}
                          className={`${hasMultiple ? 'cursor-pointer hover:bg-muted/50' : ''} ${isClosed ? 'opacity-60' : ''}`}
                          onClick={hasMultiple ? () => toggleExpand(group.symbol) : undefined}
                        >
                          <TableCell className="font-medium text-white">
                            <div className="flex items-center gap-1.5">
                              {hasMultiple && (
                                isExpanded
                                  ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                              {group.symbol}
                              {isClosed && (
                                <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  已清仓
                                </span>
                              )}
                              {hasMultiple && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  {(() => {
                                    const buyCount = group.allRecords.filter((a) => a.quantity >= 0 && (a.dividends ?? 0) === 0).length
                                    return buyCount > 0 ? `${buyCount}买` : ''
                                  })()}
                                  {group.sellRecords.length > 0 && ` ${group.sellRecords.length}卖`}
                                  {group.dividendRecords.length > 0 && ` ${group.dividendRecords.length}息`}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {CATEGORY_LABELS[group.category as AssetCategory]}
                          </TableCell>
                          <TableCell className="text-right font-mono text-white">
                            {isClosed ? '—' : formatMoney(group.totalCost, group.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-white">
                            {isClosed ? '—' : formatQty(group.totalQuantity, group.category)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-white">
                            {isClosed ? '—' : formatMoney(group.weightedCostBasis, group.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-white">
                            {isClosed ? '—' : formatMoney(group.currentPrice, group.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-white">
                            {isClosed ? '—' : (
                              <div>
                                {formatMoney(group.totalMV, group.currency)}
                                {group.currency !== 'CNY' && (
                                  <div className="text-[10px] text-muted-foreground">
                                    ≈ {formatMoney(toCNY(group.totalMV, group.currency, rates), 'CNY')}
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {group.totalDividends > 0
                              ? formatMoney(group.totalDividends, group.currency)
                              : '—'
                            }
                          </TableCell>
                          <TableCell className={`text-right font-mono ${isClosed ? (isRealizedPositive ? 'text-[#ef4444]' : 'text-[#22c55e]') : pnlColor}`}>
                            {isClosed
                              ? <><span className="mr-1 text-[10px] text-muted-foreground">已实现</span>{isRealizedPositive ? '+' : ''}{formatMoney(realizedPnL, group.currency)}</>
                              : (
                                <div>
                                  {isPositive ? '+' : ''}{formatMoney(group.totalPnL, group.currency)}
                                  {group.currency !== 'CNY' && (
                                    <div className="text-[10px] text-muted-foreground">
                                      ≈ {toCNY(group.totalPnL, group.currency, rates) >= 0 ? '+' : ''}{formatMoney(toCNY(group.totalPnL, group.currency, rates), 'CNY')}
                                    </div>
                                  )}
                                </div>
                              )
                            }
                          </TableCell>
                          <TableCell className={`text-right font-mono ${isClosed ? 'text-muted-foreground' : annColor}`}>
                            {isClosed ? '—' : formatPercent(group.annReturn)}
                          </TableCell>
                          {isLoggedIn && (
                            <TableCell className="text-right">
                              {!hasMultiple && !isClosed && (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => { e.stopPropagation(); handleEdit(group.openLots[0]) }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-[#22c55e] hover:text-[#22c55e]"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(group.openLots[0]) }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          )}
                        </TableRow>

                        {/* 展开明细 */}
                        {hasMultiple && isExpanded && group.allRecords.map((record) => {
                          const isSell = record.quantity < 0
                          const isDividend = record.quantity === 0 && (record.dividends ?? 0) > 0
                          const isConsumed = record.quantity === 0 && (record.dividends ?? 0) === 0

                          if (isDividend) {
                            // 分红记录
                            return (
                              <TableRow key={record.id} className="bg-amber-500/5">
                                <TableCell className="pl-10 text-sm">
                                  <span className="border-l-2 border-amber-500/50 pl-2 text-amber-500/80">
                                    {record.purchasedAt.slice(0, 10)} 分红
                                  </span>
                                  {record.note && (
                                    <span className="ml-2 text-xs text-muted-foreground/60" title={record.note}>
                                      {record.note.length > 20 ? `${record.note.slice(0, 20)}…` : record.note}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell />
                                <TableCell />
                                <TableCell />
                                <TableCell />
                                <TableCell />
                                <TableCell />
                                <TableCell className="text-right font-mono text-sm text-amber-500/80">
                                  +{formatMoney(record.dividends, record.currency)}
                                </TableCell>
                                <TableCell />
                                <TableCell />
                                {isLoggedIn && (
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-[#22c55e] hover:text-[#22c55e]"
                                        onClick={() => handleDeleteClick(record)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            )
                          }

                          if (isConsumed) {
                            // 已被卖出消耗的买入记录 (qty=0, div=0)
                            return (
                              <TableRow key={record.id} className="bg-muted/10 opacity-50">
                                <TableCell className="pl-10 text-sm">
                                  <span className="border-l-2 border-muted-foreground/30 pl-2 text-muted-foreground">
                                    {record.purchasedAt.slice(0, 10)} 买入（已清仓）
                                  </span>
                                  {record.note && (
                                    <span className="ml-2 text-xs text-muted-foreground/40" title={record.note}>
                                      {record.note.length > 20 ? `${record.note.slice(0, 20)}…` : record.note}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell />
                                <TableCell />
                                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                  0
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                  {formatMoney(record.costBasis, record.currency)}
                                </TableCell>
                                <TableCell />
                                <TableCell />
                                <TableCell />
                                <TableCell />
                                <TableCell />
                                {isLoggedIn && <TableCell />}
                              </TableRow>
                            )
                          }

                          if (isSell) {
                            // 卖出记录：costBasis=买入成本, currentPrice=卖出价
                            const qty = Math.abs(record.quantity)
                            const realizedPnL = (record.currentPrice - record.costBasis) * qty
                            const isRealizedPositive = realizedPnL >= 0

                            return (
                              <TableRow key={record.id} className="bg-red-500/5">
                                <TableCell className="pl-10 text-sm">
                                  <span className="border-l-2 border-[#22c55e]/50 pl-2 text-[#22c55e]/80">
                                    {record.purchasedAt.slice(0, 10)} 卖出
                                  </span>
                                  {record.note && (
                                    <span className="ml-2 text-xs text-muted-foreground/60" title={record.note}>
                                      {record.note.length > 20 ? `${record.note.slice(0, 20)}…` : record.note}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell />
                                <TableCell />
                                <TableCell className="text-right font-mono text-sm text-[#22c55e]/70">
                                  -{formatQty(qty, record.category)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                  {formatMoney(record.costBasis, record.currency)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                  {formatMoney(record.currentPrice, record.currency)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                  —
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                  —
                                </TableCell>
                                <TableCell className={`text-right font-mono text-sm ${isRealizedPositive ? 'text-[#ef4444]/70' : 'text-[#22c55e]/70'}`}>
                                  {isRealizedPositive ? '+' : ''}{formatMoney(realizedPnL, record.currency)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                  —
                                </TableCell>
                                {isLoggedIn && (
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleEdit(record)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-[#22c55e] hover:text-[#22c55e]"
                                        onClick={() => handleDeleteClick(record)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            )
                          }

                          // 买入记录
                          const lotCost = costValue(record)
                          const lotMV = marketValue(record)
                          const lotPnL = pnlValue(record)
                          const lotAnn = annualizedReturn(record)
                          const lotPositive = lotPnL >= 0
                          const lotAnnPositive = lotAnn >= 0

                          return (
                            <TableRow key={record.id} className="bg-muted/20">
                              <TableCell className="pl-10 text-sm text-muted-foreground">
                                <span className="border-l-2 border-[#ef4444]/50 pl-2">
                                  {record.purchasedAt.slice(0, 10)} 买入
                                </span>
                                {record.note && (
                                  <span className="ml-2 text-xs text-muted-foreground/60" title={record.note}>
                                    {record.note.length > 20 ? `${record.note.slice(0, 20)}…` : record.note}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell />
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                {formatMoney(lotCost, record.currency)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                {formatQty(record.quantity, record.category)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                {formatMoney(record.costBasis, record.currency)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                {formatMoney(record.currentPrice, record.currency)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                {formatMoney(lotMV, record.currency)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                —
                              </TableCell>
                              <TableCell className={`text-right font-mono text-sm ${lotPositive ? 'text-[#ef4444]/70' : 'text-[#22c55e]/70'}`}>
                                {lotPositive ? '+' : ''}
                                {formatMoney(lotPnL, record.currency)}
                              </TableCell>
                              <TableCell className={`text-right font-mono text-sm ${lotAnnPositive ? 'text-[#ef4444]/70' : 'text-[#22c55e]/70'}`}>
                                {formatPercent(lotAnn)}
                              </TableCell>
                              {isLoggedIn && (
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleEdit(record)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-[#22c55e] hover:text-[#22c55e]"
                                      onClick={() => handleDeleteClick(record)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          )
                        })}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )
          })}
        </>
      )}

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
                className="bg-[#22c55e] text-white hover:bg-[#dc2626]"
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
