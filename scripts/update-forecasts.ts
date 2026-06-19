import * as fs from 'fs'
import * as path from 'path'
import { generateForecast } from '@/lib/forecast'
import { getAllCards, getCardSlug } from '@/lib/data'
import type { PriceHistory } from '@/types/pokeca'

const forecastDir = path.join(process.cwd(), 'data', 'forecasts')
const pricesDir = path.join(process.cwd(), 'data', 'prices')
fs.mkdirSync(forecastDir, { recursive: true })
fs.mkdirSync(pricesDir, { recursive: true })

// JST の今日の日付を "YYYY-MM-DD" で返す
function todayJST(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

function savePriceHistory(cardId: string, date: string, low: number, high: number) {
  const filePath = path.join(pricesDir, `${cardId}.json`)
  let data: PriceHistory = { card_id: cardId, history: [] }
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {}

  const idx = data.history.findIndex((r) => r.date === date)
  if (idx >= 0) {
    data.history[idx] = { date, low, high }
  } else {
    data.history.push({ date, low, high })
  }

  // 新しい日付順にソートして30日分のみ保持
  data.history.sort((a, b) => b.date.localeCompare(a.date))
  data.history = data.history.slice(0, 30)

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

async function main() {
  const cards = getAllCards()
  const date = todayJST()
  console.log(`${cards.length}枚のカードを処理します（${date} JST）\n`)

  let success = 0
  let failed = 0

  for (const card of cards) {
    const cardId = getCardSlug(card)
    process.stdout.write(`[${card.card_name} ${card.rarity}] 生成中... `)
    try {
      const forecast = await generateForecast(card)
      fs.writeFileSync(
        path.join(forecastDir, `${cardId}.json`),
        JSON.stringify(forecast, null, 2),
        'utf-8'
      )

      // 価格履歴に今日の相場を追記
      const { current_low, current_high } = forecast.price_forecast
      savePriceHistory(cardId, date, current_low, current_high)

      const { up_pct, flat_pct, down_pct } = forecast.overall
      const price = `¥${current_low.toLocaleString()}〜¥${current_high.toLocaleString()}`
      console.log(`完了 [↑${up_pct}% →${flat_pct}% ↓${down_pct}%] ${price}`)
      success++
    } catch (e) {
      console.log('失敗')
      console.error('  エラー:', e instanceof Error ? e.message : e)
      failed++
    }
  }

  console.log(`\n完了: ${success}枚処理, ${failed}枚失敗`)
  if (failed > 0) process.exit(1)
}

main()
