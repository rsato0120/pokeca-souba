import type { Metadata } from 'next'
import { getAllCards, getAllBoxes, getForecast, getPriceHistory } from '@/lib/data'
import PortfolioView, { type PortfolioCardData } from '@/components/PortfolioView'

export const metadata: Metadata = {
  title: 'マイコレクション',
  description: '持っているカードのAI予想合計額を確認',
}

export default function PortfolioPage() {
  const cards = getAllCards()
  const boxes = getAllBoxes()
  const boxMap = new Map(boxes.map(b => [b.box_id, b.box_name]))

  const portfolioCards: PortfolioCardData[] = cards.map(card => {
    const forecast = getForecast(card.id)
    const history = getPriceHistory(card.id)
    const today = history?.history[0]
    const low = today?.low ?? 0
    const high = today?.high ?? 0

    // 評価額グラフ用に直近30日の中央値(mid)を昇順で渡す
    const hist = (history?.history ?? [])
      .slice(0, 30)
      .map(r => ({
        date: r.date,
        mid: r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2,
      }))
      .reverse()

    return {
      id: card.id,
      card_name: card.card_name,
      rarity: card.rarity,
      card_no: card.card_no,
      box_name: boxMap.get(card.box_id) ?? card.box_id,
      image_url: card.image_url ?? null,
      currentLow: low,
      currentHigh: high,
      currentMid: low > 0 && high > 0 ? Math.round((low + high) / 2) : 0,
      m3Low: forecast?.price_forecast.m3_low ?? null,
      m3High: forecast?.price_forecast.m3_high ?? null,
      history: hist,
    }
  })

  return <PortfolioView cards={portfolioCards} />
}
