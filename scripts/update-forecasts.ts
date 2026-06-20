import * as fs from 'fs'
import * as path from 'path'
import { generateForecast, adjustRankings } from '@/lib/forecast'
import { getAllCards, getCardSlug } from '@/lib/data'
import type { Forecast, PriceHistory, PriceRecord } from '@/types/pokeca'

const forecastDir = path.join(process.cwd(), 'data', 'forecasts')
const pricesDir = path.join(process.cwd(), 'data', 'prices')
fs.mkdirSync(forecastDir, { recursive: true })

function getPriceData(cardId: string): { low: number; high: number; history: PriceRecord[] } | null {
  const filePath = path.join(pricesDir, `${cardId}.json`)
  try {
    const data: PriceHistory = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    if (data.history.length > 0) {
      const { low, high } = data.history[0]
      return { low, high, history: data.history }
    }
  } catch {}
  return null
}

async function main() {
  const cards = getAllCards()
  console.log(`${cards.length}枚のカードの予想を生成します\n`)

  console.log('【Step 1】個別予想を生成中...\n')
  const succeeded: Array<{ cardId: string; card: typeof cards[0]; forecast: Forecast }> = []
  let failed = 0

  for (const card of cards) {
    const cardId = getCardSlug(card)
    process.stdout.write(`  [${card.card_name} ${card.rarity}] `)

    const price = getPriceData(cardId)
    if (!price) {
      console.log('価格データなし — スキップ（scrape-prices.ts を先に実行してください）')
      failed++
      continue
    }

    process.stdout.write('予想生成中... ')
    try {
      const forecast = await generateForecast(card, price.low, price.high, price.history)
      succeeded.push({ cardId, card, forecast })
      const { up_pct, flat_pct, down_pct } = forecast.overall
      const priceStr = `¥${price.low.toLocaleString()}〜¥${price.high.toLocaleString()}`
      console.log(`完了 [↑${up_pct}% →${flat_pct}% ↓${down_pct}%] ${priceStr}`)
    } catch (e) {
      console.log('失敗')
      console.error('    エラー:', e instanceof Error ? e.message : e)
      failed++
    }
  }

  if (succeeded.length > 1) {
    console.log('\n【Step 2】ランキング調整中...')
    const rankMap = await adjustRankings(succeeded)

    for (const { cardId, forecast } of succeeded) {
      const adjusted = rankMap.get(cardId)
      if (adjusted) {
        forecast.overall.up_pct = adjusted.up_pct
        forecast.overall.flat_pct = adjusted.flat_pct
        forecast.overall.down_pct = adjusted.down_pct
      }
      fs.writeFileSync(
        path.join(forecastDir, `${cardId}.json`),
        JSON.stringify(forecast, null, 2),
        'utf-8'
      )
    }

    const sorted = [...succeeded].sort(
      (a, b) => (rankMap.get(b.cardId)?.up_pct ?? 0) - (rankMap.get(a.cardId)?.up_pct ?? 0)
    )
    console.log('  調整後ランキング:')
    sorted.forEach(({ cardId, card }, i) => {
      const s = rankMap.get(cardId)
      console.log(`    ${i + 1}. ${card.card_name} ${card.rarity} → ↑${s?.up_pct}% →${s?.flat_pct}% ↓${s?.down_pct}%`)
    })
  } else {
    for (const { cardId, forecast } of succeeded) {
      fs.writeFileSync(
        path.join(forecastDir, `${cardId}.json`),
        JSON.stringify(forecast, null, 2),
        'utf-8'
      )
    }
  }

  console.log(`\n完了: ${succeeded.length}枚処理, ${failed}枚失敗`)
  if (failed > 0) process.exit(1)
}

main()
