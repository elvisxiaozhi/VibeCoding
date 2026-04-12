import { useState } from 'react'
import { CalendarDays, LogIn, LogOut, Menu, User } from 'lucide-react'

import { LoginDialog } from '@/components/auth/LoginDialog'
import { Button } from '@/components/ui/button'
import type { User as UserType } from '@/hooks/useAuth'

interface HeaderProps {
  title: string
  onMenuToggle: () => void
  user: UserType | null
  onLogin: (username: string, password: string) => Promise<string | null>
  onLogout: () => void
}

function formatToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function Header({ title, onMenuToggle, user, onLogin, onLogout }: HeaderProps) {
  const [loginOpen, setLoginOpen] = useState(false)

  return (
    <header className="flex h-16 items-center justify-between border-b border-border/50 bg-[#0a0a0a] px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          className="rounded-md p-1 text-muted-foreground hover:text-white lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground">个人资产汇总看板</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground font-mono">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>{formatToday()}</span>
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{user.username}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground hover:text-white">
              <LogOut className="mr-1.5 h-4 w-4" />
              登出
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setLoginOpen(true)} className="text-muted-foreground hover:text-white">
            <LogIn className="mr-1.5 h-4 w-4" />
            登录
          </Button>
        )}
      </div>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} onLogin={onLogin} />
    </header>
  )
}
