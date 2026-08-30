import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllCards, getCardSlug, getForecast, getPriceHistory, getPriceExtremes } from '@/lib/data'
import { selectBuyCandidates, type BuyInput } from '@/lib/buy-signals'
import { computeCardScore } from '@/lib/score'
import { computeAccuracy } from '@/lib/accuracy'
import { aiVerdict, UP_VERDICT_PCT } from '@/lib/verdict'
import { midOf } from '@/lib/market'
import SiteHeader from '@/components/SiteHeader'
import HeatPicks, { type HeatPick } from '@/components/HeatPicks'
import AccuracyStrip from '@/components/AccuracyStrip'

// AI予想タブ。トップページに散っていた「AIが見つけたカード」「的中率」「予想一覧」を
// ここに集約する（トップは検索・指数・急騰急落・BOX上位だけに絞った）。
//
// ⚠ 既存URLは維持している。/accuracy（的中実績の詳細）はそのまま残し、ここから飛ばす。

export const metadata: Metadata = {
  title: 'AI予想',
  description: 'AIが見つけた注目カード、3ヶ月後の予想価格、予想の的中率をまとめて見られます。',
}

export default function AiPage() {
  const cards = getAllCards()
  const buyInputs: BuyInput[] = cards.map((card) => {
    const slug = getCardSlug(card)
    return {
      card,
      slug,
      forecast: getForecast(slug),
      history: getPriceHistory(slug)?.history ?? [],
      extremes: getPriceExtremes(slug),
    }
  })

  const scoreOf = (b: BuyInput) =>
    computeCardScore({ card: b.card, forecast: b.forecast, history: b.history, extremes: b.extremes })?.total ?? null
  const scoreBySlug = new Map(buyInputs.map((b) => [b.slug, scoreOf(b)]))

  const dayPctOf = (slug: string): number | null => {
    const h = getPriceHistory(slug)?.history ?? []
    const t = h[0], y = h[1]
    if (!t || !y) return null
    const v = ((midOf(t) - midOf(y)) / midOf(y)) * 100
    return Math.abs(v) > 20 ? null : v
  }

  const toPick = (c: ReturnType<typeof selectBuyCandidates>[number]): HeatPick => {
    const fc = getForecast(c.slug)
    return {
      slug: c.slug,
      name: c.card.card_name,
      rarity: c.card.rarity,
      cardNo: c.card.card_no,
      image: c.card.image_url ?? null,
      mid: c.mid,
      dayPct: dayPctOf(c.slug),
      score: scoreBySlug.get(c.slug) ?? null,
      upPct: fc?.overall.up_pct ?? null,
      m3Low: fc?.price_forecast.m3_low ?? null,
      m3High: fc?.price_forecast.m3_high ?? null,
      omens: c.omens,
      cautions: c.cautions,
      thesis: null,
    }
  }

  const picks = selectBuyCandidates(buyInputs, 9, 2).map(toPick)
  const accuracy = computeAccuracy()

  // 予想結果一覧（上昇確率の高い順）。ラベルと確率が矛盾しないよう aiVerdict を使う
  const forecastRows = cards
    .map((card) => {
      const slug = getCardSlug(card)
      const fc = getForecast(slug)
      if (!fc) return null
      const h = getPriceHistory(slug)?.history ?? []
      const cur = h[0] ? Math.round(midOf(h[0])) : null
      return {
        slug,
        name: card.card_name,
        rarity: card.rarity,
        upPct: fc.overall.up_pct,
        verdict: aiVerdict(fc.overall),
        cur,
        m3Low: fc.price_forecast.m3_low,
        m3High: fc.price_forecast.m3_high,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r != null)
    .sort((a, b) => b.upPct - a.upPct)
    .slice(0, 60)

  return (
    <div className="wrap">
      <SiteHeader />

      <h1 style={{ fontFamily: 'var(--mincho)', fontSize: '24px', fontWeight: 700, margin: '8px 0 6px' }}>AI予想</h1>
      <p style={{ fontSize: '13px', color: 'var(--ink-faint)', lineHeight: 1.8, marginBottom: '28px' }}>
        AIは価格を取りにいきません。実際の成約データ（メルカリ・スニーカーダンク）から作った数字を材料に、
        <strong style={{ color: 'var(--ink-dim)', fontWeight: 600 }}>解釈だけ</strong>を担当します。
      </p>

      {picks.length > 0 && (
        <section className="sec">
          <div className="sec-head">
            <span className="sec-no" style={{ color: 'var(--brand)' }}>■</span>
            <span className="sec-title">AIが見つけたカード</span>
            <span className="sec-sub">上昇確率{UP_VERDICT_PCT}%以上の銘柄だけ</span>
          </div>
          <HeatPicks picks={picks} />
        </section>
      )}

      <section className="sec" style={{ marginTop: '32px' }}>
        <div className="sec-head">
          <span className="sec-no" style={{ color: 'var(--brand)' }}>■</span>
          <span className="sec-title">AI予想の的中率</span>
          <span className="sec-sub">
            <Link href="/accuracy" style={{ color: 'var(--accent)' }}>詳しい実績を見る →</Link>
          </span>
        </div>
        <AccuracyStrip summary={accuracy} />
      </section>

      <section className="sec" style={{ marginTop: '32px' }}>
        <div className="sec-head">
          <span className="sec-no" style={{ color: 'var(--brand)' }}>■</span>
          <span className="sec-title">予想結果一覧</span>
          <span className="sec-sub">上昇確率の高い順・上位60件</span>
        </div>
        <div style={{ border: '1px solid var(--hair)', borderRadius: '8px', overflowX: 'auto' }}>
          <div style={{ minWidth: '520px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px 84px 150px', gap: '10px', padding: '8px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--hair)', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-faint)', letterSpacing: '0.08em' }}>
              <span>カード</span>
              <span style={{ textAlign: 'right' }}>AI評価</span>
              <span style={{ textAlign: 'right' }}>上昇確率</span>
              <span style={{ textAlign: 'right' }}>現在 → 3ヶ月後</span>
            </div>
            {forecastRows.map((r) => (
              <Link
                key={r.slug}
                href={`/cards/${r.slug}`}
                style={{ display: 'grid', gridTemplateColumns: '1fr 92px 84px 150px', gap: '10px', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--hair)', color: 'inherit' }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name} <span className="rare-badge">{r.rarity}</span>
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', textAlign: 'right', color: r.verdict.color }}>
                  {r.verdict.label}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', textAlign: 'right', color: 'var(--ink-dim)' }}>
                  {r.upPct}%
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', textAlign: 'right', color: 'var(--ink-dim)' }}>
                  {r.cur == null ? '—' : `¥${r.cur.toLocaleString()}`} → ¥{r.m3Low.toLocaleString()}〜¥{r.m3High.toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
