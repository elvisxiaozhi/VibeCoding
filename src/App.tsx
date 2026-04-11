import { useState } from 'react'

import { AppLayout } from '@/components/layout/AppLayout'
import { NAV_LABELS, type PageKey } from '@/components/layout/Sidebar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAssets } from '@/hooks/useAssets'
import { CATEGORY_LABELS } from '@/lib/types'

/** Step 2 临时自检：用纯文本展示 Hook 读出的汇总数据，Step 3 会被真实看板替换 */
function DataSelfCheck() {
  const {
    assets,
    totalValue,
    totalCost,
    totalPnL,
    categoryBreakdown,
  } = useAssets()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-white">Step 2 数据自检</CardTitle>
        <CardDescription>
          来自 <code>useAssets()</code> 的实时数据，验证 Mock → localStorage →
          Hook → 计算 的全链路。Step 3 将替换为正式看板。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-3 gap-4 font-mono text-sm text-white">
          <div>
            <dt className="text-xs text-muted-foreground">资产条数</dt>
            <dd className="mt-1 text-lg">{assets.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">总市值 (CNY)</dt>
            <dd className="mt-1 text-lg">{totalValue.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">总成本 (CNY)</dt>
            <dd className="mt-1 text-lg">{totalCost.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">浮动盈亏 (CNY)</dt>
            <dd
              className={
                'mt-1 text-lg ' +
                (totalPnL >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]')
              }
            >
              {totalPnL >= 0 ? '+' : ''}
              {totalPnL.toFixed(2)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">分类占比</dt>
            <dd className="mt-1 space-y-1 text-xs">
              {categoryBreakdown.map((item) => (
                <div key={item.category} className="flex justify-between">
                  <span>{CATEGORY_LABELS[item.category]}</span>
                  <span>
                    {item.value.toFixed(2)} ({(item.ratio * 100).toFixed(1)}%)
                  </span>
                </div>
              ))}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

function PagePlaceholder({ page }: { page: PageKey }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-white">{NAV_LABELS[page]}</CardTitle>
          <CardDescription>
            Step 1 骨架占位 — 后续 Step 将在此区域填充真实内容。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            当前激活页面：
            <span className="ml-2 rounded bg-white/5 px-2 py-0.5 font-mono text-xs text-white">
              {page}
            </span>
          </p>
          <div className="mt-4 flex gap-2">
            <Button>主要按钮</Button>
            <Button variant="secondary">次要按钮</Button>
            <Button variant="outline">轮廓按钮</Button>
          </div>
        </CardContent>
      </Card>
      {page === 'overview' ? <DataSelfCheck /> : null}
    </div>
  )
}

function App() {
  const [page, setPage] = useState<PageKey>('overview')

  return (
    <AppLayout active={page} onChange={setPage} title={NAV_LABELS[page]}>
      <PagePlaceholder page={page} />
    </AppLayout>
  )
}

export default App
