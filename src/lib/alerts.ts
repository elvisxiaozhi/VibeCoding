import type { Asset, Liability, PriceRefreshStatus } from '@/lib/types'
import type { RiskExposure } from '@/lib/risk'

export type AlertSeverity = 'danger' | 'warning' | 'info'

export type AlertKind = 'option' | 'liability' | 'price' | 'risk'

export interface DashboardAlert {
  id: string
  kind: AlertKind
  severity: AlertSeverity
  message: string
}

export interface CollectAlertsInput {
  /** 期权持仓（含 expiryDate） */
  optionHoldings: Asset[]
  /** 负债（dueDate 预留，当前数据为空，暂不产出提醒） */
  liabilities: Liability[]
  /** 价格刷新状态（原始未分组） */
  priceRefreshStatuses: PriceRefreshStatus[]
  /** 风险敞口（alerts 已算好） */
  risk: RiskExposure
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { danger: 0, warning: 1, info: 2 }

/** 取一组提醒里最高的严重级别，用于决定整条提醒条的配色 */
export function topSeverity(alerts: DashboardAlert[]): AlertSeverity | null {
  if (alerts.length === 0) return null
  return alerts.reduce<AlertSeverity>(
    (acc, a) => (SEVERITY_RANK[a.severity] < SEVERITY_RANK[acc] ? a.severity : acc),
    'info',
  )
}

/** 距到期天数：与 Dashboard 期权面板同一口径（向上取整） */
function daysToExpiry(expiryDate: string): number {
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000)
}

function collectOptionAlerts(optionHoldings: Asset[]): DashboardAlert[] {
  const withExpiry = optionHoldings
    .map((a) => a.expiryDate)
    .filter((d): d is string => !!d)
    .map(daysToExpiry)

  const expired = withExpiry.filter((d) => d < 0).length
  // 7 天阈值与期权面板 urgent 档一致（含今天）
  const urgent = withExpiry.filter((d) => d >= 0 && d <= 7).length

  const alerts: DashboardAlert[] = []
  if (expired > 0) {
    alerts.push({ id: 'option-expired', kind: 'option', severity: 'danger', message: `${expired} 个期权已过期` })
  }
  if (urgent > 0) {
    alerts.push({ id: 'option-urgent', kind: 'option', severity: 'warning', message: `${urgent} 个期权 7 天内到期` })
  }
  return alerts
}

function collectPriceAlerts(statuses: PriceRefreshStatus[]): DashboardAlert[] {
  // 与 PriceRefreshCenter.normalizedStatus 同一例外：无自动刷新源不算失败
  const failedSymbols = new Set(
    statuses
      .filter((s) => s.status === 'failed' && s.errorMessage !== 'unsupported refresh source')
      .map((s) => s.symbol),
  )
  if (failedSymbols.size === 0) return []
  return [{
    id: 'price-failed',
    kind: 'price',
    severity: 'warning',
    message: `${failedSymbols.size} 个标的刷新失败`,
  }]
}

function collectRiskAlerts(risk: RiskExposure): DashboardAlert[] {
  return risk.alerts.map((a) => ({
    id: `risk-${a.id}`,
    kind: 'risk' as const,
    severity: a.severity,
    message: a.message,
  }))
}

/**
 * 聚合 Dashboard 顶部「待办 / 提醒」条的所有来源。
 * 判断逻辑本就散在各面板，这里只做收口，不重复计算派生指标。
 * 负债还款日（liabilities）预留：dueDate 当前无录入入口、库内为空，留待有数据后接入。
 */
export function collectDashboardAlerts(input: CollectAlertsInput): DashboardAlert[] {
  return [
    ...collectOptionAlerts(input.optionHoldings),
    ...collectPriceAlerts(input.priceRefreshStatuses),
    ...collectRiskAlerts(input.risk),
  ]
}
