'use client'
import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'pokeca-collection-v1'
export type Collection = Record<string, number>

function read(): Collection {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  catch { return {} }
}

export function useCollection() {
  const [col, setCol] = useState<Collection>({})

  useEffect(() => {
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
