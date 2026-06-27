import { useState } from 'react'

import { usePrivacy } from '@/context/PrivacyContext'
import { formatCompactMoney, formatMoney } from '@/lib/currency'
import type { ContributionBreakdown, ContributionPeriod } from '@/lib/contributions'

interface Props {
  month: ContributionBreakdown
  year: ContributionBreakdown
  inception: ContributionBreakdown
}

const PERIOD_LABELS: Record<ContributionPeriod, string> = {
  month: '本月',
  year: '今年',
  inception: '持有至今',
}

function fmt(n: number) {
  return formatMoney(n, 'CNY')
}

function fmtCompact(n: number) {
  return formatCompactMoney(n, 'CNY')
}

function signed(n: number) {
  return `${n >= 0 ? '+' : ''}${fmt(n)}`
}

function signedCompact(n: number) {
  return `${n >= 0 ? '+' : ''}${fmtCompact(n)}`
}

function pct(part: number, total: number): string {
  if (total === 0 || !isFinite(part / total)) return '—'
  return `${((part / total) * 100).toFixed(1)}%`
}

function Bar({ contributed, market }: { contributed: number; market: number }) {
  const total = Math.abs(contributed) + Math.abs(market)
  if (total === 0) return null
  const cPct = Math.round((Math.abs(contributed) / total) * 100)
  const mPct = 100 - cPct
  const cPositive = contributed >= 0
  const mPositive = market >= 0
  return (
    <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full">
      <div
        className={`transition-all ${cPositive ? 'bg-blue-400/70' : 'bg-blue-400/30'}`}
        style={{ width: `${cPct}%` }}
      />
      <div
        className={`transition-all ${mPositive ? 'bg-[#ef4444]/70' : 'bg-[#22c55e]/70'}`}
        style={{ width: `${mPct}%` }}
      />
    </div>
  )
}

export function ContributionPanel({ month, year, inception }: Props) {
  const { mask } = usePrivacy()
  const [period, setPeriod] = useState<ContributionPeriod>('year')
  const data = period === 'month' ? month : period === 'year' ? year : inception
  const { netContributed, marketGain, totalGrowth, hasBaseline } = data
  const absTotal = Math.abs(netContributed) + Math.abs(marketGain)

  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">出入金 vs 市场收益</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">净值增长中，多少来自你的投入，多少来自市场</p>
        </div>
        <div className="flex gap-1">
          {(['month', 'year', 'inception'] as ContributionPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                period === p
                  ? 'bg-white/15 text-white ring-1 ring-white/20'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {!hasBaseline && period !== 'inception' && (
        <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
          暂无该时间段起点的快照，无法计算基准市值，结果仅含期间出入金
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-blue-500/20 bg-background/40 p-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-blue-400/70" />
            <div className="text-xs text-muted-foreground">净投入</div>
          </div>
          <div
            className="mt-1.5 font-mono text-xl text-white"
            title={mask(signed(netContributed))}
          >
            {mask(signedCompact(netContributed))}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            占比 {pct(Math.abs(netContributed), absTotal)}
          </div>
        </div>

        <div className={`rounded-lg border p-3 ${marketGain >= 0 ? 'border-red-500/20 bg-background/40' : 'border-green-500/20 bg-background/40'}`}>
          <div className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${marketGain >= 0 ? 'bg-[#ef4444]/70' : 'bg-[#22c55e]/70'}`} />
            <div className="text-xs text-muted-foreground">市场收益</div>
          </div>
          <div
            className={`mt-1.5 font-mono text-xl ${marketGain >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}
            title={mask(signed(marketGain))}
          >
            {mask(signedCompact(marketGain))}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            占比 {pct(Math.abs(marketGain), absTotal)}
          </div>
        </div>

        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
          <div className="text-xs text-muted-foreground">净值变动</div>
          <div
            className={`mt-1.5 font-mono text-xl ${totalGrowth >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}
            title={mask(signed(totalGrowth))}
          >
            {mask(signedCompact(totalGrowth))}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            含分红 · {period === 'inception' ? '历史全量' : PERIOD_LABELS[period]}
          </div>
        </div>
      </div>

      <Bar contributed={netContributed} market={marketGain} />
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>净投入 {pct(Math.abs(netContributed), absTotal)}</span>
        <span>市场 {pct(Math.abs(marketGain), absTotal)}</span>
      </div>
    </div>
  )
}
