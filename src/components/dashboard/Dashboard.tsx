import {
  Calendar,
  DollarSign,
  Eye,
  Loader2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'

import { AssetDetailSheet } from '@/components/dashboard/AssetDetailSheet'
import { AssetStructurePanel } from '@/components/dashboard/AssetStructurePanel'
import { DividendIncomePanel } from '@/components/dashboard/DividendIncomePanel'
import { FireGoalPanel } from '@/components/dashboard/FireGoalPanel'
import { PerformancePanel, type PerformanceSummary } from '@/components/dashboard/PerformancePanel'
import { PortfolioSnapshotPanel } from '@/components/dashboard/PortfolioSnapshotPanel'
import { PriceRefreshCenter } from '@/components/dashboard/PriceRefreshCenter'
import { RiskExposurePanel } from '@/components/dashboard/RiskExposurePanel'
import { StatCard } from '@/components/dashboard/StatCard'
import { useAssets } from '@/hooks/useAssets'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { useHistoricalRates } from '@/hooks/useHistoricalRates'
import { useLiabilities } from '@/hooks/useLiabilities'
import { usePriceRefresh } from '@/hooks/usePriceRefresh'
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots'
import { calculateReturnAttribution } from '@/lib/attribution'
import { contractMultiplier, costValue, dividendValue, hasMinimumAnnualizedHistory, holdingsXIRR, marketValue, totalCostValue, totalPnLValue, xirrRate } from '@/lib/calc'
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

function parseOptionMarginUSD(note: string): number | null {
  const match = note.match(/margin_usd:([\d.]+)/i)
  if (!match) return null
  const value = Number.parseFloat(match[1])
  return Number.isFinite(value) && value > 0 ? value : null
}

function compoundAnnualized(rate: number, days: number): number | null {
  if (days <= 0 || rate <= -1) return null
  return Math.pow(1 + rate, 365 / days) - 1
}

export function Dashboard({ isLoggedIn, ownerFilter }: DashboardProps) {
  const { assets, loading, error: assetsError, refetch } = useAssets(isLoggedIn, ownerFilter)
  const { liabilities, loading: liabilitiesLoading } = useLiabilities(isLoggedIn, ownerFilter)
  const [includeProvidentFund, setIncludeProvidentFund] = useState(false)
  const [includeGold, setIncludeGold] = useState(true)
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
  // 已清仓买入记录（qty = 0, div = 0, note 含 orig_qty）
  const consumedRecords = dashboardAssets.filter((a) => a.quantity === 0 && (a.dividends ?? 0) === 0 && (a.note ?? '').includes('orig_qty:'))
  // 卖出记录（qty < 0）
  const sellRecords = dashboardAssets.filter((a) => a.quantity < 0)
  const coreHoldings = holdings.filter(isCoreAnnualizedAsset)
  const coreDivRecords = divRecords.filter(isCoreAnnualizedAsset)
  const coreConsumedRecords = consumedRecords.filter(isCoreAnnualizedAsset)
  const coreSellRecords = sellRecords.filter(isCoreAnnualizedAsset)
  const optionRecords = dashboardAssets.filter((a) => a.category === 'option')
  const optionHoldings = optionRecords.filter((a) => a.quantity > 0 || (a.quantity < 0 && (a.note ?? '').includes('sell-to-open')))
  const optionSellRecords = optionRecords.filter((a) => a.quantity < 0 && !(a.note ?? '').includes('sell-to-open'))
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
  const optionMarginUSD = optionHoldings.reduce((sum, asset) => sum + (parseOptionMarginUSD(asset.note ?? '') ?? 0), 0)
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

  if (loading || liabilitiesLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
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
            公积金 <span className="font-mono text-white">{formatCNY(providentFundValueCNY)}</span>
          </span>
          <span>
            黄金 <span className="font-mono text-white">{formatCNY(goldValueCNY)}</span>
          </span>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          title="总资产"
          value={formatCompactCNY(totalValueCNY)}
          valueTitle={formatCNY(totalValueCNY)}
          icon={Wallet}
        />
        <StatCard
          title="净资产"
          value={formatCompactCNY(netWorthCNY)}
          valueTitle={formatCNY(netWorthCNY)}
          subtitle={`负债率 ${(liabilityRatio * 100).toFixed(2)}%`}
          icon={DollarSign}
          variant={netWorthCNY >= 0 ? 'profit' : 'loss'}
        />
        <StatCard
          title="总负债"
          value={formatCompactCNY(totalLiabilityCNY)}
          valueTitle={formatCNY(totalLiabilityCNY)}
          icon={TrendingDown}
          variant={totalLiabilityCNY > 0 ? 'loss' : 'default'}
        />
        <StatCard
          title="浮动盈亏"
          value={`${totalPnLCNY >= 0 ? '+' : ''}${formatCompactCNY(totalPnLCNY)}`}
          valueTitle={`${totalPnLCNY >= 0 ? '+' : ''}${formatCNY(totalPnLCNY)}`}
          subtitle={formatPercent(pnlPercent)}
          icon={totalPnLCNY >= 0 ? TrendingUp : TrendingDown}
          variant={pnlVariant}
        />
        <StatCard
          title="投入本金"
          value={formatCompactCNY(totalCostCNY)}
          valueTitle={formatCNY(totalCostCNY)}
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

      <FireGoalPanel netWorthCNY={netWorthCNY} annReturn={annReturn} />

      <div className="rounded-xl border border-border/50 bg-card px-4 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">分币种原币年化</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">不折算人民币，用各币种自身现金流计算 XIRR</p>
          </div>
          <div className="text-xs text-muted-foreground">现金、公积金、黄金已排除</div>
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

      {optionRecords.length > 0 && (
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

          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <div className="text-xs text-muted-foreground">期权市值</div>
              <div className="mt-1 font-mono text-base text-white" title={formatCNY(optionMarketValueCNY)}>{formatCompactCNY(optionMarketValueCNY)}</div>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <div className="text-xs text-muted-foreground">权利金投入</div>
              <div className="mt-1 font-mono text-base text-white" title={formatCNY(optionPremiumCNY)}>{formatCompactCNY(optionPremiumCNY)}</div>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <div className="text-xs text-muted-foreground">期权总盈亏</div>
              <div className={`mt-1 font-mono text-base ${optionTotalPnLCNY >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`} title={`${optionTotalPnLCNY >= 0 ? '+' : ''}${formatCNY(optionTotalPnLCNY)}`}>
                {optionTotalPnLCNY >= 0 ? '+' : ''}{formatCompactCNY(optionTotalPnLCNY)}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {optionPnLRate === null ? '—' : formatPercent(optionPnLRate)}
              </div>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <div className="text-xs text-muted-foreground">保证金占用</div>
              <div className="mt-1 font-mono text-base text-white">{optionMarginUSD > 0 ? formatCompactMoney(optionMarginUSD, 'USD') : '—'}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">从备注 margin_usd 读取</div>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <div className="text-xs text-muted-foreground">当前保证金收益率</div>
              <div className={`mt-1 font-mono text-base ${optionMarginReturn === null ? 'text-muted-foreground' : optionMarginReturn >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                {optionMarginReturn === null ? '—' : formatPercent(optionMarginReturn)}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {optionMarginAnnualized === null ? '年化 —' : `短周期年化 ${formatPercent(optionMarginAnnualized)}`}
              </div>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <div className="text-xs text-muted-foreground">到期最大保证金收益</div>
              <div className={`mt-1 font-mono text-base ${optionMaxMarginReturn === null ? 'text-muted-foreground' : optionMaxMarginReturn >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                {optionMaxMarginReturn === null ? '—' : formatPercent(optionMaxMarginReturn)}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {optionMaxMarginAnnualized === null ? '到期年化 —' : `到期年化 ${formatPercent(optionMaxMarginAnnualized)}`}
              </div>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <div className="text-xs text-muted-foreground">短周期年化</div>
              <div className={`mt-1 font-mono text-base ${optionShortAnnualized === null ? 'text-muted-foreground' : optionShortAnnualized >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                {optionShortAnnualized === null ? '—' : formatPercent(optionShortAnnualized)}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">仅供参考</div>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <div className="text-xs text-muted-foreground">最近到期</div>
              <div className="mt-1 font-mono text-base text-white">{nextOptionExpiry ?? '—'}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {optionDaysToExpiry === null ? '暂无到期日' : optionDaysToExpiry >= 0 ? `剩余 ${optionDaysToExpiry} 天` : `已过期 ${Math.abs(optionDaysToExpiry)} 天`}
              </div>
            </div>
          </div>
        </div>
      )}

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

      <PerformancePanel
        attribution={returnAttribution}
        historicalRatesLoading={histLoading}
        summaries={symbolSummaries}
        onSymbolClick={setDetailSymbol}
      />

      <RiskExposurePanel risk={riskExposure} />

      <DividendIncomePanel
        divRecords={divRecords}
        holdings={holdings}
        rates={rates}
      />

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
      />
    </div>
  )
}
