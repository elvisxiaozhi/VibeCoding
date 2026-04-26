import { useEffect, useState } from 'react'

const STORAGE_KEY = 'vibecoding.editMode'
type Mode = 'read' | 'edit'

function readInitial(): Mode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'edit' ? 'edit' : 'read'
  } catch {
    return 'read'
  }
}

let currentMode: Mode = readInitial()
const listeners = new Set<(m: Mode) => void>()

function broadcast(next: Mode) {
  if (next === currentMode) return
  currentMode = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // localStorage 不可用时仅保留内存状态
  }
  listeners.forEach((l) => l(next))
}

/**
 * 编辑模式开关，默认 'read'。模块级状态 + listener 订阅，多组件共享同一份。
 * 仅做前端 UX 锁，不是安全边界 — 后端无 RBAC，登录用户仍可直接调 API。
 */
export function useEditMode() {
  const [mode, setMode] = useState<Mode>(currentMode)
  useEffect(() => {
    listeners.add(setMode)
    return () => {
      listeners.delete(setMode)
    }
  }, [])
  return {
    mode,
    isReadOnly: mode === 'read',
    setReadOnly: (v: boolean) => broadcast(v ? 'read' : 'edit'),
  }
}
