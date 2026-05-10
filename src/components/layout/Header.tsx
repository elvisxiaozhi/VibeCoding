import { useState } from 'react'
import { LogIn, LogOut, Menu, User } from 'lucide-react'

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

export function Header({ title, onMenuToggle, user, onLogin, onLogout }: HeaderProps) {
  const [loginOpen, setLoginOpen] = useState(false)

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/30 bg-[#090909] px-5 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          className="rounded-md p-1 text-muted-foreground hover:text-white lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <div className="flex items-center gap-2">
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
