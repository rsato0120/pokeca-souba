import * as fs from 'fs'
import * as path from 'path'
import { generateForecast, adjustRankings } from '@/lib/forecast'
import { getAllCards, getCardSlug } from '@/lib/data'
import type { Forecast, PriceHistory } from '@/types/pokeca'

const forecastDir = path.join(process.cwd(), 'data', 'forecasts')
const pricesDir = path.join(process.cwd(), 'data', 'prices')
fs.mkdirSync(forecastDir, { recursive: true })
fs.mkdirSync(pricesDir, { recursive: true })

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

  data.history.sort((a, b) => b.date.localeCompare(a.date))
  data.history = data.history.slice(0, 30)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

async function main() {
  const cards = getAllCards()
  const date = todayJST()
  console.log(`${cards.length}枚のカードを処理します（${date} JST）\n`)

  // ── Step 1: 個別予想生成 ──────────────────────────────────────
  console.log('【Step 1】個別予想を生成中...\n')
  const succeeded: Array<{ cardId: string; card: typeof cards[0]; forecast: Forecast }> = []
  let failed = 0

  for (const card of cards) {
    const cardId = getCardSlug(card)
    process.stdout.write(`  [${card.card_name} ${card.rarity}] 生成中... `)
    try {
      const forecast = await generateForecast(card)
      savePriceHistory(cardId, date, forecast.price_forecast.current_low, forecast.price_forecast.current_high)
      succeeded.push({ cardId, card, forecast })
      const { up_pct, flat_pct, down_pct } = forecast.overall
      const price = `¥${forecast.price_forecast.current_low.toLocaleString()}〜¥${forecast.price_forecast.current_high.toLocaleString()}`
      console.log(`完了 [↑${up_pct}% →${flat_pct}% ↓${down_pct}%] ${price}`)
    } catch (e) {
      console.log('失敗')
      console.error('    エラー:', e instanceof Error ? e.message : e)
      failed++
    }
  }

  // ── Step 2: ランキング調整パス ───────────────────────────────
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
    // カード1枚のみの場合はそのまま保存
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
