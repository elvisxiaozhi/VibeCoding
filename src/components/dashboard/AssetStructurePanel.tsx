import { useMemo, useState } from 'react'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePrivacy } from '@/context/PrivacyContext'
import { formatMoney } from '@/lib/currency'
import type { Asset } from '@/lib/types'
import { STRUCTURE_VIEWS, buildItems, type StructureView } from '@/lib/structure'

interface AssetStructurePanelProps {
  holdings: Asset[]
  totalValueCNY: number
  assetValueCNY: (asset: Asset) => number
}

export function AssetStructurePanel({
  holdings,
  totalValueCNY,
  assetValueCNY,
}: AssetStructurePanelProps) {
  const { mask } = usePrivacy()
  const [view, setView] = useState<StructureView>('category')
  const items = useMemo(
    () => buildItems(holdings, totalValueCNY, assetValueCNY, view).filter((item) => item.value > 0),
    [assetValueCNY, holdings, totalValueCNY, view],
  )

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-white">资产结构</CardTitle>
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
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            暂无持仓结构数据
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="h-[190px] sm:h-[220px]">
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
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--popover-foreground))',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [mask(formatMoney(Number(value), 'CNY')), '市值']}
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
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(item.ratio * 100, 100)}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <div className="text-right font-mono text-xs text-muted-foreground">
                    {mask(formatMoney(item.value, 'CNY'))}
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
