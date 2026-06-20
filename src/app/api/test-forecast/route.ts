import fs from 'fs'
import path from 'path'
import { getAllCards, getCardSlug } from '@/lib/data'
import { generateForecast } from '@/lib/forecast'
import type { PriceHistory, PriceRecord } from '@/types/pokeca'

// 動作確認用: GET /api/test-forecast
// カード1枚目のAI予想を生成して data/forecasts/{cardId}.json に保存して返す
export async function GET() {
  const cards = getAllCards()
  if (cards.length === 0) {
    return Response.json({ error: 'カードデータがありません' }, { status: 404 })
  }

  try {
    const card = cards[0]
    const cardId = getCardSlug(card)

    const pricesPath = path.join(process.cwd(), 'data', 'prices', `${cardId}.json`)
    let currentLow = 2500
    let currentHigh = 3500
    let history: PriceRecord[] = []
    try {
      const priceData: PriceHistory = JSON.parse(fs.readFileSync(pricesPath, 'utf-8'))
      if (priceData.history.length > 0) {
        currentLow = priceData.history[0].low
        currentHigh = priceData.history[0].high
        history = priceData.history
      }
    } catch {}

    const forecast = await generateForecast(card, currentLow, currentHigh, history)

    const dir = path.join(process.cwd(), 'data', 'forecasts')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, `${cardId}.json`), JSON.stringify(forecast, null, 2), 'utf-8')

    return Response.json({ card: card.card_name, cardId, forecast })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
