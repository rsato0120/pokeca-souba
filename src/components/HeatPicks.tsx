import Link from 'next/link'

// サイトの看板セクション「AIが見つけた、まだ上がっていないカード。」
//
// 中身は既存の buy-signals.ts（AIが買うべきカード）をそのまま使う。選定ロジックは変えず、
// 0〜100 の「AI高騰気配」と兆候(✓)・注意(⚠) を足して見せ方だけ変えている。
//
// ⚠ 兆候に「海外需要上昇」「検索量増加」は出さない。どちらもこのサイトにデータ源が無い
//   （海外相場・検索ボリュームとも一切取得していない）。取得経路を足した時に
//   buy-signals.ts の omens へ1行足せば、ここは自動で表示に載る。

export interface HeatPick {
  slug: string
  name: string
  rarity: string
  cardNo: string
  image: string | null
  mid: number
  dayPct: number | null
  heat: number
  /** 買い候補全体で上位何% か（数字の意味を画面に添えるのに使う） */
  heatPercentile: number
  /** 買い候補の総数 */
  heatPool: number
  upPct: number | null
  m3Low: number | null
  m3High: number | null
  omens: string[]
  cautions: string[]
  /** AIが書いた短い理由。無ければ factors のフォールバックを出す */
  thesis: string | null
}

export default function HeatPicks({ picks }: { picks: HeatPick[] }) {
  if (picks.length === 0) return null

  return (
    <div className="heat-grid">
      {picks.map((p, i) => {
        const tone = p.dayPct == null ? 'var(--ink-faint)' : p.dayPct > 0 ? 'var(--up)' : p.dayPct < 0 ? 'var(--down)' : 'var(--ink-dim)'
        return (
          <article key={p.slug} className="heat-card">
            <Link
              href={`/cards/${p.slug}`}
              aria-label={`${p.name} ${p.rarity} の詳細`}
              style={{ position: 'absolute', inset: 0, zIndex: 1, borderRadius: 'var(--r-lg)' }}
            />
            <div className="heat-rank">{i + 1}</div>

            <div className="heat-head">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt={`${p.name} ${p.rarity}`} className="heat-thumb" referrerPolicy="no-referrer" />
              ) : (
                <div className="heat-thumb heat-thumb-ph">{p.rarity}</div>
              )}
              <div style={{ minWidth: 0 }}>
                <div className="heat-name">{p.name}</div>
                <div className="heat-meta">{p.rarity} · {p.cardNo}</div>
              </div>
            </div>

            <div className="heat-price-row">
              <div>
                <div className="pulse-label">現在価格</div>
                <div className="heat-price">¥{p.mid.toLocaleString()}</div>
              </div>
              {p.dayPct != null && (
                <div style={{ textAlign: 'right' }}>
                  <div className="pulse-label">前日比</div>
                  <div style={{ color: tone, fontFamily: 'var(--mono)', fontWeight: 700 }}>
                    {p.dayPct > 0 ? '+' : ''}{p.dayPct.toFixed(1)}%
                  </div>
                </div>
              )}
            </div>

            {/* AI高騰気配。順位そのものなので、数字とゲージを併記する */}
            <div className="heat-score-row">
              <span className="pulse-label">AI高騰気配</span>
              <span className="heat-score">{p.heat}<span className="heat-score-max"> / 100</span></span>
            </div>
            <div className="heat-gauge" role="img" aria-label={`AI高騰気配 ${p.heat} / 100`}>
              <div className="heat-gauge-fill" style={{ width: `${p.heat}%` }} />
            </div>
            {/* 数字だけでは 66 が良いのか悪いのか分からないので、順位を言葉で添える */}
            <div className="heat-rank-note">
              買い候補{p.heatPool}枚中 上位{Math.max(1, 100 - p.heatPercentile)}%
            </div>

            <div className="heat-forecast">
              {p.upPct != null && (
                <div>
                  <div className="pulse-label">上昇確率</div>
                  <div className="heat-fc-val" style={{ color: 'var(--accent)' }}>{p.upPct}%</div>
                </div>
              )}
              {p.m3Low != null && p.m3High != null && (
                <div style={{ textAlign: 'right' }}>
                  <div className="pulse-label">3ヶ月予想</div>
                  <div className="heat-fc-val">¥{p.m3Low.toLocaleString()}〜¥{p.m3High.toLocaleString()}</div>
                </div>
              )}
            </div>

            {p.omens.length > 0 && (
              <ul className="heat-omens">
                {p.omens.slice(0, 4).map(o => (
                  <li key={o}><span className="heat-check" aria-hidden>✓</span>{o}</li>
                ))}
              </ul>
            )}

            {p.cautions.length > 0 && (
              <ul className="heat-cautions">
                {p.cautions.slice(0, 2).map(c => (
                  <li key={c}><span aria-hidden>⚠</span> {c}</li>
                ))}
              </ul>
            )}

            {p.thesis && <p className="heat-thesis">{p.thesis}</p>}
          </article>
        )
      })}
    </div>
  )
}
