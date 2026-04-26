import { useEffect, useState } from 'react'

import type { Asset } from '@/lib/types'

interface FXRateResult {
  currency: string
  date: string
  rate: number
  fallback?: boolean
}

// 模块级缓存：(currency:date) → rate（1 unit currency = N CNY）
// 历史数据不变，永久缓存；今日 key 在页面会话内复用，刷新页面后重新拉
const rateCache = new Map<string, number>()

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function dateKey(d: string): string {
  // purchasedAt 格式可能是 "YYYY-MM-DD" 或带时间戳，统一截前 10 位
  return d.slice(0, 10)
}

/**
 * 收集 assets 中所有 (currency, purchasedAt) 对 + 今日，
 * 调一次 /api/fx-rates 拉历史汇率，结果缓存到 rateCache。
 *
 * 返回的 Map 用 `${CURRENCY}:${YYYY-MM-DD}` 作为 key，
 * value 是「1 单位 currency 对应多少 CNY」。CNY 不进 Map（调用方自行返回 1）。
 */
export function useHistoricalRates(assets: Asset[]) {
  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (assets.length === 0) {
      setLoading(false)
      return
    }

    const today = todayKey()
    const need = new Set<string>()
    for (const a of assets) {
      if (!a.currency || a.currency === 'CNY') continue
      need.add(`${a.currency}:${dateKey(a.purchasedAt)}`)
      need.add(`${a.currency}:${today}`)
    }

    const missing = [...need].filter((k) => !rateCache.has(k))
    if (missing.length === 0) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`/api/fx-rates?pairs=${encodeURIComponent(missing.join(','))}`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((results: FXRateResult[]) => {
        for (const r of results) {
          if (r.rate > 0) {
            rateCache.set(`${r.currency}:${r.date}`, r.rate)
          }
        }
        if (!cancelled) setVersion((v) => v + 1)
      })
      .catch((err) => console.error('fx rates fetch failed:', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [assets])

  /** 查询 (currency, date) 对应的 CNY 汇率，未命中返回 0 */
  const getRate = (currency: string, date: Date): number => {
    if (currency === 'CNY') return 1
    const key = `${currency}:${date.toISOString().slice(0, 10)}`
    if (rateCache.has(key)) return rateCache.get(key)!
    // 历史日期未命中（如 fetch 仍在 loading），尝试退到今日
    return rateCache.get(`${currency}:${todayKey()}`) ?? 0
  }

  return { getRate, loading, version }
}
