// 特定BOXのカードだけ予想を生成する（既存の他カードを巻き込まない）
// 使い方: npx tsx scripts/update-forecasts-box.ts mega_brave
import * as fs from 'fs'
import * as path from 'path'
import { generateForecast } from '@/lib/forecast'
import { getAllCards, getCardSlug } from '@/lib/data'
import { createForecastContextBuilder } from '@/lib/forecast-context'
import type { PriceHistory, PriceRecord } from '@/types/pokeca'

const forecastDir = path.join(process.cwd(), 'data', 'forecasts')
const pricesDir = path.join(process.cwd(), 'data', 'prices')
fs.mkdirSync(forecastDir, { recursive: true })

function getPriceData(cardId: string): { low: number; high: number; history: PriceRecord[] } | null {
  try {
    const data: PriceHistory = JSON.parse(fs.readFileSync(path.join(pricesDir, `${cardId}.json`), 'utf-8'))
    if (data.history.length > 0) {
      const record = data.history[0]
      const avg = record.avg ?? record.low
      const low = record.low < record.high ? record.low : Math.round(avg * 0.9)
      const high = record.low < record.high ? record.high : Math.round(avg * 1.1)
      return { low, high, history: data.history }
    }
  } catch {}
  return null
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  const boxFilter = process.argv[2]
  if (!boxFilter) { console.error('使い方: npx tsx scripts/update-forecasts-box.ts <box_id>'); process.exit(1) }

  const cards = getAllCards().filter(c => c.box_id === boxFilter)
  // 較正・同名カード比較には弾の全カードが要るので、文脈ビルダーには絞り込み前の全カードを渡す
  const buildContext = createForecastContextBuilder(getAllCards())
  console.log(`［${boxFilter}］${cards.length}枚の予想を生成します\n`)

  let ok = 0, failed = 0, apiCalls = 0
  for (const card of cards) {
    const cardId = getCardSlug(card)
    process.stdout.write(`  [${card.card_name} ${card.rarity}] `)
    const price = getPriceData(cardId)
    if (!price) { console.log('価格データなし — スキップ'); failed++; continue }
    if (apiCalls > 0) await sleep(4000)
    try {
      const forecast = await generateForecast(card, price.low, price.high, price.history, buildContext(card))
      apiCalls++
      fs.writeFileSync(path.join(forecastDir, `${cardId}.json`), JSON.stringify(forecast, null, 2), 'utf-8')
      const { up_pct, flat_pct, down_pct } = forecast.overall
      console.log(`完了 [↑${up_pct}% →${flat_pct}% ↓${down_pct}%] ¥${price.low.toLocaleString()}〜¥${price.high.toLocaleString()}`)
      ok++
    } catch (e) {
      apiCalls++
      console.log('失敗', e instanceof Error ? e.message : e)
      failed++
    }
  }
  console.log(`\n完了: ${ok}枚生成, ${failed}枚失敗`)
}

main()
