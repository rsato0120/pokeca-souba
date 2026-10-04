import { priceChangePctForDays } from '@/lib/price-change'
import type { Metadata } from 'next'
import { getAllCards, getCardSlug, getForecast, getPriceHistory, getPriceExtremes } from '@/lib/data'
import { selectBuyCandidates, type BuyInput } from '@/lib/buy-signals'
import { computeCardScore } from '@/lib/score'
import { computeAccuracy } from '@/lib/accuracy'
import { aiVerdict } from '@/lib/verdict'
import { midOf } from '@/lib/market'
import AiOverview from '@/components/AiOverview'
import { type HeatPick } from '@/components/HeatPicks'

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
    return priceChangePctForDays(h, 1, 1, 20, 6)
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

  return <AiOverview picks={picks} accuracy={accuracy} forecastRows={forecastRows} movementPrioritized />
}
