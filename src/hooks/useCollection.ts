'use client'
import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'pokeca-collection-v1'
export type Collection = Record<string, number>

// PSA10版は素体と別枠でカウントする。キーは `${cardId}#psa10`。
export const PSA_SUFFIX = '#psa10'
export const psaKey = (cardId: string) => `${cardId}${PSA_SUFFIX}`
export const isPsaKey = (key: string) => key.endsWith(PSA_SUFFIX)
export const baseId = (key: string) => (isPsaKey(key) ? key.slice(0, -PSA_SUFFIX.length) : key)

// 未開封BOXもコレクションに入れられる。カードIDと衝突しないよう名前空間を分ける。
// シュリンクあり/なしは相場が別物なので別キーで持つ（同じBOXでも数千円ずれる）。
export const BOX_PREFIX = 'box:'
export const boxKey = (boxId: string, shrink: boolean) =>
  `${BOX_PREFIX}${boxId}${shrink ? '#shrink' : ''}`
export const isBoxKey = (key: string) => key.startsWith(BOX_PREFIX)

// 取得価格（1枚あたりの買値）。所持枚数とはライフサイクルが別（買値だけ消したい・
// 枚数だけ動かしたいがある）なので、同じキー空間で別ストレージに持つ。
const COST_KEY = 'pokeca-cost-v1'
export type CostBasis = Record<string, number>

function read(): Collection {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  catch { return {} }
}

function readCost(): CostBasis {
  try { return JSON.parse(localStorage.getItem(COST_KEY) ?? '{}') }
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

export function useCostBasis() {
  const [cost, setCostState] = useState<CostBasis>({})

  useEffect(() => {
    // useCollection と同じ理由でマウント後にのみ読む
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCostState(readCost())
    const sync = () => setCostState(readCost())
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const setCost = useCallback((id: string, yen: number | null) => {
    setCostState(prev => {
      const next = { ...prev }
      if (yen == null || !Number.isFinite(yen) || yen <= 0) delete next[id]
      else next[id] = Math.round(yen)
      localStorage.setItem(COST_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { cost, setCost }
}
