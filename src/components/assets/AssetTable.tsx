import { Fragment, useMemo, useState } from 'react'

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react'

import { AssetForm, type AssetFormData } from '@/components/assets/AssetForm'
import { ClearedAssetsTable } from '@/components/assets/ClearedAssetsTable'
import { LiabilityTable } from '@/components/assets/LiabilityTable'
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
import { useEditMode } from '@/hooks/useEditMode'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { ASSET_SUBCATEGORY_LABELS, ASSET_SUBCATEGORY_ORDER, classifyAssetSubcategory, type AssetSubcategory } from '@/lib/assetClassification'
import { costValue, formatHoldingDays, hasMinimumAnnualizedHistory, holdingsXIRR, marketValue, totalMarketValue, totalPnLValue } from '@/lib/calc'
import { formatMoney, toCNY } from '@/lib/currency'
import { CATEGORY_LABELS, MARKET_LABELS, MARKET_ORDER, isCashLikeCurrencyAsset, type Asset, type AssetCategory, type MarketType, type OwnerType } from '@/lib/types'

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
  | 'holdingDays'
type SortDir = 'asc' | 'desc'
const DETAIL_PREVIEW_LIMIT = 10

type DisplayGroupKey = MarketType | 'cash' | 'provident_fund'

const DISPLAY_GROUP_LABELS: Record<DisplayGroupKey, string> = {
  ...MARKET_LABELS,
  cash: '现金',
  provident_fund: '公积金',
}

function assetDisplayGroup(asset: Asset): DisplayGroupKey {
  if (asset.category === 'provident_fund') return 'provident_fund'
  if (isCashLikeCurrencyAsset(asset)) return 'cash'
  return (asset.market || 'cn') as MarketType
}

/** 按 symbol 合并后的标的组 */
interface SymbolGroup {
  symbol: string
  category: AssetCategory
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
  annReturn: number | null
  /** 首次买入日期（仅 openLots，已清仓为空字符串） */
  firstBuyDate: string
  /** 持有天数：今天 - firstBuyDate；已清仓为 0 */
  holdingDays: number
}

interface SubcategoryGroup {
  key: AssetSubcategory
  label: string
  groups: SymbolGroup[]
}

interface DisplayGroup {
  key: DisplayGroupKey
  label: string
  groups: SymbolGroup[]
  subgroups: SubcategoryGroup[]
}

function formatPercent(n: number): string {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
}

function formatQty(qty: number, category: string): string {
  if (category === 'crypto') return String(qty)
  return parseFloat(qty.toFixed(2)).toString()
}

function pnlRate(group: SymbolGroup): number | null {
  if (group.totalCost <= 0) return null
  return group.totalPnL / group.totalCost
}

function recordLabel(record: Asset): string {
  if (record.quantity < 0) return '卖出'
  if (record.quantity === 0 && (record.dividends ?? 0) > 0) {
    return record.note === '赎回' ? '赎回' : '分红'
  }
  if (record.quantity === 0) return '买入（已清仓）'
  return '买入'
}

function recordValue(record: Asset): string {
  if (record.quantity < 0) return `-${formatQty(Math.abs(record.quantity), record.category)}`
  if (record.quantity === 0 && (record.dividends ?? 0) > 0) {
    return `+${formatMoney(record.dividends ?? 0, record.currency)}`
  }
  return formatQty(record.quantity, record.category)
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
      if (isCashLikeCurrencyAsset(group)) return Number.NEGATIVE_INFINITY
      return group.annReturn ?? Number.NEGATIVE_INFINITY
    case 'holdingDays':
      if (isCashLikeCurrencyAsset(group)) return Number.NEGATIVE_INFINITY
      return group.holdingDays
  }
}

function sortSymbolGroups(groups: SymbolGroup[], sortKey: SortKey, sortDir: SortDir): SymbolGroup[] {
  return [...groups].sort((a, b) => {
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
}

function groupBySubcategory(groups: SymbolGroup[], sortKey: SortKey, sortDir: SortDir): SubcategoryGroup[] {
  const map = new Map<AssetSubcategory, SymbolGroup[]>()
  for (const key of ASSET_SUBCATEGORY_ORDER) map.set(key, [])

  for (const group of groups) {
    const representative = group.openLots[0] ?? group.sellRecords[0] ?? group.dividendRecords[0] ?? group.allRecords[0]
    const key = classifyAssetSubcategory(representative)
    map.get(key)?.push(group)
  }

  return ASSET_SUBCATEGORY_ORDER
    .map((key) => ({
      key,
      label: ASSET_SUBCATEGORY_LABELS[key],
      groups: sortSymbolGroups(map.get(key) ?? [], sortKey, sortDir),
    }))
    .filter((item) => item.groups.length > 0)
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
    const dividendRecords = allRecords.filter((a) => a.quantity === 0 && (a.dividends ?? 0) > 0 && a.note !== '赎回')
    const redemptionRecords = allRecords.filter((a) => a.quantity === 0 && (a.dividends ?? 0) > 0 && a.note === '赎回')

    // 聚合只算持仓；分红从 dividendRecords 汇总；赎回单独计入盈亏但不显示在分红列
    const totalQty = openLots.reduce((s, a) => s + a.quantity, 0)
    const totalCost = openLots.reduce((s, a) => s + costValue(a), 0)
    const totalMV = totalMarketValue(openLots)
    const totalDiv = dividendRecords.reduce((s, a) => s + (a.dividends ?? 0), 0)
    const totalRedemption = redemptionRecords.reduce((s, a) => s + (a.dividends ?? 0), 0)
    const totalPnL = totalPnLValue(openLots) + totalDiv + totalRedemption
    const consumedRecords = allRecords.filter((a) => a.quantity === 0 && (a.dividends ?? 0) === 0 && (a.note ?? '').includes('orig_qty:'))
    // 取第一条记录作为代表（优先 openLots，没有则取 sellRecords）
    const representative = openLots[0] ?? sellRecords[0] ?? dividendRecords[0]
    const annReturn = hasMinimumAnnualizedHistory(openLots, consumedRecords)
      && !isCashLikeCurrencyAsset(representative)
      ? holdingsXIRR(openLots, [...dividendRecords, ...redemptionRecords], consumedRecords, sellRecords)
      : null

    // 首次买入日期：openLots 中最早的 purchasedAt（已清仓视为无）
    const firstBuyDate = openLots.length > 0
      ? openLots.reduce((min, a) => (a.purchasedAt < min ? a.purchasedAt : min), openLots[0].purchasedAt)
      : ''
    const groupHoldingDays = firstBuyDate
      ? Math.max(Math.floor((Date.now() - new Date(firstBuyDate).getTime()) / 86400000), 1)
      : 0

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
      firstBuyDate,
      holdingDays: groupHoldingDays,
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
  { key: 'symbol', label: '名称', align: 'left' },
  { key: 'marketValue', label: '市值', align: 'right' },
  { key: 'pnl', label: '盈亏额 / 盈亏率', align: 'right' },
  { key: 'annualized', label: '年化', align: 'right' },
  { key: 'holdingDays', label: '持有期', align: 'right' },
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
  const { isReadOnly } = useEditMode()
  const canEdit = isLoggedIn && !isReadOnly
  const [sortKey, setSortKey] = useState<SortKey>('symbol')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [viewMode, setViewMode] = useState<'holding' | 'cleared' | 'liabilities'>('holding')

  // 展开状态：记录已展开的 symbol
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showAllDetails, setShowAllDetails] = useState<Set<string>>(new Set())

  // 表单弹窗状态
  const [formOpen, setFormOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | undefined>(undefined)

  // 删除确认弹窗状态
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingAsset, setDeletingAsset] = useState<Asset | undefined>(
    undefined,
  )

  // 按展示板块分组：现金和公积金独立展示，其余资产按市场展示。
  const groupedByDisplay = useMemo<DisplayGroup[]>(() => {
    const groupOrder: DisplayGroupKey[] = [...MARKET_ORDER, 'cash', 'provident_fund']
    const groupMap = new Map<DisplayGroupKey, Asset[]>()
    for (const key of groupOrder) groupMap.set(key, [])
    for (const a of assets) {
      const group = assetDisplayGroup(a)
      const list = groupMap.get(group)
      if (list) list.push(a)
      else groupMap.set(group, [a])
    }

    return groupOrder
      .filter((key) => (groupMap.get(key)?.length ?? 0) > 0)
      .map((key) => {
        const symbolGroups = sortSymbolGroups(groupBySymbol(groupMap.get(key)!), sortKey, sortDir)
        return {
          key,
          label: DISPLAY_GROUP_LABELS[key],
          groups: symbolGroups,
          subgroups: groupBySubcategory(symbolGroups, sortKey, sortDir),
        }
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

  function toggleShowAllDetails(symbol: string) {
    setShowAllDetails((prev) => {
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
    if (!canEdit) return
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
    if (canEdit && deletingAsset) {
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
        {canEdit && (
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

      {/* 只读模式 banner */}
      {isLoggedIn && isReadOnly && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400">
          <Lock className="h-4 w-4 shrink-0" />
          <span>当前为只读模式，前往「设置」启用编辑</span>
        </div>
      )}

      {/* 持仓 / 已清仓 / 负债 切换 */}
      <div className="flex gap-1 rounded-lg bg-muted/30 p-1 w-fit">
        {(['holding', 'cleared', 'liabilities'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              viewMode === mode
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            {mode === 'holding' ? '持仓' : mode === 'cleared' ? '已清仓' : '负债'}
          </button>
        ))}
      </div>

      {viewMode === 'cleared' && <ClearedAssetsTable isLoggedIn={isLoggedIn} />}
      {viewMode === 'liabilities' && <LiabilityTable isLoggedIn={isLoggedIn} ownerFilter={ownerFilter} />}

      {viewMode === 'holding' && (
        <>
          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" />
                新增资产
              </Button>
            </div>
          )}

          {/* 按板块分组的表格 */}
          {groupedByDisplay.map(({ key: groupKey, label: groupLabel, groups: symbolGroups, subgroups }) => {
        const allOpenLots = symbolGroups.flatMap((g) => g.openLots)
        const groupMVCNY = allOpenLots.reduce((s, a) => s + toCNY(marketValue(a), a.currency, rates), 0)
        const groupCostCNY = allOpenLots.reduce((s, a) => s + toCNY(costValue(a), a.currency, rates), 0)
        const allGroupDivs = symbolGroups.flatMap((g) => g.dividendRecords)
        const groupDivCNY = allGroupDivs.reduce((s, a) => s + toCNY(a.dividends ?? 0, a.currency, rates), 0)
        const groupPnLCNY = groupMVCNY - groupCostCNY + groupDivCNY
        const allGroupConsumed = symbolGroups.flatMap((g) => g.allRecords.filter((a) => a.quantity === 0 && (a.dividends ?? 0) === 0 && (a.note ?? '').includes('orig_qty:')))
        const allGroupSells = symbolGroups.flatMap((g) => g.sellRecords)
        const annualizedOpenLots = allOpenLots.filter((a) => !isCashLikeCurrencyAsset(a))
        const annualizedSymbols = new Set(annualizedOpenLots.map((a) => a.symbol))
        const annualizedDivs = allGroupDivs.filter((a) => annualizedSymbols.has(a.symbol))
        const annualizedConsumed = allGroupConsumed.filter((a) => annualizedSymbols.has(a.symbol))
        const annualizedSells = allGroupSells.filter((a) => annualizedSymbols.has(a.symbol))
        const groupAnn = hasMinimumAnnualizedHistory(annualizedOpenLots, annualizedConsumed)
          ? holdingsXIRR(annualizedOpenLots, annualizedDivs, annualizedConsumed, annualizedSells)
          : null
        const isGroupPositive = groupPnLCNY >= 0
        const isGroupAnnPositive = (groupAnn ?? 0) >= 0

        return (
          <div key={groupKey} className="space-y-2">
            {/* 板块标题 + 汇总 */}
            <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h3 className="text-sm font-semibold text-white">
                {groupLabel}
              </h3>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">
                  市值 <span className="font-mono text-white">{formatMoney(groupMVCNY, 'CNY')}</span>
                </span>
                <span className="text-muted-foreground">
                  盈亏{' '}
                  <span className={`font-mono ${isGroupPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                    {isGroupPositive ? '+' : ''}{formatMoney(groupPnLCNY, 'CNY')}
                  </span>
                </span>
                {groupKey !== 'gold' && groupAnn !== null && (
                  <span className="text-muted-foreground">
                    年化{' '}
                    <span className={`font-mono ${isGroupAnnPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                      {formatPercent(groupAnn)}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {subgroups.map((subgroup) => {
              const subOpenLots = subgroup.groups.flatMap((g) => g.openLots)
              const subMVCNY = subOpenLots.reduce((s, a) => s + toCNY(marketValue(a), a.currency, rates), 0)
              const subCostCNY = subOpenLots.reduce((s, a) => s + toCNY(costValue(a), a.currency, rates), 0)
              const subDivCNY = subgroup.groups
                .flatMap((g) => g.dividendRecords)
                .reduce((s, a) => s + toCNY(a.dividends ?? 0, a.currency, rates), 0)
              const subPnLCNY = subMVCNY - subCostCNY + subDivCNY
              const isSubPositive = subPnLCNY >= 0

              return (
                <div key={subgroup.key} className="space-y-2">
                  <div className="flex flex-col gap-1 rounded-lg border border-border/30 bg-background/25 px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between">
                    <h4 className="text-xs font-semibold text-muted-foreground">{subgroup.label}</h4>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>
                        {subgroup.groups.length} 个标的
                      </span>
                      <span>
                        小计 <span className="font-mono text-white">{formatMoney(subMVCNY, 'CNY')}</span>
                      </span>
                      <span>
                        盈亏{' '}
                        <span className={`font-mono ${isSubPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                          {isSubPositive ? '+' : ''}{formatMoney(subPnLCNY, 'CNY')}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {subgroup.groups.map((group) => {
                      const isClosed = group.openLots.length === 0
                      const isPositive = group.totalPnL >= 0
                      const groupPnlRate = pnlRate(group)
                      const hideAnnualizedAndHolding = isCashLikeCurrencyAsset(group)
                      const detailRecords = [...group.allRecords].sort((a, b) => {
                        const dateCompare = b.purchasedAt.localeCompare(a.purchasedAt)
                        return dateCompare !== 0 ? dateCompare : b.id.localeCompare(a.id)
                      })
                      const isExpanded = expanded.has(group.symbol)
                      const visibleRecords = detailRecords.slice(0, 6)

                      return (
                        <div key={group.symbol} className={`rounded-xl border border-border/50 bg-card p-4 ${isClosed ? 'opacity-70' : ''}`}>
                          <button type="button" className="w-full text-left" onClick={() => toggleExpand(group.symbol)}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {isExpanded
                                    ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                  <div className="truncate font-medium text-white">{group.symbol}</div>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span>{CATEGORY_LABELS[group.category as AssetCategory]}</span>
                                  <span>{group.allRecords.length} 条记录</span>
                                  {isClosed && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">已清仓</span>}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono text-lg text-white">
                                  {isClosed ? '—' : formatMoney(group.totalMV, group.currency)}
                                </div>
                                {!isClosed && group.currency !== 'CNY' && (
                                  <div className="text-[10px] text-muted-foreground">
                                    ≈ {formatMoney(toCNY(group.totalMV, group.currency, rates), 'CNY')}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <div className="text-muted-foreground">盈亏</div>
                                <div className={`mt-1 font-mono ${isPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                                  {isPositive ? '+' : ''}{formatMoney(group.totalPnL, group.currency)}
                                  {groupPnlRate !== null && <span className="ml-1 text-[11px]">/ {formatPercent(groupPnlRate)}</span>}
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">年化 / 持有</div>
                                <div className="mt-1 font-mono text-white">
                                  {isClosed || groupKey === 'gold' || hideAnnualizedAndHolding || group.annReturn === null
                                    ? '—'
                                    : `${formatPercent(group.annReturn)} / ${formatHoldingDays(group.holdingDays)}`}
                                </div>
                              </div>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="mt-4 space-y-4 border-t border-border/40 pt-4">
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                  <div className="text-muted-foreground">数量</div>
                                  <div className="mt-1 font-mono text-white">{isClosed ? '—' : formatQty(group.totalQuantity, group.category)}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">买入金额</div>
                                  <div className="mt-1 font-mono text-white">{isClosed ? '—' : formatMoney(group.totalCost, group.currency)}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">成本价</div>
                                  <div className="mt-1 font-mono text-white">{isClosed ? '—' : formatMoney(group.weightedCostBasis, group.currency)}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">现价</div>
                                  <div className="mt-1 font-mono text-white">{isClosed ? '—' : formatMoney(group.currentPrice, group.currency)}</div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="text-xs font-medium text-white">最近交易</div>
                                {visibleRecords.map((record) => (
                                  <div key={record.id} className="flex items-center justify-between gap-3 text-xs">
                                    <div className="min-w-0 truncate text-muted-foreground">
                                      {record.purchasedAt.slice(0, 10)} {recordLabel(record)}
                                    </div>
                                    <div className="shrink-0 font-mono text-white">{recordValue(record)}</div>
                                  </div>
                                ))}
                              </div>

                              {canEdit && group.openLots[0] && (
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" size="sm" onClick={() => handleEdit(group.openLots[0])}>编辑</Button>
                                  <Button variant="ghost" size="sm" className="text-[#22c55e] hover:text-[#22c55e]" onClick={() => handleDeleteClick(group.openLots[0])}>删除</Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="hidden rounded-xl border border-border/50 bg-card shadow md:block">
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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subgroup.groups.map((group) => {
                          const isClosed = group.openLots.length === 0
                          const isPositive = group.totalPnL >= 0
                          const isAnnPositive = (group.annReturn ?? 0) >= 0
                          const groupPnlRate = pnlRate(group)
                          const pnlColor = isPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'
                          const annColor = isAnnPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'
                          const isExpanded = expanded.has(group.symbol)
                          const showAllDetailRows = showAllDetails.has(group.symbol)
                          const detailRecords = [...group.allRecords].sort((a, b) => {
                            const dateCompare = b.purchasedAt.localeCompare(a.purchasedAt)
                            return dateCompare !== 0 ? dateCompare : b.id.localeCompare(a.id)
                          })
                          const visibleDetailRecords = showAllDetailRows ? detailRecords : detailRecords.slice(0, DETAIL_PREVIEW_LIMIT)
                          const hiddenDetailCount = Math.max(detailRecords.length - visibleDetailRecords.length, 0)
                          const hideAnnualizedAndHolding = isCashLikeCurrencyAsset(group)

                          return (
                            <Fragment key={group.symbol}>
                              <TableRow
                                className={`cursor-pointer hover:bg-muted/50 ${isClosed ? 'opacity-60' : ''}`}
                                onClick={() => toggleExpand(group.symbol)}
                              >
                                <TableCell className="font-medium text-white">
                                  <div className="flex items-center gap-2">
                                    {isExpanded
                                      ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                      : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span>{group.symbol}</span>
                                        {isClosed && (
                                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                            已清仓
                                          </span>
                                        )}
                                      </div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {CATEGORY_LABELS[group.category as AssetCategory]} · {group.allRecords.length} 条记录
                                      </div>
                                    </div>
                                  </div>
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
                                <TableCell className={`text-right font-mono ${pnlColor}`}>
                                  <div>
                                    {isPositive ? '+' : ''}{formatMoney(group.totalPnL, group.currency)}
                                    <div className="text-[10px] text-muted-foreground">
                                      {groupPnlRate === null ? '—' : formatPercent(groupPnlRate)}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className={`text-right font-mono ${isClosed || groupKey === 'gold' || hideAnnualizedAndHolding || group.annReturn === null ? 'text-muted-foreground' : annColor}`}>
                                  {isClosed || groupKey === 'gold' || hideAnnualizedAndHolding || group.annReturn === null ? '—' : formatPercent(group.annReturn)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                  {isClosed || hideAnnualizedAndHolding ? '—' : formatHoldingDays(group.holdingDays)}
                                </TableCell>
                              </TableRow>

                              {isExpanded && (
                                <TableRow className="bg-muted/10">
                                  <TableCell colSpan={COLUMNS.length} className="p-0">
                                    <div className="space-y-4 px-5 py-4">
                                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                                        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                                          <div className="text-xs text-muted-foreground">数量</div>
                                          <div className="mt-1 font-mono text-sm text-white">{isClosed ? '—' : formatQty(group.totalQuantity, group.category)}</div>
                                        </div>
                                        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                                          <div className="text-xs text-muted-foreground">买入金额</div>
                                          <div className="mt-1 font-mono text-sm text-white">{isClosed ? '—' : formatMoney(group.totalCost, group.currency)}</div>
                                        </div>
                                        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                                          <div className="text-xs text-muted-foreground">成本价</div>
                                          <div className="mt-1 font-mono text-sm text-white">{isClosed ? '—' : formatMoney(group.weightedCostBasis, group.currency)}</div>
                                        </div>
                                        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                                          <div className="text-xs text-muted-foreground">现价</div>
                                          <div className="mt-1 font-mono text-sm text-white">{isClosed ? '—' : formatMoney(group.currentPrice, group.currency)}</div>
                                        </div>
                                        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                                          <div className="text-xs text-muted-foreground">分红累计</div>
                                          <div className="mt-1 font-mono text-sm text-white">{group.totalDividends > 0 ? formatMoney(group.totalDividends, group.currency) : '—'}</div>
                                        </div>
                                        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                                          <div className="text-xs text-muted-foreground">币种</div>
                                          <div className="mt-1 font-mono text-sm text-white">{group.currency}</div>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-medium text-white">交易明细</div>
                                        {canEdit && group.openLots[0] && (
                                          <div className="flex gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => handleEdit(group.openLots[0])}>
                                              <Pencil className="mr-1 h-3.5 w-3.5" />
                                              编辑
                                            </Button>
                                            <Button variant="ghost" size="sm" className="text-[#22c55e] hover:text-[#22c55e]" onClick={() => handleDeleteClick(group.openLots[0])}>
                                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                                              删除
                                            </Button>
                                          </div>
                                        )}
                                      </div>

                                      <div className="space-y-2">
                                        {visibleDetailRecords.map((record) => (
                                          <div key={record.id} className="flex items-center justify-between gap-4 rounded-lg border border-border/30 bg-background/25 px-3 py-2 text-xs">
                                            <div className="min-w-0 truncate text-muted-foreground">
                                              {record.purchasedAt.slice(0, 10)} {recordLabel(record)}
                                              {record.note && <span className="ml-2 text-muted-foreground/70">{record.note}</span>}
                                            </div>
                                            <div className="shrink-0 font-mono text-white">{recordValue(record)}</div>
                                          </div>
                                        ))}
                                      </div>

                                      {detailRecords.length > DETAIL_PREVIEW_LIMIT && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 px-2 text-xs text-muted-foreground hover:text-white"
                                          onClick={() => toggleShowAllDetails(group.symbol)}
                                        >
                                          {showAllDetailRows
                                            ? `收起到最近 ${DETAIL_PREVIEW_LIMIT} 条`
                                            : `显示全部 ${detailRecords.length} 条（还有 ${hiddenDetailCount} 条）`}
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )
            })}
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
                className="bg-[#22c55e] text-primary-foreground hover:bg-[#dc2626]"
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
