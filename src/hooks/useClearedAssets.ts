import { useEffect, useState } from 'react'

import type { ClearedAsset } from '@/lib/types'

export function useClearedAssets(isLoggedIn: boolean) {
  const [assets, setAssets] = useState<ClearedAsset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false)
      return
    }
    fetch('/cleared-assets.json')
      .then((r) => r.json())
      .then((data: ClearedAsset[]) => setAssets(data))
      .catch(() => setAssets([]))
      .finally(() => setLoading(false))
  }, [isLoggedIn])

  return { assets, loading }
}
