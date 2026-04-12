import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLogin: (username: string, password: string) => Promise<string | null>
}

export function LoginDialog({ open, onOpenChange, onLogin }: LoginDialogProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('请输入用户名和密码')
      return
    }
    setError('')
    setSubmitting(true)
    const err = await onLogin(username.trim(), password)
    setSubmitting(false)
    if (err) {
      setError(err)
    } else {
      setUsername('')
      setPassword('')
      onOpenChange(false)
    }
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setError('')
      setUsername('')
      setPassword('')
    }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="text-white">登录</DialogTitle>
          <DialogDescription>登录后管理您的资产数据</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-username">用户名</Label>
            <Input
              id="login-username"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-password">密码</Label>
            <Input
              id="login-password"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-[#ef4444]">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '登录中...' : '登录'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
