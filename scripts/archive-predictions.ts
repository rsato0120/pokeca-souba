// 毎日のAI予想を data/predictions/{cardId}.json にスナップショット保存する。
// 後日 /accuracy ページで実相場と照合して的中率を出す。
// 日次フロー（scrape → forecast → ここ）で実行する想定。
import * as fs from 'fs'
import * as path from 'path'
import { getAllCards, getCardSlug, getForecast, getPriceHistory } from '@/lib/data'
import type { PredictionLog, PredictionRecord, PriceRecord } from '@/types/pokeca'

const predDir = path.join(process.cwd(), 'data', 'predictions')
fs.mkdirSync(predDir, { recursive: true })

function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function midOf(r: PriceRecord): number {
  return r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2
}

function main() {
  const date = todayJST()
  const cards = getAllCards()
  let saved = 0, skipped = 0

  for (const card of cards) {
    const cardId = getCardSlug(card)
    const forecast = getForecast(cardId)
    const history = getPriceHistory(cardId)
    const latest = history?.history?.[0]
    if (!forecast || !latest) { skipped++; continue }

    const mid = Math.round(midOf(latest))
    if (mid <= 0) { skipped++; continue }

    const rec: PredictionRecord = {
      date,
      mid,
      up_pct: forecast.overall.up_pct,
      flat_pct: forecast.overall.flat_pct,
      down_pct: forecast.overall.down_pct,
    }

    const file = path.join(predDir, `${cardId}.json`)
    let log: PredictionLog = { card_id: cardId, predictions: [] }
    try { log = JSON.parse(fs.readFileSync(file, 'utf-8')) } catch {}

    const idx = log.predictions.findIndex(p => p.date === date)
    if (idx >= 0) log.predictions[idx] = rec
    else log.predictions.push(rec)

    log.predictions.sort((a, b) => b.date.localeCompare(a.date))
    log.predictions = log.predictions.slice(0, 200) // 約半年分
    fs.writeFileSync(file, JSON.stringify(log, null, 2), 'utf-8')
    saved++
  }

  console.log(`予想アーカイブ完了 (${date}): ${saved}件保存, ${skipped}件スキップ`)
}

main()
