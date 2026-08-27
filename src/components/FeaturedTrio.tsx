import Link from 'next/link'

// トップの「今日の注目カード」。AI予想の上昇確率が高い順に3枚を並べる。
//
// ⚠ 2026-08-28 まで、ここは**1枚だけを大きく出すヒーロー**だった。すぐ下の
//   「01: AI予想 これからの注目カード」の1位と必ず同じカードになるため、
//   画面の先頭2ブロックが同じ情報を繰り返していた。3枚に広げて重複を解消している。

export type TrioCard = {
  slug: string
  name: string
  rarity: string
  cardNo: string
  boxId: string
  boxName: string
  image: string | null
  /** 現在相場の代表値。取れていなければ null */
  mid: number | null
  /** 前日比（無ければ7日比）。単位は% */
  changePct: number | null
  changeLabel: string | null
  /** AI予想の上昇確率(%) */
  upPct: number | null
  /** 強気/中立/弱気 */
  stance: string | null
}

export default function FeaturedTrio({ cards }: { cards: TrioCard[] }) {
  if (cards.length === 0) return null

  return (
    <div className="trio">
      {cards.map((c) => {
        const tone = c.changePct == null ? 'flat' : c.changePct > 0 ? 'up' : c.changePct < 0 ? 'down' : 'flat'
        const toneVar = tone === 'up' ? 'var(--up)' : tone === 'down' ? 'var(--down)' : 'var(--flat)'
        return (
          <div key={c.slug} className="trio-card">
            {/* カード全体をクリックできるようにするが、中に収録弾リンクがあるので
                <a> の入れ子を避けて絶対配置のオーバーレイにする（ヒーローで踏んだ hydration 事故と同じ理由） */}
            <Link
              href={`/cards/${c.slug}`}
              aria-label={`${c.name} ${c.rarity} の詳細`}
              style={{ position: 'absolute', inset: 0, zIndex: 1, borderRadius: 'var(--r-lg)' }}
            />
            <div className="trio-head">
              {c.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image} alt={`${c.name} ${c.rarity}`} className="trio-thumb" referrerPolicy="no-referrer" />
              ) : (
                <div className="trio-thumb trio-thumb-ph">{c.rarity}</div>
              )}
              <div style={{ minWidth: 0 }}>
                <div className="trio-name">{c.name}</div>
                <div className="trio-meta">
                  {c.rarity} · {c.cardNo}
                </div>
                <Link
                  href={`/boxes/${c.boxId}`}
                  className="trio-box"
                  // オーバーレイより上に出さないとクリックが吸われる
                  style={{ position: 'relative', zIndex: 2 }}
                >
                  {c.boxName}
                </Link>
              </div>
            </div>

            <div className="trio-price">
              {c.mid != null ? `¥${c.mid.toLocaleString()}` : <span style={{ color: 'var(--ink-faint)' }}>相場取得中</span>}
            </div>

            <div className="trio-foot">
              {c.changePct != null && (
                <span style={{ color: toneVar, fontFamily: 'var(--mono)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
                  {c.changePct > 0 ? '▲' : c.changePct < 0 ? '▼' : '—'} {Math.abs(c.changePct).toFixed(1)}%
                  <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}> {c.changeLabel}</span>
                </span>
              )}
              {c.stance && (
                <span className="trio-stance">
                  AI予想：{c.stance}
                  {c.upPct != null && <span style={{ color: 'var(--ink-faint)' }}> {c.upPct}%</span>}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
