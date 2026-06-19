import fs from 'fs'
import path from 'path'
import { getAllCards, getCardSlug } from '@/lib/data'
import { generateForecast } from '@/lib/forecast'

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
    const forecast = await generateForecast(card)

    const dir = path.join(process.cwd(), 'data', 'forecasts')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, `${cardId}.json`), JSON.stringify(forecast, null, 2), 'utf-8')

    return Response.json({ card: card.card_name, cardId, forecast })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
