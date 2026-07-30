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

    // 評価額グラフ用に直近90日の中央値(mid)を昇順で渡す（表示期間の切替はクライアント側）
    const records = history?.history ?? []
    const hist = records
      .slice(0, 90)
      .map(r => ({
        date: r.date,
        mid: r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2,
      }))
      .reverse()

    // PSA10: 直近90日のpsa10価格（nullの日は除外）を昇順で。現在値は直近の既知値。
    const psaHist = records
      .slice(0, 90)
      .filter(r => r.psa10 != null)
      .map(r => ({ date: r.date, mid: Number(r.psa10) }))
      .reverse()
    const psa10Current = records.find(r => r.psa10 != null)?.psa10 ?? null

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
      psa10Current: psa10Current != null ? Number(psa10Current) : null,
      psa10History: psaHist,
    }
  })

  const releasedBoxes = boxes
    .filter(b => b.certainty === 'released')
    .map(b => ({ box_id: b.box_id, box_name: b.box_name }))

  return <PortfolioView cards={portfolioCards} boxes={releasedBoxes} />
}
