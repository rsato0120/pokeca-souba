'use client'
import Link from 'next/link'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
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
  history: { date: string; mid: number }[]  // 昇順・直近30日
}

// Y軸ラベル: 10万未満はフル円、10万以上は万表記
function yen(v: number): string {
  if (v >= 100000) return `¥${(v / 10000).toFixed(1).replace(/\.0$/, '')}万`
  return `¥${Math.round(v).toLocaleString()}`
}

export default function PortfolioView({ cards }: { cards: PortfolioCardData[] }) {
  const { col, setQty, getQty } = useCollection()

  const owned = cards.filter(c => (col[c.id] ?? 0) > 0)
  const totalQty = owned.reduce((s, c) => s + (col[c.id] ?? 0), 0)

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

  // ── ポートフォリオ評価額の時系列（所持枚数 × その日の相場の合計） ──
  const valueSeries = (() => {
    const ownedH = owned.map(c => ({ qty: col[c.id] ?? 0, hist: c.history }))
    const dateSet = new Set<string>()
    ownedH.forEach(o => o.hist.forEach(h => dateSet.add(h.date)))
    const dates = [...dateSet].sort().slice(-30) // 昇順・直近30日
    // hist は昇順。date 以前の直近の既知価格を採用（キャリーフォワード）。
    // データ開始前は最古の既知価格でバックフィルし、データ被覆の差で評価額が
    // 段差にならないようにする（実際の値動きだけが反映される）。
    const priceAsOf = (hist: { date: string; mid: number }[], date: string): number | null => {
      if (hist.length === 0) return null
      let v = hist[0].mid
      for (const h of hist) { if (h.date <= date) v = h.mid; else break }
      return v
    }
    return dates.map(date => {
      let total = 0
      ownedH.forEach(o => { const p = priceAsOf(o.hist, date); if (p != null) total += p * o.qty })
      return { date, label: date.slice(5).replace('-', '/'), value: Math.round(total) }
    })
  })()

  const firstVal = valueSeries.length > 0 ? valueSeries[0].value : 0
  const periodChangePct = firstVal > 0 ? Math.round(((currentTotal - firstVal) / firstVal) * 100) : 0
  const periodColor = periodChangePct > 0 ? 'var(--up)' : periodChangePct < 0 ? 'var(--down)' : 'var(--ink-dim)'

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

      {/* 評価額グラフ（投資アプリ風） */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--hair)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <p style={{ fontSize: '11px', color: 'var(--ink-faint)', fontFamily: 'var(--mono)', letterSpacing: '0.05em', marginBottom: '6px' }}>
          ポートフォリオ評価額
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <span style={{ fontSize: '30px', fontWeight: 700, fontFamily: 'var(--mono)', lineHeight: 1 }}>
            ¥{currentTotal.toLocaleString()}
          </span>
          {valueSeries.length >= 2 && (
            <span style={{ fontSize: '13px', fontFamily: 'var(--mono)', color: periodColor }}>
              {periodChangePct >= 0 ? '+' : ''}{periodChangePct}%
              <span style={{ color: 'var(--ink-faint)', marginLeft: '4px' }}>（直近{valueSeries.length}日）</span>
            </span>
          )}
        </div>
        {valueSeries.length >= 2 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={valueSeries} margin={{ top: 6, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="var(--hair)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--ink-faint)', fontSize: 11, fontFamily: 'var(--mono)' }} stroke="var(--hair)" minTickGap={24} />
              <YAxis domain={['auto', 'auto']} tickFormatter={yen} tick={{ fill: 'var(--ink-faint)', fontSize: 11, fontFamily: 'var(--mono)' }} stroke="var(--hair)" width={60} />
              <Tooltip
                contentStyle={{ background: 'var(--panel)', border: '1px solid var(--hair)', borderRadius: '8px', fontFamily: 'var(--mono)', fontSize: '12px' }}
                labelStyle={{ color: 'var(--ink-faint)' }}
                formatter={(v) => [`¥${Number(v).toLocaleString()}`, '評価額'] as [string, string]}
              />
              <Line type="monotone" dataKey="value" stroke="var(--gold)" strokeWidth={2.5} dot={{ r: 2, fill: 'var(--gold)', strokeWidth: 0 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ fontSize: '12px', color: 'var(--ink-faint)', padding: '24px 0', textAlign: 'center' }}>
            価格データが2日分以上たまるとグラフが表示されます
          </p>
        )}
      </div>

      {/* AI予想サマリー */}
      {hasForecast && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--hair)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <p style={{ fontSize: '11px', color: 'var(--ink-faint)', fontFamily: 'var(--mono)', letterSpacing: '0.05em', marginBottom: '6px' }}>
            AI予想 3ヶ月後{isPartial ? '*' : ''}
          </p>
          <p style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--mono)', color: diffHighPct > 0 ? 'var(--up)' : diffLowPct < 0 ? 'var(--down)' : 'inherit' }}>
            ¥{m3LowTotal.toLocaleString()}〜¥{m3HighTotal.toLocaleString()}
          </p>
          <p style={{ fontSize: '12px', fontFamily: 'var(--mono)', color: 'var(--ink-faint)', marginTop: '2px' }}>
            現在比 {diffLowPct >= 0 ? '+' : ''}{diffLowPct}%〜{diffHighPct >= 0 ? '+' : ''}{diffHighPct}%
          </p>
          {isPartial && (
            <p style={{ fontSize: '11px', color: 'var(--ink-faint)', marginTop: '12px' }}>
              * AI予想がないカードは集計から除外しています
            </p>
          )}
        </div>
      )}

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
