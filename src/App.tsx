import { useState } from 'react'

import { AssetTable } from '@/components/assets/AssetTable'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { AppLayout } from '@/components/layout/AppLayout'
import { NAV_LABELS, type PageKey } from '@/components/layout/Sidebar'
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
        <CardDescription>此页面将在后续 Step 中实现。</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  )
}

function PageContent({ page }: { page: PageKey }) {
  switch (page) {
    case 'overview':
      return <Dashboard />
    case 'assets':
      return <AssetTable />
    case 'settings':
      return <PagePlaceholder page={page} />
  }
}

function App() {
  const [page, setPage] = useState<PageKey>('overview')

  return (
    <AppLayout active={page} onChange={setPage} title={NAV_LABELS[page]}>
      <PageContent page={page} />
    </AppLayout>
  )
}

export default App
