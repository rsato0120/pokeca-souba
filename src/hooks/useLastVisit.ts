'use client'
import { useEffect, useState } from 'react'

// 「前回このサイトを見たときから、いくら動いたか」を出すための記録。
//
// 相場そのものは誰が見ても同じなので、再訪の動機になるのは**その人だけの数字**しかない。
// そこで訪問日と、その時点の全カードの代表値をこの端末に焼いておく。
// サーバもアカウントも要らない（コレクションと同じ考え方）。
//
// ⚠ 1日に何度開いても同じバナーが出るように、スナップショットの更新は**日が変わった時だけ**。
//   毎回上書きすると2回目の訪問で「前回＝5分前」になりバナーが即座に無意味になる。
//   そのため「今回ぶん(date/prices)」と「前回ぶん(prevDate/prevPrices)」の2世代を持つ。

const KEY = 'pokeca-visit-v1'

export type VisitStore = {
  date: string
  prices: Record<string, number>
  prevDate?: string
  prevPrices?: Record<string, number>
}

export type LastVisit = {
  date: string
  prices: Record<string, number>
}

export function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function read(): VisitStore | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as VisitStore
    return v && typeof v.date === 'string' && v.prices ? v : null
  } catch {
    return null
  }
}

// 「前回の訪問」がどの世代かは、今日ぶんの記録を既に書いたかどうかで決まる。
// トップページを開いた後にカードページへ回っても同じ答えになるよう、選び方を1か所に集める。
function pickPrev(store: VisitStore | null, today: string): LastVisit | null {
  if (!store) return null
  if (store.date === today) {
    return store.prevDate && store.prevPrices ? { date: store.prevDate, prices: store.prevPrices } : null
  }
  return { date: store.date, prices: store.prices }
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
}

// トップページ用: 前回の記録を返しつつ、今日ぶんのスナップショットを書く。
export function useLastVisit(current: Record<string, number>): { prev: LastVisit | null; ready: boolean } {
  const [state, setState] = useState<{ prev: LastVisit | null; ready: boolean }>({ prev: null, ready: false })

  useEffect(() => {
    const today = todayJST()
    const store = read()
    const prev = pickPrev(store, today)

    if (!store || store.date !== today) {
      const next: VisitStore = store
        ? { date: today, prices: current, prevDate: store.date, prevPrices: store.prices }
        : { date: today, prices: current }
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* 容量超過は無視（表示は落とさない） */ }
    }

    // localStorageはマウント後にしか読めない（意図的なハイドレーション回避パターン）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ prev, ready: true })
    // current は毎レンダー新しい参照になるが、書き込みは初回マウントの1回でよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return state
}

// カード詳細用: 読むだけ（スナップショットの更新はトップページに任せる）。
export function useVisitPrice(cardId: string): { price: number; date: string } | null {
  const [v, setV] = useState<{ price: number; date: string } | null>(null)

  useEffect(() => {
    const prev = pickPrev(read(), todayJST())
    const price = prev?.prices[cardId]
    if (prev && typeof price === 'number' && price > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setV({ price, date: prev.date })
    }
  }, [cardId])

  return v
}
