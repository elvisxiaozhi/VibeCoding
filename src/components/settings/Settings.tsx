import { useRef, useState } from 'react'
import { AlertTriangle, Download, Loader2, Lock, ShieldCheck, Unlock, Upload } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useBackup } from '@/hooks/useBackup'
import { useEditMode } from '@/hooks/useEditMode'
import { usePriceRefresh } from '@/hooks/usePriceRefresh'
import { useTheme, type ThemeMode } from '@/hooks/useTheme'

// describeLastBackup 把 RFC3339 时间转成「今天 / X 天前 / 从未备份」，并标记是否过期
function describeLastBackup(iso: string): { text: string; stale: boolean } {
  if (!iso) return { text: '从未备份', stale: true }
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return { text: '未知', stale: true }
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000)
  if (days <= 0) return { text: '今天', stale: false }
  if (days === 1) return { text: '昨天', stale: false }
  return { text: `${days} 天前`, stale: days >= 7 }
}

const REFRESH_INTERVAL_OPTIONS = [
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 60, label: '1 小时' },
  { value: 1440, label: '每日一次' },
]

const THEME_OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
  { value: 'system', label: '跟随系统', description: '自动使用设备当前的白天 / 黑夜模式' },
  { value: 'light', label: '浅色', description: '固定使用浅色界面' },
  { value: 'dark', label: '深色', description: '固定使用深色界面' },
]

export function Settings({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { isReadOnly, setReadOnly } = useEditMode()
  const { settings, saveSettings } = usePriceRefresh(isLoggedIn, undefined, { autoRun: false })
  const { mode, resolvedTheme, setTheme } = useTheme()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">外观模式</CardTitle>
          <CardDescription>
            默认跟随系统设置，也可以手动固定为浅色或深色。当前实际模式：{resolvedTheme === 'dark' ? '深色' : '浅色'}。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            {THEME_OPTIONS.map((option) => {
              const active = mode === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    active
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border/50 bg-background/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="mt-1 block text-xs">{option.description}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">编辑模式</CardTitle>
          <CardDescription>
            只读模式下，资产页面的新增 / 编辑 / 删除按钮全部隐藏，避免误操作。价格自动刷新不受影响。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-4">
            <div className="flex items-center gap-3">
              {isReadOnly ? (
                <Lock className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Unlock className="h-5 w-5 text-amber-400" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isReadOnly ? '只读模式' : '编辑模式'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isReadOnly
                    ? '当前无法修改任何资产数据'
                    : '可以新增、编辑、删除资产'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!isReadOnly}
              onClick={() => setReadOnly(!isReadOnly)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                isReadOnly ? 'bg-muted' : 'bg-amber-400'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  isReadOnly ? 'translate-x-0.5' : 'translate-x-[1.375rem]'
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">价格自动刷新</CardTitle>
          <CardDescription>
            控制 Dashboard 价格刷新中心的自动刷新行为。刷新失败会保留旧价格并记录错误。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">启用自动刷新</p>
              <p className="text-xs text-muted-foreground">关闭后仍可在 Dashboard 手动刷新</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoRefreshEnabled}
              disabled={!isLoggedIn}
              onClick={() => saveSettings({ ...settings, autoRefreshEnabled: !settings.autoRefreshEnabled })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                settings.autoRefreshEnabled ? 'bg-amber-400' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings.autoRefreshEnabled ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">打开 Dashboard 时刷新</p>
              <p className="text-xs text-muted-foreground">每天第一次进入时更容易拿到新价格</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.refreshOnDashboardOpen}
              disabled={!isLoggedIn}
              onClick={() => saveSettings({ ...settings, refreshOnDashboardOpen: !settings.refreshOnDashboardOpen })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                settings.refreshOnDashboardOpen ? 'bg-amber-400' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings.refreshOnDashboardOpen ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">刷新频率</p>
              <p className="text-xs text-muted-foreground">仅在页面打开期间生效</p>
            </div>
            <select
              value={settings.refreshIntervalMinutes}
              disabled={!isLoggedIn || !settings.autoRefreshEnabled}
              onChange={(e) => saveSettings({ ...settings, refreshIntervalMinutes: Number(e.target.value) })}
              className="h-9 rounded-md border border-border/50 bg-background px-3 text-sm text-foreground disabled:opacity-50"
            >
              {REFRESH_INTERVAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <BackupCard isLoggedIn={isLoggedIn} isReadOnly={isReadOnly} />
    </div>
  )
}

function BackupCard({ isLoggedIn, isReadOnly }: { isLoggedIn: boolean; isReadOnly: boolean }) {
  const { status, busy, exportBackup, importBackup } = useBackup(isLoggedIn)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const last = describeLastBackup(status?.lastBackupAt ?? '')

  async function handleExport() {
    try {
      await exportBackup()
      toast.success('已导出全量备份')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导出失败')
    }
  }

  function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许重复选择同一文件
    if (file) setPendingFile(file)
  }

  async function handleConfirmImport() {
    if (!pendingFile) return
    const file = pendingFile
    setPendingFile(null)
    try {
      await importBackup(file)
      toast.success('数据已恢复，即将刷新页面')
      setTimeout(() => window.location.reload(), 900)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导入失败')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">数据备份</CardTitle>
        <CardDescription>
          导出全量数据（资产、负债、净值快照、汇率等）为单个 JSON 文件，可随时导入恢复。建议定期导出留底。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-4">
          <div className="flex items-center gap-3">
            {last.stale ? (
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">上次备份：{last.text}</p>
              <p className="text-xs text-muted-foreground">
                {last.stale ? '距上次备份已较久，建议立即导出一份' : '备份较新，数据安全'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleExport}
            disabled={!isLoggedIn || busy}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            导出全量备份
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isLoggedIn || isReadOnly || busy}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-border/50 bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            从备份恢复
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handlePickFile}
          />
        </div>
        {isReadOnly && (
          <p className="text-xs text-muted-foreground">只读模式下无法导入恢复，请先在「编辑模式」中开启编辑。</p>
        )}
      </CardContent>

      <AlertDialog open={pendingFile !== null} onOpenChange={(open) => !open && setPendingFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认从备份恢复？</AlertDialogTitle>
            <AlertDialogDescription>
              这会用备份文件「{pendingFile?.name}」<span className="font-semibold text-foreground">整体覆盖</span>
              当前全部数据（资产、负债、快照、汇率）。导入前服务端会自动生成一份当前数据的快照兜底，但此操作仍不可在前端撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmImport}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认覆盖恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
