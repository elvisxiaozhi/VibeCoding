import { useCallback, useEffect, useState } from 'react'

export interface BackupStatus {
  lastBackupAt: string // RFC3339，空串表示从未备份
  schemaVersion: number
}

// 模块级缓存：切页面 remount 时立即返回缓存
let statusCache: BackupStatus | null = null

export function useBackup(isLoggedIn: boolean) {
  const [status, setStatus] = useState<BackupStatus | null>(() => statusCache)
  const [busy, setBusy] = useState(false)

  const fetchStatus = useCallback(async () => {
    if (!isLoggedIn) {
      statusCache = null
      setStatus(null)
      return
    }
    try {
      const res = await fetch('/api/backup/status', { credentials: 'include' })
      if (!res.ok) throw new Error(`backup status failed: ${res.status}`)
      const data = (await res.json()) as BackupStatus
      statusCache = data
      setStatus(data)
    } catch (err) {
      console.error('fetch backup status failed:', err)
    }
  }, [isLoggedIn])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  // 导出：拉全量 JSON → 触发浏览器下载 → 刷新「上次备份」
  const exportBackup = useCallback(async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/backup/export', { credentials: 'include' })
      if (!res.ok) throw new Error(`导出失败：${res.status}`)
      const text = await res.text()
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const today = new Date().toISOString().slice(0, 10)
      const a = document.createElement('a')
      a.href = url
      a.download = `asset-dashboard-backup-${today}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      await fetchStatus()
    } finally {
      setBusy(false)
    }
  }, [fetchStatus])

  // 导入：上传备份文件内容 → 服务端整体替换
  const importBackup = useCallback(
    async (file: File) => {
      setBusy(true)
      try {
        const text = await file.text()
        const res = await fetch('/api/backup/import', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: text,
        })
        if (!res.ok) {
          let msg = `导入失败：${res.status}`
          try {
            const body = (await res.json()) as { error?: string }
            if (body.error) msg = body.error
          } catch {
            // 忽略解析失败
          }
          throw new Error(msg)
        }
        await fetchStatus()
      } finally {
        setBusy(false)
      }
    },
    [fetchStatus],
  )

  return { status, busy, exportBackup, importBackup, refetch: fetchStatus }
}
