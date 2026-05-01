import {
  Calendar,
  DollarSign,
  Eye,
  Loader2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { AssetStructurePanel } from '@/components/dashboard/AssetStructurePanel'
import { PerformancePanel, type PerformanceSummary } from '@/components/dashboard/PerformancePanel'
import { PortfolioSnapshotPanel } from '@/components/dashboard/PortfolioSnapshotPanel'
import { PriceRefreshCenter } from '@/components/dashboard/PriceRefreshCenter'
import { RiskExposurePanel } from '@/components/dashboard/RiskExposurePanel'
import { StatCard } from '@/components/dashboard/StatCard'
import { useAssets } from '@/hooks/useAssets'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { useHistoricalRates } from '@/hooks/useHistoricalRates'
import { usePriceRefresh } from '@/hooks/usePriceRefresh'
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots'
import { calculateReturnAttribution } from '@/lib/attribution'
import { costValue, dividendValue, hasMinimumAnnualizedHistory, holdingsXIRR, marketValue, totalCostValue, totalPnLValue } from '@/lib/calc'
import { formatMoney, toCNY } from '@/lib/currency'
import { calculateRiskExposure } from '@/lib/risk'
import type { Asset, OwnerType } from '@/lib/types'

function formatCNY(n: number): string {
  return formatMoney(n, 'CNY')
}

function formatPercent(n: number): string {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
}

interface DashboardProps {
  isLoggedIn: boolean
  ownerFilter?: OwnerType
}

/** 计算资产的人民币市值 */
function assetMVInCNY(a: Asset, rates: Record<string, number>): number {
  return toCNY(marketValue(a), a.currency, rates)
}

/** 计算资产的人民币成本 */
function assetCostInCNY(a: Asset, rates: Record<string, number>): number {
  return toCNY(costValue(a), a.currency, rates)
}

export function Dashboard({ isLoggedIn, ownerFilter }: DashboardProps) {
  const { assets, loading, refetch } = useAssets(isLoggedIn, ownerFilter)
  const { rates, loading: ratesLoading } = useExchangeRates()
  const { getRate: getHistRate, loading: histLoading } = useHistoricalRates(assets)
  const {
    statuses: priceRefreshStatuses,
    loading: priceRefreshLoading,
    refreshing: priceRefreshing,
    refreshAll: refreshAllPrices,
    refreshOne: refreshOnePrice,
  } = usePriceRefresh(isLoggedIn, refetch)
  const {
    snapshots,
    selectedSnapshot,
    loading: snapshotsLoading,
    creating: snapshotCreating,
    createTodaySnapshot,
    selectSnapshot,
  } = usePortfolioSnapshots(isLoggedIn, rates, ratesLoading)

  // 只统计持仓（qty > 0），排除卖出和分红记录
  const holdings = assets.filter((a) => a.quantity > 0)
  // 分红记录（qty = 0, dividends > 0）
  const divRecords = assets.filter((a) => a.quantity === 0 && (a.dividends ?? 0) > 0)
  // 已清仓买入记录（qty = 0, div = 0, note 含 orig_qty）
  const consumedRecords = assets.filter((a) => a.quantity === 0 && (a.dividends ?? 0) === 0 && (a.note ?? '').includes('orig_qty:'))
  // 卖出记录（qty < 0）
  const sellRecords = assets.filter((a) => a.quantity < 0)

  // 汇率换算后的总值（人民币），含分红
  const totalValueCNY = holdings.reduce((s, a) => s + assetMVInCNY(a, rates), 0)
  const totalCostCNY = holdings.reduce((s, a) => s + assetCostInCNY(a, rates), 0)
  const totalDivCNY = divRecords.reduce((s, a) => s + toCNY(dividendValue(a), a.currency, rates), 0)
  const totalPnLCNY = totalValueCNY - totalCostCNY + totalDivCNY

  const pnlPercent = totalCostCNY === 0 ? 0 : totalPnLCNY / totalCostCNY
  const pnlVariant = totalPnLCNY >= 0 ? 'profit' : 'loss'
  // 历史汇率未到位前不计算 XIRR，避免缺率时出现失真数字
  const annReturn: number | null = histLoading || !hasMinimumAnnualizedHistory(holdings, consumedRecords)
    ? null
    : holdingsXIRR(holdings, divRecords, consumedRecords, sellRecords, getHistRate)
  const annVariant = annReturn !== null && annReturn >= 0 ? 'profit' : 'loss'

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
        annReturn: lots[0].market === 'gold' || histLoading || !hasMinimumAnnualizedHistory(lots, symConsumed)
          ? null
          : holdingsXIRR(lots, symDivRecords, symConsumed, symSells, getHistRate),
      })
    }
    return summaries
  })()

  const riskExposure = calculateRiskExposure(holdings, rates, totalValueCNY)
  const returnAttribution = calculateReturnAttribution(holdings, divRecords, sellRecords, rates, getHistRate)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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

  return (
    <div className="space-y-6">
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

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="总资产"
          value={formatCNY(totalValueCNY)}
          icon={Wallet}
        />
        <StatCard
          title="浮动盈亏"
          value={`${totalPnLCNY >= 0 ? '+' : ''}${formatCNY(totalPnLCNY)}`}
          subtitle={formatPercent(pnlPercent)}
          icon={totalPnLCNY >= 0 ? TrendingUp : TrendingDown}
          variant={pnlVariant}
        />
        <StatCard
          title="投入本金"
          value={formatCNY(totalCostCNY)}
          icon={DollarSign}
        />
        <StatCard
          title="组合年化"
          value={annReturn === null ? '—' : formatPercent(annReturn)}
          icon={Calendar}
          variant={annReturn === null ? 'default' : annVariant}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
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

      <PerformancePanel
        attribution={returnAttribution}
        historicalRatesLoading={histLoading}
        summaries={symbolSummaries}
      />

      <RiskExposurePanel risk={riskExposure} />
    </div>
  )
}
