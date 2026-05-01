import { useMemo, useState } from 'react'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney } from '@/lib/currency'
import type { Asset } from '@/lib/types'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CURRENCY_CODES,
  CURRENCY_LABELS,
  MARKET_LABELS,
  MARKET_ORDER,
  OWNER_LABELS,
  OWNER_OPTIONS,
} from '@/lib/types'

type StructureView = 'category' | 'market' | 'currency' | 'owner'

interface StructureItem {
  key: string
  label: string
  value: number
  ratio: number
  color: string
}

interface AssetStructurePanelProps {
  holdings: Asset[]
  totalValueCNY: number
  assetValueCNY: (asset: Asset) => number
}

const COLORS = ['#60a5fa', '#f97316', '#22c55e', '#e879f9', '#facc15', '#38bdf8']

const VIEWS: { key: StructureView; label: string }[] = [
  { key: 'category', label: '分类' },
  { key: 'market', label: '市场' },
  { key: 'currency', label: '币种' },
  { key: 'owner', label: '归属' },
]

function buildItems(
  holdings: Asset[],
  totalValueCNY: number,
  assetValueCNY: (asset: Asset) => number,
  view: StructureView,
): StructureItem[] {
  const definitions =
    view === 'category'
      ? CATEGORY_ORDER.map((key) => ({ key, label: CATEGORY_LABELS[key] }))
      : view === 'market'
        ? MARKET_ORDER.map((key) => ({ key, label: MARKET_LABELS[key] }))
        : view === 'currency'
          ? CURRENCY_CODES.map((key) => ({ key, label: CURRENCY_LABELS[key] }))
          : OWNER_OPTIONS.map((key) => ({ key, label: OWNER_LABELS[key] }))

  const bucket = new Map<string, number>()
  for (const item of definitions) bucket.set(item.key, 0)

  for (const asset of holdings) {
    const key =
      view === 'category'
        ? asset.category
        : view === 'market'
          ? asset.market
          : view === 'currency'
            ? asset.currency
            : asset.owner
    bucket.set(key, (bucket.get(key) ?? 0) + assetValueCNY(asset))
  }

  return definitions
    .map((item, index) => {
      const value = bucket.get(item.key) ?? 0
      return {
        ...item,
        value,
        ratio: totalValueCNY === 0 ? 0 : value / totalValueCNY,
        color: COLORS[index % COLORS.length],
      }
    })
    .filter((item) => item.value > 0)
}

export function AssetStructurePanel({
  holdings,
  totalValueCNY,
  assetValueCNY,
}: AssetStructurePanelProps) {
  const [view, setView] = useState<StructureView>('category')
  const items = useMemo(
    () => buildItems(holdings, totalValueCNY, assetValueCNY, view),
    [assetValueCNY, holdings, totalValueCNY, view],
  )

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-white">资产结构</CardTitle>
          <div className="flex gap-1 rounded-lg border border-border/50 bg-background/40 p-1">
            {VIEWS.map((item) => (
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
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            暂无持仓结构数据
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={items}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={86}
                    strokeWidth={0}
                  >
                    {items.map((item) => (
                      <Cell key={item.key} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [formatMoney(Number(value), 'CNY'), '市值']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="truncate text-white">{item.label}</span>
                    </div>
                    <span className="font-mono text-muted-foreground">{(item.ratio * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(item.ratio * 100, 100)}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <div className="text-right font-mono text-xs text-muted-foreground">
                    {formatMoney(item.value, 'CNY')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
