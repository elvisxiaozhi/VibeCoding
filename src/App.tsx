import { useState } from 'react'

import { Dashboard } from '@/components/dashboard/Dashboard'
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
    <Card>
      <CardHeader>
        <CardTitle className="text-white">{NAV_LABELS[page]}</CardTitle>
        <CardDescription>
          此页面将在后续 Step 中实现。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button>主要按钮</Button>
          <Button variant="secondary">次要按钮</Button>
          <Button variant="outline">轮廓按钮</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function App() {
  const [page, setPage] = useState<PageKey>('overview')

  return (
    <AppLayout active={page} onChange={setPage} title={NAV_LABELS[page]}>
      {page === 'overview' ? <Dashboard /> : <PagePlaceholder page={page} />}
    </AppLayout>
  )
}

export default App
