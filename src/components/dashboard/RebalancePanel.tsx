import { useMemo, useState } from 'react'

import { AlertTriangle, Target } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePrivacy } from '@/context/PrivacyContext'
import { formatMoney } from '@/lib/currency'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { computeRebalance } from '@/lib/rebalance'
import { STRUCTURE_VIEWS, buildItems, type StructureView } from '@/lib/structure'
import type { Asset } from '@/lib/types'

const LS_TARGETS = 'target_allocation'
const LS_THRESHOLD = 'rebalance_threshold'
const DEFAULT_THRESHOLD = 5

interface RebalancePanelProps {
  holdings: Asset[]
  totalValueCNY: number
  assetValueCNY: (asset: Asset) => number
}

export function RebalancePanel({ holdings, totalValueCNY, assetValueCNY }: RebalancePanelProps) {
  const { mask } = usePrivacy()
  const [view, setView] = useState<StructureView>('category')
  const [targetsByView, setTargetsByView] = useLocalStorage<Record<string, Record<string, number>>>(LS_TARGETS, {})
  const [threshold, setThreshold] = useLocalStorage<number>(LS_THRESHOLD, DEFAULT_THRESHOLD)

  const viewTargets = targetsByView[view] ?? {}

  const allItems = useMemo(
    () => buildItems(holdings, totalValueCNY, assetValueCNY, view),
    [assetValueCNY, holdings, totalValueCNY, view],
  )

  const summary = useMemo(
    () => computeRebalance(allItems, viewTargets, totalValueCNY, threshold),
    [allItems, viewTargets, totalValueCNY, threshold],
  )

  const hasAnyTarget = summary.rows.some((row) => row.hasTarget)
  const totalOff = hasAnyTarget && Math.abs(summary.totalTargetPct - 100) > 0.5

  function setTarget(key: string, raw: string) {
    const n = parseFloat(raw)
    const pct = isNaN(n) || n < 0 ? 0 : Math.min(n, 100)
    setTargetsByView({ ...targetsByView, [view]: { ...viewTargets, [key]: pct } })
  }

  function handleThreshold(raw: string) {
    const n = parseFloat(raw)
    setThreshold(isNaN(n) || n < 0 ? 0 : Math.min(n, 100))
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-orange-400" />
            <CardTitle className="text-white">目标配置 / 再平衡</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>偏离阈值</span>
              <input
                type="number"
                value={threshold}
                onChange={(e) => handleThreshold(e.target.value)}
                className="w-14 rounded border border-border/50 bg-background px-1.5 py-0.5 font-mono text-white focus:border-orange-500/50 focus:outline-none"
                min="0"
              />
              <span>pp</span>
            </div>
            <div className="flex gap-1 rounded-md border border-border/40 bg-background/30 p-1">
              {STRUCTURE_VIEWS.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  size="sm"
                  variant={view === item.key ? 'default' : 'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={() => setView(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* 偏离告警 */}
        {summary.alerts.length > 0 && (
          <div className="mb-4 space-y-1.5 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2.5">
            {summary.alerts.map((row) => (
              <div key={row.key} className="flex items-center gap-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-400" />
                <span className="text-white">{row.label}</span>
                <span className={row.status === 'over' ? 'text-amber-400' : 'text-sky-400'}>
                  {row.status === 'over' ? '超配' : '低配'} {Math.abs(row.deviationPp).toFixed(1)}pp
                </span>
                <span className="text-muted-foreground">
                  · 建议{row.adjustAmount >= 0 ? '加仓' : '减仓'}约 {mask(formatMoney(Math.abs(row.adjustAmount), 'CNY'))}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 目标合计校验 */}
        {totalOff && (
          <div className="mb-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
            目标合计 {summary.totalTargetPct.toFixed(0)}%，建议调整至 100%
          </div>
        )}

        {summary.rows.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            暂无持仓数据
          </div>
        ) : (
          <div className="space-y-3.5">
            {summary.rows.map((row) => {
              const actualPct = row.actualRatio * 100
              return (
                <div key={row.key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                      <span className="truncate text-white">{row.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono text-muted-foreground">当前 {actualPct.toFixed(1)}%</span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        目标
                        <input
                          type="number"
                          value={row.targetPct === 0 ? '' : row.targetPct}
                          onChange={(e) => setTarget(row.key, e.target.value)}
                          className="w-12 rounded border border-border/50 bg-background px-1 py-0.5 text-right font-mono text-white focus:border-orange-500/50 focus:outline-none"
                          placeholder="0"
                          min="0"
                          max="100"
                        />
                        %
                      </span>
                      {row.hasTarget && (
                        <span
                          className={`w-14 text-right font-mono ${
                            row.status === 'over' ? 'text-amber-400' : row.status === 'under' ? 'text-sky-400' : 'text-muted-foreground'
                          }`}
                        >
                          {row.deviationPp >= 0 ? '+' : ''}
                          {row.deviationPp.toFixed(1)}pp
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 进度条：填充=当前占比，竖线=目标位置 */}
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(actualPct, 100)}%`, backgroundColor: row.color }}
                    />
                    {row.hasTarget && (
                      <span
                        className="absolute top-[-2px] h-[10px] w-0.5 rounded bg-white"
                        style={{ left: `calc(${Math.min(row.targetPct, 100)}% - 1px)` }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
