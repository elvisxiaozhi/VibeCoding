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
import type { OwnerType } from '@/lib/types'

type OwnerFilter = OwnerType | 'all'

const OWNER_TABS: { key: OwnerFilter; label: string }[] = [
  { key: 'all', label: '家庭汇总' },
  { key: 'me', label: '我的' },
  { key: 'wife', label: '老婆的' },
]

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

function PageContent({ page, isLoggedIn, ownerFilter }: { page: PageKey; isLoggedIn: boolean; ownerFilter: OwnerFilter }) {
  const owner = ownerFilter === 'all' ? undefined : ownerFilter
  switch (page) {
    case 'overview':
      return <Dashboard isLoggedIn={isLoggedIn} ownerFilter={owner} />
    case 'assets':
      return <AssetTable isLoggedIn={isLoggedIn} ownerFilter={owner} />
    case 'settings':
      return <PagePlaceholder page={page} />
  }
}

function App() {
  const [page, setPage] = useState<PageKey>('overview')
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all')
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
      {/* Owner filter tabs */}
      {isLoggedIn && (
        <div className="mb-6 flex gap-1 rounded-lg bg-muted/30 p-1">
          {OWNER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setOwnerFilter(tab.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                ownerFilter === tab.key
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      <PageContent page={page} isLoggedIn={isLoggedIn} ownerFilter={ownerFilter} />
    </AppLayout>
  )
}

export default App
