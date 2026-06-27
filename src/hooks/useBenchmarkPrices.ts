import { useEffect, useState } from 'react'

import { BENCHMARKS, type BenchmarkPrice, type BenchmarkSeries } from '@/lib/types'

// 模块级缓存：symbol → 日线序列（按日期升序）。基准日线基本不变，整页会话内复用，
// 切页面不重复拉取（同 useHistoricalRates 等 hook 的做法）。
const seriesCache = new Map<string, BenchmarkPrice[]>()
let fetchStarted = false

/**
 * 拉取基准指数日线（沪深300 / 标普500），供 lib/benchmark.ts 计算对照 XIRR。
 * 仅在首次挂载时请求一次；结果缓存到模块级 Map。
 */
export function useBenchmarkPrices(enabled: boolean) {
  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(!fetchStarted)

  useEffect(() => {
    if (!enabled || fetchStarted) {
      setLoading(false)
      return
    }
    fetchStarted = true
    setLoading(true)

    const symbols = BENCHMARKS.map((b) => b.symbol).join(',')
    let cancelled = false

    fetch(`/api/benchmark-prices?symbols=${encodeURIComponent(symbols)}`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((series: BenchmarkSeries[]) => {
        for (const s of series) {
          if (Array.isArray(s.prices)) seriesCache.set(s.symbol, s.prices)
        }
        if (!cancelled) setVersion((v) => v + 1)
      })
      .catch((err) => {
        console.error('benchmark prices fetch failed:', err)
        fetchStarted = false // 允许下次重试
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  /** 查询某基准的日线序列（按日期升序），未命中返回空数组 */
  const getSeries = (symbol: string): BenchmarkPrice[] => seriesCache.get(symbol) ?? []

  return { getSeries, loading, version }
}
