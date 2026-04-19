import { useEffect, useState } from 'react'

import type { ExchangeRates } from '@/lib/currency'

// 缓存：同一页面生命周期内只请求一次
let cachedRates: ExchangeRates | null = null
let cacheTimestamp = 0
const CACHE_TTL = 30 * 60 * 1000 // 30 分钟

export function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRates>(cachedRates ?? { USD: 1, CNY: 7.25, HKD: 7.82 })
  const [loading, setLoading] = useState(!cachedRates)

  useEffect(() => {
    if (cachedRates && Date.now() - cacheTimestamp < CACHE_TTL) {
      setRates(cachedRates)
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchRates() {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD')
        const data = await res.json()
        if (!cancelled && data.rates) {
          cachedRates = data.rates as ExchangeRates
          cacheTimestamp = Date.now()
          setRates(cachedRates)
        }
      } catch (err) {
        console.error('Exchange rate fetch failed, using fallback rates:', err)
        // 保持 fallback 汇率
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchRates()
    return () => { cancelled = true }
  }, [])

  return { rates, loading }
}
