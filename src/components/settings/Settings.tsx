import { Lock, Unlock } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useEditMode } from '@/hooks/useEditMode'
import { usePriceRefresh } from '@/hooks/usePriceRefresh'

const REFRESH_INTERVAL_OPTIONS = [
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 60, label: '1 小时' },
  { value: 1440, label: '每日一次' },
]

export function Settings({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { isReadOnly, setReadOnly } = useEditMode()
  const { settings, saveSettings } = usePriceRefresh(isLoggedIn, undefined, { autoRun: false })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-white">编辑模式</CardTitle>
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
                <p className="text-sm font-medium text-white">
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
          <CardTitle className="text-white">价格自动刷新</CardTitle>
          <CardDescription>
            控制 Dashboard 价格刷新中心的自动刷新行为。刷新失败会保留旧价格并记录错误。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-4">
            <div>
              <p className="text-sm font-medium text-white">启用自动刷新</p>
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
              <p className="text-sm font-medium text-white">打开 Dashboard 时刷新</p>
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
              <p className="text-sm font-medium text-white">刷新频率</p>
              <p className="text-xs text-muted-foreground">仅在页面打开期间生效</p>
            </div>
            <select
              value={settings.refreshIntervalMinutes}
              disabled={!isLoggedIn || !settings.autoRefreshEnabled}
              onChange={(e) => saveSettings({ ...settings, refreshIntervalMinutes: Number(e.target.value) })}
              className="h-9 rounded-md border border-border/50 bg-background px-3 text-sm text-white disabled:opacity-50"
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
    </div>
  )
}
