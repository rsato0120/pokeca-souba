import * as fs from 'fs'
import * as path from 'path'
import { generateForecast } from '@/lib/forecast'
import { getAllCards, getCardSlug } from '@/lib/data'

const dir = path.join(process.cwd(), 'data', 'forecasts')
fs.mkdirSync(dir, { recursive: true })

async function main() {
  const cards = getAllCards()
  console.log(`${cards.length}枚のカードを処理します\n`)

  let success = 0
  let failed = 0

  for (const card of cards) {
    const cardId = getCardSlug(card)
    process.stdout.write(`[${card.card_name} ${card.rarity}] 生成中... `)
    try {
      const forecast = await generateForecast(card)
      fs.writeFileSync(
        path.join(dir, `${cardId}.json`),
        JSON.stringify(forecast, null, 2),
        'utf-8'
      )
      const { up_pct, flat_pct, down_pct } = forecast.overall
      const price = `¥${forecast.price_forecast.current_low.toLocaleString()}〜¥${forecast.price_forecast.current_high.toLocaleString()}`
      console.log(`完了 [↑${up_pct}% →${flat_pct}% ↓${down_pct}%] ${price}`)
    } catch (e) {
      console.log('失敗')
      console.error('  エラー:', e instanceof Error ? e.message : e)
      failed++
    }
    success++
  }

  console.log(`\n完了: ${success}枚処理, ${failed}枚失敗`)
  if (failed > 0) process.exit(1)
}

main()
