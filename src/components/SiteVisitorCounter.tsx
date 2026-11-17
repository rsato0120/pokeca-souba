'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { todayJST } from '@/hooks/useLastVisit'

type Counts = { today: number; total: number; started_on: string; day: string }
let countedDay = ''
let pending: Promise<Counts> | null = null

function loadCounts(): Promise<Counts> {
  if (pending) return pending
  pending = (async () => {
    const sb = getSupabase()
    if (!sb) throw new Error('Not configured')
    const { data, error } = await sb.rpc('record_site_visit', { p_count: countedDay !== todayJST() })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row || !Number.isSafeInteger(row.today) || !Number.isSafeInteger(row.total)
      || row.today < 0 || row.total < row.today || !/^\d{4}-\d{2}-\d{2}$/.test(row.started_on)
      || !/^\d{4}-\d{2}-\d{2}$/.test(row.day)) throw new Error('Invalid counters')
    countedDay = row.day
    return row as Counts
  })().finally(() => { pending = null })
  return pending
}

export default function SiteVisitorCounter() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return
      try {
        const next = await loadCounts()
        if (active) { setCounts(next); setFailed(false) }
      } catch { if (active) { setFailed(true); setCounts(null) } }
    }
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])

  return <aside className="site-visitors" aria-label="サイト来訪者数">
    <div className="site-visitors-counts">
      <span>今日の来訪者 <strong>{counts ? counts.today.toLocaleString('ja-JP') : '—'}</strong> 人</span>
      <span>累計来訪者 <strong>{counts ? counts.total.toLocaleString('ja-JP') : '—'}</strong> 人</span>
    </div>
    <small>{counts ? `${counts.started_on.replaceAll('-', '/')}から集計・累計は日別人数の延べ合計（日本時間）` : failed ? '来訪者数を取得できませんでした' : '来訪者数を読み込み中…'}</small>
  </aside>
}
