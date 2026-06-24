import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  DollarSign,
  Eye,
  GripVertical,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'

import { AssetDetailSheet } from '@/components/dashboard/AssetDetailSheet'
import { AssetStructurePanel } from '@/components/dashboard/AssetStructurePanel'
import { DividendIncomePanel } from '@/components/dashboard/DividendIncomePanel'
import { FireGoalPanel } from '@/components/dashboard/FireGoalPanel'
import { PerformancePanel, type PerformanceSummary } from '@/components/dashboard/PerformancePanel'
import { PortfolioSnapshotPanel } from '@/components/dashboard/PortfolioSnapshotPanel'
import { PriceRefreshCenter } from '@/components/dashboard/PriceRefreshCenter'
import { RiskExposurePanel } from '@/components/dashboard/RiskExposurePanel'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAssets } from '@/hooks/useAssets'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { useHistoricalRates } from '@/hooks/useHistoricalRates'
import { useLiabilities } from '@/hooks/useLiabilities'
import { usePriceRefresh } from '@/hooks/usePriceRefresh'
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots'
import { usePanelOrder, PANEL_LABELS, type PanelId } from '@/hooks/usePanelOrder'
import { calculateReturnAttribution } from '@/lib/attribution'
import { contractMultiplier, costValue, dividendValue, hasMinimumAnnualizedHistory, holdingsXIRR, marketValue, totalCostValue, totalPnLValue, xirrRate } from '@/lib/calc'
import { usePrivacy } from '@/context/PrivacyContext'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { formatCompactMoney, formatMoney, toCNY } from '@/lib/currency'
import { calculateRiskExposure } from '@/lib/risk'
import { CURRENCY_CODES, CURRENCY_LABELS, isCashLikeCurrencyAsset, type Asset, type OwnerType } from '@/lib/types'

function formatCNY(n: number): string {
  return formatMoney(n, 'CNY')
}

function formatCompactCNY(n: number): string {
  return formatCompactMoney(n, 'CNY')
}

function formatPercent(n: number): string {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
}

interface DashboardProps {
  isLoggedIn: boolean
  ownerFilter?: OwnerType
}

interface CurrencyAnnualizedReturn {
  currency: string
  label: string
  value: number | null
  assetCount: number
}

/** 计算资产的人民币市值 */
function assetMVInCNY(a: Asset, rates: Record<string, number>): number {
  return toCNY(marketValue(a), a.currency, rates)
}

/** 计算资产的人民币成本 */
function assetCostInCNY(a: Asset, rates: Record<string, number>): number {
  return toCNY(costValue(a), a.currency, rates)
}

function currencyLabel(currency: string): string {
  return CURRENCY_LABELS[currency as keyof typeof CURRENCY_LABELS] ?? currency
}

function currencySortOrder(currency: string): number {
  const index = CURRENCY_CODES.indexOf(currency as never)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

function isCoreAnnualizedAsset(asset: Asset): boolean {
  return asset.category !== 'gold' && asset.category !== 'option' && !isCashLikeCurrencyAsset(asset)
}

function toUSD(amount: number, currency: string, rates: Record<string, number>): number {
  return currency === 'USD' ? amount : amount / (rates[currency] ?? 1)
}

function optionPremium(asset: Asset): number {
  return Math.abs(costValue(asset))
}

function optionCloseCost(asset: Asset): number {
  return Math.abs(marketValue(asset))
}

function optionPnL(asset: Asset): number {
  if (asset.quantity < 0) return optionPremium(asset) - optionCloseCost(asset)
  return marketValue(asset) - costValue(asset)
}

function compoundAnnualized(rate: number, days: number): number | null {
  if (days <= 0 || rate <= -1) return null
  return Math.pow(1 + rate, 365 / days) - 1
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 价格刷新中心条 */}
      <Skeleton className="h-14 w-full rounded-xl" />
      {/* 总览口径卡片 */}
      <Skeleton className="h-24 w-full rounded-xl" />
      {/* 统计卡片网格 */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-card/60">
            <CardContent className="space-y-3 p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* 下方大面板 */}
      <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}

export function Dashboard({ isLoggedIn, ownerFilter }: DashboardProps) {
  const { mask } = usePrivacy()
  const [reorderMode, setReorderMode] = useState(false)
  const [dimView, setDimView] = useState<'week' | 'month' | 'year'>('week')
  const [dragOverId, setDragOverId] = useState<PanelId | null>(null)
  const dragItemRef = useRef<PanelId | null>(null)
  const { order, updateOrder, reset: resetPanelOrder } = usePanelOrder()
  const { assets, loading, error: assetsError, refetch, addAsset } = useAssets(isLoggedIn, ownerFilter)
  const { liabilities, loading: liabilitiesLoading } = useLiabilities(isLoggedIn, ownerFilter)
  const [includeProvidentFund, setIncludeProvidentFund] = useLocalStorage('dashboard.includeProvidentFund', false)
  const [includeGold, setIncludeGold] = useLocalStorage('dashboard.includeGold', true)
  const [detailSymbol, setDetailSymbol] = useState<string | null>(null)
  const { rates, loading: ratesLoading } = useExchangeRates()
  const dashboardAssets = assets.filter((a) => {
    if (!includeProvidentFund && a.category === 'provident_fund') return false
    if (!includeGold && a.category === 'gold') return false
    return true
  })
  const { getRate: getHistRate, loading: histLoading } = useHistoricalRates(dashboardAssets)
  const {
    statuses: priceRefreshStatuses,
    loading: priceRefreshLoading,
    refreshing: priceRefreshing,
    refreshAll: refreshAllPrices,
    refreshOne: refreshOnePrice,
  } = usePriceRefresh(isLoggedIn, refetch)
  // 计算负债总额（CNY），需在快照 hook 之前以便自动快照包含负债数据
  const totalLiabilityCNYForSnapshot = liabilities.reduce((s, l) => s + toCNY(l.principal, l.currency, rates), 0)
  const {
    snapshots,
    selectedSnapshot,
    loading: snapshotsLoading,
    creating: snapshotCreating,
    createTodaySnapshot,
    selectSnapshot,
  } = usePortfolioSnapshots(isLoggedIn, rates, ratesLoading, totalLiabilityCNYForSnapshot, liabilitiesLoading)

  // 只统计持仓（qty > 0），排除卖出和分红记录
  const holdings = dashboardAssets.filter((a) => a.quantity > 0)
  // 分红记录（qty = 0, dividends > 0）
  const divRecords = dashboardAssets.filter((a) => a.quantity === 0 && (a.dividends ?? 0) > 0)
  // 已清仓买入记录（qty = 0, div = 0, lotQty > 0）
  const consumedRecords = dashboardAssets.filter((a) => a.quantity === 0 && (a.dividends ?? 0) === 0 && (a.lotQty ?? 0) > 0)
  // 卖出记录（qty < 0）
  const sellRecords = dashboardAssets.filter((a) => a.quantity < 0)
  const coreHoldings = holdings.filter(isCoreAnnualizedAsset)
  const coreDivRecords = divRecords.filter(isCoreAnnualizedAsset)
  const coreConsumedRecords = consumedRecords.filter(isCoreAnnualizedAsset)
  const coreSellRecords = sellRecords.filter(isCoreAnnualizedAsset)
  const optionRecords = dashboardAssets.filter((a) => a.category === 'option')
  const optionHoldings = optionRecords.filter((a) => a.quantity > 0 || (a.quantity < 0 && a.direction === 'short'))
  const optionSellRecords = optionRecords.filter((a) => a.quantity < 0 && a.direction !== 'short')
  const providentFundValueCNY = assets
    .filter((a) => a.category === 'provident_fund' && a.quantity > 0)
    .reduce((s, a) => s + assetMVInCNY(a, rates), 0)
  const goldValueCNY = assets
    .filter((a) => a.category === 'gold' && a.quantity > 0)
    .reduce((s, a) => s + assetMVInCNY(a, rates), 0)

  // 汇率换算后的总值（人民币），含分红
  const totalValueCNY = holdings.reduce((s, a) => s + assetMVInCNY(a, rates), 0)
  const totalCostCNY = holdings.reduce((s, a) => s + assetCostInCNY(a, rates), 0)
  const totalDivCNY = divRecords.reduce((s, a) => s + toCNY(dividendValue(a), a.currency, rates), 0)
  const totalPnLCNY = totalValueCNY - totalCostCNY + totalDivCNY
  const totalLiabilityCNY = liabilities.reduce((s, l) => s + toCNY(l.principal, l.currency, rates), 0)
  const netWorthCNY = totalValueCNY - totalLiabilityCNY
  const liabilityRatio = totalValueCNY === 0 ? 0 : totalLiabilityCNY / totalValueCNY

  const pnlPercent = totalCostCNY === 0 ? 0 : totalPnLCNY / totalCostCNY
  const pnlVariant = totalPnLCNY >= 0 ? 'profit' : 'loss'
  // 历史汇率未到位前不计算 XIRR，避免缺率时出现失真数字
  const annReturn: number | null = histLoading || !hasMinimumAnnualizedHistory(coreHoldings, coreConsumedRecords)
    ? null
    : holdingsXIRR(coreHoldings, coreDivRecords, coreConsumedRecords, coreSellRecords, getHistRate)
  const annVariant = annReturn !== null && annReturn >= 0 ? 'profit' : 'loss'
  const currencyAnnualizedReturns: CurrencyAnnualizedReturn[] = (() => {
    const currencies = new Set(
      coreHoldings.map((asset) => asset.currency),
    )

    return [...currencies]
      .sort((a, b) => {
        const orderDiff = currencySortOrder(a) - currencySortOrder(b)
        return orderDiff !== 0 ? orderDiff : a.localeCompare(b)
      })
      .map((currency) => {
        const currencyHoldings = coreHoldings.filter((asset) => asset.currency === currency)
        const currencyDivRecords = coreDivRecords.filter((asset) => asset.currency === currency)
        const currencyConsumed = coreConsumedRecords.filter((asset) => asset.currency === currency)
        const currencySells = coreSellRecords.filter((asset) => asset.currency === currency)
        const value = hasMinimumAnnualizedHistory(currencyHoldings, currencyConsumed)
          ? holdingsXIRR(currencyHoldings, currencyDivRecords, currencyConsumed, currencySells)
          : null

        return {
          currency,
          label: currencyLabel(currency),
          value,
          assetCount: currencyHoldings.length,
        }
      })
  })()
  const optionMarketValueCNY = optionHoldings.reduce((s, a) => s + assetMVInCNY(a, rates), 0)
  const optionPremiumCNY = optionHoldings.reduce((s, a) => s + toCNY(optionPremium(a), a.currency, rates), 0)
  const optionFloatingPnLCNY = optionHoldings.reduce((s, a) => s + toCNY(optionPnL(a), a.currency, rates), 0)
  const optionRealizedPnLCNY = optionSellRecords.reduce((s, a) => {
    const realized = (a.currentPrice - a.costBasis) * Math.abs(a.quantity) * contractMultiplier(a)
    return s + toCNY(realized, a.currency, rates)
  }, 0)
  const optionTotalPnLCNY = optionFloatingPnLCNY + optionRealizedPnLCNY
  const optionPnLRate = optionPremiumCNY === 0 ? null : optionTotalPnLCNY / optionPremiumCNY
  const optionShortAnnualized = optionRecords.length === 0 || histLoading
    ? null
    : xirrRate(optionHoldings.flatMap((asset) => {
      const openedAt = new Date(asset.purchasedAt)
      const today = new Date()
      const openRate = getHistRate(asset.currency, openedAt)
      const todayRate = getHistRate(asset.currency, today)
      if (openRate <= 0 || todayRate <= 0) return []
      if (asset.quantity < 0) {
        return [
          { amount: optionPremium(asset) * openRate, date: openedAt },
          { amount: -optionCloseCost(asset) * todayRate, date: today },
        ]
      }
      return [
        { amount: -optionPremium(asset) * openRate, date: openedAt },
        { amount: optionCloseCost(asset) * todayRate, date: today },
      ]
    }))
  const optionPremiumUSD = optionHoldings.reduce((sum, asset) => sum + toUSD(optionPremium(asset), asset.currency, rates), 0)
  const optionPnLUSD = optionHoldings.reduce((sum, asset) => sum + toUSD(optionPnL(asset), asset.currency, rates), 0)
  const optionMarginUSD = optionHoldings.reduce((sum, asset) => sum + (asset.margin ?? 0), 0)
  const optionMarginReturn = optionMarginUSD > 0 ? optionPnLUSD / optionMarginUSD : null
  const optionMaxMarginReturn = optionMarginUSD > 0 ? optionPremiumUSD / optionMarginUSD : null
  const optionOpenedAt = optionHoldings
    .map((asset) => asset.purchasedAt)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))[0]
  const optionHeldDays = optionOpenedAt
    ? Math.max(Math.floor((Date.now() - new Date(optionOpenedAt).getTime()) / 86400000), 1)
    : null
  const optionMarginAnnualized = optionMarginReturn !== null && optionHeldDays !== null
    ? compoundAnnualized(optionMarginReturn, optionHeldDays)
    : null
  const nextOptionExpiry = optionHoldings
    .map((asset) => asset.expiryDate)
    .filter((date): date is string => !!date)
    .sort((a, b) => a.localeCompare(b))[0]
  const optionDaysToExpiry = nextOptionExpiry
    ? Math.ceil((new Date(nextOptionExpiry).getTime() - Date.now()) / 86400000)
    : null
  const optionMaxMarginAnnualized = optionMaxMarginReturn !== null && optionOpenedAt && nextOptionExpiry
    ? compoundAnnualized(optionMaxMarginReturn, Math.max(Math.ceil((new Date(nextOptionExpiry).getTime() - new Date(optionOpenedAt).getTime()) / 86400000), 1))
    : null

  // 按 symbol 汇总持仓（用于排行榜）
  const symbolSummaries: PerformanceSummary[] = (() => {
    const map = new Map<string, Asset[]>()
    for (const a of holdings) {
      const list = map.get(a.symbol)
      if (list) list.push(a)
      else map.set(a.symbol, [a])
    }
    const summaries: PerformanceSummary[] = []
    for (const [symbol, lots] of map) {
      const symDivRecords = divRecords.filter((d) => d.symbol === symbol)
      const symConsumed = consumedRecords.filter((d) => d.symbol === symbol)
      const symSells = sellRecords.filter((d) => d.symbol === symbol)
      const symDivs = symDivRecords.reduce((s, d) => s + (d.dividends ?? 0), 0)
      const cost = totalCostValue(lots)
      const pnl = totalPnLValue(lots) + symDivs

      summaries.push({
        symbol,
        category: lots[0].category,
        currency: lots[0].currency,
        totalPnL: pnl,
        totalPnLCNY: toCNY(pnl, lots[0].currency, rates),
        pnlRate: cost === 0 ? 0 : pnl / cost,
        annReturn: !isCoreAnnualizedAsset(lots[0]) || histLoading || !hasMinimumAnnualizedHistory(lots, symConsumed)
          ? null
          : holdingsXIRR(lots, symDivRecords, symConsumed, symSells, getHistRate),
      })
    }
    return summaries
  })()

  const riskExposure = calculateRiskExposure(holdings, rates, totalValueCNY)
  const returnAttribution = calculateReturnAttribution(holdings, divRecords, sellRecords, rates, getHistRate)

  // 多维度涨跌对比：快照存全量资产，这里也用全量 assets 保持口径一致
  const allHoldingsValueCNY = assets.filter((a) => a.quantity > 0).reduce((s, a) => s + assetMVInCNY(a, rates), 0)
  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const sevenDaysAgoStr = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const oneYearAgoStr = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
  const prevSnapshot = snapshots.filter((s) => s.snapshotDate < todayStr).at(-1) ?? null
  const weekSnapshot = snapshots.filter((s) => s.snapshotDate <= sevenDaysAgoStr).at(-1) ?? null
  const monthSnapshot = snapshots.filter((s) => s.snapshotDate <= thirtyDaysAgoStr).at(-1) ?? null
  const yearSnapshot = snapshots.filter((s) => s.snapshotDate <= oneYearAgoStr).at(-1) ?? null
  const dimSnapshotMap = { week: weekSnapshot, month: monthSnapshot, year: yearSnapshot } as const

  // 今日涨跌：常驻一行，对比今天之前最近的一笔快照。锚点非昨日时降级标注实际日期。
  const todayDelta = prevSnapshot ? allHoldingsValueCNY - prevSnapshot.totalValueCNY : null
  const todayPct =
    prevSnapshot && prevSnapshot.totalValueCNY > 0
      ? (allHoldingsValueCNY - prevSnapshot.totalValueCNY) / prevSnapshot.totalValueCNY
      : null
  const todayStale = prevSnapshot !== null && prevSnapshot.snapshotDate !== yesterdayStr
  const todayLabel = prevSnapshot
    ? todayStale
      ? `较 ${prevSnapshot.snapshotDate.slice(5).replace('-', '/')}`
      : '今日'
    : null
  const activeDimSnapshot = dimSnapshotMap[dimView]
  const activeDimDelta = activeDimSnapshot ? allHoldingsValueCNY - activeDimSnapshot.totalValueCNY : null
  const activeDimPct =
    activeDimSnapshot && activeDimSnapshot.totalValueCNY > 0
      ? (allHoldingsValueCNY - activeDimSnapshot.totalValueCNY) / activeDimSnapshot.totalValueCNY
      : null
  const activeDimLabel = activeDimSnapshot
    ? activeDimSnapshot.snapshotDate === yesterdayStr
      ? '较昨日'
      : dimView === 'year'
        ? `较 ${activeDimSnapshot.snapshotDate.slice(0, 7).replace('-', '/')}`
        : `较 ${activeDimSnapshot.snapshotDate.slice(5).replace('-', '/')}`
    : null

  // 骨架屏：仅在手上无数据时显示；刷新 / 切 owner 后台 revalidate 时保留现数据不闪
  if ((loading || liabilitiesLoading) && assets.length === 0) {
    return <DashboardSkeleton />
  }

  if (assetsError && assets.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-border/50 bg-card">
        <Wallet className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium text-white">{assetsError}</p>
          <p className="mt-1 text-xs text-muted-foreground">请检查网络连接或登录状态</p>
        </div>
        <button
          onClick={refetch}
          className="rounded-md border border-border/50 bg-background/50 px-4 py-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
        >
          重试
        </button>
      </div>
    )
  }

  if (assets.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-border/50 bg-card">
        <Wallet className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium text-white">暂无资产数据</p>
          <p className="mt-1 text-xs text-muted-foreground">
            请前往「资产」页面添加您的资产
          </p>
        </div>
      </div>
    )
  }

  const panelMap: Record<PanelId, ReactNode> = {
    fire: <FireGoalPanel netWorthCNY={netWorthCNY} annReturn={annReturn} />,
    currency_ann: (
      <div className="rounded-xl border border-border/50 bg-card px-4 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">分币种原币年化</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">不折算人民币，用各币种自身现金流计算 XIRR</p>
          </div>
          <div className="text-xs text-muted-foreground">现金、公积金、黄金、期权已排除</div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {currencyAnnualizedReturns.length === 0 ? (
            <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-4 text-sm text-muted-foreground">
              暂无可计算的币种年化样本
            </div>
          ) : currencyAnnualizedReturns.map((item) => {
            const isPositive = (item.value ?? 0) >= 0
            return (
              <div key={item.currency} className="rounded-lg border border-border/40 bg-background/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">{item.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{item.currency} · {item.assetCount} 个持仓</div>
                  </div>
                  <div className={`font-mono text-lg ${item.value === null ? 'text-muted-foreground' : isPositive ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                    {item.value === null ? '—' : formatPercent(item.value)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    ),
    option: optionRecords.length > 0 ? (
      <div className="rounded-xl border border-pink-500/25 bg-card px-4 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">期权表现</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">短周期高波动资产，年化仅作为参考，不纳入主账户年化</p>
          </div>
          <div className="text-xs text-muted-foreground">
            {optionHoldings.length} 个持仓 · {optionSellRecords.length} 条卖出记录
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-b border-border/40 pb-3 text-xs text-muted-foreground">
          <span>权利金 <span className="font-mono text-white" title={mask(formatCNY(optionPremiumCNY))}>{mask(formatCompactCNY(optionPremiumCNY))}</span></span>
          <span>期权市值 <span className="font-mono text-white" title={mask(formatCNY(optionMarketValueCNY))}>{mask(formatCompactCNY(optionMarketValueCNY))}</span></span>
          <span>保证金 <span className="font-mono text-white">{optionMarginUSD > 0 ? mask(formatCompactMoney(optionMarginUSD, 'USD')) : '—'}</span></span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border/40 bg-background/40 p-3">
            <div className="text-xs text-muted-foreground">期权总盈亏</div>
            <div
              className={`mt-1 font-mono text-2xl ${optionTotalPnLCNY >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}
              title={mask(`${optionTotalPnLCNY >= 0 ? '+' : ''}${formatCNY(optionTotalPnLCNY)}`)}
            >
              {mask(`${optionTotalPnLCNY >= 0 ? '+' : ''}${formatCompactCNY(optionTotalPnLCNY)}`)}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              <span>{optionPnLRate === null ? '收益率 —' : formatPercent(optionPnLRate)}</span>
              {optionShortAnnualized !== null && (
                <span>· XIRR {formatPercent(optionShortAnnualized)}</span>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-border/40 bg-background/40 p-3">
            <div className="text-xs text-muted-foreground">当前保证金收益率</div>
            <div className={`mt-1 font-mono text-2xl ${optionMarginReturn === null ? 'text-muted-foreground' : optionMarginReturn >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
              {optionMarginReturn === null ? '—' : formatPercent(optionMarginReturn)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {optionMarginAnnualized === null ? '年化 —' : `年化 ${formatPercent(optionMarginAnnualized)}`}
            </div>
          </div>
          <div className="rounded-lg border border-border/40 bg-background/40 p-3">
            <div className="text-xs text-muted-foreground">到期最大保证金收益</div>
            <div className={`mt-1 font-mono text-2xl ${optionMaxMarginReturn === null ? 'text-muted-foreground' : optionMaxMarginReturn >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
              {optionMaxMarginReturn === null ? '—' : formatPercent(optionMaxMarginReturn)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {optionMaxMarginAnnualized === null ? '到期年化 —' : `到期年化 ${formatPercent(optionMaxMarginAnnualized)}`}
            </div>
          </div>
        </div>
        {(() => {
          const days = optionDaysToExpiry
          const expired = days !== null && days < 0
          const urgent = days !== null && days >= 0 && days <= 7
          const warning = days !== null && days > 7 && days <= 30
          const colorClass = expired
            ? 'border-red-500/40 bg-red-500/10 text-red-400'
            : urgent
            ? 'border-orange-500/40 bg-orange-500/10 text-orange-400'
            : warning
            ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400'
            : nextOptionExpiry
            ? 'border-green-500/40 bg-green-500/10 text-green-400'
            : 'border-border/40 bg-background/40 text-muted-foreground'
          return (
            <div className={`mt-3 flex items-center justify-between rounded-lg border px-3 py-2.5 ${colorClass}`}>
              <span className="text-xs">最近到期</span>
              <div className="flex items-center gap-3 text-sm">
                <span className="font-mono">{nextOptionExpiry ?? '—'}</span>
                <span className="text-xs">
                  {days === null ? '暂无到期日' : days < 0 ? `已过期 ${Math.abs(days)} 天` : `剩余 ${days} 天`}
                </span>
              </div>
            </div>
          )
        })()}
      </div>
    ) : null,
    snapshot_structure: (
      <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <PortfolioSnapshotPanel
          snapshots={snapshots}
          selectedSnapshot={selectedSnapshot}
          loading={snapshotsLoading}
          creating={snapshotCreating}
          isLoggedIn={isLoggedIn}
          compact
          onCreateToday={createTodaySnapshot}
          onSelectSnapshot={selectSnapshot}
        />
        <AssetStructurePanel
          holdings={holdings}
          totalValueCNY={totalValueCNY}
          assetValueCNY={(asset) => assetMVInCNY(asset, rates)}
        />
      </div>
    ),
    performance: (
      <PerformancePanel
        attribution={returnAttribution}
        historicalRatesLoading={histLoading}
        summaries={symbolSummaries}
        onSymbolClick={setDetailSymbol}
      />
    ),
    risk: <RiskExposurePanel risk={riskExposure} />,
    dividend: (
      <DividendIncomePanel
        divRecords={divRecords}
        holdings={holdings}
        rates={rates}
      />
    ),
  }

  const visiblePanels: { id: PanelId; content: ReactNode }[] = order
    .map(id => ({ id, content: panelMap[id] }))
    .filter(item => item.content !== null && item.content !== undefined)

  const handleMoveVisible = (id: PanelId, direction: 'up' | 'down') => {
    const visIds = order.filter(pid => panelMap[pid] != null)
    const visIdx = visIds.indexOf(id)
    if (direction === 'up' && visIdx <= 0) return
    if (direction === 'down' && visIdx >= visIds.length - 1) return
    const newVisIds = [...visIds]
    const swapWith = direction === 'up' ? visIdx - 1 : visIdx + 1
    ;[newVisIds[visIdx], newVisIds[swapWith]] = [newVisIds[swapWith], newVisIds[visIdx]]
    const newOrder = [...order]
    const visPositions = order.map((pid, idx) => ({ pid, idx })).filter(({ pid }) => visIds.includes(pid))
    newVisIds.forEach((pid, i) => {
      newOrder[visPositions[i].idx] = pid
    })
    updateOrder(newOrder)
  }

  const handleDrop = (targetId: PanelId) => {
    const sourceId = dragItemRef.current
    if (!sourceId || sourceId === targetId) return
    const visIds = visiblePanels.map(p => p.id)
    const srcIdx = visIds.indexOf(sourceId)
    const tgtIdx = visIds.indexOf(targetId)
    if (srcIdx === -1 || tgtIdx === -1) return
    const newVisIds = [...visIds]
    newVisIds.splice(srcIdx, 1)
    newVisIds.splice(tgtIdx, 0, sourceId)
    const newOrder = [...order]
    const visPositions = order.map((pid, idx) => ({ pid, idx })).filter(({ pid }) => visIds.includes(pid))
    newVisIds.forEach((pid, i) => {
      newOrder[visPositions[i].idx] = pid
    })
    updateOrder(newOrder)
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 游客模式 banner */}
      {!isLoggedIn && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm text-blue-400">
          <Eye className="h-4 w-4 shrink-0" />
          <span>当前为演示模式，登录后管理您的资产</span>
        </div>
      )}

      <PriceRefreshCenter
        statuses={priceRefreshStatuses}
        loading={priceRefreshLoading}
        refreshing={priceRefreshing}
        onRefreshAll={refreshAllPrices}
        onRefreshOne={refreshOnePrice}
      />

      <div className="rounded-xl border border-border/50 bg-card px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white">总览口径</p>
            <p className="mt-0.5 text-xs text-muted-foreground">控制首页统计是否纳入低流动性资产</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={includeProvidentFund}
                onChange={(e) => setIncludeProvidentFund(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-background accent-[#f97316]"
              />
              包含公积金
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={includeGold}
                onChange={(e) => setIncludeGold(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-background accent-[#facc15]"
              />
              包含黄金
            </label>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/40 pt-3 text-xs text-muted-foreground">
          <span>
            公积金 <span className="font-mono text-white">{mask(formatCNY(providentFundValueCNY))}</span>
          </span>
          <span>
            黄金 <span className="font-mono text-white">{mask(formatCNY(goldValueCNY))}</span>
          </span>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Card className="bg-card/60">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">总资产</p>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>
            <p title={mask(formatCNY(totalValueCNY))} className="mt-2 break-words font-mono text-lg font-semibold sm:text-xl text-foreground">
              {mask(formatCompactCNY(totalValueCNY))}
            </p>
            {/* 今日涨跌：常驻一行 */}
            {todayLabel !== null && todayDelta !== null && todayPct !== null ? (
              <p
                className={`mt-1 font-mono text-sm ${
                  todayStale
                    ? 'text-muted-foreground/60'
                    : todayDelta >= 0
                      ? 'text-[#ef4444]'
                      : 'text-[#22c55e]'
                }`}
              >
                {todayLabel} {mask(`${todayDelta >= 0 ? '+' : ''}${formatCompactCNY(todayDelta)}`)} ({formatPercent(todayPct)})
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground/40">今日 暂无数据</p>
            )}
            <div className="mt-2 flex items-center gap-1">
              {(['week', 'month', 'year'] as const).map((dim) => {
                const label = { week: '周', month: '月', year: '年' }[dim]
                const hasSnap = dimSnapshotMap[dim] !== null
                return (
                  <button
                    key={dim}
                    onClick={() => setDimView(dim)}
                    disabled={!hasSnap}
                    className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                      dimView === dim
                        ? 'bg-muted text-white'
                        : hasSnap
                          ? 'text-muted-foreground hover:text-white'
                          : 'cursor-default text-muted-foreground/25'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
              {activeDimLabel !== null && activeDimDelta !== null && activeDimPct !== null ? (
                <span className={`ml-1 font-mono text-sm ${activeDimDelta >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                  {activeDimLabel} {mask(`${activeDimDelta >= 0 ? '+' : ''}${formatCompactCNY(activeDimDelta)}`)} ({formatPercent(activeDimPct)})
                </span>
              ) : (
                <span className="ml-1 text-xs text-muted-foreground/40">暂无数据</span>
              )}
            </div>
          </CardContent>
        </Card>
        <StatCard
          title="净资产"
          value={mask(formatCompactCNY(netWorthCNY))}
          valueTitle={mask(formatCNY(netWorthCNY))}
          subtitle={`负债率 ${(liabilityRatio * 100).toFixed(2)}%`}
          icon={DollarSign}
          variant={netWorthCNY >= 0 ? 'profit' : 'loss'}
        />
        <StatCard
          title="总负债"
          value={mask(formatCompactCNY(totalLiabilityCNY))}
          valueTitle={mask(formatCNY(totalLiabilityCNY))}
          icon={TrendingDown}
          variant={totalLiabilityCNY > 0 ? 'loss' : 'default'}
        />
        <StatCard
          title="浮动盈亏"
          value={mask(`${totalPnLCNY >= 0 ? '+' : ''}${formatCompactCNY(totalPnLCNY)}`)}
          valueTitle={mask(`${totalPnLCNY >= 0 ? '+' : ''}${formatCNY(totalPnLCNY)}`)}
          subtitle={formatPercent(pnlPercent)}
          icon={totalPnLCNY >= 0 ? TrendingUp : TrendingDown}
          variant={pnlVariant}
        />
        <StatCard
          title="投入本金"
          value={mask(formatCompactCNY(totalCostCNY))}
          valueTitle={mask(formatCNY(totalCostCNY))}
          icon={DollarSign}
        />
        <StatCard
          title="人民币本位年化"
          value={annReturn === null ? '—' : formatPercent(annReturn)}
          subtitle="含汇率影响"
          icon={Calendar}
          variant={annReturn === null ? 'default' : annVariant}
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setReorderMode(m => !m)}
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
            reorderMode
              ? 'border-orange-500/30 bg-orange-500/10 text-orange-400'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {reorderMode ? '完成排版' : '自定义排版'}
        </button>
      </div>

      {reorderMode && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3">
          <p className="mb-2 text-xs text-orange-400/70">点击箭头调整面板显示顺序</p>
          <div className="space-y-1">
            {visiblePanels.map(({ id }, visIdx) => (
              <div
                key={id}
                draggable
                onDragStart={() => { dragItemRef.current = id }}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(id) }}
                onDrop={(e) => { e.preventDefault(); handleDrop(id); setDragOverId(null) }}
                onDragEnd={() => { dragItemRef.current = null; setDragOverId(null) }}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 transition-colors ${
                  dragOverId === id
                    ? 'border-orange-500/50 bg-orange-500/10'
                    : 'border-transparent bg-background/50'
                }`}
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40 active:cursor-grabbing" />
                <span className="flex-1 text-sm text-white">{PANEL_LABELS[id]}</span>
                <div className="flex gap-0.5">
                  <button
                    onClick={() => handleMoveVisible(id, 'up')}
                    disabled={visIdx === 0}
                    className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-white disabled:cursor-default disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveVisible(id, 'down')}
                    disabled={visIdx === visiblePanels.length - 1}
                    className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-white disabled:cursor-default disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={resetPanelOrder}
            className="mt-2 text-xs text-muted-foreground transition-colors hover:text-white"
          >
            恢复默认顺序
          </button>
        </div>
      )}

      {visiblePanels.map(({ id, content }) => (
        <div key={id}>{content}</div>
      ))}

      <AssetDetailSheet
        symbol={detailSymbol}
        open={detailSymbol !== null}
        onClose={() => setDetailSymbol(null)}
        holdings={holdings}
        divRecords={divRecords}
        consumedRecords={consumedRecords}
        sellRecords={sellRecords}
        summaries={symbolSummaries}
        rates={rates}
        onAddTransaction={addAsset}
      />
    </div>
  )
}
