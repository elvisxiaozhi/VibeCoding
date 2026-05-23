import { Fragment, useState } from 'react'

import { Loader2 } from 'lucide-react'

import { AssetTable } from '@/components/assets/AssetTable'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { AppLayout } from '@/components/layout/AppLayout'
import { NAV_LABELS, type PageKey } from '@/components/layout/Sidebar'
import { Settings } from '@/components/settings/Settings'
import { Toaster } from '@/components/ui/sonner'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import type { OwnerType } from '@/lib/types'

type OwnerFilter = OwnerType | 'all'

const OWNER_TABS: { key: OwnerFilter; label: string }[] = [
  { key: 'all', label: '家庭汇总' },
  { key: 'me', label: '我的' },
  { key: 'wife', label: '老婆的' },
]

function PageContent({ page, isLoggedIn, ownerFilter }: { page: PageKey; isLoggedIn: boolean; ownerFilter: OwnerFilter }) {
  const owner = ownerFilter === 'all' ? undefined : ownerFilter
  switch (page) {
    case 'overview':
      return <Dashboard isLoggedIn={isLoggedIn} ownerFilter={owner} />
    case 'assets':
      return <AssetTable isLoggedIn={isLoggedIn} ownerFilter={owner} />
    case 'settings':
      return <Settings isLoggedIn={isLoggedIn} />
  }
}

function App() {
  const [page, setPage] = useState<PageKey>('overview')
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all')
  const { user, loading, isLoggedIn, login, logout } = useAuth()
  useTheme()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Fragment>
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
          <div className="mb-4 flex w-full gap-1 overflow-x-auto rounded-md border border-border/30 bg-background/30 p-1 sm:w-fit">
            {OWNER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setOwnerFilter(tab.key)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  ownerFilter === tab.key
                    ? 'bg-foreground/10 text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        <PageContent page={page} isLoggedIn={isLoggedIn} ownerFilter={ownerFilter} />
      </AppLayout>
      <Toaster position="bottom-right" richColors />
    </Fragment>
  )
}

export default App
