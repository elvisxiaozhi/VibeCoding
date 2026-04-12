import { useState } from 'react'

import { Loader2 } from 'lucide-react'

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
import { useAuth } from '@/hooks/useAuth'

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

function PageContent({ page, isLoggedIn }: { page: PageKey; isLoggedIn: boolean }) {
  switch (page) {
    case 'overview':
      return <Dashboard isLoggedIn={isLoggedIn} />
    case 'assets':
      return <AssetTable isLoggedIn={isLoggedIn} />
    case 'settings':
      return <PagePlaceholder page={page} />
  }
}

function App() {
  const [page, setPage] = useState<PageKey>('overview')
  const { user, loading, isLoggedIn, login, logout } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <AppLayout
      active={page}
      onChange={setPage}
      title={NAV_LABELS[page]}
      user={user}
      onLogin={login}
      onLogout={logout}
    >
      <PageContent page={page} isLoggedIn={isLoggedIn} />
    </AppLayout>
  )
}

export default App
