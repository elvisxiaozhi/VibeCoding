import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CategoryBreakdownItem } from '@/lib/calc'
import { CATEGORY_LABELS } from '@/lib/types'

const COLORS: Record<string, string> = {
  stock: '#3b82f6',
  etf: '#8b5cf6',
  crypto: '#f59e0b',
  cash: '#22c55e',
  currency: '#06b6d4',
}

interface CategoryPieChartProps {
  data: CategoryBreakdownItem[]
}

function formatCNY(n: number): string {
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  // 过滤掉市值为 0 的分类，避免饼图出现空切片
  const filtered = data.filter((d) => d.value > 0)

  const chartData = filtered.map((d) => ({
    name: CATEGORY_LABELS[d.category],
    value: d.value,
    ratio: d.ratio,
    color: COLORS[d.category] ?? '#6b7280',
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-white">分类占比</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-8">
          {/* 饼图 */}
          <div className="h-[200px] w-[200px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  strokeWidth={0}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
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
                  formatter={(value) => [`¥${formatCNY(Number(value))}`, '市值']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 图例 */}
          <div className="space-y-3">
            {chartData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-3">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-muted-foreground">
                  {entry.name}
                </span>
                <span className="ml-auto font-mono text-sm text-white">
                  {(entry.ratio * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
