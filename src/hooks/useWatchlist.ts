'use client'
import { useState, useEffect, useCallback } from 'react'

// ウォッチリスト。マイコレクション（useCollection）とは別物で、
// **持っていないカードを追う**ための枠。株のお気に入り銘柄にあたる。
//
// 登録した時点の相場を一緒に残すのがこの機能の肝。「登録してから何%動いたか」が
// 出せると、ただのブックマークではなく自分専用の監視リストになる。

const STORAGE_KEY = 'pokeca-watchlist-v1'

export interface WatchEntry {
  /** 登録日（JST, YYYY-MM-DD） */
  at: string
  /** 登録時点の相場。取得できていなければ 0 */
  price: number
}

export type Watchlist = Record<string, WatchEntry>

function read(): Watchlist {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (raw == null || typeof raw !== 'object') return {}
    // 旧形式（値が number や true）が混ざっても落ちないように正規化する
    const out: Watchlist = {}
    for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v && typeof v === 'object' && 'at' in v) {
        const e = v as { at?: unknown; price?: unknown }
        out[id] = { at: String(e.at ?? ''), price: Number(e.price) || 0 }
      } else {
        out[id] = { at: '', price: 0 }
      }
    }
    return out
  } catch {
    return {}
  }
}

function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function useWatchlist() {
  const [list, setList] = useState<Watchlist>({})
  // localStorage を読むまでは「登録済みかどうか」が分からない。
  // 未読込のうちに星を空表示すると、登録済みのカードで一瞬だけ星が消える。
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // localStorageは初回マウント後にのみ読む（useCollection と同じ、SSRとの不一致を避ける意図的なパターン）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setList(read())
    setLoaded(true)
    const sync = () => setList(read())
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const write = useCallback((next: Watchlist) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    // 同じタブの他のコンポーネント（詳細ページの星とヘッダの件数など）にも伝える。
    // storage イベントは他タブにしか飛ばないので自前で投げる
    window.dispatchEvent(new Event('pokeca-watchlist-change'))
    setList(next)
  }, [])

  useEffect(() => {
    const sync = () => setList(read())
    window.addEventListener('pokeca-watchlist-change', sync)
    return () => window.removeEventListener('pokeca-watchlist-change', sync)
  }, [])

  const isWatched = useCallback((id: string) => list[id] != null, [list])

  // ⚠ 次の状態は setList のupdater**の外**で作ること。
  //   useCollection の setQty は「絶対値を入れる」ので updater 内で保存しても平気だが、
  //   toggle は反転なので、StrictMode が updater を2回呼ぶ開発時に
  //   追加→削除と往復して「☆を押しても何も起きない」ように見える。
  //   localStorage を真実の置き場にして、そこから次を組み立てる（stale closure も避けられる）。
  const toggle = useCallback((id: string, price = 0) => {
    const next = { ...read() }
    if (next[id]) delete next[id]
    else next[id] = { at: todayJST(), price: Math.round(price) || 0 }
    write(next)
  }, [write])

  const remove = useCallback((id: string) => {
    const next = { ...read() }
    delete next[id]
    write(next)
  }, [write])

  return { list, loaded, isWatched, toggle, remove, count: Object.keys(list).length }
}
