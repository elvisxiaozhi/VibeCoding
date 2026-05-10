import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Liability, OwnerType } from '@/lib/types'

export type LiabilityDraft = Omit<Liability, 'id' | 'createdAt' | 'updatedAt'>
export type LiabilityPatch = Partial<Omit<Liability, 'id' | 'createdAt' | 'updatedAt'>>

const liabilitiesCache = new Map<string, Liability[]>()

function cacheKey(ownerFilter?: OwnerType): string {
  return ownerFilter ?? 'all'
}

export function useLiabilities(isLoggedIn: boolean, ownerFilter?: OwnerType) {
  const [liabilities, setLiabilities] = useState<Liability[]>(() => {
    if (!isLoggedIn) return []
    return liabilitiesCache.get(cacheKey(ownerFilter)) ?? []
  })
  const [loading, setLoading] = useState(() => {
    if (!isLoggedIn) return false
    return !liabilitiesCache.has(cacheKey(ownerFilter))
  })
  const fetchSeqRef = useRef(0)
  const ownerFilterRef = useRef(ownerFilter)
  ownerFilterRef.current = ownerFilter

  const fetchLiabilities = useCallback(async () => {
    if (!isLoggedIn) {
      setLiabilities([])
      setLoading(false)
      return
    }
    if (ownerFilter !== ownerFilterRef.current) return
    const key = cacheKey(ownerFilter)
    const cached = liabilitiesCache.get(key)
    if (cached) {
      setLiabilities(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    const seq = ++fetchSeqRef.current
    try {
      const params = ownerFilter ? `?owner=${ownerFilter}` : ''
      const res = await fetch(`/api/liabilities${params}`, { credentials: 'include' })
      if (!res.ok) return
      const data = (await res.json()) as unknown
      if (!Array.isArray(data)) return
      if (seq !== fetchSeqRef.current) return
      if (ownerFilter !== ownerFilterRef.current) return
      liabilitiesCache.set(key, data as Liability[])
      setLiabilities(data as Liability[])
    } catch (err) {
      if (seq !== fetchSeqRef.current) return
      console.error('fetchLiabilities failed:', err)
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false)
    }
  }, [isLoggedIn, ownerFilter])

  useEffect(() => {
    fetchLiabilities()
  }, [fetchLiabilities])

  const addLiability = useCallback(
    async (draft: LiabilityDraft) => {
      if (!isLoggedIn) return
      const res = await fetch('/api/liabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(draft),
      })
      if (!res.ok) {
        console.error('addLiability failed:', await res.text())
        return
      }
      liabilitiesCache.clear()
      await fetchLiabilities()
    },
    [isLoggedIn, fetchLiabilities],
  )

  const updateLiability = useCallback(
    async (id: string, patch: LiabilityPatch) => {
      if (!isLoggedIn) return
      const current = liabilities.find((l) => l.id === id)
      if (!current) return
      const merged: LiabilityDraft = {
        name: patch.name ?? current.name,
        category: patch.category ?? current.category,
        principal: patch.principal ?? current.principal,
        currency: patch.currency ?? current.currency,
        interestRate: patch.interestRate ?? current.interestRate,
        dueDate: patch.dueDate ?? current.dueDate,
        owner: patch.owner ?? current.owner,
        note: patch.note ?? current.note,
      }
      const res = await fetch(`/api/liabilities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(merged),
      })
      if (!res.ok) {
        console.error('updateLiability failed:', await res.text())
        return
      }
      liabilitiesCache.clear()
      await fetchLiabilities()
    },
    [isLoggedIn, liabilities, fetchLiabilities],
  )

  const deleteLiability = useCallback(
    async (id: string) => {
      if (!isLoggedIn) return
      const res = await fetch(`/api/liabilities/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) {
        console.error('deleteLiability failed:', await res.text())
        return
      }
      liabilitiesCache.clear()
      await fetchLiabilities()
    },
    [isLoggedIn, fetchLiabilities],
  )

  const totalPrincipal = useMemo(
    () => liabilities.reduce((sum, liability) => sum + liability.principal, 0),
    [liabilities],
  )

  return {
    liabilities,
    loading,
    refetch: fetchLiabilities,
    addLiability,
    updateLiability,
    deleteLiability,
    totalPrincipal,
  }
}
