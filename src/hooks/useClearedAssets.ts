import { useEffect, useState } from 'react'

import type { ClearedAsset } from '@/lib/types'

// 模块级缓存：静态 JSON，会话内不变
let clearedAssetsCache: ClearedAsset[] | null = null

export function useClearedAssets(isLoggedIn: boolean) {
  const [assets, setAssets] = useState<ClearedAsset[]>(() => clearedAssetsCache ?? [])
  const [loading, setLoading] = useState(() => isLoggedIn && clearedAssetsCache === null)

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false)
      return
    }
    if (clearedAssetsCache !== null) {
      setAssets(clearedAssetsCache)
      setLoading(false)
      return
    }
    fetch('/cleared-assets.json')
      .then((r) => r.json())
      .then((data: ClearedAsset[]) => {
        clearedAssetsCache = data
        setAssets(data)
      })
      .catch(() => setAssets([]))
      .finally(() => setLoading(false))
  }, [isLoggedIn])

  return { assets, loading }
}
