import { Lock, Unlock } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useEditMode } from '@/hooks/useEditMode'

export function Settings() {
  const { isReadOnly, setReadOnly } = useEditMode()

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
    </div>
  )
}
