import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { usePrivacy } from '@/context/PrivacyContext'
import { formatMoney, toCNY } from '@/lib/currency'
import { marketValue } from '@/lib/calc'
import type { Asset } from '@/lib/types'

interface Props {
  divRecords: Asset[]
  holdings: Asset[]
  rates: Record<string, number>
}

function shortMoney(v: number): string {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (a >= 10_000) return `${(v / 10_000).toFixed(1)}万`
  return `${Math.round(v)}`
}

function lastNMonths(n: number): string[] {
  const result: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

const TOOLTIP_STYLE = {
  background: '#111827',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
  padding: '8px 12px',
}

export function DividendIncomePanel({ divRecords, holdings, rates }: Props) {
  const { isPrivate, mask } = usePrivacy()
  if (divRecords.length === 0) return null

  // ── stats ──────────────────────────────────────────────────────────────────
  const totalDivCNY = divRecords.reduce(
    (s, a) => s + toCNY(a.dividends, a.currency, rates),
    0,
  )

  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const t12Records = divRecords.filter((a) => a.purchasedAt >= cutoffStr)
  const t12DivCNY = t12Records.reduce(
    (s, a) => s + toCNY(a.dividends, a.currency, rates),
    0,
  )

  const totalMVCNY = holdings.reduce(
    (s, a) => s + toCNY(marketValue(a), a.currency, rates),
    0,
  )
  const yieldRate = totalMVCNY > 0 ? t12DivCNY / totalMVCNY : null

  // ── monthly chart (last 24 months) ─────────────────────────────────────────
  const months = lastNMonths(24)
  const buckets = new Map<string, number>(months.map((m) => [m, 0]))
  for (const a of divRecords) {
    const m = a.purchasedAt.slice(0, 7)
    if (buckets.has(m)) buckets.set(m, (buckets.get(m) ?? 0) + toCNY(a.dividends, a.currency, rates))
  }
  const chartData = months.map((m) => ({ month: m, value: Math.round(buckets.get(m) ?? 0) }))

  // ── symbol rankings ────────────────────────────────────────────────────────
  const symMap = new Map<string, { cny: number; count: number; last: string }>()
  for (const a of divRecords) {
    const cny = toCNY(a.dividends, a.currency, rates)
    const e = symMap.get(a.symbol)
    if (e) {
      e.cny += cny
      e.count++
      if (a.purchasedAt > e.last) e.last = a.purchasedAt
    } else {
      symMap.set(a.symbol, { cny, count: 1, last: a.purchasedAt })
    }
  }
  const rankings = [...symMap.entries()]
    .map(([symbol, d]) => ({ symbol, ...d }))
    .sort((a, b) => b.cny - a.cny)
    .slice(0, 10)
  const maxCNY = rankings[0]?.cny ?? 1

  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">分红 / 被动收入</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{divRecords.length} 条记录</p>
        </div>
        <div className="text-xs text-muted-foreground">近 12 月 / 全部历史</div>
      </div>

      {/* 三项指标 */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
          <div className="text-xs text-muted-foreground">累计分红</div>
          <div className="mt-1 font-mono text-lg text-[#fbbf24]">{mask(formatMoney(totalDivCNY, 'CNY'))}</div>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
          <div className="text-xs text-muted-foreground">近 12 月分红</div>
          <div className="mt-1 font-mono text-lg text-[#fbbf24]">{mask(formatMoney(t12DivCNY, 'CNY'))}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">月均 {mask(formatMoney(t12DivCNY / 12, 'CNY'))}</div>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
          <div className="text-xs text-muted-foreground">近 12 月股息率</div>
          <div className={`mt-1 font-mono text-lg ${yieldRate === null ? 'text-muted-foreground' : 'text-[#fbbf24]'}`}>
            {yieldRate === null ? '—' : `${(yieldRate * 100).toFixed(2)}%`}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">分红 ÷ 当前市值</div>
        </div>
      </div>

      {/* 月度柱状图 */}
      <div className="mt-5">
        <div className="mb-2 text-xs text-muted-foreground">月度分红（近 24 月，人民币）</div>
        <ResponsiveContainer width="100%" height={156}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={3}
              tickFormatter={(v: string) => {
                const [y, m] = v.split('-')
                return `${y.slice(2)}/${m}`
              }}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={isPrivate ? () => '' : shortMoney}
              width={36}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: 'rgba(251,191,36,0.08)' }}
              formatter={(v) => [mask(formatMoney(Number(v ?? 0), 'CNY')), '分红']}
              labelFormatter={(label) => String(label ?? '')}
            />
            <Bar dataKey="value" fill="#fbbf24" radius={[2, 2, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 来源排行 */}
      {rankings.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs text-muted-foreground">分红来源</div>
          <div className="space-y-2">
            {rankings.map((r) => (
              <div key={r.symbol} className="flex items-center gap-3">
                <div className="w-20 shrink-0 truncate font-mono text-xs text-white">{r.symbol}</div>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#fbbf24]"
                    style={{ width: `${(r.cny / maxCNY) * 100}%` }}
                  />
                </div>
                <div className="w-28 shrink-0 text-right font-mono text-xs text-[#fbbf24]">
                  {mask(formatMoney(r.cny, 'CNY'))}
                </div>
                <div className="hidden w-16 shrink-0 text-right text-xs text-muted-foreground sm:block">
                  {r.last.slice(0, 7)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
