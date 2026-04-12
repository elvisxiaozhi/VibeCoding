import { useState } from 'react'
import type { ReactNode } from 'react'

import { Header } from './Header'
import { Sidebar, type PageKey } from './Sidebar'

interface AppLayoutProps {
  active: PageKey
  onChange: (key: PageKey) => void
  title: string
  children: ReactNode
}

export function AppLayout({ active, onChange, title, children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] text-white">
      <Sidebar
        active={active}
        onChange={onChange}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={title}
          onMenuToggle={() => setSidebarCollapsed((c) => !c)}
        />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
