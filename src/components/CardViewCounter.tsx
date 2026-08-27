'use client'
import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { todayJST } from '@/hooks/useLastVisit'

// カード詳細の「注目度」バッジ。トップの みんなの注目ランキング の数字を作っているのはここ。
//
// ・開いたことを1件記録する（1カード・1日・1訪問者につき1）
// ・そのカードの直近7日の閲覧者数と順位を、同じ往復で受け取って表示する
//
// ⚠ 同じ端末が同じ日に開き直したときは p_count=false で「読むだけ」にする。
//   サーバー側でも重複は弾かれるが、無駄な書き込みを毎回投げないための一次ふるい。
//   （サーバーの重複排除はIPのハッシュなので、共有回線の別人まで1人にまとめてしまう。
//     端末側でも数えたかどうかを持っておくと、開き直しと別人の区別が端末単位で付く）

const KEY = 'pokeca-viewed-v1'

// 1人＝自分だけ、の状態で「1人が閲覧」と出しても意味がないので出さない
const MIN_VIEWERS = 2
// 順位は母数がある程度ないと「1枚中1位」のような無意味な表示になる
const MIN_RANKED = 5

type Stat = { viewers_7d: number; viewers_today: number; view_rank: number | null; ranked_cards: number }
type Store = { date: string; ids: string[] }

// 「今日このカードを既に数えたか」だけを持つ。日が変われば丸ごと捨てるので溜まり続けない
function read(today: string): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const v = JSON.parse(raw) as Store
      if (v && v.date === today && Array.isArray(v.ids)) return v
    }
  } catch {
    /* 壊れていたら作り直す */
  }
  return { date: today, ids: [] }
}

export default function CardViewCounter({ cardId }: { cardId: string }) {
  const sb = getSupabase()
  const [stat, setStat] = useState<Stat | null>(null)

  useEffect(() => {
    if (!sb) return
    const today = todayJST()
    const store = read(today)
    const counted = store.ids.includes(cardId)
    if (!counted) {
      store.ids.push(cardId)
      try { localStorage.setItem(KEY, JSON.stringify(store)) } catch { /* 保存できなくても表示は続ける */ }
    }
    void (async () => {
      const { data, error } = await sb.rpc('record_card_view', { p_card_id: cardId, p_count: !counted })
      if (error) return   // 記録も表示も落ちるだけ。ページ本体には影響させない
      const row = (Array.isArray(data) ? data[0] : data) as Stat | undefined
      if (row) setStat(row)
    })()
  }, [sb, cardId])

  if (!sb || !stat || stat.viewers_7d < MIN_VIEWERS) return null

  const showRank = stat.view_rank != null && stat.ranked_cards >= MIN_RANKED

  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'baseline', gap: 'var(--sp-2)', flexWrap: 'wrap',
        fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)',
        border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--hair))',
        background: 'color-mix(in srgb, var(--accent) 7%, var(--panel))',
        borderRadius: 'var(--r-pill)', padding: '4px 12px', marginBottom: 'var(--sp-3)',
      }}
    >
      <span style={{ color: 'var(--ink-faint)' }}>直近7日の閲覧</span>
      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{stat.viewers_7d}人</span>
      {stat.viewers_today > 0 && (
        <span style={{ color: 'var(--ink-faint)' }}>（今日 {stat.viewers_today}人）</span>
      )}
      {showRank && (
        <span style={{ color: 'var(--ink-dim)' }}>
          注目度 {stat.ranked_cards}枚中 <strong style={{ color: 'var(--accent)' }}>{stat.view_rank}位</strong>
        </span>
      )}
    </div>
  )
}
