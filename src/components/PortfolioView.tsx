'use client'
import Link from 'next/link'
import { useCollection } from '@/hooks/useCollection'

export type PortfolioCardData = {
  id: string
  card_name: string
  rarity: string
  card_no: string
  box_name: string
  image_url: string | null
  currentLow: number
  currentHigh: number
  currentMid: number
  m3Low: number | null
  m3High: number | null
}

export default function PortfolioView({ cards }: { cards: PortfolioCardData[] }) {
  const { col, setQty, getQty } = useCollection()

  const owned = cards.filter(c => (col[c.id] ?? 0) > 0)
  const totalQty = Object.values(col).reduce((s, n) => s + n, 0)

  const currentTotal = owned.reduce((s, c) => s + c.currentMid * (col[c.id] ?? 0), 0)
  const forecastCards = owned.filter(c => c.m3Low != null && c.m3High != null)
  const m3LowTotal = forecastCards.reduce((s, c) => s + (c.m3Low ?? 0) * (col[c.id] ?? 0), 0)
  const m3HighTotal = forecastCards.reduce((s, c) => s + (c.m3High ?? 0) * (col[c.id] ?? 0), 0)
  const hasForecast = forecastCards.length > 0
  const isPartial = forecastCards.length < owned.length

  const diffLow = m3LowTotal - currentTotal
  const diffHigh = m3HighTotal - currentTotal
  const diffLowPct = currentTotal > 0 ? Math.round((diffLow / currentTotal) * 100) : 0
  const diffHighPct = currentTotal > 0 ? Math.round((diffHigh / currentTotal) * 100) : 0

  if (totalQty === 0) {
    return (
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px' }}>
        <Link href="/" style={{ fontSize: '13px', color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '24px' }}>
          ← トップ
        </Link>
        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>マイコレクション</h1>
        <p style={{ color: 'var(--ink-faint)', fontSize: '14px', marginBottom: '40px' }}>
          各弾のカード一覧ページで「所持枚数」を設定するとここに表示されます
        </p>
        <div style={{ border: '1px dashed var(--hair)', borderRadius: '12px', padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: 'var(--ink-faint)', marginBottom: '16px' }}>まだカードが登録されていません</p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/boxes/abyss_eye" style={{ padding: '8px 16px', border: '1px solid var(--hair)', borderRadius: '8px', fontSize: '13px', color: 'var(--ink-dim)' }}>
              アビスアイ →
            </Link>
            <Link href="/boxes/ninja_spinner" style={{ padding: '8px 16px', border: '1px solid var(--hair)', borderRadius: '8px', fontSize: '13px', color: 'var(--ink-dim)' }}>
              ニンジャスピナー →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px' }}>
      <Link href="/" style={{ fontSize: '13px', color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '24px' }}>
        ← トップ
      </Link>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700 }}>マイコレクション</h1>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-faint)' }}>
          {owned.length}種 / {totalQty}枚
        </span>
      </div>

      {/* 合計サマリー */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--hair)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--ink-faint)', fontFamily: 'var(--mono)', letterSpacing: '0.05em', marginBottom: '6px' }}>現在の合計相場</p>
            <p style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--mono)' }}>
              ¥{currentTotal.toLocaleString()}
            </p>
          </div>
          {hasForecast && (
            <div>
              <p style={{ fontSize: '11px', color: 'var(--ink-faint)', fontFamily: 'var(--mono)', letterSpacing: '0.05em', marginBottom: '6px' }}>
                AI予想 3ヶ月後{isPartial ? '*' : ''}
              </p>
              <p style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--mono)', color: diffHighPct > 0 ? 'var(--up)' : diffLowPct < 0 ? 'var(--down)' : 'inherit' }}>
                ¥{m3LowTotal.toLocaleString()}〜¥{m3HighTotal.toLocaleString()}
              </p>
              <p style={{ fontSize: '12px', fontFamily: 'var(--mono)', color: 'var(--ink-faint)', marginTop: '2px' }}>
                {diffLowPct >= 0 ? '+' : ''}{diffLowPct}%〜{diffHighPct >= 0 ? '+' : ''}{diffHighPct}%
              </p>
            </div>
          )}
        </div>
        {isPartial && (
          <p style={{ fontSize: '11px', color: 'var(--ink-faint)', marginTop: '12px' }}>
            * AI予想がないカードは集計から除外しています
          </p>
        )}
      </div>

      {/* カードリスト */}
      <div style={{ border: '1px solid var(--hair)', borderRadius: '8px', overflow: 'hidden' }}>
        {owned
          .sort((a, b) => (b.currentMid * (col[b.id] ?? 0)) - (a.currentMid * (col[a.id] ?? 0)))
          .map(card => {
            const qty = getQty(card.id)
            const subtotalCurrent = card.currentMid * qty
            const subtotalM3Low = card.m3Low != null ? card.m3Low * qty : null
            const subtotalM3High = card.m3High != null ? card.m3High * qty : null
            const pctLow = card.m3Low != null && card.currentMid > 0 ? Math.round(((card.m3Low - card.currentMid) / card.currentMid) * 100) : null
            const pctHigh = card.m3High != null && card.currentMid > 0 ? Math.round(((card.m3High - card.currentMid) / card.currentMid) * 100) : null

            return (
              <div key={card.id} style={{ borderBottom: '1px solid var(--hair)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  {/* カード画像 */}
                  <Link href={`/cards/${card.id}`} style={{ flexShrink: 0 }}>
                    {card.image_url ? (
                      <img
                        src={card.image_url}
                        alt={card.card_name}
                        referrerPolicy="no-referrer"
                        style={{ width: '36px', height: '50px', objectFit: 'cover', borderRadius: '4px', display: 'block' }}
                      />
                    ) : (
                      <div style={{ width: '36px', height: '50px', borderRadius: '4px', background: 'var(--bg2)', border: '1px solid var(--hair)' }} />
                    )}
                  </Link>
                  {/* カード情報 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <Link href={`/cards/${card.id}`} style={{ fontWeight: 700, fontSize: '14px', color: 'inherit' }}>
                        {card.card_name}
                      </Link>
                      <span className="rare-badge">{card.rarity}</span>
                      <span style={{ fontSize: '11px', color: 'var(--ink-faint)' }}>{card.box_name}</span>
                    </div>
                    {/* 価格行 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--ink-dim)' }}>
                        ¥{card.currentMid.toLocaleString()}
                      </span>
                      {subtotalM3Low != null && subtotalM3High != null && (
                        <>
                          <span style={{ color: 'var(--hair)', fontSize: '12px' }}>→</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: pctHigh != null && pctHigh > 0 ? 'var(--up)' : pctLow != null && pctLow < 0 ? 'var(--down)' : 'var(--ink-dim)' }}>
                            ¥{(card.m3Low ?? 0).toLocaleString()}〜¥{(card.m3High ?? 0).toLocaleString()}
                          </span>
                          {pctHigh != null && (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: pctHigh > 0 ? 'var(--up)' : pctLow != null && pctLow < 0 ? 'var(--down)' : 'var(--ink-faint)' }}>
                              {pctHigh > 0 ? '+' : ''}{pctHigh}%
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {/* 複数枚の場合は小計 */}
                    {qty > 1 && (
                      <div style={{ marginTop: '4px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)' }}>
                        ×{qty}枚 = 計¥{subtotalCurrent.toLocaleString()}
                        {subtotalM3Low != null && subtotalM3High != null && (
                          <> → ¥{subtotalM3Low.toLocaleString()}〜¥{subtotalM3High.toLocaleString()}</>
                        )}
                      </div>
                    )}
                  </div>
                  {/* 枚数コントロール */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <button
                      onClick={() => setQty(card.id, qty - 1)}
                      style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        border: '1px solid var(--hair)', background: 'transparent',
                        color: 'var(--ink-dim)', fontSize: '16px', lineHeight: 1,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >−</button>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 700, minWidth: '20px', textAlign: 'center', color: 'var(--gold)' }}>
                      {qty}
                    </span>
                    <button
                      onClick={() => setQty(card.id, qty + 1)}
                      style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        border: '1px solid var(--hair)', background: 'transparent',
                        color: 'var(--ink-dim)', fontSize: '16px', lineHeight: 1,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >＋</button>
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
