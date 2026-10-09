'use client'
import CardImage from '@/components/CardImage'

import { marketCardHref } from '@/lib/market-links'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'

// トップの「みんなの注目ランキング」＝直近7日でカード詳細を開かれた人数の多い順。
//
// このサイトの他のランキングは全部「価格」から作られている（値上がり率・出品数・AI予想）。
// これだけは**閲覧者の行動そのもの**が元なので、価格が動く前の注目を拾える。
// 値上がり率ランキングと並べても内容が被らないのはそのため。
//
// 数え方は Supabase の record_card_view()：1カード・1日・1訪問者につき1。
// リロード連打で増えないので、少ない人数でも「何人が見たか」として読める。
// 票（card_votes）と違って生の行はクライアントから読めない（訪問者ハッシュを見せないため）。

export type TrendCard = {
  id: string
  name: string
  rarity: string
  image: string | null
  /** 現在の代表値。無ければ価格欄を出さない */
  price: number | null
  /** 前日比%。注目と値動きがずれている銘柄が一目で分かる */
  dayChange: number | null
}

type Row = {
  card_id: string
  viewers: number
  viewers_today: number
  prev_viewers: number
}

// これ未満は「みんなが見ている」と呼べない。1人＝自分だけ、という行を並べても意味がない。
// （[[pokeca-vote-and-motion]] の MIN_VOTES と同じ理由で3以上には上げない。
//   閲覧はほぼ全訪問者が発生させるので、票よりは早く2に届く）
const MIN_VIEWERS = 2
// 前の同じ期間と比べてこの倍率以上なら「急上昇」。初週は前期間が0なので付かない
const SURGE_RATIO = 2

export default function TrendingCards({ cards, limit = 8, initialDays = 7, showPeriodSelector = false }: { cards: TrendCard[]; limit?: number; initialDays?: 1 | 7; showPeriodSelector?: boolean }) {
  const sb = getSupabase()
  const [days, setDays] = useState(initialDays)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!sb) return
    let active = true
    void (async () => {
      // 掲載終了カードが混ざる可能性があるので、表示したい件数より多めに取って後で間引く
      const { data, error } = await sb.rpc('card_view_ranking', { p_days: days, p_limit: Math.min(100, limit * 3) })
      if (!active) return
      if (error) { setFailed(true); return }
      setRows((data ?? []) as Row[])
    })()
    return () => { active = false }
  }, [sb, limit, days])

  // 環境変数が未設定／読み込み失敗のときは節ごと消す（サイト本体は無傷のまま）
  if (!sb || failed) return null

  const byId = new Map(cards.map(c => [c.id, c]))
  const ranked = (rows ?? [])
    .filter(r => r.viewers >= MIN_VIEWERS)
    .map(r => ({ r, card: byId.get(r.card_id) }))
    .filter((x): x is { r: Row; card: TrendCard } => x.card != null)
    .slice(0, limit)

  // 閲覧が貯まるまではセクションごと出さない（空欄が並ぶより存在しない方がよい）
  if (!showPeriodSelector && rows !== null && ranked.length === 0) return null

  const top = ranked[0]?.r.viewers ?? 1

  return (
    <div className="sec">
      <div className="sec-head">
        <span className="sec-no" style={{ color: 'var(--accent)' }}>01c</span>
        <span className="sec-title">みんなの注目ランキング</span>
        <span className="sec-sub">{days === 1 ? '今日' : '直近7日'}よく見られているカード</span>
      </div>
      {showPeriodSelector && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }} aria-label="閲覧数の集計期間">
          {([1, 7] as const).map(period => (
            <button key={period} type="button" className={`rank-tab${days === period ? ' is-active' : ''}`} aria-pressed={days === period}
              onClick={() => { if (days !== period) { setRows(null); setFailed(false); setDays(period) } }}>
              {period === 1 ? '今日' : '7日'}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows === null ? (
          <div style={{ padding: 'var(--sp-5) 0', fontSize: 'var(--fs-base)', color: 'var(--ink-faint)' }}>読み込み中…</div>
        ) : ranked.length === 0 ? (
          <p>この期間に閲覧数が2以上のカードはまだありません。</p>
        ) : (
          ranked.map(({ r, card }, i) => {
            const surge = r.prev_viewers > 0 && r.viewers >= r.prev_viewers * SURGE_RATIO
            const share = Math.max(0.06, r.viewers / top)   // 1位でも他が細くなりすぎないよう下限を置く
            return (
              <Link prefetch={false}
                key={card.id}
                href={marketCardHref(card.id)}
                className="row"
                style={{ gridTemplateColumns: '22px var(--thumb-w) 1fr auto' }}
              >
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 'var(--fs-base)', fontWeight: 700,
                  color: i < 3 ? 'var(--accent)' : 'var(--ink-faint)', textAlign: 'right',
                }}>
                  {i + 1}
                </span>

                {card.image ? (

                  <CardImage src={card.image} alt={card.name} className="row-thumb" referrerPolicy="no-referrer" />
                ) : (
                  <div className="row-thumb row-thumb-ph">{card.rarity}</div>
                )}

                <div style={{ minWidth: 0 }}>
                  <div className="row-name">
                    {card.name}
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--accent)', marginLeft: 'var(--sp-1)' }}>{card.rarity}</span>
                    {surge && (
                      <span style={{
                        fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', fontWeight: 700,
                        color: 'var(--up)', border: '1px solid var(--up)', borderRadius: 'var(--r-pill)',
                        padding: '0 6px', marginLeft: 'var(--sp-2)', whiteSpace: 'nowrap',
                      }}>
                        急上昇
                      </span>
                    )}
                  </div>

                  {/* 注目度の横棒。人数そのものは小さい数字なので、1位との比で「差」を見せる。
                      幅ではなく scaleX を動かす（幅のアニメは再レイアウトが走る） */}
                  <div style={{ height: '4px', background: 'var(--bg2)', borderRadius: '2px', margin: '5px 0 3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', background: 'var(--accent)', borderRadius: '2px',
                      transform: `scaleX(${share})`, transformOrigin: 'left',
                      transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                    }} />
                  </div>

                  <div className="row-meta">
                    {days === 1 ? '今日' : '7日で'} {r.viewers}人が閲覧
                    {days === 7 && r.viewers_today > 0 && <> · 今日 {r.viewers_today}人</>}
                  </div>
                </div>

                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-base)', textAlign: 'right', minWidth: '64px' }}>
                  {card.price != null ? `¥${Math.round(card.price).toLocaleString()}` : '—'}
                  {card.dayChange != null && (
                    <div style={{
                      fontSize: 'var(--fs-xs)', fontWeight: 700,
                      color: card.dayChange > 0 ? 'var(--up)' : card.dayChange < 0 ? 'var(--down)' : 'var(--flat)',
                    }}>
                      {card.dayChange > 0 ? '+' : ''}{card.dayChange.toFixed(1)}%
                    </div>
                  )}
                </div>
              </Link>
            )
          })
        )}
      </div>

      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)', marginTop: 'var(--sp-3)', lineHeight: 1.7 }}>
        カード詳細を開いた人数です（同じ人が同じ日に何度開いても1と数えます）。閲覧に個人情報は使いません。
      </p>
    </div>
  )
}
