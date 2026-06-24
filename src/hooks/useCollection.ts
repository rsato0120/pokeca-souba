'use client'
import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'pokeca-collection-v1'
export type Collection = Record<string, number>

// PSA10版は素体と別枠でカウントする。キーは `${cardId}#psa10`。
export const PSA_SUFFIX = '#psa10'
export const psaKey = (cardId: string) => `${cardId}${PSA_SUFFIX}`
export const isPsaKey = (key: string) => key.endsWith(PSA_SUFFIX)
export const baseId = (key: string) => (isPsaKey(key) ? key.slice(0, -PSA_SUFFIX.length) : key)

function read(): Collection {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  catch { return {} }
}

export function useCollection() {
  const [col, setCol] = useState<Collection>({})

  useEffect(() => {
    // localStorageは初回マウント後にのみ読む（SSRのハイドレーション不一致を避ける意図的なパターン）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCol(read())
    const sync = () => setCol(read())
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const setQty = useCallback((id: string, qty: number) => {
    setCol(prev => {
      const next = { ...prev }
      if (qty <= 0) delete next[id]
      else next[id] = qty
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const getQty = useCallback((id: string) => col[id] ?? 0, [col])

  return { col, setQty, getQty }
}
