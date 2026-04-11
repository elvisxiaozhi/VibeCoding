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
  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] text-white">
      <Sidebar active={active} onChange={onChange} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
