import { LayoutDashboard, Wallet, Settings, LineChart, Menu, X } from 'lucide-react'

import { cn } from '@/lib/utils'

export type PageKey = 'overview' | 'assets' | 'settings'

interface NavItem {
  key: PageKey
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { key: 'overview', label: '总览', icon: LayoutDashboard },
  { key: 'assets', label: '资产', icon: Wallet },
  { key: 'settings', label: '设置', icon: Settings },
]

interface SidebarProps {
  active: PageKey
  onChange: (key: PageKey) => void
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ active, onChange, collapsed, onToggle }: SidebarProps) {
  return (
    <>
      {/* 移动端遮罩 */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[240px] shrink-0 flex-col border-r border-border/50 bg-[#0d0d0f] transition-transform duration-200 lg:static lg:translate-x-0',
          collapsed ? '-translate-x-full' : 'translate-x-0',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border/50 px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <LineChart className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">资产看板</div>
              <div className="text-[11px] text-muted-foreground">Asset Dashboard</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-md p-1 text-muted-foreground hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = active === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onChange(item.key)
                  // 移动端点击导航后自动收起
                  if (window.innerWidth < 1024) {
                    onToggle()
                  }
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="border-t border-border/50 p-4 text-[11px] text-muted-foreground">
          v1.0 · Asset Dashboard
        </div>
      </aside>
    </>
  )
}

export const NAV_LABELS: Record<PageKey, string> = {
  overview: '总览',
  assets: '资产',
  settings: '设置',
}

export { Menu as MenuIcon }
