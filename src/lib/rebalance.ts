import type { StructureItem } from '@/lib/structure'

export type RebalanceStatus = 'over' | 'under' | 'ok'

export interface RebalanceRow {
  key: string
  label: string
  color: string
  actualRatio: number // 0–1
  targetPct: number // 0–100，未设为 0
  deviationPp: number // 当前% − 目标%（百分点）
  adjustAmount: number // 调整到目标所需金额（CNY）：>0 加仓，<0 减仓
  status: RebalanceStatus
  hasTarget: boolean
}

export interface RebalanceSummary {
  rows: RebalanceRow[]
  totalTargetPct: number // 已设目标之和
  alerts: RebalanceRow[] // |偏离| ≥ 阈值且已设目标
}

/**
 * 把某维度的占比明细与用户目标配置对账，算出偏离与建议调仓额。
 * `allItems` 应为未过滤的 buildItems 输出（含 value=0 的定义项），
 * 这样仅设了目标但当前无持仓的项也能作为「低配」展示。
 */
export function computeRebalance(
  allItems: StructureItem[],
  targets: Record<string, number>,
  totalValueCNY: number,
  thresholdPp: number,
): RebalanceSummary {
  const rows: RebalanceRow[] = []
  let totalTargetPct = 0

  for (const item of allItems) {
    const targetPct = targets[item.key] ?? 0
    totalTargetPct += targetPct
    const hasTarget = targetPct > 0

    // 既无持仓又无目标的定义项不展示
    if (item.value <= 0 && !hasTarget) continue

    const actualPct = item.ratio * 100
    const deviationPp = actualPct - targetPct
    const adjustAmount = ((targetPct - actualPct) / 100) * totalValueCNY
    const status: RebalanceStatus = !hasTarget
      ? 'ok'
      : deviationPp >= thresholdPp
        ? 'over'
        : deviationPp <= -thresholdPp
          ? 'under'
          : 'ok'

    rows.push({
      key: item.key,
      label: item.label,
      color: item.color,
      actualRatio: item.ratio,
      targetPct,
      deviationPp,
      adjustAmount,
      status,
      hasTarget,
    })
  }

  return {
    rows,
    totalTargetPct,
    alerts: rows.filter((row) => row.status !== 'ok'),
  }
}
