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
