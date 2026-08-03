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

// これ未満の票数は偏りが大きすぎるのでランキングに出さない。
// 1票のカードが100%で最上位に来ると「みんなの予想」に見えない。
const MIN_VOTES = 3
const TOP_N = 5
// AIと票の上昇率がこれ以上離れていたら「食い違い」として注記する
const DIVERGENCE_PT = 25

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
      return { card, tally: t, upPct }
    })
    .filter((x): x is { card: PickCard; tally: Tally; upPct: number } => x !== null)
    // 上昇率が同じなら票数が多い方を上に（1票差の偶然で順位が入れ替わらないように）
    .sort((a, b) => b.upPct - a.upPct || b.tally.total - a.tally.total)
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
              <Link key={card.id} href={`/cards/${card.id}`} className="row" style={{ gridTemplateColumns: '40px 1fr auto' }}>
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
                      {diverges && <>（みんなの予想と{upPct > card.aiUp ? '違って強気' : '違って弱気'}）</>}
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
        {MIN_VOTES}票以上集まったカードだけを並べています。カード詳細ページから誰でも投票できます。
      </p>
    </div>
  )
}
