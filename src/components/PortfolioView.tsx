'use client'
import Link from 'next/link'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { useCollection, psaKey } from '@/hooks/useCollection'

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
  psa10Current: number | null
  psa10History: { date: string; mid: number }[]
}

type Holding = {
  key: string
  card: PortfolioCardData
  variant: 'raw' | 'psa10'
  qty: number
  unitPrice: number
  history: { date: string; mid: number }[]
  m3Low: number | null
  m3High: number | null
}

// Y軸ラベル: 10万未満はフル円、10万以上は万表記
function yen(v: number): string {
  if (v >= 100000) return `¥${(v / 10000).toFixed(1).replace(/\.0$/, '')}万`
  return `¥${Math.round(v).toLocaleString()}`
}

export default function PortfolioView({ cards, boxes = [] }: { cards: PortfolioCardData[]; boxes?: { box_id: string; box_name: string }[] }) {
  const { col, setQty } = useCollection()

  // 所持している保有（素体 / PSA10）を列挙
  const holdings: Holding[] = []
  for (const c of cards) {
    const rawQ = col[c.id] ?? 0
    if (rawQ > 0 && c.currentMid > 0) {
      holdings.push({ key: c.id, card: c, variant: 'raw', qty: rawQ, unitPrice: c.currentMid, history: c.history, m3Low: c.m3Low, m3High: c.m3High })
    }
    const pq = col[psaKey(c.id)] ?? 0
    if (pq > 0 && c.psa10Current != null) {
      // PSA10予想は素体の3ヶ月後変化率を流用して近似
      const rLow = c.m3Low != null && c.currentMid > 0 ? c.m3Low / c.currentMid : null
      const rHigh = c.m3High != null && c.currentMid > 0 ? c.m3High / c.currentMid : null
      holdings.push({
        key: psaKey(c.id), card: c, variant: 'psa10', qty: pq, unitPrice: c.psa10Current,
        history: c.psa10History,
        m3Low: rLow != null ? Math.round(c.psa10Current * rLow) : null,
        m3High: rHigh != null ? Math.round(c.psa10Current * rHigh) : null,
      })
    }
  }

  const totalQty = holdings.reduce((s, h) => s + h.qty, 0)
  const currentTotal = holdings.reduce((s, h) => s + h.unitPrice * h.qty, 0)
  const forecastHoldings = holdings.filter(h => h.m3Low != null && h.m3High != null)
  const m3LowTotal = forecastHoldings.reduce((s, h) => s + (h.m3Low ?? 0) * h.qty, 0)
  const m3HighTotal = forecastHoldings.reduce((s, h) => s + (h.m3High ?? 0) * h.qty, 0)
  const hasForecast = forecastHoldings.length > 0
  const isPartial = forecastHoldings.length < holdings.length

  const diffLowPct = currentTotal > 0 ? Math.round(((m3LowTotal - currentTotal) / currentTotal) * 100) : 0
  const diffHighPct = currentTotal > 0 ? Math.round(((m3HighTotal - currentTotal) / currentTotal) * 100) : 0

  // ── 評価額の時系列（保有 × その日の相場の合計） ──
  const valueSeries = (() => {
    const dateSet = new Set<string>()
    holdings.forEach(h => h.history.forEach(p => dateSet.add(p.date)))
    const dates = [...dateSet].sort().slice(-30)
    // データ開始前は最古の既知価格でバックフィルし、被覆差による段差を防ぐ
    const priceAsOf = (hist: { date: string; mid: number }[], date: string): number | null => {
      if (hist.length === 0) return null
      let v = hist[0].mid
      for (const h of hist) { if (h.date <= date) v = h.mid; else break }
      return v
    }
    return dates.map(date => {
      let total = 0
      holdings.forEach(h => { const p = priceAsOf(h.history, date); if (p != null) total += p * h.qty })
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
          カード詳細ページの「コレクションに追加」で所持枚数を設定するとここに表示されます
        </p>
        <div style={{ border: '1px dashed var(--hair)', borderRadius: '12px', padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: 'var(--ink-faint)', marginBottom: '16px' }}>まだカードが登録されていません</p>
          <p style={{ fontSize: '12px', color: 'var(--ink-faint)', marginBottom: '16px' }}>収録弾から探す</p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {boxes.map(b => (
              <Link key={b.box_id} href={`/boxes/${b.box_id}`} style={{ padding: '8px 16px', border: '1px solid var(--hair)', borderRadius: '8px', fontSize: '13px', color: 'var(--ink-dim)' }}>
                {b.box_name} →
              </Link>
            ))}
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
          {holdings.length}種 / {totalQty}枚
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
              * AI予想がない保有は集計から除外しています
            </p>
          )}
        </div>
      )}

      {/* 保有リスト */}
      <div style={{ border: '1px solid var(--hair)', borderRadius: '8px', overflow: 'hidden' }}>
        {[...holdings]
          .sort((a, b) => (b.unitPrice * b.qty) - (a.unitPrice * a.qty))
          .map(h => {
            const card = h.card
            const isPsa = h.variant === 'psa10'
            const subtotalCurrent = h.unitPrice * h.qty
            const pctHigh = h.m3High != null && h.unitPrice > 0 ? Math.round(((h.m3High - h.unitPrice) / h.unitPrice) * 100) : null
            const pctLow = h.m3Low != null && h.unitPrice > 0 ? Math.round(((h.m3Low - h.unitPrice) / h.unitPrice) * 100) : null

            return (
              <div key={h.key} style={{ borderBottom: '1px solid var(--hair)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <Link href={`/cards/${card.id}`} style={{ flexShrink: 0 }}>
                    {card.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.image_url} alt={card.card_name} referrerPolicy="no-referrer"
                        style={{ width: '36px', height: '50px', objectFit: 'cover', borderRadius: '4px', display: 'block' }} />
                    ) : (
                      <div style={{ width: '36px', height: '50px', borderRadius: '4px', background: 'var(--bg2)', border: '1px solid var(--hair)' }} />
                    )}
                  </Link>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <Link href={`/cards/${card.id}`} style={{ fontWeight: 700, fontSize: '14px', color: 'inherit' }}>
                        {card.card_name}
                      </Link>
                      <span className="rare-badge">{card.rarity}</span>
                      {isPsa && (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: 700, color: '#6c8ebf', border: '1px solid #6c8ebf', borderRadius: '4px', padding: '1px 5px', letterSpacing: '0.04em' }}>
                          PSA10
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: 'var(--ink-faint)' }}>{card.box_name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: isPsa ? '#6c8ebf' : 'var(--ink-dim)' }}>
                        ¥{h.unitPrice.toLocaleString()}
                      </span>
                      {h.m3Low != null && h.m3High != null && (
                        <>
                          <span style={{ color: 'var(--hair)', fontSize: '12px' }}>→</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: pctHigh != null && pctHigh > 0 ? 'var(--up)' : pctLow != null && pctLow < 0 ? 'var(--down)' : 'var(--ink-dim)' }}>
                            ¥{h.m3Low.toLocaleString()}〜¥{h.m3High.toLocaleString()}
                          </span>
                          {pctHigh != null && (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: pctHigh > 0 ? 'var(--up)' : pctLow != null && pctLow < 0 ? 'var(--down)' : 'var(--ink-faint)' }}>
                              {pctHigh > 0 ? '+' : ''}{pctHigh}%
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {h.qty > 1 && (
                      <div style={{ marginTop: '4px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)' }}>
                        ×{h.qty}枚 = 計¥{subtotalCurrent.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <button
                      onClick={() => setQty(h.key, h.qty - 1)}
                      style={{ width: '26px', height: '26px', borderRadius: '50%', border: '1px solid var(--hair)', background: 'transparent', color: 'var(--ink-dim)', fontSize: '16px', lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >−</button>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 700, minWidth: '20px', textAlign: 'center', color: isPsa ? '#6c8ebf' : 'var(--gold)' }}>
                      {h.qty}
                    </span>
                    <button
                      onClick={() => setQty(h.key, h.qty + 1)}
                      style={{ width: '26px', height: '26px', borderRadius: '50%', border: '1px solid var(--hair)', background: 'transparent', color: 'var(--ink-dim)', fontSize: '16px', lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
