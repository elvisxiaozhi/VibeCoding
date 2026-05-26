import { Fragment, useMemo, useState } from 'react'

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Filter,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'

import { AssetForm, type AssetFormData } from '@/components/assets/AssetForm'
import { ClearedAssetsTable } from '@/components/assets/ClearedAssetsTable'
import { LiabilityTable } from '@/components/assets/LiabilityTable'
import { AssetDetailSheet } from '@/components/dashboard/AssetDetailSheet'
import type { PerformanceSummary } from '@/components/dashboard/PerformancePanel'
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
import { Input } from '@/components/ui/input'
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
import { usePrivacy } from '@/context/PrivacyContext'
import { formatMoney, toCNY } from '@/lib/currency'
import { CATEGORY_LABELS, CATEGORY_ORDER, MARKET_LABELS, MARKET_ORDER, OWNER_LABELS, isCashLikeCurrencyAsset, type Asset, type AssetCategory, type MarketType, type OwnerType } from '@/lib/types'

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
  /** 期权到期日（category === 'option' 时从代表 lot 读取） */
  expiryDate?: string
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

interface BalanceAssetPanelProps {
  title: string
  groups: SymbolGroup[]
  rates: ReturnType<typeof useExchangeRates>['rates']
  canEdit: boolean
  onEdit: (asset: Asset) => void
  onDelete: (asset: Asset) => void
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

function isOpenPositionRecord(asset: Asset): boolean {
  return asset.quantity > 0 || (asset.category === 'option' && asset.quantity < 0 && (asset.note ?? '').includes('sell-to-open'))
}

function representativeAsset(group: SymbolGroup): Asset | undefined {
  return group.openLots[0] ?? group.sellRecords[0] ?? group.dividendRecords[0] ?? group.allRecords[0]
}

function balanceOwners(group: SymbolGroup): string {
  const owners = new Set(group.allRecords.map((record) => record.owner))
  return [...owners]
    .map((owner) => OWNER_LABELS[owner as OwnerType] ?? owner)
    .join(' / ')
}

function BalanceAssetPanel({
  title,
  groups,
  rates,
  canEdit,
  onEdit,
  onDelete,
}: BalanceAssetPanelProps) {
  const { mask } = usePrivacy()
  const totalCNY = groups.reduce((sum, group) => sum + toCNY(group.totalMV, group.currency, rates), 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <div className="text-xs text-muted-foreground">
          合计 <span className="font-mono text-white">{mask(formatMoney(totalCNY, 'CNY'))}</span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {groups.map((group) => {
          const asset = representativeAsset(group)
          const updatedAt = asset?.updatedAt?.slice(0, 10) ?? '—'
          const recordCount = group.allRecords.length

          return (
            <div key={group.symbol} className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{group.symbol}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{balanceOwners(group)}</span>
                    <span>{group.currency}</span>
                    <span>{recordCount} 条记录</span>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-xs text-muted-foreground">当前余额</div>
                  <div className="mt-1 font-mono text-2xl text-white">
                    {mask(formatMoney(group.totalMV, group.currency))}
                  </div>
                  {group.currency !== 'CNY' && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      ≈ {mask(formatMoney(toCNY(group.totalMV, group.currency, rates), 'CNY'))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <div className="rounded-lg border border-border/30 bg-background/35 p-3">
                  <div className="text-muted-foreground">账户类型</div>
                  <div className="mt-1 text-sm text-white">{CATEGORY_LABELS[group.category as AssetCategory]}</div>
                </div>
                <div className="rounded-lg border border-border/30 bg-background/35 p-3">
                  <div className="text-muted-foreground">记录数</div>
                  <div className="mt-1 font-mono text-sm text-white">{recordCount}</div>
                </div>
                <div className="rounded-lg border border-border/30 bg-background/35 p-3">
                  <div className="text-muted-foreground">最近更新</div>
                  <div className="mt-1 font-mono text-sm text-white">{updatedAt}</div>
                </div>
              </div>

              {asset?.note && (
                <div className="mt-3 rounded-lg border border-border/30 bg-background/25 px-3 py-2 text-xs text-muted-foreground">
                  {asset.note}
                </div>
              )}

              {canEdit && asset && (
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(asset)}>编辑</Button>
                  <Button variant="ghost" size="sm" className="text-[#22c55e] hover:text-[#22c55e]" onClick={() => onDelete(asset)}>删除</Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
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

    const openLots = allRecords.filter(isOpenPositionRecord)
    const sellRecords = allRecords.filter((a) => a.quantity < 0 && !isOpenPositionRecord(a))
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
      expiryDate: representative?.expiryDate ?? undefined,
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
  const { mask } = usePrivacy()
  const { assets, loading, addAsset, updateAsset, deleteAsset } = useAssets(isLoggedIn, ownerFilter)
  const { rates } = useExchangeRates()
  const { isReadOnly } = useEditMode()
  const canEdit = isLoggedIn && !isReadOnly
  const [sortKey, setSortKey] = useState<SortKey>('symbol')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [viewMode, setViewMode] = useState<'holding' | 'cleared' | 'liabilities'>('holding')

  const [search, setSearch] = useState('')
  const [categoryFilters, setCategoryFilters] = useState<Set<AssetCategory>>(new Set())
  const [hiddenCols, setHiddenCols] = useState<Set<SortKey>>(() => {
    try {
      const saved = localStorage.getItem('assetTableHiddenCols')
      if (saved) return new Set(JSON.parse(saved) as SortKey[])
    } catch { /**/ }
    return new Set<SortKey>()
  })
  const [colSettingsOpen, setColSettingsOpen] = useState(false)
  const [detailSymbol, setDetailSymbol] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

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

    const lowerSearch = search.toLowerCase()

    return groupOrder
      .filter((key) => (groupMap.get(key)?.length ?? 0) > 0)
      .map((key) => {
        let symbolGroups = sortSymbolGroups(groupBySymbol(groupMap.get(key)!), sortKey, sortDir)
        if (lowerSearch) {
          symbolGroups = symbolGroups.filter((g) => g.symbol.toLowerCase().includes(lowerSearch))
        }
        if (categoryFilters.size > 0) {
          symbolGroups = symbolGroups.filter((g) => categoryFilters.has(g.category))
        }
        return {
          key,
          label: DISPLAY_GROUP_LABELS[key],
          groups: symbolGroups,
          subgroups: groupBySubcategory(symbolGroups, sortKey, sortDir),
        }
      })
      .filter((g) => g.groups.length > 0)
  }, [assets, sortKey, sortDir, search, categoryFilters])

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

  const availableCategories = useMemo<AssetCategory[]>(() => {
    const cats = new Set<AssetCategory>()
    for (const a of assets) cats.add(a.category)
    return CATEGORY_ORDER.filter((c) => cats.has(c))
  }, [assets])

  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => c.key === 'symbol' || !hiddenCols.has(c.key)),
    [hiddenCols],
  )

  function toggleHiddenCol(key: SortKey) {
    setHiddenCols((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try { localStorage.setItem('assetTableHiddenCols', JSON.stringify([...next])) } catch { /**/ }
      return next
    })
  }

  const sheetHoldings = useMemo(() => assets.filter(isOpenPositionRecord), [assets])
  const sheetDivRecords = useMemo(
    () => assets.filter((a) => a.quantity === 0 && (a.dividends ?? 0) > 0),
    [assets],
  )
  const sheetConsumedRecords = useMemo(
    () => assets.filter((a) => a.quantity === 0 && (a.dividends ?? 0) === 0 && (a.note ?? '').includes('orig_qty:')),
    [assets],
  )
  const sheetSellRecords = useMemo(
    () => assets.filter((a) => a.quantity < 0 && !isOpenPositionRecord(a)),
    [assets],
  )
  const sheetSummaries = useMemo<PerformanceSummary[]>(
    () =>
      groupedByDisplay.flatMap((g) => g.groups).map((g) => ({
        symbol: g.symbol,
        category: g.category,
        currency: g.currency,
        totalPnL: g.totalPnL,
        totalPnLCNY: toCNY(g.totalPnL, g.currency, rates),
        pnlRate: g.totalCost > 0 ? g.totalPnL / g.totalCost : 0,
        annReturn: g.annReturn,
      })),
    [groupedByDisplay, rates],
  )

  function handleSymbolClick(e: React.MouseEvent, symbol: string) {
    e.stopPropagation()
    setDetailSymbol(symbol)
    setDetailOpen(true)
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

  async function handleFormSubmit(data: AssetFormData): Promise<boolean> {
    if (!canEdit) return false
    if (editingAsset) {
      return updateAsset(editingAsset.id, data)
    } else {
      return addAsset(data)
    }
  }

  function handleDeleteClick(asset: Asset) {
    setDeletingAsset(asset)
    setDeleteOpen(true)
  }

  async function handleDeleteConfirm() {
    if (canEdit && deletingAsset) {
      await deleteAsset(deletingAsset.id)
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
          {/* 搜索 + 分类过滤 + 列设置工具栏 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索标的..."
                className="h-8 w-40 pl-8 text-sm"
              />
              {search && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setSearch('')}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-white" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {availableCategories.map((cat) => {
                const active = categoryFilters.has(cat)
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() =>
                      setCategoryFilters((prev) => {
                        const next = new Set(prev)
                        if (next.has(cat)) next.delete(cat)
                        else next.add(cat)
                        return next
                      })
                    }
                    className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                      active
                        ? 'bg-white/15 text-white ring-1 ring-white/20'
                        : 'bg-muted/30 text-muted-foreground hover:text-white'
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                )
              })}
              {categoryFilters.size > 0 && (
                <button
                  type="button"
                  className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:text-white"
                  onClick={() => setCategoryFilters(new Set())}
                >
                  <X className="h-3 w-3" />
                  清除
                </button>
              )}
            </div>

            <div className="relative ml-auto">
              {colSettingsOpen && (
                <div className="fixed inset-0 z-[5]" onClick={() => setColSettingsOpen(false)} />
              )}
              <Button
                variant="ghost"
                size="sm"
                className="relative z-[6] h-8 gap-1.5 text-xs text-muted-foreground"
                onClick={() => setColSettingsOpen((v) => !v)}
              >
                <Filter className="h-3.5 w-3.5" />
                列
              </Button>
              {colSettingsOpen && (
                <div className="absolute right-0 top-9 z-[6] min-w-[140px] rounded-xl border border-border/50 bg-card p-3 shadow-lg">
                  <div className="mb-2 text-xs font-medium text-white">显示列</div>
                  <div className="space-y-1">
                    {COLUMNS.filter((c) => c.key !== 'symbol').map((col) => {
                      const hidden = hiddenCols.has(col.key)
                      return (
                        <button
                          key={col.key}
                          type="button"
                          onClick={() => toggleHiddenCol(col.key)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/40"
                        >
                          <div
                            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                              !hidden ? 'border-white/40 bg-white/10' : 'border-border/60'
                            }`}
                          >
                            {!hidden && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <span className={hidden ? 'text-muted-foreground' : 'text-white'}>
                            {col.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {hiddenCols.size > 0 && (
                    <button
                      type="button"
                      className="mt-2 w-full rounded-md px-2 py-1 text-center text-xs text-muted-foreground hover:text-white"
                      onClick={() => {
                        setHiddenCols(new Set())
                        try { localStorage.removeItem('assetTableHiddenCols') } catch { /**/ }
                        setColSettingsOpen(false)
                      }}
                    >
                      恢复默认
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" />
                新增资产
              </Button>
            </div>
          )}

          {/* 过滤无结果时的空状态 */}
          {groupedByDisplay.length === 0 && (search || categoryFilters.size > 0) && (
            <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-border/50 bg-card">
              <Search className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">没有找到匹配的标的</p>
            </div>
          )}

          {/* 按板块分组的表格 */}
          {groupedByDisplay.map(({ key: groupKey, label: groupLabel, groups: symbolGroups, subgroups }) => {
        if (groupKey === 'cash' || groupKey === 'provident_fund') {
          return (
            <BalanceAssetPanel
              key={groupKey}
              title={groupLabel}
              groups={symbolGroups}
              rates={rates}
              canEdit={canEdit}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
            />
          )
        }

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
                  市值 <span className="font-mono text-white">{mask(formatMoney(groupMVCNY, 'CNY'))}</span>
                </span>
                <span className="text-muted-foreground">
                  盈亏{' '}
                  <span className={`font-mono ${isGroupPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                    {mask(`${isGroupPositive ? '+' : ''}${formatMoney(groupPnLCNY, 'CNY')}`)}
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
                        小计 <span className="font-mono text-white">{mask(formatMoney(subMVCNY, 'CNY'))}</span>
                      </span>
                      <span>
                        盈亏{' '}
                        <span className={`font-mono ${isSubPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                          {mask(`${isSubPositive ? '+' : ''}${formatMoney(subPnLCNY, 'CNY')}`)}
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
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => handleSymbolClick(e, group.symbol)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSymbolClick(e as unknown as React.MouseEvent, group.symbol)}
                                    className="truncate font-medium text-white hover:underline"
                                  >
                                    {group.symbol}
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span>{CATEGORY_LABELS[group.category as AssetCategory]}</span>
                                  <span>{group.allRecords.length} 条记录</span>
                                  {isClosed && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">已清仓</span>}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono text-lg text-white">
                                  {isClosed ? '—' : mask(formatMoney(group.totalMV, group.currency))}
                                </div>
                                {!isClosed && group.currency !== 'CNY' && (
                                  <div className="text-[10px] text-muted-foreground">
                                    ≈ {mask(formatMoney(toCNY(group.totalMV, group.currency, rates), 'CNY'))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <div className="text-muted-foreground">盈亏</div>
                                <div className={`mt-1 font-mono ${isPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                                  {mask(`${isPositive ? '+' : ''}${formatMoney(group.totalPnL, group.currency)}`)}
                                  {groupPnlRate !== null && <span className="ml-1 text-[11px]">/ {formatPercent(groupPnlRate)}</span>}
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">
                                  {group.category === 'option' ? '累计 / 到期' : '年化 / 持有'}
                                </div>
                                <div className={`mt-1 font-mono ${group.category === 'option' ? (isPositive ? 'text-[#ef4444]' : 'text-[#22c55e]') : 'text-white'}`}>
                                  {group.category === 'option' && !isClosed
                                    ? `${groupPnlRate !== null ? formatPercent(groupPnlRate) : '—'} / ${group.expiryDate ? group.expiryDate.slice(0, 10) : '无到期日'}`
                                    : (isClosed || groupKey === 'gold' || hideAnnualizedAndHolding || group.annReturn === null
                                        ? '—'
                                        : `${formatPercent(group.annReturn)} / ${formatHoldingDays(group.holdingDays)}`)}
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
                                  <div className="mt-1 font-mono text-white">{isClosed ? '—' : mask(formatMoney(group.totalCost, group.currency))}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">成本价</div>
                                  <div className="mt-1 font-mono text-white">{isClosed ? '—' : mask(formatMoney(group.weightedCostBasis, group.currency))}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">现价</div>
                                  <div className="mt-1 font-mono text-white">{isClosed ? '—' : mask(formatMoney(group.currentPrice, group.currency))}</div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="text-xs font-medium text-white">最近交易</div>
                                {visibleRecords.map((record) => (
                                  <div key={record.id} className="flex items-center justify-between gap-3 text-xs">
                                    <div className="min-w-0 truncate text-muted-foreground">
                                      {record.purchasedAt.slice(0, 10)} {recordLabel(record)}
                                    </div>
                                    <div className="shrink-0 font-mono text-white">{mask(recordValue(record))}</div>
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
                          {visibleColumns.map((col) => (
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
                                        <button
                                          type="button"
                                          onClick={(e) => handleSymbolClick(e, group.symbol)}
                                          className="text-white hover:underline"
                                        >
                                          {group.symbol}
                                        </button>
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
                                {!hiddenCols.has('marketValue') && (
                                  <TableCell className="text-right font-mono text-white">
                                    {isClosed ? '—' : (
                                      <div>
                                        {mask(formatMoney(group.totalMV, group.currency))}
                                        {group.currency !== 'CNY' && (
                                          <div className="text-[10px] text-muted-foreground">
                                            ≈ {mask(formatMoney(toCNY(group.totalMV, group.currency, rates), 'CNY'))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </TableCell>
                                )}
                                {!hiddenCols.has('pnl') && (
                                  <TableCell className={`text-right font-mono ${pnlColor}`}>
                                    <div>
                                      {mask(`${isPositive ? '+' : ''}${formatMoney(group.totalPnL, group.currency)}`)}
                                      <div className="text-[10px] text-muted-foreground">
                                        {groupPnlRate === null ? '—' : formatPercent(groupPnlRate)}
                                      </div>
                                    </div>
                                  </TableCell>
                                )}
                                {!hiddenCols.has('annualized') && (
                                  <TableCell className={`text-right font-mono ${group.category === 'option' && !isClosed ? pnlColor : (isClosed || groupKey === 'gold' || hideAnnualizedAndHolding || group.annReturn === null ? 'text-muted-foreground' : annColor)}`}>
                                    {group.category === 'option' && !isClosed
                                      ? (groupPnlRate !== null ? <span>{formatPercent(groupPnlRate)}<span className="ml-1 text-[10px] text-muted-foreground">累计</span></span> : '—')
                                      : (isClosed || groupKey === 'gold' || hideAnnualizedAndHolding || group.annReturn === null ? '—' : formatPercent(group.annReturn))}
                                  </TableCell>
                                )}
                                {!hiddenCols.has('holdingDays') && (
                                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                    {group.category === 'option' && !isClosed
                                      ? (group.expiryDate ? group.expiryDate.slice(0, 10) : '—')
                                      : (isClosed || hideAnnualizedAndHolding ? '—' : formatHoldingDays(group.holdingDays))}
                                  </TableCell>
                                )}
                              </TableRow>

                              {isExpanded && (
                                <TableRow className="bg-muted/10">
                                  <TableCell colSpan={visibleColumns.length} className="p-0">
                                    <div className="space-y-4 px-5 py-4">
                                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                                        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                                          <div className="text-xs text-muted-foreground">数量</div>
                                          <div className="mt-1 font-mono text-sm text-white">{isClosed ? '—' : formatQty(group.totalQuantity, group.category)}</div>
                                        </div>
                                        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                                          <div className="text-xs text-muted-foreground">买入金额</div>
                                          <div className="mt-1 font-mono text-sm text-white">{isClosed ? '—' : mask(formatMoney(group.totalCost, group.currency))}</div>
                                        </div>
                                        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                                          <div className="text-xs text-muted-foreground">成本价</div>
                                          <div className="mt-1 font-mono text-sm text-white">{isClosed ? '—' : mask(formatMoney(group.weightedCostBasis, group.currency))}</div>
                                        </div>
                                        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                                          <div className="text-xs text-muted-foreground">现价</div>
                                          <div className="mt-1 font-mono text-sm text-white">{isClosed ? '—' : mask(formatMoney(group.currentPrice, group.currency))}</div>
                                        </div>
                                        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                                          <div className="text-xs text-muted-foreground">分红累计</div>
                                          <div className="mt-1 font-mono text-sm text-white">{group.totalDividends > 0 ? mask(formatMoney(group.totalDividends, group.currency)) : '—'}</div>
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
                                            <div className="shrink-0 font-mono text-white">{mask(recordValue(record))}</div>
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

      {/* 标的详情抽屉 */}
      <AssetDetailSheet
        symbol={detailSymbol}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        holdings={sheetHoldings}
        divRecords={sheetDivRecords}
        consumedRecords={sheetConsumedRecords}
        sellRecords={sheetSellRecords}
        summaries={sheetSummaries}
        rates={rates}
      />
    </div>
  )
}
