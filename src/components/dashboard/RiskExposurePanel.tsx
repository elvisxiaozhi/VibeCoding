import { AlertTriangle, ShieldCheck } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney } from '@/lib/currency'
import type { ExposureItem, RiskExposure, RiskSeverity } from '@/lib/risk'
import { cn } from '@/lib/utils'

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function severityClass(severity: RiskSeverity): string {
  if (severity === 'danger') return 'border-red-500/60 bg-red-500/10 text-red-300'
  if (severity === 'warning') return 'border-amber-500/60 bg-amber-500/10 text-amber-300'
  return 'border-border/40 bg-background/40 text-muted-foreground'
}

function barClass(severity: RiskSeverity): string {
  if (severity === 'danger') return 'bg-red-500'
  if (severity === 'warning') return 'bg-amber-400'
  return 'bg-blue-500'
}

function ExposureBar({ item }: { item: ExposureItem }) {
  return (
    <div className={cn('rounded-lg border p-3', severityClass(item.severity))}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-[52px] text-sm font-medium text-white">
          {item.label}
        </div>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn('h-full rounded-full', barClass(item.severity))}
            style={{ width: `${Math.min(item.ratio * 100, 100)}%` }}
          />
        </div>
        <div className="min-w-[132px] text-right">
          <p className="font-mono text-sm text-white">{formatPercent(item.ratio)}</p>
          <p className="font-mono text-[10px] text-muted-foreground">
            {formatMoney(item.valueCNY, 'CNY')}
          </p>
        </div>
      </div>
    </div>
  )
}

function ConcentrationMetric({
  label,
  value,
  detail,
  severity = 'normal',
}: {
  label: string
  value: string
  detail?: string
  severity?: RiskSeverity
}) {
  return (
    <div className={cn('rounded-lg border p-4', severityClass(severity))}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 truncate font-mono text-xl font-semibold text-white">{value}</p>
      {detail ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  )
}

interface RiskExposurePanelProps {
  risk: RiskExposure
}

export function RiskExposurePanel({ risk }: RiskExposurePanelProps) {
  const hasAlerts = risk.alerts.length > 0

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-white">风险暴露</CardTitle>
          <div className={cn(
            'flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
            hasAlerts
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
          )}>
            {hasAlerts ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            <span>{hasAlerts ? `${risk.alerts.length} 项提醒` : '未触发阈值'}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {hasAlerts ? (
          <div className="space-y-2">
            {risk.alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                  alert.severity === 'danger'
                    ? 'border-red-500/50 bg-red-500/10 text-red-200'
                    : 'border-amber-500/50 bg-amber-500/10 text-amber-200',
                )}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <section>
            <h3 className="mb-3 text-sm font-medium text-white">币种暴露</h3>
            <div className="space-y-2">
              {risk.currency.map((item) => (
                <ExposureBar key={item.key} item={item} />
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-medium text-white">市场暴露</h3>
            <div className="space-y-2">
              {risk.market.map((item) => (
                <ExposureBar key={item.key} item={item} />
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <ConcentrationMetric
            label="最大单一标的"
            value={risk.largestHolding ? formatPercent(risk.largestHolding.ratio) : '—'}
            detail={risk.largestHolding?.symbol}
            severity={risk.largestHolding?.severity ?? 'normal'}
          />
          <ConcentrationMetric
            label="Top 5 持仓占比"
            value={formatPercent(risk.top5Ratio)}
            detail={risk.top5Holdings.map((item) => item.symbol).join(' / ') || '暂无持仓'}
            severity={risk.top5Severity}
          />
          <ConcentrationMetric
            label="持仓标的数"
            value={`${risk.holdingCount}`}
            detail="按 symbol 汇总"
          />
          <ConcentrationMetric
            label="高亮提醒"
            value={`${risk.alerts.length}`}
            detail="超过预设阈值"
            severity={hasAlerts ? 'warning' : 'normal'}
          />
        </div>
      </CardContent>
    </Card>
  )
}
