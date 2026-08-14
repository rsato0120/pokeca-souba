'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { STANCE_COLOR } from '@/lib/stance'

// トップページの「みんなの予想 注目カード」＝投票が上昇に寄っているカードのランキング。
//
// 価格・AI予想は SSG（JSON）だが票だけは Supabase にあるので、ここはクライアントで取りに行く。
// ビルド時に焼くと票が入るたびに古くなるため。カードの表示名はサーバー側から渡してもらう
// （票のあるカードがどれかはビルド時に分からないので、id→名前の対応表を丸ごと受け取る）。

type Tally = {
  card_id: string
  total: number
  up_votes: number
  flat_votes: number
  down_votes: number
}

export type PickCard = {
  id: string
  name: string
  rarity: string
  image: string | null
  /** AI予想の上昇確率。みんなの予想との食い違いを出すために使う */
  aiUp: number | null
}

// これ未満の票数は出さない。1票だけのカードは「みんなの予想」と呼べないため。
//
// ⚠ ここを3以上にすると節が事実上出てこない。実測（2026-08-04）で総票数21・1カード最大2票
// なので、しきい値で足切りするより**少数票を不利に扱う並べ方**で対処する（下の smoothedUpRate）。
const MIN_VOTES = 2
const TOP_N = 5
// AIと票の上昇率がこれ以上離れていたら「食い違い」として注記する
const DIVERGENCE_PT = 25

/**
 * 並べ替えに使う上昇率。表示は生の割合だが、順位付けはこちらで行う。
 *
 * 生の割合でソートすると 2票2上昇(100%) が 20票17上昇(85%) を必ず上回り、
 * ランキングが「票が少ないカード」で埋まる。上昇・下落それぞれに1票ぶんの
 * 仮想票を足して（ラプラス平滑化）、票が少ないほど50%へ寄せる。
 *   2/2  → 3/4  = 75%
 *   17/20→ 18/22= 82%  ← 票数が多い方が上に来る
 */
function smoothedUpRate(upVotes: number, total: number): number {
  return (upVotes + 1) / (total + 2)
}

export default function CommunityPicks({ cards }: { cards: PickCard[] }) {
  const sb = getSupabase()
  const [tallies, setTallies] = useState<Tally[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!sb) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void (async () => {
      const { data, error } = await sb
        .from('card_vote_tallies')
        .select('card_id, total, up_votes, flat_votes, down_votes')
        .gte('total', MIN_VOTES)
        .limit(500)
      if (error) { setFailed(true); return }
      setTallies((data ?? []) as Tally[])
    })()
  }, [sb])

  // 環境変数が未設定／読み込み失敗のときは節ごと消す（サイト本体は無傷のまま）
  if (!sb || failed) return null

  const byId = new Map(cards.map(c => [c.id, c]))
  const ranked = (tallies ?? [])
    .map(t => {
      const card = byId.get(t.card_id)
      if (!card) return null   // 掲載終了カードの票は無視する
      const upPct = Math.round((t.up_votes / t.total) * 100)
      return { card, tally: t, upPct, rank: smoothedUpRate(t.up_votes, t.total) }
    })
    .filter((x): x is { card: PickCard; tally: Tally; upPct: number; rank: number } => x !== null)
    // 平滑化した上昇率で並べる。同点なら票数が多い方を上に
    .sort((a, b) => b.rank - a.rank || b.tally.total - a.tally.total)
    .slice(0, TOP_N)

  // 票が集まるまではセクションごと出さない。空欄が並ぶより存在しない方がよい
  if (tallies !== null && ranked.length === 0) return null

  return (
    <div className="sec">
      <div className="sec-head">
        <span className="sec-no" style={{ color: 'var(--gold)' }}>01b</span>
        <span className="sec-title">みんなの予想 注目カード</span>
        <span className="sec-sub">閲覧者の投票が上昇に寄っているカード</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {tallies === null ? (
          <div style={{ padding: 'var(--sp-5) 0', fontSize: 'var(--fs-base)', color: 'var(--ink-faint)' }}>読み込み中…</div>
        ) : (
          ranked.map(({ card, tally, upPct }) => {
            const flatPct = Math.round((tally.flat_votes / tally.total) * 100)
            const downPct = Math.max(0, 100 - upPct - flatPct)
            const diverges = card.aiUp != null && Math.abs(upPct - card.aiUp) >= DIVERGENCE_PT
            return (
              <Link key={card.id} href={`/cards/${card.id}`} className="row" style={{ gridTemplateColumns: 'var(--thumb-w) 1fr auto' }}>
                {card.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.image} alt={card.name} className="row-thumb" referrerPolicy="no-referrer" />
                ) : (
                  <div className="row-thumb row-thumb-ph">{card.rarity}</div>
                )}
                <div>
                  <div className="row-name">{card.name}
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--gold)', marginLeft: 'var(--sp-1)' }}>{card.rarity}</span>
                  </div>
                  <div className="row-meta">
                    <span style={{ color: STANCE_COLOR.up }}>上昇 {upPct}%</span>
                    {' · '}
                    <span style={{ color: STANCE_COLOR.flat }}>横ばい {flatPct}%</span>
                    {' · '}
                    <span style={{ color: STANCE_COLOR.down }}>下落 {downPct}%</span>
                    {' · '}{tally.total}票
                  </div>
                  {card.aiUp != null && (
                    <div className="row-meta" style={{ color: diverges ? 'var(--gold)' : 'var(--ink-faint)' }}>
                      AI予想 上昇確率 {card.aiUp}%
                      {/* 主語を必ず書く。「違って強気」だと直前の「AI予想」に係って読め、
                          AIが強気だと逆に取れる（実際に強気なのは票の側）。語彙も
                          上昇/横ばい/下落に揃える（強気/弱気は3区分へ移行した時の取り残し） */}
                      {diverges && <>　{upPct > card.aiUp ? 'みんなの方が上昇寄り' : 'AIの方が上昇寄り'}</>}
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-base)', textAlign: 'right', minWidth: '56px' }}>
                  <span style={{ color: STANCE_COLOR.up, fontWeight: 700 }}>{upPct}%</span>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)' }}>上昇</div>
                </div>
              </Link>
            )
          })
        )}
      </div>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)', marginTop: 'var(--sp-2)', lineHeight: 1.7 }}>
        {MIN_VOTES}票以上集まったカードを、票数が少ないほど控えめに評価して並べています。カード詳細ページから誰でも投票できます。
      </p>
    </div>
  )
}
